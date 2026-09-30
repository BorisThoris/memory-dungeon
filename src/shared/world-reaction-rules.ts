import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { COMBO_HEAT_STAGE_FROM, comboHeatStageIndex, comboHeatStage, comboHeatThemeForSeed } from './combo-heat-rules';
import { applyMagpieTheft } from './magpie-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The world reacts (2026-09-30). Until now the room answered the combo - snow, storms, the black
 * hole, embers - and the board never heard it. The owner asked for the rules to hear the world,
 * the way the arcade tables do: the black hole spits, the cold freezes cards, and the cards' own
 * elements pull the room into their world when a big pop goes off. All of it is on the punishing
 * side of "the hot hand gets a different game, never a safer one", and every piece is guarded so
 * a floor can always be finished.
 *
 * Three rules:
 *
 * - **The void spews** (`resolveVoidSpew`). A miss that kills a combo of Inferno or better opens the
 *   black hole, and the black hole spits: matched pairs come back face down (one, plus one for every
 *   ten links over sixteen, three at most) and every face-down card is shuffled. The streak you
 *   lost takes the work it was built on with it.
 * - **The cold freezes** (`resolveFrostStep`). In a cold world - a frost run, or a bone world - every
 *   third turn freezes two cards (three from Blazing) for two turns; a frozen card cannot be turned.
 *   They come from different pairs, and only sometimes both halves of one, so the ice never points
 *   at a match. It freezes only while at least two whole pairs stay free, and cracks early if a pop
 *   leaves none, so a floor can always be played.
 * - **Element worlds** (`resolveWorldShift`). A pop of three pairs or more pulls the room into the
 *   element of the cards that popped; a second element combines with it (two at most, the oldest
 *   goes). Each element has a rule: ember burns the afterglow one card wider, tide trades two
 *   face-down cards every third turn, moss overgrows a card beside a match (it cannot open the next
 *   turn), bone is cold (the freeze). The world holds across floors until another big pop changes
 *   it; the void takes it away.
 */

// ---- The void ------------------------------------------------------------------------------

/** The combo a miss has to kill to open the void: the black hole's own threshold. */
export const VOID_SPEW_FROM = COMBO_HEAT_STAGE_FROM.inferno;
export const VOID_SPEW_MAX_PAIRS = 3;

/** Pairs the void spits for a combo of `combo` lost: one, plus one per ten links over the threshold. */
export const voidSpewPairs = (combo: number): number =>
    combo < VOID_SPEW_FROM ? 0 : Math.min(VOID_SPEW_MAX_PAIRS, 1 + Math.floor((combo - VOID_SPEW_FROM) / 10));

export interface VoidSpew {
    readonly board: BoardState;
    /** Pairs that came back face down. */
    readonly returnedPairKeys: readonly string[];
}

const hiddenRealIndices = (board: BoardState): number[] =>
    board.tiles
        .map((tile, index) => ({ tile, index }))
        .filter(({ tile }) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey))
        .map(({ index }) => index);

/**
 * What the void does to the board a miss left, or null when the miss did not open it. Matched
 * pairs return first (pairs a pop took before pairs the player matched, the magpie's order), then
 * every face-down card that is not pinned trades places, seeded by the run.
 */
export const resolveVoidSpew = ({
    board,
    comboLost,
    pinnedTileIds,
    runSeed,
    rulesVersion,
    mismatchCount
}: {
    board: BoardState;
    comboLost: number;
    pinnedTileIds: readonly string[];
    runSeed: number;
    rulesVersion: number;
    mismatchCount: number;
}): VoidSpew | null => {
    const want = voidSpewPairs(comboLost);
    if (want === 0) return null;
    const rng = createMulberry32(hashStringToSeed(`void:${runSeed}:${rulesVersion}:${board.level}:${mismatchCount}`));
    let next = board;
    const returned: string[] = [];
    for (let count = 0; count < want; count += 1) {
        const gone = [...new Set(next.tiles.filter((tile) => tile.state === 'removed' && tile.brokenByChunk === true).map((tile) => tile.pairKey))];
        const pool = gone.length > 0 ? gone : [...new Set(next.tiles.filter((tile) => tile.state === 'matched').map((tile) => tile.pairKey))];
        const candidates = pool.filter((key) => !isSingletonUtilityPairKey(key) && !returned.includes(key));
        if (candidates.length === 0) break;
        const pairKey = candidates[pickRngIndex(rng, candidates.length)]!;
        const fromIndices = next.tiles.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile.pairKey === pairKey).map(({ index }) => index);
        next = applyMagpieTheft(next, { pairKey, tileIds: fromIndices.map((index) => next.tiles[index]!.id), toIndices: fromIndices });
        // A findable the pair carried was paid the first time; it does not come back with the cards.
        next = { ...next, tiles: next.tiles.map((tile) => (tile.pairKey === pairKey && tile.findableKind ? { ...tile, findableKind: undefined } : tile)) };
        returned.push(pairKey);
    }
    // The shuffle: every face-down card not pinned trades places with another, seeded.
    const movable = hiddenRealIndices(next).filter((index) => !pinnedTileIds.includes(next.tiles[index]!.id));
    const tiles = [...next.tiles];
    const order = [...movable];
    for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = pickRngIndex(rng, index + 1);
        [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    movable.forEach((cell, slot) => {
        tiles[cell] = next.tiles[order[slot]!]!;
    });
    return { board: { ...next, tiles }, returnedPairKeys: returned };
};

