import { create } from 'zustand/react';
import { evaluateAchievementUnlocks } from '../../shared/achievements';
import { mergeHonorUnlockTags } from '../../shared/honorUnlocks';
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
import { BUILTIN_PUZZLES } from '../../shared/builtin-puzzles';
import {
    acceptEndlessRiskWager as acceptEndlessRiskWagerRule,
    applyRelicOfferServiceToRun,
    completeRelicPickAndAdvance,
    openRelicOffer
} from '../../shared/objective-rules';
import {
    advanceToNextLevel,
    createDailyRun,
    createDungeonShowcaseRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createWildRun,
    createRunSummary,
    disableDebugPeek,
    enableDebugPeek,
    finishMemorizePhase,
    isGauntletExpired,
    pauseRun,
    resumeRun
} from '../../shared/game-core';
import {
    applyDestroyPair,
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    armRegionShuffleRow,
    cancelResolvingWithUndo,
    togglePinnedTile,
    toggleStrayRemoveArmed
} from '../../shared/board-powers';
import {
    applyRouteChoiceOutcome,
    claimRouteSideRoomChoice,
    claimRouteSideRoomPrimary,
    openRouteSideRoom,
    skipRouteSideRoom
} from '../../shared/route-rules';
import {
    purchaseShopOffer as purchaseShopOfferRule,
    rerollShopOffers as rerollShopOffersRule
} from '../../shared/shop-rules';
import {
    activateDungeonExit,
    EXIT_PAIR_KEY,
    revealDungeonExit,
    revealDungeonRoom,
    revealDungeonShop,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
    type DungeonExitActivationSpend
} from '../../shared/dungeon-rules';
import {
    applyEnemyHazardClick,
    flipTile,
    resolveBoardTurn
} from '../../shared/turn-resolution';
import { trackEvent } from '../../shared/telemetry';
import {
    shouldScheduleDebugRevealTimerOnResume,
    shouldScheduleMemorizeTimerOnResume
} from './runTimerResumeConditions';
import {
    createDefaultSaveData,
    mergeBestFloorNoPowers,
    mergeDailyComplete,
    mergeEncoreFromRun,
    mergePuzzleCompletion,
    mergeRelicPickStat,
    metaRelicDraftExtraPerMilestoneFromSave,
    normalizeSaveData
} from '../../shared/save-data';
import { desktopClient } from '../desktop-client';
import { persistSaveDataThenUnlockAchievements } from './achievementPersistence';
import {
    persistSaveData,
    persistSaveSettings,
    persistenceNoticeForConsecutiveFailures,
    registerPersistenceWriteFailureHandler
} from './persistBridge';
import {
    BOARD_FLOATER_POP_CLEAR,
    buildMatchScorePopPayload,
    buildMismatchScorePopPayload,
    type MatchScorePop,
    type MismatchScorePop
} from './matchScorePop';
import { needsRelicPick } from '../../shared/relics';
import {
    playDestroyPairSfx,
    playFlipSfx,
    playGambitCommitSfx,
    playFloorClearSfx,
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
import { resolveNavigationTransition } from './navigationModel';

const metaRelicOpts = (save: SaveData) => ({
    metaRelicDraftExtraPerMilestone: metaRelicDraftExtraPerMilestoneFromSave(save)
});

interface ActiveTimer {
    deadline: number;
    timeout: ReturnType<typeof setTimeout>;
}

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
    pressTile: (tileId: string) => void;
    closeDungeonExitPrompt: () => void;
    activateDungeonExitFromPrompt: (spend?: DungeonExitActivationSpend) => void;
    togglePeekMode: () => void;
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

let memorizeTimer: ActiveTimer | null = null;
let resolveTimer: ActiveTimer | null = null;
let debugRevealTimer: ActiveTimer | null = null;
let pendingMemorizeBoardKey: string | null = null;

const clearTimer = (timer: ActiveTimer | null): void => {
    if (timer) {
        clearTimeout(timer.timeout);
    }
};

const clearMemorizeTimer = (): void => {
    clearTimer(memorizeTimer);
    memorizeTimer = null;
};

const getMemorizeBoardKey = (run: RunState): string | null =>
    run.board
        ? `${run.board.level}|${run.board.columns}x${run.board.rows}|${[...run.board.tiles]
              .map((t) => t.id)
              .sort()
              .join('|')}`
        : null;

const prepareMemorizeTimerForBoardReady = (run: RunState): void => {
    clearMemorizeTimer();
    pendingMemorizeBoardKey =
        run.status === 'memorize' && run.timerState.memorizeRemainingMs !== null ? getMemorizeBoardKey(run) : null;
};

const clearResolveTimer = (): void => {
    clearTimer(resolveTimer);
    resolveTimer = null;
};

const clearDebugRevealTimer = (): void => {
    clearTimer(debugRevealTimer);
    debugRevealTimer = null;
};

let gauntletExpiryIntervalId: ReturnType<typeof setInterval> | null = null;

const clearGauntletExpiryWatch = (): void => {
    if (gauntletExpiryIntervalId !== null) {
        clearInterval(gauntletExpiryIntervalId);
        gauntletExpiryIntervalId = null;
    }
};

const syncGauntletExpiryWatch = (): void => {
    const { run, view } = useAppStore.getState();
    const shouldWatch =
        view === 'playing' &&
        run &&
        run.gameMode === 'gauntlet' &&
        run.gauntletDeadlineMs !== null &&
        run.status !== 'gameOver';

    if (!shouldWatch) {
        clearGauntletExpiryWatch();
        return;
    }

    if (gauntletExpiryIntervalId !== null) {
        return;
    }

    gauntletExpiryIntervalId = setInterval(() => {
        const { run: currentRun, view: currentView } = useAppStore.getState();
        if (
            !currentRun ||
            currentView !== 'playing' ||
            currentRun.gameMode !== 'gauntlet' ||
            currentRun.gauntletDeadlineMs === null ||
            currentRun.status === 'gameOver'
        ) {
            clearGauntletExpiryWatch();
            return;
        }
        if (isGauntletExpired(currentRun)) {
            clearGauntletExpiryWatch();
            applyResolvedRun({ ...currentRun, status: 'gameOver', lives: 0 });
        }
    }, 300);
};

const clearAllTimers = (): void => {
    clearMemorizeTimer();
    clearResolveTimer();
    clearDebugRevealTimer();
    clearGauntletExpiryWatch();
    pendingMemorizeBoardKey = null;
};

const patchRunFromUserSettings = (run: RunState, settings: Settings): RunState => ({
    ...run,
    weakerShuffleMode: settings.weakerShuffleMode,
    shuffleScoreTaxActive: settings.shuffleScoreTaxEnabled,
    resolveDelayMultiplier: settings.resolveDelayMultiplier,
    echoFeedbackEnabled: settings.echoFeedbackEnabled
});

const getRemainingMs = (timer: ActiveTimer | null, fallback: number | null): number | null => {
    if (!timer) {
        return fallback;
    }

    return Math.max(timer.deadline - Date.now(), 0);
};

const sfxGainFromStore = (): number => {
    const { settings } = useAppStore.getState();
    return sfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
};

const playRunStartUiSfxFromStore = (): void => {
    void resumeUiSfxContext();
    playRunStartSfx(sfxGainFromStore());
};

const SAVE_READ_FAILURE_NOTICE =
    'Save read failed. Started a temporary in-memory profile and paused autosave to avoid overwriting recoverable data.';

const persistSaveDataSafely = async (saveData: SaveData): Promise<SaveData> => {
    if (useAppStore.getState().saveWritesBlockedByReadFailure) {
        return saveData;
    }
    return persistSaveData(saveData);
};

const persistSaveDataThenUnlockAchievementsSafely = async (
    saveData: SaveData,
    achievements: AchievementId[]
): Promise<{ failures: AchievementId[] }> => {
    if (useAppStore.getState().saveWritesBlockedByReadFailure) {
        return { failures: [] };
    }
    return persistSaveDataThenUnlockAchievements(saveData, achievements);
};

const applyResolveBoardTurn = (run: RunState): void => {
    const { saveData } = useAppStore.getState();
    const encore = saveData.playerStats?.encorePairKeysLastRun ?? [];
    const next = resolveBoardTurn(run, encore);
    const pop = buildMatchScorePopPayload(run, next);
    const missPop = buildMismatchScorePopPayload(run, next);
    if (pop) {
        useAppStore.setState({ ...BOARD_FLOATER_POP_CLEAR, matchScorePop: pop });
    } else if (missPop) {
        useAppStore.setState({ ...BOARD_FLOATER_POP_CLEAR, mismatchScorePop: missPop });
    } else {
        useAppStore.setState({ ...BOARD_FLOATER_POP_CLEAR });
    }
    void resumeAudioContext();
    playResolveSfx(run, next, sfxGainFromStore());
    applyResolvedRun(next);
};

const applyResolvedRun = (resolvedRun: RunState): void => {
    const state = useAppStore.getState();
    const prevStatus = state.run?.status;
    if (resolvedRun.status === 'levelComplete' && prevStatus !== 'levelComplete') {
        void resumeAudioContext();
        playFloorClearSfx(sfxGainFromStore());
    }
    let nextRun = resolvedRun.status === 'playing' ? resolvedRun : disableDebugPeek(resolvedRun);

    let saveForAchievements = state.saveData;
    if (nextRun.status === 'levelComplete' && nextRun.gameMode === 'daily' && nextRun.dailyDateKeyUtc) {
        saveForAchievements = mergeDailyComplete(state.saveData, nextRun.dailyDateKeyUtc);
    } else if (nextRun.status === 'gameOver') {
        let projected = mergeEncoreFromRun(state.saveData, nextRun.matchedPairKeysThisRun);
        if (!nextRun.powersUsedThisRun) {
            projected = mergeBestFloorNoPowers(projected, nextRun.stats.highestLevel);
        }
        saveForAchievements = projected;
    }

    const unlockedAchievements = evaluateAchievementUnlocks(nextRun, saveForAchievements);
    let nextSave = normalizeSaveData({
        ...state.saveData,
        bestScore: Math.max(state.saveData.bestScore, nextRun.stats.bestScore)
    });

    if (nextRun.status === 'levelComplete' && nextRun.gameMode === 'daily' && nextRun.dailyDateKeyUtc) {
        nextSave = mergeDailyComplete(nextSave, nextRun.dailyDateKeyUtc);
    }

    if (nextRun.status === 'levelComplete' && !nextSave.onboardingDismissed) {
        nextSave = normalizeSaveData({
            ...nextSave,
            onboardingDismissed: true
        });
    }

    if (nextRun.status === 'levelComplete' && nextRun.gameMode === 'puzzle') {
        nextSave = mergePuzzleCompletion(nextSave, nextRun);
    }

    if (unlockedAchievements.length > 0) {
        const unlockTags = unlockedAchievements.map((id) => `achievement:${id}`);
        nextSave = normalizeSaveData({
            ...nextSave,
            achievements: {
                ...nextSave.achievements,
                ...Object.fromEntries(unlockedAchievements.map((achievementId) => [achievementId, true]))
            },
            unlocks: [...new Set([...(nextSave.unlocks ?? []), ...unlockTags])]
        });
    }

    if (nextRun.status === 'gameOver') {
        nextSave = mergeEncoreFromRun(nextSave, nextRun.matchedPairKeysThisRun);
        nextRun = createRunSummary(nextRun, unlockedAchievements);
        nextRun = {
            ...nextRun,
            lastRunSummary: normalizeSaveData({
                ...nextSave,
                lastRunSummary: nextRun.lastRunSummary
            }).lastRunSummary
        };
        if (!nextRun.powersUsedThisRun) {
            nextSave = mergeBestFloorNoPowers(nextSave, nextRun.stats.highestLevel);
        }
        nextSave = normalizeSaveData({
            ...nextSave,
            onboardingDismissed: true,
            lastRunSummary: nextRun.lastRunSummary
        });
        nextSave = mergeHonorUnlockTags(nextSave);

        const s = nextRun.lastRunSummary;
        if (s) {
            trackEvent('run_complete', {
                mode: s.gameMode ?? 'endless',
                practice: nextRun.practiceMode,
                highestLevel: s.highestLevel,
                totalScore: s.totalScore,
                mutatorCount: s.activeMutators?.length ?? 0,
                relicCount: s.relicIds?.length ?? 0
            });
        }

        useAppStore.setState({
            run: nextRun,
            view: 'gameOver',
            saveData: nextSave,
            settings: nextSave.settings,
            newlyUnlockedAchievements: unlockedAchievements,
            ...BOARD_FLOATER_POP_CLEAR
        });
    } else {
        nextSave = mergeHonorUnlockTags(nextSave);
        useAppStore.setState({
            run: nextRun,
            view: 'playing',
            saveData: nextSave,
            settings: nextSave.settings,
            newlyUnlockedAchievements: unlockedAchievements
        });
    }

    if (unlockedAchievements.length > 0) {
        void persistSaveDataThenUnlockAchievementsSafely(nextSave, unlockedAchievements).then(({ failures }) => {
            if (failures.length > 0) {
                useAppStore.setState({
                    achievementBridgeNotice:
                        'Some achievements could not sync with Steam. Your unlocks are saved in this build.'
                });
            }
        });
    } else {
        void persistSaveDataSafely(nextSave);
    }
};

const applyImmediateGameOverFromTilePress = (resolvedRun: RunState): void => {
    applyResolvedRun(resolvedRun);
    useAppStore.setState({
        boardPinMode: false,
        destroyPairArmed: false,
        peekModeArmed: false,
        dungeonExitPromptOpen: false,
        ...BOARD_FLOATER_POP_CLEAR
    });
};

function scheduleMemorizeTimer(duration: number): void {
    clearMemorizeTimer();
    pendingMemorizeBoardKey = null;

    if (duration <= 0) {
        const { run } = useAppStore.getState();

        if (run && run.status === 'memorize') {
            useAppStore.setState({ run: finishMemorizePhase(run) });
        }

        return;
    }

    memorizeTimer = {
        deadline: Date.now() + duration,
        timeout: setTimeout(() => {
            memorizeTimer = null;
            const { run } = useAppStore.getState();

            if (!run || run.status !== 'memorize') {
                return;
            }

            useAppStore.setState({ run: finishMemorizePhase(run) });
        }, duration)
    };
}

function scheduleResolveTimer(duration: number): void {
    clearResolveTimer();

    if (duration <= 0) {
        const { run } = useAppStore.getState();

        if (run && run.status === 'resolving') {
            applyResolveBoardTurn(run);
        }

        return;
    }

    resolveTimer = {
        deadline: Date.now() + duration,
        timeout: setTimeout(() => {
            resolveTimer = null;
            const { run } = useAppStore.getState();

            if (!run || run.status !== 'resolving') {
                return;
            }

            applyResolveBoardTurn(run);
        }, duration)
    };
}

function scheduleDebugRevealTimer(duration: number): void {
    clearDebugRevealTimer();

    if (duration <= 0) {
        const { run } = useAppStore.getState();

        if (run?.debugPeekActive) {
            useAppStore.setState({ run: disableDebugPeek(run) });
        }

        return;
    }

    debugRevealTimer = {
        deadline: Date.now() + duration,
        timeout: setTimeout(() => {
            debugRevealTimer = null;
            const { run } = useAppStore.getState();

            if (!run?.debugPeekActive) {
                return;
            }

            useAppStore.setState({ run: disableDebugPeek(run) });
        }, duration)
    };
}

const freezeRun = (run: RunState): RunState => {
    const pausedRun = pauseRun(run);

    return {
        ...pausedRun,
        timerState: {
            ...pausedRun.timerState,
            memorizeRemainingMs:
                run.status === 'memorize'
                    ? getRemainingMs(memorizeTimer, run.timerState.memorizeRemainingMs)
                    : pausedRun.timerState.memorizeRemainingMs,
            resolveRemainingMs:
                run.status === 'resolving'
                    ? getRemainingMs(resolveTimer, run.timerState.resolveRemainingMs)
                    : pausedRun.timerState.resolveRemainingMs,
            debugRevealRemainingMs: run.debugPeekActive
                ? getRemainingMs(debugRevealTimer, run.timerState.debugRevealRemainingMs)
                : pausedRun.timerState.debugRevealRemainingMs
        }
    };
};

/**
 * SIDE-013 — In-run meta overlays (settings modal, inventory/codex shell)
 * share one freeze policy: snapshot timers into `paused` for resumable states; leave user-pause and
 * floor-level overlays (`levelComplete`, `gameOver`) unchanged so `closeSubscreen` / `closeSettings`
 * do not double-clobber `pausedFromStatus`.
 */
const freezeRunSnapshotForPlayingMetaOverlay = (run: RunState): RunState =>
    run.status === 'paused' || run.status === 'levelComplete' || run.status === 'gameOver' ? run : freezeRun(run);

const resumeRunWithTimers = (run: RunState): RunState => {
    const resumedRun = resumeRun(run);

    if (shouldScheduleMemorizeTimerOnResume(resumedRun)) {
        scheduleMemorizeTimer(resumedRun.timerState.memorizeRemainingMs!);
    }

    if (resumedRun.status === 'resolving' && resumedRun.timerState.resolveRemainingMs !== null) {
        scheduleResolveTimer(resumedRun.timerState.resolveRemainingMs);
    }

    if (shouldScheduleDebugRevealTimerOnResume(resumedRun)) {
        scheduleDebugRevealTimer(resumedRun.timerState.debugRevealRemainingMs!);
    }

    return resumedRun;
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

        let saveReadFailed = false;
        const [rawSave, steamConnected] = await Promise.all([
            desktopClient
                .getSaveData()
                .then(normalizeSaveData)
                .catch(() => {
                    saveReadFailed = true;
                    return createDefaultSaveData();
                }),
            desktopClient.isSteamConnected().catch(() => false)
        ]);

        const saveData = mergeHonorUnlockTags(rawSave);
        if (saveData !== rawSave && !saveReadFailed) {
            void persistSaveDataSafely(saveData);
        }

        set({
            hydrating: false,
            hydrated: true,
            steamConnected,
            saveData,
            settings: saveData.settings,
            view: 'menu',
            saveReadFailureNotice: saveReadFailed ? SAVE_READ_FAILURE_NOTICE : null,
            saveWritesBlockedByReadFailure: saveReadFailed
        });
    },

    startRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createNewRun(get().saveData.bestScore, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode });
        playRunStartUiSfxFromStore();

        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });

        prepareMemorizeTimerForBoardReady(run);
    },

    startDungeonShowcaseRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createDungeonShowcaseRun(get().saveData.bestScore, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode, showcase: 'dungeon' });
        playRunStartUiSfxFromStore();

        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });

        prepareMemorizeTimerForBoardReady(run);
    },

    startDailyRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createDailyRun(get().saveData.bestScore, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startGauntletRun: (durationMs = 10 * 60 * 1000) => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createGauntletRun(get().saveData.bestScore, durationMs, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startPuzzleRun: (puzzleId) => {
        const puzzle = BUILTIN_PUZZLES[puzzleId];
        if (!puzzle) {
            return;
        }
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createPuzzleRun(get().saveData.bestScore, puzzle.id, puzzle.tiles, 1, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode, puzzleId: puzzle.id });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startPracticeRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createNewRun(get().saveData.bestScore, { practiceMode: true, ...metaRelicOpts(get().saveData) }),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startScholarContractRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createNewRun(get().saveData.bestScore, {
                ...metaRelicOpts(get().saveData),
                activeContract: {
                    noShuffle: true,
                    noDestroy: true,
                    maxMismatches: null,
                    bonusRelicDraftPick: true
                }
            }),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode, scholar: true });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startMeditationRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createMeditationRun(get().saveData.bestScore, undefined, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startMeditationRunWithMutators: (mutators) => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createMeditationRun(get().saveData.bestScore, mutators, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', {
            mode: run.gameMode,
            practice: run.practiceMode,
            meditation_focus_count: mutators.length,
            meditation_focus: mutators.length > 0 ? mutators.join(',') : undefined
        });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startPinVowRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createNewRun(get().saveData.bestScore, {
                ...metaRelicOpts(get().saveData),
                activeContract: { noShuffle: false, noDestroy: false, maxMismatches: null, maxPinsTotalRun: 10 }
            }),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode, pinVow: true });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    startWildRun: () => {
        clearAllTimers();
        const run = patchRunFromUserSettings(
            createWildRun(get().saveData.bestScore, metaRelicOpts(get().saveData)),
            get().settings
        );
        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode, wild: true });
        playRunStartUiSfxFromStore();
        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run
        });
        prepareMemorizeTimerForBoardReady(run);
    },

    pickRelic: (relicId) => {
        const { run } = get();
        if (!run?.relicOffer?.options.includes(relicId)) {
            return;
        }
        clearAllTimers();
        void resumeAudioContext();
        playRelicPickSfx(sfxGainFromStore());
        const nextRun = completeRelicPickAndAdvance(run, relicId);
        let nextSave = mergeRelicPickStat(get().saveData, relicId);
        nextSave = normalizeSaveData(nextSave);
        nextSave = mergeHonorUnlockTags(nextSave);
        set({
            run: nextRun,
            saveData: nextSave,
            settings: nextSave.settings,
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false
        });
        prepareMemorizeTimerForBoardReady(nextRun);
        void persistSaveDataSafely(nextSave);
    },

    applyRelicOfferService: (serviceId, targetRelicId) => {
        const { run } = get();
        if (!run?.relicOffer) {
            return;
        }
        set({ run: applyRelicOfferServiceToRun(run, serviceId, targetRelicId) });
    },

    dismissPowersFtue: async () => {
        const nextSave = normalizeSaveData({
            ...get().saveData,
            powersFtueSeen: true
        });
        set({ saveData: nextSave, settings: nextSave.settings });
        await persistSaveDataSafely(nextSave);
    },

    /** Abandon confirm / NAV-004: clears the run and normalizes return pointers so meta overlays cannot strand `inventory|codex` without a run (SIDE-014). */
    goToMenu: () => {
        clearAllTimers();
        set({
            view: 'menu',
            run: null,
            newlyUnlockedAchievements: [],
            achievementBridgeNotice: null,
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            subscreenReturnView: 'menu',
            settingsReturnView: 'menu',
            ...BOARD_FLOATER_POP_CLEAR
        });
    },

    openModeSelect: () => {
        const transition = resolveNavigationTransition(get(), 'openModeSelect');
        set({ view: transition.view, subscreenReturnView: transition.subscreenReturnView });
    },

    openCollection: () => {
        const transition = resolveNavigationTransition(get(), 'openCollection');
        set({ view: transition.view, subscreenReturnView: transition.subscreenReturnView });
    },

    openProfile: () => {
        const transition = resolveNavigationTransition(get(), 'openProfile');
        set({ view: transition.view, subscreenReturnView: transition.subscreenReturnView });
    },

    openInventoryFromMenu: () => {
        const transition = resolveNavigationTransition(get(), 'openInventoryFromMenu');
        set({ view: transition.view, subscreenReturnView: transition.subscreenReturnView });
    },

    openCodexFromMenu: () => {
        const transition = resolveNavigationTransition(get(), 'openCodexFromMenu');
        set({ view: transition.view, subscreenReturnView: transition.subscreenReturnView });
    },

    openInventoryFromPlaying: () => {
        const { run, view } = get();
        if (!run || view !== 'playing') {
            return;
        }
        const nextRun = freezeRunSnapshotForPlayingMetaOverlay(run);
        clearAllTimers();
        const transition = resolveNavigationTransition(get(), 'openInventoryFromPlaying');
        set({
            view: transition.view,
            subscreenReturnView: transition.subscreenReturnView,
            run: nextRun
        });
    },

    openCodexFromPlaying: () => {
        const { run, view } = get();
        if (!run || view !== 'playing') {
            return;
        }
        const nextRun = freezeRunSnapshotForPlayingMetaOverlay(run);
        clearAllTimers();
        const transition = resolveNavigationTransition(get(), 'openCodexFromPlaying');
        set({
            view: transition.view,
            subscreenReturnView: transition.subscreenReturnView,
            run: nextRun
        });
    },

    openShopFromLevelComplete: () => {
        const { run, view } = get();
        if (
            !run ||
            view !== 'playing' ||
            run.status !== 'levelComplete' ||
            run.relicOffer ||
            run.sideRoom ||
            run.shopOffers.length === 0
        ) {
            return;
        }
        const transition = resolveNavigationTransition(get(), 'openShopFromLevelComplete');
        set({ view: transition.view, shopReturnMode: 'summary' });
    },

    closeShopToFloorSummary: () => {
        const { run, shopReturnMode } = get();
        const transition = resolveNavigationTransition(get(), 'closeShopToFloorSummary');
        set({
            view: transition.view,
            run: shopReturnMode === 'floor' && run ? resumeRunWithTimers(run) : run,
            shopReturnMode: null
        });
    },

    continueFromShop: () => {
        const { run, shopReturnMode } = get();
        if (shopReturnMode === 'floor') {
            const transition = resolveNavigationTransition(get(), 'closeShopToFloorSummary');
            set({
                view: transition.view,
                run: run ? resumeRunWithTimers(run) : run,
                shopReturnMode: null
            });
            return;
        }
        if (!run || run.status !== 'levelComplete') {
            const transition = resolveNavigationTransition(get(), 'closeShopToFloorSummary');
            set({ view: transition.view, shopReturnMode: null });
            return;
        }
        set({ shopReturnMode: null });
        get().continueToNextLevel();
    },

    claimSideRoomPrimary: () => {
        const { run } = get();
        if (!run || run.status !== 'levelComplete' || !run.sideRoom) {
            set({ view: 'playing' });
            return;
        }
        const nextRun = claimRouteSideRoomPrimary(run);
        if (nextRun.shopOffers.length > 0) {
            set({
                run: nextRun,
                view: 'shop',
                shopReturnMode: 'summary',
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
            return;
        }
        set({ run: nextRun, view: 'playing' });
        get().continueToNextLevel();
    },

    claimSideRoomChoice: (choiceId: string) => {
        const { run } = get();
        if (!run || run.status !== 'levelComplete' || !run.sideRoom) {
            set({ view: 'playing' });
            return;
        }
        const nextRun = claimRouteSideRoomChoice(run, choiceId);
        if (nextRun.shopOffers.length > 0) {
            set({
                run: nextRun,
                view: 'shop',
                shopReturnMode: 'summary',
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
            return;
        }
        set({ run: nextRun, view: 'playing' });
        get().continueToNextLevel();
    },

    skipSideRoom: () => {
        const { run } = get();
        if (!run || run.status !== 'levelComplete' || !run.sideRoom) {
            set({ view: 'playing' });
            return;
        }
        const nextRun = skipRouteSideRoom(run);
        if (nextRun.shopOffers.length > 0) {
            set({
                run: nextRun,
                view: 'shop',
                shopReturnMode: 'summary',
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
            return;
        }
        set({ run: nextRun, view: 'playing' });
        get().continueToNextLevel();
    },

    closeSubscreen: () => {
        const { run } = get();
        const transition = resolveNavigationTransition(get(), 'closeSubscreen');

        if (transition.resumeRun) {
            const nextRun = run?.status === 'paused' ? resumeRunWithTimers(run) : run;
            set({
                view: transition.view,
                subscreenReturnView: transition.subscreenReturnView,
                run: nextRun ?? null
            });
            return;
        }

        set({ view: transition.view, subscreenReturnView: transition.subscreenReturnView });
    },

    openSettings: (returnView = 'menu') => {
        const { run } = get();
        const transition = resolveNavigationTransition(get(), 'openSettings', returnView);

        if (transition.freezeRun && run) {
            const nextRun = freezeRunSnapshotForPlayingMetaOverlay(run);

            clearAllTimers();
            set({
                view: transition.view,
                settingsReturnView: transition.settingsReturnView,
                run: nextRun
            });
            return;
        }

        set({
            view: transition.view,
            settingsReturnView: transition.settingsReturnView
        });
    },

    closeSettings: () => {
        const { run } = get();
        const transition = resolveNavigationTransition(get(), 'closeSettings');

        if (transition.resumeRun) {
            const nextRun = run?.status === 'paused' ? resumeRunWithTimers(run) : run;
            set({
                view: transition.view,
                settingsReturnView: transition.settingsReturnView,
                run: nextRun ?? null
            });
            return;
        }

        set({ view: transition.view, settingsReturnView: transition.settingsReturnView });
    },

    updateSettings: async (settings) => {
        const persistedSettings = await persistSaveSettings(settings);
        const nextSave = normalizeSaveData({
            ...get().saveData,
            settings: persistedSettings
        });

        set({
            settings: persistedSettings,
            saveData: nextSave
        });
    },

    dismissHowToPlay: async () => {
        const nextSave = normalizeSaveData({
            ...get().saveData,
            onboardingDismissed: true
        });

        set({
            saveData: nextSave,
            settings: nextSave.settings
        });

        await persistSaveDataSafely(nextSave);
    },

    pressTile: (tileId) => {
        const { run, view, boardPinMode, destroyPairArmed, peekModeArmed } = get();

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
            const flippedBefore = run.board?.flippedTileIds.length ?? 0;
            const nextRun = flipTile(run, tileId);
            if (nextRun === run) {
                return;
            }
            const flippedAfter = nextRun.board?.flippedTileIds.length ?? 0;
            if (flippedAfter > flippedBefore) {
                void resumeAudioContext();
                const g = sfxGainFromStore();
                playFlipSfx(g);
                if (flippedAfter === 3) {
                    playGambitCommitSfx(g);
                }
            }
            if (nextRun.status === 'gameOver') {
                applyImmediateGameOverFromTilePress(nextRun);
                return;
            }
            set({ run: nextRun, peekModeArmed: false });
            if (nextRun.status === 'resolving' && nextRun.timerState.resolveRemainingMs !== null) {
                scheduleResolveTimer(nextRun.timerState.resolveRemainingMs);
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

        let actionRun = run;
        let pressedTile = actionRun.board?.tiles.find((tile) => tile.id === tileId) ?? null;
        const flippedBefore = actionRun.board?.flippedTileIds.length ?? 0;
        const hazardRun = applyEnemyHazardClick(actionRun, tileId, { advanceHazards: flippedBefore === 0 });
        const enemyContacted = hazardRun !== actionRun;
        if (enemyContacted) {
            void resumeAudioContext();
            playResolveSfx(run, hazardRun, sfxGainFromStore());
            if (hazardRun.status === 'gameOver') {
                applyResolvedRun(hazardRun);
                set({
                    boardPinMode: false,
                    destroyPairArmed: false,
                    peekModeArmed: false,
                    ...BOARD_FLOATER_POP_CLEAR
                });
                return;
            }
            actionRun = hazardRun;
            pressedTile = actionRun.board?.tiles.find((tile) => tile.id === tileId) ?? pressedTile;
        }

        if (pressedTile?.pairKey === EXIT_PAIR_KEY) {
            const nextRun = revealDungeonExit(actionRun, tileId);
            if (nextRun !== actionRun) {
                void resumeAudioContext();
                playFlipSfx(sfxGainFromStore());
            }
            set({
                run: nextRun,
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                dungeonExitPromptOpen: true
            });
            return;
        }
        if (pressedTile?.pairKey === SHOP_PAIR_KEY) {
            const nextRun = revealDungeonShop(actionRun, tileId);
            if (nextRun === actionRun || nextRun.shopOffers.length === 0) {
                return;
            }
            void resumeAudioContext();
            playFlipSfx(sfxGainFromStore());
            clearAllTimers();
            set({
                run: freezeRunSnapshotForPlayingMetaOverlay(nextRun),
                view: 'shop',
                shopReturnMode: 'floor',
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
            return;
        }
        if (pressedTile?.pairKey === ROOM_PAIR_KEY) {
            const nextRun = revealDungeonRoom(actionRun, tileId);
            if (nextRun !== actionRun) {
                void resumeAudioContext();
                playFlipSfx(sfxGainFromStore());
                set({
                    run: nextRun,
                    boardPinMode: false,
                    destroyPairArmed: false,
                    peekModeArmed: false
                });
            }
            return;
        }

        if (!enemyContacted && boardPinMode) {
            const nextRun = togglePinnedTile(actionRun, tileId);
            if (nextRun !== actionRun) {
                set({ run: nextRun });
            }
            return;
        }

        if (!enemyContacted && actionRun.strayRemoveArmed) {
            const nextRun = applyStrayRemove(actionRun, tileId);
            if (nextRun !== actionRun) {
                void resumeAudioContext();
                playStrayPowerSfx(sfxGainFromStore());
                set({ run: nextRun });
            }
            return;
        }

        if (
            !enemyContacted &&
            peekModeArmed &&
            actionRun.peekCharges > 0 &&
            actionRun.board &&
            actionRun.board.flippedTileIds.length === 0
        ) {
            const nextRun = applyPeek(actionRun, tileId);
            if (nextRun !== actionRun) {
                void resumeAudioContext();
                playPeekPowerSfx(sfxGainFromStore());
                set({ run: nextRun, peekModeArmed: false });
            }
            return;
        }

        if (!enemyContacted && destroyPairArmed) {
            const nextRun = applyDestroyPair(actionRun, tileId);
            if (nextRun === actionRun) {
                return;
            }

            void resumeAudioContext();
            playDestroyPairSfx(sfxGainFromStore());

            set({ run: nextRun, destroyPairArmed: false, peekModeArmed: false });

            if (nextRun.status === 'levelComplete' || nextRun.status === 'gameOver') {
                applyResolvedRun(nextRun);
            }
            return;
        }

        const nextRun = flipTile(actionRun, tileId);

        if (nextRun === actionRun) {
            if (enemyContacted) {
                set({
                    run: actionRun,
                    boardPinMode: false,
                    destroyPairArmed: false,
                    peekModeArmed: false,
                    ...BOARD_FLOATER_POP_CLEAR
                });
            }
            return;
        }

        const flippedAfter = nextRun.board?.flippedTileIds.length ?? 0;
        if (flippedAfter > flippedBefore) {
            void resumeAudioContext();
            playFlipSfx(sfxGainFromStore());
        }
        if (nextRun.dungeonTrapsTriggered > actionRun.dungeonTrapsTriggered) {
            void resumeAudioContext();
            playTrapSfx(sfxGainFromStore());
        }

        if (nextRun.status === 'gameOver') {
            applyImmediateGameOverFromTilePress(nextRun);
            return;
        }

        set({
            run: nextRun,
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false
        });

        if (nextRun.status === 'resolving' && nextRun.timerState.resolveRemainingMs !== null) {
            scheduleResolveTimer(nextRun.timerState.resolveRemainingMs);
        }
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
        const { run, view, boardPinMode, destroyPairArmed, peekModeArmed } = get();
        if (!run || view !== 'playing' || run.status !== 'playing' || run.peekCharges < 1) {
            return;
        }
        if (boardPinMode || destroyPairArmed) {
            return;
        }
        const nextPeekArmed = !peekModeArmed;
        const nextRun = run.strayRemoveArmed ? { ...run, strayRemoveArmed: false } : run;
        if (nextPeekArmed) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore());
        }
        set({
            peekModeArmed: nextPeekArmed,
            run: nextRun
        });
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
        if (!run || view !== 'playing' || run.status !== 'playing') {
            return;
        }
        const wasArmed = run.strayRemoveArmed;
        const nextRun = toggleStrayRemoveArmed(run);
        if (nextRun !== run) {
            if (nextRun.strayRemoveArmed && !wasArmed) {
                void resumeAudioContext();
                playPowerArmSfx(sfxGainFromStore());
            }
            set({
                run: nextRun,
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false
            });
        }
    },

    shuffleBoard: () => {
        const { run, view } = get();

        if (!run || view !== 'playing' || run.status !== 'playing') {
            return;
        }

        const nextRun = applyShuffle(run);
        if (nextRun !== run) {
            set({ run: nextRun });
        }
    },

    armRegionShuffleRowPick: (row) => {
        const { run, view } = get();
        if (!run || view !== 'playing' || run.status !== 'playing') {
            return;
        }
        const nextRun = armRegionShuffleRow(run, row);
        if (nextRun !== run) {
            set({ run: nextRun, boardPinMode: false, destroyPairArmed: false, peekModeArmed: false });
        }
    },

    shuffleRegionRow: (row) => {
        const { run, view } = get();
        if (!run || view !== 'playing' || run.status !== 'playing') {
            return;
        }
        const nextRun = applyRegionShuffle(run, row);
        if (nextRun !== run) {
            set({ run: nextRun, boardPinMode: false, destroyPairArmed: false, peekModeArmed: false });
        }
    },

    notifyMemorizeBoardReady: (boardKey) => {
        const { run, view } = get();
        if (
            !run ||
            view !== 'playing' ||
            run.status !== 'memorize' ||
            run.timerState.memorizeRemainingMs === null ||
            memorizeTimer ||
            pendingMemorizeBoardKey !== boardKey ||
            getMemorizeBoardKey(run) !== boardKey
        ) {
            return;
        }

        scheduleMemorizeTimer(run.timerState.memorizeRemainingMs);
    },

    applyFlashPairPower: () => {
        const { run, view } = get();
        if (!run || view !== 'playing' || run.status !== 'playing') {
            return;
        }
        if (!run.practiceMode && !run.wildMenuRun) {
            return;
        }
        const nextRun = applyFlashPair(run);
        if (nextRun !== run) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore() * 0.78);
            set({ run: nextRun });
        }
    },

    toggleBoardPinMode: () => {
        const { boardPinMode, run, view } = get();
        const next = !boardPinMode;
        if (next && run && view === 'playing' && run.status === 'playing') {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore() * 0.92);
        }
        set({
            boardPinMode: next,
            destroyPairArmed: false,
            peekModeArmed: false
        });
    },

    toggleDestroyPairArmed: () => {
        const { destroyPairArmed, run, view } = get();
        const next = !destroyPairArmed;
        if (next && run && view === 'playing' && run.status === 'playing' && run.destroyPairCharges > 0) {
            void resumeAudioContext();
            playPowerArmSfx(sfxGainFromStore());
        }
        set({
            destroyPairArmed: next,
            boardPinMode: false,
            peekModeArmed: false
        });
    },

    pause: () => {
        const { run } = get();

        if (!run) {
            return;
        }

        const pausedRun = freezeRun(run);
        clearAllTimers();
        void resumeUiSfxContext();
        playPauseOpenSfx(sfxGainFromStore());
        set({ run: pausedRun, ...BOARD_FLOATER_POP_CLEAR });
    },

    resume: () => {
        const { run } = get();

        if (!run) {
            return;
        }

        void resumeUiSfxContext();
        playPauseResumeSfx(sfxGainFromStore());
        set({ run: resumeRunWithTimers(run) });
    },

    acceptEndlessRiskWager: () => {
        const { run } = get();

        if (!run) {
            return;
        }

        void resumeAudioContext();
        playWagerArmSfx(sfxGainFromStore());
        set({ run: acceptEndlessRiskWagerRule(run) });
    },

    purchaseShopOffer: (offerId) => {
        const { run, view, shopReturnMode } = get();
        if (!run || view !== 'shop' || (run.status !== 'levelComplete' && shopReturnMode !== 'floor')) {
            return;
        }
        set({ run: purchaseShopOfferRule(run, offerId) });
    },

    rerollShopOffers: () => {
        const { run, view, shopReturnMode } = get();
        if (!run || view !== 'shop' || (run.status !== 'levelComplete' && shopReturnMode !== 'floor')) {
            return;
        }
        set({ run: rerollShopOffersRule(run) });
    },

    continueToNextLevel: () => {
        let { run } = get();

        if (!run || run.status !== 'levelComplete' || run.gameMode === 'puzzle' || run.relicOffer) {
            return;
        }

        clearAllTimers();

        if (run.status === 'levelComplete' && run.sideRoom) {
            set({
                view: 'sideRoom',
                run,
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
            return;
        }

        if (run.status === 'levelComplete' && needsRelicPick(run) && !run.relicOffer) {
            const offerRun = openRelicOffer(run);
            if (offerRun.relicOffer) {
                set({
                    view: 'playing',
                    run: offerRun,
                    boardPinMode: false,
                    destroyPairArmed: false,
                    peekModeArmed: false,
                    ...BOARD_FLOATER_POP_CLEAR
                });
                return;
            }
            run = offerRun;
        }

        const nextRun = advanceToNextLevel(run);

        if (nextRun.status === 'gameOver') {
            applyResolvedRun(nextRun);
            return;
        }

        set({
            newlyUnlockedAchievements: [],
            view: 'playing',
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run: nextRun,
            ...BOARD_FLOATER_POP_CLEAR
        });

        prepareMemorizeTimerForBoardReady(nextRun);
    },

    chooseRouteAndContinue: (choiceId) => {
        const { run } = get();

        if (!run || run.status !== 'levelComplete') {
            return;
        }
        if (run.pendingRouteCardPlan) {
            get().continueToNextLevel();
            return;
        }

        const routeOutcome = applyRouteChoiceOutcome(run, choiceId);
        if (!routeOutcome.applied) {
            return;
        }

        clearAllTimers();

        const routeRun = openRouteSideRoom(routeOutcome.run);

        if (routeRun.sideRoom) {
            set({
                view: 'sideRoom',
                run: routeRun,
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
            return;
        }

        if (routeRun.shopOffers.length > 0) {
            set({
                view: 'shop',
                run: routeRun,
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
            return;
        }

        let nextRouteRun = routeRun;

        if (needsRelicPick(nextRouteRun) && !nextRouteRun.relicOffer) {
            const offerRun = openRelicOffer(nextRouteRun);
            if (offerRun.relicOffer) {
                set({
                    view: 'playing',
                    run: offerRun,
                    boardPinMode: false,
                    destroyPairArmed: false,
                    peekModeArmed: false,
                    ...BOARD_FLOATER_POP_CLEAR
                });
                return;
            }
            nextRouteRun = offerRun;
        }

        if (nextRouteRun.relicOffer) {
            set({ run: nextRouteRun });
            return;
        }

        const nextRun = advanceToNextLevel(nextRouteRun);

        if (nextRun.status === 'gameOver') {
            applyResolvedRun(nextRun);
            return;
        }

        set({
            newlyUnlockedAchievements: [],
            view: 'playing',
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run: nextRun,
            ...BOARD_FLOATER_POP_CLEAR
        });

        prepareMemorizeTimerForBoardReady(nextRun);
    },

    restartRun: () => {
        clearAllTimers();
        const prev = get().run;
        const best = get().saveData.bestScore;
        const save = get().saveData;
        const meta = metaRelicOpts(save);
        const settings = get().settings;
        let run: RunState;
        if (prev?.gameMode === 'daily') {
            run = createDailyRun(best, meta);
        } else if (prev?.gameMode === 'gauntlet') {
            run = createGauntletRun(best, prev.gauntletSessionDurationMs ?? 10 * 60 * 1000, meta);
        } else if (prev?.gameMode === 'puzzle' && prev.puzzleId) {
            const puzzle = BUILTIN_PUZZLES[prev.puzzleId];
            run = puzzle ? createPuzzleRun(best, puzzle.id, puzzle.tiles, 1, meta) : createNewRun(best, meta);
        } else if (prev?.gameMode === 'meditation') {
            run = createMeditationRun(
                best,
                prev.activeMutators.length > 0 ? prev.activeMutators : undefined,
                meta
            );
        } else if (prev?.activeContract?.maxPinsTotalRun != null) {
            run = createNewRun(best, { ...meta, activeContract: prev.activeContract });
        } else if (prev?.wildMenuRun) {
            run = createWildRun(best, meta);
        } else if (prev?.practiceMode) {
            run = createNewRun(best, { practiceMode: true, ...meta });
        } else if (prev?.activeContract?.noShuffle && prev.activeContract.noDestroy) {
            run = createNewRun(best, {
                ...meta,
                activeContract: prev.activeContract
            });
        } else {
            run = createNewRun(best, meta);
        }
        run = patchRunFromUserSettings(run, settings);

        trackEvent('run_start', { mode: run.gameMode, practice: run.practiceMode, restarted: true });
        playRunStartUiSfxFromStore();

        set({
            view: 'playing',
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            ...BOARD_FLOATER_POP_CLEAR
        });

        prepareMemorizeTimerForBoardReady(run);
    },

    endRun: () => {
        clearAllTimers();
        set({
            view: 'menu',
            run: null,
            newlyUnlockedAchievements: [],
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            subscreenReturnView: 'menu',
            settingsReturnView: 'menu',
            ...BOARD_FLOATER_POP_CLEAR
        });
    },

    triggerDebugReveal: () => {
        const { run, settings } = get();

        if (!run || run.status !== 'playing' || !settings.debugFlags.allowBoardReveal) {
            return;
        }

        const nextRun = enableDebugPeek(run, settings.debugFlags.disableAchievementsOnDebug);

        set({ run: nextRun });

        if (nextRun.timerState.debugRevealRemainingMs !== null) {
            scheduleDebugRevealTimer(nextRun.timerState.debugRevealRemainingMs);
        }
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
