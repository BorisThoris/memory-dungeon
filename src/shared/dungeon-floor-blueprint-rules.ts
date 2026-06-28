import type {
    DungeonCardKind,
    DungeonFloorBlueprint,
    DungeonRunNodeKind,
    FloorArchetypeId,
    FloorTag,
    GameMode
} from './contracts';
import { getDungeonEliteEncounterRules } from './dungeon-boss-rules';
import {
    createDungeonEncounterContext
} from './dungeon-encounter-context-rules';
import {
    budgetForFloor,
    chooseRoomEffectsForFloor,
    dungeonBossForFloor,
    dungeonObjectiveForFloor,
    exitSpecsForFloor,
    pairCapacityForDungeonEncounter,
    shouldAddDungeonShopTile
} from './dungeon-blueprint-policy-rules';
import {
    capDungeonCardRecipeForBudget,
    dungeonCardRecipeForFloor
} from './dungeon-card-recipe-rules';

export const createDungeonFloorBlueprint = ({
    runSeed,
    rulesVersion,
    level,
    floorTag,
    floorArchetypeId,
    gameMode,
    dungeonNodeKind
}: {
    runSeed: number;
    rulesVersion: number;
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    gameMode?: GameMode;
    dungeonNodeKind?: DungeonRunNodeKind | null;
}): DungeonFloorBlueprint => {
    const eliteRules = getDungeonEliteEncounterRules(dungeonNodeKind);
    const baseBudgets = budgetForFloor(level, floorTag, floorArchetypeId);
    const budgets = eliteRules
        ? {
              ...baseBudgets,
              threatBudget: Math.max(baseBudgets.threatBudget, eliteRules.threatBudgetFloor),
              rewardBudget: Math.max(baseBudgets.rewardBudget, eliteRules.rewardBudgetFloor)
          }
        : baseBudgets;
    const bossId = dungeonBossForFloor(floorTag, floorArchetypeId);
    const objectiveId = eliteRules?.objectiveId ?? dungeonObjectiveForFloor(level, floorTag, floorArchetypeId);
    const pairedCardCapacity = pairCapacityForDungeonEncounter(level, floorTag, floorArchetypeId, dungeonNodeKind);
    const exitSpecs = exitSpecsForFloor(level, floorTag, floorArchetypeId);
    const pairedCardSpecs = capDungeonCardRecipeForBudget(
        dungeonCardRecipeForFloor(level, floorTag, floorArchetypeId, gameMode, {
            ...budgets,
            bossId,
            exitLockKinds: exitSpecs.map((exit) => exit.lockKind)
        }),
        pairedCardCapacity,
        objectiveId
    );
    return {
        level,
        floorTag,
        floorArchetypeId,
        bossId,
        objectiveId,
        ...budgets,
        exitSpecs,
        pairedCardSpecs,
        roomEffectIds: chooseRoomEffectsForFloor(runSeed, rulesVersion, level, floorTag, floorArchetypeId, gameMode, dungeonNodeKind),
        shopTileId: shouldAddDungeonShopTile(runSeed, rulesVersion, level, floorTag, floorArchetypeId, gameMode, dungeonNodeKind)
            ? `${level}-shop`
            : null
    };
};

export interface DungeonEncounterBudgetSummary {
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    dungeonNodeKind: DungeonRunNodeKind | null;
    pairCapacity: number;
    pairedCardCount: number;
    singletonUtilityCount: number;
    threatPairCount: number;
    rewardPairCount: number;
    utilityPairCount: number;
    lockPairCount: number;
    routePairCount: number;
    bossPairCount: number;
    objectiveId: DungeonFloorBlueprint['objectiveId'];
    bossId: DungeonFloorBlueprint['bossId'];
    cardKindCounts: Record<DungeonCardKind, number>;
    warnings: string[];
}

const emptyDungeonCardKindCounts = (): Record<DungeonCardKind, number> => ({
    enemy: 0,
    trap: 0,
    treasure: 0,
    shrine: 0,
    gateway: 0,
    key: 0,
    lock: 0,
    exit: 0,
    lever: 0,
    shop: 0,
    room: 0
});

export const inspectDungeonEncounterBudget = (options: {
    runSeed: number;
    rulesVersion: number;
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    gameMode?: GameMode;
    dungeonNodeKind?: DungeonRunNodeKind | null;
}): DungeonEncounterBudgetSummary => {
    const encounter = createDungeonEncounterContext(
        options.dungeonNodeKind,
        options.floorTag,
        options.floorArchetypeId
    );
    const blueprint = createDungeonFloorBlueprint({
        ...options,
        floorTag: encounter.floorTag,
        floorArchetypeId: encounter.floorArchetypeId,
        dungeonNodeKind: encounter.nodeKind
    });
    const pairCapacity = pairCapacityForDungeonEncounter(
        options.level,
        options.floorTag,
        options.floorArchetypeId,
        options.dungeonNodeKind
    );
    const cardKindCounts = emptyDungeonCardKindCounts();
    for (const card of blueprint.pairedCardSpecs) {
        cardKindCounts[card.kind] += 1;
    }
    cardKindCounts.exit = blueprint.exitSpecs.length;
    cardKindCounts.shop = blueprint.shopTileId ? 1 : 0;
    cardKindCounts.room = blueprint.roomEffectIds.length;

    const threatPairCount = cardKindCounts.enemy + cardKindCounts.trap;
    const rewardPairCount = cardKindCounts.treasure + cardKindCounts.shrine;
    const utilityPairCount = cardKindCounts.key + cardKindCounts.lever;
    const lockPairCount = cardKindCounts.lock;
    const routePairCount = cardKindCounts.gateway;
    const bossPairCount = blueprint.pairedCardSpecs.filter((card) => card.bossId != null).length;
    const pairedCardCount = blueprint.pairedCardSpecs.length;
    const singletonUtilityCount = blueprint.exitSpecs.length + (blueprint.shopTileId ? 1 : 0) + blueprint.roomEffectIds.length;
    const warnings: string[] = [];

    if (pairedCardCount > pairCapacity) {
        warnings.push(
            `paired cards ${pairedCardCount} exceed pair capacity ${pairCapacity} for level ${options.level}`
        );
    }
    if (blueprint.exitSpecs.length === 0) {
        warnings.push(`level ${options.level} has no exit spec`);
    }
    if (blueprint.objectiveId === 'defeat_boss' && blueprint.bossId == null && bossPairCount === 0) {
        warnings.push(`level ${options.level} has defeat_boss objective without a boss budget`);
    }
    if (blueprint.objectiveId === 'claim_route' && routePairCount === 0 && blueprint.exitSpecs.length === 0) {
        warnings.push(`level ${options.level} has claim_route objective without a gateway or exit`);
    }

    return {
        level: options.level,
        floorTag: encounter.floorTag,
        floorArchetypeId: encounter.floorArchetypeId,
        dungeonNodeKind: encounter.nodeKind,
        pairCapacity,
        pairedCardCount,
        singletonUtilityCount,
        threatPairCount,
        rewardPairCount,
        utilityPairCount,
        lockPairCount,
        routePairCount,
        bossPairCount,
        objectiveId: blueprint.objectiveId,
        bossId: blueprint.bossId,
        cardKindCounts,
        warnings
    };
};
