import type { CardFaceOverlayColors } from './cardFaceOverlayPalette';
import { drawProceduralTarotIllustration } from './proceduralIllustration/drawProceduralTarotIllustration';
import {
    buildProceduralIllustrationCacheKey,
    getIllustrationVersionStamp
} from './proceduralIllustration/illustrationCacheKey';
import type { OverlayDrawTier } from './overlayDrawTier';
import { computeIllustrationPixelRect } from './cardIllustrationRect';
import { GAMEPLAY_CARD_VISUALS } from '../components/gameplayVisualConfig';

/** Corner radius as a fraction of the shorter illustration panel edge (tarot mat look). */
export const ILLUSTRATION_PANEL_CORNER_FRAC = 0.038;

export const computeIllustrationCornerRadius = (panelWidth: number, panelHeight: number): number =>
    Math.max(3.5, Math.min(panelWidth, panelHeight) * ILLUSTRATION_PANEL_CORNER_FRAC);

const proceduralIllustrationBitmapCache = new Map<string, HTMLCanvasElement>();

const prepareHighQualityBitmapSampling = (ctx: CanvasRenderingContext2D): void => {
    ctx.imageSmoothingEnabled = true;
    const dpr = ctx as CanvasRenderingContext2D & { imageSmoothingQuality?: 'low' | 'medium' | 'high' };
    if ('imageSmoothingQuality' in dpr) {
        dpr.imageSmoothingQuality = 'high';
    }
};

const canCacheProceduralIllustrations = (): boolean => typeof document !== 'undefined';
const MAX_PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_ENTRIES = 256;
// Entry counts alone allowed hundreds of MB of full-resolution panels to survive floor changes.
const MAX_PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_PIXELS = 16 * 1024 * 1024;
let proceduralIllustrationBitmapCachePixels = 0;

const getProceduralIllustrationPaletteSignature = (palette: CardFaceOverlayColors): string =>
    [palette.sigilFillLight, palette.sigilFillDark, palette.sigilStroke, palette.sigilHighlight].join('|');

export type ProceduralIllustrationBitmapCacheDebugState = {
    createdCount: number;
    entryCount: number;
    evictedCount: number;
    hitCount: number;
    keys: string[];
    lastPurgeReason: string | null;
    maxEntries: number;
    pixelCount: number;
    maxPixels: number;
    missCount: number;
    purgeCount: number;
    versionToken: string;
};

const PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_VERSION = getIllustrationVersionStamp(
    GAMEPLAY_CARD_VISUALS.textureVersion
).versionToken;

let proceduralIllustrationBitmapCacheVersionToken = PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_VERSION;

const proceduralIllustrationBitmapCacheStats = {
    createdCount: 0,
    evictedCount: 0,
    hitCount: 0,
    lastPurgeReason: null as string | null,
    maxEntries: MAX_PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_ENTRIES,
    missCount: 0,
    purgeCount: 0,
    versionToken: PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_VERSION
};

const resetProceduralIllustrationBitmapCacheStats = (): void => {
    proceduralIllustrationBitmapCacheStats.createdCount = 0;
    proceduralIllustrationBitmapCacheStats.evictedCount = 0;
    proceduralIllustrationBitmapCacheStats.hitCount = 0;
    proceduralIllustrationBitmapCacheStats.lastPurgeReason = null;
    proceduralIllustrationBitmapCacheStats.maxEntries = MAX_PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_ENTRIES;
    proceduralIllustrationBitmapCacheStats.missCount = 0;
    proceduralIllustrationBitmapCacheStats.purgeCount = 0;
    proceduralIllustrationBitmapCacheStats.versionToken = proceduralIllustrationBitmapCacheVersionToken;
};

const purgeProceduralIllustrationBitmapCache = (
    reason: string,
    nextVersionToken: string = proceduralIllustrationBitmapCacheVersionToken
): void => {
    proceduralIllustrationBitmapCacheVersionToken = nextVersionToken;
    for (const canvas of proceduralIllustrationBitmapCache.values()) {
        canvas.width = 1;
        canvas.height = 1;
    }
    proceduralIllustrationBitmapCache.clear();
    proceduralIllustrationBitmapCachePixels = 0;
    proceduralIllustrationBitmapCacheStats.lastPurgeReason = reason;
    proceduralIllustrationBitmapCacheStats.purgeCount += 1;
    proceduralIllustrationBitmapCacheStats.versionToken = nextVersionToken;
};

