import { Path, RingGeometry, Shape, ShapeGeometry } from 'three';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

let curseRingSingleton: RingGeometry | null = null;
let findableCornerHaloSingleton: RingGeometry | null = null;
let findableCornerRingSingleton: RingGeometry | null = null;
let findableShardGlyphSingleton: RingGeometry | null = null;
let findableScoreGlyphSingleton: RingGeometry | null = null;

/** Shared curse ring — identical for every tile (`TileBoardScene`). */
export const getSharedCurseRingGeometry = (): RingGeometry => {
    if (!curseRingSingleton) {
        const maxR = Math.max(CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT) * 0.48;
        curseRingSingleton = new RingGeometry(maxR * 0.86, maxR, 36);
    }
    return curseRingSingleton;
};

export const getSharedFindableCornerHaloGeometry = (): RingGeometry => {
    if (!findableCornerHaloSingleton) {
        findableCornerHaloSingleton = new RingGeometry(0.032, 0.048, 24);
    }
    return findableCornerHaloSingleton;
};

export const getSharedFindableCornerRingGeometry = (): RingGeometry => {
    if (!findableCornerRingSingleton) {
        findableCornerRingSingleton = new RingGeometry(0.02, 0.032, 22);
    }
    return findableCornerRingSingleton;
};

export const getSharedFindableShardGlyphGeometry = (): RingGeometry => {
    if (!findableShardGlyphSingleton) {
        findableShardGlyphSingleton = new RingGeometry(0.006, 0.016, 4);
    }
    return findableShardGlyphSingleton;
};

export const getSharedFindableScoreGlyphGeometry = (): RingGeometry => {
    if (!findableScoreGlyphSingleton) {
        findableScoreGlyphSingleton = new RingGeometry(0.008, 0.016, 18);
    }
    return findableScoreGlyphSingleton;
};

/**
 * TBF-009: segment counts for circular rings (low = cheaper mesh).
 */
const getRimRingSegments = (quality: GraphicsQualityPreset): number => {
    switch (quality) {
        case 'low':
            return 28;
        case 'high':
            return 72;
        case 'medium':
        default:
            return 48;
    }
};

/** Crisp inner resolving ring — circular path (low / fallback). */
const createResolvingCrispRingGeometry = (quality: GraphicsQualityPreset): RingGeometry =>
    new RingGeometry(CARD_PLANE_WIDTH * 0.37, CARD_PLANE_WIDTH * 0.505, getRimRingSegments(quality));

/** Focus ring — slightly outside resolving inner. */
const createFocusRingGeometry = (quality: GraphicsQualityPreset): RingGeometry =>
    new RingGeometry(CARD_PLANE_WIDTH * 0.35, CARD_PLANE_WIDTH * 0.52, getRimRingSegments(quality));

/**
 * TBF-004: rounded-rect bezel ring (outer − inner), XY plane, centered.
 * Falls back to circular rings elsewhere when `useRoundedRim === false` (low quality).
 */
const roundRectContour = (ctx: Shape | Path, x: number, y: number, w: number, h: number, r: number): void => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
};

/** Inner hole: clockwise (outer `roundRectContour` is CCW) so the annulus keeps correct face winding. */
const roundRectHoleContour = (ctx: Path, x: number, y: number, w: number, h: number, r: number): void => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + w - radius, y);
    ctx.lineTo(x + radius, y);
    ctx.quadraticCurveTo(x, y, x, y + radius);
    ctx.lineTo(x, y + h - radius);
    ctx.quadraticCurveTo(x, y + h, x + radius, y + h);
    ctx.lineTo(x + w - radius, y + h);
    ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - radius);
    ctx.lineTo(x + w, y + radius);
    ctx.quadraticCurveTo(x + w, y, x + w - radius, y);
};

const createRoundedRectBezelRingGeometry = (
    outerPad: number,
    innerPad: number,
    outerCorner: number,
    innerCorner: number
): ShapeGeometry => {
    const ow = CARD_PLANE_WIDTH + outerPad * 2;
    const oh = CARD_PLANE_HEIGHT + outerPad * 2;
    const iw = CARD_PLANE_WIDTH - innerPad * 2;
    const ih = CARD_PLANE_HEIGHT - innerPad * 2;
    const ox = -ow / 2;
    const oy = -oh / 2;
    const ix = -iw / 2;
    const iy = -ih / 2;

    const shape = new Shape();
    roundRectContour(shape, ox, oy, ow, oh, outerCorner);

    const hole = new Path();
    roundRectHoleContour(hole, ix, iy, iw, ih, innerCorner);
    shape.holes.push(hole);

    return new ShapeGeometry(shape);
};

/** Shared resolving rim: matches card silhouette better than a circle (medium+). */
let resolvingRoundedSingleton: ShapeGeometry | null = null;
let focusRoundedSingleton: ShapeGeometry | null = null;
let matchedRoundedSingleton: ShapeGeometry | null = null;
let auraRoundedSingleton: ShapeGeometry | null = null;
let arcaneGlowRoundedSingleton: ShapeGeometry | null = null;

export const getResolvingRoundedRectRingGeometry = (): ShapeGeometry => {
    if (!resolvingRoundedSingleton) {
        resolvingRoundedSingleton = createRoundedRectBezelRingGeometry(0.04, 0.02, 0.09, 0.085);
    }
    return resolvingRoundedSingleton;
};

export const getFocusRoundedRectRingGeometry = (): ShapeGeometry => {
    if (!focusRoundedSingleton) {
        focusRoundedSingleton = createRoundedRectBezelRingGeometry(0.045, 0.016, 0.095, 0.09);
    }
    return focusRoundedSingleton;
};

export const getMatchedRoundedRectRingGeometry = (): ShapeGeometry => {
    if (!matchedRoundedSingleton) {
        const geometry = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.geometry;
        matchedRoundedSingleton = createRoundedRectBezelRingGeometry(
            geometry.outerPad,
            geometry.innerPad,
            geometry.outerCorner,
            geometry.innerCorner
        );
    }
    return matchedRoundedSingleton;
};

/** Flame envelope is wider than the separate, semantic trait-marker borders. */
export const getCardAuraGeometry = (): ShapeGeometry => {
    auraRoundedSingleton ??= createRoundedRectBezelRingGeometry(
        GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.auraOuterPad, 0.01, 0.24, 0.084);
    return auraRoundedSingleton;
};

export const getArcaneGlowRoundedRectRingGeometry = (): ShapeGeometry => {
    if (!arcaneGlowRoundedSingleton) {
        arcaneGlowRoundedSingleton = createRoundedRectBezelRingGeometry(0.06, 0.018, 0.108, 0.086);
    }
    return arcaneGlowRoundedSingleton;
};

const crispRingByQuality = new Map<GraphicsQualityPreset, RingGeometry>();
const focusRingByQuality = new Map<GraphicsQualityPreset, RingGeometry>();

/** One shared mesh per quality tier (many tiles reuse the same BufferGeometry). */
export const getSharedResolvingCrispRingGeometry = (quality: GraphicsQualityPreset): RingGeometry => {
    let g = crispRingByQuality.get(quality);
    if (!g) {
        g = createResolvingCrispRingGeometry(quality);
        crispRingByQuality.set(quality, g);
    }
    return g;
};

export const getSharedFocusRingGeometry = (quality: GraphicsQualityPreset): RingGeometry => {
    let g = focusRingByQuality.get(quality);
    if (!g) {
        g = createFocusRingGeometry(quality);
        focusRingByQuality.set(quality, g);
    }
    return g;
};
