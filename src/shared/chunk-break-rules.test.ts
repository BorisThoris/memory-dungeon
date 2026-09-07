import { describe, expect, it } from 'vitest';
import type { BoardState, Tile, TileSuit } from './contracts';
import { getPairProximityGridDistance } from './pairProximityHint';
import { resolveBoardTurn, flipTile } from './game';
import { makeBoard, makeRun, makeTile } from './test/game-fixtures';
import { EXIT_PAIR_KEY } from './dungeon-rules';
import {
    chunkBreakComboShards,
    chunkBreakScore,
    findSuitRegion,
    DROP_MAX_PAIRS,
    MAGPIE_LEDGER_GOLD_MULTIPLIER,
    RIPPLE_MAX_WAVES,
    resolveChunkBreak,
    rippleLift,
    rippleWaves,
    tileCanBreakInChunk
} from './chunk-break-rules';

/**
 * A 4-column board, read left to right, top to bottom. Letters are pairs; the suit is in the map.
 *
 *   A  B  C  D        A B C ember, D tide
 *   A' B' E  F        E F tide
 *   D' C' E' F'
 *
 * Match A. Every match pops the whole ember clump touching it: B and, through B', C. D's clump
 * is tide and never comes along. The chain buys the ripple, shown on the row layout below.
 */
const suit = (id: string): TileSuit => (['A', 'B', 'C'].includes(id[0]!) ? 'ember' : 'tide');
const tile = (id: string, extra: Partial<Tile> = {}): Tile =>
    makeTile(id, id[0]!, id[0]!, { suit: suit(id), ...extra });
const layout = (): Tile[] => [
    tile('A1'), tile('B1'), tile('C1'), tile('D1'),
    tile('A2'), tile('B2'), tile('E1'), tile('F1'),
    tile('D2'), tile('C2'), tile('E2'), tile('F2')
];
const board = (tiles: Tile[] = layout(), overrides: Partial<BoardState> = {}): BoardState =>
    makeBoard(tiles, { columns: 4, rows: 3, level: 3, ...overrides });
const endless = { gameMode: 'endless' as const };

/**
 * One row, read left to right, for the ripple. A's clump reaches B1; B's partner sits two tiles
 * on, touching C1; C's partner touches D1; D's partner touches nothing ember.
 *
 *   A1 A2 B1 T1 B2 C1 T2 C2 D1 S1 D2 S2        A B C D ember, T S tide
 *
 * A lone match takes B and stops. Clean lets B2 take C. Sharp lets C2 take D, and D2 finds
 * nothing: three waves.
 */
const rowTile = (id: string): Tile =>
    makeTile(id, id[0]!, id[0]!, { suit: 'ABCD'.includes(id[0]!) ? 'ember' : 'tide' });
const rowLayout = (): Tile[] =>
    ['A1', 'A2', 'B1', 'T1', 'B2', 'C1', 'T2', 'C2', 'D1', 'S1', 'D2', 'S2'].map(rowTile);
const row = (tiles: Tile[] = rowLayout()): BoardState => makeBoard(tiles, { columns: 12, rows: 1, level: 3 });
const waveOf = (result: { board: BoardState }, id: string): number | undefined =>
    result.board.tiles.find((t) => t.id === id)?.brokenAtWave;

describe('the region', () => {
    it('reaches the neighbours at depth one and the whole clump at depth infinity', () => {
        const b = board();
        const ids = (indices: number[]) => indices.map((i) => b.tiles[i]!.id).sort();
        expect(ids(findSuitRegion(b, ['A1', 'A2'], 1))).toEqual(['B1', 'B2', 'D2'].filter((id) => suit(id) === 'ember').sort());
        expect(ids(findSuitRegion(b, ['A1', 'A2'], Number.POSITIVE_INFINITY))).toEqual(['B1', 'B2', 'C1', 'C2']);
    });

    it('walks through hidden tiles only', () => {
        const b = board(layout().map((t) => (t.id === 'B2' ? { ...t, state: 'matched' as const } : t)));
        expect(findSuitRegion(b, ['A2'], Number.POSITIVE_INFINITY).map((i) => b.tiles[i]!.id)).not.toContain('C2');
    });
});

