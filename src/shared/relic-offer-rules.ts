import type { RelicId, RelicOfferServiceId, RunState } from './contracts';
import { hasMutator } from './mutators';
import {
    applyRelicOfferService,
    getRelicDraftOptionReasons,
    getRelicOfferServiceActions,
    isRelicDraftEligible,
    needsRelicPick,
    relicMilestoneIndexForFloor,
    rollRelicOptions,
    skipRelicOfferMilestone
} from './relics';
import { applyRelicImmediate } from './relic-immediate-rules';

export const MAX_RELIC_PICKS_PER_OFFER = 3;

/** Total relic selections this milestone visit (minimum 1). See `openRelicOffer`. */
const nonNegativeFiniteInteger = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const recurringRelicPickBonusCount = (run: RunState): number => {
    let n = 0;
    if (hasMutator(run, 'generous_shrine')) {
        n += 1;
    }
    if (run.gameMode === 'daily') {
        n += 1;
    }
    n += nonNegativeFiniteInteger(run.metaRelicDraftExtraPerMilestone);
    if (run.activeContract?.bonusRelicDraftPick) {
        n += 1;
    }
    return n;
};

export const computeRelicOfferPickBudget = (run: RunState): number => {
    const bankedBonusPicks = nonNegativeFiniteInteger(run.bonusRelicPicksNextOffer);
    const total = 1 + bankedBonusPicks + recurringRelicPickBonusCount(run);
    return Math.max(1, Math.min(MAX_RELIC_PICKS_PER_OFFER, total));
};

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
    const bankedBonusPicks = nonNegativeFiniteInteger(run.bonusRelicPicksNextOffer);
    const consumedBankedBonusPicks = Math.min(bankedBonusPicks, Math.max(0, picksRemaining - 1));
    const favorBonusPicks = nonNegativeFiniteInteger(run.favorBonusRelicPicksNextOffer);
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

export type RelicPickAdvanceResult =
    | { kind: 'unchanged'; run: RunState }
    | { kind: 'offerContinues'; run: RunState }
    | { kind: 'advanceToNextLevel'; run: RunState };

export const createRelicPickAdvanceResult = (run: RunState, relicId: RelicId): RelicPickAdvanceResult => {
    if (run.status !== 'levelComplete' || run.lives <= 0) {
        return { kind: 'unchanged', run };
    }
    const offer = run.relicOffer;
    if (!offer?.options.includes(relicId) || !isRelicDraftEligible(relicId, run)) {
        return { kind: 'unchanged', run };
    }

    let next: RunState = {
        ...run,
        relicIds: [...run.relicIds, relicId]
    };
    next = applyRelicImmediate(next, relicId);

    const remainingAfter = Math.max(0, nonNegativeFiniteInteger(offer.picksRemaining) - 1);

    if (remainingAfter > 0) {
        const cleared = run.lastLevelResult!.level;
        const tierIndex = relicMilestoneIndexForFloor(cleared);
        if (tierIndex === null) {
            return { kind: 'unchanged', run };
        }
        const newPickRound = nonNegativeFiniteInteger(offer.pickRound) + 1;
        const newOptions = rollRelicOptions(next, tierIndex, cleared, newPickRound);
        const contextualOptionReasons = getRelicDraftOptionReasons(next, cleared, newOptions);
        if (newOptions.length === 0) {
            return {
                kind: 'advanceToNextLevel',
                run: {
                    ...next,
                    relicTiersClaimed: nonNegativeFiniteInteger(run.relicTiersClaimed) + 1,
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
            relicTiersClaimed: nonNegativeFiniteInteger(run.relicTiersClaimed) + 1,
            relicOffer: null
        }
    };
};

export const applyRelicOfferServiceToRun = (
    run: RunState,
    serviceId: RelicOfferServiceId,
    targetRelicId?: RelicId
): RunState => {
    const result = applyRelicOfferService(run, serviceId, targetRelicId);
    return result.applied ? result.run : run;
};

export const useRelicOfferService = applyRelicOfferServiceToRun;
