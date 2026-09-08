import type { MutatorId, RunState } from './contracts';
import { MUTATOR_CATALOG, type MutatorDefinition } from './mechanics-encyclopedia';
import { runArray } from './run-array-guards';

export type { MutatorDefinition };
export { MUTATOR_CATALOG };

export const hasMutator = (run: RunState, id: MutatorId): boolean =>
    runArray<MutatorId>(run.activeMutators).includes(id);
