import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import {
    COLOSSUS_BREAK_PAIRS,
    COLOSSUS_CHIPS_PER_HIT,
    COLOSSUS_FIXED_FROM,
    COLOSSUS_GOLD_PER_HIT,
    COLOSSUS_MAX_SPLIT_PAIRS,
    COLOSSUS_MIN_PAIRS,
    COLOSSUS_RULES_FROM,
    COLOSSUS_SCORE_PER_HIT,
    colossusElement,
    colossusHitsForPairs,
    colossusNextElement,
    colossusStands,
    colossusTurnsForHits,
    raiseColossus,
    resolveColossusTurn
} from './colossus-rules';
import { flipTile, resolveBoardTurn } from './game';
import { inspectBoardFairness, isBoardComplete } from './board-inspection';
import { makeBoard, makeRun, makeTile } from './test/game-fixtures';

const SUITS: TileSuit[] = ['ember', 'tide', 'moss', 'bone'];

const TWO: TileSuit[] = ['ember', 'tide'];

/**
 * `pairs` pairs on four columns, the elements dealt across each row and every other row turned so
 * that no card touches another of its own element. Two elements make the checkerboard the test
 * hall uses: with four pairs of each, a match takes its own pair and nothing else (the pop has
 * nothing in reach, and no element is down to a last pair for it to sweep), so a test counts
 * exactly the hits it made.
 */
const deck = (pairs: number, suits: readonly TileSuit[] = TWO): Tile[] => {
    const seen = new Map<TileSuit, number>();
    const turn = suits.length / 2;
    return Array.from({ length: pairs * 2 }, (_, cell) => {
        const row = Math.floor(cell / 4);
        const suit = suits[((cell % 4) + (row % 2 === 1 ? turn : 0)) % suits.length]!;
        const nth = seen.get(suit) ?? 0;
        seen.set(suit, nth + 1);
        const pairKey = `${suit}${Math.floor(nth / 2)}`;
        return makeTile(`${pairKey}-${nth % 2 === 0 ? 'a' : 'b'}`, pairKey, pairKey.toUpperCase(), { suit });
    });
};

const bossBoard = (pairs = 8, suits: readonly TileSuit[] = TWO): BoardState =>
    raiseColossus(makeBoard(deck(pairs, suits), { level: 7, columns: 4, rows: Math.ceil((pairs * 2) / 4), pairCount: pairs, floorTag: 'boss' }), {
        runSeed: 11,
        rulesVersion: COLOSSUS_RULES_FROM
    });

const bossRun = (pairs = 8, suits: readonly TileSuit[] = TWO): RunState => {
    const run = makeRun(deck(pairs, suits));
    return { ...run, board: { ...bossBoard(pairs, suits), tiles: run.board!.tiles } };
};

const play = (run: RunState, a: string, b: string): RunState => resolveBoardTurn(flipTile(flipTile(run, a), b));
/** A hidden pair of this element, or of any other. */
const pairOf = (run: RunState, want: (suit: TileSuit) => boolean): string => {
    const tile = run.board!.tiles.find((candidate) => candidate.state === 'hidden' && candidate.suit && want(candidate.suit));
    if (!tile) throw new Error('no such pair left');
    return tile.pairKey;
};
const matchPair = (run: RunState, pairKey: string): RunState => {
    const [a, b] = run.board!.tiles.filter((tile) => tile.pairKey === pairKey);
    return play(run, a!.id, b!.id);
};
const miss = (run: RunState): RunState => {
    const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden');
    const first = hidden[0]!;
    const other = hidden.find((tile) => tile.pairKey !== first.pairKey)!;
    return play(run, first.id, other.id);
};

