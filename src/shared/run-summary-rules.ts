import {
    type AchievementId,
    type MutatorId,
    type RunState
} from './contracts';
import { runArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';
import { getGameplayJournalSummaryFields } from './gameplay-journal';
import { normalizeSaveData } from './save-data';

export const createRunSummary = (run: RunState, unlockedAchievements: AchievementId[]): RunState => ({
    ...run,
    lastRunSummary: (() => {
        const stats = normalizeSessionStats(run.stats);
        const totalScore = stats.totalScore;
        const levelsCleared = stats.levelsCleared;
        const payoffPickupTotal = runNonNegativeInteger(run.findablesTotalThisFloor);
        return {
            totalScore,
            bestScore: Math.max(stats.bestScore, totalScore),
            levelsCleared,
            highestLevel: stats.highestLevel,
            achievementsEnabled: run.achievementsEnabled,
            unlockedAchievements,
            bestStreak: stats.bestStreak,
            perfectClears: Math.min(stats.perfectClears, levelsCleared),
            biggestChunk: runNonNegativeInteger(run.biggestChunkPairs),
            bestChain: Math.max(runNonNegativeInteger(run.bestChainThisRun), runNonNegativeInteger(run.bestChainThisFloor)),
            bestRipple: Math.max(runNonNegativeInteger(run.bestRippleThisRun), runNonNegativeInteger(run.bestRippleThisFloor)),
            sharpFloors: runNonNegativeInteger(run.sharpFloorsThisRun),
            feverFloors: runNonNegativeInteger(run.feverFloorsThisRun),
            runSeed: runNonNegativeInteger(run.runSeed),
            runRulesVersion: runNonNegativeInteger(run.runRulesVersion),
            gameMode: run.gameMode,
            activeMutators: [...runArray<MutatorId>(run.activeMutators)],
            payoffPickupClaimed: Math.min(runNonNegativeInteger(run.findablesClaimedThisFloor), payoffPickupTotal),
            payoffPickupTotal,
            payoffPressureExtra: stats.mismatches + stats.volatileTraitShuffles,
            practiceMode: run.practiceMode,
            wildMenuRun: run.wildMenuRun,
            activeContract: run.activeContract ? { ...run.activeContract } : null,
            ...getGameplayJournalSummaryFields(run)
        };
    })()
});

/**
 * Terminal game-over transition: forces the terminal status and zeroes lives before
 * building the summary, so callers cannot persist a summary for a run that still
 * reads as playable.
 */
export const createGameOverRunSummary = (run: RunState, unlockedAchievements: AchievementId[]): RunState =>
    createRunSummary({ ...run, status: 'gameOver', lives: 0 }, unlockedAchievements);

/**
 * Same transition, with the summary round-tripped through save normalization so what
 * sits in memory is exactly what a reload would produce. Use this on the real
 * game-over path; the unvalidated variant is for debug and fixture callers that are
 * not about to persist.
 */
export const createValidatedGameOverRunSummary = (
    run: RunState,
    unlockedAchievements: AchievementId[]
): RunState => {
    const terminal = createGameOverRunSummary(run, unlockedAchievements);
    return {
        ...terminal,
        lastRunSummary: normalizeSaveData({ lastRunSummary: terminal.lastRunSummary }).lastRunSummary
    };
};
