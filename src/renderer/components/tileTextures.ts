import {
    CanvasTexture,
    ClampToEdgeWrapping,
    LinearFilter,
    LinearMipmapLinearFilter,
    NoColorSpace,
    RepeatWrapping,
    SRGBColorSpace,
    Texture
} from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { RENDERER_THEME } from '../styles/theme';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import referenceBackTextureUrl from '../assets/textures/cards/authored-card-back.svg?url';
import cardBackNormalTextureUrl from '../assets/textures/cards/back-normal.webp';
import cardFaceTextureUrl from '../assets/textures/cards/front.svg?url';
import cardFaceNormalTextureUrl from '../assets/textures/cards/front-normal.webp';
import edgeTextureUrl from '../assets/textures/cards/edge.png';
import panelRoughnessTextureUrl from '../assets/textures/cards/panel-roughness.png';
import edgeRoughnessTextureUrl from '../assets/textures/cards/edge-roughness.png';
import { getCardFaceOverlayColors } from '../cardFace/cardFaceOverlayPalette';
import { overlayDrawTierFromGraphicsQuality, type OverlayDrawTier } from '../cardFace/overlayDrawTier';
import {
    drawProgrammaticCardFaceOverlay,
    tileUsesProgrammaticFaceMotif
} from '../cardFace/programmaticCardFace';
import {
    clearProceduralIllustrationBitmapCache,
    drawIllustrationInCanvasOverlay,
    drawProceduralIllustrationInCanvasOverlay,
    forceProceduralIllustrationBitmapCacheVersion,
    getProceduralIllustrationBitmapCacheDebugState,
    prewarmProceduralIllustrationBitmap
} from '../cardFace/cardIllustrationDraw';
import { CARD_ILLUSTRATION_REGISTRY } from '../cardFace/cardIllustrationRegistry';
import { getCardIllustrationImageByUrl } from '../cardFace/cardIllustrationImages';
import { resolveCardIllustrationUrl } from '../cardFace/resolveCardIllustrationUrl';
import { drawRasterDeckComposedOverlay, isCardRasterDeckEnabled } from '../cardFace/cardRasterDeck';
import { computeIllustrationPixelRect } from '../cardFace/cardIllustrationRect';
import {
    getIllustrationVersionStamp,
    getProceduralIllustrationRegressionStamp
} from '../cardFace/proceduralIllustration/illustrationCacheKey';
import { ILLUSTRATION_GEN_SCHEMA_VERSION } from '../cardFace/proceduralIllustration/illustrationSchemaVersion';
import { GAMEPLAY_CARD_VISUALS } from './gameplayVisualConfig';

export type FaceVariant = 'hidden' | 'active' | 'matched' | 'mismatch';
export type TileFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export type TileLayer = 'bezel' | 'panel' | 'shell' | 'core';
type IdleWindow = Window &
    typeof globalThis & {
        cancelIdleCallback?: (handle: number) => void;
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    };
type PrewarmScheduleHandle =
    | { cancelled: boolean; id: number; type: 'idle' }
    | { cancelled: boolean; id: number; type: 'timeout' };

type OverlayTextureCacheDebugState = {
    createdCount: number;
    hitCount: number;
    keys: string[];
    lastPurgeReason: string | null;
    overlayKeyCount: number;
    overlayKeys: string[];
    purgeCount: number;
    versionToken: string;
};

export type TileFaceOverlayRegressionStamp = {
    graphicsQuality: GraphicsQualityPreset;
    illustration: ReturnType<typeof getProceduralIllustrationRegressionStamp>;
    overlayCacheKey: string;
    pairKey: string;
    tier: OverlayDrawTier;
    tileId: string;
    variant: Exclude<FaceVariant, 'hidden'>;
};

export type OverlayPrewarmDebugState = {
    boardKey: string | null;
    completedCount: number;
    pendingCount: number;
    scheduled: boolean;
    targetCount: number;
    targetKeys: string[];
    tier: OverlayDrawTier | null;
    variant: Exclude<FaceVariant, 'hidden'> | null;
};

const OVERLAY_PREWARM_BATCH_SIZE = 4;

// Backward-compatible aliases for untouched imports.
export type CubeFace = TileFace;
export type CubeLayer = 'shell' | 'core';

/**
 * Tile face canvases: **one tile = one full canvas texture** (no multi-tile atlas UVs).
 * Procedural faces use `TEXTURE_SIZE`²; static PNG faces use `getStaticCardTexturePixelSize()` aspect = `CARD_PLANE_WIDTH`:`CARD_PLANE_HEIGHT`.
 */
const TEXTURE_SIZE = 512;
/** Taller canvas for WebGL static card PNGs so 1403×2048 sources aren’t over-downscaled (was 512 — felt cropped/soft). */
const STATIC_CARD_TEXTURE_HEIGHT = 1024;
const STATIC_CARD_TEXTURE_WIDTH = Math.max(2, Math.round(STATIC_CARD_TEXTURE_HEIGHT * (CARD_PLANE_WIDTH / CARD_PLANE_HEIGHT)));

let tileTextureSamplingQuality: GraphicsQualityPreset = 'medium';
let lastOverlayTextureQuality: GraphicsQualityPreset | null = null;

/** Regression anchor: static card bitmap dimensions must track `CARD_PLANE_*` in `tileShatter`. */
export const getStaticCardTexturePixelSize = (): { width: number; height: number } => ({
    width: STATIC_CARD_TEXTURE_WIDTH,
    height: STATIC_CARD_TEXTURE_HEIGHT
});

const applyCanvasTileTextureSampling = (texture: CanvasTexture | Texture, quality: GraphicsQualityPreset): void => {
    if (quality === 'low') {
        texture.generateMipmaps = false;
        texture.minFilter = LinearFilter;
    } else {
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
    }
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
};

/** Sync mips + minification filter with `graphicsQuality` whenever the WebGL tier changes. */
export const setTileTextureSamplingQuality = (quality: GraphicsQualityPreset): void => {
    if (lastOverlayTextureQuality !== quality) {
        lastOverlayTextureQuality = quality;
        for (const key of [...textureCache.keys()]) {
            if (key.includes(':overlay:')) {
                disposeCachedTexture(key);
            }
        }
    }
    tileTextureSamplingQuality = quality;
    for (const texture of textureCache.values()) {
        applyCanvasTileTextureSampling(texture, quality);
    }
    if (cachedRasterFaceNormalTexture) {
        applyCanvasTileTextureSampling(cachedRasterFaceNormalTexture, quality);
    }
    if (cachedRasterBackNormalTexture) {
        applyCanvasTileTextureSampling(cachedRasterBackNormalTexture, quality);
    }
};
const TILE_TEXTURE_VERSION = GAMEPLAY_CARD_VISUALS.textureVersion;
const TILE_RENDER_PROFILE_CACHE_SALT = GAMEPLAY_CARD_VISUALS.renderProfile;
/** Bump when procedural card-surface maps change (independent of tile face caches). */
const CARD_SURFACE_MAP_VERSION = GAMEPLAY_CARD_VISUALS.surfaceMapVersion;
const textureCache = new Map<string, CanvasTexture>();
const textureImageUpdateListeners = new Set<() => void>();
const OVERLAY_TEXTURE_CACHE_VERSION = getIllustrationVersionStamp(TILE_TEXTURE_VERSION).versionToken;

let overlayTextureCacheVersionToken = OVERLAY_TEXTURE_CACHE_VERSION;

const overlayTextureCacheStats = {
    createdCount: 0,
    hitCount: 0,
    lastPurgeReason: null as string | null,
    purgeCount: 0,
    versionToken: OVERLAY_TEXTURE_CACHE_VERSION
};

