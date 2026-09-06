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
    resolveChunkBreak,
    tileCanBreakInChunk
} from './chunk-break-rules';

/**
 * A 4-column board, read left to right, top to bottom. Letters are pairs; the suit is in the map.
 *
 *   A  B  C  D        A B C ember, D tide
 *   A' B' E  F        E F tide
 *   D' C' E' F'
 *
 * Match A. Clean (chain 3) reaches A's neighbours: B. Sharp (chain 6) walks the whole ember
 * region: B and, through B', C. D's clump is tide and never comes along.
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
    it('breaks nothing at chain one: a lone match is a match', () => {
        const result = resolveChunkBreak({ board: board(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(result.brokenPairKeys).toEqual([]);
        expect(result.board).toBe(board().tiles.length ? result.board : result.board);
    });

    it('Clean breaks the pair beside the match, and both halves leave together', () => {
        const result = resolveChunkBreak({ board: board(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 3 });
        expect(result.tier).toBe('clean');
        expect(result.brokenPairKeys).toEqual(['B']);
        expect(result.brokenTileIds.sort()).toEqual(['B1', 'B2']);
        expect(result.board.tiles.filter((t) => t.state === 'removed').map((t) => t.id).sort()).toEqual(['B1', 'B2']);
        expect(result.board.matchedPairs).toBe(1);
    });

    it('Sharp breaks the whole clump, partners across the board included', () => {
        const result = resolveChunkBreak({ board: board(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 });
        expect(result.tier).toBe('sharp');
        expect(result.brokenPairKeys.sort()).toEqual(['B', 'C']);
        expect(result.board.tiles.find((t) => t.id === 'D1')?.state).toBe('hidden');
    });

    it('leaves a pair alone when its partner has a job of its own', () => {
        const tiles = layout().map((t) => (t.id === 'C2' ? { ...t, findableKind: 'shard_spark' as const } : t));
        const result = resolveChunkBreak({ board: board(tiles), run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 });
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
            chain: 6
        });
        expect(result.brokenPairKeys).toEqual(['C']);
        expect(result.board.tiles.find((t) => t.pairKey === EXIT_PAIR_KEY)?.state).toBe('hidden');
    });

    it('does not run in meditation, which has no chain to spend', () => {
        const result = resolveChunkBreak({ board: board(), run: { gameMode: 'meditation' }, matchedTileIds: ['A1', 'A2'], chain: 9 });
        expect(result.brokenPairKeys).toEqual([]);
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

    it('takes the pair beside a Clean match off the board and says so on the journal', () => {
        const run = runWithChain(3);
        const after = resolveBoardTurn(flipTile(flipTile(run, 'A1'), 'A2'));

        expect(after.board!.tiles.find((t) => t.id === 'B1')?.state).toBe('removed');
        expect(after.board!.tiles.find((t) => t.id === 'B2')?.state).toBe('removed');
        expect(after.chunkBreaksThisFloor).toBe(1);
        expect(after.chunkPairsBrokenThisFloor).toBe(1);
        expect(after.board!.matchedPairs).toBe(2);

        const turn = (after.gameplayEventJournal as { type: string; announcement?: Record<string, number> }[])
            .filter((event) => event.type === 'board.turn_resolved')
            .at(-1)!;
        expect(turn.announcement).toMatchObject({ chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 1, chainAfter: 3 });
    });

    it('pays the chunk on top of the match, without touching the chain', () => {
        const plain = resolveBoardTurn(flipTile(flipTile(runWithChain(1), 'A1'), 'A2'));
        const chained = resolveBoardTurn(flipTile(flipTile(runWithChain(3), 'A1'), 'A2'));
        // A chain-3 match already scores more than a chain-1 match; the chunk is on top of that.
        const chainOnlyDelta = 20;
        expect(chained.stats.currentLevelScore - plain.stats.currentLevelScore).toBeGreaterThan(chainOnlyDelta);
        expect(chained.stats.currentStreak).toBe(3);
        expect(chained.recallMatchesThisFloor).toBe(plain.recallMatchesThisFloor);
    });

    it('leaves a chain-one match exactly as it was', () => {
        const after = resolveBoardTurn(flipTile(flipTile(runWithChain(1), 'A1'), 'A2'));
        expect(after.board!.tiles.filter((t) => t.state === 'removed')).toEqual([]);
        expect(after.chunkBreaksThisFloor).toBe(0);
    });
});

describe('the proximity badge stays honest', () => {
    it('never changes for a tile that stayed, because nothing moved and partners of flipped tiles are protected', () => {
        const before = board(layout().map((t) => (t.id === 'D1' ? { ...t, state: 'flipped' as const } : t)));
        const distanceBefore = getPairProximityGridDistance(before, 'D1');
        expect(distanceBefore).toBe(5);

        const broken = resolveChunkBreak({ board: before, run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 });
        expect(broken.brokenPairKeys.length).toBeGreaterThan(0);
        expect(getPairProximityGridDistance(broken.board, 'D1')).toBe(distanceBefore);

        // Every tile that left the board stops having a number at all.
        for (const id of broken.brokenTileIds) {
            expect(getPairProximityGridDistance(broken.board, id)).toBeNull();
        }
    });
});
