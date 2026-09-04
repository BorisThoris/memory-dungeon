import { getBuiltinPuzzle } from './builtin-puzzles';
import type { RunState } from './contracts';

/**
 * What mode am I in?
 *
 * `run-mode-catalog.ts` has promised, for every mode it offers, that the HUD names the mode once
 * the run starts (`startContract.signal`, `testId: 'hud-mode-identity'`). Nothing rendered it: a
 * player who picked Wild Run, Practice, Scholar Contract or Pin vow saw exactly the same bar as a
 * Classic run, and the rule that separates their run from a normal one was nowhere on screen.
 *
 * Modes are not a single field. `gameMode` covers five of them; the rest are flags on the run
 * (`practiceMode`, `wildMenuRun`, `dungeonShowcaseRun`) or the shape of `activeContract`. The order
 * below is the same precedence `createRestartRun` uses to decide what a retry restarts, so the name
 * on the bar and the run a retry gives you can never disagree.
 */

export interface RunModeIdentity {
    /** The mode's name, as `run-mode-catalog` promised the HUD would read. */
    readonly label: string;
    /** The one rule or key that makes this run different, or null when the label says it all. */
    readonly detail: string | null;
}

const CLASSIC: RunModeIdentity = { detail: null, label: 'Classic Dungeon' };

/**
 * `YYYYMMDD` is the seed key; `2026-09-04 UTC` is the same key a player can read. The zone is worth
 * saying out loud because the daily rolls over at UTC midnight, not at the player's.
 */
const readableDailyKey = (key: string | null): string | null => {
    if (key === null || !/^\d{8}$/u.test(key)) {
        return key;
    }
    return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)} UTC`;
};

const puzzleIdentity = (puzzleId: string | null): RunModeIdentity => {
    const puzzle = puzzleId === null ? undefined : getBuiltinPuzzle(puzzleId);
    return { detail: puzzle?.goalText ?? null, label: puzzle ? `Puzzle: ${puzzle.title}` : 'Puzzle' };
};


/**
 * The mode name and rule for a live run. Pure: same run, same answer, no store and no clock.
 */
export const describeRunModeIdentity = (run: RunState): RunModeIdentity => {
    if (run.dungeonShowcaseRun) {
        return { detail: null, label: 'Dungeon Showcase' };
    }
    switch (run.gameMode) {
        case 'daily':
            return { detail: readableDailyKey(run.dailyDateKeyUtc), label: 'Daily challenge' };
        case 'gauntlet':
            // The clock is already its own stat; repeating it here would say the same thing twice.
            return { detail: null, label: 'Gauntlet' };
        case 'meditation':
            return { detail: null, label: 'Meditation Run' };
        case 'puzzle':
            return puzzleIdentity(run.puzzleId);
        default:
            break;
    }
    const contract = run.activeContract;
    if (contract?.maxPinsTotalRun != null) {
        return { detail: `Pins ${contract.maxPinsTotalRun} this run`, label: 'Pin vow' };
    }
    if (run.wildMenuRun) {
        return { detail: `Wild matches ${run.wildMatchesRemaining}`, label: 'Wild Run' };
    }
    if (run.practiceMode) {
        return { detail: 'Achievements off', label: 'Practice' };
    }
    if (contract?.noShuffle === true && contract.noDestroy) {
        return { detail: 'No shuffle, no destroy', label: 'Scholar Contract' };
    }
    return CLASSIC;
};

/** One line for screen readers and tooltips: the label, plus the rule when there is one. */
export const runModeIdentityText = (identity: RunModeIdentity): string =>
    identity.detail === null ? identity.label : `${identity.label} — ${identity.detail}`;
