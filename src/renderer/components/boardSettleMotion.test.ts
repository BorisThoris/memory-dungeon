import { describe, expect, it } from 'vitest';
import type { Tile, TileState } from '../../shared/contracts';
import { getBoardSettleSignature } from './boardSettleMotion';

const tile = (id: string, state: TileState = 'hidden'): Tile => ({
    id,
    pairKey: id,
    symbol: id,
    label: id,
    state
});

describe('getBoardSettleSignature', () => {
    it('changes when the settle moves a card into a new cell', () => {
        const before = getBoardSettleSignature({ tiles: [tile('a'), tile('b', 'matched'), tile('c')] });
        const after = getBoardSettleSignature({ tiles: [tile('a'), tile('c'), tile('b', 'matched')] });
        expect(after).not.toBe(before);
    });

    it('does not change when a card is only flipped over', () => {
        const hidden = getBoardSettleSignature({ tiles: [tile('a'), tile('b'), tile('c')] });
        const flipped = getBoardSettleSignature({ tiles: [tile('a'), tile('b', 'flipped'), tile('c')] });
        expect(flipped).toBe(hidden);
    });

    it('does not change when a card is cleared but nothing moves', () => {
        // A card bursting is not a card moving; the departure animation already covers it, and
        // arming the glide here would smear the whole board on every single match.
        const before = getBoardSettleSignature({ tiles: [tile('a'), tile('b'), tile('c')] });
        expect(getBoardSettleSignature({ tiles: [tile('a'), tile('b'), tile('c')] })).toBe(before);
        expect(getBoardSettleSignature({ tiles: [tile('a'), tile('b', 'removed'), tile('c')] })).not.toBe(before);
    });

    it('tells two boards of the same cards in different cells apart', () => {
        expect(getBoardSettleSignature({ tiles: [tile('a'), tile('b')] })).not.toBe(
            getBoardSettleSignature({ tiles: [tile('b'), tile('a')] })
        );
    });
});
