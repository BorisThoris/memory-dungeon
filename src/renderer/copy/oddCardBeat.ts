import type { HourglassEvent, Tile, TileSuit } from '../../shared/contracts';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';
import { HOURGLASS_GOLD } from '../../shared/odd-card-rules';

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
    readonly id: 'turncoat' | 'hourglass';
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
    return [
        ...(turncoat ? [{ id: 'turncoat' as const, name: ODD_CARD_COPY.turncoatName, line: turncoatLegend(turncoat.suit!, turncoat.turncoat!), suit: turncoat.suit!, sand: null }] : []),
        ...(hourglass ? [{ id: 'hourglass' as const, name: ODD_CARD_COPY.hourglassName, line: hourglassLegend(hourglass.hourglass!), suit: null, sand: hourglass.hourglass! }] : [])
    ];
};
