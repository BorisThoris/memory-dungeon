import type { RunState } from './contracts';
import { buildRunShareKey } from './run-history';
import { describeRunModeIdentity } from './run-mode-identity';

/**
 * The line a player posts after a run.
 *
 * `buildRunShareKey` has always produced the recipe another machine needs to play the same run —
 * mode, rules version, seed — and nothing surfaced it, so a run that went well could be described
 * but never handed over. The recipe on its own is developer-shaped (`endless:3:912`), so it goes
 * at the end of a line that reads like something someone would actually send.
 *
 * Puzzle runs are the one mode with no share: a fixed or imported board is its tile payload, not a
 * seed, and inventing a key for it would hand someone a different board under the same name.
 */

export interface RunShareText {
    /** Ready for the clipboard. */
    readonly text: string;
    /** False when this run cannot be handed over; `text` then says why in one line. */
    readonly shareable: boolean;
}

const GAME_NAME = 'Memory Dungeon';

export const buildRunShareText = (run: RunState): RunShareText => {
    const summary = run.lastRunSummary;
    const key = buildRunShareKey(run);
    const identity = describeRunModeIdentity(run);
    const score = (summary?.totalScore ?? run.stats.totalScore).toLocaleString('en-US');
    const floor = summary?.highestLevel ?? run.board?.level ?? 1;

    const headline = `${GAME_NAME} — ${identity.label}: floor ${floor}, ${score} points`;
    if (!key.shareSupported) {
        return { shareable: false, text: `${headline} (this board has no seed to share)` };
    }
    return { shareable: true, text: `${headline}. Same run: ${key.shareKey}` };
};
