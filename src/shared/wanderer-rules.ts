import type { BoardState, RunState, Tile } from './contracts';
import { isRealmHeld } from './odd-card-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The Wanderers (DGE-009, 2026-10-20): cards that drift a cell at a time and leave a trail.
 *
 * From the Living Dungeon (floor 13) two pairs of every floor, three from the Deep (floor 25), are
 * Wanderers. Every third resolved turn of the floor, match or miss, each Wanderer still face down
 * steps one cell up, down, left or right, trading places with the face-down card there, and leaves
 * a footprint on the cell it left for one turn. It is the half-known memory task the late game
 * wanted: the board is not reshuffled, one card has moved one step, and the footprint says from where.
 *
 * What it never does: step onto a pinned, face-up, matched or realm-held card, trade places with
 * its own partner or another Wanderer, or step twice in a tick (the card it traded with has moved
 * too, so that card is spent for the tick). A pinned Wanderer stays: the pin is what was paid for.
 *
 * The plan put a wanderer mark on the backs. The owner's rule (`player-visible-board.ts`, 2026-10-08)
 * is that nothing face down may set one pair apart, so the mark is on the face only and the step
 * and its footprint are what the board shows.
 *
 * It steps after every other consequence of the turn (the restless drift, the looking glass, the
 * realm), on the board the turn produced, from the run's seed: a restless floor and the Wanderers
 * compose in that order, and a replay steps the same way.
 */
export const WANDERER_RULES_FROM = 70;
export const WANDERER_FROM_FLOOR = 13;
/** From the Deep, a third pair wanders. */
export const WANDERER_THIRD_PAIR_FLOOR = 25;
export const WANDERER_STEP_EVERY_TURNS = 3;
/** A floor this small has no pair to spare and no room to walk. */
export const WANDERER_MIN_PAIRS = 8;

export const wandererPairsForFloor = (level: number): number =>
    level >= WANDERER_THIRD_PAIR_FLOOR ? 3 : level >= WANDERER_FROM_FLOOR ? 2 : 0;

const isPlainPair = (pair: readonly Tile[]): boolean =>
    pair.length === 2 &&
    pair.every(
        (tile) =>
            tile.state === 'hidden' &&
            tile.suit != null &&
            !tile.findableKind &&
            !tile.tileTraitKind &&
            tile.turncoat == null &&
            tile.hourglass == null &&
            !tile.wanderer &&
            !isRealmHeld(tile)
    );

/** Deals the floor's Wanderers onto plain pairs, from the run's seed, when the floor is dealt. */
export const dealWanderers = (board: BoardState, { runSeed, rulesVersion }: { runSeed: number; rulesVersion: number }): BoardState => {
    const wanted = wandererPairsForFloor(board.level);
    if (rulesVersion < WANDERER_RULES_FROM || wanted === 0 || board.pairCount < WANDERER_MIN_PAIRS) return board;
    const marked = new Set([board.cursedPairKey, board.wardPairKey, board.bountyPairKey]);
    const halves = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), tile]);
    }
    const pool = [...halves.entries()].filter(([pairKey, pair]) => !marked.has(pairKey) && isPlainPair(pair)).map(([pairKey]) => pairKey);
    const rng = createMulberry32(hashStringToSeed(`wanderers:${runSeed}:${rulesVersion}:${board.level}`));
    const chosen = new Set<string>();
    while (chosen.size < wanted && pool.length > 0) {
        const [pairKey] = pool.splice(pickRngIndex(rng, pool.length), 1);
        if (pairKey) chosen.add(pairKey);
    }
    if (chosen.size === 0) return board;
    return { ...board, tiles: board.tiles.map((tile) => (chosen.has(tile.pairKey) ? { ...tile, wanderer: true } : tile)) };
};

export interface WandererStep {
    /** The cell the Wanderer left (its footprint) and the cell it stepped into. */
    readonly from: number;
    readonly to: number;
}

const neighbours = (index: number, columns: number, size: number): number[] => {
    const cells: number[] = [];
    const column = index % columns;
    if (index - columns >= 0) cells.push(index - columns);
    if (index + columns < size) cells.push(index + columns);
    if (column > 0) cells.push(index - 1);
    if (column < columns - 1 && index + 1 < size) cells.push(index + 1);
    return cells;
};

/** True on the turns the Wanderers step (`turnsThisFloor` counted after the turn). */
export const isWandererStepTurn = (turnsThisFloor: number): boolean =>
    Number.isFinite(turnsThisFloor) && turnsThisFloor > 0 && turnsThisFloor % WANDERER_STEP_EVERY_TURNS === 0;

