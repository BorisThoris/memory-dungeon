import { create } from 'zustand/react';
import type {
    AchievementId,
    AchievementUnlockResult,
    MutatorId,
    RelicId,
    RelicOfferServiceId,
    RunState,
    SaveData,
    Settings,
    SubscreenReturnView,
    ViewState
} from '../../shared/contracts';
import {
    isGauntletExpired,
} from '../../shared/game-core';
import {
    cancelResolvingWithUndo,
} from '../../shared/board-powers';
import {
    claimRouteSideRoomChoice,
    claimRouteSideRoomPrimary,
    skipRouteSideRoom
} from '../../shared/route-rules';
import {
    activateDungeonExit,
    type DungeonExitActivationSpend
} from '../../shared/dungeon-rules';
import { trackEvent } from '../../shared/telemetry';
import { executeRunStartRequest } from './runStartExecutor';
import type { RunStartRequest } from './runStartState';
import { createSideRoomActionController } from './sideRoomActionController';
import {
    type MetaOverlayReturnPointer
} from './metaOverlayState';
import {
    executeMetaOverlayClose,
    executeMetaOverlayOpen
} from './metaOverlayExecutor';
import {
    createShopPurchaseSurfaceResult,
    createShopRerollSurfaceResult
} from './shopSurfaceState';
import { createDefaultSaveData } from '../../shared/save-data';
import type { MetaProgressionUnlockResult } from '../../shared/meta-progression';
import { desktopClient } from '../desktop-client';
import { createRunResolutionController } from './runResolutionController';
import { createRunTimerController } from './runTimerController';
import { persistSaveDataThenUnlockAchievements } from './achievementPersistence';
import {
    persistSaveData,
    persistSaveSettings,
    persistenceNoticeForConsecutiveFailures,
    registerPersistenceWriteFailureHandler
} from './persistBridge';
import {
    BOARD_FLOATER_POP_CLEAR,
    type MatchScorePop,
    type MismatchScorePop
} from './matchScorePop';
import {
    createBoardPinModeToggleResult,
    createDestroyPairArmedToggleResult,
    createFlashPairSurfaceResult,
    createGambitThirdPickPressResult,
    createPeekModeToggleResult,
    createRegionShuffleArmSurfaceResult,
    createRegionShuffleSurfaceResult,
    createRunSurfaceReset,
    createShuffleBoardSurfaceResult,
    createStrayArmToggleResult,
    createTileSwapToggleResult,
    createRunWithPeekDisarmedPatch
} from './runSurfaceState';
import {
    createPlayingTilePressSurfaceResult,
} from './tilePressController';
import { playTilePressAudioCues } from './tilePressAudioCues';
import {
    applyPlayingTilePressSurfaceResult
} from './playingTilePressResultApplier';
import {
    executeContinueFromShop,
    executeShopCloseToFloorSummary
} from './shopCloseExecutor';
import {
    executeOpenShopFromLevelComplete
} from './levelCompleteShopExecutor';
import {
    executePauseRun,
    executeResumeRun
} from './pauseResumeExecutor';
import {
    executeHowToPlayDismiss,
    executeMetaProgressionRewardClaim,
    executePowersFtueDismiss,
    executeSettingsUpdate
} from './savePreferenceExecutor';
import {
    createRelicOfferServiceSurfaceResult,
    createRelicPickSurfaceResult
} from './relicOfferSurfaceState';
import {
    executeChooseRouteAndContinue,
    executeContinueToNextLevel
} from './levelCompleteContinuationExecutor';
import { createMenuSurfacePatch } from './menuSurfaceState';
import { createRiskWagerSurfaceResult } from './riskWagerSurfaceState';
import {
    playDestroyPairSfx,
    playFlipSfx,
    playGambitCommitSfx,
    playPeekPowerSfx,
    playPowerArmSfx,
    playRelicPickSfx,
    playResolveSfx,
    playStrayPowerSfx,
    playTrapSfx,
    playWagerArmSfx,
    resumeAudioContext,
    sfxGainFromSettings
} from '../audio/gameSfx';
import {
    playPauseOpenSfx,
    playPauseResumeSfx,
    playRunStartSfx,
    resumeUiSfxContext
} from '../audio/uiSfx';
import type { StoreNavigationAction } from './navigationModel';
import { createHydratedAppStatePatch } from './hydrationController';
import { createRunLifecycleController } from './runLifecycleController';

