import {
    MAX_LIVES,
    type BoardState,
    type RunState
} from './contracts';
import { getFloorClearLevelResultTags } from './secondary-objectives';
import { calculateRating } from './scoring-rules';
import {
    applyMomentumBonusShards,
    EXTREME_FEVER_BONUS_TAG,
    getFloorClearMomentumBonus
} from './floor-clear-momentum-bonus-rules';
import {
    calculateFloorClearBonus,
    calculateFloorClearScore,
    createFloorClearLevelResult,
    getClearLifeReason
} from './level-clear-rules';
import { parTurnsForFloor, turnsTakenThisFloor } from './floor-par';
import { getFloorClearObjectiveResult } from './secondary-objective-rules';
import { clearResolveState } from './run-timer-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { getChainTier } from './chain-tier-rules';

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
    const objectiveBonus = floorClearObjective.objectiveBonus;
    const featuredObjectiveId = floorClearObjective.featuredObjectiveId;
    const featuredObjectiveCompleted = floorClearObjective.featuredObjectiveCompleted;
    const featuredObjectiveClear = floorClearObjective.featuredObjectiveClear;

    // Extreme Fever: the momentum still standing when the last pair went is the tier the floor
    // clears at, and it multiplies the floor-end bonus. Read before the streak resets with the
    // floor, never from the score.
    const momentumBonus = getFloorClearMomentumBonus({
        chain: stats.currentStreak,
        cascadedPairs: run.chunkPairsThisChain,
        pairsOnFloor: board.pairCount
    });
    const parTurns = parTurnsForFloor(board.pairCount);
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
    const lives = Math.min(MAX_LIVES, livesBeforeClear + clearLifeGained);
    if (momentumBonus.tier === 'fever') {
        bonusTags.push(EXTREME_FEVER_BONUS_TAG);
    }
    // The floor's chain record: the deepest rung its longest chain reached, against this
    // floor's ladder. The run counts floors, not breaks, so a quest can ask for three floors.
    const floorChainTier = getChainTier(runNonNegativeInteger(run.bestChainThisFloor), board.pairCount);
    const lastLevelResult = createFloorClearLevelResult({
        bonusTags,
        clearLifeGained,
        clearLifeReason,
        featuredObjectiveCompleted,
        featuredObjectiveId,
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
        floorBonus,
        level: board.level,
        livesRemaining: lives,
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

    return {
        ...run,
        status: 'levelComplete',
        lives,
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