describe('what breaks', () => {
    it('pops the whole clump touching a lone match, partners with it: a match is never just a match', () => {
        const result = resolveChunkBreak({ board: board(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(result.tier).toBe('none');
        expect(result.brokenPairKeys.sort()).toEqual(['B', 'C']);
        expect(result.brokenTileIds.sort()).toEqual(['B1', 'B2', 'C1', 'C2']);
        expect(result.board.tiles.filter((t) => t.state === 'removed').map((t) => t.id).sort()).toEqual(['B1', 'B2', 'C1', 'C2']);
        expect(result.board.matchedPairs).toBe(2);
        expect(result.waves).toBe(1);
        expect(result.board.tiles.find((t) => t.id === 'D1')?.state).toBe('hidden');
    });

    it('never takes the matched pair itself, whatever a later wave walks past', () => {
        const result = resolveChunkBreak({ board: board(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(result.brokenPairKeys).not.toContain('A');
        expect(result.brokenTileIds).not.toContain('A1');
    });

    it('Sharp takes the same clump: the chain changes the ripple, not the pop', () => {
        // Six pairs on this board: Sharp from x4, Fever from x7 (floor-relative rungs).
        const result = resolveChunkBreak({ board: board(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(result.tier).toBe('sharp');
        expect(result.brokenPairKeys.sort()).toEqual(['B', 'C']);
        expect(result.board.tiles.find((t) => t.id === 'D1')?.state).toBe('hidden');
    });

    it('Fever takes the clump and its halo, and a halo pair is the edge: it does not seed a wave', () => {
        const result = resolveChunkBreak({ board: board(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 7 });
        expect(result.tier).toBe('fever');
        // The ember clump is B and C; D1 and E1 border it, so tide D and E go with it. F touches
        // E2 and D2 and would go if a halo pair rippled; it stays.
        expect(result.brokenPairKeys.sort()).toEqual(['B', 'C', 'D', 'E']);
        expect(result.board.tiles.find((t) => t.id === 'F1')?.state).toBe('hidden');
        expect(result.waves).toBe(1);
    });

    it('leaves a pair alone when its partner has a job of its own', () => {
        const tiles = layout().map((t) => (t.id === 'C2' ? { ...t, findableKind: 'shard_spark' as const } : t));
        const result = resolveChunkBreak({ board: board(tiles), run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(result.brokenPairKeys).toEqual(['B']);
        expect(tileCanBreakInChunk(tiles.find((t) => t.id === 'C2')!)).toBe(false);
    });

    it('never takes the exit, the cursed pair, or anything that is not a plain pair', () => {
        const exit = makeTile('X', EXIT_PAIR_KEY, 'X', { suit: 'ember' });
        const tiles = layout().map((t) => (t.id === 'D1' ? exit : t));
        const result = resolveChunkBreak({
            board: board(tiles, { cursedPairKey: 'B' }),
            run: endless,
            matchedTileIds: ['A1', 'A2'],
            chain: 4
        });
        expect(result.brokenPairKeys).toEqual(['C']);
        expect(result.board.tiles.find((t) => t.pairKey === EXIT_PAIR_KEY)?.state).toBe('hidden');
    });

    it('does not run in meditation, which has no chain to spend', () => {
        const result = resolveChunkBreak({ board: board(), run: { gameMode: 'meditation' }, matchedTileIds: ['A1', 'A2'], chain: 9 });
        expect(result.brokenPairKeys).toEqual([]);
    });
});

describe('the ripple', () => {
    it('a lone match is contact: B1 touches the clump but B2 does not, so B stays whole', () => {
        const result = resolveChunkBreak({ board: row(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(result.brokenPairKeys).toEqual([]);
        expect(result.waves).toBe(0);
        expect(result.board.tiles.find((t) => t.id === 'B1')?.state).toBe('hidden');
    });

    it('a lone match pops a pair whose halves both touch the clump, and its partner leaves with it', () => {
        // B2 moved beside A2's row end: both halves of B touch A's clump.
        const tiles = rowLayout().map((t) => (t.id === 'B2' ? rowTile('T1') : t.id === 'T1' ? rowTile('B2') : t));
        const result = resolveChunkBreak({ board: row(tiles), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(result.brokenPairKeys).toEqual(['B']);
        expect(result.waves).toBe(1);
        expect(waveOf(result, 'B2')).toBe(0);
        // C1 touched B2 in the new place, but a pop's partners do not seed a wave.
        expect(result.board.tiles.find((t) => t.id === 'C1')?.state).toBe('hidden');
    });

    it('Clean: each partner that left takes its own clump, one wave more', () => {
        const result = resolveChunkBreak({ board: row(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 3 });
        expect(result.tier).toBe('clean');
        expect(result.wavePairKeys).toEqual([['B'], ['C']]);
        expect(result.waves).toBe(2);
        expect(waveOf(result, 'C1')).toBe(1);
        expect(waveOf(result, 'C2')).toBe(1);
        expect(result.board.tiles.find((t) => t.id === 'D1')?.state).toBe('hidden');
    });

    it('Sharp: the reaction runs until a wave takes nothing', () => {
        const result = resolveChunkBreak({ board: row(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(result.tier).toBe('sharp');
        expect(result.wavePairKeys).toEqual([['B'], ['C'], ['D']]);
        expect(result.waves).toBe(3);
        expect(waveOf(result, 'D2')).toBe(2);
        expect(rippleWaves('sharp')).toBe(RIPPLE_MAX_WAVES);
        expect(rippleWaves('none')).toBe(1);
        expect(rippleWaves('clean')).toBe(2);
    });

    it('a longer reaction pays more for the same pairs, up to the cap', () => {
        expect(rippleLift(1)).toBe(1);
        expect(rippleLift(2)).toBeCloseTo(1.2);
        expect(rippleLift(40)).toBe(2);
        expect(chunkBreakScore(3, 3, 'clean', 3)).toBeGreaterThan(chunkBreakScore(3, 3, 'clean', 1));
    });
});

describe('what it pays', () => {
    it('scores less per pair than a match, and more per pair the bigger the chunk', () => {
        expect(chunkBreakScore(3, 0, 'clean')).toBe(0);
        const one = chunkBreakScore(3, 1, 'clean');
        const three = chunkBreakScore(3, 3, 'clean');
        expect(one).toBeGreaterThan(0);
        expect(three / 3).toBeGreaterThan(one);
        expect(chunkBreakScore(3, 3, 'fever')).toBeGreaterThan(three);
    });

    it('drops a shard per two pairs, or per pair in Fever', () => {
        expect(chunkBreakComboShards(1, 'clean')).toBe(0);
        expect(chunkBreakComboShards(2, 'sharp')).toBe(1);
        expect(chunkBreakComboShards(3, 'fever')).toBe(3);
    });
});

describe('through a real turn', () => {
    const runWithChain = (chain: number) => {
        const base = makeRun(layout(), { gameMode: 'endless' });
        // The fixture rolls a random floor resident; toffee would make this break diagonal.
        return {
            ...base,
            board: board(),
            floorCurioId: null,
            stats: { ...base.stats, currentStreak: chain - 1 }
        };
    };

    it('takes the clump touching a chain-one match off the board, live, and says so on the journal', () => {
        const run = runWithChain(1);
        const after = resolveBoardTurn(flipTile(flipTile(run, 'A1'), 'A2'));

        for (const id of ['B1', 'B2', 'C1', 'C2']) {
            expect(after.board!.tiles.find((t) => t.id === id)?.state).toBe('removed');
        }
        expect(after.chunkBreaksThisFloor).toBe(1);
        expect(after.chunkPairsBrokenThisFloor).toBe(2);
        expect(after.board!.matchedPairs).toBe(3);

        const turn = (after.gameplayEventJournal as { type: string; announcement?: Record<string, number> }[])
            .filter((event) => event.type === 'board.turn_resolved')
            .at(-1)!;
        expect(turn.announcement).toMatchObject({ chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 2, chainAfter: 1 });
    });

    it('pays the pop on top of the match, without touching the chain or the recall', () => {
        const alone = runWithChain(1);
        // The same board with nothing ember beside A: the match alone.
        const lonely = {
            ...alone,
            board: board(layout().map((t) => (t.pairKey === 'B' || t.pairKey === 'C' ? { ...t, suit: 'tide' as const } : t)))
        };
        const popped = resolveBoardTurn(flipTile(flipTile(alone, 'A1'), 'A2'));
        const plain = resolveBoardTurn(flipTile(flipTile(lonely, 'A1'), 'A2'));
        expect(popped.stats.currentLevelScore).toBeGreaterThan(plain.stats.currentLevelScore);
        expect(popped.stats.currentStreak).toBe(plain.stats.currentStreak);
        expect(popped.recallMatchesThisFloor).toBe(plain.recallMatchesThisFloor);
    });

    it('a match with nothing of its suit touching it is just a match', () => {
        const lonely = {
            ...runWithChain(1),
            board: board(layout().map((t) => (t.pairKey === 'B' || t.pairKey === 'C' ? { ...t, suit: 'tide' as const } : t)))
        };
        const after = resolveBoardTurn(flipTile(flipTile(lonely, 'A1'), 'A2'));
        expect(after.board!.tiles.filter((t) => t.state === 'removed')).toEqual([]);
        expect(after.chunkBreaksThisFloor).toBe(0);
    });
});

describe('the proximity badge stays honest', () => {
    it('never changes for a tile that stayed, because nothing moved and partners of flipped tiles are protected', () => {
        const before = board(layout().map((t) => (t.id === 'D1' ? { ...t, state: 'flipped' as const } : t)));
        const distanceBefore = getPairProximityGridDistance(before, 'D1');
        expect(distanceBefore).toBe(5);

        const broken = resolveChunkBreak({ board: before, run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(broken.brokenPairKeys.length).toBeGreaterThan(0);
        expect(getPairProximityGridDistance(broken.board, 'D1')).toBe(distanceBefore);

        // Every tile that left the board stops having a number at all.
        for (const id of broken.brokenTileIds) {
            expect(getPairProximityGridDistance(broken.board, id)).toBeNull();
        }
    });
});

describe('relics that touch the cascade', () => {
    it('Tuning Fork lends a lone match the chain\'s reach: the partner leaves, and takes C with it', () => {
        const plain = resolveChunkBreak({ board: row(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(plain.brokenPairKeys).toEqual([]);
        const forked = resolveChunkBreak({
            board: row(),
            run: { ...endless, relicIds: ['tuning_fork'] },
            matchedTileIds: ['A1', 'A2'],
            chain: 1
        });
        expect(forked.tier).toBe('none');
        expect(forked.wavePairKeys).toEqual([['B'], ['C']]);
        expect(rippleWaves('none', ['tuning_fork'])).toBe(2);
        expect(rippleWaves('sharp', ['tuning_fork'])).toBe(RIPPLE_MAX_WAVES);
    });

    it("Magpie's Ledger doubles the gold a spilled treasure pays, and nothing else", () => {
        const treasure = layout().map((t) =>
            t.pairKey === 'B' ? { ...t, dungeonCardKind: 'treasure' as const, dungeonCardEffectId: 'treasure_gold' as const, dungeonCardState: 'hidden' as const } : t
        );
        const plain = resolveChunkBreak({ board: board(treasure), run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        const ledger = resolveChunkBreak({
            board: board(treasure),
            run: { ...endless, relicIds: ['magpie_ledger'] },
            matchedTileIds: ['A1', 'A2'],
            chain: 4
        });
        expect(plain.treasuresSpilled).toBe(1);
        expect(ledger.treasureGold).toBe(plain.treasureGold * MAGPIE_LEDGER_GOLD_MULTIPLIER);
        expect(ledger.score).toBe(plain.score);
        expect(ledger.brokenPairKeys).toEqual(plain.brokenPairKeys);
    });
});

describe('the drop', () => {
    /*
     * The same suits, laid so C is cut off from A and B by tide:
     *
     *   A1 B1 D1 C1
     *   A2 B2 E1 C2
     *   D2 F1 E2 F2
     *
     * Sharp on A takes B through the region and leaves the ember suit with one pair, C, that
     * touches nothing ember. Nothing holds it: it drops with the break.
     */
    const cutOff = (): Tile[] => [
        tile('A1'), tile('B1'), tile('D1'), tile('C1'),
        tile('A2'), tile('B2'), tile('E1'), tile('C2'),
        tile('D2'), tile('F1'), tile('E2'), tile('F2')
    ];

    it('takes the last pairs of the suit when a Sharp break leaves too few to hold', () => {
        const result = resolveChunkBreak({ board: board(cutOff()), run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 });
        expect(result.tier).toBe('sharp');
        expect(result.droppedPairKeys).toEqual(['C']);
        expect(result.brokenPairKeys).toEqual(['B', 'C']);
        expect(result.board.tiles.filter((t) => t.pairKey === 'C').every((t) => t.state === 'removed')).toBe(true);
        expect(DROP_MAX_PAIRS).toBe(2);
    });

    it('does not drop at Clean: the drop is a Sharp reward, not a rule about the ripple', () => {
        const result = resolveChunkBreak({ board: board(cutOff()), run: endless, matchedTileIds: ['A1', 'A2'], chain: 3 });
        expect(result.droppedPairKeys).toEqual([]);
        expect(result.brokenPairKeys).toEqual(['B']);
    });

    it('holds when a remaining pair has a job of its own, or when too many remain', () => {
        const withExit = cutOff().map((t) => (t.id === 'C2' ? { ...t, dungeonCardKind: 'exit' as const } : t));
        expect(
            resolveChunkBreak({ board: board(withExit), run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 }).droppedPairKeys
        ).toEqual([]);
        // Three ember pairs left standing is a clump, not a remnant: G and H join C, all cut off.
        const crowded = cutOff().map((t) =>
            t.id === 'D1' ? tile('G1', { suit: 'ember' }) : t.id === 'D2' ? tile('G2', { suit: 'ember' }) : t
        );
        const moreEmber = crowded.map((t) =>
            t.id === 'F1' ? tile('H1', { suit: 'ember' }) : t.id === 'F2' ? tile('H2', { suit: 'ember' }) : t
        );
        const result = resolveChunkBreak({ board: board(moreEmber), run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 });
        expect(result.droppedPairKeys).toEqual([]);
    });
});
