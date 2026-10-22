import { depthHas } from './depth-rules';
import { sealSpiralRings, spiralHolds } from './spiral-rules';
import { SLEEPER_RULES_FROM, wakeAllSleepers } from './sleeper-rules';
import { applyBossReward, offersBossDoors } from './boss-reward-rules';
import { hasRelic, misersPurseGold } from './run-relic-rules';
import { settleEndlessRent } from './endless-rent-rules';
import { isWardenFloor, wardenDealsAgain, wardenTestHolds } from './warden-rules';
import type { BoardState, RunState } from './contracts';
import { getFloorClearLevelResultTags } from './secondary-objectives';
import { calculateRating } from './scoring-rules';
import { EXTREME_FEVER_BONUS_TAG, getFloorClearMomentumBonus } from './floor-clear-momentum-bonus-rules';
import {
    calculateFloorClearBonus,
    calculateFloorClearScore,
    createFloorClearLevelResult
} from './level-clear-rules';
import { parTurnsForBoard, turnsTakenThisFloor } from './floor-par';
import { getFloorClearObjectiveResult } from './secondary-objective-rules';
import { clearResolveState } from './run-timer-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { getChainTier, higherChainTier, runChainMomentumPairs, runLadderChain } from './chain-tier-rules';
import { floorClearGold, isStoreStopFloor, rollStoreStock, runGold } from './run-store-rules';
import { realmClearGold, rollRealmDoors, runRealmId, runRealmSecondaryId, runRealmSeverity } from './realm-rules';
import { realmAttunementLevel, realmCarryoverAtClear } from './realm-carryover-rules';
import { usesCampUpgrades } from './run-relic-rules';
import { addEssence, floorElementalDrops, usesElementalLoot } from './elemental-loot-rules';

