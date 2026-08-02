import type { RelicId, RelicOfferServiceId, RunState } from './contracts';
import { hasMutator } from './mutators';
import { applyRelicImmediateThroughGameplayCore } from './gameplay-core-adapters';
import {
    applyRelicOfferService,
    getRelicDraftOptionReasons,
    getRelicOfferServiceActions,
    needsRelicPick,
    relicMilestoneIndexForFloor,
    rollRelicOptions,
    skipRelicOfferMilestone
} from './relics';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';
import {
    createRelicPickTransitionResult,
    type RelicPickTransitionResult
} from './relic-pick-transition-rules';

export const MAX_RELIC_PICKS_PER_OFFER = 3;

const recurringRelicPickBonusCount = (run: RunState): number => {
    let n = 0;
    if (hasMutator(run, 'generous_shrine')) {
        n += 1;
    }
    if (run.gameMode === 'daily') {
        n += 1;
    }
    n += runNonNegativeInteger(run.metaRelicDraftExtraPerMilestone);
    if (run.activeContract?.bonusRelicDraftPick) {
        n += 1;
    }
    return n;
};

export const computeRelicOfferPickBudget = (run: RunState): number => {
    const bankedBonusPicks = runNonNegativeInteger(run.bonusRelicPicksNextOffer);
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

export type RelicPickAdvanceResult = RelicPickTransitionResult;

export const createRelicPickAdvanceResult = (run: RunState, relicId: RelicId): RelicPickAdvanceResult =>
    createRelicPickTransitionResult(run, relicId, (ownedRun, selectedRelicId) =>
        applyRelicImmediateThroughGameplayCore(
            ownedRun,
            selectedRelicId,
            `relic-pick:${run.runSeed}:${run.relicOffer?.tier ?? 0}:${run.relicOffer?.pickRound ?? 0}:${selectedRelicId}`
        ).run
    );

export const applyRelicOfferServiceToRun = (
    run: RunState,
    serviceId: RelicOfferServiceId,
    targetRelicId?: RelicId
): RunState => {
    const result = applyRelicOfferService(run, serviceId, targetRelicId);
    return result.applied ? result.run : run;
};

export const useRelicOfferService = applyRelicOfferServiceToRun;
