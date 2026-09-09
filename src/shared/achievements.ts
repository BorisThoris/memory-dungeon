import type { AchievementId, RunState, SaveData } from './contracts';
import { ACHIEVEMENT_CATALOG, type AchievementCodexEntry } from './mechanics-encyclopedia';
import { runRecord } from './run-record-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { ENDLESS_CYCLE_FLOOR_COUNT } from './floor-mutator-schedule';
import { ACHIEVEMENT_IDS } from './save-data';
import { normalizeSessionStats, TILE_TRAIT_COUNT_KINDS } from './session-stats-rules';

/** Run-score milestones, in points. Named for the Codex copy and the tests; the ids they unlock are older than the numbers. */
export const SCORE_MILESTONE_FIRST = 10_000;
export const SCORE_MILESTONE_SECOND = 100_000;

export type AchievementDefinition = AchievementCodexEntry;

/** Pairs one break has to take for Sixfold: a Fever halo on a clumped board does it (see the reachability test). */
export const CHUNK_SIX_PAIRS = 6;

/** A ripple worth an achievement: the pop, a partner's clump, and that partner's clump. */
export const CHAIN_REACTION_WAVES = 3;

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

    /*
     * Gen 181: the score milestones are a new record season. Under multiplicative scoring and the
     * floor-end bonus a clean player banks about a thousand by floor two and ten thousand by floor
     * seven, so the two milestones sit at ten and a hundred thousand - mid-run and deep-run - and
     * keep their ids, which are Steam API names and never change.
     */
    if (stats.totalScore >= SCORE_MILESTONE_FIRST && !saveData.achievements.ACH_SCORE_THOUSAND) {
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

    /*
     * The rules below point at the rest of the game. Each reads state the run already carries, so
     * none of them needs its own counter: a player who never draws a warden simply never trips the
     * warden one, and the achievement list on the store page is what tells them it is there.
     */
    const award = (id: AchievementId, earned: boolean): void => {
        if (earned && !saveData.achievements[id]) {
            unlocked.push(id);
        }
    };

    award('ACH_ENDLESS_CYCLE', run.gameMode === 'endless' && stats.highestLevel >= ENDLESS_CYCLE_FLOOR_COUNT);
    award('ACH_ENDLESS_TWENTY', run.gameMode === 'endless' && stats.highestLevel >= 20);
    award('ACH_SCORE_TEN_THOUSAND', stats.totalScore >= SCORE_MILESTONE_SECOND);
    award('ACH_STREAK_TEN', runNonNegativeInteger(stats.bestStreak) >= 10);
    // Every trait kind matched at least once. Five of nine used to be enough; with four kinds left
    // the scholar has to have met all of them.
    award(
        'ACH_TRAIT_SCHOLAR',
        TILE_TRAIT_COUNT_KINDS.every((kind) => runNonNegativeInteger(stats.tileTraitMatches?.[kind]) > 0)
    );
    award('ACH_NO_POWERS_TEN', runNonNegativeInteger(saveData.playerStats?.bestFloorNoPowers) >= 10);
    // The chain loop's own four: reached through play a fixture proves (achievement-reachability.test.ts).
    award('ACH_FIRST_FEVER', runNonNegativeInteger(run.feverBreaksThisRun) >= 1);
    award('ACH_CHUNK_SIX', runNonNegativeInteger(run.biggestChunkPairs) >= CHUNK_SIX_PAIRS);
    award('ACH_EXTREME_FEVER', run.lastLevelResult?.momentumBonusTier === 'fever');
    award('ACH_NOTHING_HELD_IT', runNonNegativeInteger(run.chunkDropsThisRun) >= 1);
    award('ACH_CHAIN_REACTION', runNonNegativeInteger(run.bestRippleThisRun) >= CHAIN_REACTION_WAVES);

    return unlocked;
};
