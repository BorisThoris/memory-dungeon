import type { FindableKind } from '../../shared/contracts';

/**
 * Each pickup's colour on the card: the glint cyan, the meteor shard amber, the Curio violet
 * (`curio-rules.ts`) - the colour loot games give the stranger finds. The corner glyph, the ring
 * around a shard or a Curio and the back's faint tint all read it from here.
 */
export const FINDABLE_MARKER_COLOR: Readonly<Record<FindableKind, string>> = {
    score_glint: '#87eafa',
    meteor_shard: '#ffb561',
    curio: '#c58bff'
};

/** The faint tint a pickup lends a face-down card's back. */
export const FINDABLE_BACK_TINT: Readonly<Record<FindableKind, string>> = {
    score_glint: '#5ee0c8',
    meteor_shard: '#ffb561',
    curio: '#b07bff'
};

/** Pickups that wear a ring on both faces: the ones that put an item in the player's hand. */
export const findableWearsRing = (kind: FindableKind | undefined): kind is 'meteor_shard' | 'curio' =>
    kind === 'meteor_shard' || kind === 'curio';
