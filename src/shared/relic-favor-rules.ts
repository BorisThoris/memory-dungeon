import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

export const RELIC_FAVOR_PER_BONUS_PICK = 3;

type RelicFavorCounters = {
    bonusRelicPicksNextOffer?: RunState['bonusRelicPicksNextOffer'];
    favorBonusRelicPicksNextOffer?: RunState['favorBonusRelicPicksNextOffer'];
    relicFavorProgress?: RunState['relicFavorProgress'];
};

type NormalizedRelicFavorCounters = Required<RelicFavorCounters>;

export const gainRelicFavor = (
    run: RelicFavorCounters,
    favorGain: number
): NormalizedRelicFavorCounters => {
    const gain = runNonNegativeInteger(favorGain);
    if (gain <= 0) {
        return {
            bonusRelicPicksNextOffer: runNonNegativeInteger(run.bonusRelicPicksNextOffer),
            favorBonusRelicPicksNextOffer: runNonNegativeInteger(run.favorBonusRelicPicksNextOffer),
            relicFavorProgress: runNonNegativeInteger(run.relicFavorProgress) % RELIC_FAVOR_PER_BONUS_PICK
        };
    }
    const totalFavor = runNonNegativeInteger(run.relicFavorProgress) + gain;
    const bonusPicks = Math.floor(totalFavor / RELIC_FAVOR_PER_BONUS_PICK);
    return {
        bonusRelicPicksNextOffer: runNonNegativeInteger(run.bonusRelicPicksNextOffer) + bonusPicks,
        favorBonusRelicPicksNextOffer: runNonNegativeInteger(run.favorBonusRelicPicksNextOffer) + bonusPicks,
        relicFavorProgress: totalFavor % RELIC_FAVOR_PER_BONUS_PICK
    };
};
