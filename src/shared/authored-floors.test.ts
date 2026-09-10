import { describe, expect, it } from 'vitest';

import { GAME_RULES_VERSION, type BoardState, type MutatorId, type Tile } from './contracts';
import {
    AUTHORED_FLOOR_LAST_LEVEL,
    authoredFloorLayout,
    authoredSplitPairKey,
    isAuthoredFloor,
    layAuthoredFloorTiles
} from './authored-floors';
import { buildBoard } from './board-build-rules';
import { chainTierRungs } from './chain-tier-rules';
import { BOUNDED_BREAK_REACH, resolveChunkBreak } from './chunk-break-rules';
import { pairsForFloor } from './pair-curve';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { isSingletonUtilityPairKey, WILD_PAIR_KEY } from './tile-identity';

const SEEDS = [1, 7, 19_101, 42_001, 172_707, 867_5309, 1_234_567, 99] as const;
const run = { gameMode: 'endless' as const, floorCurioId: null };

/** The floor as a run builds it: the schedule's archetype, objective and mutators for that floor. */
const scheduledBoard = (level: number, runSeed: number): BoardState => {
    const entry = pickFloorScheduleEntry(runSeed, GAME_RULES_VERSION, level, 'endless');
    return buildBoard(level, {
        runSeed,
        runRulesVersion: GAME_RULES_VERSION,
        gameMode: 'endless',
        activeMutators: entry.mutators,
        floorTag: entry.floorTag,
        floorArchetypeId: entry.floorArchetypeId,
        featuredObjectiveId: entry.featuredObjectiveId,
        cycleFloor: entry.cycleFloor
    });
};

/** The floor with nothing scheduled, which is the harder case: a cursed pair a break never takes. */
const bareBoard = (level: number, runSeed: number, activeMutators: MutatorId[] = []): BoardState =>
    buildBoard(level, { runSeed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators });

const realPairs = (board: BoardState): Map<string, Tile[]> => {
    const byKey = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        byKey.set(tile.pairKey, [...(byKey.get(tile.pairKey) ?? []), tile]);
    }
    return byKey;
};

const orthogonalNeighbours = (index: number, columns: number, total: number): number[] => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const out: number[] = [];
    if (col > 0) out.push(index - 1);
    if (col < columns - 1 && index + 1 < total) out.push(index + 1);
    if (row > 0) out.push(index - columns);
    if (index + columns < total) out.push(index + columns);
    return out;
};

/** Share of a layout's orthogonal neighbour pairs that share a suit; a shuffle's rate is the target. */
const sameSuitOrthogonalRate = (layout: { columns: number; cells: readonly string[] }): number => {
    const total = layout.cells.length;
    let same = 0;
    let counted = 0;
    for (let cell = 0; cell < total; cell += 1) {
        for (const n of orthogonalNeighbours(cell, layout.columns, total)) {
            counted += 1;
            if (layout.cells[n] === layout.cells[cell]) same += 1;
        }
    }
    return counted === 0 ? 0 : same / counted;
};

/** Every cell a wave of `reach` reaches from `seeds`, walking same-suit cells the way a break does. */
const boundedWave = (
    layout: { columns: number; cells: readonly string[] },
    seeds: readonly number[],
    reach: number
): Set<number> => {
    const total = layout.cells.length;
    const suit = layout.cells[seeds[0]!];
    const seen = new Set<number>(seeds);
    const region = new Set<number>();
    let frontier = [...seeds];
    for (let step = 0; step < reach && frontier.length > 0; step += 1) {
        const next: number[] = [];
        for (const from of frontier) {
            const row = Math.floor(from / layout.columns);
            const column = from % layout.columns;
            // Corners count: Gen 204 made every tier's wave walk diagonals.
            for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const) {
                const nextRow = row + dr;
                const nextColumn = column + dc;
                if (nextRow < 0 || nextColumn < 0 || nextColumn >= layout.columns) continue;
                const cell = nextRow * layout.columns + nextColumn;
                if (cell < 0 || cell >= total || seen.has(cell) || layout.cells[cell] !== suit) continue;
                seen.add(cell);
                region.add(cell);
                next.push(cell);
            }
        }
        frontier = next;
    }
    return region;
};

