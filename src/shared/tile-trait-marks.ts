/**
 * The shape half of a trait marker.
 *
 * A hidden tile's trait is drawn as a small coloured rail near the bottom edge. Until now every
 * trait drew the same mark and only the colour differed, which made hue the sole carrier of nine
 * different rules — the thing WCAG 1.4.1 asks you not to do, and a problem on a Deck-sized screen
 * even for players who can separate all nine.
 *
 * There is also a plainer reason: this is a memory game. A player recalling "two bars, bottom left"
 * is recalling something sturdier than a shade of blue.
 *
 * The code is deliberately systematic rather than pictorial — three mark shapes times three counts
 * covers the nine traits exactly, and a count is far easier to read at this size than a tiny
 * illustration would be. The Codex lists the mapping so it can be learned rather than guessed.
 */
import type { TileTraitKind } from './contracts';

export type TraitMarkShape = 'pip' | 'bar' | 'diamond';
export type TraitMarkCount = 1 | 2 | 3;

export interface TraitMarkSignature {
    readonly count: TraitMarkCount;
    readonly shape: TraitMarkShape;
}

/**
 * Grouped so the shape carries a family and the count separates within it:
 *
 * - round pips: the traits that move information around (Conduit, Echo, Drift)
 * - bars:       the traits that hold something still (Stasis, Sealed, Heavy)
 * - diamonds:   the traits that turn a match into a risk (Mirror, Cursed, Volatile)
 */
export const TILE_TRAIT_MARKS: Record<TileTraitKind, TraitMarkSignature> = {
    conduit: { count: 1, shape: 'pip' },
    echo: { count: 2, shape: 'pip' },
    drift: { count: 3, shape: 'pip' },
    stasis: { count: 1, shape: 'bar' },
    sealed: { count: 2, shape: 'bar' },
    heavy: { count: 3, shape: 'bar' },
    mirror: { count: 1, shape: 'diamond' },
    cursed: { count: 2, shape: 'diamond' },
    volatile: { count: 3, shape: 'diamond' }
};

export const tileTraitMark = (kind: TileTraitKind): TraitMarkSignature => TILE_TRAIT_MARKS[kind];

/** Player-facing description of a mark, for the Codex and for screen readers. */
export const describeTraitMark = ({ count, shape }: TraitMarkSignature): string => {
    const noun = shape === 'pip' ? 'dot' : shape === 'bar' ? 'bar' : 'diamond';
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
};

/**
 * Where each mark sits along the rail, centred as a group. Returned rather than computed at the
 * draw site so the spacing is one decision with one test, not three branches in a mesh tree.
 */
export const traitMarkOffsets = (count: TraitMarkCount, spacing: number): number[] => {
    const start = -((count - 1) * spacing) / 2;
    return Array.from({ length: count }, (_unused, index) => start + index * spacing);
};
