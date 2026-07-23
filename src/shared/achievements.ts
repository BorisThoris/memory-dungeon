import type { AchievementId, RunState, SaveData } from './contracts';
import { ACHIEVEMENT_CATALOG, type AchievementCodexEntry } from './mechanics-encyclopedia';
import { runNonNegativeInteger } from './run-number-guards';
import { ACHIEVEMENT_IDS } from './save-data';
import { normalizeSessionStats } from './session-stats-rules';

export type AchievementDefinition = AchievementCodexEntry;

/** Re-export encyclopedia copy (single source of truth). */
export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDefinition> = ACHIEVEMENT_CATALOG;

export const ACHIEVEMENTS: AchievementDefinition[] = ACHIEVEMENT_IDS.map((id) => ACHIEVEMENT_BY_ID[id]);

export interface AchievementProgressRow {
    id: AchievementId;
    earned: boolean;
}

export interface AchievementProgressSummary {
    earned: number;
    total: number;
}

const achievementStateRecord = (input: unknown): Record<string, unknown> =>
    input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};

export const getAchievementProgressRows = (input: unknown): AchievementProgressRow[] => {
    const state = achievementStateRecord(input);
    return ACHIEVEMENT_IDS.map((id) => ({ id, earned: state[id] === true }));
};

export const getAchievementProgressSummary = (input: unknown): AchievementProgressSummary => {
    const rows = getAchievementProgressRows(input);
    return {
        earned: rows.filter((row) => row.earned).length,
        total: rows.length
    };
};

export const evaluateAchievementUnlocks = (run: RunState, saveData: SaveData): AchievementId[] => {
    if (!run.achievementsEnabled) {
        return [];
    }

    const unlocked: AchievementId[] = [];
    const stats = normalizeSessionStats(run.stats);

    if (stats.levelsCleared >= 1 && !saveData.achievements.ACH_FIRST_CLEAR) {
        unlocked.push('ACH_FIRST_CLEAR');
    }

    if (stats.highestLevel >= 5 && !saveData.achievements.ACH_LEVEL_FIVE) {
        unlocked.push('ACH_LEVEL_FIVE');
    }

    if (stats.totalScore >= 1000 && !saveData.achievements.ACH_SCORE_THOUSAND) {
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
        stats.highestLevel >= 10 &&
        !saveData.achievements.ACH_ENDLESS_TEN
    ) {
        unlocked.push('ACH_ENDLESS_TEN');
    }

    if (runNonNegativeInteger(saveData.playerStats?.dailiesCompleted) >= 7 && !saveData.achievements.ACH_SEVEN_DAILIES) {
        unlocked.push('ACH_SEVEN_DAILIES');
    }

    return unlocked;
};
