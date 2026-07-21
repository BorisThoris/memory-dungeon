import type { RunState } from './contracts';
import { getMemorizePhaseRecallFocusForRoute } from './recall-rules';
import {
    createDungeonRunMapState,
    getCurrentDungeonNode
} from './run-map';
import { normalizeSessionStats } from './session-stats-rules';

export const getRunDungeonMapState = (run: RunState): RunState['dungeonRun'] =>
    run.dungeonRun ??
    createDungeonRunMapState(run.runSeed, run.runRulesVersion, run.board?.level ?? normalizeSessionStats(run.stats).highestLevel);

export const getRunMemorizePhaseRecallFocus = (run: RunState): number => {
    const currentRouteType = getCurrentDungeonNode(getRunDungeonMapState(run))?.routeApproachType;
    return getMemorizePhaseRecallFocusForRoute(run, currentRouteType);
};
