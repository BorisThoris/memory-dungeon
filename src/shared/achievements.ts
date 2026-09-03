import type { AchievementId, RunState, SaveData } from './contracts';
import { ACHIEVEMENT_CATALOG, type AchievementCodexEntry } from './mechanics-encyclopedia';
import { runRecord } from './run-record-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { ENDLESS_CYCLE_FLOOR_COUNT } from './floor-mutator-schedule';
import { STANDING_RULE_RELIC_IDS } from './relics';
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

export const getAchievementProgressRows = (input: unknown): AchievementProgressRow[] => {
    const state = runRecord(input);
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

    /*
     * The rules below point at the rest of the game. Each reads state the run already carries, so
     * none of them needs its own counter: a player who never opens Gauntlet simply never trips the
     * Gauntlet one, and the achievement list on the store page is what tells them it is there.
     */
    const award = (id: AchievementId, earned: boolean): void => {
        if (earned && !saveData.achievements[id]) {
            unlocked.push(id);
        }
    };
    const relicIds = Array.isArray(run.relicIds) ? run.relicIds : [];

    award('ACH_WARDEN_FELLED', run.lastLevelResult?.bossTrophyCacheOutcome === 'claimed');
    award('ACH_ENDLESS_CYCLE', run.gameMode === 'endless' && stats.highestLevel >= ENDLESS_CYCLE_FLOOR_COUNT);
    award('ACH_ENDLESS_TWENTY', run.gameMode === 'endless' && stats.highestLevel >= 20);
    award('ACH_SCORE_TEN_THOUSAND', stats.totalScore >= 10_000);
    award('ACH_STREAK_TEN', runNonNegativeInteger(stats.bestStreak) >= 10);
    award(
        'ACH_TRAIT_SCHOLAR',
        Object.values(stats.tileTraitMatches ?? {}).filter((count) => runNonNegativeInteger(count) > 0).length >= 5
    );
    award('ACH_RELIC_HOARD', relicIds.length >= 6);
    award('ACH_STANDING_ORDERS', relicIds.filter((id) => STANDING_RULE_RELIC_IDS.has(id)).length >= 3);
    award(
        'ACH_RELIC_LIBRARY',
        Object.values(saveData.playerStats?.relicPickCounts ?? {}).filter((count) => runNonNegativeInteger(count) > 0)
            .length >= 12
    );
    award('ACH_NO_POWERS_TEN', runNonNegativeInteger(saveData.playerStats?.bestFloorNoPowers) >= 10);
    award('ACH_GAUNTLET_RUN', run.gameMode === 'gauntlet' && stats.levelsCleared >= 3);
    award('ACH_PUZZLE_SOLVER', Object.keys(saveData.playerStats?.puzzleCompletions ?? {}).length >= 5);
    award('ACH_MEDITATION_HOUR', run.gameMode === 'meditation' && stats.levelsCleared >= 8);

    return unlocked;
};