/** Where every Wanderer steps this tick, in a seeded order; empty when none can move. */
export const resolveWandererSteps = ({
    board,
    turnsThisFloor,
    pinnedTileIds,
    lockedIndex = null,
    runSeed,
    rulesVersion
}: {
    board: BoardState;
    turnsThisFloor: number;
    pinnedTileIds: readonly string[];
    /** Sticky fingers' lock (`stickyBlockIndex`) is on a cell, not a card: nothing steps into or out of it. */
    lockedIndex?: number | null;
    runSeed: number;
    rulesVersion: number;
}): WandererStep[] => {
    if (!isWandererStepTurn(turnsThisFloor)) return [];
    const pinned = new Set(pinnedTileIds);
    const free = (tile: Tile | undefined): tile is Tile => tile != null && tile.state === 'hidden' && !pinned.has(tile.id) && !isRealmHeld(tile);
    const walkers = board.tiles
        .map((tile, index) => ({ tile, index }))
        .filter(({ tile, index }) => tile.wanderer === true && index !== lockedIndex && free(tile));
    if (walkers.length === 0) return [];
    const rng = createMulberry32(hashStringToSeed(`wander:${runSeed}:${rulesVersion}:${board.level}:${turnsThisFloor}`));
    const spent = new Set<number>();
    const steps: WandererStep[] = [];
    const order = [...walkers];
    while (order.length > 0) {
        const [walker] = order.splice(pickRngIndex(rng, order.length), 1);
        if (!walker || spent.has(walker.index)) continue;
        const cells = neighbours(walker.index, Math.max(1, board.columns), board.tiles.length).filter((cell) => {
            const there = board.tiles[cell];
            return cell !== lockedIndex && !spent.has(cell) && free(there) && !there.wanderer && there.pairKey !== walker.tile.pairKey;
        });
        if (cells.length === 0) continue;
        const to = cells[pickRngIndex(rng, cells.length)]!;
        spent.add(walker.index);
        spent.add(to);
        steps.push({ from: walker.index, to });
    }
    return steps;
};

/** The steps applied: each Wanderer trades cells with the card it stepped onto, which wears the footprint. */
export const applyWandererSteps = (board: BoardState, steps: readonly WandererStep[]): BoardState => {
    if (steps.length === 0) return board;
    const tiles = [...board.tiles];
    for (const { from, to } of steps) {
        const walker = tiles[from];
        const other = tiles[to];
        if (!walker || !other) continue;
        tiles[from] = { ...other, footprint: true };
        tiles[to] = walker;
    }
    return { ...board, tiles };
};

/** The cells a Wanderer stepped out of on the last turn: where the face-down cards wearing a footprint lie. */
export const wandererFootprintCells = (board: BoardState | null | undefined): number[] =>
    (board?.tiles ?? []).flatMap((tile, index) => (tile.footprint && tile.state === 'hidden' ? [index] : []));

const withoutFootprints = (board: BoardState): BoardState =>
    board.tiles.some((tile) => tile.footprint)
        ? { ...board, tiles: board.tiles.map((tile) => (tile.footprint ? (({ footprint: _footprint, ...rest }) => rest)(tile) : tile)) }
        : board;

/**
 * Applied after every resolved turn (`board-turn-transition.ts`): on the third turn the Wanderers
 * step; every turn wipes the last turn's footprints, so one lasts exactly one turn.
 */
export const applyWandererTurn = (before: RunState, after: RunState): RunState => {
    if (!before.board || !after.board) return after;
    const turned = runNonNegativeInteger(after.turnsThisFloor) > runNonNegativeInteger(before.turnsThisFloor);
    if (!turned) return after;
    // Every turn wipes the last turn's footprints, and a floor that ended keeps none.
    const board = withoutFootprints(after.board);
    const cleared = board === after.board ? after : { ...after, board };
    if (after.status !== 'playing') return cleared;
    const steps = resolveWandererSteps({
        board,
        turnsThisFloor: runNonNegativeInteger(after.turnsThisFloor),
        pinnedTileIds: after.pinnedTileIds ?? [],
        lockedIndex: after.stickyBlockIndex ?? null,
        runSeed: after.runSeed,
        rulesVersion: after.runRulesVersion
    });
    if (steps.length === 0) return cleared;
    return {
        ...cleared,
        board: applyWandererSteps(board, steps),
        wandererStepsThisFloor: runNonNegativeInteger(after.wandererStepsThisFloor) + steps.length
    };
};
