import { createDefaultSaveData } from '../../shared/save-data';
import type { AppState } from './appStoreTypes';
import { BOARD_FLOATER_POP_CLEAR } from './matchScorePop';

type AppStoreInitialState = Pick<
    AppState,
    | 'achievementBridgeNotice'
    | 'boardPinMode'
    | 'regionShuffleArmed'
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
    | 'priorCrashNotice'
    | 'saveReadFailureNotice'
    | 'saveWritesBlockedByReadFailure'
    | 'settings'
    | 'settingsReturnView'
    | 'steamConnected'
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
        priorCrashNotice: null,
        saveReadFailureNotice: null,
        saveWritesBlockedByReadFailure: false,
        boardPinMode: false,
        peekModeArmed: false,
        regionShuffleArmed: false,
        tileSwapArmed: false,
        tileSwapFirstTileId: null,
        ...BOARD_FLOATER_POP_CLEAR
    };
};
