import { describe, expect, it } from 'vitest';
import {
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS,
    MATCH_SCORE_FLOAT_MS_FULL,
    MATCH_SCORE_FLOAT_MS_REDUCED,
    matchScoreFloatDurationMs
} from './matchScoreFloaterTiming';

describe('matchScoreFloaterTiming', () => {
    it('keeps full and reduced motion timings explicit and fallback-safe', () => {
        expect(matchScoreFloatDurationMs(false)).toBe(MATCH_SCORE_FLOAT_MS_FULL);
        expect(matchScoreFloatDurationMs(true)).toBe(MATCH_SCORE_FLOAT_MS_REDUCED);
        expect(MATCH_SCORE_FLOAT_MS_REDUCED).toBeLessThan(MATCH_SCORE_FLOAT_MS_FULL);
        expect(MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS).toBeGreaterThan(0);
    });

    it('holds richer reward floaters longer without slowing simple score or miss pops', () => {
        expect(matchScoreFloatDurationMs(false, { kind: 'match', crescendo: { tier: 'score' } })).toBe(
            MATCH_SCORE_FLOAT_MS_FULL
        );
        expect(matchScoreFloatDurationMs(false, { kind: 'miss' })).toBe(MATCH_SCORE_FLOAT_MS_FULL);
        expect(
            matchScoreFloatDurationMs(false, {
                chainMilestone: {},
                crescendo: { tier: 'stack' },
                kind: 'match',
                payoffLaneMap: [{}, {}],
                rewardBurst: {}
            })
        ).toBeGreaterThan(MATCH_SCORE_FLOAT_MS_FULL + 600);
        expect(
            matchScoreFloatDurationMs(false, {
                crescendo: { tier: 'super' },
                kind: 'match',
                payoffLaneMap: [{}, {}, {}, {}],
                rewardBurst: {}
            })
        ).toBeGreaterThan(matchScoreFloatDurationMs(false, { crescendo: { tier: 'cashout' }, kind: 'match' }));
    });

    it('scales reward hold bonuses down for reduced motion', () => {
        const full = matchScoreFloatDurationMs(false, {
            crescendo: { tier: 'super' },
            kind: 'match',
            payoffLaneMap: [{}, {}, {}],
            rewardBurst: {}
        });
        const reduced = matchScoreFloatDurationMs(true, {
            crescendo: { tier: 'super' },
            kind: 'match',
            payoffLaneMap: [{}, {}, {}],
            rewardBurst: {}
        });

        expect(reduced).toBeGreaterThan(MATCH_SCORE_FLOAT_MS_REDUCED);
        expect(reduced).toBeLessThan(full);
    });

    it('ignores malformed payoff lane maps before adding lane hold time', () => {
        expect(
            matchScoreFloatDurationMs(false, {
                crescendo: { tier: 'score' },
                kind: 'match',
                payoffLaneMap: { length: Number.POSITIVE_INFINITY } as unknown as []
            })
        ).toBe(MATCH_SCORE_FLOAT_MS_FULL);
    });
});
