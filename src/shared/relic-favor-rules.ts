import type { RunState } from './contracts';

export const RELIC_FAVOR_PER_BONUS_PICK = 3;

const nonNegativeFavorCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const gainRelicFavor = (
    run: RunState,
    favorGain: number
): Pick<RunState, 'bonusRelicPicksNextOffer' | 'favorBonusRelicPicksNextOffer' | 'relicFavorProgress'> => {
    const gain = nonNegativeFavorCount(favorGain);
    if (gain <= 0) {
        return {
            bonusRelicPicksNextOffer: nonNegativeFavorCount(run.bonusRelicPicksNextOffer),
            favorBonusRelicPicksNextOffer: nonNegativeFavorCount(run.favorBonusRelicPicksNextOffer),
            relicFavorProgress: nonNegativeFavorCount(run.relicFavorProgress) % RELIC_FAVOR_PER_BONUS_PICK
        };
    }
    const totalFavor = nonNegativeFavorCount(run.relicFavorProgress) + gain;
    const bonusPicks = Math.floor(totalFavor / RELIC_FAVOR_PER_BONUS_PICK);
    return {
        bonusRelicPicksNextOffer: nonNegativeFavorCount(run.bonusRelicPicksNextOffer) + bonusPicks,
        favorBonusRelicPicksNextOffer: nonNegativeFavorCount(run.favorBonusRelicPicksNextOffer) + bonusPicks,
        relicFavorProgress: totalFavor % RELIC_FAVOR_PER_BONUS_PICK
    };
};
