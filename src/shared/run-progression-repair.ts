import type { RunState } from './contracts';

/*
 * The repair used to reopen a stale exit lock and defeat stale enemy hazards once every real pair
 * was cleared. Neither exists on a generated board any more, so there is nothing to repair; the
 * two entry points stay because the `run.progression_repair` command and the level-complete
 * surface still ask, and both now hear that the floor was already settled.
 */
export const repairRunProgressionSoftlocks = (run: RunState): RunState => run;

export type RunProgressionRepairKind = 'exit_lock' | 'exit_metadata' | 'enemy_hazard';

export interface RunProgressionRepairTransition {
    run: RunState;
    repaired: boolean;
    repairKinds: RunProgressionRepairKind[];
    enemyHazardIdsDefeated: string[];
}

export const createRunProgressionRepairTransition = (run: RunState): RunProgressionRepairTransition => ({
    run,
    repaired: false,
    repairKinds: [],
    enemyHazardIdsDefeated: []
});
