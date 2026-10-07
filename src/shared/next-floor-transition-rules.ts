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
import { enterRealmFloor, nextFloorRealmDoor } from './realm-rules';
import { applyRealmChill } from './realm-carryover-rules';
import { automaticCampReward } from './automatic-camp-rules';
import { raiseColossus } from './colossus-rules';
import { dealOddCards } from './odd-card-rules';

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

    const transitionRun = automaticCampReward(run).run;

    const builtBoard = buildBoard(nextLevelNum, {
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
    // The next floor is in the realm the player walked into at the clear (`realm-rules.ts`).
    const realmEntry = enterRealmFloor(run, builtBoard, nextFloorRealmDoor(run));
    // The cold a frozen floor sent on: cards that start this one frozen (`realm-carryover-rules.ts`).
    const chilledBoard = applyRealmChill(realmEntry.board, run.realmChill, run.runSeed, run.runRulesVersion);
    // A boss floor's Colossus stands once the deck's elements are final: its cycle is those elements (`colossus-rules.ts`).
    const bossBoard = raiseColossus(chilledBoard, { runSeed: run.runSeed, rulesVersion: run.runRulesVersion });
    // The floor's odd cards, a Turncoat and an Hourglass, on pairs nothing else has marked (`odd-card-rules.ts`).
    const nextBoard = dealOddCards(bossBoard, { runSeed: run.runSeed, rulesVersion: run.runRulesVersion });
    const runForNextMemorize: RunState = { ...transitionRun, activeMutators: nextActiveMutators, board: nextBoard };
    const baseMemorizeMs = getMemorizeDurationForRun(runForNextMemorize, nextBoard.level);

    return createNextFloorRunState({ ...transitionRun, ...realmEntry.fields, ...(run.realmChill ? { realmChill: 0 } : {}) }, {
        activeMutators: nextActiveMutators,
        board: nextBoard,
        memorizeRemainingMs: baseMemorizeMs
    });
};
