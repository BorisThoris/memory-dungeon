import type { TileSuit } from '../../shared/contracts';

/**
 * The words for the world reacting (`world-reaction-rules.ts`): the stamps when the void spits, the
 * cold freezes or a big pop shifts the world, and the rail line that names the world.
 */
export const WORLD_ELEMENT_NAME: Record<TileSuit, string> = {
    ember: 'Ember',
    tide: 'Tide',
    moss: 'Moss',
    bone: 'Bone'
};

/** What each element's world does to the board, in a line. */
export const WORLD_ELEMENT_RULE: Record<TileSuit, string> = {
    ember: 'the afterglow burns a card wider',
    tide: 'the tide trades two cards every third turn',
    moss: 'a match overgrows the card beside it',
    bone: 'the cold freezes cards'
};

export const worldTitle = (world: readonly TileSuit[]): string =>
    world.length === 0 ? '' : `${world.map((element) => WORLD_ELEMENT_NAME[element].toUpperCase()).join(' × ')} WORLD`;

export const worldRailLine = (world: readonly TileSuit[]): string | null =>
    world.length === 0 ? null : `World · ${world.map((element) => WORLD_ELEMENT_NAME[element]).join(' × ')}`;

export const WORLD_STAMP_COPY = {
    voidTitle: 'THE VOID SPITS',
    voidSub: (pairs: number): string => (pairs === 1 ? 'A pair is back on the board, and the cards are shuffled' : `${pairs} pairs are back on the board, and the cards are shuffled`),
    frozenTitle: 'FROZEN',
    frozenSub: 'Iced cards cannot be turned for two turns',
    worldSub: (world: readonly TileSuit[]): string => world.map((element) => WORLD_ELEMENT_RULE[element]).join(' · ')
} as const;
