import type { RunState, SaveData } from './contracts';

/**
 * Whether this run can still earn the perfect-clear achievement.
 *
 * `ACH_PERFECT_CLEAR` is the one achievement a player can lose mid-run by choosing to: any meta
 * power or assist — a shuffle, a swap, a destroy, a peek, an undo, a gambit third pick, a stray
 * remove, a flash pair, a wild match — sets `powersUsedThisRun` and takes it off the table. Pins
 * do not. Nothing on screen said so, so the cost of pressing a dock button was invisible at the
 * moment the player was deciding whether to press it.
 *
 * Only worth saying while it is live stakes: a run with achievements off has nothing to lose, and
 * a player who already owns the achievement is not deciding anything.
 */

export type PerfectMemoryStatus = 'eligible' | 'locked';

export const perfectMemoryStatus = (run: RunState, saveData: SaveData): PerfectMemoryStatus | null => {
    if (!run.achievementsEnabled || saveData.achievements.ACH_PERFECT_CLEAR) {
        return null;
    }
    return run.powersUsedThisRun ? 'locked' : 'eligible';
};
