import {
    type AchievementId,
    type RunState
} from './contracts';
import { runMutatorIds, runRelicIds } from './relics';
import { runArrayCount } from './run-array-guards';
import { normalizeSessionStats } from './session-stats-rules';

const nonNegativeInteger = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const createRunSummary = (run: RunState, unlockedAchievements: AchievementId[]): RunState => ({
    ...run,
    lastRunSummary: (() => {
        const stats = normalizeSessionStats(run.stats);
        const totalScore = stats.totalScore;
        const levelsCleared = stats.levelsCleared;
        const payoffPickupTotal = nonNegativeInteger(run.findablesTotalThisFloor);
        return {
            totalScore,
            bestScore: Math.max(stats.bestScore, totalScore),
            levelsCleared,
            highestLevel: stats.highestLevel,
            achievementsEnabled: run.achievementsEnabled,
            unlockedAchievements,
            bestStreak: stats.bestStreak,
            perfectClears: Math.min(stats.perfectClears, levelsCleared),
            runSeed: nonNegativeInteger(run.runSeed),
            runRulesVersion: nonNegativeInteger(run.runRulesVersion),
            gameMode: run.gameMode,
            dailyDateKeyUtc: run.dailyDateKeyUtc ?? undefined,
            activeMutators: [...runMutatorIds(run.activeMutators)],
            relicIds: [...runRelicIds(run.relicIds)],
            payoffPickupClaimed: Math.min(nonNegativeInteger(run.findablesClaimedThisFloor), payoffPickupTotal),
            payoffPickupTotal,
            payoffPressureExtra: stats.mismatches + stats.volatileTraitShuffles,
            payoffRewardPerkCount: runArrayCount(run.rewardPerkIds),
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
