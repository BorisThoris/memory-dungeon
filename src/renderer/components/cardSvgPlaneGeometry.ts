/**
 * Loads each card SVG (`authored-card-back.svg` / `front.svg`) as a **single merged** `BufferGeometry` per URL.
 * Traced SVGs are not decomposed into separate meshes per motif; DOM chrome uses the same URLs via CSS / `<img>`.
 */
import { BufferAttribute, Color, MathUtils, ShapeGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/** Skip degenerate paths; merged card must stay under this for mobile GPUs. */
const MAX_VERTEX_COUNT = 520_000;

/**
 * SVGLoader + merge on multi‑MB card art freezes the main thread for seconds; those assets already
 * render via raster textures (`tileTextures` + `?url` images). Skip mesh build using `Content-Length`
 * or a bounded stream read so we never buffer a multi‑MB string just to discard it (jank + memory).
 */
const MAX_SVG_SOURCE_BYTES_FOR_MESH = 512 * 1024;
const MAX_TRANSIENT_SVG_LOAD_ATTEMPTS = 2;

const resolvedByUrl = new Map<string, BufferGeometry | null>();
const inflightByUrl = new Map<string, Promise<BufferGeometry | null>>();
const failedAttemptsByUrl = new Map<string, number>();
export const CARD_BACK_SVG_LAYER_NAMES = [
    'back-base',
    'back-rims',
    'back-corners',
    'back-corner-scrolls',
    'back-scrolls',
    'back-rings',
    'back-gem',
    'back-vignette'
] as const;
export type CardBackSvgLayerName = (typeof CARD_BACK_SVG_LAYER_NAMES)[number];
export interface CardBackSvgLayerGeometry {
    geometry: BufferGeometry;
    name: CardBackSvgLayerName;
}

const backLayerOrder = new Map<CardBackSvgLayerName, number>(CARD_BACK_SVG_LAYER_NAMES.map((name, index) => [name, index]));
const resolvedBackLayersByUrl = new Map<string, CardBackSvgLayerGeometry[] | null>();
const inflightBackLayersByUrl = new Map<string, Promise<CardBackSvgLayerGeometry[] | null>>();
const failedBackLayerAttemptsByUrl = new Map<string, number>();

const recordTransientSvgLoadFailure = <T>(
    assetUrl: string,
    failedAttempts: Map<string, number>,
    resolved: Map<string, T | null>
): void => {
    const attempts = (failedAttempts.get(assetUrl) ?? 0) + 1;
    failedAttempts.set(assetUrl, attempts);
    if (attempts >= MAX_TRANSIENT_SVG_LOAD_ATTEMPTS) {
        resolved.set(assetUrl, null);
    }
};

const CARD_BACK_LAYER_FALLBACK_COLORS: Record<CardBackSvgLayerName, { fill: string; stroke: string }> = {
    'back-base': { fill: '#2d1d13', stroke: '#2d1d13' },
    'back-rims': { fill: '#c3954f', stroke: '#d7b56a' },
    'back-corners': { fill: '#c3954f', stroke: '#d7b56a' },
    'back-corner-scrolls': { fill: '#b48243', stroke: '#c3954f' },
    'back-scrolls': { fill: '#d7b56a', stroke: '#d7b56a' },
    'back-rings': { fill: '#c3954f', stroke: '#c3954f' },
    'back-gem': { fill: '#3f8aa8', stroke: '#e9d39c' },
    'back-vignette': { fill: '#000000', stroke: '#000000' }
};

interface SvgViewBox {
    height: number;
    minX: number;
    minY: number;
    width: number;
}

/**
 * Loads SVG source only when under {@link MAX_SVG_SOURCE_BYTES_FOR_MESH}.
 * Uses `Content-Length` to bail out **without** buffering huge bodies; streams unknown lengths with a hard cap
 * so multi‑MB assets never allocate a full string just to skip mesh build.
 */
async function fetchSvgTextUnderMeshByteCap(assetUrl: string): Promise<string | null> {
    const response = await fetch(assetUrl);

    if (!response.ok) {
        throw new Error(`SVG fetch ${response.status}`);
    }

    const clHeader = response.headers.get('content-length');

    if (clHeader != null) {
        const bytes = Number(clHeader);

        if (Number.isFinite(bytes) && bytes > MAX_SVG_SOURCE_BYTES_FOR_MESH) {
            await response.body?.cancel?.();
            return null;
        }

        if (Number.isFinite(bytes) && bytes <= MAX_SVG_SOURCE_BYTES_FOR_MESH) {
            return response.text();
        }
    }

    const body = response.body;

    if (!body) {
        const text = await response.text();

        if (text.length > MAX_SVG_SOURCE_BYTES_FOR_MESH) {
            return null;
        }

        return text;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    const chunks: Uint8Array[] = [];

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            if (!value) {
                continue;
            }

            received += value.byteLength;

            if (received > MAX_SVG_SOURCE_BYTES_FOR_MESH) {
                await reader.cancel();
                return null;
            }

            chunks.push(value);
        }
    } catch (e) {
        await reader.cancel().catch(() => {
            /* ignore */
        });
        throw e;
    }

    if (received === 0) {
        return '';
    }

    const full = new Uint8Array(received);
    let offset = 0;

    for (const chunk of chunks) {
        full.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return decoder.decode(full);
}

function parseFillColor(style: Record<string, unknown> | undefined): Color | null {
    if (!style) {
        return null;
    }
    const fill = style.fill;
    if (typeof fill !== 'string' || fill === 'none' || fill === 'transparent' || fill.startsWith('url(')) {
        return null;
    }
    const c = new Color();
    try {
        c.setStyle(fill);
    } catch {
        return null;
    }
    const opacityRaw = style.fillOpacity;
    const opacity =
        typeof opacityRaw === 'string' ? Number.parseFloat(opacityRaw) : typeof opacityRaw === 'number' ? opacityRaw : 1;
    if (!Number.isFinite(opacity) || opacity <= 0) {
        return null;
    }
    if (opacity < 1) {
        c.multiplyScalar(Math.max(0, opacity));
    }
    return c;
}

function colorFromStyle(value: unknown, fallback?: string): Color | null {
    if (typeof value !== 'string' || value === 'none' || value === 'transparent') {
        return null;
    }
    const c = new Color();
    try {
        c.setStyle(value.startsWith('url(') && fallback ? fallback : value);
    } catch {
        if (!fallback) {
            return null;
        }
        try {
            c.setStyle(fallback);
        } catch {
            return null;
        }
    }
    return c;
}

function setGeometryVertexColor(geom: BufferGeometry, color: Color, opacity = 1): void {
    const n = geom.attributes.position.count;
    const colors = new Float32Array(n * 3);
    const mul = MathUtils.clamp(opacity, 0, 1);
    for (let i = 0; i < n; i += 1) {
        colors[i * 3] = color.r * mul;
        colors[i * 3 + 1] = color.g * mul;
        colors[i * 3 + 2] = color.b * mul;
    }
    geom.setAttribute('color', new BufferAttribute(colors, 3));
}

function styleOpacity(style: Record<string, unknown> | undefined, property: 'fillOpacity' | 'strokeOpacity'): number {
    if (!style) {
        return 1;
    }
    const opacityRaw = style[property] ?? style.opacity;
    const opacity =
        typeof opacityRaw === 'string' ? Number.parseFloat(opacityRaw) : typeof opacityRaw === 'number' ? opacityRaw : 1;
    return Number.isFinite(opacity) ? MathUtils.clamp(opacity, 0, 1) : 1;
}

function layerNameForPath(path: { userData?: unknown }): CardBackSvgLayerName | null {
    const userData = path.userData as { node?: { getAttribute?: (name: string) => string | null; parentNode?: unknown } } | undefined;
    let node = userData?.node;

    while (node) {
        const id = node.getAttribute?.('id');
        if (id && backLayerOrder.has(id as CardBackSvgLayerName)) {
            return id as CardBackSvgLayerName;
        }
        node = node.parentNode as typeof node;
    }

    return null;
}

function addFillAndStrokeGeometries(
    parts: BufferGeometry[],
    path: ReturnType<SVGLoader['parse']>['paths'][number],
    layerName: CardBackSvgLayerName
): void {
    const style = path.userData?.style as Record<string, unknown> | undefined;
    const fallback = CARD_BACK_LAYER_FALLBACK_COLORS[layerName];
    const fillColor = colorFromStyle(style?.fill, fallback.fill);
    if (fillColor) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
            const geom = new ShapeGeometry(shape);
            setGeometryVertexColor(geom, fillColor, styleOpacity(style, 'fillOpacity'));
            parts.push(geom);
        }
    }

    const strokeColor = colorFromStyle(style?.stroke, fallback.stroke);
    if (!strokeColor) {
        return;
    }

    for (const subPath of path.subPaths) {
        const strokeGeom = SVGLoader.pointsToStroke(
            subPath.getPoints(),
            (style ?? {}) as unknown as Parameters<typeof SVGLoader.pointsToStroke>[1],
            12,
            0.001
        );
        if (!strokeGeom) {
            continue;
        }
        setGeometryVertexColor(strokeGeom, strokeColor, styleOpacity(style, 'strokeOpacity'));
        parts.push(strokeGeom);
    }
}

