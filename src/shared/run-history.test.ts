import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, createRunSummary, finishMemorizePhase } from './game-core';
import {
    buildRunHistoryEntry,
    buildRunHistoryExportString,
    buildRunJournalRows,
    buildRunJournalRowsFromSave,
    buildRunShareKey
} from './run-history';
import { createDefaultSaveData } from './save-data';

const completedRun = (): RunState => {
    const run = createRunSummary(
        {
            ...finishMemorizePhase(createNewRun(100, { runSeed: 85_001, activeMutators: ['wide_recall'] })),
            flipHistory: ['1-0-A', '1-0-B', '1-1-A'],
            matchedPairKeysThisRun: ['1-0', '1-1']
        },
        ['ACH_FIRST_CLEAR']
    );
    return run;
};

describe('REG-085 run history, share keys, and journal', () => {
    it('builds a local-only run history entry without a second save file', () => {
        const entry = buildRunHistoryEntry(completedRun());

        expect(entry).toMatchObject({
            runSeed: 85_001,
            localOnly: true,
            share: {
                kind: 'local_share_key'
            }
        });
        expect(entry.build.mutatorIds).toEqual(['wide_recall']);
        expect(entry.journalRows.find((row) => row.id === 'build')?.value).toContain('1 mutators');
        expect(entry.journalRows.find((row) => row.id === 'build')?.detail).toBe('wide_recall');
        expect(entry.journalRows.map((row) => row.id)).toEqual(['summary', 'build', 'share', 'encore']);
        expect(buildRunHistoryExportString(completedRun())).toContain('build 1 mutators');
        expect(buildRunHistoryExportString(completedRun())).not.toMatch(/token|email|path/i);
    });

    it('produces privacy-safe share keys and journal rows', () => {
        const run = completedRun();
        const link = buildRunShareKey(run);
        const rows = buildRunJournalRows(run);

        expect(link.shareString).toContain('local share');
        expect(link.shareString).not.toMatch(/account|token|path|email/i);
        expect(rows.find((row) => row.id === 'share')?.detail).toContain('3 flip ids are local-only');
        expect(rows.find((row) => row.id === 'share')?.detail).toContain('does not include flip playback');
        expect(rows.every((row) => row.offlineOnly)).toBe(true);
    });




    it('normalizes malformed run history arrays before build and playback rows', () => {
        const run: RunState = {
            ...completedRun(),
            activeMutators: Number.NaN as unknown as RunState['activeMutators'],
            flipHistory: Number.NaN as unknown as string[],
            matchedPairKeysThisRun: Number.NaN as unknown as string[]
        };

        const entry = buildRunHistoryEntry(run);

        expect(entry.build.mutatorIds).toEqual([]);
        expect(entry.journalRows.find((row) => row.id === 'build')?.value).toContain('0 mutators');
        expect(entry.journalRows.find((row) => row.id === 'build')?.detail).toBe('No mutators active.');
        expect(entry.journalRows.find((row) => row.id === 'share')?.detail).toContain('0 flip ids are local-only');
        expect(entry.journalRows.find((row) => row.id === 'encore')?.detail).toContain('0 matched pair keys');
    });





    it('carries persisted payoff stacks into save-derived journal rows', () => {
        const save = createDefaultSaveData();
        save.lastRunSummary = {
            totalScore: 24680,
            bestScore: 24680,
            levelsCleared: 5,
            highestLevel: 6,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 13,
            perfectClears: 2,
            payoffPickupClaimed: 2,
            payoffPickupTotal: 2,
            gameMode: 'endless'
        };

        const rows = buildRunJournalRowsFromSave(save);

        expect(rows.find((row) => row.id === 'last_payoff_stack')).toMatchObject({
            label: 'Last payoff stack',
            value: 'Combo burst · 3 payoffs',
            persistence: 'persisted_summary',
            exportSafe: true
        });
    });

    it('normalizes malformed save-derived journal counters before rendering rows', () => {
        const save = createDefaultSaveData();
        save.lastRunSummary = {
            totalScore: Number.NaN,
            bestScore: 0,
            levelsCleared: 0,
            highestLevel: Number.POSITIVE_INFINITY,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 4,
            perfectClears: 0,
            payoffPickupClaimed: 0,
            payoffPickupTotal: 0,
            gameMode: 'endless'
        };
        save.playerStats = {
            ...save.playerStats!,
            encorePairKeysLastRun: Number.NaN as unknown as string[]
        };

        const rows = buildRunJournalRowsFromSave(save);

        expect(rows.find((row) => row.id === 'last_summary')?.value).toBe('endless · 0 score · floor 0');
        expect(rows.find((row) => row.id === 'last_payoff_stack')).toBeUndefined();
        expect(rows.find((row) => row.id === 'encore_pairs')?.value).toBe('0 pair keys remembered locally');
    });
});
