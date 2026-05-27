import { describe, expect, it } from 'vitest';
import { createDungeonShowcaseRun, createNewRun, createRunSummary, finishMemorizePhase } from './game-core';
import { getGameOverNextRunRows } from './game-over-next-run';
import { createDefaultSaveData } from './save-data';

describe('REG-096 game over next-run loop', () => {
    it('derives run-it-back, build recap, and local share rows from run summary', () => {
        const run = createRunSummary({ ...finishMemorizePhase(createNewRun(0)), status: 'gameOver', lives: 0 }, []);
        const rows = getGameOverNextRunRows(run);

        expect(rows.map((row) => row.id)).toEqual(['run_it_back', 'build_recap', 'local_share', 'next_goal']);
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.find((row) => row.id === 'run_it_back')?.actionHint).toMatch(/again/i);
        expect(rows.find((row) => row.id === 'run_it_back')?.detail).toMatch(/score \/ floor \d+ \/ \d+ clear/);
        expect(rows.find((row) => row.id === 'local_share')?.detail).toMatch(/online rank/i);
    });

    it('labels explicit dungeon showcase summaries for run-it-back', () => {
        const run = createRunSummary({ ...createDungeonShowcaseRun(0), status: 'gameOver', lives: 0 }, []);
        const rows = getGameOverNextRunRows(run);

        expect(rows.find((row) => row.id === 'run_it_back')?.value).toBe('Dungeon Showcase');
    });

    it('keeps build recap pinned to the terminal run summary', () => {
        const summarized = createRunSummary(
            {
                ...finishMemorizePhase(
                    createNewRun(0, {
                        activeMutators: ['wide_recall', 'silhouette_twist'],
                        initialRelicIds: ['peek_charge_plus_one', 'pin_cap_plus_one']
                    })
                ),
                status: 'gameOver',
                lives: 0
            },
            []
        );
        const normalized = { ...summarized, relicIds: [], activeMutators: [] };

        const row = getGameOverNextRunRows(normalized).find((entry) => entry.id === 'build_recap');

        expect(row?.value).toBe('2 relic(s) / 2 mutator(s)');
    });

    it('uses save-backed meta progression feedback for the next-goal row when available', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 7
        };
        const run = createRunSummary({ ...finishMemorizePhase(createNewRun(0)), status: 'gameOver', lives: 0 }, []);

        const row = getGameOverNextRunRows(run, save).find((entry) => entry.id === 'next_goal');

        expect(row).toMatchObject({
            title: 'Next goal',
            value: 'Week of Archives ready',
            detail: 'Week of Archives is ready. Adept tier at profile level 3 (3 honor marks).',
            actionHint: 'Use Profile for reward status; choose Classic to benefit from permanent upgrades.',
            localOnly: true
        });
    });

    it('can prioritize concrete post-run meta deltas when previous save state is provided', () => {
        const before = createDefaultSaveData();
        before.playerStats = {
            ...before.playerStats!,
            dailiesCompleted: 6
        };
        const after = createDefaultSaveData();
        after.playerStats = {
            ...after.playerStats!,
            dailiesCompleted: 7
        };
        const run = createRunSummary({ ...finishMemorizePhase(createNewRun(0)), status: 'gameOver', lives: 0 }, []);

        const row = getGameOverNextRunRows(run, after, before).find((entry) => entry.id === 'next_goal');

        expect(row).toMatchObject({
            value: 'Week of Archives ready',
            detail:
                '+1 relic pick per milestone can be unlocked from Profile. +1 honor mark from daily archive progress. Next: Week of Archives is ready. Adept tier at profile level 3 (3 honor marks).'
        });
    });
});
