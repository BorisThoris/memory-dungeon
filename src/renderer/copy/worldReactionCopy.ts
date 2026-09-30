import type { TileSuit } from '../../shared/contracts';
import { worldFusion, type WorldFusionId } from '../../shared/world-reaction-rules';

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

/** What a fused world does, in a line: the sharper rule it brings over its two elements'. */
export const WORLD_FUSION_RULE: Record<WorldFusionId, string> = {
    steam: 'the tide runs every second turn',
    wildfire: 'the afterglow burns two cards wider',
    ash: 'the cold bites one card less',
    swamp: 'the tide trades two pairs of cards',
    blizzard: 'the cold freezes one card more, for three turns',
    grave: 'the ice holds three turns'
};

const DEPTH_NUMERALS = ['', '', ' II', ' III'] as const;

export const worldTitle = (world: readonly TileSuit[]): string => {
    if (world.length === 0) return '';
    const fusion = worldFusion(world);
    return fusion ? `${fusion.title.toUpperCase()}!` : `${world.map((element) => WORLD_ELEMENT_NAME[element].toUpperCase()).join(' × ')} WORLD`;
};

export const worldRailLine = (world: readonly TileSuit[], depth = 1): string | null => {
    if (world.length === 0) return null;
    const fusion = worldFusion(world);
    const elements = world.map((element) => WORLD_ELEMENT_NAME[element]).join(' × ');
    const deep = DEPTH_NUMERALS[Math.max(0, Math.min(3, Math.floor(depth)))] ?? '';
    return fusion ? `World · ${fusion.title}${deep} (${elements})` : `World · ${elements}${deep}`;
};

export const WORLD_STAMP_COPY = {
    voidTitle: 'THE VOID SPITS',
    voidSub: (pairs: number): string => (pairs === 1 ? 'A pair is back on the board, and the cards are shuffled' : `${pairs} pairs are back on the board, and the cards are shuffled`),
    frozenTitle: 'FROZEN',
    frozenSub: 'Iced cards cannot be turned until they thaw',
    frozenPressSub: 'That card is iced: wait for the thaw, or pop it free',
    deepenedTitle: (world: string): string => `${world} DEEPENS`,
    deepenedSub: (depth: number): string => `The world runs ${depth} deep: its rules bite harder`,
    heldTitle: 'THE WORLD HOLDS',
    heldSub: (depth: number): string => `It wore down to ${depth} deep; one more pull and it gives way`,
    worldSub: (world: readonly TileSuit[]): string => {
        const fusion = worldFusion(world);
        const rules = world.map((element) => WORLD_ELEMENT_RULE[element]).join(' · ');
        return fusion ? `${world.map((element) => WORLD_ELEMENT_NAME[element]).join(' × ')}: ${WORLD_FUSION_RULE[fusion.id]}` : rules;
    }
} as const;
