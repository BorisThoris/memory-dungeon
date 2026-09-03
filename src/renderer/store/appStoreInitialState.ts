import { createDefaultSaveData } from '../../shared/save-data';
import type { AppState } from './appStoreTypes';
import { BOARD_FLOATER_POP_CLEAR } from './matchScorePop';

type AppStoreInitialState = Pick<
    AppState,
    | 'achievementBridgeNotice'
    | 'boardPinMode'
    | 'destroyPairArmed'
    | 'regionShuffleArmed'
    | 'dungeonExitPromptOpen'
    | 'hydrated'
    | 'hydrating'
    | 'matchScorePop'
    | 'mismatchScorePop'
    | 'newlyUnlockedAchievements'
    | 'peekModeArmed'
    | 'persistenceWriteNotice'
    | 'run'
    | 'runStartSaveData'
    | 'saveData'
    | 'saveReadFailureNotice'
    | 'saveWritesBlockedByReadFailure'
    | 'settings'
    | 'settingsReturnView'
    | 'shopReturnMode'
    | 'steamConnected'
    | 'strayRemoveArmed'
    | 'subscreenReturnView'
    | 'tileSwapArmed'
    | 'tileSwapFirstTileId'
    | 'view'
>;

export const createAppStoreInitialState = (): AppStoreInitialState => {
    const saveData = createDefaultSaveData();
    return {
        hydrated: false,
        hydrating: false,
        steamConnected: false,
        view: 'boot',
        settingsReturnView: 'menu',
        subscreenReturnView: 'menu',
        saveData,
        settings: saveData.settings,
        run: null,
        runStartSaveData: null,
        newlyUnlockedAchievements: [],
        achievementBridgeNotice: null,
        persistenceWriteNotice: null,
        saveReadFailureNotice: null,
        saveWritesBlockedByReadFailure: false,
        boardPinMode: false,
        destroyPairArmed: false,
        peekModeArmed: false,
        strayRemoveArmed: false,
        regionShuffleArmed: false,
        tileSwapArmed: false,
        tileSwapFirstTileId: null,
        dungeonExitPromptOpen: false,
        shopReturnMode: null,
        ...BOARD_FLOATER_POP_CLEAR
    };
};
