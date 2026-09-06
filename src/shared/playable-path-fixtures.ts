import {
    GAME_RULES_VERSION,
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
    finishMemorizePhase,
    openRelicOffer
} from './game-core';
import { buildBoard } from './game';
import { flipTile, resolveBoardTurn } from './turn-resolution';
import {
    activateDungeonExit,
    EXIT_PAIR_KEY,
    revealDungeonExit
} from './dungeon-rules';
import {
    applyRouteChoiceOutcome,
    openRouteSideRoom,
    routeChoicesForResult
} from './route-rules';
import { createRunShopOffers } from './shop-rules';

export type PlayablePathFixtureId =
    | 'freshProfile'
    | 'activeRunWithHazards'
    | 'activeRunWithPickupCashout'
    | 'activeRunWithTraitRouteSetup'
    | 'activeRunWithTrapCard'
    | 'floorClearWithRouteChoices'
    | 'floorClearWithShop'
    | 'floorClearWithShopLowGold'
    | 'inFloorShop'
    | 'sideRoomPrimary'
    | 'sideRoomChoice'
    | 'sideRoomSkip'
    | 'sideRoomThenShop'
    | 'relicDraft'
    | 'gameOver'
    | 'cascadeClump';

export interface PlayablePathFixtureState {
    id: PlayablePathFixtureId;
    view: ViewState;
    run: RunState | null;
    saveData: SaveData;
    shopReturnMode?: 'floor' | 'summary' | null;
}

export interface PlayablePathFixtureOptions {
    bestScore?: number;
}

const PLAYABLE_PATH_SEED = 172_501;
const HAZARD_PATH_SEED = 81_004;