function finalizeCardSvgGeometry(parts: BufferGeometry[], assetUrl: string): BufferGeometry | null {
    if (parts.length === 0) {
        return null;
    }

    const merged = mergeGeometries(parts, false);
    for (const p of parts) {
        p.dispose();
    }

    if (!merged || merged.attributes.position.count > MAX_VERTEX_COUNT) {
        console.warn(
            `cardSvgPlaneGeometry: vertex count ${merged?.attributes.position.count ?? 0} exceeds cap; use raster fallback (${assetUrl.slice(-48)})`
        );
        merged?.dispose();
        return null;
    }

    merged.computeBoundingBox();
    const box = merged.boundingBox;
    if (!box) {
        merged.dispose();
        return null;
    }

    const cx = (box.min.x + box.max.x) * 0.5;
    const cy = (box.min.y + box.max.y) * 0.5;
    merged.translate(-cx, -cy, 0);
    merged.scale(1, -1, 1);

    merged.computeBoundingBox();
    const b2 = merged.boundingBox;
    if (!b2) {
        merged.dispose();
        return null;
    }

    const bw = Math.max(b2.max.x - b2.min.x, 1e-6);
    const bh = Math.max(b2.max.y - b2.min.y, 1e-6);
    /** Slight XY inflation so adjacent SVGLoader sub-meshes overlap at fractional DPR (hairline seams). */
    const seamOverlapScale = 1.0006;
    merged.scale((CARD_PLANE_WIDTH / bw) * seamOverlapScale, (CARD_PLANE_HEIGHT / bh) * seamOverlapScale, 1);
    merged.computeVertexNormals();
    if (merged.index) {
        try {
            merged.computeTangents();
        } catch {
            /* non-fatal: normal mapping may be skipped for this mesh */
        }
    }

    return merged;
}

