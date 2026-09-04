import type { RunHistoryRecord, RunState, SaveData, RunSummary } from './contracts';
import { describeRunModeIdentity } from './run-mode-identity';
import { describeRunShareKey, encodeRunShareKey } from './run-share-key';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The last few runs, so a player has a record of more than the one they just finished.
 *
 * The save has always kept `lastRunSummary` and nothing before it, which for a roguelite means the
 * run you are proudest of is gone the moment you start another. Each entry carries what a player
 * would want back — which mode, how far, what score, when — plus the share key, so any past run
 * can be handed over or replayed rather than only the one still on screen.
 *
 * Bounded on purpose. A save is a file a player may never delete, and an unbounded log would grow
 * without limit for no benefit: nobody scrolls to their 400th run.
 */

export const RUN_HISTORY_LIMIT = 20;

export type { RunHistoryRecord } from './contracts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** A single entry, or null when the stored shape is not one this build can read. */
export const normalizeRunHistoryRecord = (input: unknown): RunHistoryRecord | null => {
    if (!isRecord(input)) {
        return null;
    }
    const mode = typeof input.mode === 'string' ? input.mode.trim() : '';
    const endedAtIso = typeof input.endedAtIso === 'string' ? input.endedAtIso : '';
    if (mode === '' || Number.isNaN(Date.parse(endedAtIso))) {
        return null;
    }
    return {
        endedAtIso,
        highestLevel: runNonNegativeInteger(input.highestLevel),
        mode,
        shareKey: typeof input.shareKey === 'string' && input.shareKey.length > 0 ? input.shareKey : null,
        totalScore: runNonNegativeInteger(input.totalScore)
    };
};

/**
 * Newest first, junk dropped, capped. Anything unreadable is dropped rather than failing the whole
 * save: a history is a convenience, and losing one row must never cost a player their profile.
 */
export const normalizeRunHistory = (input: unknown): RunHistoryRecord[] => {
    if (!Array.isArray(input)) {
        return [];
    }
    return input
        .map((entry) => normalizeRunHistoryRecord(entry))
        .filter((entry): entry is RunHistoryRecord => entry !== null)
        .slice(0, RUN_HISTORY_LIMIT);
};

export const buildRunHistoryRecord = (run: RunState, endedAtIso: string): RunHistoryRecord => {
    const summary: RunSummary | null = run.lastRunSummary;
    const recipe = describeRunShareKey(run);
    return {
        endedAtIso,
        highestLevel: runNonNegativeInteger(summary?.highestLevel ?? run.stats.highestLevel),
        mode: describeRunModeIdentity(run).label,
        shareKey: 'refusal' in recipe ? null : encodeRunShareKey(recipe.key),
        totalScore: runNonNegativeInteger(summary?.totalScore ?? run.stats.totalScore)
    };
};

/** Newest first, capped. The oldest run falls off the end rather than the newest being refused. */
export const appendRunHistory = (save: SaveData, record: RunHistoryRecord): RunHistoryRecord[] =>
    [record, ...normalizeRunHistory(save.runHistory)].slice(0, RUN_HISTORY_LIMIT);
