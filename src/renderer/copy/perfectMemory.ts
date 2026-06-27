/**
 * Perfect Memory (`ACH_PERFECT_CLEAR`) player-facing copy.
 * Align with `powersUsedThisRun` on `RunState` and `mechanics-encyclopedia`; pins do not disqualify.
 */
export const PERFECT_MEMORY_BASE_RULES =
    'Perfect Memory unlocks when your last cleared level had zero mismatches and you never used disallowed powers that run: shuffle (full-board or row/region), tile swap, destroy pair, peek, undo resolve, gambit, stray remove, flash pair, or wild match. Pins are allowed.';

/** Inventory / long-form hint paragraphs. */
export const perfectMemoryInventoryHint = (
    achievementsEnabled: boolean,
    powersUsedThisRun: boolean
): string => {
    if (!achievementsEnabled) {
        return `${PERFECT_MEMORY_BASE_RULES} Achievements are off for this run - Perfect Memory is not tracked.`;
    }
    if (powersUsedThisRun) {
        return `${PERFECT_MEMORY_BASE_RULES} A disallowed power was already used - Perfect Memory will not unlock this run.`;
    }
    return `${PERFECT_MEMORY_BASE_RULES} Avoid those powers through the end of the run to stay eligible.`;
};

/** HUD pill: hidden when achievements are off for this run. */
type PerfectMemoryHudKind = 'hidden' | 'eligible' | 'locked';

export const perfectMemoryHudKind = (
    achievementsEnabled: boolean,
    powersUsedThisRun: boolean
): PerfectMemoryHudKind => {
    if (!achievementsEnabled) {
        return 'hidden';
    }
    return powersUsedThisRun ? 'locked' : 'eligible';
};
