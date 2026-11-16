import { tr } from './i18n';
import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The Depths (DGE-025): the ladder after the Warden.
 *
 * Felling the Warden opens Depth 1; felling it at Depth n opens n + 1. A run at Depth n plays every
 * rung from 1 to n, each one named rule: an existing constant of the game made a step harder, never a
 * new mechanic and never a hidden one - the board crown names the deepest rung, and the Codex all of
 * them. Depth 0 is the game as it was, bit for bit, so the ladder needs no rules-version reseed: every
 * rung asks `depthHas(run, id)`, which is false at Depth 0.
 *
 * This module is a leaf (contracts and the number guards only): the rules it changes import it, never
 * the reverse.
 */
export type DepthRungId =
    | 'short_study'
    | 'no_misses_sold'
    | 'two_to_open'
    | 'no_calm_door'
    | 'bank_cap_down'
    | 'dearer_store'
    | 'wanderers_early'
    | 'keeper_fast'
    | 'cartographer_fast'
    | 'warden_fast'
    | 'masks_early'
    | 'sleepers_early'
    | 'hold_seven'
    | 'carve_three'
    | 'no_shuffle_start'
    | 'sleepers_three'
    | 'masks_three'
    | 'learned_early'
    | 'wanderers_three'
    | 'warden_always';

export interface DepthRung {
    readonly depth: number;
    readonly id: DepthRungId;
    readonly name: string;
    /** The rule, as the crown and the Codex say it. */
    readonly line: string;
}

export const DEPTH_RUNGS: readonly DepthRung[] = [
    { depth: 1, id: 'short_study', name: tr.s('Short study'), line: tr.s('The study window is a quarter shorter.') },
    { depth: 2, id: 'no_misses_sold', name: tr.s('No misses sold'), line: tr.s('The store sells no misses.') },
    { depth: 3, id: 'two_to_open', name: tr.s('Two to open'), line: tr.s('The miss bank opens with two misses, not three.') },
    { depth: 4, id: 'no_calm_door', name: tr.s('No calm door'), line: tr.s('Before an act boss, no door is calm.') },
    { depth: 5, id: 'bank_cap_down', name: tr.s('A smaller bank'), line: tr.s('The miss bank holds one fewer.') },
    { depth: 6, id: 'dearer_store', name: tr.s('Dearer camp'), line: tr.s('Everything at the store costs a quarter more.') },
    { depth: 7, id: 'wanderers_early', name: tr.s('Early Wanderers'), line: tr.s('Wanderers walk from floor 7, not 13.') },
    { depth: 8, id: 'keeper_fast', name: tr.s('A restless Keeper'), line: tr.s('The Keeper of Halls swaps its rooms every third turn.') },
    { depth: 9, id: 'cartographer_fast', name: tr.s('A restless Cartographer'), line: tr.s('The Cartographer turns its lower deck every second match.') },
    { depth: 10, id: 'warden_fast', name: tr.s('A restless Warden'), line: tr.s('The Warden deals the face-down cards again every fourth turn.') },
    { depth: 11, id: 'masks_early', name: tr.s('Early masks'), line: tr.s('Masks are worn from floor 13, not 25.') },
    { depth: 12, id: 'sleepers_early', name: tr.s('Early Sleepers'), line: tr.s('Sleepers sleep from floor 25, not 41.') },
    { depth: 13, id: 'hold_seven', name: tr.s('A deeper Hold'), line: tr.s('The Hold arms at seven links, not six.') },
    { depth: 14, id: 'carve_three', name: tr.s('A dearer Carve'), line: tr.s('A carve costs three links, not two.') },
    { depth: 15, id: 'no_shuffle_start', name: tr.s('No shuffle'), line: tr.s('The run starts with no shuffle charge.') },
    { depth: 16, id: 'sleepers_three', name: tr.s('More Sleepers'), line: tr.s('Three pairs a floor sleep.') },
    { depth: 17, id: 'masks_three', name: tr.s('More masks'), line: tr.s('Three cards a floor wear masks.') },
    { depth: 18, id: 'learned_early', name: tr.s('It learns sooner'), line: tr.s('The dungeon learns you from floor 25, not 41.') },
    { depth: 19, id: 'wanderers_three', name: tr.s('More Wanderers'), line: tr.s('Three Wanderers walk on every floor that has any.') },
    { depth: 20, id: 'warden_always', name: tr.s('The Warden complete'), line: tr.s('Behind every door, the Warden falls only to a Hold of twelve.') }
];

export const MAX_DEPTH = DEPTH_RUNGS.length;

/** The run's Depth, 0 when unset. */
export const runDepth = (run: Pick<RunState, 'depth'> | null | undefined): number => Math.min(MAX_DEPTH, runNonNegativeInteger(run?.depth));

/** Whether the run plays this rung: its Depth reaches it. */
export const depthHas = (run: Pick<RunState, 'depth'> | null | undefined, id: DepthRungId): boolean => {
    const rung = DEPTH_RUNGS.find((entry) => entry.id === id);
    return rung != null && runDepth(run) >= rung.depth;
};

/** The rung the run's Depth adds, the one the crown names; null at Depth 0. */
export const depthRung = (run: Pick<RunState, 'depth'> | null | undefined): DepthRung | null => DEPTH_RUNGS[runDepth(run) - 1] ?? null;

/** The study window's share at the run's Depth. */
export const DEPTH_STUDY_SHARE = 0.75;
/** The miss bank's opening grant from Depth 3 down. */
export const DEPTH_OPENING_MISSES = 2;
/** The store's prices from Depth 6 down, as a share of their own. */
export const DEPTH_STORE_PRICE_SHARE = 1.25;
/** The first floor the Wanderers walk from Depth 7 down. */
export const DEPTH_WANDERERS_FROM = 7;
/** The Keeper's swap clock from Depth 8 down. */
export const DEPTH_KEEPER_SWAP_EVERY = 3;
/** The Cartographer's turn clock from Depth 9 down. */
export const DEPTH_CARTOGRAPHER_TURN_EVERY = 2;
/** The Warden's re-deal clock from Depth 10 down. */
export const DEPTH_WARDEN_REDEAL_EVERY = 4;
/** The first floor masks are worn from Depth 11 down. */
export const DEPTH_MASKS_FROM = 13;
/** The first floor Sleepers sleep from Depth 12 down. */
export const DEPTH_SLEEPERS_FROM = 25;
/** The Hold's meter from Depth 13 down. */
export const DEPTH_HOLD_SEGMENTS = 7;
/** A carve's price from Depth 14 down. */
export const DEPTH_CARVE_LINKS = 3;
/** The first floor the dungeon learns you from Depth 18 down. */
export const DEPTH_LEARNED_FROM = 25;
/** The Sleepers, masks and Wanderers on a floor that has any, from Depths 16, 17 and 19 down. */
export const DEPTH_FAMILY_COUNT = 3;
