import { describe, expect, it } from 'vitest';
import type { BoardState, Tile, TileSuit } from './contracts';
import { getClumpRead, type ClumpReadContext } from './clump-read-rules';
import { resolveChunkBreak } from './chunk-break-rules';
import { chainTierRungs } from './chain-tier-rules';
import { makeBoard, makeTile } from './test/game-fixtures';

/*
 * Eight pairs, two rows, laid out so every rung of the ladder takes visibly more than the one
 * below it - which is the whole point of the guide (thesis §30.2), and the thing it could not say
 * until Gen 185 because it reported the Sharp answer at every tier.
 *
 *   A1 A2 B1 B2 C1 C2 D1 D2        A B C D ember
 *   E1 E2 F1 F2 G1 G2 H1 H2        E G tide, F H moss
 *
 * A match on A walks the ember row: two steps reach B, four reach C and D. The row below is two
 * suits laid alternately, so the bridge at Sharp catches one of them (moss, the first the wave
 * touches) and Fever, catching three, takes the other as well. Every pair is whole and beside its
 * partner, so nothing here is ever stranded and the severance drop never fires - the ladder is
 * measured on its own.
 */
const SUITS: Readonly<Record<string, TileSuit>> = {
    A: 'ember', B: 'ember', C: 'ember', D: 'ember', E: 'tide', F: 'moss', G: 'tide', H: 'moss'
};
const suit = (id: string): TileSuit => SUITS[id[0]!]!;
const tile = (id: string): Tile => makeTile(id, id[0]!, id[0]!, { suit: suit(id) });
const layout = (): Tile[] =>
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H1', 'H2'].map(tile);
const board = (tiles: Tile[] = layout()): BoardState => makeBoard(tiles, { columns: 8, rows: 2, level: 3 });
const at = (chain: number): ClumpReadContext => ({ chain, run: { floorCurioId: null } });
const sorted = (ids: readonly string[] = []): string[] => [...ids].sort();
const RUNGS = chainTierRungs(8);

describe('the aim guide reads the tier it is actually on', () => {
    it('promises what this match takes now, not what Sharp would take', () => {
        const read = getClumpRead(board(), 'A1', at(1));

        expect(read?.suit).toBe('ember');
        // The connected ember region the tile stands in, itself included: the whole top row.
        expect(read?.size).toBe(8);
        // A pop walks two steps: B is inside them, C is one card further on.
        expect(read?.now).toMatchObject({ tier: 'none', pairs: 1 });
        expect(sorted(read?.now.tileIds)).toEqual(['B1', 'B2']);
    });

    it('ghosts what the next rung would add, which is the hold decision on the board', () => {
        // Clean buys depth: the same wave, walked twice as far along the same row.
        const pop = getClumpRead(board(), 'A1', at(1));
        expect(pop?.next).toMatchObject({ tier: 'clean', pairs: 3, addedPairs: 2 });
        expect(sorted(pop?.next?.addedTileIds)).toEqual(['C1', 'C2', 'D1', 'D2']);

        // Sharp buys the bridge: the wave crosses into the one clump it was touching.
        const clean = getClumpRead(board(), 'A1', at(RUNGS.clean));
        expect(clean?.now).toMatchObject({ tier: 'clean', pairs: 3 });
        expect(clean?.next).toMatchObject({ tier: 'sharp', pairs: 5, addedPairs: 2 });
        expect(sorted(clean?.next?.addedTileIds)).toEqual(['F1', 'F2', 'H1', 'H2']);

        // Fever catches three clumps rather than one, so the other suit below goes too.
        const sharp = getClumpRead(board(), 'A1', at(RUNGS.sharp));
        expect(sharp?.now).toMatchObject({ tier: 'sharp', pairs: 5 });
        expect(sharp?.next).toMatchObject({ tier: 'fever', pairs: 7, addedPairs: 2 });
        expect(sorted(sharp?.next?.addedTileIds)).toEqual(['E1', 'E2', 'G1', 'G2']);
    });

    it('has no rung left to ghost at Fever', () => {
        const fever = getClumpRead(board(), 'A1', at(RUNGS.fever));

        expect(fever?.now).toMatchObject({ tier: 'fever', pairs: 7 });
        expect(fever?.next).toBeNull();
    });

    it('promises exactly what the break rule does, at every rung', () => {
        // The guide previews by running the rule. This is the assertion that keeps it honest: a
        // second implementation of the reach is what made it lie at every tier until Gen 185.
        for (const chain of [0, 1, RUNGS.clean, RUNGS.sharp, RUNGS.fever, 20]) {
            const read = getClumpRead(board(), 'A1', at(chain));
            const broke = resolveChunkBreak({
                board: board(),
                run: { floorCurioId: null },
                matchedTileIds: ['A1', 'A2'],
                chain
            });

            expect(sorted(read?.now.tileIds), `chain ${chain}`).toEqual(sorted(broke.brokenTileIds));
            expect(read?.now.pairs, `chain ${chain}`).toBe(broke.brokenPairKeys.length);
        }
    });

    it('reads a flipped tile, and nothing for a tile that has left the board', () => {
        // A flipped tile still stands in its clump: the break fires when its partner turns up.
        const flipped = layout().map((t) => (t.id === 'A1' ? { ...t, state: 'flipped' as const } : t));
        expect(getClumpRead(board(flipped), 'A1', at(1))?.size).toBe(8);

        const matched = layout().map((t) => (t.id === 'A1' ? { ...t, state: 'matched' as const } : t));
        expect(getClumpRead(board(matched), 'A1', at(1))).toBeNull();

        const gone = layout().map((t) => (t.pairKey === 'B' ? { ...t, state: 'removed' as const } : t));
        // With B gone, C is cut off from A: the clump is A alone, and this match takes nothing -
        // which is exactly the read a player deciding whether to spend it here needs.
        const cutOff = getClumpRead(board(gone), 'A1', at(1));
        expect(cutOff?.size).toBe(2);
        expect(cutOff?.now.pairs).toBe(0);
        expect(cutOff?.next).toMatchObject({ tier: 'clean', addedPairs: 0 });
        expect(cutOff?.next?.addedTileIds).toEqual([]);
        expect(getClumpRead(board(gone), 'B1', at(1))).toBeNull();
    });
});
