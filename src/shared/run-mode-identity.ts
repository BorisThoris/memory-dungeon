import type { RunState } from './contracts';

/**
 * What mode am I in?
 *
 * There is one mode now, so the question is really "what did I set this run up as?". The setup
 * sheet's options are flags on the run (`practiceMode`, `wildMenuRun`, `dungeonShowcaseRun`, the
 * clock) or the shape of `activeContract`, and the pause menu names whichever one is in force
 * (`testId: 'pause-run-identity'`; the bar itself carries only numbers). The order below is the
 * same precedence `createRestartRun` uses to decide what a retry restarts, so the name in the menu
 * and the run a retry gives you can never disagree.
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
    if (contract?.noShuffle === true) {
        // Gen 215: this said "No shuffle, no destroy" - Destroy left in Gen 200, and what the
        // contract flag actually gates is the two shuffle charges, which is what the swap spends.
        return { detail: 'No shuffle, no swap', label: 'Scholar Contract' };
    }
    return CLASSIC;
};

