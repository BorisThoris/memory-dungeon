import { describe, expect, it } from 'vitest';
import { CHAIN_CARRYOVER_CAP, carriedChainForNextFloor } from './chain-carryover-rules';
import { CHAIN_TIER_CLEAN_FROM, getChainTier } from './chain-tier-rules';

/*
 * Since 2026-09-29 the whole chain crosses (the owner asked for the meter to persist until a
 * miss), so what the cases pin is that nothing is trimmed, whatever the length and whatever the
 * board it lands on, and that junk still reads as nothing. The old cap is kept as a documented
 * constant so the reasoning it carried stays findable.
 */
describe('the chain carried between floors', () => {
    it('crosses the boundary untouched, however long it is', () => {
        expect(carriedChainForNextFloor(1)).toBe(1);
        expect(carriedChainForNextFloor(9)).toBe(9);
        expect(carriedChainForNextFloor(999)).toBe(999);
    });

    it('hands the next floor the tier it earned, at any board size', () => {
        for (let pairs = 2; pairs <= 30; pairs += 1) {
            expect(getChainTier(carriedChainForNextFloor(999), pairs), `${pairs} pairs`).toBe('fever');
            expect(getChainTier(carriedChainForNextFloor(1), pairs), `${pairs} pairs`).toBe('none');
        }
    });

    it('keeps the old cap on record, two short of Clean', () => {
        expect(CHAIN_CARRYOVER_CAP).toBe(CHAIN_TIER_CLEAN_FROM - 2);
    });

    it('carries nothing rather than junk when the streak is malformed', () => {
        expect(carriedChainForNextFloor(Number.NaN)).toBe(0);
        expect(carriedChainForNextFloor(-5)).toBe(0);
        expect(carriedChainForNextFloor(undefined as unknown as number)).toBe(0);
    });
});
