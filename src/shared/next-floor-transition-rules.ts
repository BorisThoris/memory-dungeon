import type { LearnedRuleId } from './contracts';
import { pickLearnedRule, preferredSuitFor } from './learned-rule-rules';
import { dealSleepers, sleeperCountFor } from './sleeper-rules';
import { dreadComposes, dreadPurchase, NO_DREAD_PURCHASE } from './dread-composition-rules';
import { dreadForRun } from './dread-rules';
import { hasEvolution } from './relic-evolution-rules';
import { dealMasks, maskCountFor, unmaskBoard } from './mask-rules';
import { dealLayers } from './board-layers-rules';
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
import { dealWanderers, wandererCountFor } from './wanderer-rules';
import { foldBoard } from './board-fold-rules';
import { nextDescentLevel, settleDescentJump } from './descent-pace-rules';
import { runGateOmens } from './run-signature-rules';
import { dealMatchRule, matchRuleFor, THREES_KEEP_RECIPES_FROM } from './match-rule-rules';
import { SNOWBALL_RELICS_FROM } from './snowball-relic-rules';
import { featuredRecipeElementPairKeys } from './secondary-objective-rules';
import { descentLengthFor } from './descent-length-rules';

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

    // From rules 100 the stop is the player's (`snowball-relic-rules.ts`): they buy at it, and nothing buys for them here.
    const transitionRun = (run.runRulesVersion ?? 0) >= SNOWBALL_RELICS_FROM ? run : automaticCampReward(run).run;

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
    // Then, on the Deep's floors, the second deck under half the cells (`board-layers-rules.ts`).
    const seeded = { runSeed: run.runSeed, rulesVersion: run.runRulesVersion };
    // The run's omens (`run-signature-rules.ts`): the families that walk its Gate early.
    const omens = runGateOmens(run);
    // Then, from the Deep, the masks on cards the others left plain (`mask-rules.ts`); the Unmasking Glass drops them at once.
    // From the Abyss, the Sleepers (`sleeper-rules.ts`), on pairs the others left plain. A learned rule
    // (`learned-rule-rules.ts`) chooses which element one of the three dealers lands on, never how many.
    const learnedRule = pickLearnedRule(run, bossBoard.level);
    const prefer = (id: LearnedRuleId) => ({ ...seeded, omens, preferSuit: preferredSuitFor(learnedRule, id) });
    const depth = run.depth ?? 0;
    // The Dread spends (`dread-composition-rules.ts`): from Awake it buys more of the families the schedule deals.
    const dreadBought = dreadComposes(run)
        ? dreadPurchase(dreadForRun({ ...run, ...realmEntry.fields, board: bossBoard }), {
              sleeper: sleeperCountFor(bossBoard, { ...seeded, depth }),
              mask: maskCountFor(bossBoard, { ...seeded, depth }),
              wanderer: wandererCountFor(bossBoard, { ...seeded, depth })
          })
        : NO_DREAD_PURCHASE;
    const masked = dealSleepers(
        dealMasks(dealWanderers(dealOddCards(bossBoard, seeded), { ...prefer('wandering_suit'), depth, extra: dreadBought.wanderer }), { ...prefer('masked_suit'), depth, extra: dreadBought.mask }),
        { ...prefer('sleeping_suit'), depth, extra: dreadBought.sleeper }
    );
    const layered = dealLayers(hasEvolution(run, 'unmasking_glass') ? unmaskBoard(masked) : masked, seeded);
    // The floor's match rule (`match-rule-rules.ts`, rules 94): dealt last, on the pairs the others left plain.
    // From rules 99 a three leaves the floor's featured recipe whole: its pairs are the goal the floor was dealt for. The recipe
    // is read off the board by element (`featuredRecipePairKeys`), so a three keeps off every pair of the recipe's elements.
    const recipeKept = run.runRulesVersion >= THREES_KEEP_RECIPES_FROM ? featuredRecipeElementPairKeys(layered) : new Set<string>();
    const nextBoard = dealMatchRule(layered, matchRuleFor(run.runSeed, run.runRulesVersion, layered.level, layered.floorTag, descentLengthFor(run.runRulesVersion)), run.runSeed, recipeKept);
    const runForNextMemorize: RunState = { ...transitionRun, activeMutators: nextActiveMutators, board: nextBoard };
    const baseMemorizeMs = getMemorizeDurationForRun(runForNextMemorize, nextBoard.level);

    const freshRecipe = run.runRulesVersion >= 64 && (nextFeaturedObjectiveId === 'amplified_reaction' || nextFeaturedObjectiveId === 'calm_reaction');
    const bought = dreadBought.sleeper + dreadBought.mask + dreadBought.wanderer > 0 ? dreadBought : null;
    const next = createNextFloorRunState({ ...transitionRun, ...realmEntry.fields, learnedRule, dreadBought: bought,
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
