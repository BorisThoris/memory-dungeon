import type { BoardState, RunState, SaveData, ViewState } from './contracts';
import { createDefaultSaveData, normalizeSaveData } from './save-data';
import {
    advanceToNextLevel,
    createNewRun,
    createRunSummary,
    finishMemorizePhase,
    openRelicOffer
} from './game-core';
import { flipTile, resolveBoardTurn } from './turn-resolution';
import {
    activateDungeonExit,
    EXIT_PAIR_KEY,
    getDungeonExitStatus,
    revealDungeonExit
} from './dungeon-rules';
import {
    applyRouteChoiceOutcome,
    openRouteSideRoom
} from './route-rules';
import { createRunShopOffers } from './shop-rules';

export type PlayablePathFixtureId =
    | 'freshProfile'
    | 'activeRunWithHazards'
    | 'floorClearWithRouteChoices'
    | 'floorClearWithShop'
    | 'floorClearWithShopLowGold'
    | 'sideRoomPrimary'
    | 'sideRoomChoice'
    | 'sideRoomSkip'
    | 'sideRoomThenShop'
    | 'relicDraft'
    | 'gameOver';

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
    'floorClearWithRouteChoices',
    'floorClearWithShop',
    'floorClearWithShopLowGold',
    'sideRoomPrimary',
    'sideRoomChoice',
    'sideRoomSkip',
    'sideRoomThenShop',
    'relicDraft',
    'gameOver'
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
        case 'floorClearWithRouteChoices':
            return { id, view: 'playing', run: floorClearWithRouteChoices(), saveData, shopReturnMode: null };
        case 'floorClearWithShop':
            return { id, view: 'playing', run: floorClearWithShop(20), saveData, shopReturnMode: null };
        case 'floorClearWithShopLowGold':
            return { id, view: 'playing', run: floorClearWithShop(0), saveData, shopReturnMode: null };
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
    const exitTile = run.board?.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY);
    if (!exitTile || run.status !== 'playing') {
        return run;
    }
    const revealed = revealDungeonExit(run, exitTile.id);
    const exitStatus = getDungeonExitStatus(revealed);
    if (exitStatus.canActivateWithKey) {
        return activateDungeonExit(revealed, 'key');
    }
    if (exitStatus.canActivateWithMasterKey) {
        return activateDungeonExit(revealed, 'master_key');
    }
    return activateDungeonExit(revealed, 'none');
};

const clearPlayableFloor = (run: RunState): RunState => {
    if (!run.board) {
        return run;
    }
    let current = run;
    for (const ids of pairTileIds(run.board)) {
        current = resolveBoardTurn(flipTile(flipTile(current, ids[0]!), ids[1]!));
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

const sideRoomForRoute = (
    routeType: 'safe' | 'greed' | 'mystery',
    options: { withShop?: boolean } = {}
): RunState => {
    const cleared = floorClearWithRouteChoices();
    const choice = cleared.lastLevelResult?.routeChoices?.find((item) => item.routeType === routeType);
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
