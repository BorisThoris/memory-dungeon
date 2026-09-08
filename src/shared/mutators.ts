import type { MutatorId, RunState } from './contracts';
import { MUTATOR_CATALOG, type MutatorDefinition } from './mechanics-encyclopedia';
import { runMutatorIds } from './relics';

export type { MutatorDefinition };
export { MUTATOR_CATALOG };

export const hasMutator = (run: RunState, id: MutatorId): boolean =>
    runMutatorIds(run.activeMutators).includes(id);
