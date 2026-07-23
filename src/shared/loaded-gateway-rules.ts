import type { RouteNodeType, RunState } from './contracts';
import { hashStringToSeed } from './rng';
import { normalizeSessionStats } from './session-stats-rules';

export const loadedGatewayRouteTypeFor = (run: RunState, pairKey: string): RouteNodeType => {
    const seed = hashStringToSeed(
        `loadedGateway:${run.runRulesVersion}:${run.runSeed}:${run.board?.level ?? normalizeSessionStats(run.stats).highestLevel}:${pairKey}`
    );
    return Math.abs(seed) % 2 === 0 ? 'mystery' : 'greed';
};
