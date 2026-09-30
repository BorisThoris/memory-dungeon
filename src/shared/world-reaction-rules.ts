import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { COMBO_HEAT_STAGE_FROM, comboHeatStageIndex, comboHeatStage } from './combo-heat-rules';
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
 * - **The cold freezes** (`resolveFrostStep`). In a cold world - a bone world - every
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
/** The most cards any world freezes at once, a blizzard at a hot combo; the free-pair guard still holds. */
export const FROST_FREEZE_MAX = 4;
/** How often a freeze takes both halves of one pair, so the ice never reads as "these differ". */
export const FROST_PAIR_FREEZE_CHANCE = 0.3;

export const frostFreezeCount = (combo: number): number =>
    comboHeatStageIndex(comboHeatStage(combo)) >= comboHeatStageIndex('blazing') ? 3 : 2;

/**
 * Whether the run's world is cold: while bone is in it. A run is not born cold - the cold comes
 * from the bone cards the player popped their way into, and leaves when the world moves on.
 */
export const isColdWorld = (run: { world?: readonly TileSuit[] }): boolean => (run.world ?? []).includes('bone');

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
    rulesVersion,
    freezeExtra = 0,
    freezeTurns = FROST_FREEZE_TURNS
}: {
    board: BoardState;
    turnsThisFloor: number;
    frozenUntilTurn: number | null | undefined;
    cold: boolean;
    combo: number;
    pinnedTileIds: readonly string[];
    runSeed: number;
    rulesVersion: number;
    /** Cards over the combo's count a fused world freezes (a blizzard +1, ash -1); see `worldRules`. */
    freezeExtra?: number;
    /** Turns the ice lasts; a deep bone world or a blizzard holds it three. */
    freezeTurns?: number;
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
    const want = Math.max(1, Math.min(FROST_FREEZE_MAX, frostFreezeCount(combo) + freezeExtra));
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
    return { board: frozenBoard(cells), frozenUntilTurn: turnsThisFloor + freezeTurns, froze: true };
};

// ---- Element worlds -------------------------------------------------------------------------

