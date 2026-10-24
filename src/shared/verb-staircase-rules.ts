import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The verb staircase (rules 89, 2026-10-24): the deep game's verbs arrive in the Gate.
 *
 * The pack put Hold at floor 13, Carve at 25 and Reprise at 41. `yarn sim:memory-survival` says a
 * player who keeps eight to twelve cards in mind ends a run at floor 9 to 20, so most runs never
 * pressed any of them, and every run's first twelve floors played the same. The owner's word
 * (2026-10-24): it lacks punch and does not change the more you play. From rules 89 the three verbs
 * climb the Gate instead, one every few floors, each told on the board crown on the floor it arrives.
 * None of them changes a deal: they act on the chain, the pop and the turns already played, so the
 * floors themselves are the ones every run before was dealt.
 */
export const VERB_STAIRCASE_FROM = 89;

export type StaircaseVerb = 'hold' | 'carve' | 'reprise';

/** Where each verb first came, before rules 89 (the pack's acts). */
export const VERB_LEGACY_FIRST_FLOORS: Readonly<Record<StaircaseVerb, number>> = { hold: 13, carve: 25, reprise: 41 };
/** Where each verb first comes from rules 89: after the traits (4), clear of the Gate's boss slot (9). */
export const VERB_STAIRCASE_FIRST_FLOORS: Readonly<Record<StaircaseVerb, number>> = { hold: 5, carve: 7, reprise: 11 };

const STAIRCASE_ORDER: readonly StaircaseVerb[] = ['hold', 'carve', 'reprise'];

const onStaircase = (run: Partial<Pick<RunState, 'runRulesVersion'>> | null | undefined): boolean => (run?.runRulesVersion ?? 0) >= VERB_STAIRCASE_FROM;

/** The first floor a verb is in the dock, for this run. */
export const verbFirstFloor = (verb: StaircaseVerb, run: Partial<Pick<RunState, 'runRulesVersion'>> | null | undefined): number =>
    (onStaircase(run) ? VERB_STAIRCASE_FIRST_FLOORS : VERB_LEGACY_FIRST_FLOORS)[verb];

/** Whether the run's floor has reached a verb's first floor. */
export const verbReached = (verb: StaircaseVerb, run: Partial<Pick<RunState, 'board' | 'runRulesVersion'>>): boolean =>
    runNonNegativeInteger(run.board?.level) >= verbFirstFloor(verb, run);

/** The verb that arrives on this floor of a staircase run, if one does: told on the board crown. Not in Endless, where every verb is old news. */
export const verbArrivingOn = (run: Partial<Pick<RunState, 'board' | 'runRulesVersion' | 'endless'>>): StaircaseVerb | null => {
    if (!onStaircase(run) || run.endless === true) return null;
    const level = runNonNegativeInteger(run.board?.level);
    return STAIRCASE_ORDER.find((verb) => VERB_STAIRCASE_FIRST_FLOORS[verb] === level) ?? null;
};