describe('raising the Colossus', () => {
    it('stands over a boss floor and no other, and not before the rules that brought it', () => {
        expect(colossusStands(bossBoard())).toBe(true);
        const plain = makeBoard(deck(8, SUITS), { level: 7, pairCount: 8, floorTag: 'normal' });
        expect(raiseColossus(plain, { runSeed: 11, rulesVersion: COLOSSUS_RULES_FROM }).colossus).toBeUndefined();
        const boss = makeBoard(deck(8, SUITS), { level: 7, pairCount: 8, floorTag: 'boss' });
        expect(raiseColossus(boss, { runSeed: 11, rulesVersion: COLOSSUS_RULES_FROM - 1 }).colossus).toBeUndefined();
        // Too small a floor to hold a fight, or a deck of one element with nothing to turn through.
        const small = makeBoard(deck(COLOSSUS_MIN_PAIRS - 1), { level: 7, pairCount: COLOSSUS_MIN_PAIRS - 1, floorTag: 'boss' });
        expect(raiseColossus(small, { runSeed: 11, rulesVersion: COLOSSUS_RULES_FROM }).colossus).toBeUndefined();
        const oneSuit = makeBoard(deck(8, ['ember']), { level: 7, pairCount: 8, floorTag: 'boss' });
        expect(raiseColossus(oneSuit, { runSeed: 11, rulesVersion: COLOSSUS_RULES_FROM }).colossus).toBeUndefined();
    });

    it('turns only through elements the floor actually holds, each once, in an order fixed by the seed', () => {
        const three = bossBoard(9, ['ember', 'tide', 'bone']).colossus!;
        expect([...three.cycle].sort()).toEqual(['bone', 'ember', 'tide']);
        const four = bossBoard(8, SUITS).colossus!;
        expect(new Set(four.cycle).size).toBe(4);
        expect(bossBoard(8, SUITS).colossus).toEqual(four);
        const orders = new Set<string>();
        for (let seed = 0; seed < 40; seed += 1) {
            const board = raiseColossus(makeBoard(deck(8, SUITS), { level: 7, pairCount: 8, floorTag: 'boss' }), { runSeed: seed, rulesVersion: COLOSSUS_RULES_FROM });
            orders.add(board.colossus!.cycle.join());
        }
        expect(orders.size).toBeGreaterThan(5);
    });

    it('asks for about one pair in five, and gives every hit a turn to wait for it and two to spare', () => {
        expect([6, 9, 10, 15, 16, 24].map(colossusHitsForPairs)).toEqual([2, 2, 3, 3, 4, 4]);
        expect([2, 3, 4].map(colossusTurnsForHits)).toEqual([6, 8, 10]);
        const colossus = bossBoard(12).colossus!;
        expect(colossus).toMatchObject({ hits: 3, hitsMax: 3, turnsLeft: 8, turnsMax: 8, chips: 0, step: 0, status: 'standing' });
        // The fight can always be won on the deck dealt: more pairs of chips and hits than it needs.
        for (const pairs of [6, 8, 12, 16, 24]) {
            expect(Math.floor(pairs / COLOSSUS_CHIPS_PER_HIT)).toBeGreaterThanOrEqual(colossusHitsForPairs(pairs));
        }
    });
});