function parseSvgViewBox(text: string): SvgViewBox {
    const match = text.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
    if (!match) {
        return { minX: 0, minY: 0, width: 740, height: 1080 };
    }
    const minX = Number.parseFloat(match[1]!);
    const minY = Number.parseFloat(match[2]!);
    const width = Number.parseFloat(match[3]!);
    const height = Number.parseFloat(match[4]!);
    if (![minX, minY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        return { minX: 0, minY: 0, width: 740, height: 1080 };
    }
    return { minX, minY, width, height };
}

function finalizeCardSvgLayerGeometry(parts: BufferGeometry[], assetUrl: string, viewBox: SvgViewBox): BufferGeometry | null {
    if (parts.length === 0) {
        return null;
    }

    const merged = mergeGeometries(parts, false);
    for (const p of parts) {
        p.dispose();
    }

    if (!merged || merged.attributes.position.count > MAX_VERTEX_COUNT) {
        console.warn(
            `cardSvgPlaneGeometry: layer vertex count ${merged?.attributes.position.count ?? 0} exceeds cap; use raster fallback (${assetUrl.slice(-48)})`
        );
        merged?.dispose();
        return null;
    }

    const seamOverlapScale = 1.0006;
    const cx = viewBox.minX + viewBox.width * 0.5;
    const cy = viewBox.minY + viewBox.height * 0.5;
    merged.translate(-cx, -cy, 0);
    merged.scale((CARD_PLANE_WIDTH / viewBox.width) * seamOverlapScale, -(CARD_PLANE_HEIGHT / viewBox.height) * seamOverlapScale, 1);
    merged.computeVertexNormals();
    if (merged.index) {
        try {
            merged.computeTangents();
        } catch {
            /* non-fatal: normal mapping may be skipped for this mesh */
        }
    }
    return merged;
}

/**
 * Shared BufferGeometry per SVG URL: SVGLoader fills → merged, centered, Y-flipped,
 * non-uniformly scaled to {@link CARD_PLANE_WIDTH} × {@link CARD_PLANE_HEIGHT}.
 */
export function loadSharedCardSvgPlaneGeometry(assetUrl: string): Promise<BufferGeometry | null> {
    const hit = resolvedByUrl.get(assetUrl);
    if (hit !== undefined) {
        return Promise.resolve(hit);
    }

    let inflight = inflightByUrl.get(assetUrl);
    if (inflight) {
        return inflight;
    }

    inflight = (async (): Promise<BufferGeometry | null> => {
        try {
            const text = await fetchSvgTextUnderMeshByteCap(assetUrl);

            if (text === null) {
                failedAttemptsByUrl.delete(assetUrl);
                resolvedByUrl.set(assetUrl, null);
                return null;
            }

            const data = new SVGLoader().parse(text);
            const parts: BufferGeometry[] = [];

            for (const path of data.paths) {
                const style = path.userData?.style as Record<string, unknown> | undefined;
                const c = parseFillColor(style);
                if (!c) {
                    continue;
                }

                const shapes = SVGLoader.createShapes(path);
                for (const shape of shapes) {
                    const geom = new ShapeGeometry(shape);
                    setGeometryVertexColor(geom, c);
                    parts.push(geom);
                }
            }

            const merged = finalizeCardSvgGeometry(parts, assetUrl);

            if (!merged) {
                console.warn('cardSvgPlaneGeometry: no filled shapes in', assetUrl.slice(-40));
                failedAttemptsByUrl.delete(assetUrl);
                resolvedByUrl.set(assetUrl, null);
                return null;
            }

            failedAttemptsByUrl.delete(assetUrl);
            resolvedByUrl.set(assetUrl, merged);
            return merged;
        } catch (e) {
            console.warn('cardSvgPlaneGeometry: failed to build mesh', e);
            recordTransientSvgLoadFailure(assetUrl, failedAttemptsByUrl, resolvedByUrl);
            return null;
        } finally {
            inflightByUrl.delete(assetUrl);
        }
    })();

    inflightByUrl.set(assetUrl, inflight);
    return inflight;
}

export function loadSharedCardBackSvgLayerGeometries(assetUrl: string): Promise<CardBackSvgLayerGeometry[] | null> {
    const hit = resolvedBackLayersByUrl.get(assetUrl);
    if (hit !== undefined) {
        return Promise.resolve(hit);
    }

    let inflight = inflightBackLayersByUrl.get(assetUrl);
    if (inflight) {
        return inflight;
    }

    inflight = (async (): Promise<CardBackSvgLayerGeometry[] | null> => {
        try {
            const text = await fetchSvgTextUnderMeshByteCap(assetUrl);

            if (text === null) {
                failedBackLayerAttemptsByUrl.delete(assetUrl);
                resolvedBackLayersByUrl.set(assetUrl, null);
                return null;
            }

            const data = new SVGLoader().parse(text);
            const viewBox = parseSvgViewBox(text);
            const partsByLayer = new Map<CardBackSvgLayerName, BufferGeometry[]>();

            for (const path of data.paths) {
                const layerName = layerNameForPath(path);
                if (!layerName) {
                    continue;
                }
                const parts = partsByLayer.get(layerName) ?? [];
                addFillAndStrokeGeometries(parts, path, layerName);
                partsByLayer.set(layerName, parts);
            }

            const layers: CardBackSvgLayerGeometry[] = [];
            for (const name of CARD_BACK_SVG_LAYER_NAMES) {
                const parts = partsByLayer.get(name) ?? [];
                const geometry = finalizeCardSvgLayerGeometry(parts, assetUrl, viewBox);
                if (geometry) {
                    layers.push({ name, geometry });
                }
            }

            if (layers.length === 0) {
                console.warn('cardSvgPlaneGeometry: no animated back layers in', assetUrl.slice(-40));
                failedBackLayerAttemptsByUrl.delete(assetUrl);
                resolvedBackLayersByUrl.set(assetUrl, null);
                return null;
            }

            failedBackLayerAttemptsByUrl.delete(assetUrl);
            resolvedBackLayersByUrl.set(assetUrl, layers);
            return layers;
        } catch (e) {
            console.warn('cardSvgPlaneGeometry: failed to build layered back mesh', e);
            recordTransientSvgLoadFailure(assetUrl, failedBackLayerAttemptsByUrl, resolvedBackLayersByUrl);
            return null;
        } finally {
            inflightBackLayersByUrl.delete(assetUrl);
        }
    })();

    inflightBackLayersByUrl.set(assetUrl, inflight);
    return inflight;
}