// ---- The cold -------------------------------------------------------------------------------

export const FROST_FREEZE_EVERY_TURNS = 3;
export const FROST_FREEZE_TURNS = 2;
/** Whole pairs that must stay free of ice for the cold to freeze at all. */
export const FROST_FREE_PAIRS_KEPT = 2;
/** How often a freeze takes both halves of one pair, so the ice never reads as "these differ". */
export const FROST_PAIR_FREEZE_CHANCE = 0.3;

export const frostFreezeCount = (combo: number): number =>
    comboHeatStageIndex(comboHeatStage(combo)) >= comboHeatStageIndex('blazing') ? 3 : 2;

/** Whether the run's world is cold: a frost run always is; a bone world is while bone is in it. */
export const isColdWorld = (run: Pick<RunState, 'runSeed' | 'world'>): boolean =>
    comboHeatThemeForSeed(run.runSeed).id === 'frost' || (run.world ?? []).includes('bone');

export const isTileFrozen = (tile: Pick<Tile, 'frozen'> | undefined): boolean => tile?.frozen === true;

/** Whole pairs still face down with neither half frozen. */
export const freePairsLeft = (board: BoardState): number => {
    const halves = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (tile.state !== 'hidden' || isSingletonUtilityPairKey(tile.pairKey)) continue;
        halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), tile]);
    }
    return [...halves.values()].filter((pair) => pair.length === 2 && pair.every((tile) => !isTileFrozen(tile))).length;
};

const hiddenPairCount = (board: BoardState): number => {
    const halves = new Map<string, number>();
    for (const tile of board.tiles) {
        if (tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey)) halves.set(tile.pairKey, (halves.get(tile.pairKey) ?? 0) + 1);
    }
    return [...halves.values()].filter((count) => count === 2).length;
};

/** Every card thawed, and ice on a card that is no longer face down (popped, matched) dropped. */
export const thawBoard = (board: BoardState): BoardState =>
    board.tiles.some((tile) => tile.frozen)
        ? { ...board, tiles: board.tiles.map((tile) => (tile.frozen ? { ...tile, frozen: undefined } : tile)) }
        : board;

/** The ice cracks when a pop or a bomb leaves no whole pair free: a floor can always be played. */
export const thawIfStuck = (board: BoardState): BoardState =>
    board.tiles.some((tile) => tile.frozen && tile.state === 'hidden') && freePairsLeft(board) === 0 ? thawBoard(board) : board;

export interface FrostStep {
    readonly board: BoardState;
    /** The turn the ice lasts through; null when nothing is frozen. */
    readonly frozenUntilTurn: number | null;
    /** Whether this step froze cards. */
    readonly froze: boolean;
}

/**
 * The cold's clock, run once after every resolved turn. `turnsThisFloor` is the count after the
 * turn. Thaws what has had its turns (or what a pop left stuck), then, in a cold world on every
 * third turn with nothing frozen, freezes.
 */
export const resolveFrostStep = ({
    board,
    turnsThisFloor,
    frozenUntilTurn,
    cold,
    combo,
    pinnedTileIds,
    runSeed,
    rulesVersion
}: {
    board: BoardState;
    turnsThisFloor: number;
    frozenUntilTurn: number | null | undefined;
    cold: boolean;
    combo: number;
    pinnedTileIds: readonly string[];
    runSeed: number;
    rulesVersion: number;
}): FrostStep => {
    const expired = frozenUntilTurn == null || turnsThisFloor >= frozenUntilTurn;
    let next = expired ? thawBoard(board) : thawIfStuck(board);
    // Ice on anything not face down goes with it.
    if (next.tiles.some((tile) => tile.frozen && tile.state !== 'hidden')) {
        next = { ...next, tiles: next.tiles.map((tile) => (tile.frozen && tile.state !== 'hidden' ? { ...tile, frozen: undefined } : tile)) };
    }
    const stillFrozen = next.tiles.some((tile) => tile.frozen);
    const until = stillFrozen && !expired ? frozenUntilTurn ?? null : null;
    if (!cold || stillFrozen || turnsThisFloor <= 0 || turnsThisFloor % FROST_FREEZE_EVERY_TURNS !== 0) {
        return { board: next, frozenUntilTurn: until, froze: false };
    }
    // Endgame mercy is not the point; a board this small cannot keep two pairs free and freeze any.
    if (hiddenPairCount(next) <= FROST_FREE_PAIRS_KEPT) return { board: next, frozenUntilTurn: null, froze: false };
    const rng = createMulberry32(hashStringToSeed(`frost:${runSeed}:${rulesVersion}:${next.level}:${turnsThisFloor}`));
    const byPair = new Map<string, number[]>();
    next.tiles.forEach((tile, index) => {
        if (tile.state !== 'hidden' || isSingletonUtilityPairKey(tile.pairKey) || pinnedTileIds.includes(tile.id)) return;
        byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), index]);
    });
    const pairs = [...byPair.entries()].filter(([, cells]) => cells.length === 2);
    const want = frostFreezeCount(combo);
    const picked: number[] = [];
    const order = [...pairs];
    for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = pickRngIndex(rng, index + 1);
        [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    let cursor = 0;
    if (want >= 2 && rng() < FROST_PAIR_FREEZE_CHANCE && order.length > 0) {
        picked.push(...order[0]![1]);
        cursor = 1;
    }
    for (; cursor < order.length && picked.length < want; cursor += 1) {
        const cells = order[cursor]![1];
        picked.push(cells[pickRngIndex(rng, cells.length)]!);
    }
    // Keep two whole pairs free: drop the last picks until they are.
    const frozenBoard = (cells: readonly number[]): BoardState => ({
        ...next,
        tiles: next.tiles.map((tile, index) => (cells.includes(index) ? { ...tile, frozen: true } : tile))
    });
    let cells = picked.slice(0, want);
    while (cells.length > 0 && freePairsLeft(frozenBoard(cells)) < FROST_FREE_PAIRS_KEPT) cells = cells.slice(0, -1);
    if (cells.length === 0) return { board: next, frozenUntilTurn: null, froze: false };
    return { board: frozenBoard(cells), frozenUntilTurn: turnsThisFloor + FROST_FREEZE_TURNS, froze: true };
};