describe('a turn of the fight', () => {
    it('changes element every turn, match or miss, in the order on the card', () => {
        let run = bossRun();
        const cycle = run.board!.colossus!.cycle;
        const seen: TileSuit[] = [];
        for (let turn = 0; turn < 5; turn += 1) {
            const colossus = run.board!.colossus!;
            seen.push(colossusElement(colossus));
            expect(colossusNextElement(colossus)).toBe(cycle[(turn + 1) % cycle.length]);
            run = turn % 2 === 0 ? miss(run) : matchPair(run, pairOf(run, (suit) => suit !== colossusElement(run.board!.colossus!)));
        }
        expect(seen).toEqual([0, 1, 2, 3, 4].map((turn) => cycle[turn % cycle.length]));
        // Both elements, turn about.
        expect(new Set(seen).size).toBe(cycle.length);
    });

    it('takes a hit from a pair of the element it is showing', () => {
        const run = bossRun();
        const showing = colossusElement(run.board!.colossus!);
        const after = matchPair(run, pairOf(run, (suit) => suit === showing));
        expect(after.board!.colossus).toMatchObject({ hits: 1, chips: 0, turnsLeft: 5, status: 'standing' });
        expect(after.lastColossusEvent).toMatchObject({ kind: 'hit', element: showing, hits: 1, hitsLeft: 1 });
        expect(after.colossusHitsThisFloor).toBe(1);
    });

    it('takes a chip from a pair of any other element, and two chips are a hit', () => {
        let run = bossRun();
        run = matchPair(run, pairOf(run, (suit) => suit !== colossusElement(run.board!.colossus!)));
        expect(run.board!.colossus).toMatchObject({ hits: 2, chips: 1 });
        expect(run.lastColossusEvent).toMatchObject({ kind: 'chip', hits: 0 });
        run = matchPair(run, pairOf(run, (suit) => suit !== colossusElement(run.board!.colossus!)));
        expect(run.board!.colossus).toMatchObject({ hits: 1, chips: 0 });
        expect(run.lastColossusEvent).toMatchObject({ kind: 'hit', hits: 1 });
    });

    it('takes nothing from a miss but still spends the turn', () => {
        const run = miss(bossRun());
        expect(run.board!.colossus).toMatchObject({ hits: 2, chips: 0, turnsLeft: 5, step: 1 });
        expect(run.lastColossusEvent).toMatchObject({ kind: 'turn', hits: 0 });
    });

    it('is felled by its last hit, pays by its size, and is done', () => {
        let run = bossRun(12);
        const scoreBefore = run.stats.totalScore;
        const goldBefore = run.gold ?? 0;
        let ordinary = 0;
        while (colossusStands(run.board)) {
            const before = run.stats.totalScore;
            const showing = colossusElement(run.board!.colossus!);
            run = matchPair(run, pairOf(run, (suit) => suit === showing));
            if (colossusStands(run.board)) ordinary = run.stats.totalScore - before;
        }
        expect(run.board!.colossus).toMatchObject({ status: 'felled', hits: 0 });
        expect(run.lastColossusEvent).toMatchObject({ kind: 'felled', hitsLeft: 0 });
        expect(run.colossiFelledThisRun).toBe(1);
        expect(run.colossusHitsThisFloor).toBe(3);
        expect((run.gold ?? 0) - goldBefore).toBe(COLOSSUS_GOLD_PER_HIT * 3);
        // Three matches' own score, and the bounty on top.
        expect(run.stats.totalScore - scoreBefore).toBeGreaterThanOrEqual(COLOSSUS_SCORE_PER_HIT * 3 + ordinary);
        // Felled, it takes no further part: the next turn leaves it as it lies and says nothing new.
        const event = run.lastColossusEvent;
        const later = miss(run);
        expect(later.board!.colossus).toEqual(run.board!.colossus);
        expect(later.lastColossusEvent).toEqual(event);
    });

    it('is a function of the board and the turn: the same turn does the same thing', () => {
        const board = bossBoard(12);
        const showing = colossusElement(board.colossus!);
        const turn = () => resolveColossusTurn({ board, outcome: 'match', pairsBySuit: { [showing]: 1 }, turnsThisFloor: 1 });
        expect(turn()).toEqual(turn());
        // One blow a turn: a burst of two of its element and one of another is one hit, and no chip.
        const other = TWO.find((suit) => suit !== showing)!;
        const big = resolveColossusTurn({ board, outcome: 'match', pairsBySuit: { [showing]: 2, [other]: 1 }, turnsThisFloor: 1 });
        expect(big.board.colossus).toMatchObject({ hits: board.colossus!.hitsMax - 1, chips: 0 });
        expect(big.event).toMatchObject({ kind: 'hit', hits: 1 });
        // And a burst with none of its element is one chip, however many pairs it took.
        const off = resolveColossusTurn({ board, outcome: 'match', pairsBySuit: { [other]: 4 }, turnsThisFloor: 1 });
        expect(off.board.colossus).toMatchObject({ hits: board.colossus!.hitsMax, chips: 1 });
        expect(off.event).toMatchObject({ kind: 'chip', hits: 0 });
    });
});

