import { describe, expect, it } from 'vitest';
import { CHAIN_CARRYOVER_CAP, carriedChainForNextFloor } from './chain-carryover-rules';
import { CHAIN_TIER_CLEAN_FROM, getChainTier } from './chain-tier-rules';

/*
 * The cap is the whole rule, so it is the thing the cases pin: a chain under it is not touched, a
 * chain over it lands exactly on it, and no chain - however long, onto a board of any size - can
 * arrive holding a tier. The sweep runs every pair count a board can plausibly deal rather than
 * the two or three a hand-picked case would, because the rungs above Clean are a share of the
 * floor and a rule about shares breaks at the edges of the range, not in the middle of it.
 */
describe('the chain carried between floors', () => {
    it('crosses the boundary untouched when the chain is under the cap', () => {
        expect(carriedChainForNextFloor(1)).toBe(1);
        expect(carriedChainForNextFloor(CHAIN_CARRYOVER_CAP)).toBe(CHAIN_CARRYOVER_CAP);
    });

    it('trims a long chain down to the cap rather than wiping it', () => {
        expect(carriedChainForNextFloor(9)).toBe(CHAIN_CARRYOVER_CAP);
        expect(carriedChainForNextFloor(999)).toBe(CHAIN_CARRYOVER_CAP);
        expect(CHAIN_CARRYOVER_CAP).toBeGreaterThan(0);
    });

    it('stops two short of Clean: the clear is one link, not a rung', () => {
        expect(CHAIN_CARRYOVER_CAP).toBe(CHAIN_TIER_CLEAN_FROM - 2);
        // A player arrives one match from Clean rather than three, which is the whole reward.
        expect(carriedChainForNextFloor(999) + 2).toBe(CHAIN_TIER_CLEAN_FROM);
    });

    it('never hands the next floor a tier, at any board size', () => {
        for (let pairs = 2; pairs <= 30; pairs += 1) {
            expect(getChainTier(carriedChainForNextFloor(999), pairs), `${pairs} pairs`).toBe('none');
        }
        expect(getChainTier(carriedChainForNextFloor(999), null)).toBe('none');
    });

    it('carries nothing rather than junk when the streak is malformed', () => {
        expect(carriedChainForNextFloor(Number.NaN)).toBe(0);
        expect(carriedChainForNextFloor(-5)).toBe(0);
        expect(carriedChainForNextFloor(undefined as unknown as number)).toBe(0);
    });
});
