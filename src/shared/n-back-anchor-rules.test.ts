import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { ANCHOR_PATIENCE_MATCHES, anchorMarkedTileId, resolveAnchorAfterMatch } from './n-back-anchor-rules';

/** Rows of space-separated pair keys; a key in `matched` is already off the board. */
const board = (rows: string[], matched: readonly string[] = []): BoardState => {
    const seen = new Map<string, number>();
    const tiles: Tile[] = rows.flatMap((row) =>
        row.split(' ').map((key) => {
            const n = (seen.get(key) ?? 0) + 1;
            seen.set(key, n);
            return { id: `${key}-${n}`, pairKey: key, symbol: key, label: key, state: matched.includes(key) ? 'matched' : 'hidden', suit: 'ember' } as Tile;
        })
    );
    return { level: 5, columns: rows[0]!.split(' ').length, rows: rows.length, pairCount: seen.size, matchedPairs: 0, flippedTileIds: [], tiles } as unknown as BoardState;
};

const after = (b: BoardState, anchorPairKeyBefore: string | null, matchesSinceAnchorBefore: number, matchedPairKey: string) =>
    resolveAnchorAfterMatch({ board: b, anchorPairKeyBefore, matchesSinceAnchorBefore, matchedPairKey, runSeed: 9, rulesVersion: 1, matchResolutions: 3 });

describe('the anchor', () => {
    it('names a pair still fully face down, never one already gone', () => {
        const b = board(['a b c', 'a b c', 'd d e', 'e f f'], ['a']);
        const result = after(b, null, 0, 'a');
        expect(result.anchorMatched).toBe(false);
        expect(result.anchorPairKey).not.toBe('a');
        expect(b.tiles.filter((tile) => tile.pairKey === result.anchorPairKey).every((tile) => tile.state === 'hidden')).toBe(true);
    });

    it('pays when the anchor itself is matched, and names a different pair next', () => {
        const b = board(['a b c', 'a b c', 'd d e', 'e f f'], ['b']);
        const result = after(b, 'b', 0, 'b');
        expect(result.anchorMatched).toBe(true);
        expect(result.anchorPairKey).not.toBe('b');
        expect(result.matchesSinceAnchor).toBe(0);
    });

    it('stands for one other match and moves on after the second', () => {
        const b = board(['a b c', 'a b c', 'd d e', 'e f f'], ['a']);
        const stays = after(b, 'c', 0, 'a');
        expect(stays).toMatchObject({ anchorPairKey: 'c', anchorMatched: false, matchesSinceAnchor: 1 });
        expect(ANCHOR_PATIENCE_MATCHES).toBe(2);
        expect(after(b, 'c', 1, 'a').anchorPairKey).not.toBe('c');
    });

    it('moves at once when its pair left the board some other way (a pop, a bomb, the magpie)', () => {
        const b = board(['a b c', 'a b c', 'd d e', 'e f f'], ['a', 'c']);
        expect(after(b, 'c', 0, 'a').anchorPairKey).not.toBe('c');
    });

    it('marks exactly one card of the anchor, the first still face down, and goes quiet with nothing left', () => {
        const b = board(['a b', 'b a']);
        expect(anchorMarkedTileId(b, 'b')).toBe('b-1');
        expect(anchorMarkedTileId(b, null)).toBeNull();
        expect(after(board(['a a'], ['a']), null, 0, 'a').anchorPairKey).toBeNull();
    });
});
