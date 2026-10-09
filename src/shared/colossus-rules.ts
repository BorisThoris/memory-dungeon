import type { BoardState, ColossusEvent, ColossusState, RunState, Tile, TileSuit } from './contracts';
import { atomicVariantForPairKey } from './board-tile-generation-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { ALL_TILE_SYMBOLS_FOR_GALLERY, getSymbolSetForLevel } from './tile-symbol-catalog';
import { isSingletonUtilityPairKey } from './tile-identity';
import { TILE_SUITS } from './tile-suit-rules';

/**
 * The Colossus (2026-10-07): the boss floors get a boss.
 *
 * A boss floor was a tag, a score multiplier and a paragraph of coaching. Now a great card stands
 * over the board on it, and the floor is a fight with a clock.
 *
 *   - It shows one element, and **changes to the next every turn**, match or miss, in a fixed
 *     order laid out when the floor is dealt: only the elements this floor's deck actually holds,
 *     the whole order on the card from the first moment, the next one marked. Nothing about it is
 *     rolled during play.
 *   - **Match a pair of the element it is showing and it takes a hit.** A pair the pop takes
 *     counts as well, but a turn lands one blow however many pairs it took. A match of any other element is a *chip*: two chips are a hit. So a player
 *     who takes every pair they know is still winning the fight, only slower; without the chip,
 *     playing safe quietly spends the pairs the fight needs and the Colossus cannot be beaten,
 *     which is a loss the player never sees coming.
 *   - It needs two to four hits by the size of the floor, and gives `2 x hits + 2` turns: time to
 *     wait a turn or two for an element to come round, not time to wander.
 *   - **Out of turns, it splits**: one new pair for every hit it still had in it, two at most,
 *     dealt into cells the floor has already cleared and **shown face up until the next flip**,
 *     so the split costs the turns to take them and not the misses to find them. It splits once
 *     and is gone.
 *   - **Felled, it pays** score and gold by its size.
 *   - It never holds the floor: clear every pair and the floor ends whether it stands or not.
 *
 * The card is not on the grid. A cell is an index into `board.tiles` and the grid reflows with the
 * window (`board-layout-rules.ts`), so nothing can own four cells; and a thing the player never
 * turns over does not belong among things they do. It lives on `board.colossus`, which every
 * mover, tool and counter that walks `tiles` never meets.
 */
export const COLOSSUS_RULES_FROM = 62;
/**
 * The Colossus on the board (rules 63, 2026-10-09). The owner's ask: a great card on the playfield
 * that shows **one** element and demands pairs of it, and breaks down into more cards if the
 * challenge fails. So from rules 63:
 *
 *   - **One element, all fight long**: "match 3 pairs of Fire". It is one the floor holds enough
 *     pairs of to be beaten with, picked when the floor is dealt.
 *   - **A turn that takes a pair of it is a hit**, the pop's pairs included, one blow a turn as
 *     before. Nothing else hurts it: the chip existed so a Colossus that turned away from the
 *     player's pairs could still be beaten, and one that never turns needs no consolation.
 *   - **Out of turns, it breaks**: its four cells' worth of cards, two pairs of its own element,
 *     dealt face down into cleared cells (or onto the end of the board). They are pairs like any
 *     other, so the floor can always still be finished.
 *
 * The rules-62 Colossus (the turning one) is kept for runs dealt under it: `form` tells them apart.
 */
export const COLOSSUS_FIXED_FROM = 63;
/** Pairs a fixed Colossus breaks into: its four cells' worth. */
export const COLOSSUS_BREAK_PAIRS = 2;
/** Floors smaller than this are over before a fight could be. */
export const COLOSSUS_MIN_PAIRS = 6;
/** Off-element matches that make one hit. */
export const COLOSSUS_CHIPS_PER_HIT = 2;
export const COLOSSUS_MAX_SPLIT_PAIRS = 2;
export const COLOSSUS_SCORE_PER_HIT = 90;
export const COLOSSUS_GOLD_PER_HIT = 2;

/** Hits to fell it, by the size of the floor: about one pair in five. */
export const colossusHitsForPairs = (pairCount: number): number => (pairCount < 10 ? 2 : pairCount < 16 ? 3 : 4);

/** Turns it gives: every hit and a turn's wait for it, and two to spare. */
export const colossusTurnsForHits = (hits: number): number => 2 * hits + 2;