let overlayPrewarmDebugState: OverlayPrewarmDebugState = {
    boardKey: null,
    completedCount: 0,
    pendingCount: 0,
    scheduled: false,
    targetCount: 0,
    targetKeys: [],
    tier: null,
    variant: null
};

let cachedRasterFaceNormalTexture: Texture | null = null;
let cachedRasterFaceNormalSource: HTMLImageElement | null = null;
let cachedRasterBackNormalTexture: Texture | null = null;
let cachedRasterBackNormalSource: HTMLImageElement | null = null;

const disposeRasterFaceNormalTexture = (): void => {
    cachedRasterFaceNormalTexture?.dispose();
    cachedRasterFaceNormalTexture = null;
    cachedRasterFaceNormalSource = null;
};

const disposeRasterBackNormalTexture = (): void => {
    cachedRasterBackNormalTexture?.dispose();
    cachedRasterBackNormalTexture = null;
    cachedRasterBackNormalSource = null;
};

const disposeCachedTexture = (key: string): void => {
    const texture = textureCache.get(key);

    if (texture) {
        texture.dispose();
        textureCache.delete(key);
    }
};

const disposeAllCachedTextures = (): void => {
    for (const key of [...textureCache.keys()]) {
        disposeCachedTexture(key);
    }
};

const isOverlayTextureCacheKey = (key: string): boolean => key.includes(':overlay:');

const resetOverlayTextureCacheStats = (): void => {
    overlayTextureCacheStats.createdCount = 0;
    overlayTextureCacheStats.hitCount = 0;
    overlayTextureCacheStats.lastPurgeReason = null;
    overlayTextureCacheStats.purgeCount = 0;
    overlayTextureCacheStats.versionToken = overlayTextureCacheVersionToken;
};

const resetOverlayPrewarmDebugState = (): void => {
    overlayPrewarmDebugState = {
        boardKey: null,
        completedCount: 0,
        pendingCount: 0,
        scheduled: false,
        targetCount: 0,
        targetKeys: [],
        tier: null,
        variant: null
    };
};

const purgeOverlayTextureCache = (reason: string, nextVersionToken: string = overlayTextureCacheVersionToken): void => {
    overlayTextureCacheVersionToken = nextVersionToken;
    overlayTextureCacheStats.lastPurgeReason = reason;
    overlayTextureCacheStats.purgeCount += 1;
    overlayTextureCacheStats.versionToken = nextVersionToken;
    for (const key of [...textureCache.keys()]) {
        if (isOverlayTextureCacheKey(key)) {
            disposeCachedTexture(key);
        }
    }
};

const syncIllustrationOverlayCacheVersion = (versionToken: string = OVERLAY_TEXTURE_CACHE_VERSION): void => {
    if (overlayTextureCacheVersionToken === versionToken) {
        return;
    }
    purgeOverlayTextureCache('version-change', versionToken);
    forceProceduralIllustrationBitmapCacheVersion(versionToken);
};

const invalidateStaticCardFaceTexture = (): void => {
    disposeCachedTexture(`static-card-face:${TILE_TEXTURE_VERSION}`);
};

/**
 * Keys from {@link buildKey} and overlay suffixes — safe to drop when edge/roughness maps arrive.
 * Exported for post-preload refresh when SDXL card-back rasters finish decoding.
 */
export const invalidateVersionedTileFaceTextureCaches = (): void => {
    const prefix = `${TILE_TEXTURE_VERSION}:`;

    for (const key of [...textureCache.keys()]) {
        if (key.startsWith(prefix)) {
            disposeCachedTexture(key);
        }
    }
};

/** One URL per card side — keep atomic with `cardSvgPlaneGeometry` (merged mesh), not per-motif splits. */
const textureImageUrls = {
    /** Hidden-side card raster (WebGL back plane, DOM .cardFaceBack). */
    cardReference: referenceBackTextureUrl,
    /** Face-up panel raster (WebGL front plane, DOM .cardFaceFront); calmer center vs back. */
    cardFace: cardFaceTextureUrl,
    /** Tangent-space normal for WebGL face-up raster plane (`front-normal.webp`). */
    cardFaceNormal: cardFaceNormalTextureUrl,
    /** Tangent-space normal for WebGL hidden-side raster plane (`back-normal.webp`). */
    cardBackNormal: cardBackNormalTextureUrl,
    edge: edgeTextureUrl,
    panelRoughness: panelRoughnessTextureUrl,
    edgeRoughness: edgeRoughnessTextureUrl
} as const;

type TextureImageId = keyof typeof textureImageUrls;

export const TILE_TEXTURE_IMAGE_IDS = [
    'cardReference',
    'cardFace',
    'cardFaceNormal',
    'cardBackNormal',
    'edge',
    'panelRoughness',
    'edgeRoughness'
] as const satisfies readonly TextureImageId[];

const invalidateCachesAfterImageLoad = (id: TextureImageId): void => {
    if (id === 'cardReference') {
        invalidateVersionedTileFaceTextureCaches();
    } else if (id === 'cardFace') {
        invalidateStaticCardFaceTexture();
    } else if (id === 'cardFaceNormal') {
        disposeRasterFaceNormalTexture();
    } else if (id === 'cardBackNormal') {
        disposeRasterBackNormalTexture();
    } else if (id === 'edge' || id === 'panelRoughness' || id === 'edgeRoughness') {
        /* Decode completes for edge/roughness PNGs — versioned tile keys already include `TILE_TEXTURE_VERSION`; avoid flushing pair illustration caches. */
    }
};

interface TextureImageState {
    attempts: number;
    image: HTMLImageElement | null;
    promise?: Promise<void>;
    status: 'loading' | 'loaded' | 'error';
}

const textureImages = new Map<TextureImageId, TextureImageState>();
const TILE_TEXTURE_IMAGE_LOAD_TIMEOUT_MS = 1500;
const TILE_TEXTURE_IMAGE_MAX_ATTEMPTS = 2;

const emitTextureImageUpdate = (): void => {
    for (const listener of textureImageUpdateListeners) {
        try {
            listener();
        } catch {
            // Cache observers must not interrupt image state transitions.
        }
    }
};

const startTextureImageLoad = (id: TextureImageId, retryFailed: boolean): Promise<void> => {
    const existing = textureImages.get(id);

    if (
        existing?.status === 'loaded' ||
        (existing?.status === 'error' && (!retryFailed || existing.attempts >= TILE_TEXTURE_IMAGE_MAX_ATTEMPTS))
    ) {
        return Promise.resolve();
    }

    if (existing?.promise) {
        return existing.promise;
    }

    const image = new Image();
    image.decoding = 'async';
    const attempts = (existing?.attempts ?? 0) + 1;

    const promise = new Promise<void>((resolve) => {
        let resolved = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const resolveOnce = (): void => {
            if (resolved) {
                return;
            }

            resolved = true;
            if (timeoutHandle) {
                globalThis.clearTimeout(timeoutHandle);
            }
            resolve();
        };

        image.onload = () => {
            if (textureImages.get(id)?.promise !== promise) {
                resolveOnce();
                return;
            }
            textureImages.set(id, { attempts, image, status: 'loaded' });
            invalidateCachesAfterImageLoad(id);
            emitTextureImageUpdate();
            resolveOnce();
        };

        image.onerror = () => {
            if (textureImages.get(id)?.promise === promise) {
                textureImages.set(id, { attempts, image: null, status: 'error' });
            }
            resolveOnce();
        };

        timeoutHandle = globalThis.setTimeout(() => {
            const current = textureImages.get(id);
            if (current?.status === 'loading' && current.promise === promise) {
                textureImages.set(id, { attempts, image: null, status: 'error' });
            }
            resolveOnce();
        }, TILE_TEXTURE_IMAGE_LOAD_TIMEOUT_MS);
    });

    textureImages.set(id, { attempts, image: null, promise, status: 'loading' });
    image.src = textureImageUrls[id];

    return promise;
};

