import { describe, expect, it } from 'vitest';
import type { RunSummary } from './contracts';
import { createNewRun, createRunSummary, finishMemorizePhase } from './game-core';
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
            runEndReason: 'turn_ceiling'
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
            value: 'Reach Sharp',
            detail: 'Best chain ×5. Sharp chains into the next clump and pays ×4 a pair.',
            actionHint: 'Open with pairs you are sure of, then carry the chain into the next clump.'
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
                runEndReason: 'turn_ceiling'
            },
            []
        );

        const row = getGameOverNextRunRows(run).find((entry) => entry.id === 'chain_target');

        expect(row).toMatchObject({
            value: 'Reach Fever',
            detail: 'Best chain ×8. Fever chains into three clumps and pays ×8 a pair.'
        });
    });


    it('keeps build recap pinned to the terminal run summary', () => {
        const summarized = createRunSummary(
            {
                ...finishMemorizePhase(
                    createNewRun(0, {
                        activeMutators: ['wide_recall', 'silhouette_twist']
                    })
                ),
                status: 'gameOver',
                runEndReason: 'turn_ceiling'
            },
            []
        );
        const normalized = { ...summarized, activeMutators: [] };

        const row = getGameOverNextRunRows(normalized).find((entry) => entry.id === 'build_recap');

        expect(row?.value).toBe('2 mutator(s)');
    });

    it('normalizes malformed terminal summary counters before building next-run rows', () => {
        const source = finishMemorizePhase(createNewRun(0));
        const run = createRunSummary({ ...source, status: 'gameOver', runEndReason: 'turn_ceiling' }, []);
        run.findablesClaimedThisFloor = Number.POSITIVE_INFINITY;
        run.findablesTotalThisFloor = Number.NaN;
        run.lastRunSummary = {
            ...run.lastRunSummary!,
            totalScore: Number.NaN,
            highestLevel: Number.POSITIVE_INFINITY,
            levelsCleared: Number.NaN,
            bestStreak: Number.POSITIVE_INFINITY,
            perfectClears: Number.NaN,
            activeMutators: Number.POSITIVE_INFINITY
        } as unknown as RunSummary;

        const rows = getGameOverNextRunRows(run);

        expect(rows.map((row) => `${row.value} ${row.detail}`).join(' ')).not.toMatch(/NaN|Infinity/);
        expect(rows.find((row) => row.id === 'run_it_back')?.detail).toBe(
            '0 score / floor 0 / 0 clear(s) / chain not started'
        );
        expect(rows.find((row) => row.id === 'build_recap')?.value).toBe('0 mutator(s)');
        expect(rows.find((row) => row.id === 'next_goal')).toMatchObject({
            value: 'Reach floor 5',
            detail: 'Perfect floors and no-assist runs unlock mastery.'
        });
    });


    it('uses save-backed meta progression feedback for the next-goal row when available', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 7
        };
        const run = createRunSummary({ ...finishMemorizePhase(createNewRun(0)), status: 'gameOver', runEndReason: 'turn_ceiling' }, []);

        const row = getGameOverNextRunRows(run, save).find((entry) => entry.id === 'next_goal');

        // The relic shrine's extra pick was the ready reward here until the draft went (Gen 175).
        expect(row).toMatchObject({
            title: 'Next goal',
            actionHint: 'Use Profile for reward status and Choose Your Path for the next attempt.',
            localOnly: true
        });
        expect(row?.value).not.toBe('Week of Archives ready');
        expect(row?.detail).toContain('Adept tier at profile level 3 (3 honor marks).');
    });

    it('can prioritize concrete post-run meta deltas when previous save state is provided', () => {
        const before = createDefaultSaveData();
        before.playerStats = {
            ...before.playerStats!,
            sharpFloors: 6
        };
        const after = createDefaultSaveData();
        after.playerStats = {
            ...after.playerStats!,
            sharpFloors: 7
        };
        const run = createRunSummary({ ...finishMemorizePhase(createNewRun(0)), status: 'gameOver', runEndReason: 'turn_ceiling' }, []);

        const row = getGameOverNextRunRows(run, after, before).find((entry) => entry.id === 'next_goal');

        expect(row).toMatchObject({ value: 'Sharp floors advanced' });
        expect(row?.detail).toContain('+1 honor mark from Sharp floor progress.');
        expect(row?.detail).toContain('Adept tier at profile level 3 (3 honor marks).');
        expect(row?.detail).not.toContain('Next: Next:');
    });

    it('says the next milestone once when a level-up has already said it', () => {
        const withSharpFloors = (sharpFloors: number) => {
            const save = createDefaultSaveData();
            save.playerStats = { ...save.playerStats!, sharpFloors };
            return save;
        };
        const run = createRunSummary({ ...finishMemorizePhase(createNewRun(0)), status: 'gameOver', runEndReason: 'quit' }, []);

        const row = getGameOverNextRunRows(run, withSharpFloors(5), withSharpFloors(4)).find((entry) => entry.id === 'next_goal');

        expect(row?.value).toBe('Profile level up');
        expect(row?.detail.match(/Adept tier at profile level 3/g)).toHaveLength(1);
        expect(row?.detail).toContain('Next: ');
    });
});