/** Every way the seed could pair up a suit's cells: any two of them can be the matched pair. */
const pairings = (cells: readonly number[]): Array<[number, number]> =>
    cells.flatMap((a, index) => cells.slice(index + 1).map((b) => [a, b] as [number, number]));

const boardsUnderTest = (level: number): Array<[string, BoardState]> =>
    SEEDS.flatMap((seed) => [
        [`seed ${seed} scheduled`, scheduledBoard(level, seed)] as [string, BoardState],
        [`seed ${seed} bare`, bareBoard(level, seed)] as [string, BoardState],
        [`seed ${seed} findables floor`, bareBoard(level, seed, ['findables_floor'])] as [string, BoardState]
    ]);

describe('the authored floors', () => {
    it('are the first three, and every one of them carries a layout', () => {
        expect(AUTHORED_FLOOR_LAST_LEVEL).toBe(3);
        for (const level of [1, 2, 3]) {
            const layout = authoredFloorLayout(level)!;
            expect(isAuthoredFloor(level)).toBe(true);
            expect(layout.pairs, `floor ${level}`).toBe(pairsForFloor(level));
            expect(layout.cells.length).toBe(layout.pairs * 2);
            expect(layout.rows * layout.columns).toBeGreaterThanOrEqual(layout.cells.length);
            expect((layout.rows - 1) * layout.columns).toBeLessThan(layout.cells.length);
        }
        expect(isAuthoredFloor(4)).toBe(false);
        expect(isAuthoredFloor(0)).toBe(false);
        expect(isAuthoredFloor(1.5)).toBe(false);
        expect(authoredFloorLayout(4)).toBeNull();
    });

    it('N1/N2: every tile has its partner and the board is exactly two tiles per pair, on every seed', () => {
        for (const level of [1, 2, 3]) {
            for (const [where, board] of boardsUnderTest(level)) {
                const layout = authoredFloorLayout(level);
                const pairs = realPairs(board);
                expect(board.pairCount, `${level} ${where}`).toBe(pairsForFloor(level));
                expect(board.tiles.length, `${level} ${where}`).toBe(2 * board.pairCount);
                expect(pairs.size, `${level} ${where}`).toBe(board.pairCount);
                for (const [key, halves] of pairs) {
                    expect(halves.length, `${level} ${where} ${key}`).toBe(2);
                    expect(halves[0]!.suit, `${level} ${where} ${key} halves share a suit`).toBe(halves[1]!.suit);
                }
                if (!layout) continue;
                expect(board.columns).toBe(layout.columns);
                expect(board.rows).toBe(layout.rows);
                // The shape is the authored one, whatever the seed did to the symbols.
                expect(board.tiles.map((tile) => tile.suit), `${level} ${where}`).toEqual([...layout.cells]);
            }
        }
    });

    it('take their symbols and their placement from the seed, and their shape from the author', () => {
        const a = bareBoard(2, 11);
        const b = bareBoard(2, 12);
        expect(a.tiles.map((tile) => tile.suit)).toEqual(b.tiles.map((tile) => tile.suit));
        expect(a.tiles.map((tile) => tile.pairKey)).not.toEqual(b.tiles.map((tile) => tile.pairKey));
        expect(bareBoard(3, 11)).toEqual(bareBoard(3, 11));
    });

    it('carry no traits: traits start on floor 4', () => {
        for (const level of [1, 2, 3]) {
            for (const [where, board] of boardsUnderTest(level)) {
                expect(board.tiles.filter((tile) => tile.tileTraitKind != null), `${level} ${where}`).toEqual([]);
            }
        }
    });

    it('keep a handed board as it was handed', () => {
        const fixed: Tile[] = [
            { id: 'a1', pairKey: 'a', symbol: 'a', label: 'a', state: 'hidden', suit: 'moss' },
            { id: 'a2', pairKey: 'a', symbol: 'a', label: 'a', state: 'hidden', suit: 'moss' }
        ];
        const board = buildBoard(1, { fixedTiles: fixed, fixedTilesMode: 'exact', runSeed: 1, runRulesVersion: GAME_RULES_VERSION });
        expect(board.tiles).toEqual(fixed);
    });

    it('puts a singleton after the authored cells rather than inside the shape', () => {
        const board = buildBoard(2, { runSeed: 5, runRulesVersion: GAME_RULES_VERSION, includeWildTile: true });
        const layout = authoredFloorLayout(2)!;
        expect(board.tiles.length).toBe(layout.cells.length + 1);
        expect(board.tiles.at(-1)?.pairKey).toBe(WILD_PAIR_KEY);
        expect(board.tiles.slice(0, layout.cells.length).map((tile) => tile.suit)).toEqual([...layout.cells]);
    });

    it('falls back to the procedural deal when the tiles do not fit the layout', () => {
        const layout = authoredFloorLayout(2)!;
        const twoPairs: Tile[] = ['a', 'b'].flatMap((key) => [
            { id: `${key}1`, pairKey: key, symbol: key, label: key, state: 'hidden' as const },
            { id: `${key}2`, pairKey: key, symbol: key, label: key, state: 'hidden' as const }
        ]);
        expect(layAuthoredFloorTiles(twoPairs, layout)).toBeNull();
    });
});