/** Ensures all card PNGs are decoded so the tile board can build CanvasTextures without a first-frame hitch. */
export const preloadTileTextureImages = (): Promise<void> => {
    if (!canDraw()) {
        return Promise.resolve();
    }

    return Promise.all(TILE_TEXTURE_IMAGE_IDS.map((id) => startTextureImageLoad(id, true))).then(() => undefined);
};

const hashString = (value: string): number => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

const createRng = (seed: number): (() => number) => {
    let state = seed || 1;

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const canDraw = (): boolean => typeof document !== 'undefined';

const getTextureImage = (imageId: TextureImageId): HTMLImageElement | null => {
    const current = textureImages.get(imageId);

    if (current?.status === 'loaded' && current.image && current.image.complete && current.image.naturalWidth > 0) {
        return current.image;
    }

    if (!canDraw()) {
        return null;
    }

    if (!current) {
        void startTextureImageLoad(imageId, false);
    }

    return null;
};

const drawTextureImage = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageId: TextureImageId,
    opacity = 1
): boolean => {
    const image = getTextureImage(imageId);

    if (!image) {
        return false;
    }

    context.save();
    context.globalAlpha = opacity;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.restore();

    return true;
};

/** Letterbox fill under card art when source aspect ≠ canvas (matches DOM gradient tone). */
const STATIC_CARD_LETTERBOX = '#0a0e18';

/** Raster card art (SVG/PNG): stretch to full static card canvas (matches card plane; no letterbox). */
const drawCardRasterFullBleed = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageId: TextureImageId,
    opacity = 1
): boolean => {
    const image = getTextureImage(imageId);

    if (!image || !image.naturalWidth) {
        return false;
    }

    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const cw = canvas.width;
    const ch = canvas.height;

    context.save();
    context.fillStyle = STATIC_CARD_LETTERBOX;
    context.fillRect(0, 0, cw, ch);
    context.globalAlpha = opacity;
    context.drawImage(image, 0, 0, iw, ih, 0, 0, cw, ch);
    context.restore();

    return true;
};

