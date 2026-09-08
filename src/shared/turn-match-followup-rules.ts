import type { RouteNodeType, RunState } from './contracts';
import { loadedGatewayRouteTypeFor } from './loaded-gateway-rules';
import { hasMutator } from './mutators';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export interface TurnMatchFollowupResult {
    nBackMatchCounter: number;
    nBackAnchorPairKey: string | null;
    pendingRouteCardPlan: RunState['pendingRouteCardPlan'];
}

export interface TurnMatchFollowupInput {
    run: RunState;
    matchedPairKey: string;
    encoreKey: string;
    loadedGatewayClaimed: boolean;
    dungeonGatewayRouteType: RouteNodeType | null;
}

export const resolveTurnMatchFollowup = ({
    run,
    matchedPairKey,
    encoreKey,
    loadedGatewayClaimed,
    dungeonGatewayRouteType
}: TurnMatchFollowupInput): TurnMatchFollowupResult => {
    const nBackMatchCounter = runNonNegativeInteger(run.nBackMatchCounter) + 1;
    const nBackAnchorPairKey =
        hasMutator(run, 'n_back_anchor') && nBackMatchCounter % 2 === 0 ? encoreKey : run.nBackAnchorPairKey;
    const loadedGatewayRouteType = loadedGatewayClaimed ? loadedGatewayRouteTypeFor(run, matchedPairKey) : null;
    const sourceLevel = run.board?.level ?? normalizeSessionStats(run.stats).highestLevel;

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
