import {
    MAX_COMBO_SHARDS,
    MAX_LIVES,
    type BoardState,
    type RunState,
    type SaveData,
    type Tile,
    type TileSuit,
    type ViewState
} from './contracts';
import { createDefaultSaveData, normalizeSaveData } from './save-data';
import {
    advanceToNextLevel,
    createNewRun,
    createRunSummary,
    finishMemorizePhase
} from './game-core';
import { flipTile, resolveBoardTurn } from './turn-resolution';

export type PlayablePathFixtureId =
    | 'freshProfile'
    | 'activeRunWithPickupCashout'
    | 'floorClearWithRouteChoices'
    | 'gameOver'
    | 'cascadeClump';

export interface PlayablePathFixtureState {
    id: PlayablePathFixtureId;
    view: ViewState;
    run: RunState | null;
    saveData: SaveData;
}

export interface PlayablePathFixtureOptions {
    bestScore?: number;
}

const PLAYABLE_PATH_SEED = 172_501;

export const PLAYABLE_PATH_FIXTURE_IDS: readonly PlayablePathFixtureId[] = [
    'freshProfile',
    'activeRunWithPickupCashout',
    'floorClearWithRouteChoices',
    'gameOver',
    'cascadeClump'
] as const;

export const createPlayablePathFixture = (
    id: PlayablePathFixtureId,
    options: PlayablePathFixtureOptions = {}
): PlayablePathFixtureState => {
    const saveData = createFixtureSaveData(options.bestScore);

    switch (id) {
        case 'freshProfile':
            return { id, view: 'menu', run: null, saveData: createDefaultSaveData() };
        case 'activeRunWithPickupCashout':
            return { id, view: 'playing', run: activeRunWithPickupCashout(), saveData };
        case 'floorClearWithRouteChoices':
            return { id, view: 'playing', run: floorClearWithRouteChoices(), saveData };
        case 'gameOver':
            return { id, view: 'gameOver', run: gameOverRun(), saveData };
        case 'cascadeClump':
            return { id, view: 'playing', run: cascadeClumpRun(), saveData };
        default:
            return assertNever(id);
    }
};

const createFixtureSaveData = (bestScore = 1250): SaveData =>
    normalizeSaveData({
        ...createDefaultSaveData(),
        bestScore,
        onboardingDismissed: true
    });

const baseEndlessRun = (): RunState =>
    createNewRun(0, {
        echoFeedbackEnabled: false,
        gameMode: 'endless',
        runSeed: PLAYABLE_PATH_SEED
    });

/**
 * A board built to be chained: twelve plain pairs in three suit columns, each pair side by side.
 * Matching row by row climbs the ladder on its own — Clean on the third pair, Sharp once the
 * first break adds momentum, Fever before the fourth row — so an end-to-end pass can watch the
 * clump go, the halo take its neighbours and the floor clear, on a board nothing random shaped.
 */
const cascadeClumpRun = (): RunState => {
    const base = finishMemorizePhase(
        createNewRun(0, {
            echoFeedbackEnabled: false,
            gameMode: 'endless',
            runSeed: 172_721
        })
    );
    const suits: TileSuit[] = ['ember', 'tide', 'moss'];
    const tiles: Tile[] = [];
    for (let row = 0; row < 4; row += 1) {
        suits.forEach((suit, column) => {
            const key = `${suit.slice(0, 2)}${row + 1}`;
            const symbol = String(row * 3 + column + 1).padStart(2, '0');
            tiles.push(
                { id: `${key}-A`, pairKey: key, symbol, label: symbol, state: 'hidden', suit },
                { id: `${key}-B`, pairKey: key, symbol, label: symbol, state: 'hidden', suit }
            );
        });
    }
    const board: BoardState = {
        ...base.board!,
        columns: 6,
        rows: 4,
        pairCount: 12,
        matchedPairs: 0,
        flippedTileIds: [],
        cursedPairKey: null,
        tiles
    };
    return {
        ...base,
        board,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: 0,
        chunkBreaksThisFloor: 0,
        chunkPairsBrokenThisFloor: 0,
        chunkScoreThisFloor: 0,
        chunkPairsThisChain: 0,
        turnsThisFloor: 0,
        largestChunkScoreThisFloor: 0,
        stats: {
            ...base.stats,
            currentStreak: 0
        }
    };
};

const activeRunWithPickupCashout = (): RunState => {
    const base = finishMemorizePhase(
        createNewRun(0, {
            echoFeedbackEnabled: false,
            gameMode: 'endless',
            runSeed: 172_671
        })
    );
    const board: BoardState = {
        ...base.board!,
        columns: 2,
        rows: 2,
        pairCount: 2,
        matchedPairs: 0,
        flippedTileIds: [],
        tiles: [
            { id: 'p1', pairKey: 'pickup', symbol: 'P', label: 'Pickup', state: 'hidden', findableKind: 'shard_spark' },
            { id: 'p2', pairKey: 'pickup', symbol: 'P', label: 'Pickup', state: 'hidden', findableKind: 'shard_spark' },
            { id: 'a1', pairKey: 'anchor', symbol: 'A', label: 'Anchor', state: 'hidden' },
            { id: 'a2', pairKey: 'anchor', symbol: 'A', label: 'Anchor', state: 'hidden' }
        ]
    };
    return {
        ...base,
        board,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: 1,
        lives: MAX_LIVES,
        stats: {
            ...base.stats,
            comboShards: MAX_COMBO_SHARDS,
            currentStreak: 0
        }
    };
};

const pairTileIds = (board: BoardState): string[][] => {
    const groups = new Map<string, string[]>();
    for (const tile of board.tiles) {
        if (!groups.has(tile.pairKey)) {
            groups.set(tile.pairKey, []);
        }
        groups.get(tile.pairKey)!.push(tile.id);
    }
    return [...groups.values()].filter((group) => group.length === 2);
};

const clearPlayableFloor = (run: RunState): RunState => {
    if (!run.board) {
        return run;
    }
    let current = run;
    for (const ids of pairTileIds(run.board)) {
        const [firstId, secondId] = ids;
        if (firstId && secondId) {
            current = resolveBoardTurn(flipTile(flipTile(current, firstId), secondId));
        }
    }
    return current;
};

const playPerfectFloors = (run: RunState, count: number): RunState => {
    let current = finishMemorizePhase(run);
    for (let floor = 0; floor < count; floor += 1) {
        current = clearPlayableFloor(current);
        if (floor < count - 1) {
            current = finishMemorizePhase(advanceToNextLevel(current));
        }
    }
    return current;
};

/*
 * The floor-clear interlude. It kept its fixture id from when it offered three routes, because the
 * e2e surface map and the reachability gate key on that id; what it shows now is a cleared floor
 * with one way forward. The four side-room fixtures that used to grow out of it are gone with the
 * rooms (Gen 173).
 */
const floorClearWithRouteChoices = (): RunState => playPerfectFloors(baseEndlessRun(), 1);

const gameOverRun = (): RunState => {
    const run = finishMemorizePhase(baseEndlessRun());
    return createRunSummary({ ...run, status: 'gameOver', lives: 0 }, []);
};

const assertNever = (value: never): never => {
    throw new Error(`Unhandled playable-path fixture id: ${value}`);
};
