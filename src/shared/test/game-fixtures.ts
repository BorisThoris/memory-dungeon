import type { BoardState, RunState, Tile } from '../contracts';
import { countFindablePairs } from '../board-generation';
import { createNewRun, finishMemorizePhase } from '../game-core';
import { isSingletonUtilityPairKey } from '../tile-identity';
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

/*
 * A bare run: this floor's tiles, and nothing the floor schedule would otherwise add.
 *
 * The fixture used to ask for `gameMode: 'puzzle'`, whose only job here was to switch off two
 * things a unit asserting one score term should not also be asserting: the endless floor schedule
 * (whatever mutator floor one happened to draw) and the recall focus every real run starts with
 * (a flat `RECALL_FOCUS_MATCH_SCORE` on every match). With one mode left, the fixture says both
 * directly, the same way it already says `echoFeedbackEnabled: false`. A test that wants either
 * one passes it in `overrides` — `Recall Focus memory loop` in `game.test.ts` does exactly that.
 */
export const makeRun = (tiles: Tile[], overrides: Partial<RunState> = {}): RunState => ({
    ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
    activeMutators: [],
    recallFocus: 0,
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
        if (isSingletonUtilityPairKey(tile.pairKey) || tile.state !== 'hidden') {
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
