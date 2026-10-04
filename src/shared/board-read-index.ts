import type { BoardState, Tile } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';

interface BoardReadIndex { positions: ReadonlyMap<string, number>; fullyHiddenPairs: number }
const indices = new WeakMap<readonly Tile[], BoardReadIndex>();

/** Large-board reducers replace the tiles array on every move; reads share its immutable index. */
export function getBoardReadIndex(board: BoardState): BoardReadIndex {
    const cached = indices.get(board.tiles);
    if (cached) return cached;
    const positions = new Map<string, number>();
    const hiddenCounts = new Map<string, number>();
    board.tiles.forEach((tile, index) => {
        positions.set(tile.id, index);
        if (tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey))
            hiddenCounts.set(tile.pairKey, (hiddenCounts.get(tile.pairKey) ?? 0) + 1);
    });
    const result = { positions, fullyHiddenPairs: [...hiddenCounts.values()].filter(count => count >= 2).length };
    indices.set(board.tiles, result);
    return result;
}

export const boardTileIndex = (board: BoardState, id: string): number => board.tiles.length > 48
    ? getBoardReadIndex(board).positions.get(id) ?? -1
    : board.tiles.findIndex(tile => tile.id === id);
