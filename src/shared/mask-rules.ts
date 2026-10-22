import { DEPTH_MASKS_FROM, DEPTH_FAMILY_COUNT, depthHas } from './depth-rules';
import { preferredDrawIndex } from './learned-rule-rules';
import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { isRealmHeld } from './odd-card-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * Masks (DGE-016, rules 80): backs that lie until first flipped.
 *
 * From the Deep (floor 25), a few cards a floor wear a **mask**: their back shows an element that is
 * not theirs. The first time a masked card is turned the mask drops, and its back tells the truth for
 * the rest of the floor. Only one card of a pair is ever masked, so every pair keeps one honest back
 * to be found by. A masked card is its true element to every rule - its cast, its pop, a reaction -
 * and the lie lives only in what the player is shown (`player-visible-board.ts`), as a Turncoat's
 * dealt element does. The Unmasking Glass (`relic-evolution-rules.ts`) drops every mask as the floor
 * is dealt.
 *
 * The plan priced Masks at 6 on a Dread table; that table was never built (card families are dealt by
 * floor, as the Wanderers are), so the price is a count: two masks a floor from the Deep, three from
 * floor 33.
 */
export const MASK_RULES_FROM = 80;
export const MASK_FROM_FLOOR = 25;
export const MASK_THIRD_FLOOR = 33;
/** A floor this small has no pair to spare for a lie. */
export const MASK_MIN_PAIRS = 8;

export const masksForFloor = (level: number): number => (level >= MASK_THIRD_FLOOR ? 3 : level >= MASK_FROM_FLOOR ? 2 : 0);

const isPlainPair = (pair: readonly Tile[]): boolean =>
    pair.length === 2 &&
    pair.every((tile) => tile.state === 'hidden' && tile.suit != null && tile.turncoat == null && tile.mask == null && !isRealmHeld(tile));

/** Deals the floor's masks: one card of each chosen pair wears an element the floor holds that is not its own. */
export const dealMasks = (
    board: BoardState,
    { runSeed, rulesVersion, preferSuit = null, depth = 0 }: { runSeed: number; rulesVersion: number; preferSuit?: TileSuit | null; depth?: number }
): BoardState => {
    // Depth (`depth-rules.ts`): two from an earlier floor.
    const wanted = masksForFloor(board.level)
        || (depthHas({ depth }, 'masks_early') && board.level >= DEPTH_MASKS_FROM ? 2 : 0);
    // Depth 17: three wherever there are any.
    const dealt = wanted > 0 && depthHas({ depth }, 'masks_three') ? Math.max(wanted, DEPTH_FAMILY_COUNT) : wanted;
    if (rulesVersion < MASK_RULES_FROM || dealt === 0 || board.pairCount < MASK_MIN_PAIRS) return board;
    const halves = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), tile]);
    }
    const suits = [...new Set(board.tiles.flatMap((tile) => (tile.suit ? [tile.suit] : [])))].sort();
    if (suits.length < 2) return board;
    const pool = [...halves.entries()].filter(([, pair]) => isPlainPair(pair)).map(([pairKey]) => pairKey);
    const rng = createMulberry32(hashStringToSeed(`masks:${runSeed}:${rulesVersion}:${board.level}`));
    const masks = new Map<string, TileSuit>();
    while (masks.size < dealt && pool.length > 0) {
        // A learned rule (`learned-rule-rules.ts`) draws from its element's pairs first.
        const [pairKey] = pool.splice(preferredDrawIndex(pool, rng, preferSuit ? (key) => halves.get(key)?.[0]?.suit === preferSuit : null), 1);
        const pair = pairKey ? halves.get(pairKey) : undefined;
        if (!pair) continue;
        const card = pair[pickRngIndex(rng, 2)]!;
        const others = suits.filter((suit) => suit !== card.suit);
        masks.set(card.id, others[pickRngIndex(rng, others.length)]!);
    }
    if (masks.size === 0) return board;
    return { ...board, tiles: board.tiles.map((tile) => (masks.has(tile.id) ? { ...tile, mask: masks.get(tile.id)! } : tile)) };
};

/** Every mask gone: the Unmasking Glass's study window. */
export const unmaskBoard = (board: BoardState): BoardState =>
    board.tiles.some((tile) => tile.mask != null) ? { ...board, tiles: board.tiles.map(dropMask) } : board;

/** A card's mask dropped. */
export const dropMask = (tile: Tile): Tile => {
    if (tile.mask == null) return tile;
    const { mask: _mask, ...rest } = tile;
    return rest;
};

/** The first flip of a masked card drops its mask, and the floor counts it. */
export const unmaskOnFlip = (run: RunState, tile: Tile): RunState =>
    tile.mask == null ? run : { ...run, masksDroppedThisFloor: runNonNegativeInteger(run.masksDroppedThisFloor) + 1 };

