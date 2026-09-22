import type { BoardScreenSpaceAA, GraphicsQualityPreset } from './contracts';

/** Tile count at/above which internal adaptive quality may cap DPR and AA during heavy board motion. */
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
 * Internal-only: during shuffle, entrance, or prestage loading on large boards, cap DPR and avoid SMAA
 * to keep frame time predictable. Restores saved-tier behavior when motion clears.
 */
export const resolveAdaptiveBoardRenderQuality = (input: {
    savedGraphicsQuality: GraphicsQualityPreset;
    /** Shuffle or entrance animation, or prestaging GPU warm-up (`TileBoard` `boardPreStage === 'loading'`). */
    boardHeavyMotion: boolean;
    activeTileCount: number;
    compact: boolean;
    boardScreenSpaceAA: BoardScreenSpaceAA;
    reduceMotion: boolean;
}): { dprCap: number; resolvedAa: 'smaa' | 'msaa' | 'off' } => {
    const baseDpr = getBoardDprCap(input.savedGraphicsQuality, input.compact);
    const largeBoard = input.activeTileCount >= ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD;
    const adapt = input.boardHeavyMotion && largeBoard && input.savedGraphicsQuality !== 'low';

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
 *   - `full`: light passes, flame sprites, mist, sparks, motes, the plate's drift and its turn
 *     toward the pointer.
 *   - `lean`: the glow layers and the flame sprites only. Everything else in `full` is either a
 *     blended composited layer per particle, a blurred full-plate layer, or a per-frame transform
 *     of the whole plate, and on a phone those cost the frame rate the board needs; the flames are
 *     a handful of small stepped strips and are what the scene is for.
 *   - `still`: nothing moves (reduce motion).
 *
 * A phone is any coarse-pointer device or a viewport narrower than `SCENE_LEAN_MAX_WIDTH`, whatever
 * the quality preset says: the preset is the player's choice of fidelity, the device's budget is
 * not theirs to raise.
 */
export type SceneEffectTier = 'full' | 'lean' | 'still';

export const SCENE_LEAN_MAX_WIDTH = 900;

export const getSceneEffectTier = (input: {
    quality: GraphicsQualityPreset;
    reduceMotion: boolean;
    coarsePointer: boolean;
    viewportWidth: number;
}): SceneEffectTier => {
    if (input.reduceMotion) {
        return 'still';
    }
    if (input.quality === 'low' || input.coarsePointer || input.viewportWidth < SCENE_LEAN_MAX_WIDTH) {
        return 'lean';
    }
    return 'full';
};
