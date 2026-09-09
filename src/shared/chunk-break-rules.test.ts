import { describe, expect, it } from 'vitest';
import type { BoardState, Tile, TileSuit } from './contracts';
import { getPairProximityGridDistance } from './pairProximityHint';
import { resolveBoardTurn, flipTile } from './game';
import { makeBoard, makeRun, makeTile } from './test/game-fixtures';
import { WILD_PAIR_KEY } from './tile-identity';
import {
    chunkBreakMomentumPairs,
    chunkBreakScore,
    findSuitRegion,
    RIPPLE_MAX_WAVES,
    resolveChunkBreak,
    suitCanStillPop,
    waveMult,
    rippleWaves,
    CHAIN_MULT,
    chunkScorePerPair,
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
        // E2 and D2 and would go if a halo pair rippled; the wave leaves it. It falls anyway - the
        // last tide pair, with nothing left to pop against - and that is the drop, not the halo.
        expect(result.wavePairKeys.flat().sort()).toEqual(['B', 'C', 'D', 'E']);
        expect(result.droppedPairKeys).toEqual(['F']);
        expect(result.waves).toBe(1);
    });

    it('leaves a pair alone when its partner has a job of its own', () => {
        const tiles = layout().map((t) => (t.id === 'C2' ? { ...t, findableKind: 'score_glint' as const } : t));
        const result = resolveChunkBreak({ board: board(tiles), run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(result.brokenPairKeys).toEqual(['B']);
        expect(tileCanBreakInChunk(tiles.find((t) => t.id === 'C2')!)).toBe(false);
    });

    it('never takes a singleton, the cursed pair, or anything that is not a plain pair', () => {
        const wild = makeTile('X', WILD_PAIR_KEY, 'X', { suit: 'ember' });
        const tiles = layout().map((t) => (t.id === 'D1' ? wild : t));
        const result = resolveChunkBreak({
            board: board(tiles, { cursedPairKey: 'B' }),
            run: endless,
            matchedTileIds: ['A1', 'A2'],
            chain: 4
        });
        expect(result.brokenPairKeys).toEqual(['C']);
        expect(result.board.tiles.find((t) => t.pairKey === WILD_PAIR_KEY)?.state).toBe('hidden');
    });
});

