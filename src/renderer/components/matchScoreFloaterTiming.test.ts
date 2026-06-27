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
});