export const finalizeLevel = (run: RunState, clearedBoard: BoardState): RunState => {
    if (run.status === 'levelComplete' && run.lastLevelResult?.level === clearedBoard.level) return run;
    // The Spiral (`spiral-rules.ts`): a board emptied before par seals its live ring and is dealt inside it;
    // the floor ends only at par or with the last ring.
    const spiral = spiralHolds(run, clearedBoard);
    if (spiral && !run.spiralSurvived) {
        const sealed = sealSpiralRings(clearedBoard, { seed: `spiral-clear:${Math.floor(run.runSeed)}:${run.runRulesVersion}:${clearedBoard.level}:${run.turnsThisFloor}`, heldSeedIds: run.heldSeedIds });
        if (sealed.ringsLeft) {
            return {
                ...run,
                status: 'playing',
                board: { ...sealed.board, flippedTileIds: [] },
                spiralRingsSealedThisFloor: runNonNegativeInteger(run.spiralRingsSealedThisFloor) + sealed.sealed
            };
        }
    }
    // Sleepers (`sleeper-rules.ts`): a board cleared with a pair asleep wakes it, and the floor goes on.
    if (!spiral && (run.runRulesVersion ?? 0) >= SLEEPER_RULES_FROM && (run.sleepingPairs ?? []).length > 0) {
        const woken = wakeAllSleepers(run, clearedBoard);
        return { ...woken.run, status: 'playing', board: { ...woken.board, flippedTileIds: [] } };
    }
    // The complete Warden (DGE-023): behind the wild or raging door, a board cleared without the release of
    // twelve is dealt again, and the floor goes on (`warden-rules.ts`).
    if (wardenTestHolds({ ...run, board: clearedBoard }) && !run.wardenFelled) {
        const dealt = runNonNegativeInteger(run.wardenDealsAgainThisFloor);
        return {
            ...run,
            status: 'playing',
            board: { ...wardenDealsAgain(clearedBoard, `warden-deal:${Math.floor(run.runSeed)}:${run.runRulesVersion}:${clearedBoard.level}:${dealt}`), flippedTileIds: [] },
            wardenDealsAgainThisFloor: dealt + 1
        };
    }
    const elementalDrops = floorElementalDrops(run, clearedBoard.level);
    const board: BoardState = { ...clearedBoard, flippedTileIds: [] };
    const stats = normalizeSessionStats(run.stats);
    const tries = runNonNegativeInteger(stats.tries);
    const currentLevelScoreBeforeClear = runNonNegativeInteger(stats.currentLevelScore);
    const totalScoreBeforeClear = runNonNegativeInteger(stats.totalScore);
    const perfect = tries === 0;
    const floorClearObjective = getFloorClearObjectiveResult(run, board);
    const bonusTags: string[] = [...floorClearObjective.bonusTags];
    const objectiveBonus = floorClearObjective.objectiveBonus;
    const featuredObjectiveId = floorClearObjective.featuredObjectiveId;
    const featuredObjectiveCompleted = floorClearObjective.featuredObjectiveCompleted;
    const featuredObjectiveClear = floorClearObjective.featuredObjectiveClear;

    // Extreme Fever: the momentum still standing when the last pair went is the tier the floor
    // clears at, and it multiplies the floor-end bonus. Read before the streak resets with the
    // floor, never from the score.
    const momentumBonus = getFloorClearMomentumBonus({
        chain: runLadderChain({ ...run, stats }),
        cascadedPairs: runChainMomentumPairs(run),
        pairsOnFloor: board.pairCount
    });
    const parTurns = parTurnsForBoard(board);
    const turnsTaken = turnsTakenThisFloor(run);
    const floorBonus = calculateFloorClearBonus({
        level: board.level,
        tier: momentumBonus.tier,
        parTurns,
        turnsTaken
    });
    const clearScore = calculateFloorClearScore({
        currentLevelScore: currentLevelScoreBeforeClear,
        featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
        floorBonus,
        floorTag: board.floorTag,
        objectiveBonus
    });
    const scoreGained = clearScore.scoreGained;
    if (board.floorTag === 'boss') {
        bonusTags.push('boss_floor');
    }
    bonusTags.push(...getFloorClearLevelResultTags(run, perfect));
    const bankedScoreBeforeClear = Math.max(0, totalScoreBeforeClear - currentLevelScoreBeforeClear);
    const totalScore = bankedScoreBeforeClear + scoreGained;
    const bestScore = Math.max(runNonNegativeInteger(stats.bestScore), totalScore);
    const rating = calculateRating(tries);
    if (momentumBonus.tier === 'fever') {
        bonusTags.push(EXTREME_FEVER_BONUS_TAG);
    }
    // The floor's chain record: the deepest rung the ladder showed on it, against this floor's
    // rungs. The run counts floors, not breaks, so a quest can ask for three floors. Read from the
    // momentum peak the HUD drew; the streak reading stays as the floor for runs saved before the
    // peak was kept, and the clear's own momentum tier because it has just paid that rung's bonus.
    const floorChainTier = higherChainTier(
        higherChainTier(run.peakChainTierThisFloor, momentumBonus.tier),
        getChainTier(runNonNegativeInteger(run.bestChainThisFloor), board.pairCount)
    );
    // What the clear pays into the purse: the rung it cleared at and the turns it came in under.
    // A realm's weather multiplies it: the harder the door the floor was entered by, the more it pays.
    const realmId = runRealmId(run);
    const goldDoubled = hasRelic(run, 'misers_purse');
    const goldEarned = misersPurseGold(
        run,
        realmClearGold(
            floorClearGold({ tier: momentumBonus.tier, turnsUnderPar: floorBonus.turnsUnderPar }),
            realmId ? runRealmSeverity(run) : null,
            runRealmSecondaryId(run) != null,
            realmAttunementLevel(run, realmId)
        )
    );
    // What the floor sends on: smoke, chill, and the attunement a clean clear earned.
    const carryover = realmCarryoverAtClear(run, realmId, turnsTaken, parTurns);
    const lastLevelResult = createFloorClearLevelResult({
        bonusTags,
        featuredObjectiveCompleted,
        featuredObjectiveId,
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
        floorBonus,
        level: board.level,
        mistakes: tries,
        momentumBonus,
        objectiveBonusScore: objectiveBonus,
        parTurns,
        perfect,
        playScore: currentLevelScoreBeforeClear,
        rating,
        run,
        scoreGained,
        turnsTaken
    });

    const bossDoors = offersBossDoors(run);
    // Endless's rent (`endless-rent-rules.ts`): a clear that paid less than it owed ends the run here.
    // An act boss's reward first, for the severity it was met at (`boss-reward-rules.ts`).
    return settleEndlessRent(applyBossReward({
        ...run,
        clearedTurnsRelativeToPar: (run.clearedTurnsRelativeToPar ?? 0) + turnsTaken - parTurns,
        status: 'levelComplete',
        // The Warden cleared (`warden-rules.ts`): the store ends the run as a win when it continues.
        ...(isWardenFloor(board) ? { wardenOutcome: 'cleared' as const } : {}),
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        board,
        pinnedTileIds: [],
        peekRevealedTileIds: [],
        flashPairRevealedTileIds: [],
        stickyBlockIndex: null,
        sharpFloorsThisRun:
            runNonNegativeInteger(run.sharpFloorsThisRun) +
            (floorChainTier === 'sharp' || floorChainTier === 'fever' ? 1 : 0),
        feverFloorsThisRun: runNonNegativeInteger(run.feverFloorsThisRun) + (floorChainTier === 'fever' ? 1 : 0),
        stats: {
            ...stats,
            totalScore,
            bestScore,
            currentLevelScore: scoreGained,
            rating,
            levelsCleared: runNonNegativeInteger(stats.levelsCleared) + 1,
            highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), board.level),
            perfectClears: perfect
                ? runNonNegativeInteger(stats.perfectClears) + 1
                : runNonNegativeInteger(stats.perfectClears)
        },
        peakChainTierThisRun: higherChainTier(run.peakChainTierThisRun, floorChainTier),
        gold: runGold(run) + goldEarned,
        ...(usesElementalLoot(run) ? { elementalEssence: addEssence(run.elementalEssence, elementalDrops) } : {}),
        // Select the destination once at clear; legacy rules retain their door choices, and from rules 75 the
        // clear before an act boss offers its doors again: the door taken is what the boss pays (`boss-reward-rules.ts`).
        ...(realmId
            ? {
                  // Depth 4 (`depth-rules.ts`): before an act boss, the calm door is wild.
                  realmDoors: usesCampUpgrades(run) && !bossDoors ? null : rollRealmDoors(run.runSeed, board.level, realmId).map((door) => (bossDoors && door.severity === 'calm' && depthHas(run, 'no_calm_door') ? { ...door, severity: 'wild' as const } : door)),
                  nextRealm: usesCampUpgrades(run) && !bossDoors ? rollRealmDoors(run.runSeed, board.level, realmId)[0]! : null,
                  realmFloorsThisRun: { ...(run.realmFloorsThisRun ?? {}), [realmId]: runNonNegativeInteger(run.realmFloorsThisRun?.[realmId] ?? 0) + 1 },
                  realmSmoke: carryover.realmSmoke,
                  realmChill: carryover.realmChill,
                  realmAttunement: carryover.realmAttunement,
                  realmLitTileIds: []
              }
            : {}),
        // The stop's shelves are stocked as it opens, from the seed and the floor.
        ...(isStoreStopFloor(board.level) ? { storeStock: rollStoreStock(run.runSeed, board.level, run.relics ?? [], run.runRulesVersion) } : {}),
        timerState: clearResolveState(run),
        lastLevelResult: {
            ...lastLevelResult,
            goldEarned,
            ...(goldDoubled && goldEarned > 0 ? { goldDoubled: true } : {}),
            ...(usesElementalLoot(run) ? { elementalDrops } : {}),
            ...(floorChainTier === 'none' ? {} : { chainTier: floorChainTier }),
            ...(realmId
                ? {
                      realmId,
                      ...(carryover.attuned ? { realmAttuned: carryover.attuned } : {}),
                      ...(carryover.realmSmoke > 0 ? { realmSmoke: carryover.realmSmoke } : {}),
                      ...(carryover.realmChill > 0 ? { realmChill: carryover.realmChill } : {})
                  }
                : {})
        }
    }, board.level, realmId ? runRealmSeverity(run) : null), scoreGained);
};
