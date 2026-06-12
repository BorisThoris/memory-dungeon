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
});