describe('the ripple', () => {
    it('a lone match is contact: B1 touches the clump but B2 does not, so B stays whole', () => {
        const result = resolveChunkBreak({ board: row(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(result.wavePairKeys).toEqual([]);
        expect(result.waves).toBe(0);
        // B, C and D stay: three pairs is more than the severance takes, so the suit stands.
        expect(result.droppedPairKeys).toEqual([]);
        expect(result.board.tiles.find((t) => t.id === 'B1')?.state).toBe('hidden');
    });

    it('a lone match pops a pair whose halves both touch the clump, and its partner leaves with it', () => {
        // B2 moved beside A2's row end: both halves of B touch A's clump.
        const tiles = rowLayout().map((t) => (t.id === 'B2' ? rowTile('T1') : t.id === 'T1' ? rowTile('B2') : t));
        const result = resolveChunkBreak({ board: row(tiles), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(result.wavePairKeys).toEqual([['B']]);
        expect(result.waves).toBe(1);
        expect(waveOf(result, 'B2')).toBe(0);
        // C1 touched B2 in the new place, but a pop's partners do not seed a wave. C and D leave
        // all the same: two ember pairs that cannot reach each other are the severance's remnant.
        expect(result.droppedPairKeys.sort()).toEqual(['C', 'D']);
    });

    it('Clean: the pops reach a partner across the board, but the reaction is still Sharp\'s', () => {
        // B1 touches the clump and B2 does not, which is exactly the pair a lone match leaves
        // whole. Clean takes it - that is the whole of what this rung buys - and stops there:
        // C, which only B2's departure could have reached, is untouched until Sharp.
        const result = resolveChunkBreak({ board: row(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 3 });
        expect(result.tier).toBe('clean');
        expect(result.wavePairKeys).toEqual([['B']]);
        expect(result.waves).toBe(1);
        expect(waveOf(result, 'B2')).toBe(0);
        // What the reaction did not reach, the severance takes: C and D are the suit's last two.
        expect(result.droppedPairKeys.sort()).toEqual(['C', 'D']);
    });

    it('Sharp: the reaction runs until a wave takes nothing', () => {
        const result = resolveChunkBreak({ board: row(), run: endless, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(result.tier).toBe('sharp');
        expect(result.wavePairKeys).toEqual([['B'], ['C'], ['D']]);
        expect(result.waves).toBe(3);
        expect(waveOf(result, 'D2')).toBe(2);
        expect(rippleWaves('sharp')).toBe(RIPPLE_MAX_WAVES);
        expect(rippleWaves('none')).toBe(1);
        expect(rippleWaves('clean')).toBe(1);
    });

    it('a longer reaction pays more for the same pairs, up to the cap', () => {
        expect(waveMult(1)).toBe(1);
        expect(waveMult(2)).toBeCloseTo(1.75);
        expect(waveMult(5)).toBe(4);
        expect(waveMult(40)).toBe(6);
        expect(chunkBreakScore(3, 3, 'clean', 3)).toBeGreaterThan(chunkBreakScore(3, 3, 'clean', 1));
    });
});

describe('what it pays', () => {
    it('scores a pair under a match, then multiplies by the pairs, the tier and the ripple', () => {
        expect(chunkBreakScore(3, 0, 'clean')).toBe(0);
        const perPair = chunkScorePerPair(3);
        expect(perPair).toBeGreaterThan(0);
        expect(chunkBreakScore(3, 1, 'none')).toBe(perPair);
        expect(chunkBreakScore(3, 3, 'clean')).toBe(perPair * 3 * 2);
        expect(chunkBreakScore(3, 4, 'sharp', 3)).toBe(Math.floor(perPair * 4 * 4 * 2.5));
        expect(chunkBreakScore(3, 12, 'fever', 7)).toBe(Math.floor(perPair * 12 * 8 * 5.5));
        expect(CHAIN_MULT).toEqual({ none: 1, clean: 2, sharp: 4, fever: 8 });
    });

    it('is the Puyo shape: a huge Fever reaction is worth hundreds of chain-one pops', () => {
        const pop = chunkBreakScore(10, 1, 'none', 1);
        const reaction = chunkBreakScore(10, 12, 'fever', 7);
        expect(reaction / pop).toBeGreaterThanOrEqual(500);
        // Linear in pairs within a tier: concentration is bought by the tier and the ripple, not by size alone.
        expect(chunkBreakScore(5, 6, 'clean')).toBe(chunkBreakScore(5, 3, 'clean') * 2);
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


describe('what feeds the ladder', () => {
    it('credits the pop at half and every later wave in full', () => {
        const twoPairPop = { brokenPairKeys: ['B', 'C', 'D'], wavePairKeys: [['B', 'C'], ['D']] };
        expect(chunkBreakMomentumPairs(twoPairPop)).toBe(2);
        expect(chunkBreakMomentumPairs({ brokenPairKeys: ['B'], wavePairKeys: [['B']] })).toBe(1);
        expect(chunkBreakMomentumPairs({ brokenPairKeys: [], wavePairKeys: [] })).toBe(0);
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
     * A match on A pops B by contact and leaves the ember suit with one pair, C, that touches
     * nothing ember: the suit can no longer pop, so nothing holds C up and it drops.
     */
    const cutOff = (): Tile[] => [
        tile('A1'), tile('B1'), tile('D1'), tile('C1'),
        tile('A2'), tile('B2'), tile('E1'), tile('C2'),
        tile('D2'), tile('F1'), tile('E2'), tile('F2')
    ];

    it('takes the pairs of a suit that can no longer pop, at any tier', () => {
        for (const chain of [1, 3, 6]) {
            const result = resolveChunkBreak({ board: board(cutOff()), run: endless, matchedTileIds: ['A1', 'A2'], chain });
            expect(result.droppedPairKeys, `chain ${chain}`).toEqual(['C']);
            expect(result.brokenPairKeys, `chain ${chain}`).toEqual(['B', 'C']);
            expect(result.board.tiles.filter((t) => t.pairKey === 'C').every((t) => t.state === 'removed')).toBe(true);
        }
    });

    it('fires on a match that pops nothing, when the match itself severs the suit', () => {
        // Two ember pairs at opposite corners of a tide board: matching one leaves the other alone.
        const corners: Tile[] = [
            tile('A1'), tile('D1'), tile('E1'), tile('C1'),
            tile('A2'), tile('D2'), tile('E2'), tile('F1'),
            tile('G1', { suit: 'tide' }), tile('G2', { suit: 'tide' }), tile('F2'), tile('C2')
        ];
        const result = resolveChunkBreak({ board: board(corners), run: endless, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(result.wavePairKeys).toEqual([]);
        expect(result.droppedPairKeys).toEqual(['C']);
    });

    it('holds while two whole pairs of the suit can still reach each other', () => {
        // G joins C in the cut-off corner, beside it: the suit can still pop there, so both stand.
        const company = cutOff().map((t) =>
            t.id === 'E2' ? tile('G1', { suit: 'ember' }) : t.id === 'F2' ? tile('G2', { suit: 'ember' }) : t
        );
        const result = resolveChunkBreak({ board: board(company), run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 });
        expect(result.droppedPairKeys).toEqual([]);
        expect(suitCanStillPop(result.board, 'ember')).toBe(true);
    });

    it('never takes a pair with a job of its own, and never counts the cursed pair as a target', () => {
        const withFindable = cutOff().map((t) => (t.id === 'C2' ? { ...t, findableKind: 'score_glint' as const } : t));
        expect(
            resolveChunkBreak({ board: board(withFindable), run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 }).droppedPairKeys
        ).toEqual([]);
        const cursed = { ...board(cutOff()), cursedPairKey: 'C' };
        expect(resolveChunkBreak({ board: cursed, run: endless, matchedTileIds: ['A1', 'A2'], chain: 6 }).droppedPairKeys).toEqual([]);
        // A cursed pair beside a plain one keeps the plain one standing only if the plain one is
        // within its reach as a target: the cursed pair can start a pop but never be taken by one.
        expect(suitCanStillPop({ ...board(cutOff()), cursedPairKey: 'B' }, 'ember')).toBe(true);
    });
});
