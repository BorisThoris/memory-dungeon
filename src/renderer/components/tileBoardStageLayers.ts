import type { EnemyHazardState, GraphicsQualityPreset } from '../../shared/contracts';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

export const DUNGEON_BOARD_STAGE_LAYER_POLICY = {
    version: 'dng-061-v2',
    cardSurface: { renderOrder: 0, z: 0 },
    cardWear: { renderOrder: 6 },
    passiveHover: { renderOrder: 7 },
    objectiveHalo: { renderOrder: 9 },
    objectiveRing: { renderOrder: 10 },
    objectiveGlyph: { renderOrder: 11 },
    nextThreatTelegraph: { renderOrder: 12, z: 0.165 },
    resolvingMatch: { renderOrder: 13 },
    currentThreat: { renderOrder: 14, z: 0.22 },
    keyboardFocus: { renderOrder: 15 },
    matchCelebration: { renderOrder: 18 }
} as const;

export type DungeonEnemyMarkerAnchorTransform = {
    baseX: number;
    baseY: number;
    imperfectionX: number;
    imperfectionY: number;
    layoutJitterX: number;
    layoutJitterY: number;
};

export const getDungeonBoardStageLod = (
    graphicsQuality: GraphicsQualityPreset,
    reduceMotion: boolean
): {
    currentMarkerOpacity: number;
    markerMotionEnabled: boolean;
    nextTelegraphOpacity: number;
    strongEffectBudget: 'critical-only' | 'standard' | 'full';
} => {
    if (reduceMotion) {
        return {
            currentMarkerOpacity: 0.9,
            markerMotionEnabled: false,
            nextTelegraphOpacity: 0.34,
            strongEffectBudget: 'critical-only'
        };
    }

    if (graphicsQuality === 'low') {
        return {
            currentMarkerOpacity: 0.9,
            markerMotionEnabled: true,
            nextTelegraphOpacity: 0.36,
            strongEffectBudget: 'critical-only'
        };
    }

    if (graphicsQuality === 'high') {
        return {
            currentMarkerOpacity: 0.88,
            markerMotionEnabled: true,
            nextTelegraphOpacity: 0.32,
            strongEffectBudget: 'full'
        };
    }

    return {
        currentMarkerOpacity: 0.88,
        markerMotionEnabled: true,
        nextTelegraphOpacity: 0.32,
        strongEffectBudget: 'standard'
    };
};

export const getDungeonEnemyMarkerAnchor = (
    transform: DungeonEnemyMarkerAnchorTransform,
    layer: 'currentThreat' | 'nextThreatTelegraph',
    bob = 0
): [number, number, number] => {
    const xOffset = layer === 'currentThreat' ? CARD_PLANE_WIDTH * 0.42 : -CARD_PLANE_WIDTH * 0.42;
    const yOffset = layer === 'currentThreat' ? CARD_PLANE_HEIGHT * 0.43 : -CARD_PLANE_HEIGHT * 0.43;
    const z =
        layer === 'currentThreat'
            ? DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.z
            : DUNGEON_BOARD_STAGE_LAYER_POLICY.nextThreatTelegraph.z;

    return [
        transform.baseX + transform.imperfectionX + transform.layoutJitterX + xOffset,
        transform.baseY + transform.imperfectionY + transform.layoutJitterY + yOffset + bob,
        z
    ];
};

export type DungeonEnemyMarkerShape = 'sentinel-diamond' | 'stalker-spear' | 'warden-shield' | 'observer-eye' | 'boss-crown';

export const DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET = {
    version: 'dng-074-v1',
    maxActiveEnemyHazards: 6,
    maxMovingThreatDrawCalls: 36,
    maxMovingThreatMaterialSlots: 36,
    sharedEnemyMarkerGeometryCount: 10,
    trapCardExtraDrawCallsPerPair: 0,
    contextLossRecovery: 'remount_canvas_on_restore'
} as const;

