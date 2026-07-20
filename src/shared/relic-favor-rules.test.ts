import { describe, expect, it } from 'vitest';

import { createNewRun } from './game-core';
import { gainRelicFavor, RELIC_FAVOR_PER_BONUS_PICK } from './relic-favor-rules';

describe('relic favor rules', () => {
    it('preserves favor counters when no favor is gained', () => {
        const run = {
            ...createNewRun(0),
            bonusRelicPicksNextOffer: 2,
            favorBonusRelicPicksNextOffer: 1,
            relicFavorProgress: 2
        };

        expect(gainRelicFavor(run, 0)).toEqual({
            bonusRelicPicksNextOffer: 2,
            favorBonusRelicPicksNextOffer: 1,
            relicFavorProgress: 2
        });
    });

    it('rolls favor progress into bonus relic picks', () => {
        const run = {
            ...createNewRun(0),
            bonusRelicPicksNextOffer: 1,
            favorBonusRelicPicksNextOffer: 1,
            relicFavorProgress: RELIC_FAVOR_PER_BONUS_PICK - 1
        };

        expect(gainRelicFavor(run, 2)).toEqual({
            bonusRelicPicksNextOffer: 2,
            favorBonusRelicPicksNextOffer: 2,
            relicFavorProgress: 1
        });
    });

    it('normalizes malformed favor counters even when no favor is gained', () => {
        const run = {
            ...createNewRun(0),
            bonusRelicPicksNextOffer: Number.NaN,
            favorBonusRelicPicksNextOffer: -4,
            relicFavorProgress: Number.POSITIVE_INFINITY
        };

        expect(gainRelicFavor(run, Number.NEGATIVE_INFINITY)).toEqual({
            bonusRelicPicksNextOffer: 0,
            favorBonusRelicPicksNextOffer: 0,
            relicFavorProgress: 0
        });
    });

    it('normalizes malformed favor counters before rolling gained favor', () => {
        const run = {
            ...createNewRun(0),
            bonusRelicPicksNextOffer: -1,
            favorBonusRelicPicksNextOffer: Number.NaN,
            relicFavorProgress: 2.5
        };

        expect(gainRelicFavor(run, 1.5)).toEqual({
            bonusRelicPicksNextOffer: 1,
            favorBonusRelicPicksNextOffer: 1,
            relicFavorProgress: 0
        });
    });
});
