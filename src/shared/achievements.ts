import type { AchievementId, RunState, SaveData } from './contracts';
import { ACHIEVEMENT_CATALOG, type AchievementCodexEntry } from './mechanics-encyclopedia';

export type AchievementDefinition = AchievementCodexEntry;

/** Re-export encyclopedia copy (single source of truth). */
export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDefinition> = ACHIEVEMENT_CATALOG;

const ACHIEVEMENT_ORDER: AchievementId[] = [
    'ACH_FIRST_CLEAR',
    'ACH_LEVEL_FIVE',
    'ACH_SCORE_THOUSAND',
    'ACH_PERFECT_CLEAR',
    'ACH_LAST_LIFE',
    'ACH_ENDLESS_TEN',
    'ACH_SEVEN_DAILIES'
];

export const ACHIEVEMENTS: AchievementDefinition[] = ACHIEVEMENT_ORDER.map((id) => ACHIEVEMENT_BY_ID[id]);

const nonNegativeAchievementCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const evaluateAchievementUnlocks = (run: RunState, saveData: SaveData): AchievementId[] => {
    if (!run.achievementsEnabled) {
        return [];
    }

    const unlocked: AchievementId[] = [];

    if (nonNegativeAchievementCount(run.stats.levelsCleared) >= 1 && !saveData.achievements.ACH_FIRST_CLEAR) {
        unlocked.push('ACH_FIRST_CLEAR');
    }

    if (nonNegativeAchievementCount(run.stats.highestLevel) >= 5 && !saveData.achievements.ACH_LEVEL_FIVE) {
        unlocked.push('ACH_LEVEL_FIVE');
    }

    if (nonNegativeAchievementCount(run.stats.totalScore) >= 1000 && !saveData.achievements.ACH_SCORE_THOUSAND) {
        unlocked.push('ACH_SCORE_THOUSAND');
    }

    if (
        run.lastLevelResult?.perfect &&
        !saveData.achievements.ACH_PERFECT_CLEAR &&
        !run.powersUsedThisRun
    ) {
        unlocked.push('ACH_PERFECT_CLEAR');
    }

    if (run.lastLevelResult?.livesRemaining === 1 && !saveData.achievements.ACH_LAST_LIFE) {
        unlocked.push('ACH_LAST_LIFE');
    }

    if (
        run.gameMode === 'endless' &&
        nonNegativeAchievementCount(run.stats.highestLevel) >= 10 &&
        !saveData.achievements.ACH_ENDLESS_TEN
    ) {
        unlocked.push('ACH_ENDLESS_TEN');
    }

    if (nonNegativeAchievementCount(saveData.playerStats?.dailiesCompleted) >= 7 && !saveData.achievements.ACH_SEVEN_DAILIES) {
        unlocked.push('ACH_SEVEN_DAILIES');
    }

    return unlocked;
};
