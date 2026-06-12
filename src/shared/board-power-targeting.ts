import type {
    BoardState,
    RouteSpecialKind
} from './contracts';
import {
    DECOY_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
    WILD_PAIR_KEY
} from './tile-identity';

export const STRAY_PROTECTED_ROUTE_SPECIALS = new Set<RouteSpecialKind>([
    'keystone_pair',
    'final_ward',
    'omen_seal'
]);

export const PEEK_REVEALED_ROUTE_SPECIALS = new Set<RouteSpecialKind>([
    'mystery_veil',
    'secret_door',
    'omen_seal',
    'mimic_cache',
    'loaded_gateway',
    'parasite_vessel'
]);

/**
 * Board-only checks for destroy targeting (mirrors `canDestroyPair` tile rules).
 * Caller gates run status, charges, contract `noDestroy`, armed state, and flipped tiles.
 */
export const tileIsDestroyEligiblePreview = (board: BoardState, tileId: string): boolean => {
    const tile = board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden' || tile.pairKey === DECOY_PAIR_KEY) {
        return false;
    }
    const pairTiles = board.tiles.filter((t) => t.pairKey === tile.pairKey);
    return pairTiles.length === 2 && pairTiles.every((t) => t.state === 'hidden');
};

/** All tile ids that are valid destroy targets when run rules would allow destroy (fully hidden real pairs). */
export const collectDestroyEligibleTileIds = (board: BoardState): Set<string> => {
    const eligible = new Set<string>();
    for (const tile of board.tiles) {
        if (tileIsDestroyEligiblePreview(board, tile.id)) {
            eligible.add(tile.id);
        }
    }
    return eligible;
};

/** Peek can target any still-hidden tile that has not already been peek-revealed this floor. */
export const tileIsPeekEligiblePreview = (
    board: BoardState,
    peekRevealedTileIds: readonly string[],
    tileId: string
): boolean => {
    const tile = board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return false;
    }
    return !peekRevealedTileIds.includes(tileId);
};

export const collectPeekEligibleTileIds = (
    board: BoardState,
    peekRevealedTileIds: readonly string[]
): Set<string> => {
    const eligible = new Set<string>();
    for (const tile of board.tiles) {
        if (tileIsPeekEligiblePreview(board, peekRevealedTileIds, tile.id)) {
            eligible.add(tile.id);
        }
    }
    return eligible;
};

export const isCompletionSafeStrayPairKey = (pairKey: string): boolean =>
    pairKey === WILD_PAIR_KEY || pairKey === SHOP_PAIR_KEY || pairKey === ROOM_PAIR_KEY;

export const tileIsCompletionSafeStrayTarget = (board: BoardState, tileId: string): boolean => {
    const tile = board.tiles.find((t) => t.id === tileId);
    return Boolean(
        tile &&
            tile.state === 'hidden' &&
            tile.pairKey !== DECOY_PAIR_KEY &&
            isCompletionSafeStrayPairKey(tile.pairKey) &&
            (!tile.routeSpecialKind || !STRAY_PROTECTED_ROUTE_SPECIALS.has(tile.routeSpecialKind))
    );
};

/** Stray remove targets hidden completion-safe singleton/special tiles (mirrors `applyStrayRemove`). */
export const tileIsStrayEligiblePreview = (board: BoardState, tileId: string): boolean => {
    return tileIsCompletionSafeStrayTarget(board, tileId);
};
