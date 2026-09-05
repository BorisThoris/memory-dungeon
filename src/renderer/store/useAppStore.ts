import { create } from 'zustand/react';
import { acknowledgePassAndPlayHandoff, PASS_AND_PLAY_MIN_SEATS } from '../../shared/pass-and-play-rules';
import type {
    AchievementId,
    AchievementUnlockResult,
    RunState,
    SaveData,
    SubscreenReturnView
} from '../../shared/contracts';
import { expireGauntletThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import { isGauntletExpired } from '../../shared/game-core';
import { parseRunShareKey } from '../../shared/run-share-key';
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
import { desktopClient } from '../desktop-client';
import { normalizeUnknownSaveDataOrThrow } from '../../shared/save-data';
import { createRunResolutionController } from './runResolutionController';
import { createRunTimerController } from './runTimerController';
import {
    ACHIEVEMENT_SYNC_FAILURE_NOTICE,
    persistSaveDataThenUnlockAchievements,
    syncPersistedAchievements
} from './achievementPersistence';
import {
    persistSaveData,
    persistSaveSettings,
    persistenceNoticeForConsecutiveFailures,
    registerPersistenceWriteFailureHandler
} from './persistBridge';
import {
    createBoardPinModeToggleResult,
    createDestroyPairArmedToggleResult,
    createDungeonExitActivationSurfaceResult,
    createFlashPairSurfaceResult,
    createGambitThirdPickPressResult,
    createPeekModeToggleResult,
    createRegionShuffleArmToggleSurfaceResult,
    createRunSurfaceReset,
    createShuffleBoardSurfaceResult,
    createStrayArmToggleResult,
    createTileSwapToggleResult,
    createUndoResolvingSurfaceResult,
    createRunWithPeekDisarmedPatch
} from './runSurfaceState';
import { createPlayingTilePressSurfaceResult } from './tilePressController';
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
import { projectGameplayFeedback } from './gameplayFeedbackAdapter';
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
    playUiConfirmSfx,
    playPauseResumeSfx,
    playRunStartSfx,
    resumeUiSfxContext
} from '../audio/uiSfx';
import type { StoreNavigationAction } from './navigationModel';
import { runPersistenceInBackground } from './backgroundPersistence';
import { createHydratedAppStatePatch, SAVE_RECOVERY_FAILED_NOTICE } from './hydrationController';
import { createRunLifecycleController } from './runLifecycleController';
import { createAppStoreInitialState } from './appStoreInitialState';
import type { AppState } from './appStoreTypes';

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

const sideRoomActionController = createSideRoomActionController({
    applyResolvedRun,
    continueToNextLevel: () => useAppStore.getState().continueToNextLevel(),
    getState: () => useAppStore.getState(),
    playRewardClaimFeedback: () => {
        void resumeAudioContext();
        playRelicPickSfx(sfxGainFromStore());
    },
    setState: (patch) => useAppStore.setState(patch)
});

