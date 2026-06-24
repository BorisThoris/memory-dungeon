import { ACHIEVEMENTS } from '../../shared/achievements';
import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    MAX_PINNED_TILES,
    RECALL_FOCUS_MAX,
    type AchievementId,
    type RouteCardKind,
    type RouteSpecialKind,
    type RunState,
    type Settings
} from '../../shared/contracts';
import { computeFocusDimmedTileIds } from '../../shared/focusDimmedTileIds';
import { getFloorClearCausalityRows } from '../../shared/level-result-presentation';
import { getFloorIdentityContract } from '../../shared/boss-encounters';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { formatLevelResultObjectiveLine } from '../../shared/secondary-objectives';
import {
    canOfferEndlessRiskWager
} from '../../shared/objective-rules';
import { getRouteChoiceAvailability } from '../../shared/route-rules';
import { getTraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import {
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard
} from '../../shared/board-powers';
import {
    getDungeonBoardPresentation,
    getDungeonExitStatus,
    getDungeonObjectiveStatus
} from '../../shared/dungeon-rules';
import { getMemoryRecallFeedback } from '../../shared/memory-recall-feedback';
import { getDungeonMapPresentation, getDungeonRouteDecisionPresentation } from '../../shared/run-map';
import { useNotificationStore } from '@cross-repo-libs/notifications';
import type { CSSProperties } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { UI_ART } from '../assets/ui';
import { isNarrowShortLandscapeForMenuStack } from '../breakpoints';
import { deriveCameraViewportMode, latchPhoneWidthForMobileCamera } from '../../shared/cameraViewportMode';
import {
    getFeaturedObjectiveLabel,
    getFloorArchetypeDefinition,
    getFloorChapterIdentity,
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { useDistractionChannelTick } from '../hooks/useDistractionChannelTick';
import { useLatestRef } from '../hooks/useLatestRef';
import {
    detectClaimedFindableKind,
    formatHudActionFeedbackText,
    getFindableToastText,
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
import GameLeftToolbar from './GameLeftToolbar';
import { GameScreenActionFeedbackRail } from './GameScreenActionFeedbackRail';
import { GameScreenDungeonRunStrip } from './GameScreenDungeonRunStrip';
import { GameScreenDungeonStatusPanel } from './GameScreenDungeonStatusPanel';
import { GameScreenEndlessChapterBanner } from './GameScreenEndlessChapterBanner';
import GameplayHudBar from './GameplayHudBar';
import MainMenuBackground from './MainMenuBackground';
import OverlayModal from './OverlayModal';
import RelicDraftOfferPanel from './RelicDraftOfferPanel';
import { useGameScreenBoardVisualSettings } from './gameScreenStoreSelectors';
import TileBoard, { type TileBoardHandle } from './TileBoard';

const MemoTileBoard = memo(TileBoard);
const MemoGameplayHudBar = memo(GameplayHudBar);
import {
    playCountdownPressureSfx,
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
import { getDungeonCombatLogRows, getVisualHudAnnouncementFollowup } from './gameScreenFeedback';
import {
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS,
    matchScoreFloatDurationMs
} from './matchScoreFloaterTiming';
import { getStickyBlockedTileId } from '../gameplay/stickyFingersBlockedTileId';
import { useGameScreenPowerTileHints } from './useGameScreenPowerTileHints';
import { useGameScreenTraitRouteTargets } from './useGameScreenTraitRouteTargets';

const subscribeOsPrefersReducedMotion = (onStoreChange: () => void): (() => void) => {
    if (typeof window === 'undefined') {
        return () => {};
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onStoreChange);
    return () => mq.removeEventListener('change', onStoreChange);
};

const getOsPrefersReducedMotionSnapshot = (): boolean =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getOsPrefersReducedMotionServerSnapshot = (): boolean => false;
import { MUTATOR_CATALOG } from '../../shared/mechanics-encyclopedia';
import { matchScoreFloaterLiveRegionText } from '../copy/matchScoreFloater';
import { mismatchFloaterLiveRegionText, mismatchFloaterVisualLabel } from '../copy/mismatchFloater';
import { routeSpecialLabel, routeSpecialRewardLine } from '../../shared/route-world';

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

const BONUS_TAG_LABELS: Record<string, string> = {
    scholar_style: 'Scholar style',
    glass_witness: 'Glass witness',
    cursed_last: 'Cursed last',
    flip_par: 'Flip par',
    objective_streak: 'Objective streak',
    boss_floor: 'Boss floor',
    boss_defeated: 'Boss defeated',
    boss_trophy_cache: 'Boss trophy cache',
    boss_trophy_forfeited: 'Boss trophy forfeited',
    traps_disarmed: 'Traps disarmed',
    treasure_claimed: 'Treasure claimed',
    route_claimed: 'Route claimed',
    perfect_scout: 'Perfect scout'
};

/** PLAY-009: pair-index rings on face-down DOM tiles only for very early floors + until FTUE flag clears after tutorial floors. */
const TUTORIAL_PAIR_MARKER_MAX_LEVEL = 2;

const routeTypeLabel = (routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']): string => {
    switch (routeType) {
        case 'safe':
            return 'Safe route';
        case 'greed':
            return 'Greedy route';
        case 'mystery':
        default:
            return 'Mystery route';
    }
};

const routeSpecialDisplayLabel = (kind: RouteSpecialKind | RouteCardKind): string =>
    routeSpecialLabel(kind as RouteSpecialKind);

const routeSpecialDisplayRewardLine = (kind: RouteSpecialKind | RouteCardKind): string =>
    `Match the ${routeSpecialLabel(kind as RouteSpecialKind)} pair for ${routeSpecialRewardLine(kind as RouteSpecialKind)}.`;

const routeCardKindForRouteType = (routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']): RouteCardKind =>
    routeType === 'safe' ? 'safe_ward' : routeType === 'greed' ? 'greed_cache' : 'mystery_veil';

const dungeonExitLockLabel = (lockKind: ReturnType<typeof getDungeonExitStatus>['lockKind']): string => {
    if (lockKind === 'none') {
        return 'Unlocked exit';
    }
    if (lockKind === 'lever') {
        return 'Lever-sealed exit';
    }
    return `${lockKind.charAt(0).toUpperCase()}${lockKind.slice(1)} key exit`;
};

const getClearLifeBonusLabel = (result: NonNullable<RunState['lastLevelResult']>): string | null => {
    if (result.clearLifeGained !== 1) {
        return null;
    }

    if (result.clearLifeReason === 'perfect') {
        return 'Perfect floor bonus: +1 Life';
    }

    if (result.clearLifeReason === 'clean') {
        return 'Clean floor bonus: +1 Life';
    }

    return null;
};

const FLOOR_CLEAR_LIFE_CARRYOVER_NOTE =
    'Lives carry across the run. Clean clears, safe routes, shops, rests, and shrines can restore them.';

const getFirstRouteChoiceTeachingLabel = (routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']): string => {
    if (routeType === 'safe') {
        return 'Recommended first route';
    }
    if (routeType === 'greed') {
        return 'High reward, higher danger';
    }
    return 'Changes the next board';
};

const formatBonusTagsLine = (tags: string[] | undefined): string | null => {
    if (!tags || tags.length === 0) {
        return null;
    }
    return tags.map((t) => BONUS_TAG_LABELS[t] ?? t).join(' · ');
};

const featuredObjectiveFailReason = (run: RunState): string | null => {
    const id = run.lastLevelResult?.featuredObjectiveId;
    if (!id || run.lastLevelResult?.featuredObjectiveCompleted) {
        return null;
    }
    if (id === 'scholar_style') {
        return 'Failed: shuffle or destroy was used this floor.';
    }
    if (id === 'glass_witness') {
        return 'Failed: the glass decoy entered a mismatch.';
    }
    if (id === 'cursed_last') {
        return 'Failed: the cursed pair was cleared before the last real pair.';
    }
    if (id === 'flip_par') {
        return 'Failed: match resolutions exceeded the floor par.';
    }
    return null;
};

const countFavorBonusPicksBanked = (favorProgressAfter: number, favorGain: number): number => {
    if (favorGain <= 0) {
        return 0;
    }
    const previousProgress = favorProgressAfter - favorGain;
    return previousProgress < 0 ? 1 : 0;
};

const GameScreen = ({ achievements, run, suppressStatusOverlays = false }: GameScreenProps) => {
    const shellRef = useRef<HTMLElement | null>(null);
    const boardStageRef = useRef<HTMLDivElement | null>(null);
    const boardFloaterRef = useRef<HTMLDivElement | null>(null);
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
    const { boardPinMode, destroyPairArmed, peekModeArmed, tileSwapArmed, tileSwapFirstTileId } = useAppStore(
        useShallow((state) => ({
            boardPinMode: state.boardPinMode,
            destroyPairArmed: state.destroyPairArmed,
            peekModeArmed: state.peekModeArmed,
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
    const osPrefersReducedMotion = useSyncExternalStore(
        subscribeOsPrefersReducedMotion,
        getOsPrefersReducedMotionSnapshot,
        getOsPrefersReducedMotionServerSnapshot
    );
    const boardFloaterReducedMotion = settingsReduceMotion || osPrefersReducedMotion;
    const boardFloaterDurationMs = matchScoreFloatDurationMs(boardFloaterReducedMotion);

    const { matchScorePop, mismatchScorePop, dismissMatchScorePop, dismissMismatchScorePop } = useAppStore(
        useShallow((state) => ({
            matchScorePop: state.matchScorePop,
            mismatchScorePop: state.mismatchScorePop,
            dismissMatchScorePop: state.dismissMatchScorePop,
            dismissMismatchScorePop: state.dismissMismatchScorePop
        }))
    );

    const boardFloaterPayload = useMemo(
        () =>
            matchScorePop
                ? ({ kind: 'match' as const, ...matchScorePop })
                : mismatchScorePop
                  ? ({ kind: 'miss' as const, ...mismatchScorePop })
                  : null,
        [matchScorePop, mismatchScorePop]
    );

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
    const seenAchievementToastIdsRef = useRef<Set<string>>(new Set());
    const pickupToastSnapshotRef = useRef<{
        level: number;
        claimed: number;
        tiles: NonNullable<RunState['board']>['tiles'];
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
    const previousRelicOfferOpenRef = useRef(false);
    const previousCountdownPressureSecondRef = useRef<number | null>(null);
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
        const relicOfferOpen = Boolean(run.relicOffer);
        if (relicOfferOpen && !previousRelicOfferOpenRef.current) {
            void resumeAudioContext();
            playRelicOfferOpenSfx(shuffleSfxGain);
        }
        previousRelicOfferOpenRef.current = relicOfferOpen;
    }, [run.relicOffer, shuffleSfxGain]);

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
            const infoDuration = settingsReduceMotion ? 3500 : 5500;
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
        settingsReduceMotion,
        suppressStatusOverlays
    ]);

    useEffect(() => {
        if (!run.board) {
            pickupToastSnapshotRef.current = null;
            return;
        }

        const nextSnapshot = {
            level: run.board.level,
            claimed: run.findablesClaimedThisFloor,
            tiles: run.board.tiles
        };
        const previousSnapshot = pickupToastSnapshotRef.current;

        if (
            previousSnapshot &&
            previousSnapshot.level === run.board.level &&
            run.findablesClaimedThisFloor > previousSnapshot.claimed
        ) {
            const claimedKind = detectClaimedFindableKind(previousSnapshot.tiles, run.board.tiles);
            if (claimedKind != null) {
                const { showInfo } = useNotificationStore.getState();
                const infoDuration = settingsReduceMotion ? 2200 : 3200;
                showInfo(getFindableToastText(claimedKind), infoDuration, {
                    stackKey: `pickup:${run.board.level}:${run.findablesClaimedThisFloor}`
                });
            }
        }

        pickupToastSnapshotRef.current = nextSnapshot;
    }, [run.board, run.findablesClaimedThisFloor, settingsReduceMotion]);

    /** Persist `powersFtueSeen` once the player leaves tutorial floors (pair markers no longer needed). */
    useEffect(() => {
        const level = run.board?.level;
        if (level !== undefined && level > TUTORIAL_PAIR_MARKER_MAX_LEVEL && !saveData.powersFtueSeen) {
            void dismissPowersFtue();
        }
    }, [dismissPowersFtue, run.board?.level, saveData.powersFtueSeen]);

    const distractionHudOn =
        run.activeMutators.includes('distraction_channel') &&
        settingsDistractionChannelEnabled &&
        !settingsReduceMotion &&
        run.status === 'playing';
    const distractionTick = useDistractionChannelTick(distractionHudOn);
    const { tiltRef: gameFieldTiltRef } = usePlatformTiltField({
        enabled: true,
        reduceMotion: settingsReduceMotion,
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
    const clearLifeBonusLabel = run.lastLevelResult ? getClearLifeBonusLabel(run.lastLevelResult) : null;
    const objectiveBonusLine =
        run.lastLevelResult && (run.lastLevelResult.objectiveBonusScore ?? 0) > 0
            ? `Objective bonuses: +${run.lastLevelResult.objectiveBonusScore!.toLocaleString()}`
            : null;
    const bonusTagsLine = run.lastLevelResult ? formatBonusTagsLine(run.lastLevelResult.bonusTags) : null;
    const traitRouteObjectiveLine =
        run.lastLevelResult?.traitRouteObjectiveRequired != null
            ? run.lastLevelResult.traitRouteObjectiveCompleted
                ? `Trait routes: Complete (${run.lastLevelResult.traitRouteObjectiveReward ?? 'reward claimed'})`
                : `Trait routes: ${run.lastLevelResult.traitRouteObjectiveProgress ?? 0}/${run.lastLevelResult.traitRouteObjectiveRequired}`
            : null;
    const endlessChapterActive =
        run.gameMode === 'endless' && usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion);
    const currentArchetype = getFloorArchetypeDefinition(run.board?.floorArchetypeId ?? null);
    const currentFeaturedObjectiveLabel = getFeaturedObjectiveLabel(run.board?.featuredObjectiveId ?? null);
    const currentFloorIdentity = run.board
        ? getFloorIdentityContract({
              floorTag: run.board.floorTag ?? 'normal',
              floorArchetypeId: run.board.floorArchetypeId,
              mutators: run.activeMutators,
              featuredObjectiveLabel: currentFeaturedObjectiveLabel
          })
        : null;
    const floorClearCausalityRows = run.lastLevelResult
        ? getFloorClearCausalityRows(run.lastLevelResult, run.powersUsedThisRun, currentFloorIdentity)
        : [];
    const featuredObjectiveResultLine = run.lastLevelResult ? formatLevelResultObjectiveLine(run.lastLevelResult) : null;
    const featuredObjectiveFailureLine = featuredObjectiveFailReason(run);
    const favorGained = run.lastLevelResult?.relicFavorGained ?? 0;
    const favorGainLine =
        run.lastLevelResult?.featuredObjectiveId != null ? `Favor gained: +${favorGained}` : null;
    const wagerSuretyActive = run.relicIds.includes('wager_surety');
    const offeredRiskWagerFavor = ENDLESS_RISK_WAGER_BONUS_FAVOR + (wagerSuretyActive ? 1 : 0);
    const endlessRiskWagerOutcomeLine =
        run.lastLevelResult?.endlessRiskWagerOutcome === 'won'
            ? `Risk wager won: +${run.lastLevelResult.endlessRiskWagerFavorGained ?? 0} Favor`
            : run.lastLevelResult?.endlessRiskWagerOutcome === 'lost'
              ? `Risk wager lost: -${run.lastLevelResult.endlessRiskWagerStreakLost ?? 0} streak`
              : null;
    const featuredObjectiveStreakLine =
        run.lastLevelResult?.featuredObjectiveId != null
            ? `Objective streak: x${run.lastLevelResult.featuredObjectiveStreak ?? 0}${
                  (run.lastLevelResult.featuredObjectiveStreakBonus ?? 0) > 0
                      ? ` (+${run.lastLevelResult.featuredObjectiveStreakBonus!.toLocaleString()})`
                      : ''
              }`
            : null;
    const favorBankedPickCount = countFavorBonusPicksBanked(run.relicFavorProgress, favorGained);
    const favorBankedLine =
        favorBankedPickCount > 0
            ? `Extra relic ${favorBankedPickCount === 1 ? 'pick' : 'picks'} banked for the next shrine`
            : null;
    const firstClearOnboardingLine =
        run.lastLevelResult?.level === 1 && saveData.onboardingDismissed
            ? 'First-run guide complete. Continue when you are ready; deeper help stays available from Codex.'
            : null;
    const endlessRiskWagerOfferAvailable = canOfferEndlessRiskWager(run);
    const acceptedEndlessRiskWager =
        run.lastLevelResult && run.endlessRiskWager?.acceptedOnLevel === run.lastLevelResult.level
            ? run.endlessRiskWager
            : null;
    const routeChoiceRequired = Boolean(run.lastLevelResult?.routeChoices && !run.pendingRouteCardPlan);
    const firstRouteChoiceRequired = routeChoiceRequired && run.lastLevelResult?.level === 1;
    const routeChoiceRequiredCopy =
        firstRouteChoiceRequired
            ? 'Choose the next room type. Safe protects the run, Greed trades danger for reward, and Mystery changes the next board.'
            : 'Pick one room to continue. Route choice is the active decision; other floor-clear actions resume after the route is locked.';
    const currentDungeonNode = run.dungeonRun?.nodes.find((node) => node.id === run.dungeonRun.currentNodeId) ?? null;
    const dungeonMapPresentation = getDungeonMapPresentation(run.dungeonRun);
    const dungeonRouteDecisionPresentation =
        routeChoiceRequired && run.lastLevelResult?.routeChoices
            ? getDungeonRouteDecisionPresentation(run.dungeonRun, run.lastLevelResult.routeChoices)
            : null;
    const memoryRecallFeedback = useMemo(() => getMemoryRecallFeedback(run), [run]);
    const routeChoiceMemoryById = useMemo(
        () => new Map(memoryRecallFeedback.choices.map((choice) => [choice.id, choice])),
        [memoryRecallFeedback.choices]
    );
    const memoryRecallPanelRows = useMemo(
        () =>
            [
                ...memoryRecallFeedback.path,
                ...memoryRecallFeedback.clues,
                ...memoryRecallFeedback.enemies,
                ...memoryRecallFeedback.symbols,
                ...memoryRecallFeedback.penalties,
                ...memoryRecallFeedback.recallPlan,
                ...memoryRecallFeedback.upgrades
            ].slice(0, 6),
        [
            memoryRecallFeedback.path,
            memoryRecallFeedback.clues,
            memoryRecallFeedback.enemies,
            memoryRecallFeedback.symbols,
            memoryRecallFeedback.recallPlan,
            memoryRecallFeedback.penalties,
            memoryRecallFeedback.upgrades
        ]
    );
    const currentDungeonRoom = dungeonMapPresentation.current;
    const visibleDungeonMapNodes = dungeonMapPresentation.nodes.filter(
        (node) => node.status === 'current' || node.status === 'cleared' || node.status === 'revealed' || node.status === 'skipped'
    );
    const pendingRouteCardKind = run.pendingRouteCardPlan
        ? routeCardKindForRouteType(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingRouteLine =
        run.pendingRouteCardPlan && pendingRouteCardKind
            ? `${routeTypeLabel(run.pendingRouteCardPlan.routeType)} selected: ${
                  run.pendingRouteCardPlan.routeType === 'safe'
                      ? 'next floor adds defensive ward support.'
                      : run.pendingRouteCardPlan.routeType === 'greed'
                        ? 'next floor adds richer caches and extra reward-risk pressure.'
                        : 'next floor adds deterministic mystery veils.'
              }`
            : null;
    const pendingDungeonNode = run.pendingRouteCardPlan
        ? run.dungeonRun?.nodes.find((node) => node.id === run.pendingRouteCardPlan?.choiceId) ?? null
        : null;
    const dungeonExitStatus = getDungeonExitStatus(run);
    const dungeonExitRouteLine = dungeonExitStatus.routeType
        ? `${routeTypeLabel(dungeonExitStatus.routeType)} beyond this door.`
        : 'This stair leaves the current floor.';
    const dungeonExitLockLine =
        dungeonExitStatus.lockKind === 'lever'
            ? `${dungeonExitStatus.leverCount}/${dungeonExitStatus.requiredLeverCount} floor levers ready.`
            : dungeonExitStatus.lockKind === 'none'
              ? 'No key required.'
              : `Keys: ${run.dungeonKeys[dungeonExitStatus.lockKind] ?? 0} matching, ${
                    run.dungeonMasterKeys
                } master.`;
    const activeRouteTiles = run.board?.tiles ?? [];
    const activeRouteSpecialKinds = activeRouteTiles
        .filter(
            (tile) => (tile.routeSpecialKind || tile.routeCardKind) && tile.state !== 'matched' && tile.state !== 'removed'
        )
        .map((tile) => tile.routeSpecialKind ?? tile.routeCardKind!);
    const activeRouteSpecialKind = activeRouteSpecialKinds[0] ?? null;
    const activeRoutePairCount = new Set(
        activeRouteTiles
            .filter(
                (tile) =>
                    (tile.routeSpecialKind || tile.routeCardKind) && tile.state !== 'matched' && tile.state !== 'removed'
            )
            .map((tile) => tile.pairKey)
    ).size;
    const activeRouteBannerLine =
        activeRouteSpecialKind && activeRoutePairCount > 0 && run.status !== 'levelComplete'
            ? `${routeSpecialDisplayLabel(activeRouteSpecialKind)} in play: ${routeSpecialDisplayRewardLine(activeRouteSpecialKind)}`
            : null;
    const dungeonPresentation = getDungeonBoardPresentation(run);
    const activeDungeonPanel = run.status !== 'levelComplete' && dungeonPresentation.visible ? dungeonPresentation : null;
    const activeDungeonObjectiveStatus = activeDungeonPanel ? getDungeonObjectiveStatus(run) : null;
    const traitRouteObjectiveStatus = getTraitRouteObjectiveStatus(run);
    const liveObjectiveStatus = activeDungeonObjectiveStatus ?? traitRouteObjectiveStatus;
    const dungeonCombatLogRows = activeDungeonPanel ? getDungeonCombatLogRows(run) : [];
    const nextFloorPreview =
        endlessChapterActive && run.lastLevelResult
            ? pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, run.lastLevelResult.level + 1, run.gameMode)
            : null;
    const nextFloorObjectiveLabel = getFeaturedObjectiveLabel(nextFloorPreview?.featuredObjectiveId ?? null);
    const nextFloorIdentity = nextFloorPreview
        ? getFloorIdentityContract({
              floorTag: nextFloorPreview.floorTag,
              floorArchetypeId: nextFloorPreview.floorArchetypeId,
              mutators: nextFloorPreview.mutators,
              featuredObjectiveLabel: nextFloorObjectiveLabel
          })
        : null;
    const nextFloorChapterIdentity = nextFloorPreview ? getFloorChapterIdentity(nextFloorPreview) : null;
    const nextFloorMutatorNames =
        nextFloorPreview && nextFloorPreview.mutators.length > 0
            ? nextFloorPreview.mutators.map((id) => MUTATOR_CATALOG[id]?.title ?? id).join(', ')
            : 'No mutators';
    const nextFloorMutatorLabels =
        nextFloorChapterIdentity?.actTitle && nextFloorChapterIdentity.biomeTitle
            ? `${nextFloorChapterIdentity.actTitle} - ${nextFloorChapterIdentity.biomeTitle} - ${nextFloorMutatorNames}.${
                  nextFloorChapterIdentity.routePreview ? ` ${nextFloorChapterIdentity.routePreview}` : ''
              }`
            : nextFloorMutatorNames;
    const nextFloorPreviewLine =
        nextFloorPreview?.title && nextFloorObjectiveLabel
            ? `Next: ${nextFloorPreview.title} - ${nextFloorObjectiveLabel} - ${nextFloorMutatorLabels}`
            : null;

    const nextFloorPreviewIdentityLine = nextFloorPreview && nextFloorIdentity
        ? `${nextFloorIdentity.label}: ${nextFloorIdentity.counterplaySentence}`
        : null;

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
    const { message: politeHudAnnouncement, priority: politeHudAnnouncementPriority } = useHudPoliteLiveAnnouncement({
        boardLevel: run.board?.level ?? null,
        boardTiles: run.board?.tiles ?? [],
        findablesClaimedThisFloor: run.findablesClaimedThisFloor,
        gauntletActive,
        gauntletRemainingMs,
        lives: run.lives,
        guardTokens: run.stats.guardTokens,
        comboShards: run.stats.comboShards,
        shopGold: run.shopGold,
        shuffleCharges: run.shuffleCharges,
        regionShuffleCharges: run.regionShuffleCharges,
        stickyBlockIndex: run.stickyBlockIndex,
        parasiteFloors: run.parasiteFloors,
        parasiteWardRemaining: run.parasiteWardRemaining,
        scoreParasiteActive: run.activeMutators.includes('score_parasite'),
        matchedPairs: run.board?.matchedPairs ?? 0,
        pairCount: run.board?.pairCount ?? 0,
        mismatches: run.stats.mismatches,
        tileTraitMatches: run.stats.tileTraitMatches,
        tileTraitMismatches: run.stats.tileTraitMismatches,
        volatileTraitShuffles: run.stats.volatileTraitShuffles,
        objectiveProgress: liveObjectiveStatus?.progress,
        objectiveRequired: liveObjectiveStatus?.required,
        objectiveLabel: liveObjectiveStatus?.label,
        recallFocus: run.recallFocus,
        recallFocusMax: RECALL_FOCUS_MAX,
        recallMatchesThisFloor: run.recallMatchesThisFloor,
        recallMistakesThisFloor: run.recallMistakesThisFloor,
        recallBonusScoreThisFloor: run.recallBonusScoreThisFloor,
        forgottenTileCountThisFloor: run.forgottenTileIdsThisFloor.length,
        chainMatchStreak: run.stats.currentStreak,
        chainAnnounceActive: run.status === 'playing',
        gambitThirdPickActive,
        gambitOpportunityFlippedIds:
            gambitThirdPickActive && run.board ? run.board.flippedTileIds : null,
        reduceMotion: settingsReduceMotion,
        hazardTileTriggersThisFloor: run.hazardTileTriggersThisFloor,
        hazardShuffleSnaresThisFloor: run.hazardShuffleSnaresThisFloor,
        hazardCascadeCachesThisFloor: run.hazardCascadeCachesThisFloor,
        hazardMirrorDecoysThisFloor: run.hazardMirrorDecoysThisFloor,
        hazardFragileCacheClaimsThisFloor: run.hazardFragileCacheClaimsThisFloor,
        hazardFragileCacheBreaksThisFloor: run.hazardFragileCacheBreaksThisFloor,
        hazardTollCachesThisFloor: run.hazardTollCachesThisFloor,
        hazardFuseCachesThisFloor: run.hazardFuseCachesThisFloor,
        hazardFuseCacheExpiredClaimsThisFloor: run.hazardFuseCacheExpiredClaimsThisFloor,
        lanternWardScoutsThisFloor: run.lanternWardScoutsThisFloor,
        omenSealScoutsThisFloor: run.omenSealScoutsThisFloor,
        mimicCacheClaimsThisFloor: run.mimicCacheClaimsThisFloor,
        mimicCacheBitesThisFloor: run.mimicCacheBitesThisFloor,
        mimicCacheGuardBitesThisFloor: run.mimicCacheGuardBitesThisFloor,
        anchorSealUsesThisFloor: run.anchorSealUsesThisFloor,
        loadedGatewayPlansThisFloor: run.loadedGatewayPlansThisFloor,
        catalystAltarUpgradesThisFloor: run.catalystAltarUpgradesThisFloor,
        parasiteVesselConversionsThisFloor: run.parasiteVesselConversionsThisFloor,
        pinLatticeRewardsThisFloor: run.pinLatticeRewardsThisFloor,
        safeHazardWardsUsedThisFloor: run.safeHazardWardsUsedThisFloor,
        dungeonEnemiesDefeatedThisFloor: run.dungeonEnemiesDefeatedThisFloor,
        enemyHazardHitsThisFloor: run.enemyHazardHitsThisFloor,
        enemyHazardsDefeatedThisFloor: run.enemyHazardsDefeatedThisFloor
    });
    const visualHudAnnouncement = politeHudAnnouncement
        ? formatHudActionFeedbackText(politeHudAnnouncement)
        : '';
    const visualHudAnnouncementLabel = politeHudAnnouncementPriority === 'error' ? 'Critical' : 'Last action';
    const remainingPairCount = Math.max(0, (run.board?.pairCount ?? 0) - (run.board?.matchedPairs ?? 0));
    const visualHudAnnouncementFollowup = getVisualHudAnnouncementFollowup({
        announcement: politeHudAnnouncement,
        priority: politeHudAnnouncementPriority,
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
        if (showTutorialPairMarkers && showForgivenessHint && !compactTouchChrome) {
            queueMicrotask(() => {
                setRulesHintsExpanded(true);
            });
        }
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
    const traitSwapHint = !tileSwapDisabled ? traitSwapRouteHint : null;
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
            : settingsBoardPresentation === 'breathing' && !settingsReduceMotion
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
                reduceMotion={settingsReduceMotion}
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
                            reduceMotion={settingsReduceMotion}
                            run={run}
                        />

                        {gambitThirdPickActive ? (
                            <div
                                aria-live="polite"
                                className={styles.gambitOpportunityHint}
                                data-testid="gambit-opportunity-hint"
                                role="status"
                            >
                                {GAMBIT_OPPORTUNITY_HINT_LINE}
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
                            style={{ '--gameplay-workshop-table-image': `url(${UI_ART.gameplayWorkshopTable})` } as CSSProperties}
                        >
                            <div className={styles.boardGlow} aria-hidden="true" />
                            {activeRouteBannerLine ? (
                                <div className={styles.routeCardBanner} data-testid="route-card-board-banner">
                                    <strong>{routeSpecialDisplayLabel(activeRouteSpecialKind!)}</strong>
                                    <span>{routeSpecialDisplayRewardLine(activeRouteSpecialKind!)}</span>
                                </div>
                            ) : null}
                            {activeDungeonPanel ? (
                                <GameScreenDungeonStatusPanel
                                    combatLogRows={dungeonCombatLogRows}
                                    panel={activeDungeonPanel}
                                />
                            ) : null}
                            {visualHudAnnouncement ? (
                                <GameScreenActionFeedbackRail
                                    followup={visualHudAnnouncementFollowup}
                                    label={visualHudAnnouncementLabel}
                                    message={visualHudAnnouncement}
                                    tone={politeHudAnnouncementPriority}
                                />
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
                                reduceMotion={settingsReduceMotion}
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
                            {boardFloaterPayload ? (
                                <span
                                    key={`live-${boardFloaterPayload.key}`}
                                    aria-atomic="true"
                                    aria-live="polite"
                                    className={styles.srOnly}
                                >
                                    {boardFloaterPayload.kind === 'match'
                                        ? matchScoreFloaterLiveRegionText(
                                              boardFloaterPayload.amount,
                                              boardFloaterPayload.traitInteractionTexts
                                          )
                                        : mismatchFloaterLiveRegionText(boardFloaterPayload.traitInteractionTexts)}
                                </span>
                            ) : null}
                            {boardFloaterPos && boardFloaterPayload ? (
                                <div
                                    ref={boardFloaterRef}
                                    key={boardFloaterPayload.key}
                                    aria-hidden
                                    className={`${
                                        boardFloaterPayload.kind === 'match'
                                            ? styles.matchScoreFloater
                                            : styles.mismatchScoreFloater
                                    } ${boardFloaterReducedMotion ? styles.matchScoreFloaterReduced : ''}`}
                                    data-testid={
                                        boardFloaterPayload.kind === 'match'
                                            ? 'match-score-floater'
                                            : 'mismatch-score-floater'
                                    }
                                    style={
                                        {
                                            left: boardFloaterPos.x,
                                            top: boardFloaterPos.y,
                                            '--match-score-float-ms': `${boardFloaterDurationMs}ms`
                                        } as CSSProperties
                                    }
                                >
                                    <span className={styles.boardFloaterMain}>
                                        {boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.routeRewardText ??
                                              `+${boardFloaterPayload.amount.toLocaleString()}`
                                            : mismatchFloaterVisualLabel()}
                                    </span>
                                    {boardFloaterPayload.traitInteractionTexts?.slice(0, 2).map((line) => (
                                        <span className={styles.boardFloaterTraitLine} key={line}>
                                            {line}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
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
                                </aside>
                            ) : null}
                            {firstRunRoomGoalPrompt ? (
                                <aside className={styles.playableOnboardingPrompt} data-testid="first-run-room-goal-prompt">
                                    <span className={styles.playableOnboardingStep}>{firstRunRoomGoalPrompt.title}</span>
                                    <strong>{firstRunRoomGoalPrompt.prompt}</strong>
                                    <p>{firstRunRoomGoalPrompt.detail}</p>
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
                        title={dungeonExitLockLabel(dungeonExitStatus.lockKind)}
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
                            descriptionById={relicEffectLabels}
                            onUseService={applyRelicOfferService}
                            onPick={pickRelic}
                            optionIds={run.relicOffer.options}
                            pickRound={run.relicOffer.pickRound}
                            reasonById={run.relicOffer.contextualOptionReasons}
                            serviceActions={run.relicOffer.services}
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
                        subtitle={`Level ${run.lastLevelResult.level} cleared. Score +${run.lastLevelResult.scoreGained}. Try Daily or Scholar contract from the menu for different goals.`}
                        title="Floor cleared"
                    >
                        <div
                            className={styles.floorClearResultStack}
                            data-route-choice-required={routeChoiceRequired ? 'true' : 'false'}
                            data-testid="floor-clear-result-stack"
                        >
                            {floorClearCausalityRows.length > 0 ? (
                                <div className={styles.floorClearCausalityGrid} data-testid="floor-clear-causality-grid">
                                    {floorClearCausalityRows.map((row) => (
                                        <p
                                            className={styles.modalNote}
                                            data-causality-group={row.group}
                                            data-mechanic-tokens={row.tokens.join(' ')}
                                            key={row.id}
                                        >
                                            <strong>{row.label}:</strong> {row.detail}
                                        </p>
                                    ))}
                                </div>
                            ) : null}
                            {clearLifeBonusLabel ? <p className={styles.modalNote}>{clearLifeBonusLabel}</p> : null}
                            <p className={styles.modalNote}>{FLOOR_CLEAR_LIFE_CARRYOVER_NOTE}</p>
                            {featuredObjectiveResultLine ? <p className={styles.modalNote}>{featuredObjectiveResultLine}</p> : null}
                            {featuredObjectiveFailureLine ? <p className={styles.modalNote}>{featuredObjectiveFailureLine}</p> : null}
                            {featuredObjectiveStreakLine ? <p className={styles.modalNote}>{featuredObjectiveStreakLine}</p> : null}
                            {endlessRiskWagerOutcomeLine ? <p className={styles.modalNote}>{endlessRiskWagerOutcomeLine}</p> : null}
                            {favorGainLine ? <p className={styles.modalNote}>{favorGainLine}</p> : null}
                            {favorBankedLine ? <p className={styles.modalNote}>{favorBankedLine}</p> : null}
                            {firstClearOnboardingLine ? <p className={styles.modalNote}>{firstClearOnboardingLine}</p> : null}
                            {objectiveBonusLine ? <p className={styles.modalNote}>{objectiveBonusLine}</p> : null}
                            {traitRouteObjectiveLine ? <p className={styles.modalNote}>{traitRouteObjectiveLine}</p> : null}
                            {bonusTagsLine ? <p className={styles.modalNote}>{bonusTagsLine}</p> : null}
                            {nextFloorPreviewLine ? <p className={styles.modalNote}>{nextFloorPreviewLine}</p> : null}
                            {nextFloorPreviewIdentityLine ? <p className={styles.modalNote}>{nextFloorPreviewIdentityLine}</p> : null}
                            {currentDungeonNode ? (
                                <p className={styles.modalNote}>
                                    Cleared node: {currentDungeonNode.label}. Choose a connected room to shape the next board.
                                </p>
                            ) : null}
                        </div>
                        {pendingRouteLine ? <p className={styles.routeSelectedNote}>{pendingRouteLine}</p> : null}
                        {pendingDungeonNode ? (
                            <p className={styles.routeSelectedNote}>
                                Dungeon node armed: {pendingDungeonNode.label}. {pendingDungeonNode.detail}
                            </p>
                        ) : null}
                        {run.shopOffers.length > 0 ? (
                            <p className={styles.modalNote}>
                                Vendor alcove available: {run.shopOffers.length} services, {run.shopGold} shop gold.
                            </p>
                        ) : null}
                        {routeChoiceRequired && run.lastLevelResult.routeChoices ? (
                            <section
                                aria-labelledby="dungeon-route-choice-title"
                                className={styles.dungeonMapChoicePanel}
                                data-decision-state="required"
                                data-testid="route-choice-panel"
                            >
                                <div className={styles.dungeonMapChoiceHeader}>
                                    <span>Dungeon map</span>
                                    <strong id="dungeon-route-choice-title">Choose the next room</strong>
                                    <small>
                                        Act {dungeonMapPresentation.act} / boss at depth {dungeonMapPresentation.bossFloor}
                                    </small>
                                </div>
                                <p className={styles.dungeonMapChoiceInstruction} data-testid="route-choice-required-copy">
                                    {routeChoiceRequiredCopy}
                                </p>
                                <span className={styles.dungeonMapChoiceSummary}>
                                    {dungeonRouteDecisionPresentation?.summary ?? run.lastLevelResult.routeChoices
                                        .map((option) => `${option.label}: ${option.detail}`)
                                        .join(' · ')}
                                </span>
                                <section
                                    aria-labelledby="route-memory-read-title"
                                    className={styles.routeMemoryReadPanel}
                                    data-pressure={memoryRecallFeedback.pressure}
                                    data-testid="route-memory-read-panel"
                                >
                                    <div className={styles.routeMemoryReadHeader}>
                                        <span>Memory read</span>
                                        <strong id="route-memory-read-title">
                                            Focus {memoryRecallFeedback.focus}/{RECALL_FOCUS_MAX} - {memoryRecallFeedback.focusLabel}
                                        </strong>
                                        <small>{memoryRecallFeedback.atmosphericSummary}</small>
                                    </div>
                                    <div className={styles.routeMemoryReadStats} aria-label="Recall state">
                                        <span>
                                            Bonus <strong>+{memoryRecallFeedback.nextCleanMatchBonus}</strong>
                                        </span>
                                        <span>
                                            Clues <strong>{memoryRecallFeedback.rememberedClueTileCount}</strong>
                                        </span>
                                        <span>
                                            Forgotten <strong>{memoryRecallFeedback.forgottenTileCount}</strong>
                                        </span>
                                        <span
                                            data-tone={memoryRecallFeedback.burden.tone}
                                            title={memoryRecallFeedback.burden.detail}
                                        >
                                            Burden <strong>{memoryRecallFeedback.burden.label}</strong>
                                        </span>
                                    </div>
                                    <p className={styles.routeMemoryReadPressure}>{memoryRecallFeedback.pressureDetail}</p>
                                    <p
                                        className={styles.routeMemoryReadNextMove}
                                        data-tone={memoryRecallFeedback.nextMemoryMove.tone}
                                    >
                                        <strong>{memoryRecallFeedback.nextMemoryMove.label}</strong>
                                        <span>{memoryRecallFeedback.nextMemoryMove.detail}</span>
                                    </p>
                                    {memoryRecallPanelRows.length > 0 ? (
                                        <div className={styles.routeMemoryReadRows}>
                                            {memoryRecallPanelRows.map((line) => (
                                                <span
                                                    className={styles.routeMemoryReadRow}
                                                    data-tone={line.tone}
                                                    key={line.id}
                                                >
                                                    <strong>{line.label}</strong>
                                                    <small>{line.detail}</small>
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </section>
                                <div className={styles.dungeonMapTimeline} aria-label="Dungeon map route">
                                    {visibleDungeonMapNodes.map((node) => (
                                        <span
                                            className={styles.dungeonMapTimelineNode}
                                            data-status={node.status}
                                            data-tone={node.tone}
                                            key={node.id}
                                            title={`${node.label}: ${node.risk}`}
                                        >
                                            <span>{node.glyph}</span>
                                            <small>{node.floor}</small>
                                        </span>
                                    ))}
                                </div>
                                <div className={styles.dungeonMapChoiceActions}>
                                    {dungeonRouteDecisionPresentation?.rows.map((row) => {
                                        const choice = run.lastLevelResult?.routeChoices?.find((option) => option.id === row.id);
                                        const availability = choice
                                            ? getRouteChoiceAvailability(run, choice)
                                            : { available: true as const };
                                        const memoryChoice = routeChoiceMemoryById.get(row.id);
                                        const firstRouteTeachingLabel = firstRouteChoiceRequired
                                            ? getFirstRouteChoiceTeachingLabel(row.routeType)
                                            : null;
                                        return (
                                            <button
                                                aria-label={row.choiceLabel}
                                                className={styles.dungeonMapRoomButton}
                                                disabled={!availability.available}
                                                data-route-type={row.routeType}
                                                data-testid={`route-choice-${row.routeType}`}
                                                data-tone={row.tone}
                                                key={row.id}
                                                onClick={() => {
                                                    if (!availability.available) {
                                                        return;
                                                    }
                                                    playUiClick();
                                                    chooseRouteAndContinue(row.id);
                                                }}
                                                type="button"
                                            >
                                                <span className={styles.dungeonMapRoomGlyph}>{row.glyph}</span>
                                                <span className={styles.dungeonMapRoomCopy}>
                                                    <strong>{row.choiceLabel}</strong>
                                                    {row.approachLabel ? (
                                                        <small className={styles.dungeonMapRoomApproach}>
                                                            Approach: {row.approachLabel}
                                                        </small>
                                                    ) : null}
                                                    <small>{row.nodeLabel}: {row.mechanic}</small>
                                                    <em>Reward: {row.reward}</em>
                                                    {firstRouteTeachingLabel ? (
                                                        <small className={styles.dungeonMapRoomTeaching}>
                                                            {firstRouteTeachingLabel}
                                                        </small>
                                                    ) : null}
                                                    {memoryChoice ? (
                                                        <small className={styles.dungeonMapRoomMemory}>
                                                            Memory: {memoryChoice.memoryPrompt}
                                                        </small>
                                                    ) : null}
                                                    {memoryChoice ? (
                                                        <small className={styles.dungeonMapRoomMemory}>
                                                            Recall: {memoryChoice.readinessLabel}
                                                        </small>
                                                    ) : null}
                                                    {memoryChoice ? (
                                                        <small className={styles.dungeonMapRoomMemory}>
                                                            Atmosphere: {memoryChoice.atmosphericCue}
                                                        </small>
                                                    ) : null}
                                                </span>
                                                <span className={styles.dungeonMapRoomRisk}>
                                                    {availability.available ? `Risk: ${row.risk}` : availability.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        ) : null}
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
                                    </>
                                ) : (
                                    <>
                                        <strong>Risk wager available</strong>
                                        <span>
                                            Stake your x{run.featuredObjectiveStreak} objective streak on the next floor for
                                            +{offeredRiskWagerFavor} bonus Favor.
                                        </span>
                                        <button
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
                                value={run.lastLevelResult.mistakes}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Lives"
                                value={run.lastLevelResult.livesRemaining}
                                valueFirst
                            />
                            <StatTile
                                density="minimal"
                                label="Total"
                                value={run.stats.totalScore.toLocaleString()}
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
