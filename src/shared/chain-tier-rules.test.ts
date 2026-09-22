import { describe, expect, it } from 'vitest';
import {
    CHAIN_TIER_CLEAN_FROM,
    CHAIN_TIER_FEVER_FROM,
    CHAIN_TIER_SHARP_FROM,
    chainCanBreakChunk,
    chainRungApproach,
    chainTierRungs,
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
        // Twelve pairs: Clean 3, Sharp 6, Fever 8 - both shares clear their fixed minimums on a
        // floor this size, so the rungs are where the floor puts them rather than where the
        // minimum does.
        expect(chainMeter(0, 12)).toMatchObject({ tier: 'none', fill: 0, full: false, feverAt: 8 });
        expect(chainMeter(6, 12)).toMatchObject({ tier: 'sharp', full: false });
        expect(chainMeter(6, 12).fill).toBeCloseTo(6 / 8);
        expect(chainMeter(6, 12).ticks.clean).toBeCloseTo(3 / 8);
        expect(chainMeter(6, 12).ticks.sharp).toBeCloseTo(6 / 8);
        expect(chainMeter(8, 12)).toMatchObject({ tier: 'fever', fill: 1, full: true });
        expect(chainMeter(11, 12)).toMatchObject({ fill: 1, full: true, momentum: 11 });
        expect(chainMeter(Number.NaN, 12).fill).toBe(0);
    });

    it('treats garbage as no chain rather than as Fever', () => {
        expect(getChainTier(Number.NaN)).toBe('none');
        expect(getChainTier(-3)).toBe('none');
    });
});

describe('the rung the chain is climbing to', () => {
    it('names the next rung all the way up the ladder, and nothing above Fever', () => {
        expect(chainRungApproach(0)).toMatchObject({ next: 'clean', away: CHAIN_TIER_CLEAN_FROM });
        expect(chainRungApproach(CHAIN_TIER_CLEAN_FROM).next).toBe('sharp');
        expect(chainRungApproach(CHAIN_TIER_SHARP_FROM).next).toBe('fever');
        // At Fever there is nothing left to climb to, and nothing to lean on.
        expect(chainRungApproach(CHAIN_TIER_FEVER_FROM)).toEqual({ next: null, away: 0, imminent: false });
        expect(chainRungApproach(CHAIN_TIER_FEVER_FROM + 20).imminent).toBe(false);
    });

    it('leans only on the pair that actually lands the rung', () => {
        // A threshold that lights two away is a threshold nobody believes the third time.
        expect(chainRungApproach(CHAIN_TIER_CLEAN_FROM - 2).imminent).toBe(false);
        expect(chainRungApproach(CHAIN_TIER_CLEAN_FROM - 1)).toMatchObject({ next: 'clean', imminent: true });
        expect(chainRungApproach(CHAIN_TIER_CLEAN_FROM).imminent).toBe(false);
    });

    it('measures against the floor it is played on, not a fixed ladder', () => {
        // A small floor moves Sharp and Fever down; the lean-in has to move with them or it fires
        // on a rung that is already behind the player.
        const small = chainRungApproach(3, 12);
        expect(small.next).toBe('sharp');
        expect(small.away).toBe(chainTierRungs(12).sharp - 3);
        expect(chainRungApproach(chainTierRungs(12).fever - 1, 12).imminent).toBe(true);
    });

    it('agrees with the copy the HUD prints, and with the meter under it', () => {
        for (const momentum of [0, 1, 2, 5, 9, 10, 30]) {
            const approach = chainRungApproach(momentum);
            const rungAt = nextChainTierAt(momentum);
            expect(approach.next === null).toBe(rungAt === null);
            if (rungAt !== null) {
                expect(approach.away).toBe(rungAt - momentum);
            }
            // Never both "at the top" and "one away", which would light a rung already passed.
            expect(approach.imminent && chainMeter(momentum).full).toBe(false);
        }
    });

    it('reads garbage as the bottom of the ladder, not as an imminent Fever', () => {
        expect(chainRungApproach(Number.NaN)).toEqual(chainRungApproach(0));
        expect(chainRungApproach(-9).next).toBe('clean');
    });
});