const syncProceduralIllustrationBitmapCacheVersion = (
    versionToken: string = PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_VERSION
): void => {
    if (proceduralIllustrationBitmapCacheVersionToken === versionToken) {
        return;
    }
    purgeProceduralIllustrationBitmapCache('version-change', versionToken);
};

const cacheProceduralIllustrationBitmap = (cacheKey: string, canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const pixels = canvas.width * canvas.height;
    while (proceduralIllustrationBitmapCache.size >= MAX_PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_ENTRIES ||
        (proceduralIllustrationBitmapCachePixels + pixels > MAX_PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_PIXELS && proceduralIllustrationBitmapCache.size > 0)) {
        const oldestKey = proceduralIllustrationBitmapCache.keys().next().value;
        if (oldestKey == null) {
            break;
        }
        const oldest = proceduralIllustrationBitmapCache.get(oldestKey)!;
        proceduralIllustrationBitmapCachePixels -= oldest.width * oldest.height;
        proceduralIllustrationBitmapCache.delete(oldestKey);
        // Every consumer copies the panel into its own overlay synchronously. Release its pixels
        // immediately after eviction, rather than waiting for the next browser GC.
        oldest.width = 1;
        oldest.height = 1;
        proceduralIllustrationBitmapCacheStats.evictedCount += 1;
    }

    proceduralIllustrationBitmapCache.set(cacheKey, canvas);
    proceduralIllustrationBitmapCachePixels += pixels;
    proceduralIllustrationBitmapCacheStats.createdCount += 1;
    return canvas;
};

const buildProceduralIllustrationBitmapCacheKey = (
    pairKey: string,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    sourcePixelWidth: number,
    sourcePixelHeight: number
): string =>
    `${buildProceduralIllustrationCacheKey(pairKey, tier, GAMEPLAY_CARD_VISUALS.textureVersion)}|width=${Math.round(sourcePixelWidth)}|height=${Math.round(sourcePixelHeight)}|palette=${getProceduralIllustrationPaletteSignature(palette)}`;

const getProceduralIllustrationBitmap = (
    pairKey: string,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    sourcePixelWidth: number,
    sourcePixelHeight: number
): HTMLCanvasElement | null => {
    if (!canCacheProceduralIllustrations()) {
        return null;
    }

    syncProceduralIllustrationBitmapCacheVersion();
    const width = Math.max(1, Math.round(sourcePixelWidth));
    const height = Math.max(1, Math.round(sourcePixelHeight));
    const cacheKey = buildProceduralIllustrationBitmapCacheKey(pairKey, tier, palette, width, height);
    const cached = proceduralIllustrationBitmapCache.get(cacheKey);
    if (cached) {
        proceduralIllustrationBitmapCacheStats.hitCount += 1;
        return cached;
    }
    proceduralIllustrationBitmapCacheStats.missCount += 1;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        return null;
    }

    prepareHighQualityBitmapSampling(context);
    drawProceduralTarotIllustration(context, 0, 0, width, height, pairKey, tier, palette);
    return cacheProceduralIllustrationBitmap(cacheKey, canvas);
};

export const clearProceduralIllustrationBitmapCache = (): void => {
    purgeProceduralIllustrationBitmapCache('debug-reset');
    resetProceduralIllustrationBitmapCacheStats();
};

export const getProceduralIllustrationBitmapCacheKeys = (): string[] => [...proceduralIllustrationBitmapCache.keys()].sort();

export const getProceduralIllustrationBitmapCacheDebugState = (): ProceduralIllustrationBitmapCacheDebugState => ({
    createdCount: proceduralIllustrationBitmapCacheStats.createdCount,
    entryCount: proceduralIllustrationBitmapCache.size,
    evictedCount: proceduralIllustrationBitmapCacheStats.evictedCount,
    hitCount: proceduralIllustrationBitmapCacheStats.hitCount,
    keys: getProceduralIllustrationBitmapCacheKeys(),
    lastPurgeReason: proceduralIllustrationBitmapCacheStats.lastPurgeReason,
    maxEntries: proceduralIllustrationBitmapCacheStats.maxEntries,
    pixelCount: proceduralIllustrationBitmapCachePixels,
    maxPixels: MAX_PROCEDURAL_ILLUSTRATION_BITMAP_CACHE_PIXELS,
    missCount: proceduralIllustrationBitmapCacheStats.missCount,
    purgeCount: proceduralIllustrationBitmapCacheStats.purgeCount,
    versionToken: proceduralIllustrationBitmapCacheStats.versionToken
});

