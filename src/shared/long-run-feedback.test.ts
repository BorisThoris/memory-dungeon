import { describe, expect, it } from 'vitest';
import { createNewRun } from './game-core';
import {
    LONG_RUN_TERMINOLOGY_ROWS,
    SAFE_EXPANSION_IMPACT_ROWS,
    WARD_CACHE_CONTRACT_ROW,
    getFindableDistributionRows,
    getInRunCauseRows,
    getPerfectMemoryAttribution,
    getTouchHudDetailRows
} from './long-run-feedback';

describe('GLD-FB long-run feedback read models', () => {
    it('attributes Perfect Memory locks without adding scoring side effects', () => {
        const run = {
            ...createNewRun(0, { runSeed: 91_001, activeMutators: [] }),
            powersUsedThisRun: true,
            gambitThirdFlipUsed: true,
            stats: {
                ...createNewRun(0, { runSeed: 91_001, activeMutators: [] }).stats,
                shufflesUsed: 1
            }
        };

        expect(getPerfectMemoryAttribution(run)).toEqual({
            locked: true,
            firstAction: 'gambit',
            latestAction: 'shuffle',
            summary: 'Perfect Memory locked by gambit.',
            tokens: ['locked', 'forfeit']
        });
    });

    it('builds shared cause rows and touch HUD detail rows from the run state', () => {
        const run = {
            ...createNewRun(0, { runSeed: 91_002, activeMutators: [] }),
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
            hazardTileTriggersThisFloor: 2,
            safeHazardWardsUsedThisFloor: 1,
            safeHazardWardChargesThisFloor: 1,
            shopGold: 3,
            stats: {
                ...createNewRun(0, { runSeed: 91_002, activeMutators: [] }).stats,
                comboShards: 1,
                guardTokens: 1
            }
        };

        expect(getInRunCauseRows(run).map((row) => row.id)).toEqual(
            expect.arrayContaining(['findables-claimed', 'hazard-events', 'economy'])
        );
        expect(getTouchHudDetailRows(run).map((row) => row.id)).toEqual([
            'objective',
            'hazard',
            'boss',
            'route',
            'perfect_memory',
            'economy'
        ]);
    });

    it('publishes terminology and safe expansion contract matrices', () => {
        expect(LONG_RUN_TERMINOLOGY_ROWS.map((row) => row.id)).toEqual([
            'trap_card',
            'hazard_tile',
            'decoy',
            'enemy_patrol',
            'route_special',
            'dungeon_card',
            'objective'
        ]);
        expect(SAFE_EXPANSION_IMPACT_ROWS).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'ward_spark', runtimeStatus: 'wired' }),
                expect.objectContaining({ id: 'scout_glint', runtimeStatus: 'wired' }),
                expect.objectContaining({ id: 'ward_cache', runtimeStatus: 'read_model_only' })
            ])
        );
        expect(WARD_CACHE_CONTRACT_ROW.surface).toBe('hazard_reward_contract');
    });

    it('reports weighted findable distribution targets and active floor counts', () => {
        const base = createNewRun(0, { runSeed: 91_003, activeMutators: [] });
        const firstPair = base.board!.tiles.slice(0, 2).map((tile) => ({
            ...tile,
            pairKey: 'weighted-a',
            findableKind: 'ward_spark' as const
        }));
        const run = {
            ...base,
            board: {
                ...base.board!,
                tiles: [...firstPair, ...base.board!.tiles.slice(2)]
            }
        };

        expect(getFindableDistributionRows(run)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'shard_spark', spawnWeight: 35, targetShare: 0.35 }),
                expect.objectContaining({ id: 'score_glint', spawnWeight: 35, targetShare: 0.35 }),
                expect.objectContaining({ id: 'ward_spark', spawnWeight: 15, targetShare: 0.15, totalThisFloor: 1 }),
                expect.objectContaining({ id: 'scout_glint', spawnWeight: 15, targetShare: 0.15 })
            ])
        );
    });
});
