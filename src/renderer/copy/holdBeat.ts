import type { RunState } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

/**
 * The Hold's words (DGE-008): what a screen reader hears when the Hold starts, when a miss drops part
 * of the stack, and when it is released - the three moments the board shows only as cells going gold
 * (`HoldSeeds.tsx`) or a break. Read off the run's own fields, keyed so one moment is said once.
 */
export type HoldBeat = { readonly key: string; readonly line: string };

type HoldFields = Pick<RunState, 'board'> & Partial<Pick<RunState, 'holding' | 'heldSeedIds' | 'holdsReleasedThisFloor'>>;

const held = (run: HoldFields): number => Math.floor((run.heldSeedIds ?? []).length / 2);
const pairs = (n: number): string => `${n} held ${n === 1 ? 'pair' : 'pairs'}`;

/** The beat between two run states, or null when the Hold did nothing between them. */
export const holdBeat = (before: HoldFields | null | undefined, after: HoldFields): HoldBeat | null => {
    if (!before || before.board?.level !== after.board?.level) return null;
    const level = after.board?.level ?? 0;
    const released = runNonNegativeInteger(after.holdsReleasedThisFloor);
    if (released > runNonNegativeInteger(before.holdsReleasedThisFloor)) {
        return { key: `hold:${level}:release:${released}`, line: `Released ${pairs(held(before))}: every one breaks at once.` };
    }
    if (after.holding && !before.holding) {
        return { key: `hold:${level}:start:${released}`, line: 'Holding: the pairs you match keep their pops until you release them.' };
    }
    if (after.holding && before.holding && held(after) < held(before)) {
        return { key: `hold:${level}:drop:${released}:${held(after)}`, line: `The miss dropped ${held(before) - held(after)} of the stack; ${pairs(held(after))} left.` };
    }
    return null;
};

/** How hard the room flashes for a release: by its size, Fever from eight pairs held (DGE-008). */
export const holdReleasePulseTier = (pairs: number): 'fever' | 'sharp' | 'clean' => (pairs >= 8 ? 'fever' : pairs >= 4 ? 'sharp' : 'clean');
