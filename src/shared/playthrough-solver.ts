import type { BoardState, RunState, Tile } from './contracts';
import { activateDungeonExit } from './dungeon-rules';
import { revealDungeonExit } from './dungeon-reveal-rules';
import { flipTile, resolveBoardTurn } from './game';
import { repairRunProgressionSoftlocks } from './run-progression-repair';
import { DECOY_PAIR_KEY, EXIT_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';

export type PlaythroughSolverStopReason =
    | 'missing_board'
    | 'terminal_status'
    | 'level_complete'
    | 'no_exit'
    | 'exit_attempted'
    | 'missing_pair_tile'
    | 'no_progress'
    | 'turn_guard';

export interface PlaythroughSolverTrace {
    run: RunState;
    stopReason: PlaythroughSolverStopReason;
    turns: number;
    lastPairKey: string | null;
    lastTileIds: string[];
}

const unresolvedPlayablePairGroups = (board: BoardState): Tile[][] => {
    const groups = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (
            tile.state === 'matched' ||
            tile.state === 'removed' ||
            tile.dungeonCardState === 'resolved' ||
            isSingletonUtilityPairKey(tile.pairKey) ||
            tile.pairKey === DECOY_PAIR_KEY
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

export const solveRunByExhaustingPlayablePairsWithTrace = (run: RunState, maxTurns = 160): PlaythroughSolverTrace => {
    let current = run;
    for (let guard = 0; guard < maxTurns; guard += 1) {
        if (!current.board) {
            return { run: current, stopReason: 'missing_board', turns: guard, lastPairKey: null, lastTileIds: [] };
        }
        if (current.status === 'levelComplete') {
            return {
                run: repairRunProgressionSoftlocks(current),
                stopReason: 'level_complete',
                turns: guard,
                lastPairKey: null,
                lastTileIds: []
            };
        }
        if (current.status === 'gameOver') {
            return { run: current, stopReason: 'terminal_status', turns: guard, lastPairKey: null, lastTileIds: [] };
        }
        const pair = unresolvedPlayablePairGroups(current.board)[0] ?? null;
        if (!pair) {
            const exit = current.board.dungeonExitTileId
                ? current.board.tiles.find((tile) => tile.id === current.board?.dungeonExitTileId)
                : current.board.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY);
            if (!exit) {
                return { run: current, stopReason: 'no_exit', turns: guard, lastPairKey: null, lastTileIds: [] };
            }
            const revealed = exit.state === 'hidden' ? revealDungeonExit(current, exit.id) : current;
            const activated = activateDungeonExit(revealed);
            return {
                run: repairRunProgressionSoftlocks(activated),
                stopReason: 'exit_attempted',
                turns: guard,
                lastPairKey: EXIT_PAIR_KEY,
                lastTileIds: [exit.id]
            };
        }

        const [first, second] = pair;
        if (!first || !second) {
            return {
                run: current,
                stopReason: 'missing_pair_tile',
                turns: guard,
                lastPairKey: pair[0]?.pairKey ?? null,
                lastTileIds: pair.map((tile) => tile.id)
            };
        }
        const afterFirst = first.state === 'hidden' ? flipTile(current, first.id) : current;
        const afterSecond = second.state === 'hidden' ? flipTile(afterFirst, second.id) : afterFirst;
        if (afterSecond === current) {
            const resolved = resolveBoardTurn(current);
            if (resolved !== current) {
                current = resolved;
                continue;
            }
            return {
                run: current,
                stopReason: 'no_progress',
                turns: guard,
                lastPairKey: first.pairKey,
                lastTileIds: [first.id, second.id]
            };
        }
        current = resolveBoardTurn(afterSecond);
    }

    return {
        run: repairRunProgressionSoftlocks(current),
        stopReason: 'turn_guard',
        turns: maxTurns,
        lastPairKey: null,
        lastTileIds: []
    };
};

export const solveRunByExhaustingPlayablePairs = (run: RunState, maxTurns = 160): RunState =>
    solveRunByExhaustingPlayablePairsWithTrace(run, maxTurns).run;