const createTexture = (
    key: string,
    draw: (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
    colorSpace: typeof NoColorSpace | typeof SRGBColorSpace = SRGBColorSpace,
    width: number = TEXTURE_SIZE,
    height: number = TEXTURE_SIZE
): CanvasTexture | null => {
    const cached = textureCache.get(key);

    if (cached) {
        if (isOverlayTextureCacheKey(key)) {
            overlayTextureCacheStats.hitCount += 1;
        }
        return cached;
    }

    if (!canDraw()) {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
        return null;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    draw(context, canvas);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = colorSpace;
    applyCanvasTileTextureSampling(texture, tileTextureSamplingQuality);
    textureCache.set(key, texture);
    if (isOverlayTextureCacheKey(key)) {
        overlayTextureCacheStats.createdCount += 1;
    }

    return texture;
};

const getIdleWindow = (): IdleWindow | null => (typeof window === 'undefined' ? null : (window as IdleWindow));

const schedulePrewarmStep = (callback: IdleRequestCallback): PrewarmScheduleHandle => {
    const idleWindow = getIdleWindow();
    if (idleWindow?.requestIdleCallback) {
        const handle: PrewarmScheduleHandle = { cancelled: false, id: -1, type: 'idle' };
        try {
            handle.id = idleWindow.requestIdleCallback((deadline) => {
                if (!handle.cancelled) {
                    callback(deadline);
                }
            }, { timeout: 120 });
            return handle;
        } catch {
            // Fall through to the timer scheduler when the idle API is present but unusable.
        }
    }
    const handle: PrewarmScheduleHandle = { cancelled: false, id: -1, type: 'timeout' };
    handle.id = window.setTimeout(() => {
        if (!handle.cancelled) {
            callback({
                didTimeout: false,
                timeRemaining: () => 0
            } as IdleDeadline);
        }
    }, 0);
    return handle;
};

const cancelPrewarmStep = (handle: PrewarmScheduleHandle | null): void => {
    if (!handle) {
        return;
    }
    handle.cancelled = true;
    if (handle.type === 'idle') {
        getIdleWindow()?.cancelIdleCallback?.(handle.id);
        return;
    }
    window.clearTimeout(handle.id);
};

/** Sharper sampling on tilted quads; call once per WebGL context with device cap. */
export const applyAnisotropyToCachedTileTextures = (anisotropy: number): void => {
    for (const texture of textureCache.values()) {
        texture.anisotropy = anisotropy;
    }
    if (cachedRasterFaceNormalTexture) {
        cachedRasterFaceNormalTexture.anisotropy = anisotropy;
    }
    if (cachedRasterBackNormalTexture) {
        cachedRasterBackNormalTexture.anisotropy = anisotropy;
    }
};

const createRasterNormalMapTexture = (image: HTMLImageElement): Texture => {
    const texture = new Texture(image);
    texture.colorSpace = NoColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    applyCanvasTileTextureSampling(texture, tileTextureSamplingQuality);
    return texture;
};

/** Authoring normal map for the face-up card raster; null until image load or on error — use procedural fallback. */
export const getCardFaceRasterNormalMapTexture = (): Texture | null => {
    const image = getTextureImage('cardFaceNormal');
    if (!image?.naturalWidth) {
        return null;
    }
    if (cachedRasterFaceNormalTexture && cachedRasterFaceNormalSource === image) {
        return cachedRasterFaceNormalTexture;
    }
    disposeRasterFaceNormalTexture();
    cachedRasterFaceNormalTexture = createRasterNormalMapTexture(image);
    cachedRasterFaceNormalSource = image;
    return cachedRasterFaceNormalTexture;
};

/** Authoring normal map for the hidden-side card raster; null until image load or on error. */
export const getCardBackRasterNormalMapTexture = (): Texture | null => {
    const image = getTextureImage('cardBackNormal');
    if (!image?.naturalWidth) {
        return null;
    }
    if (cachedRasterBackNormalTexture && cachedRasterBackNormalSource === image) {
        return cachedRasterBackNormalTexture;
    }
    disposeRasterBackNormalTexture();
    cachedRasterBackNormalTexture = createRasterNormalMapTexture(image);
    cachedRasterBackNormalSource = image;
    return cachedRasterBackNormalTexture;
};

/**
 * Procedural tangent-space normal map (paper-like micro grain + very soft undulation).
 * Pair with `MeshStandardMaterial.normalMap` (linear / non-color sampling).
 */
const drawCardPanelNormalMap = (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void => {
    const w = canvas.width;
    const h = canvas.height;
    const imageData = context.createImageData(w, h);
    const { data } = imageData;
    const rng = createRng(0x5f1e7a3c);

    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 4;
            const fineX = (rng() - 0.5) * 14;
            const fineY = (rng() - 0.5) * 14;
            const lowX = Math.sin(x * 0.045 + y * 0.012) * 5 + Math.sin(y * 0.028) * 3;
            const lowY = Math.cos(y * 0.038 + x * 0.015) * 5 + Math.cos(x * 0.022) * 3;
            const r = Math.max(0, Math.min(255, Math.round(128 + fineX + lowX)));
            const g = Math.max(0, Math.min(255, Math.round(128 + fineY + lowY)));
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
    }

    context.putImageData(imageData, 0, 0);
};

/** Shared normal map for WebGL card faces (tile board); safe to call every frame — cached. */
export const getCardPanelNormalTexture = (): CanvasTexture | null => {
    const texture = createTexture(
        `card-panel-normal:${CARD_SURFACE_MAP_VERSION}`,
        drawCardPanelNormalMap,
        NoColorSpace,
        256,
        256
    );

    if (texture) {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(2.35, 2.35);
        texture.needsUpdate = true;
    }

    return texture;
};

/**
 * Grayscale height for `MeshStandardMaterial.displacementMap` (actual vertex offset along normals).
 * Mid-tone ≈ no displacement; brighter ridges / darker valleys when paired with negative bias.
 */
const drawCardPanelDisplacementMap = (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void => {
    const w = canvas.width;
    const h = canvas.height;
    const imageData = context.createImageData(w, h);
    const { data } = imageData;
    const rng = createRng(0x2b8e4c91);

    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 4;
            const nx = x / w;
            const ny = y / h;
            const ridgeA = Math.sin(nx * Math.PI * 5 + ny * Math.PI * 2.1) * 0.5 + 0.5;
            const ridgeB = Math.sin(nx * Math.PI * 2.2 - ny * Math.PI * 4.5) * 0.5 + 0.5;
            const ridgeC = Math.cos((nx + ny) * Math.PI * 3.8) * 0.5 + 0.5;
            const micro = rng() * 0.12;
            let v = ridgeA * 0.28 + ridgeB * 0.28 + ridgeC * 0.22 + 0.11 + micro;
            v = Math.max(0.18, Math.min(0.82, (v - 0.5) * 1.65 + 0.5));
            const b = Math.round(v * 255);
            data[i] = b;
            data[i + 1] = b;
            data[i + 2] = b;
            data[i + 3] = 255;
        }
    }

    context.putImageData(imageData, 0, 0);
};

/** Shared height map for mesh displacement (real silhouette change — needs subdivided card planes). */
export const getCardPanelDisplacementTexture = (): CanvasTexture | null => {
    const texture = createTexture(
        `card-panel-displacement:${CARD_SURFACE_MAP_VERSION}`,
        drawCardPanelDisplacementMap,
        NoColorSpace,
        256,
        256
    );

    if (texture) {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(2.35, 2.35);
        texture.needsUpdate = true;
    }

    return texture;
};

type LayerSlot = 'bezel' | 'panel';

const normalizeLayer = (layer: TileLayer): LayerSlot => {
    if (layer === 'shell') {
        return 'bezel';
    }

    if (layer === 'core') {
        return 'panel';
    }

    return layer;
};

interface CardPalette {
    accent: string;
    backBase: string;
    backPattern: string;
    edge: string;
    faceBase: string;
    faceEdge: string;
    foil: string;
    glow: string;
    ink: string;
    label: string;
    line: string;
    rim: string;
    rimSoft: string;
}

const getPalette = (variant: FaceVariant, layer: LayerSlot): CardPalette => {
    const { colors } = RENDERER_THEME;
    const bezel = layer === 'bezel';

    if (variant === 'matched') {
        return bezel
            ? {
                  accent: 'rgba(180, 235, 141, 0.24)',
                  backBase: '#121a14',
                  backPattern: 'rgba(180, 235, 141, 0.16)',
                  edge: '#0a100b',
                  faceBase: '#1b2b1a',
                  faceEdge: '#0f170e',
                  foil: colors.emeraldBright,
                  glow: colors.glowGold,
                  ink: colors.text,
                  label: 'rgba(236, 249, 224, 0.96)',
                  line: 'rgba(180, 235, 141, 0.56)',
                  rim: 'rgba(180, 235, 141, 0.84)',
                  rimSoft: 'rgba(242, 211, 157, 0.24)'
              }
            : {
                  accent: 'rgba(180, 235, 141, 0.18)',
                  backBase: '#142015',
                  backPattern: 'rgba(180, 235, 141, 0.22)',
                  edge: '#0a140b',
                  faceBase: '#1f2616',
                  faceEdge: '#0d1008',
                  foil: colors.emeraldBright,
                  glow: colors.glowGold,
                  ink: '#f3ffe5',
                  label: 'rgba(236, 249, 224, 0.94)',
                  line: 'rgba(180, 235, 141, 0.58)',
                  rim: 'rgba(180, 235, 141, 0.7)',
                  rimSoft: 'rgba(242, 211, 157, 0.22)'
              };
    }

    if (variant === 'active') {
        return bezel
            ? {
                  accent: 'rgba(242, 211, 157, 0.16)',
                  backBase: '#1d1714',
                  backPattern: 'rgba(242, 211, 157, 0.16)',
                  edge: '#120d0b',
                  faceBase: '#1a2130',
                  faceEdge: '#0f141d',
                  foil: colors.goldBright,
                  glow: colors.glowGoldSoft,
                  ink: '#f8f4eb',
                  label: 'rgba(244, 236, 220, 0.92)',
                  line: 'rgba(242, 211, 157, 0.48)',
                  rim: 'rgba(242, 211, 157, 0.74)',
                  rimSoft: 'rgba(184, 217, 228, 0.2)'
              }
            : {
                  accent: 'rgba(242, 211, 157, 0.12)',
                  backBase: '#211914',
                  backPattern: 'rgba(242, 211, 157, 0.26)',
                  edge: '#110d0c',
                  faceBase: '#1b2731',
                  faceEdge: '#0d151c',
                  foil: colors.goldBright,
                  glow: colors.glowGoldSoft,
                  ink: '#fffaf2',
                  label: 'rgba(244, 236, 220, 0.92)',
                  line: 'rgba(242, 211, 157, 0.52)',
                  rim: 'rgba(242, 211, 157, 0.68)',
                  rimSoft: 'rgba(184, 217, 228, 0.24)'
              };
    }

    if (variant === 'mismatch') {
        return bezel
            ? {
                  accent: 'rgba(216, 106, 88, 0.28)',
                  backBase: '#231418',
                  backPattern: 'rgba(216, 106, 88, 0.2)',
                  edge: '#181014',
                  faceBase: '#2a1518',
                  faceEdge: '#140c0e',
                  foil: colors.emberSoft,
                  glow: colors.glowEmber,
                  ink: '#ffe8e4',
                  label: 'rgba(255, 232, 226, 0.92)',
                  line: 'rgba(216, 106, 88, 0.52)',
                  rim: 'rgba(216, 106, 88, 0.72)',
                  rimSoft: 'rgba(255, 214, 133, 0.18)'
              }
            : {
                  accent: 'rgba(216, 106, 88, 0.22)',
                  backBase: '#2a1818',
                  backPattern: 'rgba(216, 106, 88, 0.24)',
                  edge: '#160f10',
                  faceBase: '#321a1c',
                  faceEdge: '#1c1012',
                  foil: colors.emberSoft,
                  glow: colors.glowEmber,
                  ink: '#fff0ec',
                  label: 'rgba(255, 236, 230, 0.92)',
                  line: 'rgba(216, 106, 88, 0.5)',
                  rim: 'rgba(216, 106, 88, 0.58)',
                  rimSoft: 'rgba(87, 220, 255, 0.14)'
              };
    }

    return bezel
        ? {
              accent: 'rgba(242, 211, 157, 0.18)',
              backBase: '#2f2017',
              backPattern: 'rgba(242, 211, 157, 0.24)',
              edge: '#160f0d',
              faceBase: '#3d2a1d',
              faceEdge: '#26170f',
              foil: colors.goldBright,
              glow: colors.glowGoldSoft,
              ink: 'rgba(244, 241, 233, 0.92)',
              label: 'rgba(244, 236, 220, 0.9)',
              line: 'rgba(242, 211, 157, 0.52)',
              rim: 'rgba(242, 211, 157, 0.76)',
              rimSoft: 'rgba(195, 149, 79, 0.32)'
          }
        : {
              accent: 'rgba(242, 211, 157, 0.14)',
              backBase: '#332216',
              backPattern: 'rgba(242, 211, 157, 0.32)',
              edge: '#1a100b',
              faceBase: '#3f2a1b',
              faceEdge: '#24160e',
              foil: colors.goldBright,
              glow: colors.glowGoldSoft,
              ink: 'rgba(248, 244, 234, 0.94)',
              label: 'rgba(241, 236, 222, 0.92)',
              line: 'rgba(242, 211, 157, 0.54)',
              rim: 'rgba(242, 211, 157, 0.74)',
              rimSoft: 'rgba(99, 165, 187, 0.22)'
          };
};

const faceTilt: Record<TileFace, number> = {
    front: -0.08,
    back: 0.16,
    left: -0.24,
    right: 0.24,
    top: -0.12,
    bottom: 0.16
};

const drawRoundedRectFrame = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    stroke: string,
    lineWidth: number
): void => {
    context.save();
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.stroke();
    context.restore();
};

