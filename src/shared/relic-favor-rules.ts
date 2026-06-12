import type { RunState } from './contracts';

export const RELIC_FAVOR_PER_BONUS_PICK = 3;

export const gainRelicFavor = (
    run: RunState,
    favorGain: number
): Pick<RunState, 'bonusRelicPicksNextOffer' | 'favorBonusRelicPicksNextOffer' | 'relicFavorProgress'> => {
    if (favorGain <= 0) {
        return {
            bonusRelicPicksNextOffer: run.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: run.favorBonusRelicPicksNextOffer,
            relicFavorProgress: run.relicFavorProgress
        };
    }
    const totalFavor = run.relicFavorProgress + favorGain;
    const bonusPicks = Math.floor(totalFavor / RELIC_FAVOR_PER_BONUS_PICK);
    return {
        bonusRelicPicksNextOffer: run.bonusRelicPicksNextOffer + bonusPicks,
        favorBonusRelicPicksNextOffer: run.favorBonusRelicPicksNextOffer + bonusPicks,
        relicFavorProgress: totalFavor % RELIC_FAVOR_PER_BONUS_PICK
    };
};
