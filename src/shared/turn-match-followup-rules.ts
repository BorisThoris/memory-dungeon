import type { RouteNodeType, RunState } from './contracts';
import { loadedGatewayRouteTypeFor } from './loaded-gateway-rules';
import { hasMutator } from './mutators';
import { createRouteCardPlanForRoute } from './route-card-plan-rules';
import { normalizeSessionStats } from './session-stats-rules';

const nonNegativeFollowupCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

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
    const nBackMatchCounter = nonNegativeFollowupCount(run.nBackMatchCounter) + 1;
    const nBackAnchorPairKey =
        hasMutator(run, 'n_back_anchor') && nBackMatchCounter % 2 === 0 ? encoreKey : run.nBackAnchorPairKey;
    const loadedGatewayRouteType = loadedGatewayClaimed ? loadedGatewayRouteTypeFor(run, matchedPairKey) : null;
    const sourceLevel = run.board?.level ?? normalizeSessionStats(run.stats).highestLevel;

    const pendingRouteCardPlan =
        run.pendingRouteCardPlan == null && loadedGatewayRouteType
            ? createRouteCardPlanForRoute(
                  run,
                  loadedGatewayRouteType,
                  `loaded_gateway:${run.runRulesVersion}:${run.runSeed}:${sourceLevel}:${matchedPairKey}`
              )
            : run.pendingRouteCardPlan == null && dungeonGatewayRouteType
            ? createRouteCardPlanForRoute(
                  run,
                  dungeonGatewayRouteType,
                  `gateway:${run.runRulesVersion}:${run.runSeed}:${sourceLevel}:${dungeonGatewayRouteType}`
              )
            : run.pendingRouteCardPlan;

    return {
        nBackMatchCounter,
        nBackAnchorPairKey,
        pendingRouteCardPlan
    };
};
