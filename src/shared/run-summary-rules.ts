import {
    type AchievementId,
    type RunState
} from './contracts';

export const createRunSummary = (run: RunState, unlockedAchievements: AchievementId[]): RunState => ({
    ...run,
    lastRunSummary: {
        totalScore: run.stats.totalScore,
        bestScore: run.stats.bestScore,
        levelsCleared: run.stats.levelsCleared,
        highestLevel: run.stats.highestLevel,
        achievementsEnabled: run.achievementsEnabled,
        unlockedAchievements,
        bestStreak: run.stats.bestStreak,
        perfectClears: run.stats.perfectClears,
        runSeed: run.runSeed,
        runRulesVersion: run.runRulesVersion,
        gameMode: run.gameMode,
        dailyDateKeyUtc: run.dailyDateKeyUtc ?? undefined,
        activeMutators: [...run.activeMutators],
        relicIds: [...run.relicIds],
        startingLoadoutId: run.startingLoadoutId ?? null,
        practiceMode: run.practiceMode,
        wildMenuRun: run.wildMenuRun,
        dungeonShowcaseRun: run.dungeonShowcaseRun,
        activeContract: run.activeContract ? { ...run.activeContract } : null
    }
});
