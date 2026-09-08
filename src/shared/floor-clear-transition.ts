import {
    GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS,
    MAX_LIVES,
    type BoardState,
    type LevelResult,
    type RunState
} from './contracts';
import { getDungeonLevelResultTags } from './secondary-objectives';
import { calculateRating } from './scoring-rules';
import {
    applyMomentumBonusShards,
    EXTREME_FEVER_BONUS_TAG,
    getFloorClearMomentumBonus
} from './floor-clear-momentum-bonus-rules';
import {
    calculateFloorClearScore,
    createFloorClearLevelResult,
    getClearLifeReason
} from './level-clear-rules';
import { getFloorClearObjectiveResult } from './secondary-objective-rules';
import { clearResolveState, extendTimerTimestampMs } from './run-timer-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { getChainTier } from './chain-tier-rules';

/*
 * The floor-clear relic hooks (the Slayer's boss trophy and parasite relief) and the boss trophy
 * cache went with the relic draft and the dungeon boss; a clear is now the board's own score.
 */
export const finalizeLevel = (run: RunState, clearedBoard: BoardState): RunState => {
    const board: BoardState = { ...clearedBoard, flippedTileIds: [] };
    const stats = normalizeSessionStats(run.stats);
    const tries = runNonNegativeInteger(stats.tries);
    const livesBeforeClear = runNonNegativeInteger(run.lives);
    const currentLevelScoreBeforeClear = runNonNegativeInteger(stats.currentLevelScore);
    const totalScoreBeforeClear = runNonNegativeInteger(stats.totalScore);
    const perfect = tries === 0;
    const clearLifeReason = getClearLifeReason(tries);
    const clearLifeGained = clearLifeReason !== 'none' && livesBeforeClear < MAX_LIVES ? 1 : 0;
    const floorClearObjective = getFloorClearObjectiveResult(run, board);
    const bonusTags: string[] = [...floorClearObjective.bonusTags];
    if (run.traitRouteObjectiveCompletedThisFloor) {
        bonusTags.push('trait_route_objective');
    }
    const objectiveBonus = floorClearObjective.objectiveBonus;
    const featuredObjectiveId = floorClearObjective.featuredObjectiveId;
    const featuredObjectiveCompleted = floorClearObjective.featuredObjectiveCompleted;
    const featuredObjectiveClear = floorClearObjective.featuredObjectiveClear;

    const clearScore = calculateFloorClearScore({
        bossTrophyCacheScore: 0,
        currentLevelScore: currentLevelScoreBeforeClear,
        featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
        floorTag: board.floorTag,
        level: board.level,
        objectiveBonus,
        perfect
    });
    const scoreGained = clearScore.scoreGained;
    if (board.floorTag === 'boss') {
        bonusTags.push('boss_floor');
    }
    bonusTags.push(...getDungeonLevelResultTags(run, board, perfect));
    const bankedScoreBeforeClear = Math.max(0, totalScoreBeforeClear - currentLevelScoreBeforeClear);
    const totalScore = bankedScoreBeforeClear + scoreGained;
    const bestScore = Math.max(runNonNegativeInteger(stats.bestScore), totalScore);
    const rating = calculateRating(tries);
    const lives = Math.min(MAX_LIVES, livesBeforeClear + clearLifeGained);
    // Extreme Fever: the momentum still standing when the last pair went pays a shard at
    // Fever. Read before the streak resets with the floor, never from the score.
    const momentumBonus = getFloorClearMomentumBonus({
        chain: stats.currentStreak,
        cascadedPairs: run.chunkPairsThisChain,
        pairsOnFloor: board.pairCount
    });
    if (momentumBonus.tier === 'fever') {
        bonusTags.push(EXTREME_FEVER_BONUS_TAG);
    }
    // The floor's chain record: the deepest rung its longest chain reached, against this
    // floor's ladder. The run counts floors, not breaks, so a quest can ask for three floors.
    const floorChainTier = getChainTier(runNonNegativeInteger(run.bestChainThisFloor), board.pairCount);
    /*
     * A cleared floor used to offer three doors here - Safe, Greed, Mystery - and the run
     * stopped on a screen until the player picked one. It does not any more: the next board is
     * the next thing that happens.
     *
     * The offer was already measured as no decision at all. Gen 172's profile simulation found
     * a greedy player taking the greedy door on all 144 floors of a run, never paying a safe
     * door's toll, and ending with gold nothing could spend - because greed used to be withheld
     * on the floors the dungeon layer shaped, and with those gone every floor offered the same
     * three doors. A choice that is the same every time is a keypress, and a keypress between
     * two boards is a stop in a loop about momentum.
     *
     * `docs/REMOVED_DUNGEON_LAYER.md` records the route families. Phase 3 puts a decision back
     * between floors, and the thesis is specific that it has to be one the board can see
     * (§X, T3.x) rather than three doors with adjectives on them.
     */
    const routeChoices: LevelResult['routeChoices'] = undefined;
    const lastLevelResult = createFloorClearLevelResult({
        bossTrophyCacheOutcome: undefined,
        bossTrophyCacheScore: 0,
        bonusTags,
        clearLifeGained,
        clearLifeReason,
        featuredObjectiveCompleted,
        featuredObjectiveId,
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
        level: board.level,
        livesRemaining: lives,
        mistakes: tries,
        momentumBonus,
        objectiveBonusScore: objectiveBonus,
        perfect,
        rating,
        routeChoices,
        run,
        scoreGained,
        traitRouteObjectiveCompleted: run.traitRouteObjectiveCompletedThisFloor,
        traitRouteObjectiveProgress: run.traitRouteObjectiveProgressThisFloor,
        traitRouteObjectiveRequired: run.traitRouteObjectiveRequiredThisFloor,
        traitRouteObjectiveReward: run.traitRouteObjectiveRewardTextThisFloor ?? undefined
    });

    return {
        ...run,
        status: 'levelComplete',
        lives,
        /*
         * A cleared floor used to pay three to eight gold and stock a shop for it. There is no
         * shop and nothing to spend on (Gen 174), so the wallet is closed: nought in, nothing
         * offered. The two fields come off the run shape with the save migration in T1.14.
         */
        shopGold: 0,
        shopOffers: [],
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        gauntletDeadlineMs:
            run.gauntletDeadlineMs !== null
                ? extendTimerTimestampMs(run.gauntletDeadlineMs, GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS)
                : run.gauntletDeadlineMs,
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
            comboShards: applyMomentumBonusShards(stats.comboShards, momentumBonus),
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
        timerState: clearResolveState(run),
        lastLevelResult
    };
};
