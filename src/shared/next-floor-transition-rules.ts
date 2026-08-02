import {
    type FeaturedObjectiveId,
    type FloorArchetypeId,
    type FloorTag,
    type RunState
} from './contracts';
import {
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from './floor-mutator-schedule';
import {
    floorArchetypeForDungeonNode,
    floorTagForDungeonNode
} from './dungeon-encounter-context-rules';
import {
    createDungeonRunMapState,
    enterSelectedDungeonNode,
    getCurrentDungeonNode
} from './run-map';
import { getRunDungeonMapState } from './dungeon-run-state-rules';
import { createTimerState } from './run-timer-rules';
import { getMemorizeDurationForRun } from './scoring-rules';
import { buildBoard } from './board-build-rules';
import { createNextFloorRunState } from './next-floor-run-state-rules';
import { runMutatorIds } from './relics';
import {
    advanceScoreParasiteFloor,
    type ScoreParasiteFloorAdvance
} from './score-parasite-rules';

export interface AdvanceToNextLevelOptions {
    parasiteAdvance?: ScoreParasiteFloorAdvance;
    resolveHazardBanish?: boolean;
}

export const advanceToNextLevel = (
    run: RunState,
    options: AdvanceToNextLevelOptions = {}
): RunState => {
    if (run.status !== 'levelComplete' || !run.board) {
        return run;
    }

    if (run.lives <= 0) {
        return {
            ...run,
            status: 'gameOver',
            lives: 0,
            pendingRouteCardPlan: null,
            sideRoom: null,
            relicOffer: null,
            lastLevelResult: run.lastLevelResult
                ? { ...run.lastLevelResult, livesRemaining: 0 }
                : run.lastLevelResult,
            timerState: createTimerState()
        };
    }

    if (run.gameMode === 'puzzle' || run.sideRoom || run.relicOffer) {
        return run;
    }

    const nextLevelNum = run.board.level + 1;
    const currentDungeonRun = getRunDungeonMapState(run);
    const enteredDungeonRun = enterSelectedDungeonNode(currentDungeonRun);
    const nextDungeonRun =
        enteredDungeonRun.currentFloor === nextLevelNum
            ? enteredDungeonRun
            : createDungeonRunMapState(run.runSeed, run.runRulesVersion, nextLevelNum);
    const enteredDungeonNode = getCurrentDungeonNode(enteredDungeonRun);
    const selectedDungeonNode = enteredDungeonRun.currentFloor === nextLevelNum ? enteredDungeonNode : null;
    let nextActiveMutators = runMutatorIds(run.activeMutators);
    let nextFloorTag: FloorTag = 'normal';
    let nextFloorArchetypeId: FloorArchetypeId | null = null;
    let nextFeaturedObjectiveId: FeaturedObjectiveId | null = null;
    let nextCycleFloor: number | null = null;
    if (usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) && !run.wildMenuRun) {
        const entry = pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, nextLevelNum, run.gameMode);
        nextActiveMutators = entry.mutators;
        nextFloorTag = entry.floorTag;
        nextFloorArchetypeId = entry.floorArchetypeId;
        nextFeaturedObjectiveId = entry.featuredObjectiveId;
        nextCycleFloor = entry.cycleFloor;
    }
    nextFloorTag = floorTagForDungeonNode(selectedDungeonNode?.kind, nextFloorTag);
    nextFloorArchetypeId = floorArchetypeForDungeonNode(selectedDungeonNode?.kind, nextFloorArchetypeId);

    const parasiteAdvance = options.parasiteAdvance ?? advanceScoreParasiteFloor(run);
    const transitionRun: RunState = {
        ...run,
        lives: parasiteAdvance.lives,
        parasiteFloors: parasiteAdvance.parasiteFloors,
        parasiteWardRemaining: parasiteAdvance.parasiteWardRemaining
    };
    const parasiteFloors = transitionRun.parasiteFloors;
    const lives = transitionRun.lives;
    const nextParasiteWard = transitionRun.parasiteWardRemaining;

    if (lives <= 0) {
        return {
            ...transitionRun,
            status: 'gameOver',
            lives: 0,
            parasiteFloors,
            parasiteWardRemaining: nextParasiteWard,
            pendingRouteCardPlan: null,
            sideRoom: null,
            relicOffer: null,
            lastLevelResult: run.lastLevelResult
                ? { ...run.lastLevelResult, livesRemaining: 0 }
                : run.lastLevelResult,
            timerState: createTimerState()
        };
    }

    const nextBoard = buildBoard(nextLevelNum, {
        runSeed: run.runSeed,
        runRulesVersion: run.runRulesVersion,
        activeMutators: nextActiveMutators,
        includeWildTile: run.wildMatchesRemaining > 0,
        floorTag: nextFloorTag,
        floorArchetypeId: nextFloorArchetypeId,
        featuredObjectiveId: nextFeaturedObjectiveId,
        cycleFloor: nextCycleFloor,
        routeCardPlan: run.pendingRouteCardPlan,
        dungeonNodeKind: selectedDungeonNode?.kind,
        gameMode: run.gameMode,
        relicIds: run.relicIds,
        startingLoadoutId: run.startingLoadoutId
    });
    const runForNextMemorize: RunState = { ...transitionRun, activeMutators: nextActiveMutators, board: nextBoard };
    const baseMemorizeMs = getMemorizeDurationForRun(runForNextMemorize, nextBoard.level);
    const memorizeWithBonus = baseMemorizeMs + run.pendingMemorizeBonusMs;

    return createNextFloorRunState(transitionRun, {
        lives,
        activeMutators: nextActiveMutators,
        dungeonRun: nextDungeonRun,
        board: nextBoard,
        parasiteFloors,
        parasiteWardRemaining: nextParasiteWard,
        memorizeRemainingMs: memorizeWithBonus
    }, { resolveHazardBanish: options.resolveHazardBanish });
};