// ---- Element worlds -------------------------------------------------------------------------

/** Pairs a single pop has to take (the match's pair included) to pull the room into its element. */
export const WORLD_SHIFT_PAIRS = 3;
export const WORLD_MAX_ELEMENTS = 2;

/**
 * The world after a pop of `pairsTaken` pairs of `suit`: the element joins (or moves to the front
 * of) the world, the oldest leaves past two. Unchanged below the threshold or without a suit.
 */
export const resolveWorldShift = (
    world: readonly TileSuit[] | undefined,
    suit: TileSuit | undefined,
    pairsTaken: number
): TileSuit[] => {
    const now = [...(world ?? [])];
    if (!suit || pairsTaken < WORLD_SHIFT_PAIRS) return now;
    return [...now.filter((element) => element !== suit), suit].slice(-WORLD_MAX_ELEMENTS);
};

export const worldHas = (run: Pick<RunState, 'world'>, element: TileSuit): boolean => (run.world ?? []).includes(element);

/** Ember's rule: the afterglow lights one card wider, even at a cold combo (the lantern's cap still holds). */
export const EMBER_WORLD_AFTERGLOW_BONUS = 1;

/** Tide's rule: every third turn, offset one from the freeze, two face-down cards of different pairs trade places. */
export const TIDE_EVERY_TURNS = 3;

export const resolveTideSwap = ({
    board,
    turnsThisFloor,
    pinnedTileIds,
    runSeed,
    rulesVersion
}: {
    board: BoardState;
    turnsThisFloor: number;
    pinnedTileIds: readonly string[];
    runSeed: number;
    rulesVersion: number;
}): BoardState | null => {
    if (turnsThisFloor <= 0 || turnsThisFloor % TIDE_EVERY_TURNS !== 1) return null;
    const cells = hiddenRealIndices(board).filter((index) => !pinnedTileIds.includes(board.tiles[index]!.id) && !isTileFrozen(board.tiles[index]));
    if (cells.length < 2) return null;
    const rng = createMulberry32(hashStringToSeed(`tide:${runSeed}:${rulesVersion}:${board.level}:${turnsThisFloor}`));
    const first = cells[pickRngIndex(rng, cells.length)]!;
    const others = cells.filter((index) => board.tiles[index]!.pairKey !== board.tiles[first]!.pairKey);
    if (others.length === 0) return null;
    const second = others[pickRngIndex(rng, others.length)]!;
    const tiles = [...board.tiles];
    [tiles[first], tiles[second]] = [tiles[second]!, tiles[first]!];
    return { ...board, tiles };
};

/** Moss's rule: a match overgrows the first face-down card beside it; it cannot open the next turn. */
export const mossOvergrowthIndex = (board: BoardState, matchedTileId: string): number | null => {
    if (hiddenPairCount(board) <= 1) return null;
    const from = board.tiles.findIndex((tile) => tile.id === matchedTileId);
    if (from < 0) return null;
    const neighbours = orthogonalNeighbourIndices(from, board.columns, board.tiles.length)
        .filter((index) => board.tiles[index]?.state === 'hidden' && !isTileFrozen(board.tiles[index]))
        .sort((a, b) => a - b);
    return neighbours[0] ?? null;
};

/** Worlds counted this floor, for the census and the soak. */
export const runWorldShifts = (run: Pick<RunState, 'worldShiftsThisFloor'>): number => runNonNegativeInteger(run.worldShiftsThisFloor);
