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
    enterSelectedDungeonNode,
    getSelectedDungeonNode
} from './run-map';
import { getRunDungeonMapState } from './dungeon-run-state-rules';
import { createTimerState } from './run-timer-rules';
import { getMemorizeDurationForRun } from './scoring-rules';
import { advanceScoreParasiteFloor } from './score-parasite-rules';
import { buildBoard } from './board-build-rules';
import { createNextFloorRunState } from './next-floor-run-state-rules';

export const advanceToNextLevel = (run: RunState): RunState => {
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
    const selectedDungeonNode = getSelectedDungeonNode(currentDungeonRun);
    let nextActiveMutators = [...run.activeMutators];
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

    const parasiteAdvance = advanceScoreParasiteFloor(run);
    const parasiteFloors = parasiteAdvance.parasiteFloors;
    const lives = parasiteAdvance.lives;
    const nextParasiteWard = parasiteAdvance.parasiteWardRemaining;

    if (lives <= 0) {
        return {
            ...run,
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
    const runForNextMemorize: RunState = { ...run, activeMutators: nextActiveMutators, board: nextBoard };
    const baseMemorizeMs = getMemorizeDurationForRun(runForNextMemorize, nextBoard.level);
    const memorizeWithBonus = baseMemorizeMs + run.pendingMemorizeBonusMs;

    return createNextFloorRunState(run, {
        lives,
        activeMutators: nextActiveMutators,
        dungeonRun: enterSelectedDungeonNode(currentDungeonRun),
        board: nextBoard,
        parasiteFloors,
        parasiteWardRemaining: nextParasiteWard,
        memorizeRemainingMs: memorizeWithBonus
    });
};
