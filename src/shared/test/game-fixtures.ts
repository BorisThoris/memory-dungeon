import type { BoardState, RunState, Tile } from '../contracts';
import { countFindablePairs } from '../board-generation';
import { createNewRun, finishMemorizePhase } from '../game-core';
import {
    activateDungeonExit,
    EXIT_PAIR_KEY,
    revealDungeonExit
} from '../dungeon-rules';
import { flipTile, resolveBoardTurn } from '../turn-resolution';

export const makeTile = (id: string, pairKey: string, symbol: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    state: 'hidden',
    symbol,
    label: symbol,
    ...overrides
});

export const makePair = (pairKey: string, symbol: string, prefix = pairKey): [Tile, Tile] => [
    makeTile(`${prefix}-a`, pairKey, symbol),
    makeTile(`${prefix}-b`, pairKey, symbol)
];

export const makeBoard = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    level: 1,
    pairCount: tiles.length / 2,
    columns: 2,
    rows: Math.ceil(tiles.length / 2),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null,
    ...overrides
});

export const makeRun = (tiles: Tile[], overrides: Partial<RunState> = {}): RunState => ({
    ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' })),
    board: makeBoard(tiles),
    findablesTotalThisFloor: countFindablePairs(tiles),
    ...overrides
});

export const playPair = (run: RunState, firstId: string, secondId: string): RunState =>
    resolveBoardTurn(flipTile(flipTile(run, firstId), secondId));

export const playPerfectFloor = (run: RunState): RunState => {
    let current = run;
    const groups = new Map<string, string[]>();
    for (const tile of current.board?.tiles ?? []) {
        if (tile.pairKey === EXIT_PAIR_KEY || tile.state !== 'hidden') {
            continue;
        }
        groups.set(tile.pairKey, [...(groups.get(tile.pairKey) ?? []), tile.id]);
    }
    for (const ids of groups.values()) {
        const [firstId, secondId] = ids;
        if (firstId && secondId && ids.length === 2) {
            current = playPair(current, firstId, secondId);
        }
    }
    return current;
};

export const revealAndActivateExit = (run: RunState): RunState => {
    const exitTile = run.board?.dungeonExitTileId
        ? run.board.tiles.find((tile) => tile.id === run.board?.dungeonExitTileId)
        : run.board?.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY);
    if (!exitTile || run.status !== 'playing') {
        return run;
    }
    const revealed = revealDungeonExit(run, exitTile.id);
    return activateDungeonExit(revealed);
};