const runLifecycleController = createRunLifecycleController({
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
    ...createAppStoreInitialState(),
    clearAchievementBridgeNotice: () => {
        set({ achievementBridgeNotice: null });
    },
    clearPersistenceWriteNotice: () => {
        set({ persistenceWriteNotice: null });
    },
    clearSaveReadFailureNotice: () => {
        set({ saveReadFailureNotice: null });
    },
    recoverUnreadableSave: async () => {
        if (!get().saveWritesBlockedByReadFailure) {
            return;
        }
        try {
            const recovered = normalizeUnknownSaveDataOrThrow(await desktopClient.recoverUnreadableSave());
            set({
                saveData: recovered,
                saveReadFailureNotice: null,
                saveWritesBlockedByReadFailure: false,
                settings: recovered.settings
            });
        } catch (error) {
            // The old save stays where it is and writes stay blocked, which is the safe half of the
            // pair: the notice is still up, so the player can try again or move the file themselves.
            console.error('[save] could not start a fresh profile', error);
            set({ saveReadFailureNotice: SAVE_RECOVERY_FAILED_NOTICE });
        }
    },
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

        const patch = await createHydratedAppStatePatch({ desktop: desktopClient, persistSaveData: persistSaveDataSafely });
        set(patch);
        runPersistenceInBackground(() =>
            syncPersistedAchievements(patch.saveData, patch.steamConnected).then(({ failures }) => {
                if (failures.length > 0) {
                    set({ achievementBridgeNotice: ACHIEVEMENT_SYNC_FAILURE_NOTICE });
                }
            })
        );
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

    startPassAndPlayRun: (seats = PASS_AND_PLAY_MIN_SEATS) => {
        executeStoreRunStartRequest({ kind: 'passAndPlay', seats }, set, get);
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

    revealSaveFile: () => {
        // Nothing to update and nothing to await: the file manager is the whole outcome, and a
        // browser build has no file to reveal, so a false answer is a normal one.
        void desktopClient.revealSaveFile().catch((error: unknown) => {
            console.warn('[store] reveal save file failed', error);
        });
    },

    startScholarContractRun: () => {
        executeStoreRunStartRequest({ kind: 'scholarContract' }, set, get);
    },

    startSharedRun: (pastedText) => {
        const key = parseRunShareKey(pastedText);
        if (!key) {
            return;
        }
        executeStoreRunStartRequest({ key, kind: 'shared' }, set, get);
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
        // Migrated relics prove their cue came from the gameplay journal; legacy
        // relics retain the established pick sound until their core migration.
        if (!result.feedback || result.feedback.audioCategory === 'relic-pick') {
            void resumeAudioContext();
            playRelicPickSfx(sfxGainFromStore());
        }
        set(result.patch);
        prepareMemorizeTimerForBoardReady(result.patch.run);
        runPersistenceInBackground(() => persistSaveDataSafely(result.nextSave));
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
        if (result.feedback?.audioCategory === 'relic-service') {
            void resumeAudioContext();
            playRelicPickSfx(sfxGainFromStore() * 0.8);
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
        sideRoomActionController.resolveSideRoom('claim');
    },

    claimSideRoomChoice: (choiceId: string) => {
        sideRoomActionController.resolveSideRoom('claim', choiceId);
    },

    skipSideRoom: () => {
        sideRoomActionController.resolveSideRoom('skip');
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
            run: pressedRun,
            view,
            boardPinMode,
            destroyPairArmed,
            peekModeArmed,
            regionShuffleArmed,
            strayRemoveArmed,
            tileSwapArmed,
            tileSwapFirstTileId
        } = get();

        if (!pressedRun || view !== 'playing') {
            return;
        }

        /*
         * The next player has acted, so the pass banner has done its job. Cleared into the run this
         * press works from, not with a separate write: everything below derives a new run from this
         * one, so a write here would be overwritten by the flip a moment later and the banner would
         * come back. It is cleared on an action rather than on a timer because the beat waits for
         * whoever the device went to, and a table can take as long as it likes to hand a laptop
         * across.
         */
        const run =
            pressedRun.passAndPlay?.handoffPending === true
                ? { ...pressedRun, passAndPlay: acknowledgePassAndPlayHandoff(pressedRun.passAndPlay) }
                : pressedRun;

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
                if (projectGameplayFeedback(result.events).some((feedback) => feedback.audioCategory === 'gambit-commit')) {
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
            // Through the command, not a direct mutation: an expiry that ends the run has
            // to appear in the journal, or a replay of this run never ends.
            const expiry = expireGauntletThroughGameplayCore(run, Date.now());
            applyResolvedRun(expiry.accepted ? expiry.run : { ...run, status: 'gameOver', lives: 0 });
            return;
        }

        applyPlayingTilePressSurfaceResult(
            createPlayingTilePressSurfaceResult({
                boardPinMode,
                destroyPairArmed,
                peekModeArmed,
                regionShuffleArmed,
                run,
                strayRemoveArmed,
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

    activateDungeonExitFromPrompt: (spend) => {
        const { run, view } = get();
        const result = createDungeonExitActivationSurfaceResult({ run, spend, view });
        if (result.kind === 'ignored') {
            set({ dungeonExitPromptOpen: true });
            return;
        }
        set({ dungeonExitPromptOpen: false });
        applyResolvedRun(result.patch.run);
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
        const result = createUndoResolvingSurfaceResult({ run, view });
        if (result.kind === 'ignored') {
            return;
        }
        clearResolveTimer();
        set(result.patch);
    },

    toggleStrayArm: () => {
        const { run, strayRemoveArmed, view } = get();
        const result = createStrayArmToggleResult({ run, strayRemoveArmed, view });
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

    toggleRegionShuffleArmed: () => {
        const { regionShuffleArmed, run, view } = get();
        const result = createRegionShuffleArmToggleSurfaceResult({ armed: regionShuffleArmed, run, view });
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

        if (projectGameplayFeedback(result.events).some((feedback) => feedback.audioCategory === 'wager')) {
            void resumeAudioContext();
            playWagerArmSfx(sfxGainFromStore());
        }
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
        // A completed purchase is a confirmed player action and owes an audible ack;
        // the shop surface reports it through the accepted result, not a feedback field.
        void resumeUiSfxContext();
        playUiConfirmSfx(sfxGainFromStore());
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
        void resumeUiSfxContext();
        playUiConfirmSfx(sfxGainFromStore());
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
