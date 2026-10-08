import type { BoardScreenSpaceAA, GraphicsQualityPreset } from './contracts';

/** Original floor tile count at/above which quality uses a stable lower render budget. */
export const ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD = 40;

/**
 * Consolidated tier mapping for tests and docs — keep in sync with `TileBoard`, `TileBoardScene`, `MainMenuBackground`.
 * Changing a preset should update consumers together (see `graphicsQuality.test.ts` + gameplay visual config).
 */
export type GraphicsQualityTierSnapshot = {
    quality: GraphicsQualityPreset;
    boardDprCapStandard: number;
    boardDprCapCompact: number;
    menuPixiResolutionCap: number;
    menuAtmosphereParticleCountDesktop: number;
    boardAnisotropyCap: number;
    /** Same rule as `GameScreen`: the CSS board glow is only eligible above low. */
    tileBoardCssBloomEligible: boolean;
};

/** WebGL tile board: effective device pixel ratio cap (PERF-001). */
export const getBoardDprCap = (quality: GraphicsQualityPreset, compact: boolean): number => {
    if (compact) {
        return quality === 'low' ? 1.35 : quality === 'medium' ? 1.9 : 2.35;
    }
    return quality === 'low' ? 1.2 : quality === 'medium' ? 1.7 : 2.1;
};

/** Main menu Pixi atmosphere: cap internal renderer resolution vs OS DPR (PERF-006). */
export const getMenuPixiResolutionCap = (quality: GraphicsQualityPreset): number =>
    quality === 'low' ? 1.25 : quality === 'medium' ? 2 : 2.5;

/** Bound allocations by physical pixels as well as DPR, including 4K and scaled monitors. */
export const getRenderPixelRatio = (
    width: number,
    height: number,
    devicePixelRatio: number,
    dprCap: number,
    pixelBudget: number
): number => Math.min(
    Math.max(0.1, devicePixelRatio || 1),
    dprCap,
    Math.sqrt(pixelBudget / (Math.max(1, width) * Math.max(1, height))),
    4096 / Math.max(1, width, height)
);

/** Main menu Pixi atmosphere: animated particle budget by viewport and quality preset. */
export const getMenuAtmosphereParticleCount = (
    width: number,
    height: number,
    quality: GraphicsQualityPreset
): number => {
    const base =
        width <= 430 || height <= 620
            ? 10
            : width <= 760 || height <= 760
              ? 16
              : width <= 1220
                ? 22
                : 28;
    const ambientPad = width <= 760 ? 2 : 4;
    const fullBudget = base + ambientPad;

    if (quality === 'low') {
        return Math.max(8, Math.round(fullBudget * 0.58));
    }

    if (quality === 'high') {
        return fullBudget + (width >= 1440 && height >= 820 ? 4 : 0);
    }

    return fullBudget;
};

/** WebGL tile textures: max anisotropy vs device cap (PERF-007). */
export const getBoardAnisotropyCap = (quality: GraphicsQualityPreset): number =>
    quality === 'low' ? 2 : quality === 'medium' ? 4 : 8;

export const getGraphicsQualityTierSnapshot = (quality: GraphicsQualityPreset): GraphicsQualityTierSnapshot => ({
    quality,
    boardDprCapStandard: getBoardDprCap(quality, false),
    boardDprCapCompact: getBoardDprCap(quality, true),
    menuPixiResolutionCap: getMenuPixiResolutionCap(quality),
    menuAtmosphereParticleCountDesktop: getMenuAtmosphereParticleCount(1280, 720, quality),
    boardAnisotropyCap: getBoardAnisotropyCap(quality),
    tileBoardCssBloomEligible: quality !== 'low'
});

/**
 * Keep one allocation for the whole floor. Changing DPR at each shuffle/entrance resizes and
 * clears the drawing buffer, causing flashes precisely when the board is busiest.
 */