describe('the split', () => {
    const runOutTheClock = (run: RunState): RunState => {
        let next = run;
        while (colossusStands(next.board) && next.status === 'playing') next = miss(next);
        return next;
    };

    it('comes when the turns run out: a new pair for every hit left, two at most, and the Colossus is gone', () => {
        const run = bossRun(16);
        const start = run.board!.colossus!;
        expect(start.hits).toBe(4);
        const split = resolveColossusTurn({ board: { ...run.board!, colossus: { ...start, turnsLeft: 1 } }, outcome: 'miss', turnsThisFloor: 9 });
        expect(split.event).toMatchObject({ kind: 'split', pairs: COLOSSUS_MAX_SPLIT_PAIRS, hitsLeft: 4 });
        expect(split.board.colossus).toMatchObject({ status: 'split', turnsLeft: 0 });
        expect(split.board.colossus!.splitPairKeys).toHaveLength(COLOSSUS_MAX_SPLIT_PAIRS);
        expect(split.litTileIds).toHaveLength(COLOSSUS_MAX_SPLIT_PAIRS * 2);
        // One hit left is one pair.
        const one = resolveColossusTurn({ board: { ...run.board!, colossus: { ...start, hits: 1, turnsLeft: 1 } }, outcome: 'miss', turnsThisFloor: 9 });
        expect(one.event).toMatchObject({ kind: 'split', pairs: 1 });
    });

    it('deals the new pairs into cleared cells first and leaves every card already down where it was', () => {
        let run = bossRun(8);
        const cycle = run.board!.colossus!.cycle;
        // Take one pair (a chip), then run the clock out on a board with a hole in it.
        const taken = pairOf(run, (suit) => suit !== colossusElement(run.board!.colossus!));
        run = matchPair(run, taken);
        const holes = run.board!.tiles.map((tile, index) => (tile.pairKey === taken ? index : -1)).filter((index) => index >= 0);
        const before = run.board!;
        const standing = before.colossus!;
        const split = resolveColossusTurn({ board: { ...before, colossus: { ...standing, turnsLeft: 1 } }, outcome: 'miss', turnsThisFloor: 6 });
        const after = split.board;
        // Two hits left: two pairs. One goes into the hole, the other onto the end of the board.
        expect(split.event!.pairs).toBe(2);
        expect(after.tiles).toHaveLength(before.tiles.length + 2);
        expect(holes.every((index) => after.tiles[index]!.pairKey === after.colossus!.splitPairKeys![0])).toBe(true);
        before.tiles.forEach((tile, index) => {
            if (!holes.includes(index)) expect(after.tiles[index]).toEqual(tile);
        });
        // The counts still say what is on the board.
        expect(after.matchedPairs).toBe(before.matchedPairs - 1);
        expect(after.pairCount).toBe(before.pairCount + 1);
        expect(after.rows).toBe(Math.ceil(after.tiles.length / after.columns));
        expect(inspectBoardFairness(after).issues.filter((issue) => issue.code === 'board_tile_count_mismatch')).toEqual([]);
        // New faces, each a whole face-down pair, spread across the cycle from where it stood.
        const fresh = after.tiles.filter((tile) => after.colossus!.splitPairKeys!.includes(tile.pairKey));
        expect(fresh).toHaveLength(4);
        expect(fresh.every((tile) => tile.state === 'hidden')).toBe(true);
        expect(new Set(fresh.map((tile) => tile.symbol)).size).toBe(2);
        expect(before.tiles.some((tile) => fresh.some((made) => made.symbol === tile.symbol))).toBe(false);
        expect(fresh[0]!.suit).toBe(cycle[standing.step % cycle.length]);
        expect(new Set(fresh.map((tile) => tile.suit)).size).toBe(2);
    });

    it('shows what it split into, face up until the next flip, so the split costs turns and not misses', () => {
        let run = bossRun(8);
        run = { ...run, board: { ...run.board!, colossus: { ...run.board!.colossus!, turnsLeft: 1 } } };
        const split = miss(run);
        expect(split.board!.colossus!.status).toBe('split');
        expect(split.colossusSplitsThisFloor).toBe(1);
        const made = split.board!.tiles.filter((tile) => split.board!.colossus!.splitPairKeys!.includes(tile.pairKey)).map((tile) => tile.id);
        expect([...(split.realmLitTileIds ?? [])].sort()).toEqual([...made].sort());
        // The light goes with the next flip, as the lantern's does.
        expect(flipTile(split, made[0]!).realmLitTileIds).toEqual([]);
        // And the pairs it left are ordinary pairs: matched, they leave.
        const cleared = matchPair(split, split.board!.colossus!.splitPairKeys![0]!);
        expect(cleared.board!.tiles.filter((tile) => tile.pairKey === split.board!.colossus!.splitPairKeys![0]).every((tile) => tile.state !== 'hidden')).toBe(true);
    });

    it('happens once: a Colossus that has split never stands again', () => {
        let run = bossRun(8);
        run = { ...run, board: { ...run.board!, colossus: { ...run.board!.colossus!, turnsLeft: 1 } } };
        const split = miss(run);
        const tiles = split.board!.tiles.length;
        const later = runOutTheClock(miss(split));
        expect(later.board!.tiles).toHaveLength(tiles);
        expect(later.colossusSplitsThisFloor).toBe(1);
    });
});

