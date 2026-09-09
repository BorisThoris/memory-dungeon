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
 *   A1 B1 C1 E1 E2 C2 G1 H1
 *   A2 B2 D1 D2 F1 F2 G2 H2
 *
 * A, B, C, G and H are ember; D, E and F are tide. A match on A reaches B and C1 within two steps,
 * and C's far half sits beside the G/H cluster on the other side of the board. G and H are whole
 * and adjacent throughout, so ember can always still pop and the severance drop never fires here -
 * the ladder is measured on its own.
 */
const EMBER = ['A', 'B', 'C', 'G', 'H'];
const suit = (id: string): TileSuit => (EMBER.includes(id[0]!) ? 'ember' : 'tide');
const tile = (id: string): Tile => makeTile(id, id[0]!, id[0]!, { suit: suit(id) });
const layout = (): Tile[] => [
    tile('A1'), tile('B1'), tile('C1'), tile('E1'), tile('E2'), tile('C2'), tile('G1'), tile('H1'),
    tile('A2'), tile('B2'), tile('D1'), tile('D2'), tile('F1'), tile('F2'), tile('G2'), tile('H2')
];
const board = (tiles: Tile[] = layout()): BoardState => makeBoard(tiles, { columns: 8, rows: 2, level: 3 });
const at = (chain: number): ClumpReadContext => ({ chain, run: { floorCurioId: null } });
const sorted = (ids: readonly string[] = []): string[] => [...ids].sort();
const RUNGS = chainTierRungs(8);

describe('the aim guide reads the tier it is actually on', () => {
    it('promises what this match takes now, not what Sharp would take', () => {
        const read = getClumpRead(board(), 'A1', at(1));

        expect(read?.suit).toBe('ember');
        // The connected ember region the tile stands in, itself included: A2, B1, B2 and C1.
        expect(read?.size).toBe(5);
        // A pop is contact: B has both halves inside the reach, C has only one, so B alone goes.
        expect(read?.now).toMatchObject({ tier: 'none', pairs: 1 });
        expect(sorted(read?.now.tileIds)).toEqual(['B1', 'B2']);
    });

    it('ghosts what the next rung would add, which is the hold decision on the board', () => {
        // Clean buys the partner reach, so C goes and its far half goes with it.
        const pop = getClumpRead(board(), 'A1', at(1));
        expect(pop?.next).toMatchObject({ tier: 'clean', pairs: 2, addedPairs: 1 });
        expect(sorted(pop?.next?.addedTileIds)).toEqual(['C1', 'C2']);

        // Sharp buys the reaction: C's far half seeds a second wave into the G/H cluster.
        const clean = getClumpRead(board(), 'A1', at(RUNGS.clean));
        expect(clean?.now).toMatchObject({ tier: 'clean', pairs: 2 });
        expect(clean?.next).toMatchObject({ tier: 'sharp', pairs: 4, addedPairs: 2 });
        expect(sorted(clean?.next?.addedTileIds)).toEqual(['G1', 'G2', 'H1', 'H2']);

        // Fever buys the halo: the neighbourhood of the first clump, whatever its suit.
        const sharp = getClumpRead(board(), 'A1', at(RUNGS.sharp));
        expect(sharp?.now).toMatchObject({ tier: 'sharp', pairs: 4 });
        expect(sharp?.next).toMatchObject({ tier: 'fever', pairs: 7, addedPairs: 3 });
        expect(sorted(sharp?.next?.addedTileIds)).toEqual(['D1', 'D2', 'E1', 'E2', 'F1', 'F2']);
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
        expect(getClumpRead(board(flipped), 'A1', at(1))?.size).toBe(5);

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
