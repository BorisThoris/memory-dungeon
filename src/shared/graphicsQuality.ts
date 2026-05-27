import type { BoardScreenSpaceAA, GraphicsQualityPreset } from './contracts';

/** Tile count at/above which internal adaptive quality may cap DPR and post-FX during heavy board motion. */
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
    /** Same rule as `TileBoard`: bloom post path only when not low. */
    tileBoardBloomPostPath: boolean;
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
    tileBoardBloomPostPath: quality !== 'low'
});

/**
 * Internal-only: during shuffle, entrance, or prestage loading on large boards, cap DPR and disable bloom + SMAA
 * to keep frame time predictable. Restores saved-tier behavior when motion clears.
 */
export const resolveAdaptiveBoardRenderQuality = (input: {
    savedGraphicsQuality: GraphicsQualityPreset;
    /** Shuffle or entrance animation, or prestaging GPU warm-up (`TileBoard` `boardPreStage === 'loading'`). */
    boardHeavyMotion: boolean;
    activeTileCount: number;
    compact: boolean;
    boardBloomEnabled: boolean;
    boardScreenSpaceAA: BoardScreenSpaceAA;
    reduceMotion: boolean;
}): { dprCap: number; bloomPostEnabled: boolean; resolvedAa: 'smaa' | 'msaa' | 'off' } => {
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

    const bloomPostEnabled =
        input.boardBloomEnabled && input.savedGraphicsQuality !== 'low' && !adapt;

    let resolvedAa: 'smaa' | 'msaa' | 'off' =
        input.boardScreenSpaceAA === 'auto'
            ? input.reduceMotion
                ? 'msaa'
                : 'smaa'
            : input.boardScreenSpaceAA;

    if (adapt && resolvedAa === 'smaa') {
        resolvedAa = 'msaa';
    }

    return { dprCap, bloomPostEnabled, resolvedAa };
};
