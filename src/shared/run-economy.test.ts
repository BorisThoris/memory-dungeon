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
            'shop_gold',
            'score',
            'combo_shards',
            'guard_tokens',
            'relic_favor',
            'dungeon_keys',
            'findable_pickups',
            'assist_charges'
        ]);
        expect(runEconomyDefinitionById.shop_gold.persistence).toBe('temporary_run');
        expect(runEconomyDefinitionById.score.persistence).toBe('run_summary');
        expect(runEconomyDefinitionById.combo_shards.persistence).toBe('temporary_run');
        expect(runEconomyDefinitionById.relic_favor.sink).toContain('extra relic pick');
        expect(runEconomyDefinitionById.dungeon_keys.source).toContain('key cache rooms');
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
                totalScore: 120,
                comboShards: 1,
                guardTokens: 1
            }
        };
        const snapshot = getRunEconomySnapshot(run);

        expect(snapshot.score.value).toBe('120');
        expect(snapshot.temporaryRunCurrencies.map((entry) => entry.id)).toEqual([
            'shop_gold',
            'combo_shards',
            'guard_tokens',
            'relic_favor',
            'dungeon_keys',
            'findable_pickups',
            'assist_charges'
        ]);
        expect(getRunEconomyRows(run).map((row) => `${row.key}:${row.value}`)).toEqual([
            'shop_gold:0',
            'score:120',
            'combo_shards:1/2',
            'guard_tokens:1/2',
            'relic_favor:2/3',
            'dungeon_keys:1 keys · 1 master',
            'findable_pickups:1/2',
            'assist_charges:Shuffle 1 · Row 1 · Destroy 0 · Peek 1 · Stray 0'
        ]);
    });

    it('normalizes malformed counters before projecting economy rows', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            shopGold: Number.POSITIVE_INFINITY,
            relicFavorProgress: Number.NaN,
            dungeonKeys: Number.NaN as unknown as RunState['dungeonKeys'],
            dungeonMasterKeys: Number.NaN,
            findablesClaimedThisFloor: Number.NaN,
            findablesTotalThisFloor: Number.POSITIVE_INFINITY,
            shuffleCharges: Number.NaN,
            regionShuffleCharges: 1.9,
            destroyPairCharges: Number.POSITIVE_INFINITY,
            peekCharges: -4,
            strayRemoveCharges: 2.9,
            stats: {
                ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })).stats,
                totalScore: Number.POSITIVE_INFINITY,
                comboShards: Number.NaN,
                guardTokens: 1.9
            }
        };

        const rows = getRunEconomyRows(run);

        expect(rows.map((row) => `${row.key}:${row.value}`)).toEqual([
            'shop_gold:0',
            'score:0',
            'combo_shards:0/2',
            'guard_tokens:1/2',
            'relic_favor:0/3',
            'dungeon_keys:0 keys · 0 master',
            'findable_pickups:0/0',
            'assist_charges:Shuffle 0 · Row 1 · Destroy 0 · Peek 0 · Stray 2'
        ]);
        expect(rows.map((row) => row.numericValue).every(Number.isFinite)).toBe(true);
    });

    it('normalizes malformed stat records before projecting economy rows', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            stats: Number.NaN as unknown as RunState['stats']
        };

        expect(getRunEconomyRows(run).map((row) => `${row.key}:${row.value}`)).toEqual([
            'shop_gold:0',
            'score:0',
            'combo_shards:0/2',
            'guard_tokens:0/2',
            'relic_favor:0/3',
            'dungeon_keys:0 keys · 0 master',
            'findable_pickups:0/1',
            'assist_charges:Shuffle 1 · Row 1 · Destroy 0 · Peek 1 · Stray 0'
        ]);
    });
});
