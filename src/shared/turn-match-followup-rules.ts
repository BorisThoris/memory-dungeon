import type { RouteNodeType, RunState } from './contracts';
import { loadedGatewayRouteTypeFor } from './loaded-gateway-rules';
import { hasMutator } from './mutators';
import { createRouteCardPlanForRoute } from './route-card-plan-rules';

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
    const nBackMatchCounter = run.nBackMatchCounter + 1;
    const nBackAnchorPairKey =
        hasMutator(run, 'n_back_anchor') && nBackMatchCounter % 2 === 0 ? encoreKey : run.nBackAnchorPairKey;
    const loadedGatewayRouteType = loadedGatewayClaimed ? loadedGatewayRouteTypeFor(run, matchedPairKey) : null;

    const pendingRouteCardPlan =
        run.pendingRouteCardPlan == null && loadedGatewayRouteType
            ? createRouteCardPlanForRoute(
                  run,
                  loadedGatewayRouteType,
                  `loaded_gateway:${run.runRulesVersion}:${run.runSeed}:${run.board?.level ?? run.stats.highestLevel}:${matchedPairKey}`
              )
            : run.pendingRouteCardPlan == null && dungeonGatewayRouteType
            ? createRouteCardPlanForRoute(
                  run,
                  dungeonGatewayRouteType,
                  `gateway:${run.runRulesVersion}:${run.runSeed}:${run.board?.level ?? run.stats.highestLevel}:${dungeonGatewayRouteType}`
              )
            : run.pendingRouteCardPlan;

    return {
        nBackMatchCounter,
        nBackAnchorPairKey,
        pendingRouteCardPlan
    };
};
