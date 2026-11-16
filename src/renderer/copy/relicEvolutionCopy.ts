import { tr } from '../../shared/i18n';
import { EVOLUTIONS, KEYSTONE_HEART_PAIRS, MISERS_VAULT_GOLD, CARTOGRAPHERS_THREAD_TURNS } from '../../shared/relic-evolution-rules';
import type { BlueprintId } from '../../shared/boss-reward-rules';

/** Relic evolutions (`relic-evolution-rules.ts`, DGE-014): what each does, and what a blueprint needs. */
export const EVOLUTION_LINES: Readonly<Record<BlueprintId, string>> = {
    lantern_of_recall: tr.s('What a match lights stays lit for the rest of the floor.'),
    misers_vault: tr`Once a floor, a miss on an empty bank costs ${MISERS_VAULT_GOLD} gold instead of the run.`,
    cartographers_thread: tr`The Wanderers' footprints last ${CARTOGRAPHERS_THREAD_TURNS} turns.`,
    keystone_heart: tr`A Hold released at ${KEYSTONE_HEART_PAIRS} pairs or more refills a miss.`,
    unmasking_glass: tr.s('Masks drop at the study window (Masks are not in the dungeon yet).'),
    echo_chamber: tr.s('Echo replays five flips (Echo is not in the dungeon yet).')
};

const TITLES: Readonly<Record<string, string>> = { long_look: tr.s('Long Look'), deep_pockets: tr.s('Deep Pockets'), gilded_chain: tr.s('Gilded Chain'), tallow_candle: tr.s('Tallow Candle') };

/** A blueprint held, not yet evolved: the two relics at rank 3 it waits for. */
export const blueprintLine = (id: BlueprintId): string => {
    const recipe = EVOLUTIONS.find((candidate) => candidate.id === id);
    return recipe ? tr`Evolves at camp with ${TITLES[recipe.from[0]]} and ${TITLES[recipe.from[1]]} both at rank 3.` : '';
};
