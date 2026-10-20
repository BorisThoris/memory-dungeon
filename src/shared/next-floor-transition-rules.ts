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
    runFollowsFloorSchedule,
    scheduledFloorMutators
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
import { dealWanderers } from './wanderer-rules';
import { foldBoard } from './board-fold-rules';
import { nextDescentLevel, settleDescentJump } from './descent-pace-rules';

export const advanceToNextLevel = (run: RunState): RunState => {
    if (run.status !== 'levelComplete' || !run.board) {
        return run;
    }

    // The next floor, or the next rung of the test pace's ladder (`descent-pace-rules.ts`).
    const nextLevelNum = nextDescentLevel(run);
    let nextActiveMutators = runArray<MutatorId>(run.activeMutators);
    let nextFloorTag: FloorTag = 'normal';
    let nextFloorArchetypeId: FloorArchetypeId | null = null;
    let nextFeaturedObjectiveId: FeaturedObjectiveId | null = null;
    let nextCycleFloor: number | null = null;
    if (runFollowsFloorSchedule(run.gameMode, run.runRulesVersion, run.wildMenuRun === true)) {
        const entry = pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, nextLevelNum, run.gameMode);
        nextActiveMutators = filterMutatorsByContentLock(scheduledFloorMutators(entry.mutators, run.wildMenuRun === true));
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
    // The Fold (`board-fold-rules.ts`): on its floors the board is two rooms, a wall and a doorway, before anything is dealt onto it.
    const foldedBoard = foldBoard(builtBoard, { runSeed: run.runSeed, rulesVersion: run.runRulesVersion });
    const realmEntry = enterRealmFloor(run, foldedBoard, nextFloorRealmDoor(run));
    // The cold a frozen floor sent on: cards that start this one frozen (`realm-carryover-rules.ts`).
    const chilledBoard = applyRealmChill(realmEntry.board, run.realmChill, run.runSeed, run.runRulesVersion);
    // A boss floor's Colossus stands once the deck's elements are final: its cycle is those elements (`colossus-rules.ts`).
    const bossBoard = raiseColossus(chilledBoard, { runSeed: run.runSeed, rulesVersion: run.runRulesVersion });
    // The floor's odd cards, a Turncoat and an Hourglass, on pairs nothing else has marked (`odd-card-rules.ts`).
    // Then the Wanderers, on pairs the odd cards left plain (`wanderer-rules.ts`).
    const nextBoard = dealWanderers(dealOddCards(bossBoard, { runSeed: run.runSeed, rulesVersion: run.runRulesVersion }), {
        runSeed: run.runSeed,
        rulesVersion: run.runRulesVersion
    });
    const runForNextMemorize: RunState = { ...transitionRun, activeMutators: nextActiveMutators, board: nextBoard };
    const baseMemorizeMs = getMemorizeDurationForRun(runForNextMemorize, nextBoard.level);

    const freshRecipe = run.runRulesVersion >= 64 && (nextFeaturedObjectiveId === 'amplified_reaction' || nextFeaturedObjectiveId === 'calm_reaction');
    const next = createNextFloorRunState({ ...transitionRun, ...realmEntry.fields,
        // These rooms open with an empty elemental hand, so an incoming amplified burst
        // cannot consume the recipe before the player has a chance to attempt it.
        ...(freshRecipe ? { elementStreak: null } : {}),
        ...(run.realmChill ? { realmChill: 0 } : {}) }, {
        activeMutators: nextActiveMutators,
        board: nextBoard,
        memorizeRemainingMs: baseMemorizeMs
    });
    // A jump keeps the miss bank's shelf and Dread's counts in floors played, not floor numbers.
    return settleDescentJump(run, next);
};
