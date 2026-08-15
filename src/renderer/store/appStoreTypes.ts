import type {
    AchievementId,
    MutatorId,
    RelicId,
    RelicOfferServiceId,
    RunState,
    SaveData,
    Settings,
    SubscreenReturnView,
    ViewState
} from '../../shared/contracts';
import type { MetaProgressionUnlockResult } from '../../shared/meta-progression';
import type { DungeonExitActivationSpend } from '../../shared/dungeon-rules';
import type { MatchScorePop, MismatchScorePop } from './matchScorePop';

export interface AppState {
    hydrated: boolean;
    hydrating: boolean;
    steamConnected: boolean;
    view: ViewState;
    settingsReturnView: SubscreenReturnView;
    subscreenReturnView: SubscreenReturnView;
    saveData: SaveData;
    settings: Settings;
    run: RunState | null;
    runStartSaveData: SaveData | null;
    newlyUnlockedAchievements: AchievementId[];
    /** Non-blocking copy when Steam achievement sync fails (local save still applied). */
    achievementBridgeNotice: string | null;
    clearAchievementBridgeNotice: () => void;
    /** Disk / localStorage save failures (autosave or settings write). */
    persistenceWriteNotice: string | null;
    clearPersistenceWriteNotice: () => void;
    /** Save read failures during boot/hydration; blocks autosave so corrupt storage is not overwritten by defaults. */
    saveReadFailureNotice: string | null;
    saveWritesBlockedByReadFailure: boolean;
    clearSaveReadFailureNotice: () => void;
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    peekModeArmed: boolean;
    strayRemoveArmed: boolean;
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    dungeonExitPromptOpen: boolean;
    shopReturnMode: 'floor' | 'summary' | null;
    /** Transient floating +score near matched tiles (Gameplay column). */
    matchScorePop: MatchScorePop | null;
    dismissMatchScorePop: () => void;
    /** Transient miss floater after mismatch resolve (same anchor as match floater). */
    mismatchScorePop: MismatchScorePop | null;
    dismissMismatchScorePop: () => void;
    hydrate: () => Promise<void>;
    startRun: () => void;
    startDungeonShowcaseRun: () => void;
    startDailyRun: () => void;
    startGauntletRun: (durationMs?: number) => void;
    startPuzzleRun: (puzzleId: string) => void;
    startPracticeRun: () => void;
    startScholarContractRun: () => void;
    startMeditationRun: () => void;
    startMeditationRunWithMutators: (mutators: MutatorId[]) => void;
    startPinVowRun: () => void;
    startWildRun: () => void;
    pickRelic: (relicId: RelicId) => void;
    applyRelicOfferService: (serviceId: RelicOfferServiceId, targetRelicId?: RelicId) => void;
    dismissPowersFtue: () => Promise<void>;
    goToMenu: () => void;
    openModeSelect: () => void;
    openCollection: () => void;
    openProfile: () => void;
    openInventoryFromMenu: () => void;
    openCodexFromMenu: () => void;
    openInventoryFromPlaying: () => void;
    openCodexFromPlaying: () => void;
    openShopFromLevelComplete: () => void;
    closeShopToFloorSummary: () => void;
    continueFromShop: () => void;
    closeSubscreen: () => void;
    openSettings: (returnView?: SubscreenReturnView) => void;
    closeSettings: () => void;
    updateSettings: (settings: Settings) => Promise<void>;
    dismissHowToPlay: () => Promise<void>;
    claimMetaProgressionReward: (rowId: string) => MetaProgressionUnlockResult;
    pressTile: (tileId: string) => void;
    closeDungeonExitPrompt: () => void;
    activateDungeonExitFromPrompt: (spend?: DungeonExitActivationSpend) => void;
    togglePeekMode: () => void;
    toggleTileSwapArmed: () => void;
    undoResolvingFlip: () => void;
    toggleStrayArm: () => void;
    shuffleBoard: () => void;
    shuffleRegionRow: (row: number) => void;
    notifyMemorizeBoardReady: (boardKey: string) => void;
    applyFlashPairPower: () => void;
    toggleBoardPinMode: () => void;
    toggleDestroyPairArmed: () => void;
    pause: () => void;
    resume: () => void;
    acceptEndlessRiskWager: () => void;
    purchaseShopOffer: (offerId: string) => void;
    rerollShopOffers: () => void;
    continueToNextLevel: () => void;
    chooseRouteAndContinue: (choiceId: string) => void;
    claimSideRoomPrimary: () => void;
    claimSideRoomChoice: (choiceId: string) => void;
    skipSideRoom: () => void;
    restartRun: () => void;
    endRun: () => void;
    triggerDebugReveal: () => void;
}
