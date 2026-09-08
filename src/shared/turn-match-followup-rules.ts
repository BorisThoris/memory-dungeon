import type { RunState } from './contracts';
import { hasMutator } from './mutators';
import { runNonNegativeInteger } from './run-number-guards';

export interface TurnMatchFollowupResult {
    nBackMatchCounter: number;
    nBackAnchorPairKey: string | null;
    pendingRouteCardPlan: RunState['pendingRouteCardPlan'];
}

export interface TurnMatchFollowupInput {
    run: RunState;
    encoreKey: string;
}

export const resolveTurnMatchFollowup = ({
    run,
    encoreKey
}: TurnMatchFollowupInput): TurnMatchFollowupResult => {
    const nBackMatchCounter = runNonNegativeInteger(run.nBackMatchCounter) + 1;
    const nBackAnchorPairKey =
        hasMutator(run, 'n_back_anchor') && nBackMatchCounter % 2 === 0 ? encoreKey : run.nBackAnchorPairKey;

    /*
     * Matching a gateway pair used to plan the next floor's route from the board - a loaded gateway
     * pinning the route it named, an ordinary one taking the branch it sat on. There are no gateway
     * pairs and there is no route to plan, so the pending plan is whatever it already was, which is
     * nothing. Gen 173.
     */
    const pendingRouteCardPlan = run.pendingRouteCardPlan;

    return {
        nBackMatchCounter,
        nBackAnchorPairKey,
        pendingRouteCardPlan
    };
};
