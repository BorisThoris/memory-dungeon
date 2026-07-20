/**
 * Optional “raster deck”: 30 cached illustration panels (Canvas2D bitmaps), composed per tile at runtime from `pairKey`.
 * Enable with `FEATURE_CARD_RASTER_DECK` or DEV `localStorage.cardRasterDeck = '1'`.
 *
 * Slots are procedural (same generator as normal cards) but use fixed pair keys `__raster-deck-00` … `__raster-deck-29`
 * so they form a reusable library; runtime picks indices via `hashPairKey` and blends two layers in the illustration rect.
 */
import { hashPairKey } from '../../shared/hashPairKey';
import { FEATURE_CARD_RASTER_DECK } from '../../shared/feature-flags';
import type { CardFaceOverlayColors } from './cardFaceOverlayPalette';
import { drawProceduralTarotIllustrationPanel } from './cardIllustrationDraw';
import { computeIllustrationPixelRect } from './cardIllustrationRect';
import type { OverlayDrawTier } from './overlayDrawTier';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from '../components/tileShatter';
import { GAMEPLAY_CARD_VISUALS } from '../components/gameplayVisualConfig';
import { ILLUSTRATION_GEN_SCHEMA_VERSION } from './proceduralIllustration/illustrationSchemaVersion';

/** Match [`tileTextures.ts`](../components/tileTextures.ts) static overlay canvas dimensions (no import — avoids cycles). */
const STATIC_CARD_TEXTURE_HEIGHT = 1024;
const STATIC_CARD_TEXTURE_WIDTH = Math.max(2, Math.round(STATIC_CARD_TEXTURE_HEIGHT * (CARD_PLANE_WIDTH / CARD_PLANE_HEIGHT)));

const getStaticCardTexturePixelSizeLocal = (): { width: number; height: number } => ({
    width: STATIC_CARD_TEXTURE_WIDTH,
    height: STATIC_CARD_TEXTURE_HEIGHT
});

export const CARD_RASTER_SLOT_COUNT = 30;

const paletteSig = (p: CardFaceOverlayColors): string =>
    [p.sigilFillLight, p.sigilFillDark, p.sigilStroke, p.sigilHighlight].join('|');

/** Deterministic pair key for library slot `0 .. CARD_RASTER_SLOT_COUNT - 1`. */
export const rasterDeckPairKeyForSlot = (slot: number): string => {
    const s = Math.max(0, Math.min(CARD_RASTER_SLOT_COUNT - 1, Math.floor(slot)));
    return `__raster-deck-${s.toString().padStart(2, '0')}`;
};

const panelCache = new Map<string, HTMLCanvasElement>();

const cacheKey = (slot: number, tier: OverlayDrawTier, palette: CardFaceOverlayColors): string =>
    `${slot}|${tier}|${paletteSig(palette)}|s${ILLUSTRATION_GEN_SCHEMA_VERSION}|t${GAMEPLAY_CARD_VISUALS.textureVersion}`;

const ensureRasterPanel = (
    slot: number,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    panelW: number,
    panelH: number
): HTMLCanvasElement => {
    const key = cacheKey(slot, tier, palette);
    let canvas = panelCache.get(key);
    if (canvas) {
        return canvas;
    }
    canvas = document.createElement('canvas');
    canvas.width = panelW;
    canvas.height = panelH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return canvas;
    }
    const pairKey = rasterDeckPairKeyForSlot(slot);
    drawProceduralTarotIllustrationPanel(
        ctx,
        0,
        0,
        panelW,
        panelH,
        panelW,
        panelH,
        pairKey,
        tier,
        palette,
        { matFeatherStrength: 0.92 }
    );
    panelCache.set(key, canvas);
    return canvas;
};

export const isCardRasterDeckEnabled = (): boolean => {
    if (FEATURE_CARD_RASTER_DECK) {
        return true;
    }
    if (import.meta.env.DEV && typeof localStorage !== 'undefined') {
        try {
            return localStorage.getItem('cardRasterDeck') === '1';
        } catch {
            return false;
        }
    }
    return false;
};

/** Clears cached panel bitmaps (e.g. after hot reload of illustration code in DEV). */
export const clearRasterDeckPanelCache = (): void => {
    panelCache.clear();
};

/**
 * Two-layer composite in the illustration rect: base slot + multiply blend of second slot.
 * Caller should match `drawCardFrontOverlay` preamble (clear + optional noise) before calling.
 */
export const drawRasterDeckComposedOverlay = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    pairKey: string,
    tier: OverlayDrawTier,
    palette: CardFaceOverlayColors,
    options?: { matFeatherStrength?: number }
): void => {
    void options;
    const { width, height } = canvas;
    const rect = computeIllustrationPixelRect(width, height);
    const slotA = Math.abs(hashPairKey(pairKey)) % CARD_RASTER_SLOT_COUNT;
    const slotB = Math.abs(hashPairKey(`${pairKey}|raster-deck-accent`)) % CARD_RASTER_SLOT_COUNT;

    const panelA = ensureRasterPanel(slotA, tier, palette, rect.width, rect.height);
    const panelB = ensureRasterPanel(slotB, tier, palette, rect.width, rect.height);

    ctx.save();
    ctx.translate(rect.x, rect.y);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(panelA, 0, 0, rect.width, rect.height);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.4;
    ctx.drawImage(panelB, 0, 0, rect.width, rect.height);
    ctx.restore();
};

/** Panel dimensions for the current static card texture size (matches overlay illustration rect). */
export const getRasterDeckPanelPixelSize = (): { width: number; height: number } => {
    const { height: ch, width: cw } = getStaticCardTexturePixelSizeLocal();
    const rect = computeIllustrationPixelRect(cw, ch);
    return { width: rect.width, height: rect.height };
};
