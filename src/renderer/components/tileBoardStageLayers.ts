import type { Tile } from '../../shared/contracts';

export const DUNGEON_BOARD_STAGE_LAYER_POLICY = {
    version: 'dng-061-v3',
    cardSurface: { renderOrder: 0, z: 0 },
    cardWear: { renderOrder: 6 },
    passiveHover: { renderOrder: 7 },
    objectiveHalo: { renderOrder: 9 },
    objectiveRing: { renderOrder: 10 },
    objectiveGlyph: { renderOrder: 11 },
    resolvingMatch: { renderOrder: 13 },
    keyboardFocus: { renderOrder: 15 },
    matchCelebration: { renderOrder: 18 }
} as const;

export const DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET = {
    version: 'dng-074-v2',
    maxStaticReadabilityMarkerDrawCalls: 72,
    traitRailExtraDrawCalls: 2,
    contextLossRecovery: 'remount_canvas_on_restore'
} as const;

const staticReadabilityMeshCountFor = (tile: Pick<Tile, 'tileTraitKind'>): number =>
    tile.tileTraitKind ? DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.traitRailExtraDrawCalls : 0;

export const estimateDungeonBoardStagePerformanceCost = (input: {
    readabilityMarkerTiles?: readonly Pick<Tile, 'tileTraitKind'>[];
}): {
    contextLossRecovery: typeof DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.contextLossRecovery;
    estimatedStaticReadabilityDrawCalls: number;
    maxStaticReadabilityMarkerDrawCalls: number;
    traitRailExtraDrawCalls: number;
    withinBudget: boolean;
} => {
    const estimatedStaticReadabilityDrawCalls = (input.readabilityMarkerTiles ?? []).reduce(
        (sum, tile) => sum + staticReadabilityMeshCountFor(tile),
        0
    );

    return {
        contextLossRecovery: DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.contextLossRecovery,
        estimatedStaticReadabilityDrawCalls,
        maxStaticReadabilityMarkerDrawCalls: DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxStaticReadabilityMarkerDrawCalls,
        traitRailExtraDrawCalls: DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.traitRailExtraDrawCalls,
        withinBudget:
            estimatedStaticReadabilityDrawCalls <= DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxStaticReadabilityMarkerDrawCalls
    };
};