const drawNoise = (context: CanvasRenderingContext2D, width: number, height: number, count: number, color: string, rng: () => number): void => {
    context.save();
    context.fillStyle = color;

    for (let index = 0; index < count; index += 1) {
        const x = rng() * width;
        const y = rng() * height;
        const size = 0.3 + rng() * 1.15;
        context.fillRect(x, y, size, size);
    }

    context.restore();
};

/** Rounded panel: shared `cardReference` (`authored-card-back.svg`), plus hatch / emblem on the physical back. */
const drawCardReferenceRoundPanel = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    palette: CardPalette
): { inset: number; cardWidth: number; cardHeight: number; radius: number } => {
    const { width, height } = canvas;
    const inset = width * 0.03;
    const cardWidth = width - inset * 2;
    const cardHeight = height - inset * 2;
    const radius = width * 0.075;

    const panelGradient = context.createLinearGradient(inset, inset, inset + cardWidth, inset + cardHeight);
    panelGradient.addColorStop(0, palette.backBase);
    panelGradient.addColorStop(1, palette.edge);

    context.save();
    context.beginPath();
    context.roundRect(inset, inset, cardWidth, cardHeight, radius);
    context.fillStyle = panelGradient;
    context.fill();
    context.clip();

    const hasCardTexture = drawTextureImage(context, canvas, 'cardReference', 1);
    if (hasCardTexture) {
        const tintOverlay = context.createLinearGradient(inset, inset, inset + cardWidth, inset + cardHeight);
        tintOverlay.addColorStop(0, GAMEPLAY_CARD_VISUALS.texturedBackTint.start);
        tintOverlay.addColorStop(1, GAMEPLAY_CARD_VISUALS.texturedBackTint.end);
        context.fillStyle = tintOverlay;
        context.fillRect(inset, inset, cardWidth, cardHeight);
    }

    context.globalAlpha = hasCardTexture ? GAMEPLAY_CARD_VISUALS.texturedBackPatternOpacity : 0.66;
    context.strokeStyle = palette.backPattern;
    context.lineWidth = Math.max(1, Math.round(width * 0.0026));

    const step = Math.max(18, Math.round(width * 0.068));
    for (let x = -cardHeight; x < cardWidth + cardHeight; x += step) {
        context.beginPath();
        context.moveTo(inset + x, inset);
        context.lineTo(inset + x + cardHeight, inset + cardHeight);
        context.stroke();
    }

    for (let x = 0; x < cardWidth + cardHeight; x += step) {
        context.beginPath();
        context.moveTo(inset + x, inset + cardHeight);
        context.lineTo(inset + x - cardHeight, inset);
        context.stroke();
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const ring = Math.max(width * 0.16, 54);
    const emblem = context.createRadialGradient(centerX, centerY, ring * 0.15, centerX, centerY, ring);
    emblem.addColorStop(0, palette.foil);
    emblem.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.globalAlpha = hasCardTexture ? GAMEPLAY_CARD_VISUALS.texturedBackEmblemOpacity : 0.35;
    context.fillStyle = emblem;
    context.beginPath();
    context.arc(centerX, centerY, ring, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = hasCardTexture
        ? GAMEPLAY_CARD_VISUALS.innerRingOpacity.textured
        : GAMEPLAY_CARD_VISUALS.innerRingOpacity.fallback;
    context.strokeStyle = palette.rimSoft;
    context.lineWidth = Math.max(2, Math.round(width * 0.006));
    context.beginPath();
    context.arc(centerX, centerY, ring * 0.58, 0, Math.PI * 2);
    context.stroke();

    context.beginPath();
    context.arc(centerX, centerY, ring * 0.34, 0, Math.PI * 2);
    context.lineWidth = Math.max(1.5, Math.round(width * 0.0032));
    context.strokeStyle = palette.line;
    context.stroke();

    context.save();
    context.globalAlpha = hasCardTexture ? 0.32 : 0.46;
    context.strokeStyle = palette.foil;
    context.lineWidth = Math.max(1, Math.round(width * 0.0022));
    for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12;
        const inner = ring * 0.72;
        const outer = ring * 0.86;
        context.beginPath();
        context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
        context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
        context.stroke();
    }
    for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6 + Math.PI / 6;
        const x = centerX + Math.cos(angle) * ring * 0.78;
        const y = centerY + Math.sin(angle) * ring * 0.78;
        context.beginPath();
        context.arc(x, y, ring * 0.045, 0, Math.PI * 2);
        context.stroke();
    }
    context.restore();

    const diamondSize = ring * 0.42;
    const innerDiamondSize = diamondSize * 0.28;
    const diamondGradient = context.createLinearGradient(centerX, centerY - diamondSize, centerX, centerY + diamondSize);
    diamondGradient.addColorStop(0, palette.foil);
    diamondGradient.addColorStop(1, palette.rimSoft);

    context.globalAlpha = hasCardTexture
        ? GAMEPLAY_CARD_VISUALS.centerDiamondOpacity.textured
        : GAMEPLAY_CARD_VISUALS.centerDiamondOpacity.fallback;
    context.strokeStyle = diamondGradient;
    context.lineWidth = Math.max(2, Math.round(width * 0.0048));
    context.beginPath();
    context.moveTo(centerX, centerY - diamondSize);
    context.lineTo(centerX + diamondSize, centerY);
    context.lineTo(centerX, centerY + diamondSize);
    context.lineTo(centerX - diamondSize, centerY);
    context.closePath();
    context.stroke();

    context.fillStyle = diamondGradient;
    context.beginPath();
    context.moveTo(centerX, centerY - innerDiamondSize);
    context.lineTo(centerX + innerDiamondSize, centerY);
    context.lineTo(centerX, centerY + innerDiamondSize);
    context.lineTo(centerX - innerDiamondSize, centerY);
    context.closePath();
    context.fill();

    context.lineWidth = Math.max(1.2, Math.round(width * 0.0028));
    context.strokeStyle = palette.rimSoft;
    context.beginPath();
    context.moveTo(centerX, centerY - diamondSize - ring * 0.12);
    context.lineTo(centerX, centerY - diamondSize * 0.72);
    context.moveTo(centerX, centerY + diamondSize * 0.72);
    context.lineTo(centerX, centerY + diamondSize + ring * 0.12);
    context.moveTo(centerX - diamondSize - ring * 0.12, centerY);
    context.lineTo(centerX - diamondSize * 0.72, centerY);
    context.moveTo(centerX + diamondSize * 0.72, centerY);
    context.lineTo(centerX + diamondSize + ring * 0.12, centerY);
    context.stroke();

    context.restore();

    return { inset, cardWidth, cardHeight, radius };
};

