import type { RunState } from './contracts';

/**
 * What mode am I in?
 *
 * There is one mode now, so the question is really "what did I set this run up as?". The setup
 * sheet's options are flags on the run (`practiceMode`, `wildMenuRun`, `dungeonShowcaseRun`, the
 * clock) or the shape of `activeContract`, and the HUD names whichever one is in force
 * (`testId: 'hud-mode-identity'`). The order below is the same precedence `createRestartRun` uses
 * to decide what a retry restarts, so the name on the bar and the run a retry gives you can never
 * disagree.
 */

export interface RunModeIdentity {
    /** The mode's name, as `run-mode-catalog` promised the HUD would read. */
    readonly label: string;
    /** The one rule or key that makes this run different, or null when the label says it all. */
    readonly detail: string | null;
}

const CLASSIC: RunModeIdentity = { detail: null, label: 'Classic Dungeon' };

/**
 * The mode name and rule for a live run. Pure: same run, same answer, no store and no clock.
 */
export const describeRunModeIdentity = (run: RunState): RunModeIdentity => {
    if (run.dungeonShowcaseRun) {
        return { detail: null, label: 'Dungeon Showcase' };
    }
    const contract = run.activeContract;
    if (contract?.maxPinsTotalRun != null) {
        return { detail: `Pins ${contract.maxPinsTotalRun} this run`, label: 'Pin vow' };
    }
    if (run.gauntletDeadlineMs !== null) {
        // The clock is already its own stat; repeating the minutes here would say it twice.
        return { detail: null, label: 'Timed Run' };
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
