import { describe, expect, it } from 'vitest';
import {
    CHAIN_TIER_CLEAN_FROM,
    CHAIN_TIER_FEVER_FROM,
    CHAIN_TIER_SHARP_FROM,
    chainCanBreakChunk,
    getChainTier,
    nextChainTierAt,
    chainMeter
} from './chain-tier-rules';

describe('the chain ladder', () => {
    it('is a match at one, and earns nothing extra', () => {
        expect(getChainTier(0)).toBe('none');
        expect(getChainTier(1)).toBe('none');
        expect(chainCanBreakChunk(1)).toBe(false);
    });

    it('climbs Clean, Sharp, Fever at the stated rungs', () => {
        expect(getChainTier(CHAIN_TIER_CLEAN_FROM)).toBe('clean');
        expect(getChainTier(CHAIN_TIER_SHARP_FROM - 1)).toBe('clean');
        expect(getChainTier(CHAIN_TIER_SHARP_FROM)).toBe('sharp');
        expect(getChainTier(CHAIN_TIER_FEVER_FROM - 1)).toBe('sharp');
        expect(getChainTier(CHAIN_TIER_FEVER_FROM)).toBe('fever');
        expect(getChainTier(40)).toBe('fever');
    });

    it('names the next rung so the run line can say "one more"', () => {
        expect(nextChainTierAt(1)).toBe(CHAIN_TIER_CLEAN_FROM);
        expect(nextChainTierAt(3)).toBe(CHAIN_TIER_SHARP_FROM);
        expect(nextChainTierAt(6)).toBe(CHAIN_TIER_FEVER_FROM);
        expect(nextChainTierAt(12)).toBeNull();
    });

    it('reads the ladder as one bar with the rungs as ticks, full at Fever', () => {
        // Twelve pairs: Clean 3, Sharp 5, Fever 8.
        expect(chainMeter(0, 12)).toMatchObject({ tier: 'none', fill: 0, full: false, feverAt: 8 });
        expect(chainMeter(5, 12)).toMatchObject({ tier: 'sharp', fill: 0.625, full: false });
        expect(chainMeter(5, 12).ticks).toEqual({ clean: 0.375, sharp: 0.625 });
        expect(chainMeter(8, 12)).toMatchObject({ tier: 'fever', fill: 1, full: true });
        expect(chainMeter(11, 12)).toMatchObject({ fill: 1, full: true, momentum: 11 });
        expect(chainMeter(Number.NaN, 12).fill).toBe(0);
    });

    it('treats garbage as no chain rather than as Fever', () => {
        expect(getChainTier(Number.NaN)).toBe('none');
        expect(getChainTier(-3)).toBe('none');
    });
});