const drawCardOuterFramesAndNoise = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    palette: CardPalette,
    rng: () => number,
    metrics: { inset: number; cardWidth: number; cardHeight: number; radius: number }
): void => {
    const { width, height } = canvas;
    const { inset, cardWidth, cardHeight, radius } = metrics;

    drawRoundedRectFrame(
        context,
        inset,
        inset,
        cardWidth,
        cardHeight,
        radius,
        palette.rim,
        Math.max(2, Math.round(width * 0.005))
    );

    drawRoundedRectFrame(
        context,
        inset + width * 0.018,
        inset + width * 0.018,
        cardWidth - width * 0.036,
        cardHeight - width * 0.036,
        radius * 0.72,
        palette.rimSoft,
        Math.max(1, Math.round(width * 0.003))
    );

    drawNoise(context, width, height, 90, 'rgba(255, 255, 255, 0.06)', rng);
};

/** Same card face for back and flipped front: hidden palette for panel, hatch, and rims (no active/matched cyan rim). */
const drawCardBackPattern = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    rng: () => number
): void => {
    const hiddenPanel = getPalette('hidden', 'panel');
    const metrics = drawCardReferenceRoundPanel(context, canvas, hiddenPanel);
    drawCardOuterFramesAndNoise(context, canvas, hiddenPanel, rng, metrics);
};

const drawCardFrontOverlay = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    tile: Tile,
    variant: Exclude<FaceVariant, 'hidden'>,
    tier: OverlayDrawTier
): void => {
    if (tileUsesProgrammaticFaceMotif(tile)) {
        drawProgrammaticCardFaceOverlay(context, canvas, tile, variant, tier);
        return;
    }

    const { width, height } = canvas;
    const c = getCardFaceOverlayColors(variant);
    const rng = createRng(hashString(`${tile.id}|${tile.pairKey}|${variant}|sym`));
    const outerGrain = tier === 'full' ? 52 : tier === 'standard' ? 28 : 0;

    context.clearRect(0, 0, width, height);
    if (outerGrain > 0) {
        drawNoise(context, width, height, outerGrain, `rgba(${c.grainRgb},${c.grainAlpha * 0.65})`, rng);
    }

    const rasterPanelUrl = resolveCardIllustrationUrl(tile, CARD_ILLUSTRATION_REGISTRY);
    const rasterPanelImg = rasterPanelUrl ? getCardIllustrationImageByUrl(rasterPanelUrl) : null;
    if (rasterPanelImg?.naturalWidth) {
        drawIllustrationInCanvasOverlay(context, canvas, rasterPanelImg, 1, {
            matFeatherStrength: 0.92
        });
        return;
    }

    if (isCardRasterDeckEnabled()) {
        drawRasterDeckComposedOverlay(context, canvas, tile.pairKey, tier, c, {
            matFeatherStrength: 0.92
        });
        return;
    }

    drawProceduralIllustrationInCanvasOverlay(context, canvas, tile.pairKey, tier, c, {
        matFeatherStrength: 0.92
    });
};

const drawEdgeFace = (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, palette: CardPalette, face: TileFace): void => {
    const { width, height } = canvas;
    const vertical = face === 'left' || face === 'right';
    const hasEdgeTexture = drawTextureImage(context, canvas, 'edge', 0.94);

    if (!hasEdgeTexture) {
        const gradient = vertical ? context.createLinearGradient(0, 0, width, 0) : context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, palette.edge);
        gradient.addColorStop(0.55, palette.faceEdge);
        gradient.addColorStop(1, palette.edge);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
    }

    context.fillStyle = palette.line;
    context.globalAlpha = hasEdgeTexture ? 0.2 : 0.35;
    if (vertical) {
        context.fillRect(width * 0.44, 0, width * 0.12, height);
    } else {
        context.fillRect(0, height * 0.44, width, height * 0.12);
    }
    context.globalAlpha = 1;
};

const drawCardBase = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    face: TileFace,
    palette: CardPalette,
    rng: () => number,
    layer: LayerSlot
): void => {
    const { width, height } = canvas;

    if (face !== 'front' && face !== 'back') {
        drawEdgeFace(context, canvas, palette, face);
        return;
    }

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, layer === 'bezel' ? palette.edge : palette.faceBase);
    gradient.addColorStop(0.5, layer === 'bezel' ? palette.faceEdge : palette.faceEdge);
    gradient.addColorStop(1, layer === 'bezel' ? palette.edge : palette.backBase);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(faceTilt[face]);
    context.translate(-width / 2, -height / 2);
    context.globalAlpha = layer === 'bezel' ? 0.36 : 0.26;

    const streaks = layer === 'bezel' ? 10 : 7;
    for (let index = 0; index < streaks; index += 1) {
        const y = height * (0.08 + rng() * 0.84);
        const band = context.createLinearGradient(0, y, width, y + height * 0.018);
        band.addColorStop(0, 'rgba(255, 255, 255, 0)');
        band.addColorStop(0.52, palette.line);
        band.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = band;
        context.fillRect(-width * 0.2, y, width * 1.4, height * 0.018);
    }
    context.restore();

    drawNoise(context, width, height, layer === 'bezel' ? 90 : 56, 'rgba(255, 255, 255, 0.05)', rng);
};

const buildKey = (tile: Tile, face: TileFace, variant: FaceVariant, layer: TileLayer): string => {
    if (face === 'back' && variant === 'hidden') {
        return `${TILE_RENDER_PROFILE_CACHE_SALT}:${TILE_TEXTURE_VERSION}:${layer}:${variant}:${face}:shared-hidden-back`;
    }

    return `${TILE_RENDER_PROFILE_CACHE_SALT}:${TILE_TEXTURE_VERSION}:${layer}:${variant}:${face}:${tile.id}:${tile.pairKey}:${tile.symbol}:${tile.label}`;
};

export const getTileFaceOverlayTextureCacheKey = (
    tile: Tile,
    variant: Exclude<FaceVariant, 'hidden'>,
    graphicsQuality: GraphicsQualityPreset
): string => `${buildKey(tile, 'front', variant, 'panel')}:overlay:${graphicsQuality}:illustrationSchema=${ILLUSTRATION_GEN_SCHEMA_VERSION}`;

export const getTileFaceOverlayRegressionStamp = (
    tile: Tile,
    variant: Exclude<FaceVariant, 'hidden'>,
    graphicsQuality: GraphicsQualityPreset
): TileFaceOverlayRegressionStamp => {
    const tier = overlayDrawTierFromGraphicsQuality(graphicsQuality);
    const illustration = getProceduralIllustrationRegressionStamp(tile.pairKey, tier, TILE_TEXTURE_VERSION);
    return {
        graphicsQuality,
        illustration,
        overlayCacheKey: getTileFaceOverlayTextureCacheKey(tile, variant, graphicsQuality),
        pairKey: tile.pairKey,
        tier,
        tileId: tile.id,
        variant
    };
};

export const formatTileFaceOverlayRegressionLogLine = (
    tile: Tile,
    variant: Exclude<FaceVariant, 'hidden'>,
    graphicsQuality: GraphicsQualityPreset
): string => JSON.stringify(getTileFaceOverlayRegressionStamp(tile, variant, graphicsQuality));

/** Panel art is only authored for the back face; geometry uses the same pixels on both sides. */
const drawFace = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    tile: Tile,
    face: TileFace,
    variant: FaceVariant,
    layer: TileLayer
): void => {
    const normalizedLayer = normalizeLayer(layer);
    const palette = getPalette(variant, normalizedLayer);
    const seed = hashString(buildKey(tile, face, variant, layer));
    const rng = createRng(seed);

    const basePalette =
        normalizedLayer === 'panel' && face === 'back'
            ? getPalette('hidden', normalizedLayer)
            : palette;

    drawCardBase(context, canvas, face, basePalette, rng, normalizedLayer);

    if (normalizedLayer === 'bezel') {
        return;
    }

    if (face === 'back') {
        drawCardBackPattern(context, canvas, rng);
    }
};