export const PLAYABLE_PATH_FIXTURE_IDS: readonly PlayablePathFixtureId[] = [
    'freshProfile',
    'activeRunWithHazards',
    'activeRunWithPickupCashout',
    'activeRunWithTraitRouteSetup',
    'activeRunWithTrapCard',
    'floorClearWithRouteChoices',
    'floorClearWithShop',
    'floorClearWithShopLowGold',
    'inFloorShop',
    'sideRoomPrimary',
    'sideRoomChoice',
    'sideRoomSkip',
    'sideRoomThenShop',
    'relicDraft',
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
            return { id, view: 'menu', run: null, saveData: createDefaultSaveData(), shopReturnMode: null };
        case 'activeRunWithHazards':
            return {
                id,
                view: 'playing',
                run: {
                    ...finishMemorizePhase(
                        createNewRun(0, {
                            echoFeedbackEnabled: false,
                            gameMode: 'endless',
                            runSeed: HAZARD_PATH_SEED
                        })
                    ),
                    findablesClaimedThisFloor: 1,
                    hazardTileTriggersThisFloor: 1,
                    safeHazardWardsUsedThisFloor: 1,
                    safeHazardWardChargesThisFloor: 1,
                    shopGold: 2
                },
                saveData,
                shopReturnMode: null
            };
        case 'activeRunWithPickupCashout':
            return { id, view: 'playing', run: activeRunWithPickupCashout(), saveData, shopReturnMode: null };
        case 'activeRunWithTraitRouteSetup':
            return { id, view: 'playing', run: activeRunWithTraitRouteSetup(), saveData, shopReturnMode: null };
        case 'activeRunWithTrapCard':
            return { id, view: 'playing', run: activeRunWithTrapCard(), saveData, shopReturnMode: null };
        case 'floorClearWithRouteChoices':
            return { id, view: 'playing', run: floorClearWithRouteChoices(), saveData, shopReturnMode: null };
        case 'floorClearWithShop':
            return { id, view: 'playing', run: floorClearWithShop(20), saveData, shopReturnMode: null };
        case 'floorClearWithShopLowGold':
            return { id, view: 'playing', run: floorClearWithShop(0), saveData, shopReturnMode: null };
        case 'inFloorShop':
            /*
             * The vendor as a player meets it mid-floor, by flipping a shop tile — a different
             * screen from the one the floor-clear shop shows, with its own exit and its own copy.
             * Nothing reached it, which is how it shipped with two buttons that did the same thing
             * and a reachability gate that reported green.
             */
            return { id, view: 'shop', run: inFloorShopRun(), saveData, shopReturnMode: 'floor' };
        case 'sideRoomPrimary':
            return { id, view: 'sideRoom', run: sideRoomForRoute('safe'), saveData, shopReturnMode: null };
        case 'sideRoomChoice':
            return { id, view: 'sideRoom', run: sideRoomForRoute('mystery'), saveData, shopReturnMode: null };
        case 'sideRoomSkip':
            return { id, view: 'sideRoom', run: sideRoomForRoute('greed'), saveData, shopReturnMode: null };
        case 'sideRoomThenShop':
            return { id, view: 'sideRoom', run: sideRoomForRoute('safe', { withShop: true }), saveData, shopReturnMode: null };
        case 'relicDraft':
            return { id, view: 'playing', run: relicDraftRun(), saveData, shopReturnMode: null };
        case 'gameOver':
            return { id, view: 'gameOver', run: gameOverRun(), saveData, shopReturnMode: null };
        case 'cascadeClump':
            return { id, view: 'playing', run: cascadeClumpRun(), saveData, shopReturnMode: null };
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

const activeRunWithTraitRouteSetup = (): RunState => {
    const base = finishMemorizePhase(
        createNewRun(0, {
            echoFeedbackEnabled: false,
            gameMode: 'endless',
            runSeed: 172_651
        })
    );
    const board: BoardState = {
        ...base.board!,
        columns: 3,
        rows: 3,
        pairCount: 4,
        matchedPairs: 0,
        flippedTileIds: [],
        tiles: [
            { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' },
            { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
            { id: 'f2', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
            { id: 'o1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
            { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' },
            { id: 'o2', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
            { id: 's2', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden' },
            { id: 'h2', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden' }
        ]
    };
    return {
        ...base,
        board,
        findablesTotalThisFloor: 0,
        matchResolutionsThisFloor: 1,
        regionShuffleCharges: 1,
        rewardPerkIds: ['free_first_swap_per_floor', 'trait_streak_toolkit'],
        shuffleCharges: 0,
        stats: {
            ...base.stats,
            currentStreak: 2
        }
    };
};

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
        // No exit on this board: the floor ends when the last pair goes, the way a classic board does.
        // The generated board's exit id would otherwise wait forever for a tile that is not there.
        dungeonExitTileId: null,
        dungeonExitActivated: false,
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

const activeRunWithTrapCard = (): RunState => {
    const base = finishMemorizePhase(
        createNewRun(0, {
            echoFeedbackEnabled: false,
            gameMode: 'endless',
            runSeed: 172_601
        })
    );
    const board = buildBoard(5, {
        activeMutators: base.activeMutators,
        dungeonNodeKind: 'trap',
        gameMode: 'endless',
        runRulesVersion: GAME_RULES_VERSION,
        runSeed: 172_601
    });
    return {
        ...base,
        board,
        findablesTotalThisFloor: board.tiles.filter((tile) => tile.findableKind != null).length
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

const leaveThroughExit = (run: RunState): RunState => {
    const exitTile = run.board?.dungeonExitTileId
        ? run.board.tiles.find((tile) => tile.id === run.board?.dungeonExitTileId)
        : run.board?.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY);
    if (!exitTile || run.status !== 'playing') {
        return run;
    }
    const revealed = revealDungeonExit(run, exitTile.id);
    return activateDungeonExit(revealed);
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
    return leaveThroughExit(current);
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

const floorClearWithRouteChoices = (): RunState => ({
    ...playPerfectFloors(baseEndlessRun(), 1),
    pendingRouteCardPlan: null,
    sideRoom: null
});

const floorClearWithShop = (shopGold: number): RunState => {
    const cleared = floorClearWithRouteChoices();
    const stockedRun = {
        ...cleared,
        shopGold,
        lives: cleared.lives,
        lastLevelResult: cleared.lastLevelResult
            ? { ...cleared.lastLevelResult, routeChoices: undefined }
            : cleared.lastLevelResult
    };
    return { ...stockedRun, shopOffers: createRunShopOffers(stockedRun) };
};

/** A run still on its floor, standing at a vendor it opened from the board. */
const inFloorShopRun = (): RunState => {
    const base = activeRunWithTrapCard();
    const stocked = { ...base, shopGold: 12 };
    return { ...stocked, shopOffers: createRunShopOffers(stocked) };
};

const sideRoomForRoute = (
    routeType: 'safe' | 'greed' | 'mystery',
    options: { withShop?: boolean } = {}
): RunState => {
    const cleared = floorClearWithRouteChoices();
    const choice = routeChoicesForResult(cleared.lastLevelResult).find((item) => item.routeType === routeType);
    if (!choice) {
        throw new Error(`Missing ${routeType} route choice in playable-path fixture.`);
    }
    const sourceRun = routeType === 'safe' ? { ...cleared, lives: 3 } : cleared;
    const chosen = applyRouteChoiceOutcome(sourceRun, choice.id);
    if (!chosen.applied) {
        throw new Error(`Could not apply ${routeType} route choice in playable-path fixture: ${chosen.reason}`);
    }
    const opened = openRouteSideRoom(chosen.run);
    if (!opened.sideRoom) {
        throw new Error(`Missing ${routeType} side room in playable-path fixture.`);
    }
    if (!options.withShop) {
        return opened;
    }
    const shopReady = { ...opened, shopGold: 20 };
    return { ...shopReady, shopOffers: createRunShopOffers(shopReady) };
};

const relicDraftRun = (): RunState => {
    const cleared = playPerfectFloors(baseEndlessRun(), 3);
    return openRelicOffer({ ...cleared, relicFavorProgress: 0 });
};

const gameOverRun = (): RunState => {
    const run = finishMemorizePhase(baseEndlessRun());
    return createRunSummary({ ...run, status: 'gameOver', lives: 0 }, []);
};

const assertNever = (value: never): never => {
    throw new Error(`Unhandled playable-path fixture id: ${value}`);
};