describe('N6: the first pop', () => {
    it('floor 1: whatever the player matches first, at least one other pair pops with it', () => {
        for (const [where, board] of boardsUnderTest(1)) {
            for (const [key, halves] of realPairs(board)) {
                const result = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain: 0 });
                expect(result.tier, `${where} match ${key}`).toBe('none');
                expect(result.brokenPairKeys.length, `${where} match ${key}`).toBeGreaterThanOrEqual(1);
                expect(result.brokenPairKeys, `${where} match ${key}`).not.toContain(key);
            }
        }
    });

    it('floor 1: two suits, and a pop that never leaves the one it started in', () => {
        /*
         * Gen 205 kept floor 1's layout and redrew it. The measurement that nearly removed it -
         * every match pops on 300 of 300 ordinary deals at four pairs - was measuring a board of
         * ONE suit, because `suitCountForPairs(4)` is one. A one-colour board is a board with no
         * map on it (Gen 193), and given two suits only 0.371 of the arrangements of eight cells
         * pop from every pair. The layout buys both; what it no longer buys is two solid blocks.
         *
         * The old test here asserted "the pop stops at the line between them", which was a property
         * of those blocks rather than of the rule. The rule is that a pop never leaves the suit it
         * started in, and that is what is asserted now - line or no line.
         */
        for (const [where, board] of boardsUnderTest(1)) {
            expect(new Set(board.tiles.map((tile) => tile.suit)).size, where).toBe(2);
            for (const [key, halves] of realPairs(board)) {
                const suit = halves[0]!.suit;
                const result = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain: 0 });
                expect(result.brokenPairKeys.length, `${where} match ${key} pops`).toBeGreaterThanOrEqual(1);
                const taken = board.tiles.filter((tile) => result.brokenTileIds.includes(tile.id));
                expect(taken.map((tile) => tile.suit), `${where} match ${key} stays in suit`).toEqual(taken.map(() => suit));
            }
        }
    });

    it('carries no cursed pair: a pair a break cannot take would cancel the guarantee', () => {
        for (const level of [1, 2, 3]) {
            for (const [where, board] of boardsUnderTest(level)) {
                expect(board.cursedPairKey, `${level} ${where}`).toBeNull();
            }
        }
    });

    it('floor 2: a match pops inside its own band and never takes a tile of another suit', () => {
        for (const [where, board] of boardsUnderTest(2)) {
            expect(new Set(board.tiles.map((tile) => tile.suit)).size, where).toBe(3);
            const rungs = chainTierRungs(board.pairCount);
            for (const [key, halves] of realPairs(board)) {
                const suit = halves[0]!.suit;
                // Below Sharp the wave never leaves the suit. From Sharp the bridge deliberately
                // carries it into the clump next door, which `chunk-break-rules.test.ts` pins.
                for (const chain of [0, rungs.clean]) {
                    const result = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain });
                    const taken = board.tiles.filter((tile) => result.brokenTileIds.includes(tile.id));
                    expect(taken.map((tile) => tile.suit), `${where} match ${key} chain ${chain}`).toEqual(taken.map(() => suit));
                }
                // The clumps are small enough that a lone match pops here too.
                const lone = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain: 0 });
                expect(lone.brokenPairKeys.length, `${where} match ${key}`).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('floor 2: three suits, interleaved, each still one reachable group', () => {
        /*
         * Gen 205: this used to require each suit be one ORTHOGONALLY connected clump - which is to
         * say, a band. The lesson never needed a band; it needs each suit to be one group the wave
         * can walk, and the wave walks corners. Interleaved, floor 2 reads 0.294 same-suit
         * orthogonal neighbours instead of 0.529, and the guarantee below is unchanged.
         */
        const layout = authoredFloorLayout(2)!;
        const total = layout.cells.length;
        const suits = [...new Set(layout.cells)];
        expect(suits.length).toBe(3);
        /*
         * The board has to read like a shuffle of its own tiles - which means near the rate a
         * shuffle gives, on BOTH sides. Three suits of four over twelve cells put a same-suit tile
         * beside you 3/11 of the time; the bands read 0.529 and a checkerboard reads 0.000, and a
         * checkerboard is as obviously drawn by hand as a block is.
         */
        const chance = 3 / 11;
        expect(sameSuitOrthogonalRate(layout), 'floor 2 reads as a shuffle: neither bands nor a checkerboard').toBeCloseTo(
            chance,
            1
        );

        for (const suit of suits) {
            const cells = layout.cells.flatMap((s, cell) => (s === suit ? [cell] : []));
            expect(cells.length, `${suit} is a whole number of pairs`).toBe(total / 3);
            expect(cells.length % 2, `${suit} is a whole number of pairs`).toBe(0);
            // One group, walked the way the wave walks it: corners count (Gen 204).
            const seen = new Set<number>([cells[0]!]);
            const stack = [cells[0]!];
            while (stack.length > 0) {
                const cell = stack.pop()!;
                const row = Math.floor(cell / layout.columns);
                const column = cell % layout.columns;
                for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const) {
                    const nextRow = row + dr;
                    const nextColumn = column + dc;
                    if (nextRow < 0 || nextColumn < 0 || nextColumn >= layout.columns) continue;
                    const n = nextRow * layout.columns + nextColumn;
                    if (n < 0 || n >= total || seen.has(n)) continue;
                    if (layout.cells[n] !== suit) continue;
                    seen.add(n);
                    stack.push(n);
                }
            }
            expect(seen.size, `${suit} is one group the wave can walk`).toBe(cells.length);
        }
    });

    it('floors 1 and 2: however the seed pairs a suit, matching one pair leaves the other inside the wave', () => {
        /*
         * The geometric statement of the guarantee the two floors above assert on real boards. It
         * is stated on the layout as well because the layout is what has to hold it: which two of a
         * suit's four cells become a pair is the seed's business, so all three pairings have to
         * work. Until Gen 205 this was written as a Manhattan distance, which was a fair reading of
         * the wave when the wave walked orthogonally; it walks corners now (Gen 204), so it is
         * written as the walk.
         */
        for (const level of [1, 2]) {
            const layout = authoredFloorLayout(level)!;
            for (const suit of new Set(layout.cells)) {
                const cells = layout.cells.flatMap((s, cell) => (s === suit ? [cell] : []));
                expect(cells.length, `floor ${level} ${suit} is two pairs`).toBe(4);
                for (const matched of pairings(cells)) {
                    const rest = cells.filter((cell) => !matched.includes(cell));
                    const region = boundedWave(layout, matched, BOUNDED_BREAK_REACH);
                    expect(rest.every((cell) => region.has(cell)), `floor ${level} ${suit} match ${matched}`).toBe(true);
                }
            }
        }
    });
});

