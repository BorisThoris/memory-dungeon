import type { MutatorId, RunState } from './contracts';
import { MUTATOR_CATALOG, type MutatorDefinition } from './mechanics-encyclopedia';

export type { MutatorDefinition };
export { MUTATOR_CATALOG };

/** Rotated for daily challenge (index from daily mutator hash). */
export const DAILY_MUTATOR_TABLE: MutatorId[] = [
    'short_memorize',
    'sticky_fingers',
    'score_parasite',
    'wide_recall',
    'silhouette_twist',
    'n_back_anchor',
    'category_letters',
    'glass_floor',
    'generous_shrine'
];

export const hasMutator = (run: RunState, id: MutatorId): boolean =>
    Array.isArray(run.activeMutators) && run.activeMutators.includes(id);
