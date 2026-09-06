import { describe, expect, it } from 'vitest';
import type { RunHistoryRecord } from './contracts';
import { getModeRecords } from './mode-records';

const run = (mode: string, totalScore: number, highestLevel = 1, day = '01'): RunHistoryRecord => ({
    endedAtIso: `2026-09-${day}T12:00:00.000Z`,
    highestLevel,
    mode,
    shareKey: null,
    totalScore
});

describe('getModeRecords', () => {
    it('keeps the best run in each mode rather than one number across all of them', () => {
        const records = getModeRecords([
            run('Classic Dungeon', 900),
            run('Gauntlet', 400),
            run('Classic Dungeon', 2200),
            run('Gauntlet', 150)
        ]);

        expect(records.map((record) => [record.mode, record.totalScore])).toEqual([
            ['Classic Dungeon', 2200],
            ['Gauntlet', 400]
        ]);
    });

    it('counts how many runs are behind a record, so a one-off reads as one', () => {
        const records = getModeRecords([run('Wild Run', 100), run('Wild Run', 300), run('Practice', 50)]);

        expect(records.find((record) => record.mode === 'Wild Run')?.runs).toBe(2);
        expect(records.find((record) => record.mode === 'Practice')?.runs).toBe(1);
    });

    it('breaks a tied score by how far the run got, since the deeper run is the better one', () => {
        const records = getModeRecords([run('Classic Dungeon', 500, 3), run('Classic Dungeon', 500, 9)]);

        expect(records[0]?.highestLevel).toBe(9);
    });

    it('orders by score, then by name so a tie does not shuffle between renders', () => {
        const records = getModeRecords([run('Wild Run', 500), run('Classic Dungeon', 500), run('Gauntlet', 900)]);

        expect(records.map((record) => record.mode)).toEqual(['Gauntlet', 'Classic Dungeon', 'Wild Run']);
    });

    it('lists no mode the player has never recorded a run in', () => {
        expect(getModeRecords([]).length).toBe(0);
        expect(getModeRecords([run('Practice', 10)]).map((record) => record.mode)).toEqual(['Practice']);
    });

    it('keeps the date of the record run, not of the most recent one in that mode', () => {
        const records = getModeRecords([run('Classic Dungeon', 2000, 5, '01'), run('Classic Dungeon', 100, 1, '09')]);

        expect(records[0]?.endedAtIso).toBe('2026-09-01T12:00:00.000Z');
    });
});

describe('the chain records by mode', () => {
    it('keeps the longest chain and biggest chunk across every run, not only the highest-scoring one', () => {
        const records = getModeRecords([
            { ...run('Classic Dungeon', 900), bestChain: 12, biggestChunk: 3 },
            { ...run('Classic Dungeon', 2200), bestChain: 5, biggestChunk: 7 },
            run('Gauntlet', 400)
        ]);
        expect(records[0]).toMatchObject({ mode: 'Classic Dungeon', totalScore: 2200, bestChain: 12, biggestChunk: 7 });
        expect(records[1]).toMatchObject({ mode: 'Gauntlet', bestChain: 0, biggestChunk: 0 });
    });
});
