/**
 * Local-only “honors” (Track 2 meta): titles/badges stored as `saveData.unlocks` tags `honor:<id>`.
 * Does not require Steam Partner slots. See `AchievementId` for Steam trophies.
 */
import type { SaveData } from './contracts';
import { cosmeticUnlockTag, type CosmeticId } from './cosmetics';
import { HONOR_UNLOCK_IDS, type HonorUnlockId } from './honor-unlock-ids';
import { runNonNegativeInteger } from './run-number-guards';
import { getRelicPickTotal, normalizeSaveData } from './save-data';

export { HONOR_UNLOCK_IDS, type HonorUnlockId } from './honor-unlock-ids';

export const HONOR_UNLOCK_PREFIX = 'honor:' as const;

export interface HonorUnlockDefinition {
    id: HonorUnlockId;
    title: string;
    description: string;
}

export const HONOR_UNLOCK_CATALOG: Record<HonorUnlockId, HonorUnlockDefinition> = {
    honor_daily_initiate: {
        id: 'honor_daily_initiate',
        title: 'Daily Initiate',
        description: 'Complete at least one Daily run (UTC day).'
    },
    honor_daily_streak_3: {
        id: 'honor_daily_streak_3',
        title: 'Triple Dawn',
        description: 'Reach a cosmetic daily streak of three UTC days. One missed day is forgiven.'
    },
    honor_daily_streak_7: {
        id: 'honor_daily_streak_7',
        title: 'Week of Days',
        description: 'Reach a cosmetic daily streak of seven UTC days. One missed day is forgiven.'
    },
    honor_ascendant_5: {
        id: 'honor_ascendant_5',
        title: 'Ascendant V',
        description: 'Reach floor five in a run without using disallowed powers (tracked as best no-powers floor).'
    },
    honor_ascendant_10: {
        id: 'honor_ascendant_10',
        title: 'Ascendant X',
        description: 'Reach floor ten in a run without using disallowed powers.'
    },
    honor_score_maestro: {
        id: 'honor_score_maestro',
        title: 'Score Maestro',
        description: 'Reach a best score of at least 2000 across any runs.'
    },
    honor_relic_habit: {
        id: 'honor_relic_habit',
        title: 'Relic Habit',
        description: 'Pick relics at least ten times across runs (milestone offers count).'
    },
    honor_gauntlet_proof: {
        id: 'honor_gauntlet_proof',
        title: 'Gauntlet Proof',
        description: 'Finish a Gauntlet run with at least one floor cleared (last run summary).'
    }
};

/** Stable display order for Collection / UI. */
export const HONOR_UNLOCK_ORDER = HONOR_UNLOCK_IDS;

const HONOR_COSMETIC_UNLOCKS: Partial<Record<HonorUnlockId, CosmeticId>> = {
    honor_daily_initiate: 'crest_daily_bronze',
    honor_ascendant_5: 'title_ascendant_v'
};

export const honorUnlockTag = (id: HonorUnlockId): string => `${HONOR_UNLOCK_PREFIX}${id}`;

const isHonorUnlockId = (value: string): value is HonorUnlockId =>
    Object.prototype.hasOwnProperty.call(HONOR_UNLOCK_CATALOG, value);

export const parseHonorUnlockTag = (tag: string): HonorUnlockId | null => {
    if (!tag.startsWith(HONOR_UNLOCK_PREFIX)) {
        return null;
    }
    const id = tag.slice(HONOR_UNLOCK_PREFIX.length);
    return isHonorUnlockId(id) ? id : null;
};

export const hasHonorUnlock = (save: SaveData, id: HonorUnlockId): boolean =>
    (save.unlocks ?? []).includes(honorUnlockTag(id));

/** Which honors are earned given current save stats (independent of whether tags are already stored). */
export const eligibleHonorUnlockIds = (save: SaveData): HonorUnlockId[] => {
    const ps = save.playerStats;
    const dailies = runNonNegativeInteger(ps?.dailiesCompleted);
    const streak = runNonNegativeInteger(ps?.dailyStreakCosmetic);
    const bestNp = runNonNegativeInteger(ps?.bestFloorNoPowers);
    const bestScore = runNonNegativeInteger(save.bestScore);
    const relicPicks = getRelicPickTotal(ps?.relicPickCounts);
    const last = save.lastRunSummary;
    const lastLevelsCleared = runNonNegativeInteger(last?.levelsCleared);

    const earned: HonorUnlockId[] = [];
    if (dailies >= 1) earned.push('honor_daily_initiate');
    if (streak >= 3) earned.push('honor_daily_streak_3');
    if (streak >= 7) earned.push('honor_daily_streak_7');
    if (bestNp >= 5) earned.push('honor_ascendant_5');
    if (bestNp >= 10) earned.push('honor_ascendant_10');
    if (bestScore >= 2000) earned.push('honor_score_maestro');
    if (relicPicks >= 10) earned.push('honor_relic_habit');
    if (last?.gameMode === 'gauntlet' && lastLevelsCleared >= 1) earned.push('honor_gauntlet_proof');

    return [...new Set(earned)];
};

/** Merge any missing `honor:*` tags into save. Idempotent. Returns same reference if nothing added. */
export const mergeHonorUnlockTags = (save: SaveData): SaveData => {
    const eligible = eligibleHonorUnlockIds(save);
    const set = new Set(save.unlocks ?? []);
    let added = false;
    for (const id of eligible) {
        const t = honorUnlockTag(id);
        if (!set.has(t)) {
            set.add(t);
            added = true;
        }
        const cosmeticId = HONOR_COSMETIC_UNLOCKS[id];
        if (cosmeticId) {
            const cosmeticTag = cosmeticUnlockTag(cosmeticId);
            if (!set.has(cosmeticTag)) {
                set.add(cosmeticTag);
                added = true;
            }
        }
    }
    if (!added) {
        return save;
    }
    return normalizeSaveData({ ...save, unlocks: [...set] });
};

export const totalHonorUnlocks = HONOR_UNLOCK_ORDER.length;

/** Count of honors earned given current stats (matches stored tags after `mergeHonorUnlockTags`). */
export const countEligibleHonors = (save: SaveData): number => eligibleHonorUnlockIds(save).length;
