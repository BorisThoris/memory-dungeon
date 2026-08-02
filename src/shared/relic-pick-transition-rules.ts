import type { RelicId, RunState } from './contracts';
import {
    getRelicDraftOptionReasons,
    getRelicOfferServiceActions,
    isRelicDraftEligible,
    relicMilestoneIndexForFloor,
    rollRelicOptions,
    runRelicIds
} from './relics';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

export type RelicPickTransitionResult =
    | { kind: 'unchanged'; run: RunState }
    | { kind: 'offerContinues'; run: RunState }
    | { kind: 'advanceToNextLevel'; run: RunState };

/**
 * Pure relic ownership/offer transition. The caller supplies the immediate
 * relic effect so legacy and command-core paths can share draft progression
 * without either layer importing the other.
 */
export const createRelicPickTransitionResult = (
    run: RunState,
    relicId: RelicId,
    applyImmediate: (ownedRun: RunState, relicId: RelicId) => RunState
): RelicPickTransitionResult => {
    if (run.status !== 'levelComplete' || runNonNegativeInteger(run.lives) <= 0) {
        return { kind: 'unchanged', run };
    }
    const offer = run.relicOffer;
    if (!offer?.options.includes(relicId) || !isRelicDraftEligible(relicId, run)) {
        return { kind: 'unchanged', run };
    }

    const ownedRun: RunState = {
        ...run,
        relicIds: [...runRelicIds(run.relicIds), relicId]
    };
    const next = applyImmediate(ownedRun, relicId);
    const remainingAfter = decrementRunCounter(offer.picksRemaining);

    if (remainingAfter > 0) {
        const cleared = run.lastLevelResult!.level;
        const tierIndex = relicMilestoneIndexForFloor(cleared);
        if (tierIndex === null) {
            return { kind: 'unchanged', run };
        }
        const newPickRound = runNonNegativeInteger(offer.pickRound) + 1;
        const newOptions = rollRelicOptions(next, tierIndex, cleared, newPickRound);
        const contextualOptionReasons = getRelicDraftOptionReasons(next, cleared, newOptions);
        if (newOptions.length === 0) {
            return {
                kind: 'advanceToNextLevel',
                run: {
                    ...next,
                    relicTiersClaimed: runNonNegativeInteger(run.relicTiersClaimed) + 1,
                    relicOffer: null
                }
            };
        }
        return {
            kind: 'offerContinues',
            run: {
                ...next,
                relicOffer: {
                    tier: offer.tier,
                    options: newOptions,
                    picksRemaining: remainingAfter,
                    pickRound: newPickRound,
                    serviceUses: offer.serviceUses,
                    bannedRelicIds: offer.bannedRelicIds,
                    upgradedOffer: offer.upgradedOffer,
                    services: getRelicOfferServiceActions({
                        ...next,
                        relicOffer: {
                            ...offer,
                            options: newOptions,
                            picksRemaining: remainingAfter,
                            pickRound: newPickRound
                        }
                    }),
                    favorBonusPicks: offer.favorBonusPicks,
                    contextualOptionReasons
                }
            }
        };
    }

    return {
        kind: 'advanceToNextLevel',
        run: {
            ...next,
            relicTiersClaimed: runNonNegativeInteger(run.relicTiersClaimed) + 1,
            relicOffer: null
        }
    };
};
