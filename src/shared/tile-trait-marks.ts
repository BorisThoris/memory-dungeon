/**
 * The shape half of a trait marker.
 *
 * A hidden tile's trait is drawn as a small coloured rail near the bottom edge. Every trait once
 * drew the same mark and only the colour differed, which made hue the sole carrier of the trait
 * rules — the thing WCAG 1.4.1 asks you not to do, and a problem on a Deck-sized screen even for
 * players who can separate every hue.
 *
 * There is also a plainer reason: this is a memory game. A player recalling "three bars, bottom
 * left" is recalling something sturdier than a shade of blue.
 *
 * The code is deliberately systematic rather than pictorial — a shape carries a family and a
 * count separates within it, and a count is far easier to read at this size than a tiny
 * illustration would be. The Codex lists the mapping so it can be learned rather than guessed.
 */
import type { TileTraitKind } from './contracts';

export type TraitMarkShape = 'pip' | 'bar';
export type TraitMarkCount = 1 | 2 | 3;

export interface TraitMarkSignature {
    readonly count: TraitMarkCount;
    readonly shape: TraitMarkShape;
}

/**
 * - round pips: the traits that move information around (Conduit, Echo)
 * - bars:       the traits that hold something still (Stasis, Heavy)
 *
 * Each trait keeps the mark it shipped with when there were nine; the triage removed marks, it
 * did not reassign any, which is why Heavy is three bars with no two-bar trait beside it. The
 * diamond family (the traits that turned a match into a risk) went with those traits.
 */
export const TILE_TRAIT_MARKS: Record<TileTraitKind, TraitMarkSignature> = {
    conduit: { count: 1, shape: 'pip' },
    echo: { count: 2, shape: 'pip' },
    stasis: { count: 1, shape: 'bar' },
    heavy: { count: 3, shape: 'bar' }
};

export const tileTraitMark = (kind: TileTraitKind): TraitMarkSignature => TILE_TRAIT_MARKS[kind];

/** Player-facing description of a mark, for the Codex and for screen readers. */
export const describeTraitMark = ({ count, shape }: TraitMarkSignature): string => {
    const noun = shape === 'pip' ? 'dot' : 'bar';
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