/** Pairs of each element still on the board, singleton utility cards aside. */
const livePairsBySuit = (board: Pick<BoardState, 'tiles'>): Map<TileSuit, number> => {
    const pairs = new Map<TileSuit, Set<string>>();
    for (const tile of board.tiles) {
        if (!tile.suit || isSingletonUtilityPairKey(tile.pairKey) || tile.state === 'matched' || tile.state === 'removed') continue;
        pairs.set(tile.suit, (pairs.get(tile.suit) ?? new Set()).add(tile.pairKey));
    }
    return new Map([...pairs.entries()].map(([suit, keys]) => [suit, keys.size]));
};

const realSuitsOnBoard = (board: Pick<BoardState, 'tiles'>): TileSuit[] => {
    const held = new Set<TileSuit>();
    for (const tile of board.tiles) {
        if (tile.suit && !isSingletonUtilityPairKey(tile.pairKey) && tile.state !== 'matched' && tile.state !== 'removed') held.add(tile.suit);
    }
    return TILE_SUITS.filter((suit) => held.has(suit));
};

/**
 * Stand a Colossus over a freshly dealt boss floor, or leave the board as it is. Called once the
 * floor's suits are final (after the realm has re-dealt them), because its cycle is those suits.
 */
export const raiseColossus = (board: BoardState, { runSeed, rulesVersion }: { runSeed: number; rulesVersion: number }): BoardState => {
    if (rulesVersion < COLOSSUS_RULES_FROM || board.floorTag !== 'boss' || board.pairCount < COLOSSUS_MIN_PAIRS) {
        return board;
    }
    const suits = realSuitsOnBoard(board);
    if (suits.length < 2) {
        return board;
    }
    const rng = createMulberry32(hashStringToSeed(`colossus:${runSeed}:${rulesVersion}:${board.level}`));
    if (rulesVersion >= COLOSSUS_FIXED_FROM) {
        // One element it can be beaten with: an element the floor holds at least as many pairs of
        // as it takes hits, and if none does, the most-held one, asking only what is there.
        const held = livePairsBySuit(board);
        const want = colossusHitsForPairs(board.pairCount);
        const enough = suits.filter((suit) => (held.get(suit) ?? 0) >= want);
        const most = Math.max(...suits.map((suit) => held.get(suit) ?? 0));
        const pool = enough.length > 0 ? enough : suits.filter((suit) => (held.get(suit) ?? 0) === most);
        const element = pool[pickRngIndex(rng, pool.length)]!;
        const fixedHits = Math.max(1, Math.min(want, held.get(element) ?? 0));
        return {
            ...board,
            colossus: {
                cycle: [element],
                step: 0,
                hits: fixedHits,
                hitsMax: fixedHits,
                chips: 0,
                turnsLeft: colossusTurnsForHits(fixedHits),
                turnsMax: colossusTurnsForHits(fixedHits),
                status: 'standing',
                form: 'fixed'
            }
        };
    }
    const hits = colossusHitsForPairs(board.pairCount);
    const colossus: ColossusState = {
        cycle: shuffleWithRng(rng, suits),
        step: 0,
        hits,
        hitsMax: hits,
        chips: 0,
        turnsLeft: colossusTurnsForHits(hits),
        turnsMax: colossusTurnsForHits(hits),
        status: 'standing'
    };
    return { ...board, colossus };
};

/** The element it shows now. */
export const colossusElement = (colossus: ColossusState): TileSuit => colossus.cycle[colossus.step % colossus.cycle.length]!;
/** The element it will show after the next turn. */
export const colossusNextElement = (colossus: ColossusState): TileSuit => colossus.cycle[(colossus.step + 1) % colossus.cycle.length]!;
export const colossusStands = (board: Pick<BoardState, 'colossus'> | null | undefined): boolean => board?.colossus?.status === 'standing';

export interface ColossusTurn {
    readonly board: BoardState;
    readonly event: ColossusEvent | null;
    readonly scoreDelta: number;
    readonly goldDelta: number;
    /** The split's new cards, shown face up until the next flip. */
    readonly litTileIds: readonly string[];
}

const isGone = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

