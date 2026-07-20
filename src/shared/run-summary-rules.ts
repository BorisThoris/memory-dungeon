import {
    type AchievementId,
    type RunState
} from './contracts';

const nonNegativeInteger = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const createRunSummary = (run: RunState, unlockedAchievements: AchievementId[]): RunState => ({
    ...run,
    lastRunSummary: (() => {
        const totalScore = nonNegativeInteger(run.stats.totalScore);
        const levelsCleared = nonNegativeInteger(run.stats.levelsCleared);
        const payoffPickupTotal = nonNegativeInteger(run.findablesTotalThisFloor);
        return {
            totalScore,
            bestScore: Math.max(nonNegativeInteger(run.stats.bestScore), totalScore),
            levelsCleared,
            highestLevel: nonNegativeInteger(run.stats.highestLevel),
            achievementsEnabled: run.achievementsEnabled,
            unlockedAchievements,
            bestStreak: nonNegativeInteger(run.stats.bestStreak),
            perfectClears: Math.min(nonNegativeInteger(run.stats.perfectClears), levelsCleared),
            runSeed: nonNegativeInteger(run.runSeed),
            runRulesVersion: nonNegativeInteger(run.runRulesVersion),
            gameMode: run.gameMode,
            dailyDateKeyUtc: run.dailyDateKeyUtc ?? undefined,
            activeMutators: [...run.activeMutators],
            relicIds: [...run.relicIds],
            payoffPickupClaimed: Math.min(nonNegativeInteger(run.findablesClaimedThisFloor), payoffPickupTotal),
            payoffPickupTotal,
            payoffPressureExtra: nonNegativeInteger(run.stats.mismatches) + nonNegativeInteger(run.stats.volatileTraitShuffles),
            payoffRewardPerkCount: nonNegativeInteger(run.rewardPerkIds?.length),
            payoffRoutePaid: run.traitRouteObjectiveCompletedThisFloor || Boolean(run.traitRouteObjectiveRewardClaimedThisFloor),
            payoffRouteRewardText: run.traitRouteObjectiveRewardTextThisFloor,
            startingLoadoutId: run.startingLoadoutId ?? null,
            practiceMode: run.practiceMode,
            wildMenuRun: run.wildMenuRun,
            dungeonShowcaseRun: run.dungeonShowcaseRun,
            activeContract: run.activeContract ? { ...run.activeContract } : null
        };
    })()
});
