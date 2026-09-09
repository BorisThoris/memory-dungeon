import { describe, expect, it } from 'vitest';
import type { BoardState, Tile, TileState } from './contracts';
import { settleBoardTowardCentre, tileIsSettleLive } from './board-settle-rules';

const tile = (id: string, state: TileState = 'hidden'): Tile => ({
    id,
    pairKey: id,
    symbol: id,
    label: id,
    state
});

/**
 * Build a board from a picture. A letter is a live card, a dot is a hole the settle should close.
 * Written as rows of a grid so the assertions can be read as pictures too.
 */
const boardFrom = (rows: string[]): BoardState => {
    const columns = rows[0]!.length;
    const tiles = rows
        .flatMap((row) => [...row])
        .map((cell, index) => (cell === '.' ? tile(`hole${index}`, 'matched') : tile(cell)));
    return {
        level: 1,
        rows: rows.length,
        columns,
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        pairCount: 0,
        floorArchetypeId: null,
        featuredObjectiveId: null
    };
};

const pictureOf = (board: BoardState): string[] => {
    const rows: string[] = [];
    for (let row = 0; row < board.rows; row += 1) {
        const cells = board.tiles
            .slice(row * board.columns, (row + 1) * board.columns)
            .map((candidate) => (tileIsSettleLive(candidate) ? candidate.id : '.'));
        rows.push(cells.join(''));
    }
    return rows;
};

describe('tileIsSettleLive', () => {
    it('counts a card still in play and treats every cleared state as a hole', () => {
        expect(tileIsSettleLive(tile('a', 'hidden'))).toBe(true);
        expect(tileIsSettleLive(tile('a', 'flipped'))).toBe(true);
        expect(tileIsSettleLive(tile('a', 'matched'))).toBe(false);
        expect(tileIsSettleLive(tile('a', 'removed'))).toBe(false);
    });
});

describe('settleBoardTowardCentre', () => {
    it('closes a hole at the middle and lets the gap bubble to the outside', () => {
        const settled = settleBoardTowardCentre(
            boardFrom([
                'abc', //
                'd.e',
                'fgh'
            ])
        );
        // The card above falls in, and the gap it leaves is filled in turn by the corner behind it,
        // so what ends up empty is the cell furthest from the middle.
        expect(pictureOf(settled)).toEqual(['.ac', 'dbe', 'fgh']);
    });

    it('unpacks a slab sitting off-centre, which a step-by-step settle would deadlock on', () => {
        // Eight cards in a solid block below the middle. No single card has an inward neighbour to
        // step into, so a settle that only ever moves a card one cell would leave this as it is.
        const settled = settleBoardTowardCentre(
            boardFrom([
                '....', //
                '....',
                'abcd',
                'efgh'
            ])
        );
        expect(pictureOf(settled)).toEqual(['....', '.ad.', 'ebch', '.fg.']);
    });

    it('never moves a card outward, whatever the board looks like', () => {
        const before = boardFrom([
            'a.b.c', //
            '.d.e.',
            'f...g',
            '.h.i.',
            'j.k.l'
        ]);
        const settled = settleBoardTowardCentre(before);
        const away = (index: number): number => (index % 5 - 2) ** 2 + (Math.floor(index / 5) - 2) ** 2;
        for (const card of before.tiles.filter(tileIsSettleLive)) {
            const from = before.tiles.findIndex((candidate) => candidate.id === card.id);
            const to = settled.tiles.findIndex((candidate) => candidate.id === card.id);
            expect(away(to)).toBeLessThanOrEqual(away(from));
        }
    });

    it('takes the nearest card for a gap, so the hole walks out instead of a card being flung in', () => {
        // A full board with one gap in the dead centre. Each move is a single step, and the gap
        // travels outward to the corner rather than any one card crossing the grid.
        const settled = settleBoardTowardCentre(
            boardFrom([
                'abcde', //
                'fghij',
                'kl.mn',
                'opqrs',
                'tuvwx'
            ])
        );
        expect(pictureOf(settled)).toEqual(['.abde', 'fgcij', 'klhmn', 'opqrs', 'tuvwx']);
    });

    it('leaves a board with no holes exactly as it found it', () => {
        const packed = boardFrom([
            'abc', //
            'def',
            'ghi'
        ]);
        expect(settleBoardTowardCentre(packed).tiles.map((candidate) => candidate.id)).toEqual(
            packed.tiles.map((candidate) => candidate.id)
        );
    });

    it('is pure: the board it was handed is not touched', () => {
        const before = boardFrom([
            'abc', //
            'd.e',
            'fgh'
        ]);
        const snapshot = before.tiles.map((candidate) => candidate.id);
        settleBoardTowardCentre(before);
        expect(before.tiles.map((candidate) => candidate.id)).toEqual(snapshot);
    });

    it('is deterministic: the same board settles the same way every time', () => {
        const before = boardFrom([
            'a.b.c', //
            '.d.e.',
            'f...g',
            '.h.i.',
            'j.k.l'
        ]);
        const once = settleBoardTowardCentre(before);
        const twice = settleBoardTowardCentre(before);
        expect(pictureOf(twice)).toEqual(pictureOf(once));
        // And settling an already settled board changes nothing more.
        expect(pictureOf(settleBoardTowardCentre(once))).toEqual(pictureOf(once));
    });

    it('keeps every card that was on the board', () => {
        const before = boardFrom([
            'ab.cd', //
            '.e.f.',
            'g..h.',
            'i.j.k'
        ]);
        const settled = settleBoardTowardCentre(before);
        expect(settled.tiles).toHaveLength(before.tiles.length);
        expect(settled.tiles.map((candidate) => candidate.id).sort()).toEqual(before.tiles.map((candidate) => candidate.id).sort());
    });

    it('hands back a board with a single column or no tiles untouched', () => {
        const column = boardFrom(['a', '.', 'b']);
        expect(pictureOf(settleBoardTowardCentre(column))).toEqual(['.', 'a', 'b']);
        expect(pictureOf(settleBoardTowardCentre(boardFrom(['.', 'a', '.'])))).toEqual(['.', 'a', '.']);
        const empty = { ...boardFrom(['a']), tiles: [], rows: 0 };
        expect(settleBoardTowardCentre(empty).tiles).toEqual([]);
    });
});