/**
 * The split: `want` new pairs, dealt first into the cells of pairs already gone (the pop's
 * casualties before the player's own matches) and, on a floor where nothing has gone, onto the end
 * of the board. One pair per element of the cycle, starting from the one it was showing, so what
 * it leaves is spread across the deck and not a clump of one suit. No card already down moves.
 */
const splitInto = (board: BoardState, colossus: ColossusState, want: number): { board: BoardState; newTileIds: string[]; newPairKeys: string[] } => {
    // A fixed Colossus breaks into pairs of its own element; the turning one spread them across its cycle.
    const goneByPair = new Map<string, number[]>();
    board.tiles.forEach((tile, index) => {
        if (!isGone(tile) || isSingletonUtilityPairKey(tile.pairKey)) return;
        goneByPair.set(tile.pairKey, [...(goneByPair.get(tile.pairKey) ?? []), index]);
    });
    const whole = [...goneByPair.entries()].filter(([, cells]) => cells.length === 2);
    const reusable = [...whole.filter(([, cells]) => board.tiles[cells[0]!]!.brokenByChunk === true), ...whole.filter(([, cells]) => board.tiles[cells[0]!]!.brokenByChunk !== true)];
    const shown = new Set(board.tiles.map((tile) => tile.symbol));
    const fresh = [...getSymbolSetForLevel(board.level), ...ALL_TILE_SYMBOLS_FOR_GALLERY].filter(
        (entry, index, list) => !shown.has(entry.symbol) && list.findIndex((other) => other.symbol === entry.symbol) === index
    );
    const tiles = [...board.tiles];
    const newTileIds: string[] = [];
    const newPairKeys: string[] = [];
    let reused = 0;
    for (let slot = 0; slot < want; slot += 1) {
        const face = fresh[slot] ?? { symbol: `C${slot + 1}`, label: `Shard ${slot + 1}` };
        const pairKey = `${board.level}-colossus-${slot}`;
        const suit = colossus.cycle[(colossus.step + slot) % colossus.cycle.length]!;
        const halves: Tile[] = (['A', 'B'] as const).map((half) => ({
            id: `${pairKey}-${half}`,
            pairKey,
            state: 'hidden',
            symbol: face.symbol,
            label: face.label,
            atomicVariant: atomicVariantForPairKey(pairKey),
            suit
        }));
        const cells = reusable[slot]?.[1];
        if (cells) {
            tiles[cells[0]!] = halves[0]!;
            tiles[cells[1]!] = halves[1]!;
            reused += 1;
        } else {
            tiles.push(...halves);
        }
        newTileIds.push(halves[0]!.id, halves[1]!.id);
        newPairKeys.push(pairKey);
    }
    const appended = want - reused;
    return {
        board: {
            ...board,
            tiles,
            // A reused cell held a pair that was counted as gone; an appended pair is new to the floor's count.
            matchedPairs: Math.max(0, board.matchedPairs - reused),
            pairCount: board.pairCount + appended,
            rows: Math.max(board.rows, Math.ceil(tiles.length / Math.max(1, board.columns)))
        },
        newTileIds,
        newPairKeys
    };
};

/**
 * One turn of the fight, on the board the turn produced. `pairsBySuit` is what a match took (its
 * own pair and the pop's), absent on a miss. A function of the board and the turn alone: the same
 * turn on the same board always does the same thing.
 */