export const resolveAdaptiveBoardRenderQuality = (input: {
    savedGraphicsQuality: GraphicsQualityPreset;
    /** The floor's original tile count, including removed cards, so quality stays stable. */
    activeTileCount: number;
    compact: boolean;
    boardScreenSpaceAA: BoardScreenSpaceAA;
    reduceMotion: boolean;
}): { dprCap: number; resolvedAa: 'smaa' | 'msaa' | 'off' } => {
    const baseDpr = getBoardDprCap(input.savedGraphicsQuality, input.compact);
    const largeBoard = input.activeTileCount >= ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD;
    const adapt = largeBoard && input.savedGraphicsQuality !== 'low';

    let dprCap = baseDpr;

    if (adapt) {
        if (input.savedGraphicsQuality === 'medium') {
            dprCap = Math.min(dprCap, input.compact ? 1.45 : 1.28);
        } else {
            dprCap = Math.min(dprCap, input.compact ? 1.78 : 1.58);
        }
    }

    let resolvedAa: 'smaa' | 'msaa' | 'off' =
        input.boardScreenSpaceAA === 'auto'
            ? input.reduceMotion
                ? 'msaa'
                : 'smaa'
            : input.boardScreenSpaceAA;

    if (adapt && resolvedAa === 'smaa') {
        resolvedAa = 'msaa';
    }

    return { dprCap, resolvedAa };
};

/**
 * How much of a painted scene's life a device gets (`GameplayScene`, `CathedralScene`,
 * `PortalScene`).
 *
 * A scene is painted into one canvas the size of its art (`scenePaint.ts`), so what it costs does
 * not grow with the screen, and every tier draws the same room: its lights, its flames, its mist.
 *
 *   - `full`: all of it at thirty frames a second, the plate drifting slowly and turning toward
 *     the pointer.
 *   - `lean`: the same room at twenty-four frames a second with about half the motes and specks,
 *     and the plate held still. A phone has no pointer to turn toward, and a plate that does not
 *     move is one less layer for it to composite under the board.
 *   - `still`: nothing moves (reduce motion).
 *
 * A phone is any coarse-pointer device or a viewport narrower than `SCENE_LEAN_MAX_WIDTH`, whatever
 * the quality preset says: the preset is the player's choice of fidelity, the device's budget is
 * not theirs to raise.
 *
 * A large display is not lean. It was for a while (4K and scaled-4K were held to `lean`), because
 * the scenes were then stacks of blended full-screen layers whose cost grew with every device
 * pixel and which flashed when the compositor ran out of room. One canvas does not.
 */
export type SceneEffectTier = 'full' | 'lean' | 'still';

export const SCENE_LEAN_MAX_WIDTH = 900;

export const getSceneEffectTier = (input: {
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
    coarsePointer: boolean;
    viewportWidth: number;
    /** Accepted for callers that have them; the tier no longer depends on how many pixels the display has. */
    viewportHeight?: number;
    devicePixelRatio?: number;
}): SceneEffectTier => {
    if (input.reduceMotion) {
        return 'still';
    }
    if (input.quality === 'low' || input.coarsePointer || input.viewportWidth < SCENE_LEAN_MAX_WIDTH) {
        return 'lean';
    }
    return 'full';
};

/**
 * The board's draw-call budget (2026-10-08): react-three-fiber's guidance is at most a thousand
 * calls a frame and ideally a few hundred, the low end on a phone. A card's layers once cost about
 * 22 calls even with nothing to show (zero-opacity hover rims, glows behind the card); hidden
 * layers now cost nothing, and a card at rest is about nine. The budget allows ten a card and a
 * fixed sixty for the scene around them, and the playtest e2e holds every floor it plays to it
 * (canvas `data-webgl-draw-calls`).
 */
export const BOARD_DRAW_CALLS_PER_CARD = 10;
export const BOARD_DRAW_CALLS_FIXED = 60;
export const boardDrawCallBudget = (cards: number): number => BOARD_DRAW_CALLS_FIXED + BOARD_DRAW_CALLS_PER_CARD * Math.max(0, cards);