describe('the floor under it', () => {
    it('never holds the floor: clear every pair and the floor ends whether it stands or not', () => {
        const board = bossBoard(8);
        const cleared: BoardState = { ...board, tiles: board.tiles.map((tile) => ({ ...tile, state: 'matched' as const })), matchedPairs: 8 };
        expect(colossusStands(cleared)).toBe(true);
        expect(isBoardComplete(cleared)).toBe(true);
    });

    it('is not on the grid: no tile is its, and the board inspects clean with it standing', () => {
        const board = bossBoard(8);
        expect(board.tiles).toHaveLength(16);
        expect(board.tiles.some((tile) => tile.pairKey.includes('colossus'))).toBe(false);
        expect(inspectBoardFairness(board).issues).toEqual([]);
    });
});

describe('the fixed Colossus (rules 63)', () => {
    const fixedBoard = (pairs = 8, suits: readonly TileSuit[] = TWO, runSeed = 11): BoardState =>
        raiseColossus(makeBoard(deck(pairs, suits), { level: 7, columns: 4, rows: Math.ceil((pairs * 2) / 4), pairCount: pairs, floorTag: 'boss' }), {
            runSeed,
            rulesVersion: COLOSSUS_FIXED_FROM
        });

    it('shows one element it can be beaten with, all fight long', () => {
        for (const runSeed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const board = fixedBoard(8, TWO, runSeed);
            const colossus = board.colossus!;
            expect(colossus.form).toBe('fixed');
            expect(colossus.cycle).toHaveLength(1);
            const held = new Set(board.tiles.filter((tile) => tile.suit === colossus.cycle[0]).map((tile) => tile.pairKey)).size;
            expect(held).toBeGreaterThanOrEqual(colossus.hits);
        }
        // Asks only for what the floor holds: three pairs of each, and a floor that would ask four.
        const thin = fixedBoard(16, SUITS);
        const element = thin.colossus!.cycle[0]!;
        expect(thin.colossus!.hits).toBeLessThanOrEqual(new Set(thin.tiles.filter((tile) => tile.suit === element).map((tile) => tile.pairKey)).size);
    });

    it('takes a hit only from its element, never a chip, and keeps showing it', () => {
        const board = fixedBoard();
        const element = colossusElement(board.colossus!);
        const other = TWO.find((suit) => suit !== element)!;
        const off = resolveColossusTurn({ board, outcome: 'match', pairsBySuit: { [other]: 1 }, turnsThisFloor: 1 });
        expect(off.event?.kind).toBe('turn');
        expect(off.board.colossus).toMatchObject({ hits: board.colossus!.hits, chips: 0, step: 0 });
        expect(colossusElement(off.board.colossus!)).toBe(element);
        const on = resolveColossusTurn({ board: off.board, outcome: 'match', pairsBySuit: { [element]: 1 }, turnsThisFloor: 2 });
        expect(on.event?.kind).toBe('hit');
        expect(on.board.colossus!.hits).toBe(board.colossus!.hits - 1);
    });

    it('out of turns, breaks into two face-down pairs of its own element', () => {
        const board = fixedBoard();
        const last = { ...board, colossus: { ...board.colossus!, turnsLeft: 1 } };
        const broken = resolveColossusTurn({ board: last, outcome: 'miss', turnsThisFloor: 5 });
        const element = colossusElement(board.colossus!);
        expect(broken.event).toMatchObject({ kind: 'split', pairs: COLOSSUS_BREAK_PAIRS });
        expect(broken.litTileIds).toEqual([]);
        const pieces = broken.board.tiles.filter((tile) => broken.board.colossus!.splitPairKeys!.includes(tile.pairKey));
        expect(pieces).toHaveLength(2 * COLOSSUS_BREAK_PAIRS);
        expect(pieces.every((tile) => tile.suit === element && tile.state === 'hidden')).toBe(true);
        expect(broken.board.pairCount).toBe(board.pairCount + COLOSSUS_BREAK_PAIRS);
    });

    it('leaves a rules-62 Colossus turning as it did', () => {
        expect(bossBoard().colossus!.form).toBeUndefined();
        expect(bossBoard().colossus!.cycle.length).toBeGreaterThanOrEqual(2);
    });
});