const shade = (value: number): string => {
    const next = Math.max(0, Math.min(255, Math.round(value)));
    return `rgb(${next}, ${next}, ${next})`;
};

const drawRoughnessFace = (
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    tile: Tile,
    face: TileFace,
    variant: FaceVariant,
    layer: TileLayer
): void => {
    const normalizedLayer = normalizeLayer(layer);
    const seed = hashString(`${buildKey(tile, face, variant, layer)}:roughness`);
    const rng = createRng(seed);
    const { width, height } = canvas;
    const bezel = normalizedLayer === 'bezel';
    const front = face === 'front';
    const back = face === 'back';
    const edgeFace = !front && !back;
    const base = bezel
        ? variant === 'matched'
            ? 164
            : variant === 'mismatch'
                ? 168
                : variant === 'active'
                    ? 176
                    : 184
        : variant === 'matched'
            ? 158
            : variant === 'mismatch'
                ? 162
                : variant === 'active'
                    ? 172
                    : 182;
    const faceShift = front ? 8 : back ? 2 : -10;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, shade(base + 20 + faceShift));
    gradient.addColorStop(0.5, shade(base + faceShift));
    gradient.addColorStop(1, shade(base - 28 + faceShift));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    drawTextureImage(context, canvas, edgeFace ? 'edgeRoughness' : 'panelRoughness', edgeFace ? 0.72 : 0.82);

    context.save();
    context.globalAlpha = edgeFace ? 0.28 : bezel ? 0.44 : 0.38;
    context.fillStyle = shade(base + 24);
    const grainCount = edgeFace ? 64 : bezel ? 130 : 110;

    for (let index = 0; index < grainCount; index += 1) {
        const x = rng() * width;
        const y = rng() * height;
        const size = 0.3 + rng() * 1.05;
        context.fillRect(x, y, size, size);
    }

    context.restore();

    context.save();
    context.globalAlpha = edgeFace ? 0.26 : 0.36;
    const lineCount = edgeFace ? 5 : 9;
    for (let index = 0; index < lineCount; index += 1) {
        const y = height * (0.1 + rng() * 0.8);
        const lineHeight = Math.max(2, height * (0.0025 + rng() * 0.0025));
        const line = context.createLinearGradient(0, y, width, y + lineHeight);
        line.addColorStop(0, shade(base - 18));
        line.addColorStop(0.5, shade(base + 18 + rng() * 10));
        line.addColorStop(1, shade(base - 18));
        context.fillStyle = line;
        context.fillRect(-width * 0.2, y, width * 1.4, lineHeight);
    }
    context.restore();

    if (front || back) {
        context.save();
        context.globalAlpha = 0.2;
        context.fillStyle = shade(base - 24);
        context.fillRect(width * 0.08, height * 0.08, width * 0.84, Math.max(2, Math.round(height * 0.01)));
        context.fillRect(width * 0.12, height * 0.9, width * 0.64, Math.max(2, Math.round(height * 0.008)));
        context.restore();
    }
};

export const getTileFaceTexture = (
    tile: Tile,
    face: TileFace,
    variant: FaceVariant,
    layer: TileLayer = 'panel'
): CanvasTexture | null => {
    const normalized = normalizeLayer(layer);
    const renderFace: TileFace = normalized === 'panel' && face === 'front' ? 'back' : face;

    return createTexture(buildKey(tile, renderFace, variant, layer), (context, canvas) =>
        drawFace(context, canvas, tile, renderFace, variant, layer)
    );
};

export const getTileFaceRoughnessTexture = (
    tile: Tile,
    face: TileFace,
    variant: FaceVariant,
    layer: TileLayer = 'panel'
): CanvasTexture | null =>
    createTexture(
        `${buildKey(tile, face, variant, layer)}:roughness`,
        (context, canvas) => drawRoughnessFace(context, canvas, tile, face, variant, layer),
        NoColorSpace
    );

export const getTileFaceOverlayTexture = (
    tile: Tile,
    variant: Exclude<FaceVariant, 'hidden'>,
    graphicsQuality: GraphicsQualityPreset
): CanvasTexture | null => {
    syncIllustrationOverlayCacheVersion();
    const tier = overlayDrawTierFromGraphicsQuality(graphicsQuality);
    return createTexture(
        getTileFaceOverlayTextureCacheKey(tile, variant, graphicsQuality),
        (context, canvas) => drawCardFrontOverlay(context, canvas, tile, variant, tier),
        SRGBColorSpace,
        STATIC_CARD_TEXTURE_WIDTH,
        STATIC_CARD_TEXTURE_HEIGHT
    );
};

type IllustrationPrewarmTarget = {
    key: string;
    pairKey: string;
    palette: ReturnType<typeof getCardFaceOverlayColors>;
    sourcePixelHeight: number;
    sourcePixelWidth: number;
    tier: OverlayDrawTier;
};

const buildIllustrationPrewarmTargetKey = (pairKey: string, tier: OverlayDrawTier): string => `${pairKey}|tier=${tier}`;

const getIllustrationPrewarmTargets = (
    tiles: readonly Tile[],
    graphicsQuality: GraphicsQualityPreset,
    variant: Exclude<FaceVariant, 'hidden'>
): IllustrationPrewarmTarget[] => {
    if (variant !== 'active') {
        return [];
    }

    const tier = overlayDrawTierFromGraphicsQuality(graphicsQuality);
    const palette = getCardFaceOverlayColors(variant);
    const illustrationRect = computeIllustrationPixelRect(STATIC_CARD_TEXTURE_WIDTH, STATIC_CARD_TEXTURE_HEIGHT);
    const targets: IllustrationPrewarmTarget[] = [];
    const seen = new Set<string>();

    for (const tile of tiles) {
        const key = buildIllustrationPrewarmTargetKey(tile.pairKey, tier);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        targets.push({
            key,
            pairKey: tile.pairKey,
            palette,
            sourcePixelHeight: illustrationRect.height,
            sourcePixelWidth: illustrationRect.width,
            tier
        });
    }

    return targets;
};

export const prewarmTileFaceOverlayTextures = (
    tiles: readonly Tile[],
    graphicsQuality: GraphicsQualityPreset,
    variant: Exclude<FaceVariant, 'hidden'> = 'active'
): (() => void) => {
    if (!canDraw() || tiles.length === 0) {
        resetOverlayPrewarmDebugState();
        return () => undefined;
    }

    syncIllustrationOverlayCacheVersion();
    const targets = getIllustrationPrewarmTargets(tiles, graphicsQuality, variant);
    if (targets.length === 0) {
        resetOverlayPrewarmDebugState();
        return () => undefined;
    }

    let cancelled = false;
    let handle: PrewarmScheduleHandle | null = null;
    let index = 0;
    const boardKey = `${variant}|${overlayDrawTierFromGraphicsQuality(graphicsQuality)}|${targets.map((target) => target.key).join(',')}`;

    overlayPrewarmDebugState = {
        boardKey,
        completedCount: 0,
        pendingCount: targets.length,
        scheduled: true,
        targetCount: targets.length,
        targetKeys: targets.map((target) => target.key),
        tier: targets[0]?.tier ?? null,
        variant
    };

    const pump = (deadline?: IdleDeadline): void => {
        if (cancelled) {
            return;
        }

        let processed = 0;
        do {
            const target = targets[index]!;
            prewarmProceduralIllustrationBitmap(
                target.pairKey,
                target.tier,
                target.palette,
                target.sourcePixelWidth,
                target.sourcePixelHeight
            );
            index += 1;
            processed += 1;
            overlayPrewarmDebugState.completedCount = index;
            overlayPrewarmDebugState.pendingCount = targets.length - index;
        } while (
            index < targets.length &&
            processed < OVERLAY_PREWARM_BATCH_SIZE &&
            deadline != null &&
            (deadline.didTimeout || deadline.timeRemaining() > 2)
        );

        overlayPrewarmDebugState.scheduled = false;
        if (index < targets.length) {
            overlayPrewarmDebugState.scheduled = true;
            handle = schedulePrewarmStep(pump);
        }
    };

    handle = schedulePrewarmStep(pump);
    return () => {
        cancelled = true;
        cancelPrewarmStep(handle);
        if (overlayPrewarmDebugState.boardKey === boardKey) {
            overlayPrewarmDebugState = {
                ...overlayPrewarmDebugState,
                pendingCount: Math.max(0, targets.length - index),
                scheduled: false
            };
        }
    };
};

