import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import { createDailyRun, createGauntletRun, createNewRun, createWildRun } from './run-creation-rules';
import {
    appendRunHistory,
    buildRunHistoryRecord,
    normalizeRunHistory,
    normalizeRunHistoryRecord,
    RUN_HISTORY_LIMIT
} from './run-history-log';

const AT = '2026-09-04T12:00:00.000Z';

const record = (over: Partial<ReturnType<typeof buildRunHistoryRecord>> = {}) => ({
    endedAtIso: AT,
    highestLevel: 4,
    mode: 'Classic Dungeon',
    shareKey: 'md1:classic:33:912',
    totalScore: 900,
    ...over
});

describe('buildRunHistoryRecord', () => {
    it('records the mode a player picked, not the game mode underneath it', () => {
        expect(buildRunHistoryRecord(createWildRun(0), AT).mode).toBe('Wild Run');
    });

    it('carries the key that replays the run', () => {
        expect(buildRunHistoryRecord(createGauntletRun(0, 600_000), AT).shareKey).toMatch(/^md1:gauntlet:\d+:\d+:600000$/u);
    });

    it('records a run that cannot be handed over with no key rather than a wrong one', () => {
        expect(buildRunHistoryRecord(createDailyRun(0), AT).shareKey).toBeNull();
    });
});

describe('normalizeRunHistory', () => {
    it('drops an entry this build cannot read instead of failing the whole history', () => {
        const history = normalizeRunHistory([record(), { mode: '' }, null, 'nonsense', record({ mode: 'Practice' })]);
        expect(history.map((entry) => entry.mode)).toEqual(['Classic Dungeon', 'Practice']);
    });

    it('reads a missing history as an empty one, which is what an older save has', () => {
        expect(normalizeRunHistory(undefined)).toEqual([]);
        expect(normalizeRunHistory({})).toEqual([]);
    });

    it('refuses an entry with no usable timestamp, since the list is ordered by when', () => {
        expect(normalizeRunHistoryRecord(record({ endedAtIso: 'sometime' }))).toBeNull();
    });

    it('repairs a negative or absurd score rather than storing it', () => {
        const entry = normalizeRunHistoryRecord(record({ highestLevel: -3, totalScore: Number.NaN }));
        expect(entry?.highestLevel).toBe(0);
        expect(entry?.totalScore).toBe(0);
    });
});

describe('appendRunHistory', () => {
    it('puts the newest run first', () => {
        const save = { ...createDefaultSaveData(), runHistory: [record({ mode: 'Older' })] };
        expect(appendRunHistory(save, record({ mode: 'Newest' }))[0]?.mode).toBe('Newest');
    });

    it('drops the oldest run rather than refusing the newest', () => {
        const full = Array.from({ length: RUN_HISTORY_LIMIT }, (_unused, index) =>
            record({ mode: `Run ${index}` })
        );
        const save = { ...createDefaultSaveData(), runHistory: full };
        const next = appendRunHistory(save, record({ mode: 'Newest' }));

        expect(next).toHaveLength(RUN_HISTORY_LIMIT);
        expect(next[0]?.mode).toBe('Newest');
        expect(next.some((entry) => entry.mode === `Run ${RUN_HISTORY_LIMIT - 1}`)).toBe(false);
    });

    it('starts a history on a save that has never had one', () => {
        expect(appendRunHistory(createDefaultSaveData(), buildRunHistoryRecord(createNewRun(0), AT))).toHaveLength(1);
    });
});

describe('the chain in the history', () => {
    it('records the longest chain and the biggest chunk, and reads a row without them as zero', () => {
        const run = createGauntletRun(0, 600_000);
        const chained = { ...run, biggestChunkPairs: 7, bestChainThisRun: 9 };
        const record = buildRunHistoryRecord(chained, AT);
        expect(record.bestChain).toBe(9);
        expect(record.biggestChunk).toBe(7);
        expect(buildRunHistoryRecord(run, AT).biggestChunk).toBeUndefined();
        expect(normalizeRunHistory([{ mode: 'Old', endedAtIso: AT, totalScore: 5, highestLevel: 1 }])[0]?.bestChain).toBeUndefined();
        expect(normalizeRunHistory([{ ...record }])[0]).toMatchObject({ bestChain: 9, biggestChunk: 7 });
    });
});
