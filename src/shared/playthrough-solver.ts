import type { RunState } from './contracts';
import { activateDungeonExit } from './dungeon-rules';
import { revealDungeonExit } from './dungeon-reveal-rules';
import { flipTile, resolveBoardTurn } from './game';
import {
    getPrimaryPlaythroughExitTile,
    getUnresolvedPlayablePairGroups,
    type PlaythroughSolverTrace
} from './playthrough-solver-rules';
import { repairRunProgressionSoftlocks } from './run-progression-repair';
import { EXIT_PAIR_KEY } from './tile-identity';

export type { PlaythroughSolverStopReason, PlaythroughSolverTrace } from './playthrough-solver-rules';

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
        const pair = getUnresolvedPlayablePairGroups(current.board)[0] ?? null;
        if (!pair) {
            const exit = getPrimaryPlaythroughExitTile(current.board);
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
