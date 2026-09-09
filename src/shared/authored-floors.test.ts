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

const boardsUnderTest = (level: number): Array<[string, BoardState]> =>
    SEEDS.flatMap((seed) => [
        [`seed ${seed} scheduled`, scheduledBoard(level, seed)] as [string, BoardState],
        [`seed ${seed} bare`, bareBoard(level, seed)] as [string, BoardState],
        [`seed ${seed} findables floor`, bareBoard(level, seed, ['findables_floor'])] as [string, BoardState]
    ]);

describe('the authored floors', () => {
    it('are the first three, and their sizes are the curve\'s', () => {
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
                const layout = authoredFloorLayout(level)!;
                const pairs = realPairs(board);
                expect(board.pairCount, `${level} ${where}`).toBe(pairsForFloor(level));
                expect(board.tiles.length, `${level} ${where}`).toBe(2 * board.pairCount);
                expect(pairs.size, `${level} ${where}`).toBe(board.pairCount);
                for (const [key, halves] of pairs) {
                    expect(halves.length, `${level} ${where} ${key}`).toBe(2);
                    expect(halves[0]!.suit, `${level} ${where} ${key} halves share a suit`).toBe(halves[1]!.suit);
                }
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
        const board = buildBoard(1, { runSeed: 5, runRulesVersion: GAME_RULES_VERSION, includeWildTile: true });
        const layout = authoredFloorLayout(1)!;
        expect(board.tiles.length).toBe(layout.cells.length + 1);
        expect(board.tiles.at(-1)?.pairKey).toBe(WILD_PAIR_KEY);
        expect(board.tiles.slice(0, layout.cells.length).map((tile) => tile.suit)).toEqual([...layout.cells]);
    });

    it('falls back to the procedural deal when the tiles do not fit the layout', () => {
        const layout = authoredFloorLayout(1)!;
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

    it('floor 1 is two suits, and the pop stops at the line between them', () => {
        for (const [where, board] of boardsUnderTest(1)) {
            expect(new Set(board.tiles.map((tile) => tile.suit)), where).toEqual(new Set(['ember', 'tide']));
            for (const [key, halves] of realPairs(board)) {
                const suit = halves[0]!.suit;
                const result = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain: 0 });
                const taken = board.tiles.filter((tile) => result.brokenTileIds.includes(tile.id));
                expect(taken.map((tile) => tile.suit), `${where} match ${key}`).toEqual(taken.map(() => suit));
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
                for (const chain of [0, rungs.clean, rungs.sharp]) {
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

    it('floor 2: three bands, each one solid clump of its own suit', () => {
        const layout = authoredFloorLayout(2)!;
        const total = layout.cells.length;
        const suits = [...new Set(layout.cells)];
        expect(suits.length).toBe(3);
        for (const suit of suits) {
            const cells = layout.cells.flatMap((s, cell) => (s === suit ? [cell] : []));
            expect(cells.length, `${suit} is a whole number of pairs`).toBe(total / 3);
            expect(cells.length % 2, `${suit} is a whole number of pairs`).toBe(0);
            const seen = new Set<number>([cells[0]!]);
            const stack = [cells[0]!];
            while (stack.length > 0) {
                const cell = stack.pop()!;
                for (const n of orthogonalNeighbours(cell, layout.columns, total)) {
                    if (layout.cells[n] === suit && !seen.has(n)) {
                        seen.add(n);
                        stack.push(n);
                    }
                }
            }
            expect(seen.size, `${suit} is one clump`).toBe(cells.length);
        }
    });

    it('floor 2: any two cells of a band are within a bounded wave of each other, so every band pops', () => {
        const layout = authoredFloorLayout(2)!;
        const step = (a: number, b: number) =>
            Math.abs((a % layout.columns) - (b % layout.columns)) +
            Math.abs(Math.floor(a / layout.columns) - Math.floor(b / layout.columns));
        for (const suit of new Set(layout.cells)) {
            const cells = layout.cells.flatMap((s, cell) => (s === suit ? [cell] : []));
            // However the seed splits a band's cells into pairs, one matched pair leaves the other
            // with both halves inside the wave: every cell of the band is close enough to some cell
            // of every other pair in it.
            for (const cell of cells) {
                const reachable = cells.filter((other) => other !== cell && step(cell, other) <= BOUNDED_BREAK_REACH);
                expect(reachable.length, `${suit} cell ${cell}`).toBeGreaterThanOrEqual(cells.length - 2);
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

    it('is taken at Clean from any pair inside the clump: the far half flies out', () => {
        for (const [where, board] of boardsUnderTest(3)) {
            const { key, near } = splitOf(board);
            const clean = chainTierRungs(board.pairCount).clean;
            let clumpPairs = 0;
            for (const [matched, halves] of realPairs(board)) {
                if (matched === key || halves[0]!.suit !== board.tiles[near]!.suit) continue;
                clumpPairs += 1;
                const result = resolveChunkBreak({ board, run, matchedTileIds: halves.map((t) => t.id), chain: clean });
                expect(result.tier, `${where} match ${matched}`).toBe('clean');
                expect(result.wavePairKeys.flat(), `${where} match ${matched}`).toContain(key);
                expect(result.brokenTileIds, `${where} match ${matched}`).toContain(board.tiles[near]!.id);
                expect(result.board.tiles[near]!.state).toBe('removed');
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
        const reaches = (seeds: number[], blocked: Set<number>): boolean => {
            let frontier = seeds;
            const seen = new Set([...seeds, ...blocked]);
            for (let step = 0; step < BOUNDED_BREAK_REACH; step += 1) {
                const next: number[] = [];
                for (const from of frontier) {
                    for (const n of orthogonalNeighbours(from, layout.columns, total)) {
                        if (seen.has(n) || layout.cells[n] !== 'ember') continue;
                        if (n === near) return true;
                        seen.add(n);
                        next.push(n);
                    }
                }
                frontier = next;
            }
            return false;
        };
        for (const a of clump) {
            for (const b of clump) {
                if (a >= b) continue;
                expect(reaches([a, b], new Set()), `pair at ${a},${b}`).toBe(true);
            }
        }
    });
});
