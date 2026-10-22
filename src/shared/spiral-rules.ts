import type { BoardState, RunState, Tile } from './contracts';
import { atomicVariantForPairKey } from './board-tile-generation-rules';
import { boardRings } from './cartographer-rules';
import { parTurnsForRun } from './floor-par';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';
import { TILE_SUITS } from './tile-suit-rules';
import { freshBoardFaces } from './void-spew-rules';

/**
 * The Spiral (DGE-021, rules 85): an Abyss floor that is survived, not cleared.
 *
 * Two floors of the Abyss (44 and 56, and their places in each Endless cycle) are Spirals. The board
 * is read as rings, outside in (`boardRings`). When the live ring is cleared it is **sealed** - its
 * cells leave the board for the floor - and fresh pairs, faces the floor has not shown, are dealt
 * into every cleared cell inside it: the new inner ring. The floor ends when the turns reach par
 * (`floor-par.ts`), whatever is left, or when the last ring seals. Score, not clearance, is the goal.
 * The par is the only clock: never a wall clock. The miss bank still charges misses.
 *
 * The ticket's "deals a new inner ring" on a fixed grid: the cleared cells inside the sealed ring take
 * the fresh pairs (the Warden's deal-again pattern), whole pairs only, never a held seed's cell; the
 * pair count, and so the par, stays the floor's. A Hold held when the turns reach par lets its stack
 * go with the floor. The collapse animation waits for DGE-030.
 */
export const SPIRAL_RULES_FROM = 85;
/** The Descent floors dealt as Spirals: the curve's samples (40, 52, 60) never land on them. */
export const SPIRAL_DESCENT_FLOORS: readonly number[] = [44, 56];

export const isSpiralFloor = (board: Pick<BoardState, 'floorArchetypeId'> | null | undefined): boolean => board?.floorArchetypeId === 'spiral_hall';

/** Whether the Spiral's rules hold for this run and board. */
export const spiralHolds = (run: Pick<RunState, 'runRulesVersion'>, board: Pick<BoardState, 'floorArchetypeId'> | null | undefined): boolean =>
    (run.runRulesVersion ?? 0) >= SPIRAL_RULES_FROM && isSpiralFloor(board);

const ringsOf = (board: BoardState): number[][] => boardRings(board.columns, board.rows, board.tiles.length);

const isGone = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

/**
 * Seals the live ring when it is cleared, and deals fresh pairs into the cleared cells inside it.
 * A ring holding a held seed (`hold-rules.ts`) waits for the release.
 * Returns the board, how many rings sealed, and whether any ring is left.
 */
export const sealSpiralRings = (
    board: BoardState,
    { seed, heldSeedIds = [] }: { seed: string; heldSeedIds?: readonly string[] }
): { board: BoardState; sealed: number; dealtPairs: number; ringsLeft: boolean } => {
    const rings = ringsOf(board);
    const held = new Set(heldSeedIds);
    let tiles = [...board.tiles];
    let sealedCount = runNonNegativeInteger(board.spiralRingsSealed);
    let sealedNow: 0 | 1 = 0;
    // One ring at a time: on an empty board every ring is clear, and the inner ones are dealt again, not sealed.
    const ring = rings[sealedCount];
    if (ring && ring.every((cell) => isGone(tiles[cell]!) && !held.has(tiles[cell]!.id))) {
        for (const cell of ring) tiles[cell] = { ...tiles[cell]!, state: 'removed', sealed: true };
        sealedCount += 1;
        sealedNow = 1;
    }
    if (sealedNow === 0) return { board, sealed: 0, dealtPairs: 0, ringsLeft: sealedCount < rings.length };
    // The new inner ring: fresh pairs into the cells of whole cleared pairs inside, never a held seed's.
    // A pair with a half sealed in the ring keeps both halves: every pair is still two cards, and
    // `matchedPairs` drops by exactly the pairs whose cells were reused (the Warden's deal-again).
    const insideCells = new Set(rings.slice(sealedCount).flat());
    const byPair = new Map<string, number[]>();
    tiles.forEach((tile, index) => {
        // A Sleeper's cards (`sleeper-rules.ts`) are its own until it wakes or the floor ends: never reused.
        if (!isGone(tile) || tile.sealed || tile.sleeper || held.has(tile.id) || isSingletonUtilityPairKey(tile.pairKey)) return;
        byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), index]);
    });
    const reusable = [...byPair.values()].filter((cells) => cells.length === 2 && cells.every((cell) => insideCells.has(cell)));
    const rng = createMulberry32(hashStringToSeed(seed));
    const pairs = reusable.length;
    const faces = freshBoardFaces(tiles, board.level);
    reusable.forEach((cells, slot) => {
        const face = faces[slot] ?? { symbol: `S${slot + 1}`, label: `Spiral ${slot + 1}` };
        const pairKey = `${board.level}-spiral-${sealedCount}-${slot}-${pickRngIndex(rng, 1_000_000)}`;
        const suit = TILE_SUITS[pickRngIndex(rng, TILE_SUITS.length)]!;
        // The two cells trade halves at random, so a pair is not dealt where the old one stood in order.
        const order = pickRngIndex(rng, 2) === 0 ? cells : [cells[1]!, cells[0]!];
        order.forEach((cell, half) => {
            tiles[cell] = { id: `${pairKey}-${half === 0 ? 'A' : 'B'}`, pairKey, state: 'hidden', symbol: face.symbol, label: face.label, atomicVariant: atomicVariantForPairKey(pairKey), suit };
        });
    });
    tiles = [...tiles];
    return {
        board: { ...board, tiles, spiralRingsSealed: sealedCount, matchedPairs: Math.max(0, runNonNegativeInteger(board.matchedPairs) - pairs) },
        sealed: sealedNow,
        dealtPairs: pairs,
        ringsLeft: sealedCount < rings.length
    };
};

/** The floor survived: the Spiral ends, the Hold's stack going with it. */
const survive = (run: RunState, finalize: (run: RunState) => RunState): RunState =>
    finalize({ ...run, spiralSurvived: true, holding: false, heldSeedIds: [] });

/**
 * Applied after every resolved turn on a Spiral: a cleared live ring seals and the inner ring is dealt;
 * at par turns, or with no ring left, the floor is survived. `finalize` is the floor clear
 * (`floor-clear-transition.ts`), passed in so this module stays below it.
 */
export const applySpiralTurn = (before: RunState, after: RunState, finalize: (run: RunState) => RunState): RunState => {
    if (!after.board || !spiralHolds(after, after.board) || after.status !== 'playing') return after;
    if (runNonNegativeInteger(after.turnsThisFloor) === runNonNegativeInteger(before.turnsThisFloor)) return after;
    const sealed = sealSpiralRings(after.board, {
        seed: `spiral:${after.runSeed}:${after.runRulesVersion}:${after.board.level}:${after.turnsThisFloor}`,
        heldSeedIds: after.heldSeedIds
    });
    const next: RunState =
        sealed.sealed > 0
            ? { ...after, board: sealed.board, spiralRingsSealedThisFloor: runNonNegativeInteger(after.spiralRingsSealedThisFloor) + sealed.sealed }
            : after;
    if (!sealed.ringsLeft || runNonNegativeInteger(next.turnsThisFloor) >= parTurnsForRun(next)) return survive(next, finalize);
    return next;
};