/** Pairs a single pop has to take (the match's pair included) to pull the room into its element. */
export const WORLD_SHIFT_PAIRS = 4;
export const WORLD_MAX_ELEMENTS = 2;

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
    rulesVersion,
    every = TIDE_EVERY_TURNS,
    swaps = 1
}: {
    board: BoardState;
    turnsThisFloor: number;
    pinnedTileIds: readonly string[];
    runSeed: number;
    rulesVersion: number;
    /** Turns between tides: three, two in steam. */
    every?: number;
    /** Pairs of cards each tide trades: one, two in a swamp or a deep tide. */
    swaps?: number;
}): BoardState | null => {
    const cadence = Math.max(2, Math.floor(every));
    if (turnsThisFloor <= 0 || turnsThisFloor % cadence !== 1 % cadence) return null;
    const rng = createMulberry32(hashStringToSeed(`tide:${runSeed}:${rulesVersion}:${board.level}:${turnsThisFloor}`));
    const tiles = [...board.tiles];
    let moved = 0;
    const used = new Set<number>();
    for (let swap = 0; swap < Math.max(1, swaps); swap += 1) {
        const cells = hiddenRealIndices({ ...board, tiles }).filter(
            (index) => !used.has(index) && !pinnedTileIds.includes(tiles[index]!.id) && !isTileFrozen(tiles[index])
        );
        if (cells.length < 2) break;
        const first = cells[pickRngIndex(rng, cells.length)]!;
        const others = cells.filter((index) => tiles[index]!.pairKey !== tiles[first]!.pairKey);
        if (others.length === 0) break;
        const second = others[pickRngIndex(rng, others.length)]!;
        [tiles[first], tiles[second]] = [tiles[second]!, tiles[first]!];
        used.add(first);
        used.add(second);
        moved += 1;
    }
    return moved > 0 ? { ...board, tiles } : null;
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

// ---- Depth, the element streak, fusions -----------------------------------------------------

/**
 * How deep the world runs, 1..3 (0 in the plain dungeon). A world is a place, not a mood: a pull
 * of an element the world already holds deepens it; a pull of another element first wears the
 * depth down, and only a world one deep lets the newcomer in. Measured before this (careful
 * player, 30 runs): the world changed about once a floor, so nothing lasted long enough to feel
 * like somewhere.
 */
export const WORLD_MAX_DEPTH = 3;

/** Matches in a row of one element that pull the world toward it without a pop: the cards' own way in. */
export const ELEMENT_STREAK_PULL = 3;

export type WorldPullOutcome = 'entered' | 'deepened' | 'held' | null;

export interface WorldPull {
    readonly world: TileSuit[];
    readonly depth: number;
    readonly outcome: WorldPullOutcome;
}

/** The world after one pull toward `suit` (a big pop, or three matches of it in a row). */
export const resolveWorldPull = (world: readonly TileSuit[] | undefined, depth: number | undefined, suit: TileSuit | undefined): WorldPull => {
    const now = [...(world ?? [])];
    const deep = Math.max(0, Math.min(WORLD_MAX_DEPTH, Math.floor(depth ?? (now.length > 0 ? 1 : 0))));
    if (!suit) return { world: now, depth: deep, outcome: null };
    if (now.includes(suit)) {
        // The element leads again, and the world goes one deeper.
        return { world: [...now.filter((element) => element !== suit), suit], depth: Math.min(WORLD_MAX_DEPTH, Math.max(1, deep) + 1), outcome: 'deepened' };
    }
    if (deep > 1) return { world: now, depth: deep - 1, outcome: 'held' };
    return { world: [...now, suit].slice(-WORLD_MAX_ELEMENTS), depth: 1, outcome: 'entered' };
};

export interface ElementStreak {
    readonly suit: TileSuit;
    readonly count: number;
}

/** The streak after a match of `suit`, and whether it just reached the pull (then it starts again). */
export const advanceElementStreak = (streak: ElementStreak | null | undefined, suit: TileSuit | undefined): { streak: ElementStreak | null; pulls: boolean } => {
    if (!suit) return { streak: null, pulls: false };
    const count = streak?.suit === suit ? runNonNegativeInteger(streak.count) + 1 : 1;
    return count >= ELEMENT_STREAK_PULL ? { streak: null, pulls: true } : { streak: { suit, count }, pulls: false };
};

export type WorldFusionId = 'steam' | 'wildfire' | 'ash' | 'swamp' | 'blizzard' | 'grave';

export interface WorldFusion {
    readonly id: WorldFusionId;
    readonly title: string;
}

const fusionKey = (a: TileSuit, b: TileSuit): string => [a, b].sort().join('+');

/** Two elements make a named world with its own sharper rules (`worldRules`), not two rules side by side. */
export const WORLD_FUSIONS: Readonly<Record<string, WorldFusion>> = {
    [fusionKey('ember', 'tide')]: { id: 'steam', title: 'Steam' },
    [fusionKey('ember', 'moss')]: { id: 'wildfire', title: 'Wildfire' },
    [fusionKey('ember', 'bone')]: { id: 'ash', title: 'Ash' },
    [fusionKey('tide', 'moss')]: { id: 'swamp', title: 'Swamp' },
    [fusionKey('tide', 'bone')]: { id: 'blizzard', title: 'Blizzard' },
    [fusionKey('moss', 'bone')]: { id: 'grave', title: 'Grave' }
};

export const worldFusion = (world: readonly TileSuit[] | undefined): WorldFusion | null => {
    const elements = world ?? [];
    return elements.length === 2 ? WORLD_FUSIONS[fusionKey(elements[0]!, elements[1]!)] ?? null : null;
};

export interface WorldRules {
    /** Cards the afterglow lights over the combo's own (the lantern's cap still holds). */
    readonly afterglowBonus: number;
    /** Turns between tides, or null with no tide in the world. */
    readonly tideEvery: number | null;
    readonly tideSwaps: number;
    /** Whether the world is cold, and how the cold bites. */
    readonly cold: boolean;
    readonly freezeExtra: number;
    readonly freezeTurns: number;
    /** Whether a match overgrows the card beside it. */
    readonly overgrowth: boolean;
    readonly fusion: WorldFusion | null;
}

/**
 * Everything a world does to the board, in one place. Each element brings its rule; a deep world
 * (three) sharpens its lead element's; a fusion sharpens the pair's. Every number here stays inside
 * the guards the rules already keep: the ice always leaves two whole pairs free, the tide never
 * moves a pinned or frozen card, the afterglow never passes the lantern's three.
 */
export const worldRules = (world: readonly TileSuit[] | undefined, depth: number | undefined): WorldRules => {
    const elements = world ?? [];
    const deep = Math.max(0, Math.floor(depth ?? (elements.length > 0 ? 1 : 0))) >= WORLD_MAX_DEPTH;
    const lead = elements[elements.length - 1];
    const has = (element: TileSuit): boolean => elements.includes(element);
    const fusion = worldFusion(elements);
    let afterglowBonus = has('ember') ? EMBER_WORLD_AFTERGLOW_BONUS + (deep && lead === 'ember' ? 1 : 0) : 0;
    let tideEvery: number | null = has('tide') ? TIDE_EVERY_TURNS : null;
    let tideSwaps = has('tide') && deep && lead === 'tide' ? 2 : 1;
    const cold = has('bone');
    let freezeExtra = 0;
    let freezeTurns = cold && deep && lead === 'bone' ? 3 : FROST_FREEZE_TURNS;
    const overgrowth = has('moss');
    switch (fusion?.id) {
        case 'steam':
            tideEvery = 2;
            break;
        case 'wildfire':
            afterglowBonus += 1;
            break;
        case 'ash':
            freezeExtra = -1;
            break;
        case 'swamp':
            tideSwaps = 2;
            break;
        case 'blizzard':
            freezeExtra = 1;
            freezeTurns = 3;
            break;
        case 'grave':
            freezeTurns = 3;
            break;
        default:
            break;
    }
    return { afterglowBonus, tideEvery, tideSwaps, cold, freezeExtra, freezeTurns, overgrowth, fusion };
};
