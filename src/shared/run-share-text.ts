import type { RunState } from './contracts';
import { describeRunModeIdentity } from './run-mode-identity';
import { describeRunShareKey, encodeRunShareKey } from './run-share-key';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The line a player posts after a run.
 *
 * The recipe on its own is developer-shaped, so it goes at the end of a line that reads like
 * something someone would actually send.
 *
 * It carries `run-share-key`'s recipe rather than `run-history`'s older `mode:rules:seed` one.
 * That older recipe cannot reproduce what was played: Wild Run, Practice, Scholar Contract and Pin
 * vow are all `endless` underneath, so all four produced a key that replays as a plain Classic run
 * on the same board — the line said "Same run" and meant a different one.
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
    const identity = describeRunModeIdentity(run);
    const score = (summary?.totalScore ?? run.stats.totalScore).toLocaleString('en-US');
    const floor = summary?.highestLevel ?? run.board?.level ?? 1;
    // The chain is the part worth bragging about, and the part a friend replaying the key can beat.
    const bestChain = summary?.bestChain ?? Math.max(runNonNegativeInteger(run.bestChainThisRun), runNonNegativeInteger(run.bestChainThisFloor));
    const feverFloors = summary?.feverFloors ?? runNonNegativeInteger(run.feverFloorsThisRun);
    const bestRipple = summary?.bestRipple ?? Math.max(runNonNegativeInteger(run.bestRippleThisRun), runNonNegativeInteger(run.bestRippleThisFloor));
    const chain = [
        runNonNegativeInteger(bestChain) > 0 ? `, best chain ×${runNonNegativeInteger(bestChain)}` : '',
        runNonNegativeInteger(feverFloors) > 0
            ? `, Fever on ${runNonNegativeInteger(feverFloors)} ${runNonNegativeInteger(feverFloors) === 1 ? 'floor' : 'floors'}`
            : '',
        // A ripple of one wave is every match ever made; only a reaction that carried is news.
        runNonNegativeInteger(bestRipple) >= 2 ? `, ripple ×${runNonNegativeInteger(bestRipple)}` : ''
    ].join('');
    const headline = `${GAME_NAME} — ${identity.label}: floor ${floor}, ${score} points${chain}`;

    const recipe = describeRunShareKey(run);
    if ('refusal' in recipe) {
        return { shareable: false, text: `${headline}. ${recipe.refusal}` };
    }
    return { shareable: true, text: `${headline}. Same run: ${encodeRunShareKey(recipe.key)}` };
};
