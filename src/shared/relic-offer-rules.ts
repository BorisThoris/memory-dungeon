import type { RelicId, RelicOfferServiceId, RunState } from './contracts';
import { applyRelicImmediateThroughGameplayCore } from './gameplay-core-adapters';
import { applyRelicOfferService } from './relics';
import {
    createRelicPickTransitionResult,
    type RelicPickTransitionResult
} from './relic-pick-transition-rules';
export {
    MAX_RELIC_PICKS_PER_OFFER,
    computeRelicOfferPickBudget,
    openRelicOffer
} from './relic-offer-open-rules';

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
