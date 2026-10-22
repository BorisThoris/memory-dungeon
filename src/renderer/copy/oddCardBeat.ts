import { SLEEPER_CHAIN_HOLDS, SLEEPER_WAKE_TURNS } from '../../shared/sleeper-rules';
import type { HourglassEvent, Tile, TileSuit } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { HOURGLASS_GOLD } from '../../shared/odd-card-rules';
import { WANDERER_STEP_EVERY_TURNS } from '../../shared/wanderer-rules';

/**
 * What the odd cards say (`odd-card-rules.ts`).
 *
 * The cards carry their own marks: a Turncoat's corner is already turned to its next element, an
 * Hourglass shows its sand. These are the words beside the board for what a mark cannot say - what
 * the mark means - and for a screen reader, which has no mark to look at.
 */
export const ODD_CARD_COPY = {
    turncoatName: 'Turncoat',
    hourglassName: 'Hourglass',
    caughtTitle: 'HOURGLASS CAUGHT',
    spentAnnouncement: 'The hourglass ran out. Its pair is a plain pair now.'
} as const;

/** The Wanderers (`wanderer-rules.ts`): the key's line, and what a screen reader hears on a card. */
export const WANDERER_COPY = {
    name: 'Wanderers',
    line: `Some cards step one cell every ${WANDERER_STEP_EVERY_TURNS}rd turn, trading places, and leave a footprint where they stood.`,
    footprintLabel: ', footprint: a Wanderer stepped out of this cell last turn',
    wandererLabel: `, a Wanderer: every ${WANDERER_STEP_EVERY_TURNS}rd turn it steps a cell`
} as const;

/** Sleepers (`sleeper-rules.ts`): the key's line, and what a screen reader hears on a face. */
export const SLEEPER_COPY = {
    name: 'Sleepers',
    line: `Some pairs sleep: matched on a chain under ${SLEEPER_CHAIN_HOLDS}, they come back face down ${SLEEPER_WAKE_TURNS} turns later, somewhere else.`,
    sleeperLabel: `, a Sleeper: matched on a chain under ${SLEEPER_CHAIN_HOLDS}, it comes back`
} as const;

/** The Fold (`board-fold-rules.ts`): its line in the key while the floor is two rooms. */
export const FOLD_LEGEND_ENTRY: OddCardLegendEntry = {
    id: 'fold',
    name: 'The Fold',
    line: 'Two rooms and a wall. Match in the doorway and the pop goes through; anywhere else it stays on its side.',
    suit: null,
    sand: null
};

/** Layers (`board-layers-rules.ts`): its line in the key while anything waits beneath. */
export const LAYERS_LEGEND_ENTRY: OddCardLegendEntry = {
    id: 'layers',
    name: 'Layers',
    line: 'Some cells hide a second card. When the card on top leaves, the one beneath rises face down.',
    suit: null,
    sand: null
};

const turns = (n: number): string => `${n} ${n === 1 ? 'turn' : 'turns'}`;

/** The Turncoat's line in the legend: what it is now and next. */
export const turncoatLegend = (now: TileSuit, next: TileSuit): string =>
    now === next ? `A pair that changes element every turn. ${ELEMENT_NAMES[now]} now.` : `A pair that changes element every turn. ${ELEMENT_NAMES[now]} now, ${ELEMENT_NAMES[next]} next.`;

/** The Hourglass's line in the legend: the prize and the sand. */
export const hourglassLegend = (sand: number): string => `Match its pair within ${turns(sand)} for ${HOURGLASS_GOLD} gold and bonus score.`;

export const hourglassCalloutSub = (event: HourglassEvent): string => `+${event.gold} gold, +${event.score} score`;

export const hourglassAnnouncement = (event: HourglassEvent): string =>
    event.kind === 'caught' ? `Hourglass caught: ${event.gold} gold and ${event.score} score.` : ODD_CARD_COPY.spentAnnouncement;

export interface OddCardLegendEntry {
    /** The odd cards, and the looking glass's clock, which shares their key above the board. */
    readonly id: 'turncoat' | 'hourglass' | 'looking_glass' | 'wanderer' | 'sleeper' | 'fold' | 'layers';
    readonly name: string;
    readonly line: string;
    /** The element whose colour the entry wears: a Turncoat's current one. */
    readonly suit: TileSuit | null;
    readonly sand: number | null;
}

/** The floor's odd cards still standing, one entry each. */
export const oddCardLegend = (tiles: readonly Tile[]): OddCardLegendEntry[] => {
    const standing = tiles.filter((tile) => tile.state !== 'matched' && tile.state !== 'removed');
    const turncoat = standing.find((tile) => tile.turncoat != null && tile.suit);
    const hourglass = standing.find((tile) => tile.hourglass != null);
    // Said while any Wanderer stands, never which: the key is read off the whole board, the cards keep the secret.
    const wandering = standing.some((tile) => tile.wanderer);
    // Said while any Sleeper stands or sleeps, never which.
    const sleepers = tiles.some((tile) => tile.sleeper && tile.state !== 'removed');
    return [
        ...(turncoat ? [{ id: 'turncoat' as const, name: ODD_CARD_COPY.turncoatName, line: turncoatLegend(turncoat.suit!, turncoat.turncoat!), suit: turncoat.suit!, sand: null }] : []),
        ...(hourglass ? [{ id: 'hourglass' as const, name: ODD_CARD_COPY.hourglassName, line: hourglassLegend(hourglass.hourglass!), suit: null, sand: hourglass.hourglass! }] : []),
        ...(wandering ? [{ id: 'wanderer' as const, name: WANDERER_COPY.name, line: WANDERER_COPY.line, suit: null, sand: null }] : []),
        ...(sleepers ? [{ id: 'sleeper' as const, name: SLEEPER_COPY.name, line: SLEEPER_COPY.line, suit: null, sand: null }] : [])
    ];
};
