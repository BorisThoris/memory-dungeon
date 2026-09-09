import type { BoardState, RunState, Tile } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';

export type PlaythroughSolverStopReason =
    | 'missing_board'
    | 'terminal_status'
    | 'level_complete'
    | 'no_exit'
    | 'missing_pair_tile'
    | 'no_progress'
    | 'risk_budget_exhausted'
    | 'turn_guard';

export interface PlaythroughSolverTrace {
    run: RunState;
    stopReason: PlaythroughSolverStopReason;
    turns: number;
    lastPairKey: string | null;
    lastTileIds: string[];
}

export const getUnresolvedPlayablePairGroups = (board: BoardState): Tile[][] => {
    const groups = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (
            tile.state === 'matched' ||
            tile.state === 'removed' ||
            isSingletonUtilityPairKey(tile.pairKey)
        ) {
            continue;
        }
        const group = groups.get(tile.pairKey) ?? [];
        group.push(tile);
        groups.set(tile.pairKey, group);
    }
    return [...groups.values()]
        .filter((group) => group.length >= 2)
        .sort((left, right) => {
            const leftHasExposed = left.some((tile) => tile.state !== 'hidden') ? 0 : 1;
            const rightHasExposed = right.some((tile) => tile.state !== 'hidden') ? 0 : 1;
            return leftHasExposed - rightHasExposed;
        });
};
