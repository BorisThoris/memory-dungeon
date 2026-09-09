import { describe, expect, it } from 'vitest';
import { getBreakScoreBreakdown } from './score-terms-rules';
import { chunkBreakScore, chunkScorePerPair } from './chunk-break-rules';

describe('the break score, as the terms it is made of', () => {
    it('names the pairs, the tier and the ripple, and lands on the score the rule awarded', () => {
        const level = 3;
        const breakdown = getBreakScoreBreakdown({ level, pairs: 4, tier: 'clean', waves: 3 });

        expect(breakdown?.perPair).toBe(chunkScorePerPair(level));
        expect(breakdown?.terms.map((term) => term.id)).toEqual(['pairs', 'tier', 'ripple']);
        expect(breakdown?.terms[0]).toMatchObject({ factor: 4 });
        expect(breakdown?.terms[1]).toMatchObject({ factor: 2, tier: 'clean' });
        expect(breakdown?.terms[2]).toMatchObject({ factor: 2.5, waves: 3 });
        // The one assertion that matters: the number the player watches being built is the number
        // the run actually gave them.
        expect(breakdown?.total).toBe(chunkBreakScore(level, 4, 'clean', 3));
        expect(breakdown?.terms.at(-1)?.runningTotal).toBe(breakdown?.total);
    });

    it('climbs: every term is worth at least the one before it', () => {
        const breakdown = getBreakScoreBreakdown({ level: 5, pairs: 6, tier: 'fever', waves: 4 });
        const totals = breakdown?.terms.map((term) => term.runningTotal) ?? [];

        expect(totals.length).toBeGreaterThan(1);
        for (let index = 1; index < totals.length; index += 1) {
            expect(totals[index]!).toBeGreaterThan(totals[index - 1]!);
        }
    });

    it('leaves out a term that multiplies by one, so nothing reads as a payoff that is not one', () => {
        // A pop with no chain behind it and no ripple: pairs and nothing else.
        const pop = getBreakScoreBreakdown({ level: 2, pairs: 2, tier: 'none', waves: 1 });
        expect(pop?.terms.map((term) => term.id)).toEqual(['pairs']);
        expect(pop?.total).toBe(chunkBreakScore(2, 2, 'none', 1));

        // Sharp with one wave: the tier is worth naming, the ripple is not.
        const sharp = getBreakScoreBreakdown({ level: 2, pairs: 2, tier: 'sharp', waves: 1 });
        expect(sharp?.terms.map((term) => term.id)).toEqual(['pairs', 'tier']);
    });

    it('has nothing to build when the turn broke nothing', () => {
        expect(getBreakScoreBreakdown({ level: 3, pairs: 0, tier: 'fever', waves: 1 })).toBeNull();
        expect(getBreakScoreBreakdown({ level: 3, pairs: Number.NaN, tier: 'clean', waves: 2 })).toBeNull();
    });

    it('matches the rule at every tier and wave count it can be asked about', () => {
        for (const tier of ['none', 'clean', 'sharp', 'fever'] as const) {
            for (const waves of [1, 2, 5, 12]) {
                for (const pairs of [1, 3, 12]) {
                    const breakdown = getBreakScoreBreakdown({ level: 7, pairs, tier, waves });
                    expect(breakdown?.total, `${tier} ${waves} waves ${pairs} pairs`).toBe(
                        chunkBreakScore(7, pairs, tier, waves)
                    );
                }
            }
        }
    });
});
