import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION, type RunState } from './contracts';
import { createNewRun } from './game';
import { createDefaultSaveData, normalizeUnknownSaveData } from './save-data';
import { withFastDescent } from './descent-pace-rules';
import { ENDLESS_UNLOCK_TAG, isEndlessUnlocked, normalizeDescentRecord, recordDescent } from './descent-record';
import { getProfileSummaryRows } from './profile-summary';

/** A finished run that reached `level`, ended for `reason`. */
const finished = (level: number, reason: RunState['runEndReason'], extra: Partial<RunState> = {}): RunState => {
    const base = createNewRun(0, { runSeed: 6161 });
    return {
        ...base,
        status: 'gameOver',
        runEndReason: reason,
        board: { ...base.board!, level },
        stats: { ...base.stats, highestLevel: level },
        ...extra
    };
};

describe('the Descent record (DGE-031)', () => {
    it('loads a schema-9 save with no record, and keeps the record a run writes through a save round trip', () => {
        expect(SAVE_SCHEMA_VERSION).toBe(10);
        // The save from main before this pack: schema 9, no Descent, no Endless.
        const old = JSON.parse(JSON.stringify({ ...createDefaultSaveData(), schemaVersion: 9 }));
        const loaded = normalizeUnknownSaveData(old);
        expect(loaded.schemaVersion).toBe(10);
        expect(normalizeDescentRecord(loaded.playerStats?.descent)).toMatchObject({ wardenClears: 0, deepestFloor: 0, deepestActId: null });
        expect(isEndlessUnlocked(loaded)).toBe(false);

        const won = recordDescent(loaded, finished(60, 'warden_cleared', { dreadRagingFloors: 20, dreadWildFloors: 20 }));
        const reloaded = normalizeUnknownSaveData(JSON.parse(JSON.stringify(won)));
        expect(reloaded.playerStats?.descent).toEqual({
            wardenClears: 1,
            deepestFloor: 60,
            deepestActId: 'abyss',
            deepestDreadTierId: 'coming',
            bestDepth: 0
        });
        expect(reloaded.unlocks).toContain(ENDLESS_UNLOCK_TAG);
        expect(isEndlessUnlocked(reloaded)).toBe(true);
    });

    it('only ever grows: a shallower or calmer run leaves the record as it was, a second win counts', () => {
        let save = recordDescent(createDefaultSaveData(), finished(32, 'miss_budget', { dreadRagingFloors: 6, dreadWildFloors: 6 }));
        expect(save.playerStats?.descent).toMatchObject({ deepestFloor: 32, deepestActId: 'deep', wardenClears: 0 });
        const tier = save.playerStats?.descent?.deepestDreadTierId;
        save = recordDescent(save, finished(5, 'miss_budget'));
        expect(save.playerStats?.descent).toMatchObject({ deepestFloor: 32, deepestActId: 'deep', deepestDreadTierId: tier });
        expect(isEndlessUnlocked(save)).toBe(false);
        save = recordDescent(recordDescent(save, finished(60, 'warden_cleared')), finished(60, 'warden_cleared'));
        expect(save.playerStats?.descent?.wardenClears).toBe(2);
    });

    it('writes nothing for a test-pace run or a shared table', () => {
        const save = createDefaultSaveData();
        expect(recordDescent(save, withFastDescent(finished(60, 'warden_cleared')))).toBe(save);
        expect(recordDescent(save, finished(60, 'warden_cleared', { passAndPlay: { seats: [], activeSeatIndex: 0 } as unknown as RunState['passAndPlay'] }))).toBe(save);
    });

    it('reads a damaged record as none walked, never as a refused save', () => {
        expect(normalizeDescentRecord({ wardenClears: -3, deepestFloor: 'deep', deepestActId: 'cellar', deepestDreadTierId: 'grumpy', bestDepth: 2.5 })).toEqual({
            wardenClears: 0,
            deepestFloor: 0,
            deepestActId: null,
            deepestDreadTierId: null,
            bestDepth: 2
        });
        expect(normalizeDescentRecord(null).wardenClears).toBe(0);
    });

    it('shows on the Profile: how deep, how bad, and whether the Warden fell', () => {
        const fresh = getProfileSummaryRows(createDefaultSaveData()).find((row) => row.id === 'descent');
        expect(fresh).toMatchObject({ label: 'Deepest floor', value: 'None', source: 'The Warden still stands' });
        const won = recordDescent(createDefaultSaveData(), finished(60, 'warden_cleared', { dreadRagingFloors: 20, dreadWildFloors: 20 }));
        const row = getProfileSummaryRows(normalizeUnknownSaveData(won)).find((entry) => entry.id === 'descent');
        expect(row).toMatchObject({ value: '60', source: 'The Abyss · The Warden fell once · Endless open · Dread It is coming' });
        expect(getProfileSummaryRows(createDefaultSaveData())).toHaveLength(6);
    });
});