describe('N7: the split pair on floor 3', () => {
    const splitOf = (board: BoardState) => {
        const layout = authoredFloorLayout(3)!;
        const key = authoredSplitPairKey(board.tiles, layout)!;
        const [near, far] = layout.splitCells!;
        return { key, near, far, layout };
    };

    it('sits with one half in the Ember clump and the other across the board, touching no Ember', () => {
        for (const [where, board] of boardsUnderTest(3)) {
            const { key, near, far, layout } = splitOf(board);
            expect(board.tiles[near]!.pairKey, where).toBe(key);
            expect(board.tiles[far]!.pairKey, where).toBe(key);
            expect(board.tiles[near]!.suit).toBe('ember');
            expect(board.tiles[far]!.suit).toBe('ember');
            for (const n of orthogonalNeighbours(far, layout.columns, board.tiles.length)) {
                expect(board.tiles[n]!.suit, `${where} far half touches no ember`).not.toBe('ember');
            }
            // Neither the cursed pair nor a findable: a break has to be able to take it.
            expect(board.cursedPairKey, where).not.toBe(key);
            expect(board.tiles[near]!.findableKind, where).toBeUndefined();
        }
    });

    it('is never reached by a wave below Clean: if it leaves on a lone match, it is the drop that took it', () => {
        // The pop cannot reach the far half - that is the point of the split. What can take the
        // pair at chain zero is the severance drop: once the clump's other pairs have gone, the
        // suit has no two pairs within reach of each other and its last pair falls. Either way the
        // player sees a tile leave from somewhere they were not looking, which is the lesson.
        for (const [where, board] of boardsUnderTest(3)) {
            const { key, near } = splitOf(board);
            for (const [matched, halves] of realPairs(board)) {
                if (matched === key || halves[0]!.suit !== board.tiles[near]!.suit) continue;
                const result = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain: 0 });
                expect(result.tier).toBe('none');
                expect(result.wavePairKeys.flat(), `${where} match ${matched}`).not.toContain(key);
                if (result.brokenPairKeys.includes(key)) {
                    expect(result.droppedPairKeys, `${where} match ${matched}`).toContain(key);
                }
            }
        }
    });

    it('is never taken by a pop at Clean either: a split pair is memory\'s job, not the wave\'s', () => {
        // What this floor teaches changed at Gen 197. It used to teach the partner reach: match
        // inside the clump at Clean and the far half flew out from across the board. Nothing
        // reaches across the board any more, so the split pair teaches the rule that replaced it -
        // a pop takes what it is touching, and a pair you have pulled apart is yours to remember.
        for (const [where, board] of boardsUnderTest(3)) {
            const { key, near } = splitOf(board);
            const clean = chainTierRungs(board.pairCount).clean;
            let clumpPairs = 0;
            for (const [matched, halves] of realPairs(board)) {
                if (matched === key || halves[0]!.suit !== board.tiles[near]!.suit) continue;
                clumpPairs += 1;
                const result = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain: clean });
                expect(result.tier, `${where} match ${matched}`).toBe('clean');
                expect(result.wavePairKeys.flat(), `${where} match ${matched}`).not.toContain(key);
                // It may still leave, but only as the severance drop, which says so in its own beat.
                if (result.brokenPairKeys.includes(key)) {
                    expect(result.droppedPairKeys, `${where} match ${matched}`).toContain(key);
                }
            }
            // Every Ember pair the layout puts in the clump, not a magic number: the suit's cells
            // less the two the split pair holds, over two.
            const layout = authoredFloorLayout(3)!;
            const emberCells = layout.cells.filter((suit) => suit === 'ember').length;
            expect(clumpPairs, where).toBe((emberCells - 2) / 2);
            expect(clumpPairs, `${where} the lesson needs more than one pair to be taught from`).toBeGreaterThanOrEqual(2);
        }
    });

    it('the in-clump half is within one bounded wave of every other clump cell, around any matched pair', () => {
        // The guarantee above rests on this geometry, so it is stated on the layout too.
        const layout = authoredFloorLayout(3)!;
        const total = layout.cells.length;
        const [near] = layout.splitCells!;
        const clump = layout.cells.flatMap((suit, cell) => (suit === 'ember' && cell !== near && cell !== layout.splitCells![1] ? [cell] : []));
        expect(clump.length, 'the clump is two pairs').toBe(4);
        for (const matched of pairings(clump)) {
            const region = boundedWave(layout, matched, BOUNDED_BREAK_REACH);
            expect(region.has(near), `pair at ${matched}`).toBe(true);
            // And the clump's other pair goes, which is what the player sees the wave do.
            const rest = clump.filter((cell) => !matched.includes(cell));
            expect(rest.every((cell) => region.has(cell)), `pair at ${matched} pops the other pair`).toBe(true);
        }
        // The far half is out of reach of every cell of its own suit, at any tier: nothing Ember
        // touches it, so no wave can step into it however far it runs.
        const far = layout.splitCells![1];
        for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const) {
            const row = Math.floor(far / layout.columns) + dr;
            const column = (far % layout.columns) + dc;
            if (row < 0 || column < 0 || column >= layout.columns) continue;
            const cell = row * layout.columns + column;
            if (cell < 0 || cell >= total) continue;
            expect(layout.cells[cell], `far half touches ${cell}`).not.toBe('ember');
        }
    });
});
