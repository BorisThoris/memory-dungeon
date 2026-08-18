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
    const compactRules = 'Perfect Memory: no misses, no rescue powers; pins ok.';
    if (!achievementsEnabled) {
        return `${compactRules} Achievements are off, so it is not tracked.`;
    }
    if (powersUsedThisRun) {
        return `${compactRules} A disallowed power was already used.`;
    }
    return compactRules;
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