interface AppState {
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
    armRegionShuffleRowPick: (row: number | null) => void;
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

const RUN_SURFACE_RESET = createRunSurfaceReset();

const sfxGainFromStore = (): number => {
    const { settings } = useAppStore.getState();
    return sfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
};

const playRunStartUiSfxFromStore = (): void => {
    void resumeUiSfxContext();
    playRunStartSfx(sfxGainFromStore());
};

const persistSaveDataSafely = async (saveData: SaveData): Promise<SaveData> => {
    if (useAppStore.getState().saveWritesBlockedByReadFailure) {
        return saveData;
    }
    return persistSaveData(saveData);
};

const persistSaveDataThenUnlockAchievementsSafely = async (
    saveData: SaveData,
    achievements: AchievementId[]
): Promise<{ failures: { id: AchievementId; result: AchievementUnlockResult }[] }> => {
    if (useAppStore.getState().saveWritesBlockedByReadFailure) {
        return { failures: [] };
    }
    return persistSaveDataThenUnlockAchievements(saveData, achievements);
};

const runResolutionController = createRunResolutionController({
    getSfxGain: sfxGainFromStore,
    getState: () => useAppStore.getState(),
    persistSaveData: persistSaveDataSafely,
    persistSaveDataThenUnlockAchievements: persistSaveDataThenUnlockAchievementsSafely,
    runSurfaceReset: RUN_SURFACE_RESET,
    setState: (patch) => useAppStore.setState(patch)
});

const applyResolveBoardTurn = (run: RunState): void => runResolutionController.applyResolveBoardTurn(run);
const applyResolvedRun = (resolvedRun: RunState): void => runResolutionController.applyResolvedRun(resolvedRun);
const applyImmediateGameOverFromTilePress = (resolvedRun: RunState): void =>
    runResolutionController.applyImmediateGameOverFromTilePress(resolvedRun);

const runTimerController = createRunTimerController({
    getState: () => useAppStore.getState(),
    onResolveBoardTurn: applyResolveBoardTurn,
    onResolvedRun: applyResolvedRun,
    setRun: (run) => useAppStore.setState({ run })
});

const clearAllTimers = (): void => runTimerController.clearAllTimers();
const clearResolveTimer = (): void => runTimerController.clearResolveTimer();
const freezeRun = (run: RunState): RunState => runTimerController.freezeRun(run);
const freezeRunSnapshotForPlayingMetaOverlay = (run: RunState): RunState =>
    runTimerController.freezeRunSnapshotForPlayingMetaOverlay(run);
const prepareMemorizeTimerForBoardReady = (run: RunState): void =>
    runTimerController.prepareMemorizeTimerForBoardReady(run);
const resumeRunWithTimers = (run: RunState): RunState => runTimerController.resumeRunWithTimers(run);
const scheduleDebugRevealTimer = (duration: number): void => runTimerController.scheduleDebugRevealTimer(duration);
const scheduleResolveTimer = (duration: number): void => runTimerController.scheduleResolveTimer(duration);
const syncGauntletExpiryWatch = (): void => runTimerController.syncGauntletExpiryWatch();

const sideRoomActionController = createSideRoomActionController<AppState>({
    applyResolvedRun,
    continueToNextLevel: () => useAppStore.getState().continueToNextLevel(),
    getState: () => useAppStore.getState(),
    setState: (patch) => useAppStore.setState(patch)
});

const runLifecycleController = createRunLifecycleController<AppState>({
    clearAllTimers,
    getState: () => useAppStore.getState(),
    playRunStartSfx: playRunStartUiSfxFromStore,
    prepareMemorizeTimerForBoardReady,
    scheduleDebugRevealTimer,
    setState: (patch) => useAppStore.setState(patch)
});

const executeStoreRunStartRequest = (
    request: RunStartRequest,
    set: (patch: Partial<AppState>) => void,
    get: () => AppState
): void => {
    executeRunStartRequest(request, {
        clearAllTimers,
        getState: get,
        playRunStartSfx: playRunStartUiSfxFromStore,
        prepareMemorizeTimerForBoardReady,
        setState: set,
        trackRunStart: (payload) => trackEvent('run_start', payload)
    });
};

const executeStoreShopCloseToFloorSummary = (set: (patch: Partial<AppState>) => void, get: () => AppState): void => {
    executeShopCloseToFloorSummary({
        applyResolvedRun,
        getState: get,
        resumeRunWithTimers,
        setState: set
    });
};

const executeStoreMetaOverlayOpen = (
    pointer: MetaOverlayReturnPointer,
    transitionAction: StoreNavigationAction,
    set: (patch: Partial<AppState>) => void,
    get: () => AppState,
    requestedReturnView?: SubscreenReturnView
): void => {
    executeMetaOverlayOpen(
        pointer,
        transitionAction,
        {
            applyResolvedRun,
            clearAllTimers,
            freezeRunSnapshotForPlayingMetaOverlay,
            getState: get,
            resumeRunWithTimers,
            setState: set
        },
        requestedReturnView
    );
};

const executeStoreMetaOverlayClose = (
    pointer: MetaOverlayReturnPointer,
    transitionAction: 'closeSettings' | 'closeSubscreen',
    set: (patch: Partial<AppState>) => void,
    get: () => AppState
): void => {
    executeMetaOverlayClose(pointer, transitionAction, {
        applyResolvedRun,
        clearAllTimers,
        freezeRunSnapshotForPlayingMetaOverlay,
        getState: get,
        resumeRunWithTimers,
        setState: set
    });
};

export const useAppStore = create<AppState>((set, get) => ({
    hydrated: false,
    hydrating: false,
    steamConnected: false,
    view: 'boot',
    settingsReturnView: 'menu',
    subscreenReturnView: 'menu',
    saveData: createDefaultSaveData(),
    settings: createDefaultSaveData().settings,
    run: null,
    runStartSaveData: null,
    newlyUnlockedAchievements: [],
    achievementBridgeNotice: null,
    clearAchievementBridgeNotice: () => {
        set({ achievementBridgeNotice: null });
    },
    persistenceWriteNotice: null,
    clearPersistenceWriteNotice: () => {
        set({ persistenceWriteNotice: null });
    },
    saveReadFailureNotice: null,
    saveWritesBlockedByReadFailure: false,
    clearSaveReadFailureNotice: () => {
        set({ saveReadFailureNotice: null });
    },
    boardPinMode: false,
    destroyPairArmed: false,
    peekModeArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null,
    dungeonExitPromptOpen: false,
    shopReturnMode: null,
    ...BOARD_FLOATER_POP_CLEAR,
    dismissMatchScorePop: () => {
        set({ matchScorePop: null });
    },
    dismissMismatchScorePop: () => {
        set({ mismatchScorePop: null });
    },

    hydrate: async () => {
        if (get().hydrating || get().hydrated) {
            return;
        }

        set({ hydrating: true });

        set(await createHydratedAppStatePatch({ desktop: desktopClient, persistSaveData: persistSaveDataSafely }));
    },

    startRun: () => {
        executeStoreRunStartRequest({ kind: 'endless' }, set, get);
    },

    startDungeonShowcaseRun: () => {
        executeStoreRunStartRequest({ kind: 'dungeonShowcase' }, set, get);
    },

    startDailyRun: () => {
        executeStoreRunStartRequest({ kind: 'daily' }, set, get);
    },

    startGauntletRun: (durationMs = 10 * 60 * 1000) => {
        executeStoreRunStartRequest({ durationMs, kind: 'gauntlet' }, set, get);
    },

    startPuzzleRun: (puzzleId) => {
        executeStoreRunStartRequest({ kind: 'puzzle', puzzleId }, set, get);
    },

    startPracticeRun: () => {
        executeStoreRunStartRequest({ kind: 'practice' }, set, get);
    },

    startScholarContractRun: () => {
        executeStoreRunStartRequest({ kind: 'scholarContract' }, set, get);
    },

    startMeditationRun: () => {
        executeStoreRunStartRequest({ kind: 'meditation' }, set, get);
    },

    startMeditationRunWithMutators: (mutators) => {
        executeStoreRunStartRequest({ kind: 'meditationWithMutators', mutators }, set, get);
    },

    startPinVowRun: () => {
        executeStoreRunStartRequest({ kind: 'pinVow' }, set, get);
    },

    startWildRun: () => {
        executeStoreRunStartRequest({ kind: 'wild' }, set, get);
    },

    pickRelic: (relicId) => {
        const result = createRelicPickSurfaceResult({
            relicId,
            run: get().run,
            saveData: get().saveData
        });
        if (result.kind === 'ignored') {
            return;
        }
        clearAllTimers();
        void resumeAudioContext();
        playRelicPickSfx(sfxGainFromStore());
        set(result.patch);
        prepareMemorizeTimerForBoardReady(result.patch.run);
        void persistSaveDataSafely(result.nextSave);
    },

    applyRelicOfferService: (serviceId, targetRelicId) => {
        const result = createRelicOfferServiceSurfaceResult({
            run: get().run,
            serviceId,
            targetRelicId
        });
        if (result.kind === 'ignored') {
            return;
        }
        set(result.patch);
    },

    dismissPowersFtue: async () => {
        await executePowersFtueDismiss({
            getState: get,
            persistSaveData: persistSaveDataSafely,
            persistSaveSettings,
            setState: set
        });
    },

    /** Abandon confirm / NAV-004: clears the run and normalizes return pointers so meta overlays cannot strand `inventory|codex` without a run (SIDE-014). */
    goToMenu: () => {
        clearAllTimers();
        set(createMenuSurfacePatch());
    },

    openModeSelect: () => {
        executeStoreMetaOverlayOpen('subscreenReturnView', 'openModeSelect', set, get);
    },

    openCollection: () => {
        executeStoreMetaOverlayOpen('subscreenReturnView', 'openCollection', set, get);
    },

    openProfile: () => {
        executeStoreMetaOverlayOpen('subscreenReturnView', 'openProfile', set, get);
    },

    openInventoryFromMenu: () => {
        executeStoreMetaOverlayOpen('subscreenReturnView', 'openInventoryFromMenu', set, get);
    },

    openCodexFromMenu: () => {
        executeStoreMetaOverlayOpen('subscreenReturnView', 'openCodexFromMenu', set, get);
    },

    openInventoryFromPlaying: () => {
        executeStoreMetaOverlayOpen('subscreenReturnView', 'openInventoryFromPlaying', set, get);
    },

    openCodexFromPlaying: () => {
        executeStoreMetaOverlayOpen('subscreenReturnView', 'openCodexFromPlaying', set, get);
    },

    openShopFromLevelComplete: () => {
        executeOpenShopFromLevelComplete({
            applyResolvedRun,
            getState: get,
            setState: set
        });
    },

    closeShopToFloorSummary: () => {
        executeStoreShopCloseToFloorSummary(set, get);
    },

    continueFromShop: () => {
        executeContinueFromShop({
            applyResolvedRun,
            continueToNextLevel: () => get().continueToNextLevel(),
            getState: get,
            resumeRunWithTimers,
            setState: set
        });
    },

    claimSideRoomPrimary: () => {
        sideRoomActionController.applySideRoomAction(claimRouteSideRoomPrimary);
    },

    claimSideRoomChoice: (choiceId: string) => {
        sideRoomActionController.applySideRoomAction((sideRoomRun) => claimRouteSideRoomChoice(sideRoomRun, choiceId));
    },

    skipSideRoom: () => {
        sideRoomActionController.applySideRoomAction(skipRouteSideRoom);
    },

    closeSubscreen: () => {
        executeStoreMetaOverlayClose('subscreenReturnView', 'closeSubscreen', set, get);
    },

    openSettings: (returnView = 'menu') => {
        executeStoreMetaOverlayOpen('settingsReturnView', 'openSettings', set, get, returnView);
    },

    closeSettings: () => {
        executeStoreMetaOverlayClose('settingsReturnView', 'closeSettings', set, get);
    },

    updateSettings: async (settings) => {
        await executeSettingsUpdate(settings, {
            getState: get,
            persistSaveData: persistSaveDataSafely,
            persistSaveSettings,
            setState: set
        });
    },

    dismissHowToPlay: async () => {
        await executeHowToPlayDismiss({
            getState: get,
            persistSaveData: persistSaveDataSafely,
            persistSaveSettings,
            setState: set
        });
    },

    claimMetaProgressionReward: (rowId) => {
        return executeMetaProgressionRewardClaim(rowId, {
            getState: get,
            persistSaveData: persistSaveDataSafely,
            persistSaveSettings,
            setState: set
        });
    },

    pressTile: (tileId) => {
        const {
            run,
            view,
            boardPinMode,
            destroyPairArmed,
            peekModeArmed,
            tileSwapArmed,
            tileSwapFirstTileId
        } = get();

        if (!run || view !== 'playing') {
            return;
        }

        const gambitThirdPick =
            run.status === 'resolving' &&
            run.board &&
            run.gambitAvailableThisFloor &&
            !run.gambitThirdFlipUsed &&
            run.board.flippedTileIds.length === 2;

        if (gambitThirdPick) {
            if (isGauntletExpired(run)) {
                applyResolvedRun({ ...run, status: 'gameOver', lives: 0 });
                return;
            }
            const result = createGambitThirdPickPressResult(run, tileId);
            if (result.hazardContact) {
                void resumeAudioContext();
                playResolveSfx(result.hazardContact.fromRun, result.hazardContact.toRun, sfxGainFromStore());
            }
            if (result.kind === 'unchanged') {
                return;
            }
            if (result.kind === 'hazardGameOver') {
                applyImmediateGameOverFromTilePress(result.run);
                return;
            }
            if (result.playFlipSfx) {
                void resumeAudioContext();
                const g = sfxGainFromStore();
                playFlipSfx(g);
                if (result.playGambitCommitSfx) {
                    playGambitCommitSfx(g);
                }
            }
            if (result.kind === 'flipGameOver') {
                applyImmediateGameOverFromTilePress(result.run);
                return;
            }
            set(createRunWithPeekDisarmedPatch(result.run));
            if (result.resolveDelayMs !== null) {
                scheduleResolveTimer(result.resolveDelayMs);
            }
            return;
        }

        if (run.status !== 'playing') {
            return;
        }

        if (isGauntletExpired(run)) {
            applyResolvedRun({ ...run, status: 'gameOver', lives: 0 });
            return;
        }

        applyPlayingTilePressSurfaceResult(
            createPlayingTilePressSurfaceResult({
                boardPinMode,
                destroyPairArmed,
                peekModeArmed,
                run,
                tileSwapArmed,
                tileSwapFirstTileId,
                tileId
            }),
            {
                applyImmediateGameOverFromTilePress,
                applyResolvedRun,
                clearAllTimers,
                freezeRunSnapshotForPlayingMetaOverlay,
                playTilePressAudioCues: (audio) => {
                    playTilePressAudioCues(audio, {
                        getSfxGain: sfxGainFromStore,
                        playDestroyPairSfx,
                        playFlipSfx,
                        playPeekPowerSfx,
                        playResolveSfx,
                        playStrayPowerSfx,
                        playTrapSfx,
                        resumeAudioContext
                    });
                },
                scheduleResolveTimer,
                setState: (patch) => useAppStore.setState(patch)
            }
        );
    },

    closeDungeonExitPrompt: () => {
        set({ dungeonExitPromptOpen: false });
    },

    activateDungeonExitFromPrompt: (spend = 'none') => {
        const { run, view } = get();
        if (!run || view !== 'playing') {
            return;
        }
        const nextRun = activateDungeonExit(run, spend);
        set({ dungeonExitPromptOpen: false });
        if (nextRun !== run) {
            applyResolvedRun(nextRun);
        }
    },

    togglePeekMode: () => {
        const { run, view, boardPinMode, destroyPairArmed, peekModeArmed, tileSwapArmed } = get();
        const result = createPeekModeToggleResult({
            boardPinMode,
            destroyPairArmed,
            peekModeArmed,
            tileSwapArmed,
            run,
            view
        });
        if (result.kind === 'ignored') {
            return;
        }
        if (result.playArmSfx) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore());
        }
        set(result.patch);
    },

    toggleTileSwapArmed: () => {
        const { run, view, destroyPairArmed, peekModeArmed, tileSwapArmed } = get();
        const result = createTileSwapToggleResult({
            destroyPairArmed,
            peekModeArmed,
            run,
            tileSwapArmed,
            view
        });
        if (result.kind === 'ignored') {
            return;
        }
        if (result.playArmSfx) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore() * 0.9);
        }
        set(result.patch);
    },

    undoResolvingFlip: () => {
        const { run, view } = get();
        if (!run || view !== 'playing' || run.status !== 'resolving') {
            return;
        }
        clearResolveTimer();
        const nextRun = cancelResolvingWithUndo(run);
        if (nextRun !== run) {
            set({ run: nextRun });
        }
    },

    toggleStrayArm: () => {
        const { run, view } = get();
        const result = createStrayArmToggleResult({ run, view });
        if (result.kind === 'ignored') {
            return;
        }
        if (result.playArmSfx) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore());
        }
        set(result.patch);
    },

    shuffleBoard: () => {
        const { run, view } = get();
        const result = createShuffleBoardSurfaceResult({ run, view });
        if (result.kind === 'ignored') {
            return;
        }
        set(result.patch);
    },

    armRegionShuffleRowPick: (row) => {
        const { run, view } = get();
        const result = createRegionShuffleArmSurfaceResult({ row, run, view });
        if (result.kind === 'ignored') {
            return;
        }
        set(result.patch);
    },

    shuffleRegionRow: (row) => {
        const { run, view } = get();
        const result = createRegionShuffleSurfaceResult({ row, run, view });
        if (result.kind === 'ignored') {
            return;
        }
        set(result.patch);
    },

    notifyMemorizeBoardReady: (boardKey) => {
        runTimerController.notifyMemorizeBoardReady(boardKey);
    },

    applyFlashPairPower: () => {
        const { run, view } = get();
        const result = createFlashPairSurfaceResult({ run, view });
        if (result.kind === 'ignored') {
            return;
        }
        if (result.playArmSfx) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore() * 0.78);
        }
        set(result.patch);
    },

    toggleBoardPinMode: () => {
        const { boardPinMode, run, view } = get();
        const result = createBoardPinModeToggleResult({ boardPinMode, run, view });
        if (result.kind === 'ignored') {
            return;
        }
        if (result.playArmSfx) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore() * 0.92);
        }
        set(result.patch);
    },

    toggleDestroyPairArmed: () => {
        const { destroyPairArmed, run, view } = get();
        const result = createDestroyPairArmedToggleResult({ destroyPairArmed, run, view });
        if (result.kind === 'ignored') {
            return;
        }
        if (result.playArmSfx) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore());
        }
        set(result.patch);
    },

    pause: () => {
        executePauseRun({
            applyResolvedRun,
            clearAllTimers,
            freezeRun,
            getState: get,
            playPauseOpenSfx: () => playPauseOpenSfx(sfxGainFromStore()),
            playPauseResumeSfx: () => playPauseResumeSfx(sfxGainFromStore()),
            resumeRunWithTimers,
            resumeUiSfxContext,
            setState: set
        });
    },

    resume: () => {
        executeResumeRun({
            applyResolvedRun,
            clearAllTimers,
            freezeRun,
            getState: get,
            playPauseOpenSfx: () => playPauseOpenSfx(sfxGainFromStore()),
            playPauseResumeSfx: () => playPauseResumeSfx(sfxGainFromStore()),
            resumeRunWithTimers,
            resumeUiSfxContext,
            setState: set
        });
    },

    acceptEndlessRiskWager: () => {
        const result = createRiskWagerSurfaceResult(get().run);
        if (result.kind === 'ignored') {
            return;
        }

        void resumeAudioContext();
        playWagerArmSfx(sfxGainFromStore());
        set(result.patch);
    },

    purchaseShopOffer: (offerId) => {
        const { run, view, shopReturnMode } = get();
        const result = createShopPurchaseSurfaceResult({
            offerId,
            run,
            shopReturnMode,
            view
        });
        if (result.kind === 'ignored') {
            return;
        }
        set(result.patch);
    },

    rerollShopOffers: () => {
        const { run, view, shopReturnMode } = get();
        const result = createShopRerollSurfaceResult({
            run,
            shopReturnMode,
            view
        });
        if (result.kind === 'ignored') {
            return;
        }
        set(result.patch);
    },

    continueToNextLevel: () => {
        executeContinueToNextLevel({
            applyResolvedRun,
            clearAllTimers,
            continueToNextLevel: () => get().continueToNextLevel(),
            getState: get,
            prepareMemorizeTimerForBoardReady,
            setState: set
        });
    },

    chooseRouteAndContinue: (choiceId) => {
        executeChooseRouteAndContinue(choiceId, {
            applyResolvedRun,
            clearAllTimers,
            continueToNextLevel: () => get().continueToNextLevel(),
            getState: get,
            prepareMemorizeTimerForBoardReady,
            setState: set
        });
    },

    restartRun: () => {
        runLifecycleController.restartRun();
    },

    endRun: () => {
        runLifecycleController.endRun();
    },

    triggerDebugReveal: () => {
        runLifecycleController.triggerDebugReveal();
    }
}));

useAppStore.subscribe(() => {
    syncGauntletExpiryWatch();
});

registerPersistenceWriteFailureHandler(({ consecutive }) => {
    useAppStore.setState({
        persistenceWriteNotice: persistenceNoticeForConsecutiveFailures(consecutive)
    });
});
