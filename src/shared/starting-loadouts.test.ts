import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './game-core';
import {
    STARTING_LOADOUT_IDS,
    STARTING_LOADOUTS,
    applyStartingLoadout,
    getRunStartingLoadoutRow,
    getStartingLoadoutRows
} from './starting-loadouts';

describe('starting loadouts', () => {
    it('defines distinct early-run identities', () => {
        const rows = getStartingLoadoutRows();

        expect(Object.keys(STARTING_LOADOUTS)).toEqual([...STARTING_LOADOUT_IDS]);
        expect(rows.map((row) => row.id)).toEqual([...STARTING_LOADOUT_IDS]);
        expect(new Set(rows.map((row) => row.firstFloorDecision)).size).toBe(4);
        for (const row of rows) {
            expect(row.impactSignals.map((signal) => signal.tone)).toEqual(['resource', 'build', 'payoff']);
            expect(row.impactSignals.every((signal) => signal.label.length > 0 && signal.value.length > 0)).toBe(true);
        }
    });

    it('applies deterministic starting resources without changing default runs', () => {
        const base = createNewRun(0, { runSeed: 91_001 });
        const scout = createNewRun(0, { runSeed: 91_001, startingLoadoutId: 'memory_scout' });
        const tactician = createNewRun(0, { runSeed: 91_001, startingLoadoutId: 'route_tactician' });
        const cursebreaker = createNewRun(0, { runSeed: 91_001, startingLoadoutId: 'cursebreaker' });
        const vaultbreaker = createNewRun(0, { runSeed: 91_001, startingLoadoutId: 'vaultbreaker' });

        expect(base.startingLoadoutId).toBeNull();
        expect(scout.peekCharges).toBe(base.peekCharges + 1);
        expect(scout.flashPairCharges).toBe(base.flashPairCharges + 1);
        expect(tactician.regionShuffleCharges).toBe(base.regionShuffleCharges + 1);
        expect(tactician.regionShuffleFreeThisFloor).toBe(true);
        expect(tactician.rewardPerkIds).toContain('free_first_swap_per_floor');
        expect(cursebreaker.destroyPairCharges).toBe(base.destroyPairCharges + 1);
        expect(cursebreaker.stats.guardTokens).toBe(base.stats.guardTokens + 1);
        expect(vaultbreaker.dungeonKeys.iron).toBe(1);
        expect(vaultbreaker.shopGold).toBe(base.shopGold + 1);
        expect(tactician.board?.tiles.map((tile) => tile.tileTraitKind ?? null)).not.toEqual(
            base.board?.tiles.map((tile) => tile.tileTraitKind ?? null)
        );
    });

    it('treats malformed reward perks as empty before applying route tactician', () => {
        const run = {
            ...createNewRun(0, { runSeed: 91_002 }),
            rewardPerkIds: Number.NaN as unknown as RunState['rewardPerkIds']
        };

        const tactician = applyStartingLoadout(run, 'route_tactician');

        expect(tactician.rewardPerkIds).toEqual(['free_first_swap_per_floor']);
    });

    it('returns player-facing rows for active loadouts only', () => {
        const run = applyStartingLoadout(createNewRun(0), 'vaultbreaker');

        expect(getRunStartingLoadoutRow(run)).toMatchObject({
            id: 'vaultbreaker',
            label: 'Vaultbreaker',
            impactSignals: expect.arrayContaining([
                expect.objectContaining({ label: 'Starts', value: '+1 iron key, +1 gold' }),
                expect.objectContaining({ label: 'Payoff', value: 'Greed routes earlier' })
            ])
        });
        expect(getRunStartingLoadoutRow(createNewRun(0))).toBeNull();
    });
});
