import { describe, expect, it } from 'vitest';
import type { RunSummary } from './contracts';
import { createDungeonShowcaseRun, createNewRun, createRunSummary, finishMemorizePhase } from './game-core';
import { getGameOverNextRunRows } from './game-over-next-run';
import { createDefaultSaveData } from './save-data';

describe('REG-096 game over next-run loop', () => {
    it('derives run-it-back, build recap, and local share rows from run summary', () => {
        const source = finishMemorizePhase(createNewRun(0));
        const run = createRunSummary({
            ...source,
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            stats: { ...source.stats, bestStreak: 5 },
            status: 'gameOver',
            lives: 0
        }, []);
        const rows = getGameOverNextRunRows(run);

        expect(rows.map((row) => row.id)).toEqual(['run_it_back', 'chain_target', 'build_recap', 'local_share', 'next_goal']);
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.find((row) => row.id === 'run_it_back')?.actionHint).toMatch(/again/i);
        expect(rows.find((row) => row.id === 'run_it_back')?.detail).toMatch(/score \/ floor \d+ \/ \d+ clear/);
        expect(rows.find((row) => row.id === 'run_it_back')?.detail).toContain('best chain x5');
        expect(rows.find((row) => row.id === 'run_it_back')?.detail).toContain('pickups 1/2');
        expect(rows.find((row) => row.id === 'chain_target')).toMatchObject({
            title: 'Chain target',
            value: 'Push x6 reward',
            detail: 'Best chain x5; extend the x3 reward loop before chasing greedy pickups.',
            actionHint: 'Open with confirmed pairs, then convert tools into one longer streak.'
        });
        expect(rows.find((row) => row.id === 'local_share')?.detail).toMatch(/online rank/i);
    });

    it('turns high streaks into a concrete combo-tier next-run target', () => {
        const source = finishMemorizePhase(createNewRun(0));
        const run = createRunSummary(
            {
                ...source,
                stats: { ...source.stats, bestStreak: 8 },
                status: 'gameOver',
                lives: 0
            },
            []
        );

        const row = getGameOverNextRunRows(run).find((entry) => entry.id === 'chain_target');

        expect(row).toMatchObject({
            value: 'Break into x10',
            detail: 'Best chain x8; one cleaner floor can turn reward-threshold chains into a combo-tier burst.'
        });
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

    it('normalizes malformed terminal summary counters before building next-run rows', () => {
        const source = finishMemorizePhase(createNewRun(0));
        const run = createRunSummary({ ...source, status: 'gameOver', lives: 0 }, []);
        run.findablesClaimedThisFloor = Number.POSITIVE_INFINITY;
        run.findablesTotalThisFloor = Number.NaN;
        run.lastRunSummary = {
            ...run.lastRunSummary!,
            totalScore: Number.NaN,
            highestLevel: Number.POSITIVE_INFINITY,
            levelsCleared: Number.NaN,
            bestStreak: Number.POSITIVE_INFINITY,
            perfectClears: Number.NaN,
            relicIds: Number.NaN,
            activeMutators: Number.POSITIVE_INFINITY
        } as unknown as RunSummary;

        const rows = getGameOverNextRunRows(run);

        expect(rows.map((row) => `${row.value} ${row.detail}`).join(' ')).not.toMatch(/NaN|Infinity/);
        expect(rows.find((row) => row.id === 'run_it_back')?.detail).toBe(
            '0 score / floor 0 / 0 clear(s) / chain not started'
        );
        expect(rows.find((row) => row.id === 'build_recap')?.value).toBe('0 relic(s) / 0 mutator(s)');
        expect(rows.find((row) => row.id === 'next_goal')).toMatchObject({
            value: 'Reach floor 5',
            detail: 'Perfect floors and no-assist runs unlock mastery.'
        });
    });

    it('summarizes starting loadout identity in the build recap', () => {
        const summarized = createRunSummary(
            {
                ...finishMemorizePhase(createNewRun(0, { startingLoadoutId: 'cursebreaker' })),
                status: 'gameOver',
                lives: 0
            },
            []
        );
        const row = getGameOverNextRunRows(summarized).find((entry) => entry.id === 'build_recap');

        expect(summarized.lastRunSummary?.startingLoadoutId).toBe('cursebreaker');
        expect(row?.value).toContain('Cursebreaker');
        expect(row?.detail).toContain('hazard-control toolkit');
        expect(row?.detail).toContain('Starts: +1 guard, +1 destroy');
        expect(row?.detail).toContain('Build bias: Cursed + Stasis');
        expect(row?.detail).toContain('Payoff: Hazard control');
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
