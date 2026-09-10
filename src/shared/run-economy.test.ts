import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import {
    RUN_ECONOMY_DEFINITIONS,
    getRunEconomyRows,
    getRunEconomySnapshot,
    runEconomyDefinitionById
} from './run-economy';

describe('REG-024 run economy taxonomy', () => {
    it('keeps runtime rewards separated by persistence and purpose', () => {
        expect(RUN_ECONOMY_DEFINITIONS.map((entry) => entry.id)).toEqual([
            'score',
            'findable_pickups',
            'assist_charges'
        ]);
        expect(runEconomyDefinitionById.score.persistence).toBe('run_summary');
        expect(runEconomyDefinitionById.findable_pickups.persistence).toBe('temporary_run');
        for (const entry of RUN_ECONOMY_DEFINITIONS) {
            expect(entry.source.length).toBeGreaterThan(0);
            expect(entry.sink.length).toBeGreaterThan(0);
            expect(entry.purpose.length).toBeGreaterThan(0);
        }
    });

    it('projects a run into compact machine-readable economy rows', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            relicFavorProgress: 2,
            dungeonKeys: { iron: 1 },
            dungeonMasterKeys: 1,
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            stats: {
                ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })).stats,
                totalScore: 120
            }
        };
        const snapshot = getRunEconomySnapshot(run);

        expect(snapshot.score.value).toBe('120');
        expect(snapshot.temporaryRunCurrencies.map((entry) => entry.id)).toEqual([
            'findable_pickups',
            'assist_charges'
        ]);
        expect(getRunEconomyRows(run).map((row) => `${row.key}:${row.value}`)).toEqual([
            'score:120',
            'findable_pickups:1/2',
            'assist_charges:Shuffle 1 · Row 1 · Peek 1'
        ]);
    });

    it('normalizes malformed counters before projecting economy rows', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            findablesClaimedThisFloor: Number.NaN,
            findablesTotalThisFloor: Number.POSITIVE_INFINITY,
            shuffleCharges: Number.NaN,
            regionShuffleCharges: 1.9,
            peekCharges: -4,
            stats: {
                ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })).stats,
                totalScore: Number.POSITIVE_INFINITY
            }
        };

        const rows = getRunEconomyRows(run);

        expect(rows.map((row) => `${row.key}:${row.value}`)).toEqual([
            'score:0',
            'findable_pickups:0/0',
            'assist_charges:Shuffle 0 · Row 1 · Peek 0'
        ]);
        expect(rows.map((row) => row.numericValue).every(Number.isFinite)).toBe(true);
    });

    it('normalizes malformed stat records before projecting economy rows', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            stats: Number.NaN as unknown as RunState['stats']
        };

        expect(getRunEconomyRows(run).map((row) => `${row.key}:${row.value}`)).toEqual([
            'score:0',
            'findable_pickups:0/1',
            'assist_charges:Shuffle 1 · Row 1 · Peek 1'
        ]);
    });
});
