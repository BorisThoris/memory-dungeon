import type { RunState } from './contracts';
import { hasMutator } from './mutators';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';
import {
    getRelicDraftOptionReasons,
    getRelicOfferServiceActions,
    needsRelicPick,
    relicMilestoneIndexForFloor,
    rollRelicOptions,
    skipRelicOfferMilestone
} from './relics';

export const MAX_RELIC_PICKS_PER_OFFER = 3;

const recurringRelicPickBonusCount = (run: RunState): number => {
    let count = 0;
    if (hasMutator(run, 'generous_shrine')) {
        count += 1;
    }
    if (run.gameMode === 'daily') {
        count += 1;
    }
    count += runNonNegativeInteger(run.metaRelicDraftExtraPerMilestone);
    if (run.activeContract?.bonusRelicDraftPick) {
        count += 1;
    }
    return count;
};

export const computeRelicOfferPickBudget = (run: RunState): number => {
    const bankedBonusPicks = runNonNegativeInteger(run.bonusRelicPicksNextOffer);
    const total = 1 + bankedBonusPicks + recurringRelicPickBonusCount(run);
    return Math.max(1, Math.min(MAX_RELIC_PICKS_PER_OFFER, total));
};

/**
 * Core-independent deterministic transition for opening a milestone relic draft.
 * Command reduction and legacy callers share this rule without introducing a
 * dependency from the rule layer back into the gameplay command adapters.
 */
export const openRelicOffer = (run: RunState): RunState => {
    if (!needsRelicPick(run) || run.relicOffer) {
        return run;
    }
    const cleared = run.lastLevelResult!.level;
    const tierIndex = relicMilestoneIndexForFloor(cleared);
    if (tierIndex === null) {
        return run;
    }
    const picksRemaining = computeRelicOfferPickBudget(run);
    const bankedBonusPicks = runNonNegativeInteger(run.bonusRelicPicksNextOffer);
    const consumedBankedBonusPicks = Math.min(bankedBonusPicks, decrementRunCounter(picksRemaining));
    const favorBonusPicks = runNonNegativeInteger(run.favorBonusRelicPicksNextOffer);
    const consumedFavorBonusPicks = Math.min(favorBonusPicks, consumedBankedBonusPicks);
    const options = rollRelicOptions(run, tierIndex, cleared, 0);
    if (options.length === 0) {
        return skipRelicOfferMilestone(run);
    }
    const contextualOptionReasons = getRelicDraftOptionReasons(run, cleared, options);

    return {
        ...run,
        bonusRelicPicksNextOffer: Math.max(0, bankedBonusPicks - consumedBankedBonusPicks),
        favorBonusRelicPicksNextOffer: Math.max(0, favorBonusPicks - consumedFavorBonusPicks),
        relicOffer: {
            tier: tierIndex + 1,
            options,
            picksRemaining,
            pickRound: 0,
            services: getRelicOfferServiceActions({
                ...run,
                relicOffer: {
                    tier: tierIndex + 1,
                    options,
                    picksRemaining,
                    pickRound: 0
                }
            }),
            favorBonusPicks: consumedFavorBonusPicks,
            contextualOptionReasons
        }
    };
};
