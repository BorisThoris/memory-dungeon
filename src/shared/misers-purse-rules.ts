import type { RunState } from './contracts';
import { grantMisses, missBankCap } from './miss-bank';
import { hasRelic } from './run-relic-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Taking up the Miser's Purse (2026-10-18). A pros-and-cons relic only means something if the
 * player chose it, so a Curio offers the purse rather than forcing it: it waits in the dock, and
 * taking it up is a decision made with the bank and the gold in view. Once taken it is kept to the
 * end of the run (`run-relic-rules.ts`): every floor clear pays twice the gold, and the miss bank
 * holds one fewer - a full bank gives up its soonest-to-expire miss at once.
 */
export const MISERS_PURSE_SOURCE_ID = 'misers_purse';

/** True when a purse is on offer and the floor is in play. */
export const canTakeMisersPurse = (run: RunState): boolean =>
    run.status === 'playing' && runNonNegativeInteger(run.misersPurseOffers) > 0 && !hasRelic(run, 'misers_purse');

/** The run with the purse taken up, or null when there is none to take. */
export const takeMisersPurse = (run: RunState): RunState | null => {
    if (!canTakeMisersPurse(run)) return null;
    const taken: RunState = { ...run, misersPurseOffers: 0, relics: [...(run.relics ?? []), 'misers_purse'], powersUsedThisRun: true };
    // The purse takes a slot: what the bank held over its new cap goes, soonest to expire first.
    return taken.missBank ? { ...taken, missBank: grantMisses(taken.missBank, run.board?.level ?? 1, 0, missBankCap(taken)) } : taken;
};
