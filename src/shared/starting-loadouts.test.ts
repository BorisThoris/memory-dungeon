import { describe, expect, it } from 'vitest';
import { createNewRun } from './game-core';
import { STARTING_LOADOUTS, applyStartingLoadout, getRunStartingLoadoutRow } from './starting-loadouts';

describe('starting loadouts', () => {
    it('defines distinct early-run identities', () => {
        expect(Object.keys(STARTING_LOADOUTS)).toEqual([
            'memory_scout',
            'route_tactician',
            'cursebreaker',
            'vaultbreaker'
        ]);
        expect(new Set(Object.values(STARTING_LOADOUTS).map((row) => row.firstFloorDecision)).size).toBe(4);
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
    });

    it('returns player-facing rows for active loadouts only', () => {
        const run = applyStartingLoadout(createNewRun(0), 'vaultbreaker');

        expect(getRunStartingLoadoutRow(run)).toMatchObject({
            id: 'vaultbreaker',
            label: 'Vaultbreaker'
        });
        expect(getRunStartingLoadoutRow(createNewRun(0))).toBeNull();
    });
});
