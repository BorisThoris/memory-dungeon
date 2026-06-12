import type { RunState } from './contracts';
import { getMemorizePhaseRecallFocusForRoute } from './recall-rules';
import {
    createDungeonRunMapState,
    getCurrentDungeonNode
} from './run-map';

export const getRunDungeonMapState = (run: RunState): RunState['dungeonRun'] =>
    run.dungeonRun ?? createDungeonRunMapState(run.runSeed, run.runRulesVersion, run.board?.level ?? run.stats.highestLevel);

export const getRunMemorizePhaseRecallFocus = (run: RunState): number => {
    const currentRouteType = getCurrentDungeonNode(getRunDungeonMapState(run))?.routeApproachType;
    return getMemorizePhaseRecallFocusForRoute(run, currentRouteType);
};