export const getDungeonEnemyMarkerVisualProfile = (
    hazard: Pick<EnemyHazardState, 'bossId' | 'kind'>,
    graphicsQuality: GraphicsQualityPreset,
    reduceMotion: boolean
): {
    haloOpacity: number;
    mainRotation: number;
    mainScale: [number, number, number];
    motionHz: number;
    secondaryOpacity: number;
    shape: DungeonEnemyMarkerShape;
} => {
    const lowOrReduced = graphicsQuality === 'low' || reduceMotion;
    const secondaryOpacity = lowOrReduced ? 0.58 : graphicsQuality === 'high' ? 0.72 : 0.64;
    const haloOpacity = lowOrReduced ? 0.12 : graphicsQuality === 'high' ? 0.22 : 0.18;
    const motionHz = reduceMotion ? 0 : graphicsQuality === 'low' ? 0.55 : graphicsQuality === 'high' ? 0.85 : 0.7;

    if (hazard.bossId) {
        return {
            haloOpacity,
            mainRotation: Math.PI / 4,
            mainScale: [1.18, 1.18, 1],
            motionHz,
            secondaryOpacity,
            shape: 'boss-crown'
        };
    }

    if (hazard.kind === 'stalker') {
        return {
            haloOpacity,
            mainRotation: 0,
            mainScale: [0.72, 1.28, 1],
            motionHz,
            secondaryOpacity,
            shape: 'stalker-spear'
        };
    }

    if (hazard.kind === 'warden') {
        return {
            haloOpacity,
            mainRotation: 0,
            mainScale: [1.26, 0.86, 1],
            motionHz,
            secondaryOpacity,
            shape: 'warden-shield'
        };
    }

    if (hazard.kind === 'observer') {
        return {
            haloOpacity,
            mainRotation: Math.PI / 2,
            mainScale: [1.34, 0.5, 1],
            motionHz,
            secondaryOpacity,
            shape: 'observer-eye'
        };
    }

    return {
        haloOpacity,
        mainRotation: Math.PI / 4,
        mainScale: [1, 1, 1],
        motionHz,
        secondaryOpacity,
        shape: 'sentinel-diamond'
    };
};

const movingThreatMeshCountFor = (
    hazard: Pick<EnemyHazardState, 'bossId' | 'kind'>,
    hasNextTelegraph: boolean
): number => {
    const secondaryMeshCount = hazard.bossId || hazard.kind === 'observer' ? 1 : 0;
    return 4 + secondaryMeshCount + (hasNextTelegraph ? 1 : 0);
};

export const estimateDungeonBoardStagePerformanceCost = (input: {
    hazards: readonly Pick<EnemyHazardState, 'bossId' | 'kind' | 'nextTileId' | 'state'>[];
    graphicsQuality: GraphicsQualityPreset;
    reduceMotion: boolean;
}): {
    activeHazardCount: number;
    contextLossRecovery: typeof DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.contextLossRecovery;
    estimatedMovingThreatDrawCalls: number;
    estimatedMovingThreatMaterialSlots: number;
    lowOrReducedQualityReadable: boolean;
    sharedEnemyMarkerGeometryCount: number;
    trapCardExtraDrawCallsPerPair: number;
    withinBudget: boolean;
} => {
    const activeHazards = input.hazards.filter((hazard) => hazard.state !== 'defeated');
    const estimatedMovingThreatDrawCalls = activeHazards.reduce(
        (sum, hazard) => sum + movingThreatMeshCountFor(hazard, Boolean(hazard.nextTileId)),
        0
    );
    const lod = getDungeonBoardStageLod(input.graphicsQuality, input.reduceMotion);

    return {
        activeHazardCount: activeHazards.length,
        contextLossRecovery: DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.contextLossRecovery,
        estimatedMovingThreatDrawCalls,
        estimatedMovingThreatMaterialSlots: estimatedMovingThreatDrawCalls,
        lowOrReducedQualityReadable:
            lod.currentMarkerOpacity >= 0.88 &&
            lod.nextTelegraphOpacity >= 0.3 &&
            (input.graphicsQuality !== 'low' || lod.strongEffectBudget === 'critical-only') &&
            (!input.reduceMotion || !lod.markerMotionEnabled),
        sharedEnemyMarkerGeometryCount: DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.sharedEnemyMarkerGeometryCount,
        trapCardExtraDrawCallsPerPair: DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.trapCardExtraDrawCallsPerPair,
        withinBudget:
            activeHazards.length <= DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxActiveEnemyHazards &&
            estimatedMovingThreatDrawCalls <= DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxMovingThreatDrawCalls &&
            estimatedMovingThreatDrawCalls <= DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.maxMovingThreatMaterialSlots
    };
};