export const resolveColossusTurn = ({
    board,
    outcome,
    pairsBySuit,
    turnsThisFloor
}: {
    board: BoardState;
    outcome: 'match' | 'miss';
    pairsBySuit?: Partial<Record<TileSuit, number>>;
    /** The floor's turn count after this turn: the event's identity. */
    turnsThisFloor: number;
}): ColossusTurn => {
    const colossus = board.colossus;
    if (!colossus || colossus.status !== 'standing') {
        return { board, event: null, scoreDelta: 0, goldDelta: 0, litTileIds: [] };
    }
    const showing = colossusElement(colossus);
    const key = `colossus:${board.level}:${turnsThisFloor}`;
    let hits = colossus.hits;
    let chips = colossus.chips;
    let landed = 0;
    let chipped = 0;
    if (outcome === 'match' && pairsBySuit) {
        const on = Math.max(0, Math.floor(pairsBySuit[showing] ?? 0));
        const all = TILE_SUITS.reduce((sum, suit) => sum + Math.max(0, Math.floor(pairsBySuit[suit] ?? 0)), 0);
        // One blow a turn, however many pairs the turn took: a burst that includes its element is a
        // hit, a turn that took none of it is a chip. A reaction clearing six pairs is its own
        // reward (`element-alchemy-rules.ts`); counted pair for pair it felled every Colossus on
        // the turn it stood up (the soak: 351 raised, 351 felled) and the clock never mattered.
        chipped = on > 0 || all === 0 || colossus.form === 'fixed' ? 0 : 1;
        chips += chipped;
        landed = Math.min(hits, (on > 0 ? 1 : 0) + Math.floor(chips / COLOSSUS_CHIPS_PER_HIT));
        chips %= COLOSSUS_CHIPS_PER_HIT;
        hits -= landed;
    }
    if (hits === 0) {
        const felled: ColossusState = { ...colossus, hits: 0, chips: 0, status: 'felled' };
        return {
            board: { ...board, colossus: felled },
            event: { key, kind: 'felled', element: showing, hits: landed, hitsLeft: 0, turnsLeft: colossus.turnsLeft, pairs: 0 },
            scoreDelta: COLOSSUS_SCORE_PER_HIT * colossus.hitsMax,
            goldDelta: COLOSSUS_GOLD_PER_HIT * colossus.hitsMax,
            litTileIds: []
        };
    }
    const turnsLeft = colossus.turnsLeft - 1;
    if (turnsLeft <= 0) {
        const fixed = colossus.form === 'fixed';
        const want = fixed ? COLOSSUS_BREAK_PAIRS : Math.min(COLOSSUS_MAX_SPLIT_PAIRS, hits);
        const split = splitInto(board, colossus, want);
        return {
            board: { ...split.board, colossus: { ...colossus, hits, chips, turnsLeft: 0, status: 'split', splitPairKeys: split.newPairKeys } },
            event: { key, kind: 'split', element: showing, hits: landed, hitsLeft: hits, turnsLeft: 0, pairs: want },
            scoreDelta: 0,
            goldDelta: 0,
            // The turning Colossus's pairs are shown face up; the fixed one's fall face down, to be found.
            litTileIds: fixed ? [] : split.newTileIds
        };
    }
    const next: ColossusState = { ...colossus, hits, chips, turnsLeft, step: colossus.form === 'fixed' ? 0 : colossus.step + 1 };
    const kind: ColossusEvent['kind'] = landed > 0 ? 'hit' : chipped > 0 ? 'chip' : 'turn';
    return {
        board: { ...board, colossus: next },
        event: { key, kind, element: showing, hits: landed, hitsLeft: hits, turnsLeft, pairs: 0 },
        scoreDelta: 0,
        goldDelta: 0,
        litTileIds: []
    };
};

/** The run fields a Colossus turn writes, merged over the run the seam built. */
export const applyColossusTurnToRun = (run: RunState, turn: ColossusTurn): Partial<RunState> => {
    if (!turn.event) {
        return {};
    }
    const stats = run.stats;
    return {
        board: turn.board,
        lastColossusEvent: turn.event,
        colossusHitsThisFloor: runNonNegativeInteger(run.colossusHitsThisFloor ?? 0) + turn.event.hits,
        colossusSplitsThisFloor: runNonNegativeInteger(run.colossusSplitsThisFloor ?? 0) + (turn.event.kind === 'split' ? 1 : 0),
        colossiFelledThisRun: runNonNegativeInteger(run.colossiFelledThisRun ?? 0) + (turn.event.kind === 'felled' ? 1 : 0),
        ...(turn.litTileIds.length > 0 ? { realmLitTileIds: [...new Set([...(run.realmLitTileIds ?? []), ...turn.litTileIds])] } : {}),
        ...(turn.goldDelta > 0 ? { gold: runNonNegativeInteger(run.gold ?? 0) + turn.goldDelta } : {}),
        ...(turn.scoreDelta > 0
            ? {
                  stats: {
                      ...stats,
                      totalScore: runNonNegativeInteger(stats.totalScore) + turn.scoreDelta,
                      currentLevelScore: runNonNegativeInteger(stats.currentLevelScore) + turn.scoreDelta,
                      bestScore: Math.max(runNonNegativeInteger(stats.bestScore), runNonNegativeInteger(stats.totalScore) + turn.scoreDelta)
                  }
              }
            : {})
    };
};
