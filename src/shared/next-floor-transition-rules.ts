import {
    type FeaturedObjectiveId,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId,
    type RunState
} from './contracts';
import { filterMutatorsByContentLock } from './content-lock-state';
import {
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from './floor-mutator-schedule';
import { getMemorizeDurationForRun } from './scoring-rules';
import { buildBoard } from './board-build-rules';
import { createNextFloorRunState } from './next-floor-run-state-rules';
import { runArray } from './run-array-guards';

export const advanceToNextLevel = (run: RunState): RunState => {
    if (run.status !== 'levelComplete' || !run.board) {
        return run;
    }

    const nextLevelNum = run.board.level + 1;
    let nextActiveMutators = runArray<MutatorId>(run.activeMutators);
    let nextFloorTag: FloorTag = 'normal';
    let nextFloorArchetypeId: FloorArchetypeId | null = null;
    let nextFeaturedObjectiveId: FeaturedObjectiveId | null = null;
    let nextCycleFloor: number | null = null;
    if (usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) && !run.wildMenuRun) {
        const entry = pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, nextLevelNum, run.gameMode);
        nextActiveMutators = filterMutatorsByContentLock(entry.mutators);
        nextFloorTag = entry.floorTag;
        nextFloorArchetypeId = entry.floorArchetypeId;
        nextFeaturedObjectiveId = entry.featuredObjectiveId;
        nextCycleFloor = entry.cycleFloor;
    }

    const transitionRun: RunState = run;

    const nextBoard = buildBoard(nextLevelNum, {
        runSeed: run.runSeed,
        runRulesVersion: run.runRulesVersion,
        activeMutators: nextActiveMutators,
        includeWildTile: run.wildMatchesRemaining > 0,
        floorTag: nextFloorTag,
        floorArchetypeId: nextFloorArchetypeId,
        featuredObjectiveId: nextFeaturedObjectiveId,
        cycleFloor: nextCycleFloor,
        gameMode: run.gameMode
    });
    const runForNextMemorize: RunState = { ...transitionRun, activeMutators: nextActiveMutators, board: nextBoard };
    const baseMemorizeMs = getMemorizeDurationForRun(runForNextMemorize, nextBoard.level);

    return createNextFloorRunState(transitionRun, {
        activeMutators: nextActiveMutators,
        board: nextBoard,
        memorizeRemainingMs: baseMemorizeMs
    });
};