export const prewarmProceduralIllustrationBitmap = (
    pairKey: string,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    sourcePixelWidth: number,
    sourcePixelHeight: number
): string | null => {
    const width = Math.max(1, Math.round(sourcePixelWidth));
    const height = Math.max(1, Math.round(sourcePixelHeight));
    const cacheKey = buildProceduralIllustrationBitmapCacheKey(pairKey, tier, palette, width, height);
    return getProceduralIllustrationBitmap(pairKey, tier, palette, width, height) ? cacheKey : null;
};

export const forceProceduralIllustrationBitmapCacheVersion = (versionToken: string): void => {
    syncProceduralIllustrationBitmapCacheVersion(versionToken);
};

function clipRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = ctx as CanvasRenderingContext2D & {
        roundRect?: (rx: number, ry: number, rw: number, rh: number, radii: number | number[]) => void;
    };
    if (typeof rr.roundRect === 'function') {
        ctx.beginPath();
        rr.roundRect(x, y, w, h, r);
        ctx.clip();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.clip();
}

/**
 * Draw `image` into `dest` using CSS-style `object-fit: cover` (center crop).
 */
export const drawImageCover = (
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number
): void => {
    const iw = (image as HTMLImageElement).naturalWidth ?? (image as HTMLVideoElement).videoWidth;
    const ih = (image as HTMLImageElement).naturalHeight ?? (image as HTMLVideoElement).videoHeight;
    if (!iw || !ih) {
        return;
    }

    const destAspect = dw / dh;
    const imgAspect = iw / ih;

    let sx = 0;
    let sy = 0;
    let sWidth = iw;
    let sHeight = ih;

    if (imgAspect > destAspect) {
        sWidth = ih * destAspect;
        sx = (iw - sWidth) / 2;
    } else {
        sHeight = iw / destAspect;
        sy = (ih - sHeight) / 2;
    }

    ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
};

/** Subtle edge darkening inside the clipped panel so art sits in a “mat” against the ornate frame. */
const drawIllustrationMatFeather = (
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    pw: number,
    ph: number,
    strength: number
): void => {
    const cx = px + pw / 2;
    const cy = py + ph / 2;
    const rad = Math.max(pw, ph) * 0.58;
    const g = ctx.createRadialGradient(cx, cy, rad * 0.14, cx, cy, rad);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(10,8,12,${0.4 * strength})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(px, py, pw, ph);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
};

export const drawTarotIllustrationPanel = (
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    panelX: number,
    panelY: number,
    panelW: number,
    panelH: number,
    options?: { matFeatherStrength?: number; hueDegrees?: number }
): void => {
    const matFeatherStrength = options?.matFeatherStrength ?? 1;
    const hueDegrees = options?.hueDegrees ?? 0;
    const cornerR = computeIllustrationCornerRadius(panelW, panelH);
    const ctxFilter = ctx as CanvasRenderingContext2D & { filter?: string };

    ctx.save();
    clipRoundRect(ctx, panelX, panelY, panelW, panelH, cornerR);
    prepareHighQualityBitmapSampling(ctx);

    const prevFilter = ctxFilter.filter ?? 'none';
    if (hueDegrees !== 0 && 'filter' in ctxFilter) {
        ctxFilter.filter = `hue-rotate(${hueDegrees}deg)`;
    }

    drawImageCover(ctx, image, panelX, panelY, panelW, panelH);

    ctxFilter.filter = prevFilter;

    if (matFeatherStrength > 0.01) {
        drawIllustrationMatFeather(ctx, panelX, panelY, panelW, panelH, matFeatherStrength);
    }
    ctx.restore();
};