const demandOverlayPairKeyQueue = new Set<string>();
let demandOverlayPrewarmHandle: PrewarmScheduleHandle | null = null;
let demandOverlayPrewarmGraphicsQuality: GraphicsQualityPreset = 'medium';

const pumpDemandOverlayPrewarm = (deadline?: IdleDeadline): void => {
    if (!canDraw()) {
        cancelPrewarmStep(demandOverlayPrewarmHandle);
        demandOverlayPrewarmHandle = null;
        return;
    }

    if (demandOverlayPairKeyQueue.size === 0) {
        cancelPrewarmStep(demandOverlayPrewarmHandle);
        demandOverlayPrewarmHandle = null;
        return;
    }

    syncIllustrationOverlayCacheVersion();
    const tier = overlayDrawTierFromGraphicsQuality(demandOverlayPrewarmGraphicsQuality);
    const palette = getCardFaceOverlayColors('active');
    const illustrationRect = computeIllustrationPixelRect(STATIC_CARD_TEXTURE_WIDTH, STATIC_CARD_TEXTURE_HEIGHT);
    let processed = 0;

    for (const pairKey of [...demandOverlayPairKeyQueue]) {
        if (processed >= OVERLAY_PREWARM_BATCH_SIZE) {
            break;
        }
        if (deadline != null && !deadline.didTimeout && deadline.timeRemaining() <= 2) {
            break;
        }
        demandOverlayPairKeyQueue.delete(pairKey);
        prewarmProceduralIllustrationBitmap(
            pairKey,
            tier,
            palette,
            illustrationRect.width,
            illustrationRect.height
        );
        processed += 1;
    }

    demandOverlayPrewarmHandle = null;

    if (demandOverlayPairKeyQueue.size > 0) {
        demandOverlayPrewarmHandle = schedulePrewarmStep(pumpDemandOverlayPrewarm);
    }
};

/**
 * Demand-driven overlay bitmap warm-up: enqueue only `pairKey`s the board currently cares about
 * (face-up, pickable, resolving). Cleanup removes this session’s keys from the shared queue.
 */
export const runDemandDrivenTileFaceOverlayPrewarmSession = (
    pairKeys: readonly string[],
    graphicsQuality: GraphicsQualityPreset
): (() => void) => {
    if (!canDraw() || pairKeys.length === 0) {
        return () => undefined;
    }

    syncIllustrationOverlayCacheVersion();
    demandOverlayPrewarmGraphicsQuality = graphicsQuality;
    const sessionKeys = new Set(pairKeys);

    for (const k of pairKeys) {
        demandOverlayPairKeyQueue.add(k);
    }

    if (demandOverlayPrewarmHandle == null) {
        demandOverlayPrewarmHandle = schedulePrewarmStep(pumpDemandOverlayPrewarm);
    }

    return () => {
        for (const k of sessionKeys) {
            demandOverlayPairKeyQueue.delete(k);
        }

        if (demandOverlayPairKeyQueue.size === 0 && demandOverlayPrewarmHandle != null) {
            cancelPrewarmStep(demandOverlayPrewarmHandle);
            demandOverlayPrewarmHandle = null;
        }
    };
};

/** Test helper: clear demand queue and cancel idle pump. */
export const resetDemandDrivenOverlayPrewarmForTest = (): void => {
    cancelPrewarmStep(demandOverlayPrewarmHandle);
    demandOverlayPrewarmHandle = null;
    demandOverlayPairKeyQueue.clear();
};

export const getCardFaceStaticTexture = (): CanvasTexture | null =>
    createTexture(
        `static-card-face:${TILE_RENDER_PROFILE_CACHE_SALT}:${TILE_TEXTURE_VERSION}`,
        (context, canvas) => {
            const rendered = drawCardRasterFullBleed(context, canvas, 'cardFace', 1);

            if (!rendered) {
                const fallback = context.createLinearGradient(0, 0, canvas.width, canvas.height);
                fallback.addColorStop(0, '#243448');
                fallback.addColorStop(1, '#121a28');
                context.fillStyle = fallback;
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
        },
        SRGBColorSpace,
        STATIC_CARD_TEXTURE_WIDTH,
        STATIC_CARD_TEXTURE_HEIGHT
    );

export const subscribeTextureImageUpdates = (listener: () => void): (() => void) => {
    textureImageUpdateListeners.add(listener);

    return () => {
        textureImageUpdateListeners.delete(listener);
    };
};

export const getOverlayTextureCacheDebugState = (): OverlayTextureCacheDebugState => {
    const keys = [...textureCache.keys()].sort();
    const overlayKeys = keys.filter((key) => isOverlayTextureCacheKey(key));
    return {
        createdCount: overlayTextureCacheStats.createdCount,
        hitCount: overlayTextureCacheStats.hitCount,
        keys,
        lastPurgeReason: overlayTextureCacheStats.lastPurgeReason,
        overlayKeyCount: overlayKeys.length,
        overlayKeys,
        purgeCount: overlayTextureCacheStats.purgeCount,
        versionToken: overlayTextureCacheStats.versionToken
    };
};

export const getOverlayPrewarmDebugState = (): OverlayPrewarmDebugState => ({
    ...overlayPrewarmDebugState,
    targetKeys: [...overlayPrewarmDebugState.targetKeys]
});

export const clearTileTextureCachesForDebug = (): void => {
    disposeAllCachedTextures();
    textureImages.clear();
    overlayTextureCacheVersionToken = OVERLAY_TEXTURE_CACHE_VERSION;
    forceProceduralIllustrationBitmapCacheVersion(OVERLAY_TEXTURE_CACHE_VERSION);
    clearProceduralIllustrationBitmapCache();
    resetOverlayTextureCacheStats();
    resetOverlayPrewarmDebugState();
};

export const getCachedTileTextureKeysForDebug = (): string[] => [...textureCache.keys()].sort();

export const forceIllustrationOverlayCacheVersionForTest = (versionToken: string): void => {
    syncIllustrationOverlayCacheVersion(versionToken);
};

export const getIllustrationPipelineDebugState = (): {
    illustrationBitmap: ReturnType<typeof getProceduralIllustrationBitmapCacheDebugState>;
    overlayPrewarm: OverlayPrewarmDebugState;
    overlayTexture: OverlayTextureCacheDebugState;
} => ({
    illustrationBitmap: getProceduralIllustrationBitmapCacheDebugState(),
    overlayPrewarm: getOverlayPrewarmDebugState(),
    overlayTexture: getOverlayTextureCacheDebugState()
});
