import type { RouteCardPlan, RouteChoice, RouteNodeType, RunState } from './contracts';
import { normalizeSessionStats } from './session-stats-rules';

export const createRouteCardPlanForRoute = (
    run: RunState,
    routeType: RouteNodeType,
    choiceId: string
): RouteCardPlan => {
    const sourceLevel = run.lastLevelResult?.level ?? run.board?.level ?? normalizeSessionStats(run.stats).highestLevel;
    return {
        choiceId,
        routeType,
        sourceLevel,
        targetLevel: sourceLevel + 1
    };
};

export const createRouteCardPlan = (run: RunState, choice: RouteChoice): RouteCardPlan =>
    createRouteCardPlanForRoute(run, choice.routeType, choice.id);