/** Illustration rect mapped into programmatic overlay viewBox units (context already scaled vb→canvas). */
export const drawIllustrationCoverInViewBox = (
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    canvasPixelWidth: number,
    canvasPixelHeight: number,
    viewBoxWidth: number,
    viewBoxHeight: number,
    options?: { matFeatherStrength?: number; hueDegrees?: number }
): void => {
    const pr = computeIllustrationPixelRect(canvasPixelWidth, canvasPixelHeight);
    const sx = (pr.x * viewBoxWidth) / canvasPixelWidth;
    const sy = (pr.y * viewBoxHeight) / canvasPixelHeight;
    const sw = (pr.width * viewBoxWidth) / canvasPixelWidth;
    const sh = (pr.height * viewBoxHeight) / canvasPixelHeight;
    drawTarotIllustrationPanel(ctx, image, sx, sy, sw, sh, options);
};

export const drawIllustrationInCanvasOverlay = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    image: HTMLImageElement | null,
    globalAlpha = 1,
    options?: { matFeatherStrength?: number; hueDegrees?: number }
): boolean => {
    if (!image?.naturalWidth) {
        return false;
    }

    const { width, height } = canvas;
    const rect = computeIllustrationPixelRect(width, height);

    ctx.save();
    ctx.globalAlpha = globalAlpha;
    drawTarotIllustrationPanel(ctx, image, rect.x, rect.y, rect.width, rect.height, options);
    ctx.restore();
    return true;
};

/** Lower-level panel draw for bitmap caching and raster-deck composition (same clip + mat feather as overlay path). */
export const drawProceduralTarotIllustrationPanel = (
    ctx: CanvasRenderingContext2D,
    panelX: number,
    panelY: number,
    panelW: number,
    panelH: number,
    sourcePixelWidth: number,
    sourcePixelHeight: number,
    pairKey: string,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    options?: { matFeatherStrength?: number }
): void => {
    const matFeatherStrength = options?.matFeatherStrength ?? 1;
    const cornerR = computeIllustrationCornerRadius(panelW, panelH);

    ctx.save();
    clipRoundRect(ctx, panelX, panelY, panelW, panelH, cornerR);
    prepareHighQualityBitmapSampling(ctx);
    const cachedBitmap = getProceduralIllustrationBitmap(pairKey, tier, palette, sourcePixelWidth, sourcePixelHeight);
    if (cachedBitmap) {
        ctx.drawImage(cachedBitmap, panelX, panelY, panelW, panelH);
    } else {
        drawProceduralTarotIllustration(ctx, panelX, panelY, panelW, panelH, pairKey, tier, palette);
    }

    if (matFeatherStrength > 0.01) {
        drawIllustrationMatFeather(ctx, panelX, panelY, panelW, panelH, matFeatherStrength);
    }
    ctx.restore();
};

/** Procedural loot-table illustration (viewBox units — context already scaled). */
export const drawProceduralIllustrationCoverInViewBox = (
    ctx: CanvasRenderingContext2D,
    canvasPixelWidth: number,
    canvasPixelHeight: number,
    viewBoxWidth: number,
    viewBoxHeight: number,
    pairKey: string,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    options?: { matFeatherStrength?: number }
): void => {
    const pr = computeIllustrationPixelRect(canvasPixelWidth, canvasPixelHeight);
    const sx = (pr.x * viewBoxWidth) / canvasPixelWidth;
    const sy = (pr.y * viewBoxHeight) / canvasPixelHeight;
    const sw = (pr.width * viewBoxWidth) / canvasPixelWidth;
    const sh = (pr.height * viewBoxHeight) / canvasPixelHeight;
    drawProceduralTarotIllustrationPanel(ctx, sx, sy, sw, sh, pr.width, pr.height, pairKey, tier, palette, options);
};

/** Procedural illustration in overlay pixel space (emoji/symbol card path). */
export const drawProceduralIllustrationInCanvasOverlay = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    pairKey: string,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    options?: { matFeatherStrength?: number }
): void => {
    const { width, height } = canvas;
    const rect = computeIllustrationPixelRect(width, height);
    ctx.save();
    drawProceduralTarotIllustrationPanel(
        ctx,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        rect.width,
        rect.height,
        pairKey,
        tier,
        palette,
        options
    );
    ctx.restore();
};
