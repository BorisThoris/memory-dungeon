import { ACHIEVEMENTS } from '../../shared/achievements';
import {
    MAX_PINNED_TILES,
    type AchievementId,
    type RunState,
    type Settings
} from '../../shared/contracts';
import { computeFocusDimmedTileIds } from '../../shared/focusDimmedTileIds';
import { getPrimaryRewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import {
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard
} from '../../shared/board-powers';
import {
    getDungeonBoardPresentation,
    getDungeonExitStatus
} from '../../shared/dungeon-rules';
import { useNotificationStore } from '@cross-repo-libs/notifications';
import type { CSSProperties } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { runPersistenceInBackground } from '../store/backgroundPersistence';
import { UI_ART } from '../assets/ui';
import { isNarrowShortLandscapeForMenuStack } from '../breakpoints';
import { deriveCameraViewportMode, latchPhoneWidthForMobileCamera } from '../../shared/cameraViewportMode';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { useDistractionChannelTick } from '../hooks/useDistractionChannelTick';
import { useEffectiveReducedMotion } from '../hooks/useEffectiveReducedMotion';
import { useLatestRef } from '../hooks/useLatestRef';
import {
    formatHudActionFeedbackText,
    useHudPoliteLiveAnnouncement
} from '../hooks/useHudPoliteLiveAnnouncement';
import { useViewportSize } from '../hooks/useViewportSize';
import {
    buildRelicDraftBonusFootnoteLines,
    getRelicOfferSubtitle,
    getRelicOfferTitle,
    relicDraftProgressLine,
    relicEffectLabels
} from '../copy/relicDraftOffer';
import { GAMBIT_KEYBOARD_HELP_TIP } from '../copy/gameplayHints';
import { GAMEPLAY_SHORTCUT_ROWS } from '../keyboard/gameplayShortcuts';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import { StatTile } from '../ui';
import { useAppStore } from '../store/useAppStore';
import {
    getLatestBoardTurnResolvedEvent,
    getLatestGameplayFeedbackBatch
} from '../store/gameplayFeedbackAdapter';
import GameLeftToolbar from './GameLeftToolbar';
import { GameScreenActionFeedbackRail } from './GameScreenActionFeedbackRail';
import { GameScreenDungeonRunStrip } from './GameScreenDungeonRunStrip';
import { GameScreenDungeonStatusPanel } from './GameScreenDungeonStatusPanel';
import { GameScreenEndlessChapterBanner } from './GameScreenEndlessChapterBanner';
import { GameScreenBoardFloater } from './GameScreenBoardFloater';
import { GameScreenFloorClearResult } from './GameScreenFloorClearResult';
import { GameScreenRouteChoicePanel } from './GameScreenRouteChoicePanel';
import {
    GameScreenActiveRouteFeedback,
    GameScreenSelectedRouteFeedback,
    getGameScreenRouteConsequenceProjection
} from './GameScreenRouteConsequenceFeedback';
import GameplayHudBar from './GameplayHudBar';
import MainMenuBackground from './MainMenuBackground';
import OverlayModal from './OverlayModal';
import RelicDraftOfferPanel from './RelicDraftOfferPanel';
import { useGameScreenBoardVisualSettings } from './gameScreenStoreSelectors';
import { getInventoryPayoffEngineSignal } from './inventoryScreenModel';
import TileBoard, { type TileBoardHandle } from './TileBoard';

const MemoTileBoard = memo(TileBoard);
const MemoGameplayHudBar = memo(GameplayHudBar);
import {
    playCountdownPressureSfx,
    playMismatchRecoveryCrescendoSfx,
    playRelicOfferOpenSfx,
    resumeAudioContext,
    sfxGainFromSettings
} from '../audio/gameSfx';
import {
    playMenuOpenSfx,
    playUiBackSfx,
    playUiClickSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { GAMEPLAY_VISUAL_CSS_VARS } from './gameplayVisualConfig';
import { REG104_DATA_SHELL } from '../gameplay/regPhase4PlayContract';
import styles from './GameScreen.module.css';
import {
    getDungeonCombatLogRows,
    getVisualHudAnnouncementFollowup,
    getVisualHudAnnouncementImpact,
    getVisualHudAnnouncementSignal
} from './gameScreenFeedback';
import {
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS
} from './matchScoreFloaterTiming';
import { getStickyBlockedTileId } from '../gameplay/stickyFingersBlockedTileId';
import { useGameScreenPowerTileHints } from './useGameScreenPowerTileHints';
import { useGameScreenTraitRouteTargets } from './useGameScreenTraitRouteTargets';
import { MUTATOR_CATALOG } from '../../shared/mechanics-encyclopedia';
import {
    getBoardMatchPayoffStackAction,
    getBoardMatchPayoffStackAudioCue,
    getBoardMatchPayoffStackBeatCount,
    getBoardMatchPayoffStackScreenCue,
    useGameScreenBoardFloaterProjection
} from './gameScreenBoardModels';
import {
    GAMBIT_SIGNAL_ROWS_LABEL,
    RiskWagerPrimaryCueView,
    RiskWagerSignalRowsView,
    TUTORIAL_PAIR_MARKER_MAX_LEVEL,
    dungeonExitPromptLockLine,
    dungeonExitPromptTitle,
    formatGameplaySignalRowsLabel,
    getGambitSignalAudioCue,
    getGambitSignalBeatCount,
    getGambitSignalScreenCue,
    getOnboardingPromptSignalAudioCue,
    getOnboardingPromptSignalBeatCount,
    getOnboardingPromptSignalScreenCue,
    getOnboardingPromptSignals,
    routeTypeLabel
} from './gameScreenDecisionSignals';
import {
    getPickupStackToastText
} from './gameScreenFloorClearFeedbackModel';
import { useGameScreenFloorClearProjection } from './useGameScreenFloorClearProjection';
import { useGameScreenRouteChoiceProjection } from './useGameScreenRouteChoiceProjection';

/** OVR-007 / HUD-020: decoy readout for `distraction_channel` — not gameplay state; hidden when reduce motion or assist toggle is off. */
const DISTRACTION_CHANNEL_LABEL = 'Chaff';

const DESKTOP_FULL_BLEED_TILE_BOARD_FRAME_STYLE: CSSProperties = {
    height: '100%',
    inset: 0,
    position: 'absolute',
    width: '100%'
};

interface GameScreenProps {
    achievements: AchievementId[];
    run: RunState;
    suppressStatusOverlays?: boolean;
}

const GameScreen = ({ achievements, run, suppressStatusOverlays = false }: GameScreenProps) => {
    const shellRef = useRef<HTMLElement | null>(null);
    const boardStageRef = useRef<HTMLDivElement | null>(null);
    const boardFloaterRef = useRef<HTMLDivElement | null>(null);
    const mismatchRecoveryCrescendoSfxSignatureRef = useRef<string | null>(null);
    const tileBoardRef = useRef<TileBoardHandle>(null);
    const { height, width } = useViewportSize();
    const [phoneViewportLatched, setPhoneViewportLatched] = useState(() =>
        latchPhoneWidthForMobileCamera(width, false)
    );
    useEffect(() => {
        queueMicrotask(() => {
            setPhoneViewportLatched((prev) => latchPhoneWidthForMobileCamera(width, prev));
        });
    }, [width]);
    const isPhoneViewport = phoneViewportLatched;
    const compactTouchChrome = isPhoneViewport || isNarrowShortLandscapeForMenuStack(width, height);
    const [viewportResetToken, setViewportResetToken] = useState(0);
    const [gauntletNowMs, setGauntletNowMs] = useState(() => Date.now());
    const [rulesHintsExpanded, setRulesHintsExpanded] = useState(false);
    const [abandonRunConfirmOpen, setAbandonRunConfirmOpen] = useState(false);
    const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
    useEffect(() => {
        if (run.gauntletDeadlineMs === null) {
            return;
        }
        const tick = (): void => {
            setGauntletNowMs(Date.now());
        };
        tick();
        const id = window.setInterval(tick, 300);
        return () => window.clearInterval(id);
    }, [run.gauntletDeadlineMs]);
    useEffect(() => {
        if (!compactTouchChrome) {
            return;
        }
        const id = window.setTimeout(() => {
            setRulesHintsExpanded(false);
        }, 0);
        return () => window.clearTimeout(id);
    }, [compactTouchChrome]);
    const gameScreenActions = useAppStore(
        useShallow((state) => ({
            applyFlashPairPower: state.applyFlashPairPower,
            acceptEndlessRiskWager: state.acceptEndlessRiskWager,
            activateDungeonExitFromPrompt: state.activateDungeonExitFromPrompt,
            chooseRouteAndContinue: state.chooseRouteAndContinue,
            closeDungeonExitPrompt: state.closeDungeonExitPrompt,
            continueToNextLevel: state.continueToNextLevel,
            dismissPowersFtue: state.dismissPowersFtue,
            goToMenu: state.goToMenu,
            applyRelicOfferService: state.applyRelicOfferService,
            openCodexFromPlaying: state.openCodexFromPlaying,
            openInventoryFromPlaying: state.openInventoryFromPlaying,
            openShopFromLevelComplete: state.openShopFromLevelComplete,
            openSettings: state.openSettings,
            notifyMemorizeBoardReady: state.notifyMemorizeBoardReady,
            pause: state.pause,
            pickRelic: state.pickRelic,
            resume: state.resume,
            shuffleBoard: state.shuffleBoard,
            shuffleRegionRow: state.shuffleRegionRow,
            toggleBoardPinMode: state.toggleBoardPinMode,
            toggleDestroyPairArmed: state.toggleDestroyPairArmed,
            togglePeekMode: state.togglePeekMode,
            toggleTileSwapArmed: state.toggleTileSwapArmed,
            toggleStrayArm: state.toggleStrayArm,
            triggerDebugReveal: state.triggerDebugReveal,
            undoResolvingFlip: state.undoResolvingFlip
        }))
    );
    const dungeonExitPromptOpen = useAppStore((state) => state.dungeonExitPromptOpen);
    const saveData = useAppStore((state) => state.saveData);
    const {
        boardBloomEnabled: settingsBoardBloomEnabled,
        boardPresentation: settingsBoardPresentation,
        boardScreenSpaceAA: settingsBoardScreenSpaceAA,
        cameraViewportModePreference: settingsCameraViewportModePreference,
        distractionChannelEnabled: settingsDistractionChannelEnabled,
        graphicsQuality: settingsGraphicsQuality,
        pairProximityHintsEnabled: settingsPairProximityHintsEnabled,
        tileFocusAssist: settingsTileFocusAssist,
        debugAllowBoardReveal: debugAllowBoardReveal,
        debugDisableAchievementsOnDebug: debugDisableAchievementsOnDebug,
        debugShowDebugTools: debugShowDebugTools
    } = useGameScreenBoardVisualSettings();
    const showTutorialPairMarkers = useMemo(
        () =>
            Boolean(
                run.board &&
                    !saveData.powersFtueSeen &&
                    run.board.level <= TUTORIAL_PAIR_MARKER_MAX_LEVEL
            ),
        [run.board, saveData.powersFtueSeen]
    );
    const onboardingStep = getPlayableOnboardingStep(run, saveData);
    const onboardingBoardTargetIds = useMemo(() => onboardingStep?.targetTileIds ?? [], [onboardingStep]);
    const onboardingPromptSignals = onboardingStep ? getOnboardingPromptSignals(onboardingStep.id) : [];
    const firstRunRoomGoalSignals = getOnboardingPromptSignals('room_goal');
    const onboardingPromptSignalsLabel = formatGameplaySignalRowsLabel(
        'Onboarding action and reward signals',
        onboardingPromptSignals
    );
    const firstRunRoomGoalSignalsLabel = formatGameplaySignalRowsLabel(
        'Room goal reward signals',
        firstRunRoomGoalSignals
    );
    const firstRunRoomGoalPrompt =
        !saveData.onboardingDismissed &&
        !onboardingStep &&
        run.status === 'playing' &&
        run.board &&
        run.board.level === 1 &&
        run.board.matchedPairs >= 2 &&
        run.board.matchedPairs < run.board.pairCount
            ? {
                  title: 'Room goal',
                  prompt: 'Clear the remaining pairs',
                  detail: 'Each clean pair moves the room toward its exit. Clearing the floor opens the first route choice.'
              }
            : null;
    const rulesHintNudge =
        onboardingStep?.prompt ??
        (showTutorialPairMarkers
            ? 'First run: match identical symbols. Pair markers fade after floor 2.'
            : run.activeMutators.length > 0 && run.board?.matchedPairs === 0
              ? `New pressure: ${run.activeMutators.map((id) => MUTATOR_CATALOG[id]?.title ?? id).join(', ')}.`
              : null);
    const { boardPinMode, destroyPairArmed, peekModeArmed, strayRemoveArmed, tileSwapArmed, tileSwapFirstTileId } = useAppStore(
        useShallow((state) => ({
            boardPinMode: state.boardPinMode,
            destroyPairArmed: state.destroyPairArmed,
            peekModeArmed: state.peekModeArmed,
            strayRemoveArmed: state.strayRemoveArmed,
            tileSwapArmed: state.tileSwapArmed,
            tileSwapFirstTileId: state.tileSwapFirstTileId
        }))
    );
    const { persistenceWriteNotice, clearPersistenceWriteNotice } = useAppStore(
        useShallow((state) => ({
            persistenceWriteNotice: state.persistenceWriteNotice,
            clearPersistenceWriteNotice: state.clearPersistenceWriteNotice
        }))
    );
    const settingsReduceMotion = useAppStore((state) => state.settings.reduceMotion);
    const reduceMotion = useEffectiveReducedMotion(settingsReduceMotion);

    const { matchScorePop, mismatchScorePop, dismissMatchScorePop, dismissMismatchScorePop } = useAppStore(
        useShallow((state) => ({
            matchScorePop: state.matchScorePop,
            mismatchScorePop: state.mismatchScorePop,
            dismissMatchScorePop: state.dismissMatchScorePop,
            dismissMismatchScorePop: state.dismissMismatchScorePop
        }))
    );

    const boardFloaterProjection = useGameScreenBoardFloaterProjection({
        matchScorePop,
        mismatchScorePop,
        reduceMotion
    });
    const {
        boardFloaterPayload,
        boardFloaterDurationMs,
        boardFloaterMismatchRecoveryCrescendo,
        boardFloaterLiveText,
        boardMatchPayoffStackCue,
        boardMatchPayoffStackFill,
        boardRecoveryContext
    } = boardFloaterProjection;

    const [boardFloaterPos, setBoardFloaterPos] = useState<{ x: number; y: number } | null>(null);

    useLayoutEffect(() => {
        if (!boardFloaterPayload) {
            /* Floater teardown must track payload removal synchronously before paint (tests + hit-testing). */
            // eslint-disable-next-line react-hooks/set-state-in-effect -- layout sync in useLayoutEffect
            setBoardFloaterPos(null);
            return;
        }

        const stageEl = boardStageRef.current;

        if (!stageEl) {
            return;
        }

        const stageRect = stageEl.getBoundingClientRect();
        const handle = tileBoardRef.current;
        const ra = handle?.getTileClientRectById?.(boardFloaterPayload.tileIdA) ?? null;
        const rb = handle?.getTileClientRectById?.(boardFloaterPayload.tileIdB) ?? null;
        const rc =
            boardFloaterPayload.kind === 'miss' && boardFloaterPayload.tileIdC
                ? handle?.getTileClientRectById?.(boardFloaterPayload.tileIdC) ?? null
                : null;

        let cx = stageRect.width / 2;
        let cy = stageRect.height / 2;

        if (ra && rb && rc) {
            const ax = ra.left + ra.width / 2 - stageRect.left;
            const ay = ra.top + ra.height / 2 - stageRect.top;
            const bx = rb.left + rb.width / 2 - stageRect.left;
            const by = rb.top + rb.height / 2 - stageRect.top;
            const cx3 = rc.left + rc.width / 2 - stageRect.left;
            const cy3 = rc.top + rc.height / 2 - stageRect.top;
            cx = (ax + bx + cx3) / 3;
            cy = (ay + by + cy3) / 3;
        } else if (ra && rb) {
            const ax = ra.left + ra.width / 2 - stageRect.left;
            const ay = ra.top + ra.height / 2 - stageRect.top;
            const bx = rb.left + rb.width / 2 - stageRect.left;
            const by = rb.top + rb.height / 2 - stageRect.top;
            cx = (ax + bx) / 2;
            cy = (ay + by) / 2;
        }

        setBoardFloaterPos({ x: cx, y: cy });
    }, [boardFloaterPayload]);

    useEffect(() => {
        if (!boardFloaterPayload || !boardFloaterPos) {
            return;
        }

        const el = boardFloaterRef.current;

        if (!el) {
            return;
        }

        let settled = false;

        const dismiss =
            boardFloaterPayload.kind === 'match' ? dismissMatchScorePop : dismissMismatchScorePop;

        const finish = (): void => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(fallbackId);
            dismiss();
        };

        el.addEventListener('animationend', finish, { once: true });
        /** DOM `setTimeout` id (number); avoids Node `Timeout` typing clashes in `tsc`. */
        const fallbackId = window.setTimeout(finish, boardFloaterDurationMs + MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS);

        return () => {
            el.removeEventListener('animationend', finish);
            window.clearTimeout(fallbackId);
        };
    }, [
        boardFloaterPayload,
        boardFloaterPos,
        boardFloaterDurationMs,
        dismissMatchScorePop,
        dismissMismatchScorePop
    ]);
    const settingsMasterVolume = useAppStore((state) => state.settings.masterVolume);
    const settingsSfxVolume = useAppStore((state) => state.settings.sfxVolume);
    const shuffleSfxGain = useMemo(
        () => sfxGainFromSettings(settingsMasterVolume, settingsSfxVolume),
        [settingsMasterVolume, settingsSfxVolume]
    );
    const uiGain = useMemo(
        () => uiSfxGainFromSettings(settingsMasterVolume, settingsSfxVolume),
        [settingsMasterVolume, settingsSfxVolume]
    );
    useEffect(() => {
        if (boardFloaterPayload?.kind !== 'miss' || !boardFloaterMismatchRecoveryCrescendo) {
            mismatchRecoveryCrescendoSfxSignatureRef.current = null;
            return;
        }
        const signature = [
            boardFloaterPayload.key,
            boardFloaterMismatchRecoveryCrescendo.tier,
            boardFloaterMismatchRecoveryCrescendo.beatCount
        ].join(':');
        if (mismatchRecoveryCrescendoSfxSignatureRef.current === signature) {
            return;
        }
        mismatchRecoveryCrescendoSfxSignatureRef.current = signature;
        void resumeAudioContext();
        playMismatchRecoveryCrescendoSfx(
            shuffleSfxGain,
            boardFloaterMismatchRecoveryCrescendo.tier,
            boardFloaterMismatchRecoveryCrescendo.beatCount
        );
    }, [boardFloaterMismatchRecoveryCrescendo, boardFloaterPayload, shuffleSfxGain]);
    const seenAchievementToastIdsRef = useRef<Set<string>>(new Set());
    const pickupToastEventRef = useRef<{
        runSeed: number;
        eventId: string | null;
    } | null>(null);
    /** OVR-014: queue unlock toasts while the floor-cleared dialog is up; `continueToNextLevel` clears `newlyUnlockedAchievements` before the next paint. */
    const pendingAchievementToastIdsRef = useRef<AchievementId[]>([]);
    /** FX-015: WebGL bloom is medium+ when the toggle is on; add a light CSS rim only on High to avoid doubling cost on phones at Medium. */
    const boardStageCssBloomClass =
        settingsBoardBloomEnabled && settingsGraphicsQuality === 'high' ? styles.boardStageCssBloom : '';
    const toolbarDebugFlags = useMemo(
        (): Settings['debugFlags'] => ({
            allowBoardReveal: debugAllowBoardReveal,
            disableAchievementsOnDebug: debugDisableAchievementsOnDebug,
            showDebugTools: debugShowDebugTools
        }),
        [debugAllowBoardReveal, debugDisableAchievementsOnDebug, debugShowDebugTools]
    );
    const {
        applyFlashPairPower,
        acceptEndlessRiskWager,
        activateDungeonExitFromPrompt,
        chooseRouteAndContinue,
        closeDungeonExitPrompt,
        continueToNextLevel,
        dismissPowersFtue,
        goToMenu,
        openCodexFromPlaying,
        openInventoryFromPlaying,
        openShopFromLevelComplete,
        openSettings,
        pause,
        applyRelicOfferService,
        pickRelic,
        resume,
        shuffleBoard,
        shuffleRegionRow,
        toggleBoardPinMode,
        toggleDestroyPairArmed,
        togglePeekMode,
        toggleTileSwapArmed,
        toggleStrayArm,
        triggerDebugReveal,
        undoResolvingFlip
    } = gameScreenActions;

    const relicDraftProgressText = run.relicOffer ? relicDraftProgressLine(run.relicOffer) : null;
    const relicBonusFootnoteLines = run.relicOffer ? buildRelicDraftBonusFootnoteLines(run) : [];
    const relicDraftPayoffEngineSignal = run.relicOffer ? getInventoryPayoffEngineSignal(run) : null;
    const gameplayEventJournal = run.gameplayEventJournal;
    const typedGameplayFeedbackBatch = useMemo(
        () => getLatestGameplayFeedbackBatch({ gameplayEventJournal }),
        [gameplayEventJournal]
    );
    const typedBoardTurnEvent = useMemo(
        () => getLatestBoardTurnResolvedEvent({ gameplayEventJournal }),
        [gameplayEventJournal]
    );
    const previousRelicOfferOpenEventIdRef = useRef<string | null>(null);
    const previousCountdownPressureSecondRef = useRef<number | null>(null);
    const announcedTraitRouteSetupKeyRef = useRef<string | null>(null);
    const playMenuOpen = useCallback((): void => {
        resumeUiSfxContext();
        playMenuOpenSfx(uiGain);
    }, [uiGain]);
    const playUiBack = useCallback((): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
    }, [uiGain]);
    const playUiClick = useCallback((): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    }, [uiGain]);

    const handleToolbarViewportReset = useCallback((): void => {
        setViewportResetToken((current) => current + 1);
    }, []);

    const openSettingsPlayingMode = useCallback((): void => {
        openSettings('playing');
    }, [openSettings]);

    const canRegionShuffleRowForRun = useCallback(
        (row: number): boolean => canRegionShuffleRow(run, row),
        [run]
    );

    const handleRequestAbandonRun = useCallback((): void => {
        playMenuOpen();
        setAbandonRunConfirmOpen(true);
    }, [playMenuOpen]);
    const pauseShortcutStateRef = useLatestRef({
        abandonRunConfirmOpen,
        lastLevelResult: run.lastLevelResult,
        pause,
        relicOffer: run.relicOffer,
        resume,
        runStatus: run.status,
        shortcutsHelpOpen
    });
    const shortcutsHelpStateRef = useLatestRef({
        playMenuOpen,
        playUiBack,
        shortcutsHelpOpen
    });

    useEffect(() => {
        const relicOfferOpenFeedback = typedGameplayFeedbackBatch.find(
            (feedback) => feedback.audioCategory === 'relic-offer'
        );
        if (
            !run.relicOffer ||
            !relicOfferOpenFeedback ||
            relicOfferOpenFeedback.eventId === previousRelicOfferOpenEventIdRef.current
        ) {
            return;
        }
        previousRelicOfferOpenEventIdRef.current = relicOfferOpenFeedback.eventId;
        void resumeAudioContext();
        playRelicOfferOpenSfx(shuffleSfxGain);
    }, [run.relicOffer, shuffleSfxGain, typedGameplayFeedbackBatch]);

    /** Pause / resume: toolbar control removed — **P** toggles pause when gameplay is active (not when meta overlays suppress status). */
    useEffect(() => {
        if (suppressStatusOverlays) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || event.repeat) {
                return;
            }
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            if (event.code !== 'KeyP') {
                return;
            }
            const target = event.target;
            if (target instanceof HTMLElement) {
                if (target.closest('input, textarea, select') || target.isContentEditable) {
                    return;
                }
            }
            const state = pauseShortcutStateRef.current;
            if (state.shortcutsHelpOpen) {
                return;
            }
            if (state.abandonRunConfirmOpen) {
                return;
            }
            if (state.relicOffer) {
                return;
            }
            if (state.runStatus === 'levelComplete' && state.lastLevelResult && !state.relicOffer) {
                return;
            }
            if (state.runStatus === 'paused') {
                event.preventDefault();
                state.resume();
                return;
            }
            if (state.runStatus === 'playing' || state.runStatus === 'memorize' || state.runStatus === 'resolving') {
                event.preventDefault();
                state.pause();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [pauseShortcutStateRef, suppressStatusOverlays]);

    /** ? / F1: shortcuts overlay; Escape closes (REF-096). */
    useEffect(() => {
        if (suppressStatusOverlays) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || event.repeat) {
                return;
            }
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            const target = event.target;
            if (target instanceof HTMLElement) {
                if (target.closest('input, textarea, select') || target.isContentEditable) {
                    return;
                }
            }
            const state = shortcutsHelpStateRef.current;
            if (event.key === 'Escape' && state.shortcutsHelpOpen) {
                event.preventDefault();
                state.playUiBack();
                setShortcutsHelpOpen(false);
                return;
            }
            if (state.shortcutsHelpOpen) {
                return;
            }
            if (event.code === 'F1' || event.key === '?') {
                event.preventDefault();
                state.playMenuOpen();
                setShortcutsHelpOpen(true);
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [shortcutsHelpStateRef, suppressStatusOverlays]);

    useEffect(() => {
        const floorClearedModalBlocksToasts =
            !suppressStatusOverlays &&
            !abandonRunConfirmOpen &&
            run.status === 'levelComplete' &&
            Boolean(run.lastLevelResult) &&
            !run.relicOffer;

        const enqueuePending = (ids: AchievementId[]): void => {
            for (const achievementId of ids) {
                if (!pendingAchievementToastIdsRef.current.includes(achievementId)) {
                    pendingAchievementToastIdsRef.current.push(achievementId);
                }
            }
        };

        const emitAchievementToasts = (ids: AchievementId[]): void => {
            if (ids.length === 0) {
                return;
            }
            const infoDuration = reduceMotion ? 3500 : 5500;
            const { showAchievement } = useNotificationStore.getState();
            for (const achievementId of ids) {
                if (seenAchievementToastIdsRef.current.has(achievementId)) {
                    continue;
                }
                seenAchievementToastIdsRef.current.add(achievementId);
                const def = ACHIEVEMENTS.find((item) => item.id === achievementId);
                if (def) {
                    showAchievement(`${def.title} — ${def.description}`, infoDuration, {
                        stackKey: `achievement:${achievementId}`
                    });
                }
            }
        };

        if (floorClearedModalBlocksToasts) {
            if (achievements.length > 0) {
                enqueuePending(achievements);
            }
            return;
        }

        const combined: AchievementId[] = [...pendingAchievementToastIdsRef.current];
        pendingAchievementToastIdsRef.current = [];
        for (const achievementId of achievements) {
            if (!combined.includes(achievementId)) {
                combined.push(achievementId);
            }
        }
        emitAchievementToasts(combined);
    }, [
        abandonRunConfirmOpen,
        achievements,
        run.lastLevelResult,
        run.relicOffer,
        run.status,
        reduceMotion,
        suppressStatusOverlays
    ]);

    useEffect(() => {
        const previousEvent = pickupToastEventRef.current;
        if (!previousEvent || previousEvent.runSeed !== run.runSeed) {
            pickupToastEventRef.current = {
                runSeed: run.runSeed,
                eventId: typedBoardTurnEvent?.eventId ?? null
            };
            return;
        }
        if (!typedBoardTurnEvent || typedBoardTurnEvent.eventId === previousEvent.eventId) {
            return;
        }

        pickupToastEventRef.current = {
            runSeed: run.runSeed,
            eventId: typedBoardTurnEvent.eventId
        };
        if (
            !run.board ||
            typedBoardTurnEvent.boardLevel !== run.board.level ||
            typedBoardTurnEvent.matchedFindableKind == null
        ) {
            return;
        }

        const pickupToastText = getPickupStackToastText(typedBoardTurnEvent);
        if (pickupToastText == null) {
            return;
        }

        const { showInfo } = useNotificationStore.getState();
        const infoDuration = reduceMotion ? 2200 : 3200;
        showInfo(
            pickupToastText,
            infoDuration,
            { stackKey: `pickup:${typedBoardTurnEvent.eventId}` }
        );
    }, [
        run.board,
        run.runSeed,
        reduceMotion,
        typedBoardTurnEvent
    ]);

    /** Persist `powersFtueSeen` once the player leaves tutorial floors (pair markers no longer needed). */
    useEffect(() => {
        const level = run.board?.level;
        if (level !== undefined && level > TUTORIAL_PAIR_MARKER_MAX_LEVEL && !saveData.powersFtueSeen) {
            runPersistenceInBackground(dismissPowersFtue);
        }
    }, [dismissPowersFtue, run.board?.level, saveData.powersFtueSeen]);

    const distractionHudOn =
        run.activeMutators.includes('distraction_channel') &&
        settingsDistractionChannelEnabled &&
        !reduceMotion &&
        run.status === 'playing';
    const distractionTick = useDistractionChannelTick(distractionHudOn);
    const { tiltRef: gameFieldTiltRef } = usePlatformTiltField({
        enabled: true,
        reduceMotion,
        surfaceRef: shellRef,
        strength: 1
    });
    const focusDimmedTileIds = useMemo(() => {
        const dimmed = computeFocusDimmedTileIds(run.board, run.status, settingsTileFocusAssist) ?? new Set<string>();
        if (
            onboardingBoardTargetIds.length === 0 ||
            !run.board ||
            (run.status !== 'playing' && run.status !== 'memorize')
        ) {
            return dimmed;
        }
        const targetSet = new Set(onboardingBoardTargetIds);
        const guidedDimmed = run.board.tiles.map((tile) => tile.id).filter((tileId) => !targetSet.has(tileId));
        return new Set([...dimmed, ...guidedDimmed]);
    }, [onboardingBoardTargetIds, run.board, run.status, settingsTileFocusAssist]);
    const stickyBlockedTileId = useMemo((): string | null => {
        const board = run.board;
        if (!board || run.status !== 'playing') {
            return null;
        }
        return getStickyBlockedTileId({
            activeMutators: run.activeMutators,
            flippedTileIds: board.flippedTileIds,
            stickyBlockIndex: run.stickyBlockIndex,
            tiles: board.tiles
        });
    }, [run.activeMutators, run.board, run.status, run.stickyBlockIndex]);
    const mergedPeekTileIds = useMemo(() => {
        const merged = new Set<string>([...run.peekRevealedTileIds, ...run.flashPairRevealedTileIds]);
        return [...merged];
    }, [run.peekRevealedTileIds, run.flashPairRevealedTileIds]);
    const allowGambitThirdFlip = run.gambitAvailableThisFloor && !run.gambitThirdFlipUsed;
    const gambitThirdPickActive =
        run.status === 'resolving' &&
        allowGambitThirdFlip &&
        (run.board?.flippedTileIds.length ?? 0) === 2;
    const wideRecallInPlay = run.activeMutators.includes('wide_recall');
    const silhouetteDuringPlay = run.activeMutators.includes('silhouette_twist');
    const nBackMutatorActive = run.activeMutators.includes('n_back_anchor');
    const viewportWantsMobileCamera = compactTouchChrome;
    const cameraViewportMode = deriveCameraViewportMode(settingsCameraViewportModePreference, viewportWantsMobileCamera);
    const floorClearProjection = useGameScreenFloorClearProjection({
        onboardingDismissed: saveData.onboardingDismissed,
        run
    });
    const {
        endlessChapterActive,
        currentArchetype,
        currentFeaturedObjectiveLabel,
        currentFloorIdentity,
        wagerSuretyActive,
        offeredRiskWagerFavor,
        endlessRiskWagerOfferAvailable,
        acceptedEndlessRiskWager,
        visibleRiskWagerSignalRows,
        riskWagerPrimaryCue,
        riskWagerArmAriaLabel,
        riskWagerSignalRowsLabel,
        routeChoices,
        routeChoiceRequired,
        firstRouteChoiceRequired,
        routeChoiceRequiredCopy
    } = floorClearProjection;

    const routeChoiceProjection = useGameScreenRouteChoiceProjection({
        firstRouteChoiceRequired,
        routeChoiceRequired,
        routeChoiceRequiredCopy,
        routeChoices,
        run
    });
    const routeConsequenceProjection = getGameScreenRouteConsequenceProjection(run);
    const { dungeonMapPresentation, visibleDungeonMapNodes } = routeChoiceProjection;
    const currentDungeonRoom = dungeonMapPresentation.current;
    const dungeonExitStatus = getDungeonExitStatus(run);
    const dungeonExitRouteLine = dungeonExitStatus.routeType
        ? `${routeTypeLabel(dungeonExitStatus.routeType)} beyond this door.`
        : 'This stair leaves the current floor.';
    const dungeonExitLockLine = dungeonExitPromptLockLine(dungeonExitStatus, run);
    const dungeonPresentation = getDungeonBoardPresentation(run);
    const activeDungeonPanel = run.status !== 'levelComplete' && dungeonPresentation.visible ? dungeonPresentation : null;
    const armedRewardPerkCue = getPrimaryRewardPerkReadinessRow(run);
    const dungeonCombatLogRows = activeDungeonPanel ? getDungeonCombatLogRows(run) : [];
    const gauntletRemainingMs =
        run.gauntletDeadlineMs !== null ? Math.max(0, run.gauntletDeadlineMs - gauntletNowMs) : null;
    const gauntletActive = run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null;
    useEffect(() => {
        if (!gauntletActive || run.status !== 'playing' || gauntletRemainingMs === null) {
            previousCountdownPressureSecondRef.current = null;
            return;
        }
        const remainingSec = Math.ceil(gauntletRemainingMs / 1000);
        if (remainingSec <= 0 || remainingSec > 10 || remainingSec === previousCountdownPressureSecondRef.current) {
            return;
        }
        previousCountdownPressureSecondRef.current = remainingSec;
        void resumeAudioContext();
        playCountdownPressureSfx(shuffleSfxGain);
    }, [gauntletActive, gauntletRemainingMs, run.status, shuffleSfxGain]);
    const {
        message: politeHudAnnouncement,
        priority: politeHudAnnouncementPriority,
        queuePoliteAnnouncement
    } = useHudPoliteLiveAnnouncement({
        boardTurnEvent: typedBoardTurnEvent,
        gameplayFeedbackBatch: typedGameplayFeedbackBatch,
        boardLevel: run.board?.level ?? null,
        gauntletActive,
        gauntletRemainingMs,
        gambitThirdPickActive,
        gambitOpportunityFlippedIds:
            gambitThirdPickActive && run.board ? run.board.flippedTileIds : null,
        reduceMotion
    });
    const actionFeedbackAnnouncement = boardFloaterLiveText || politeHudAnnouncement;
    const actionFeedbackPriority =
        boardFloaterPayload?.kind === 'miss' ? 'error' : politeHudAnnouncementPriority;
    const visualHudAnnouncement = actionFeedbackAnnouncement
        ? formatHudActionFeedbackText(actionFeedbackAnnouncement)
        : '';
    const visualHudAnnouncementLabel = actionFeedbackPriority === 'error' ? 'Critical' : 'Action result';
    const visualHudAnnouncementSignal = getVisualHudAnnouncementSignal(
        actionFeedbackAnnouncement,
        actionFeedbackPriority
    );
    const visualHudAnnouncementImpact = getVisualHudAnnouncementImpact(
        actionFeedbackAnnouncement,
        actionFeedbackPriority
    );
    const remainingPairCount = Math.max(0, (run.board?.pairCount ?? 0) - (run.board?.matchedPairs ?? 0));
    const visualHudAnnouncementFollowup = getVisualHudAnnouncementFollowup({
        announcement: actionFeedbackAnnouncement,
        priority: actionFeedbackPriority,
        runStatus: run.status,
        remainingPairCount,
        lives: run.lives
    });

    const { hint: traitSwapRouteHint, tileIds: traitRouteTargetTileIds } = useGameScreenTraitRouteTargets(run);
    const handleTileSelect = useCallback((tileId: string): void => {
        useAppStore.getState().pressTile(tileId);
    }, []);

    const showForgivenessHint = Boolean(
        run.board &&
            run.board.level <= 3 &&
            (run.status === 'memorize' || run.status === 'playing') &&
            run.board.matchedPairs === 0 &&
            run.stats.tries === 0
    );
    useEffect(() => {
        let active = true;
        if (showTutorialPairMarkers && showForgivenessHint && !compactTouchChrome) {
            queueMicrotask(() => {
                if (active) {
                    setRulesHintsExpanded(true);
                }
            });
        }
        return () => {
            active = false;
        };
    }, [compactTouchChrome, showForgivenessHint, showTutorialPairMarkers]);

    const hiddenTileCount = run.board?.tiles.filter((tile) => tile.state === 'hidden').length ?? 0;
    const tileSwapDisabled = Boolean(
        run.activeContract?.noShuffle ||
            !run.board ||
            run.board.flippedTileIds.length > 0 ||
            hiddenTileCount < 2 ||
            (run.regionShuffleCharges < 1 &&
                !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first')))
    );
    const traitSwapHint = !tileSwapDisabled ? traitSwapRouteHint : null;
    const boardLevelForTraitSwapHint = run.board?.level ?? null;
    useEffect(() => {
        if (run.status !== 'playing' || boardLevelForTraitSwapHint === null || !traitSwapHint) {
            return;
        }
        const routeSetupKey = `${boardLevelForTraitSwapHint}:${traitSwapHint.firstTileId}:${traitSwapHint.secondTileId}`;
        if (announcedTraitRouteSetupKeyRef.current === routeSetupKey) {
            return;
        }
        announcedTraitRouteSetupKeyRef.current = routeSetupKey;
        queuePoliteAnnouncement(`Trait route prime found. Use swap: ${traitSwapHint.text}.`, {
            dedupeKey: `trait-route-setup:${routeSetupKey}`,
            priority: 'info'
        });
    }, [
        boardLevelForTraitSwapHint,
        queuePoliteAnnouncement,
        run.status,
        traitSwapHint
    ]);
    const tileSwapPowerVisualActive = run.status === 'playing' && tileSwapArmed && !tileSwapDisabled;
    const {
        destroyEligibleTileIds,
        destroyPowerVisualActive,
        peekEligibleTileIds,
        peekPowerVisualActive,
        pinModeBoardHintActive,
        shiftingSpotlightActive,
        strayEligibleTileIds,
        strayPowerVisualActive,
        tileSwapEligibleTileIds
    } = useGameScreenPowerTileHints({
        boardPinMode,
        destroyPairArmed,
        mergedPeekTileIds,
        peekModeArmed,
        run,
        strayRemoveArmed,
        tileSwapPowerVisualActive
    });

    if (!run.board) {
        return null;
    }

    const showEndlessChapterBanner =
        endlessChapterActive &&
        currentArchetype &&
        currentFeaturedObjectiveLabel &&
        (run.status === 'memorize' || (run.status === 'playing' && run.board.matchedPairs === 0));
    const showBoardPowerBar = run.status === 'playing';
    const shuffleDisabled = !canShuffleBoard(run);
    const regionShuffleDisabled = !canRegionShuffle(run);
    const regionShuffleTitle = run.activeContract?.noShuffle
        ? 'Scholar contract: row shuffle disabled'
        : regionShuffleDisabled
          ? run.regionShuffleCharges < 1 &&
              !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))
            ? 'No row/swap charges'
            : run.board.flippedTileIds.length > 0
              ? 'Finish the current flip first'
              : 'Need at least one hidden pair on the board'
          : 'Shuffle hidden tiles within one row (uses 1 row/swap charge)';
    const tileSwapTitle = run.activeContract?.noShuffle
        ? 'Scholar contract: tile swap disabled'
        : run.board.flippedTileIds.length > 0
          ? 'Finish the current flip first'
          : hiddenTileCount < 2
            ? 'Need two hidden tiles to swap'
              : run.regionShuffleCharges < 1 &&
                  !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))
                ? 'No row/swap charges'
              : tileSwapArmed
                ? tileSwapFirstTileId
                    ? 'Tap a second hidden tile to swap positions'
                    : 'Tap the first hidden tile to move'
                : traitSwapHint
                  ? `Swap two hidden tiles (uses 1 row/swap charge). ${traitSwapHint.text}`
                  : 'Swap two hidden tiles (uses 1 row/swap charge)';
    const showFlashPairPower = (run.practiceMode || run.wildMenuRun) && run.status === 'playing';
    const flashPairDisabled =
        !showFlashPairPower ||
        run.flashPairCharges < 1 ||
        run.board.flippedTileIds.length > 0;
    const flashPairTitle =
        run.flashPairCharges < 1
            ? 'No flash charges this floor'
            : run.board.flippedTileIds.length > 0
              ? 'Finish the current flip first'
              : 'Briefly reveal a random hidden pair (practice / wild)';
    const shuffleTitle = run.activeContract?.noShuffle
        ? 'Scholar contract: shuffle disabled'
        : shuffleDisabled
          ? run.shuffleCharges < 1 &&
              !(run.freeShuffleThisFloor && run.relicIds.includes('first_shuffle_free_per_floor'))
            ? 'No shuffle charges'
            : run.board.flippedTileIds.length > 0
              ? 'Finish the current flip first'
              : 'Need at least two hidden pairs to shuffle'
          : 'Shuffle hidden tiles (1 charge this run)';
    const boardPresentationClass =
        settingsBoardPresentation === 'spaghetti'
            ? styles.boardStageSpaghetti
            : settingsBoardPresentation === 'breathing' && !reduceMotion
              ? styles.boardStageBreathing
              : '';
    const destroyDisabled = run.destroyPairCharges < 1 && !destroyPairArmed;
    /*
     * A11Y-006 — backdrop inert behind OverlayModal surfaces (pause, relic, floor clear, abandon):
     * - Native `inert` is supported in Chromium (Electron) and current Safari/Firefox; very old browsers
     *   ignore it, so `aria-hidden` is set in tandem to reduce stray tab stops where the attribute is honored.
     * - Do not wrap modal markup in this subtree: nesting focused dialogs inside `aria-hidden` breaks SR semantics.
     * - `inert` alone should block pointer events on descendants; keep modal siblings outside this wrapper.
     */
    const gameplayShellInert =
        !suppressStatusOverlays &&
        (abandonRunConfirmOpen ||
            dungeonExitPromptOpen ||
            run.status === 'paused' ||
            Boolean(run.relicOffer) ||
            (run.status === 'levelComplete' && Boolean(run.lastLevelResult) && !run.relicOffer));
    const reg104GameplayShellVariant =
        run.status === 'paused' ? 'paused' : run.status === 'levelComplete' ? 'floor_clear' : 'playing';
    return (
        <section
            className={`${styles.shell} ${cameraViewportMode ? styles.mobileCameraShell : ''}`}
            data-mobile-camera-mode={cameraViewportMode ? 'true' : 'false'}
            {...{ [REG104_DATA_SHELL]: reg104GameplayShellVariant }}
            data-testid="game-shell"
            ref={shellRef}
            style={GAMEPLAY_VISUAL_CSS_VARS}
        >
            <MainMenuBackground
                fieldTiltRef={gameFieldTiltRef}
                graphicsQuality={settingsGraphicsQuality}
                height={height}
                reduceMotion={reduceMotion}
                width={width}
            />
            <div
                aria-hidden="true"
                className={styles.stageBackdrop}
                style={{ backgroundImage: `url(${UI_ART.gameplayWorkshopScene})` }}
            />
            <div className={`${styles.gameForeground} ${cameraViewportMode ? styles.mobileCameraForeground : ''}`}>
                <div
                    aria-hidden={gameplayShellInert ? true : undefined}
                    className={styles.gameplayInertScope}
                    data-a11y-gameplay-inert={gameplayShellInert ? 'true' : 'false'}
                    inert={gameplayShellInert ? true : undefined}
                >
                    <h1 className={styles.srOnly}>Level {run.board.level}</h1>
                    {persistenceWriteNotice ? (
                        <div className={styles.persistWriteBanner} role="alert">
                            <span>{persistenceWriteNotice}</span>
                            <button
                                type="button"
                                className={styles.persistWriteBannerDismiss}
                                onClick={clearPersistenceWriteNotice}
                            >
                                Dismiss
                            </button>
                        </div>
                    ) : null}
                    <div
                        className={`${styles.gamePlayLayout} ${cameraViewportMode ? styles.mobileCameraGamePlayLayout : ''}`.trim()}
                    >
                    <div
                        className={`${styles.mainGameColumn} ${cameraViewportMode ? styles.mobileCameraMainColumn : ''}`.trim()}
                        data-html-ui-layer="gameplay-chrome-v2"
                    >
                        <MemoGameplayHudBar
                            cameraViewportMode={cameraViewportMode}
                            gauntletRemainingMs={gauntletRemainingMs}
                            politeHudAnnouncement={politeHudAnnouncement}
                            politeHudAnnouncementPriority={politeHudAnnouncementPriority}
                            reduceMotion={reduceMotion}
                            run={run}
                        />

                        {gambitThirdPickActive ? (
                            <div
                                aria-live="polite"
                                className={styles.gambitOpportunityHint}
                                data-testid="gambit-opportunity-hint"
                                role="status"
                            >
                                <span>{GAMBIT_OPPORTUNITY_HINT_LINE}</span>
                                <span
                                    className={styles.gambitOpportunitySignals}
                                    data-testid="gambit-opportunity-signals"
                                    aria-label={GAMBIT_SIGNAL_ROWS_LABEL}
                                >
                                    <span
                                        data-gambit-signal="window"
                                        data-gambit-signal-audio={getGambitSignalAudioCue('Window')}
                                        data-gambit-signal-beats={getGambitSignalBeatCount('Window')}
                                        data-gambit-signal-screen-cue={getGambitSignalScreenCue('Window')}
                                    >
                                        <small>Window</small>
                                        <b>Third flip</b>
                                        <span aria-hidden="true" className={styles.gambitOpportunityBeatPips}>
                                            {Array.from({ length: getGambitSignalBeatCount('Window') }, (_, index) => (
                                                <i
                                                    data-gambit-signal-beat={index + 1}
                                                    data-gambit-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span
                                        data-gambit-signal="payoff"
                                        data-gambit-signal-audio={getGambitSignalAudioCue('Payoff')}
                                        data-gambit-signal-beats={getGambitSignalBeatCount('Payoff')}
                                        data-gambit-signal-screen-cue={getGambitSignalScreenCue('Payoff')}
                                    >
                                        <small>Payoff</small>
                                        <b>Recover pair</b>
                                        <span aria-hidden="true" className={styles.gambitOpportunityBeatPips}>
                                            {Array.from({ length: getGambitSignalBeatCount('Payoff') }, (_, index) => (
                                                <i
                                                    data-gambit-signal-beat={index + 1}
                                                    data-gambit-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span
                                        data-gambit-signal="cost"
                                        data-gambit-signal-audio={getGambitSignalAudioCue('Cost')}
                                        data-gambit-signal-beats={getGambitSignalBeatCount('Cost')}
                                        data-gambit-signal-screen-cue={getGambitSignalScreenCue('Cost')}
                                    >
                                        <small>Cost</small>
                                        <b>No perfect</b>
                                        <span aria-hidden="true" className={styles.gambitOpportunityBeatPips}>
                                            {Array.from({ length: getGambitSignalBeatCount('Cost') }, (_, index) => (
                                                <i
                                                    data-gambit-signal-beat={index + 1}
                                                    data-gambit-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                </span>
                            </div>
                        ) : null}

                        {showEndlessChapterBanner ? (
                            <GameScreenEndlessChapterBanner
                                archetype={currentArchetype}
                                featuredObjectiveLabel={currentFeaturedObjectiveLabel}
                                floorIdentity={currentFloorIdentity}
                            />
                        ) : null}

                        {currentDungeonRoom ? (
                            <GameScreenDungeonRunStrip
                                bossDistance={dungeonMapPresentation.bossDistance}
                                currentRoom={currentDungeonRoom}
                                visibleNodes={visibleDungeonMapNodes}
                            />
                        ) : null}

                        <div
                            ref={boardStageRef}
                            data-testid="board-stage"
                            className={`${styles.boardStage} ${cameraViewportMode ? styles.boardStageCamera : ''} ${boardPresentationClass} ${boardStageCssBloomClass}`.trim()}
                            data-match-crescendo-beats={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.beatCount ?? 0
                                    : 0
                            }
                            data-match-crescendo-cue={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                    : 'none'
                            }
                            data-match-crescendo-screen-cue={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                    : 'none'
                            }
                            data-match-crescendo-tier={
                                boardFloaterPayload?.kind === 'match'
                                    ? boardFloaterPayload.crescendo?.tier ?? 'none'
                                    : 'none'
                            }
                            data-match-payoff-stack={boardMatchPayoffStackCue?.tone ?? 'none'}
                            data-match-payoff-stack-action={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackAction(boardMatchPayoffStackCue) : 'none'
                            }
                            data-match-payoff-stack-beats={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue) : 0
                            }
                            data-match-payoff-stack-audio={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackAudioCue(boardMatchPayoffStackCue) : 'none'
                            }
                            data-match-payoff-stack-first-cue={boardMatchPayoffStackCue?.firstCue ?? 'none'}
                            data-match-payoff-stack-lanes={boardMatchPayoffStackCue?.laneCount ?? 0}
                            data-match-payoff-stack-screen-cue={
                                boardMatchPayoffStackCue ? getBoardMatchPayoffStackScreenCue(boardMatchPayoffStackCue) : 'none'
                            }
                            data-match-payoff-stack-sequence-first={
                                boardMatchPayoffStackCue?.sequenceFirstCue ?? 'none'
                            }
                            data-match-payoff-stack-sequence-keep={boardMatchPayoffStackCue?.sequenceKeepCue ?? 'none'}
                            data-match-payoff-stack-sequence-then={boardMatchPayoffStackCue?.nextCue ?? 'none'}
                            data-match-payoff-stack-summary={boardMatchPayoffStackCue?.value ?? 'none'}
                            style={{ '--gameplay-workshop-table-image': `url(${UI_ART.gameplayWorkshopTable})` } as CSSProperties}
                        >
                            <div className={styles.boardGlow} aria-hidden="true" />
                            <GameScreenActiveRouteFeedback projection={routeConsequenceProjection.active} />
                            {activeDungeonPanel ? (
                                <GameScreenDungeonStatusPanel
                                    combatLogRows={dungeonCombatLogRows}
                                    panel={activeDungeonPanel}
                                />
                            ) : null}
                            {visualHudAnnouncement ? (
                                <GameScreenActionFeedbackRail
                                    burstTier={visualHudAnnouncementImpact.burstTier}
                                    crescendo={
                                        boardFloaterPayload?.kind === 'match'
                                            ? boardFloaterPayload.crescendo ?? null
                                            : null
                                    }
                                    details={visualHudAnnouncementImpact.details}
                                    followup={visualHudAnnouncementFollowup}
                                    intensity={visualHudAnnouncementImpact.level}
                                    label={visualHudAnnouncementLabel}
                                    message={visualHudAnnouncement}
                                    signal={visualHudAnnouncementSignal}
                                    tone={actionFeedbackPriority}
                                />
                            ) : null}
                            {boardMatchPayoffStackCue ? (
                                <div
                                    aria-label={`Last match payoff stack. ${boardMatchPayoffStackCue.label}: ${boardMatchPayoffStackCue.value}. ${getBoardMatchPayoffStackAction(
                                        boardMatchPayoffStackCue
                                    )}. ${getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue)} beats. ${boardMatchPayoffStackCue.firstCue}.${
                                        boardMatchPayoffStackCue.nextCue ? ` ${boardMatchPayoffStackCue.nextCue}.` : ''
                                    } Sequence: first ${boardMatchPayoffStackCue.sequenceFirstCue}; then ${
                                        boardMatchPayoffStackCue.nextCue ?? 'lock payoff route'
                                    }; keep ${boardMatchPayoffStackCue.sequenceKeepCue}.`}
                                    className={styles.boardMatchPayoffStackCue}
                                    data-match-payoff-stack-action={getBoardMatchPayoffStackAction(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-audio={getBoardMatchPayoffStackAudioCue(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-beats={getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-fill={boardMatchPayoffStackFill}
                                    data-match-payoff-stack-keep={boardMatchPayoffStackCue.sequenceKeepCue}
                                    data-match-payoff-stack-screen-cue={getBoardMatchPayoffStackScreenCue(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-sequence-first={boardMatchPayoffStackCue.sequenceFirstCue}
                                    data-match-payoff-stack-sequence-then={
                                        boardMatchPayoffStackCue.nextCue ?? 'Lock payoff route'
                                    }
                                    data-match-payoff-stack-tone={boardMatchPayoffStackCue.tone}
                                    style={
                                        {
                                            '--match-payoff-stack-fill': `${boardMatchPayoffStackFill}%`
                                        } as CSSProperties
                                    }
                                    data-testid="board-match-payoff-stack-cue"
                                    role="status"
                                >
                                    <small>{boardMatchPayoffStackCue.label}</small>
                                    <strong>{boardMatchPayoffStackCue.value}</strong>
                                    <b>{getBoardMatchPayoffStackAction(boardMatchPayoffStackCue)}</b>
                                    <span aria-hidden="true" className={styles.boardMatchPayoffStackMeter} />
                                    <span aria-hidden="true" className={styles.boardMatchPayoffStackBeatPips}>
                                        {Array.from({ length: getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue) }, (_, index) => (
                                            <i
                                                data-match-payoff-stack-beat={index + 1}
                                                data-match-payoff-stack-beat-focus={index === 0 ? 'primary' : 'support'}
                                                key={index}
                                            />
                                        ))}
                                    </span>
                                    <span>{boardMatchPayoffStackCue.firstCue}</span>
                                    {boardMatchPayoffStackCue.nextCue ? <em>{boardMatchPayoffStackCue.nextCue}</em> : null}
                                    <div
                                        className={styles.boardMatchPayoffStackSequence}
                                        data-testid="board-match-payoff-stack-sequence"
                                    >
                                        <span data-match-payoff-stack-step="first">
                                            <small>First</small>
                                            <b>{boardMatchPayoffStackCue.sequenceFirstCue}</b>
                                        </span>
                                        <span data-match-payoff-stack-step="then">
                                            <small>Then</small>
                                            <b>{boardMatchPayoffStackCue.nextCue ?? 'Lock payoff route'}</b>
                                        </span>
                                        <span data-match-payoff-stack-step="keep">
                                            <small>Keep</small>
                                            <b>{boardMatchPayoffStackCue.sequenceKeepCue}</b>
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            <MemoTileBoard
                                ref={tileBoardRef}
                                allowGambitThirdFlip={allowGambitThirdFlip}
                                board={run.board}
                                cursedPairKey={run.board.cursedPairKey ?? null}
                                wardPairKey={run.board.wardPairKey ?? null}
                                bountyPairKey={run.board.bountyPairKey ?? null}
                                debugPeekActive={run.debugPeekActive}
                                dimmedTileIds={focusDimmedTileIds}
                                guidedTargetTileIds={onboardingBoardTargetIds}
                                chainContext={{
                                    armedPerkId: armedRewardPerkCue?.id ?? null,
                                    armedPerkDetail: armedRewardPerkCue?.readinessDetail ?? null,
                                    armedPerkLabel: armedRewardPerkCue?.readinessLabel ?? null,
                                    armedPerkPayoff: armedRewardPerkCue?.payoff ?? null,
                                    comboShards: run.stats.comboShards,
                                    currentStreak: run.stats.currentStreak,
                                    lives: run.lives
                                }}
                                recoveryContext={boardRecoveryContext}
                                traitRouteHintText={traitSwapRouteHint?.text ?? null}
                                traitRouteTargetTileIds={traitRouteTargetTileIds}
                                interactive={run.status === 'playing' || gambitThirdPickActive}
                                mobileCameraMode={cameraViewportMode}
                                nBackAnchorPairKey={run.nBackAnchorPairKey}
                                nBackMutatorActive={nBackMutatorActive}
                                peekRevealedTileIds={mergedPeekTileIds}
                                pinnedTileIds={run.pinnedTileIds}
                                onTileSelect={handleTileSelect}
                                onMemorizeBoardReady={gameScreenActions.notifyMemorizeBoardReady}
                                pairProximityHintsEnabled={settingsPairProximityHintsEnabled}
                                previewActive={run.status === 'memorize'}
                                boardBloomEnabled={settingsBoardBloomEnabled}
                                boardScreenSpaceAA={settingsBoardScreenSpaceAA}
                                frameStyle={
                                    cameraViewportMode ? undefined : DESKTOP_FULL_BLEED_TILE_BOARD_FRAME_STYLE
                                }
                                graphicsQuality={settingsGraphicsQuality}
                                reduceMotion={reduceMotion}
                                runStatus={run.status}
                                showTutorialPairMarkers={showTutorialPairMarkers}
                                silhouetteDuringPlay={silhouetteDuringPlay}
                                viewportResetToken={viewportResetToken}
                                wideRecallInPlay={wideRecallInPlay}
                                shiftingSpotlightActive={shiftingSpotlightActive}
                                destroyPowerVisualActive={destroyPowerVisualActive}
                                destroyEligibleTileIds={destroyEligibleTileIds}
                                peekPowerVisualActive={peekPowerVisualActive}
                                peekEligibleTileIds={peekEligibleTileIds}
                                strayPowerVisualActive={strayPowerVisualActive}
                                strayEligibleTileIds={strayEligibleTileIds}
                                tileSwapPowerVisualActive={tileSwapPowerVisualActive}
                                tileSwapEligibleTileIds={tileSwapEligibleTileIds}
                                tileSwapFirstTileId={tileSwapFirstTileId}
                                pinModeBoardHintActive={pinModeBoardHintActive}
                                shuffleSfxGain={shuffleSfxGain}
                                stickyBlockedTileId={stickyBlockedTileId}
                            />
                            <GameScreenBoardFloater
                                boardFloaterPos={boardFloaterPos}
                                boardFloaterRef={boardFloaterRef}
                                projection={boardFloaterProjection}
                            />
                            {distractionHudOn ? (
                                <div
                                    aria-hidden="true"
                                    className={styles.distractionHud}
                                    data-testid="distraction-channel-hud"
                                >
                                    <div className={styles.distractionHudPlate}>
                                        <span className={styles.distractionHudLabel}>{DISTRACTION_CHANNEL_LABEL}</span>
                                        <span className={styles.distractionHudValue}>
                                            {(distractionTick % 7) + 3}
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            {onboardingStep && run.status === 'playing' ? (
                                <aside className={styles.playableOnboardingPrompt} data-testid="playable-onboarding-prompt">
                                    <span className={styles.playableOnboardingStep}>{onboardingStep.title}</span>
                                    <strong>{onboardingStep.prompt}</strong>
                                    <p>{onboardingStep.detail}</p>
                                    <div
                                        className={styles.onboardingPromptSignals}
                                        data-testid="playable-onboarding-signals"
                                        aria-label={onboardingPromptSignalsLabel}
                                    >
                                        {onboardingPromptSignals.map((row) => {
                                            const beatCount = getOnboardingPromptSignalBeatCount(row);
                                            return (
                                                <span
                                                    data-onboarding-signal-audio={getOnboardingPromptSignalAudioCue(row)}
                                                    data-onboarding-signal-beats={beatCount}
                                                    data-onboarding-signal-screen-cue={getOnboardingPromptSignalScreenCue(row)}
                                                    data-onboarding-signal-tone={row.tone}
                                                    key={`${row.label}:${row.value}`}
                                                >
                                                    <small>{row.label}</small>
                                                    <b>{row.value}</b>
                                                    <span aria-hidden="true" className={styles.onboardingPromptBeatPips}>
                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                            <i
                                                                data-onboarding-signal-beat={index + 1}
                                                                data-onboarding-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={index}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </aside>
                            ) : null}
                            {firstRunRoomGoalPrompt ? (
                                <aside className={styles.playableOnboardingPrompt} data-testid="first-run-room-goal-prompt">
                                    <span className={styles.playableOnboardingStep}>{firstRunRoomGoalPrompt.title}</span>
                                    <strong>{firstRunRoomGoalPrompt.prompt}</strong>
                                    <p>{firstRunRoomGoalPrompt.detail}</p>
                                    <div
                                        className={styles.onboardingPromptSignals}
                                        data-testid="first-run-room-goal-signals"
                                        aria-label={firstRunRoomGoalSignalsLabel}
                                    >
                                        {firstRunRoomGoalSignals.map((row) => {
                                            const beatCount = getOnboardingPromptSignalBeatCount(row);
                                            return (
                                                <span
                                                    data-onboarding-signal-audio={getOnboardingPromptSignalAudioCue(row)}
                                                    data-onboarding-signal-beats={beatCount}
                                                    data-onboarding-signal-screen-cue={getOnboardingPromptSignalScreenCue(row)}
                                                    data-onboarding-signal-tone={row.tone}
                                                    key={`${row.label}:${row.value}`}
                                                >
                                                    <small>{row.label}</small>
                                                    <b>{row.value}</b>
                                                    <span aria-hidden="true" className={styles.onboardingPromptBeatPips}>
                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                            <i
                                                                data-onboarding-signal-beat={index + 1}
                                                                data-onboarding-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={index}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </aside>
                            ) : null}
                        </div>
                        <GameLeftToolbar
                            applyFlashPairPower={applyFlashPairPower}
                            boardPinMode={boardPinMode}
                            cameraViewportMode={cameraViewportMode}
                            canRegionShuffleRow={canRegionShuffleRowForRun}
                            destroyDisabled={destroyDisabled}
                            destroyPairArmed={destroyPairArmed}
                            flashPairDisabled={flashPairDisabled}
                            flashPairTitle={flashPairTitle}
                            maxPinnedTiles={MAX_PINNED_TILES}
                            onRequestAbandonRun={handleRequestAbandonRun}
                            onViewportReset={handleToolbarViewportReset}
                            openCodexFromPlaying={openCodexFromPlaying}
                            openInventoryFromPlaying={openInventoryFromPlaying}
                            openSettingsPlaying={openSettingsPlayingMode}
                            peekModeArmed={peekModeArmed}
                            regionShuffleDisabled={regionShuffleDisabled}
                            regionShuffleTitle={regionShuffleTitle}
                            rulesHintNudge={rulesHintNudge}
                            rulesHintsExpanded={rulesHintsExpanded}
                            run={run}
                            setRulesHintsExpanded={setRulesHintsExpanded}
                            debugFlags={toolbarDebugFlags}
                            showBoardPowerBar={showBoardPowerBar}
                            showFlashPairPower={showFlashPairPower}
                            showForgivenessHint={showForgivenessHint}
                            shuffleBoard={shuffleBoard}
                            shuffleDisabled={shuffleDisabled}
                            shuffleRegionRow={shuffleRegionRow}
                            shuffleTitle={shuffleTitle}
                            strayRemoveArmed={strayRemoveArmed}
                            tileBoardRef={tileBoardRef}
                            tileSwapArmed={tileSwapArmed}
                            tileSwapDisabled={tileSwapDisabled}
                            tileSwapFirstTileId={tileSwapFirstTileId}
                            tileSwapTitle={tileSwapTitle}
                            toggleBoardPinMode={toggleBoardPinMode}
                            toggleDestroyPairArmed={toggleDestroyPairArmed}
                            togglePeekMode={togglePeekMode}
                            toggleTileSwapArmed={toggleTileSwapArmed}
                            toggleStrayArm={toggleStrayArm}
                            triggerDebugReveal={triggerDebugReveal}
                            undoResolvingFlip={undoResolvingFlip}
                        />
                    </div>
                </div>
                </div>

                {!suppressStatusOverlays && dungeonExitPromptOpen && dungeonExitStatus.exitTile ? (
                    <OverlayModal
                        actions={[
                            ...(dungeonExitStatus.canActivateWithoutSpend ||
                            (dungeonExitStatus.lockKind === 'lever' && dungeonExitStatus.canActivate)
                                ? [
                                      {
                                          label: 'Proceed',
                                          onClick: () => {
                                              playUiClick();
                                              activateDungeonExitFromPrompt('none');
                                          },
                                          variant: 'primary' as const
                                      }
                                  ]
                                : []),
                            ...(dungeonExitStatus.canActivateWithKey
                                ? [
                                      {
                                          label: 'Use key',
                                          onClick: () => {
                                              playUiClick();
                                              activateDungeonExitFromPrompt('key');
                                          },
                                          variant: 'primary' as const
                                      }
                                  ]
                                : []),
                            ...(dungeonExitStatus.canActivateWithMasterKey
                                ? [
                                      {
                                          label: 'Use master key',
                                          onClick: () => {
                                              playUiClick();
                                              activateDungeonExitFromPrompt('master_key');
                                          },
                                          variant: 'primary' as const
                                      }
                                  ]
                                : []),
                            {
                                label: 'Stay',
                                onClick: () => {
                                    playUiBack();
                                    closeDungeonExitPrompt();
                                },
                                variant: 'secondary'
                            }
                        ]}
                        headerPlateTone="success"
                        onEscape={() => {
                            playUiBack();
                            closeDungeonExitPrompt();
                        }}
                        ornamentalHeaderPlate
                        subtitle={`${dungeonExitRouteLine} ${dungeonExitLockLine}`}
                        testId="dungeon-exit-overlay"
                        title={dungeonExitPromptTitle(dungeonExitStatus)}
                    >
                        {dungeonExitStatus.lockedReason ? (
                            <p className={styles.modalNote}>{dungeonExitStatus.lockedReason}</p>
                        ) : (
                            <p className={styles.modalNote}>Proceeding seals the remaining cards on this floor.</p>
                        )}
                    </OverlayModal>
                ) : null}

                {!suppressStatusOverlays && !abandonRunConfirmOpen && run.status === 'paused' && (
                    <OverlayModal
                        actions={[
                            { label: 'Resume', onClick: resume, variant: 'primary' },
                            {
                                label: 'Retreat',
                                onClick: () => {
                                    playMenuOpen();
                                    setAbandonRunConfirmOpen(true);
                                },
                                variant: 'danger'
                            }
                        ]}
                        headerPlateTone="pause"
                        onEscape={resume}
                        ornamentalHeaderPlate
                        subtitle="Game is paused. The board, memorize phase, and debug timers stay frozen until you resume or retreat. Press P to resume."
                        testId="game-pause-overlay"
                        title="Run paused"
                    />
                )}

                {!suppressStatusOverlays && run.relicOffer ? (
                    <OverlayModal
                        actions={[]}
                        headerPlateTone="relic"
                        ornamentalHeaderPlate
                        subtitle={getRelicOfferSubtitle(
                            run.lastLevelResult?.level ?? 0,
                            run.relicOffer.picksRemaining
                        )}
                        testId="game-relic-offer-overlay"
                        title={getRelicOfferTitle(run.relicOffer.tier)}
                    >
                        {relicDraftProgressText ? (
                            <p className={styles.relicDraftProgress}>{relicDraftProgressText}</p>
                        ) : null}
                        {relicBonusFootnoteLines.length > 0 ? (
                            <ul className={styles.relicDraftBonusList}>
                                {relicBonusFootnoteLines.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        ) : null}
                        <RelicDraftOfferPanel
                            currentRelicIds={run.relicIds}
                            descriptionById={relicEffectLabels}
                            onUseService={applyRelicOfferService}
                            onPick={pickRelic}
                            optionIds={run.relicOffer.options}
                            payoffEngineSignal={relicDraftPayoffEngineSignal}
                            pickRound={run.relicOffer.pickRound}
                            reasonById={run.relicOffer.contextualOptionReasons}
                            serviceActions={run.relicOffer.services}
                            sfxGain={shuffleSfxGain}
                        />
                    </OverlayModal>
                ) : null}

                {!suppressStatusOverlays &&
                    !abandonRunConfirmOpen &&
                    run.status === 'levelComplete' &&
                    run.lastLevelResult &&
                    !run.relicOffer && (
                    <OverlayModal
                        actions={[
                            ...(routeChoiceRequired
                                ? []
                                : [
                                      {
                                          label: run.pendingRouteCardPlan
                                              ? `Continue to ${routeTypeLabel(run.pendingRouteCardPlan.routeType)} floor`
                                              : 'Continue',
                                          onClick: continueToNextLevel,
                                          variant: 'primary' as const
                                      }
                                  ]),
                            ...(run.shopOffers.length > 0 && !routeChoiceRequired
                                ? [
                                      {
                                          label: 'Visit Shop',
                                          onClick: () => {
                                              playUiClick();
                                              openShopFromLevelComplete();
                                          },
                                          variant: 'secondary' as const
                                      }
                                  ]
                                : []),
                            {
                                label: 'Main Menu',
                                onClick: () => {
                                    playMenuOpen();
                                    setAbandonRunConfirmOpen(true);
                                },
                                variant: 'secondary'
                            }
                        ]}
                        headerPlateTone="success"
                        ornamentalHeaderPlate
                        quietHeaderPlate
                        subtitle={`Level ${runNonNegativeInteger(run.lastLevelResult.level)} cleared. Score +${runNonNegativeInteger(run.lastLevelResult.scoreGained)}. Try Daily or Scholar contract from the menu for different goals.`}
                        title="Floor cleared"
                    >
                        <GameScreenFloorClearResult projection={floorClearProjection} />
                        <GameScreenSelectedRouteFeedback projection={routeConsequenceProjection.selected} />
                        {run.shopOffers.length > 0 ? (
                            <p className={styles.modalNote}>
                                Vendor alcove available: {run.shopOffers.length} services, {run.shopGold} shop gold.
                            </p>
                        ) : null}
                        <GameScreenRouteChoicePanel
                            onChooseRoute={(choiceId) => {
                                playUiClick();
                                chooseRouteAndContinue(choiceId);
                            }}
                            projection={routeChoiceProjection}
                        />
                        {acceptedEndlessRiskWager || (!routeChoiceRequired && endlessRiskWagerOfferAvailable) ? (
                            <div className={styles.endlessRiskWagerPanel} data-testid="endless-risk-wager-panel">
                                {acceptedEndlessRiskWager ? (
                                    <>
                                        <strong>Risk wager armed</strong>
                                        <span>
                                            Next featured objective: +{offeredRiskWagerFavor}{' '}
                                            Favor if completed. Miss it and the x{acceptedEndlessRiskWager.streakAtRisk}{' '}
                                            streak {wagerSuretyActive ? 'falls to x1' : 'breaks'}.
                                        </span>
                                        {riskWagerPrimaryCue ? <RiskWagerPrimaryCueView cue={riskWagerPrimaryCue} /> : null}
                                        <RiskWagerSignalRowsView
                                            label={riskWagerSignalRowsLabel}
                                            rows={visibleRiskWagerSignalRows}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <strong>Risk wager available</strong>
                                        <span>
                                            Stake your x{run.featuredObjectiveStreak} objective streak on the next floor for
                                            +{offeredRiskWagerFavor} bonus Favor.
                                        </span>
                                        {riskWagerPrimaryCue ? <RiskWagerPrimaryCueView cue={riskWagerPrimaryCue} /> : null}
                                        <RiskWagerSignalRowsView
                                            label={riskWagerSignalRowsLabel}
                                            rows={visibleRiskWagerSignalRows}
                                        />
                                        <button
                                            aria-label={riskWagerArmAriaLabel}
                                            className={styles.endlessRiskWagerButton}
                                            onClick={() => {
                                                playUiClick();
                                                acceptEndlessRiskWager();
                                            }}
                                            type="button"
                                        >
                                            Arm wager
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : null}
                        <div className={styles.modalStats}>
                            <StatTile
                                density="minimal"
                                label="Rating"
                                value={run.lastLevelResult.rating}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Mistakes"
                                value={runNonNegativeInteger(run.lastLevelResult.mistakes)}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Lives"
                                value={runNonNegativeInteger(run.lastLevelResult.livesRemaining)}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Total"
                                value={runNonNegativeInteger(run.stats.totalScore).toLocaleString()}
                                valueFirst
                            />
                        </div>
                    </OverlayModal>
                )}

                {!suppressStatusOverlays && shortcutsHelpOpen ? (
                    <OverlayModal
                        actions={[
                            {
                                label: 'Close',
                                onClick: () => {
                                    playUiBack();
                                    setShortcutsHelpOpen(false);
                                },
                                variant: 'secondary'
                            }
                        ]}
                        subtitle="These shortcuts work while a run is active and when focus is not in a text field."
                        testId="game-shortcuts-help-overlay"
                        title="Keyboard shortcuts"
                    >
                        <ul aria-label="Gameplay keyboard shortcuts" className={styles.shortcutsHelpList}>
                            {GAMEPLAY_SHORTCUT_ROWS.map((row) => (
                                <li key={row.id}>
                                    <span className={styles.shortcutsHelpKeys}>{row.keys}</span>
                                    {' — '}
                                    {row.description}
                                </li>
                            ))}
                        </ul>
                        <p className={styles.shortcutsHelpTip}>{GAMBIT_KEYBOARD_HELP_TIP}</p>
                    </OverlayModal>
                ) : null}

                {!suppressStatusOverlays && abandonRunConfirmOpen ? (
                    <OverlayModal
                        actions={[
                            {
                                label: 'Cancel',
                                onClick: () => {
                                    playUiBack();
                                    setAbandonRunConfirmOpen(false);
                                },
                                variant: 'secondary'
                            },
                            {
                                label: 'Abandon run',
                                onClick: () => {
                                    playUiBack();
                                    setAbandonRunConfirmOpen(false);
                                    goToMenu();
                                },
                                variant: 'danger'
                            }
                        ]}
                        headerPlateTone="danger"
                        onEscape={() => {
                            playUiBack();
                            setAbandonRunConfirmOpen(false);
                        }}
                        ornamentalHeaderPlate
                        subtitle="You will lose this run and return to the main menu. This cannot be undone."
                        title="Abandon run?"
                    />
                ) : null}
            </div>
        </section>
    );
};

export default GameScreen;
