import type { RunHistoryRecord, RunState, SaveData, RunSummary } from './contracts';
import { describeRunModeIdentity } from './run-mode-identity';
import { describeRunShareKey, encodeRunShareKey } from './run-share-key';
import { runNonNegativeInteger } from './run-number-guards';
import { parTurnsForBoard } from './floor-par';

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
    const bestChain = runNonNegativeInteger(input.bestChain);
    const biggestChunk = runNonNegativeInteger(input.biggestChunk);
    return {
        endedAtIso,
        highestLevel: runNonNegativeInteger(input.highestLevel),
        mode,
        shareKey: typeof input.shareKey === 'string' && input.shareKey.length > 0 ? input.shareKey : null,
        totalScore: runNonNegativeInteger(input.totalScore),
        ...(typeof input.missesSpent === 'number' && Number.isSafeInteger(input.missesSpent) ? { missesSpent: runNonNegativeInteger(input.missesSpent) } : {}),
        ...(typeof input.turnsRelativeToPar === 'number' && Number.isSafeInteger(input.turnsRelativeToPar) ? { turnsRelativeToPar: input.turnsRelativeToPar } : {}),
        ...(typeof input.strongestReaction === 'number' && Number.isSafeInteger(input.strongestReaction) ? { strongestReaction: runNonNegativeInteger(input.strongestReaction) } : {}),
        ...(bestChain > 0 ? { bestChain } : {}),
        ...(biggestChunk > 0 ? { biggestChunk } : {})
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
    const bestChain = runNonNegativeInteger(
        summary?.bestChain ??
            Math.max(runNonNegativeInteger(run.bestChainThisRun), runNonNegativeInteger(run.bestChainThisFloor))
    );
    const biggestChunk = runNonNegativeInteger(summary?.biggestChunk ?? run.biggestChunkPairs);
    return {
        endedAtIso,
        highestLevel: runNonNegativeInteger(summary?.highestLevel ?? run.stats.highestLevel),
        mode: describeRunModeIdentity(run).label,
        shareKey: 'refusal' in recipe ? null : encodeRunShareKey(recipe.key),
        totalScore: runNonNegativeInteger(summary?.totalScore ?? run.stats.totalScore),
        missesSpent: run.missesSpentThisRun ?? run.stats.mismatches,
        turnsRelativeToPar: (run.clearedTurnsRelativeToPar ?? 0) + (run.lastLevelResult?.level === run.board?.level ? 0 : run.turnsThisFloor - parTurnsForBoard(run.board)),
        strongestReaction: runNonNegativeInteger(run.strongestReactionThisRun),
        ...(bestChain > 0 ? { bestChain } : {}),
        ...(biggestChunk > 0 ? { biggestChunk } : {})
    };
};

/** Newest first, capped. The oldest run falls off the end rather than the newest being refused. */
export const appendRunHistory = (save: SaveData, record: RunHistoryRecord): RunHistoryRecord[] =>
    [record, ...normalizeRunHistory(save.runHistory)].slice(0, RUN_HISTORY_LIMIT);

/** The previous matching recipe is read from the run-start snapshot, before this attempt
 * is appended. Missing metrics on legacy rows stay unknown, never invented as zero. */
export const describeRematchComparison = (run: RunState, history: readonly RunHistoryRecord[] = []): string | null => {
    const current = buildRunHistoryRecord(run, '2000-01-01T00:00:00.000Z');
    const previous = history.find(record => record.shareKey != null && record.shareKey === current.shareKey);
    if (!previous) return null;
    const delta = (value: number) => value > 0 ? `+${value}` : String(value);
    const rows = [`floor ${previous.highestLevel} → ${current.highestLevel}`];
    if (previous.missesSpent !== undefined) rows.push(`misses spent ${previous.missesSpent} → ${current.missesSpent}`);
    if (previous.turnsRelativeToPar !== undefined) rows.push(`turns vs par ${delta(previous.turnsRelativeToPar)} → ${delta(current.turnsRelativeToPar ?? 0)}`);
    if (previous.strongestReaction !== undefined) rows.push(`reaction ×${previous.strongestReaction} → ×${current.strongestReaction}`);
    if (previous.bestChain !== undefined) rows.push(`chain ${previous.bestChain} → ${current.bestChain ?? 0}`);
    return `Previous attempt → this attempt: ${rows.join(' · ')}.`;
};
