import { ACHIEVEMENTS } from '../../shared/achievements';
import {
    MAX_LIVES,
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    MAX_PINNED_TILES,
    RECALL_FOCUS_MAX,
    type AchievementId,
    type RouteNodeType,
    type RunState
} from '../../shared/contracts';
import { computeFocusDimmedTileIds } from '../../shared/focusDimmedTileIds';
import { getPrimaryRewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { getFloorIdentityContract } from '../../shared/boss-encounters';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { useGameplayChromeClearance } from '../hooks/useGameplayChromeClearance';
import { formatLevelResultObjectiveLine } from '../../shared/secondary-objectives';
import { runFilteredArray, runFilteredStringArray } from '../../shared/run-array-guards';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import {
    canOfferEndlessRiskWager
} from '../../shared/objective-rules';
import { getRouteChoiceAvailability, routeChoicesForResult } from '../../shared/route-rules';
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
import { getDungeonRouteDecisionPresentation } from '../../shared/run-map';
import { useNotificationStore } from '@cross-repo-libs/notifications';
import type { CSSProperties } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
    ABANDON_DIALOG_COPY,
    FLOOR_STATUS_COPY,
    PAUSE_DIALOG_COPY,
    ROUTE_CHOICE_COPY,
    SHORTCUTS_COPY
} from '../copy/runDialogCopy';
import {
    BOARD_SHUFFLE_COPY,
    FLASH_PAIR_COPY,
    ROW_SHUFFLE_COPY,
    TILE_SWAP_COPY
} from '../copy/boardPowerCopy';
import { RUN_SHELL_TOOL_CATALOG, type RunShellToolId } from './runShellToolCatalog';
import { runPersistenceInBackground } from '../store/backgroundPersistence';
import { UI_ART } from '../assets/ui';
import { isNarrowShortLandscapeForMenuStack } from '../breakpoints';
import { deriveCameraViewportMode, latchPhoneWidthForMobileCamera } from '../../shared/cameraViewportMode';
import {
    getFeaturedObjectiveLabel,
    getFloorChapterIdentity,
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { useDistractionChannelTick } from '../hooks/useDistractionChannelTick';
import { useEffectiveReducedMotion } from '../hooks/useEffectiveReducedMotion';
import { useLatestRef } from '../hooks/useLatestRef';
import {
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
import { GAMEPAD_SHORTCUT_ROWS, GAMEPLAY_SHORTCUT_ROWS } from '../keyboard/gameplayShortcuts';
import { useGamepadConnected } from '../hooks/useGamepadNavigation';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import { useAppStore } from '../store/useAppStore';
import {
    getLatestBoardTurnResolvedEvent,
    type BoardTurnResolvedEvent
} from '../store/gameplayFeedbackAdapter';
import { projectGameplayFeedback } from '../store/gameplayFeedbackAdapter';
import { perfectMemoryStatus } from '../../shared/perfect-memory-status';
import RunShell, { type RunShellTool } from './RunShell';
import { RUN_SHELL_GLYPHS } from './runShellGlyphs';
import MainMenuBackground from './MainMenuBackground';
import FloorClearDialog, {
    type FloorClearRouteOption,
    type FloorClearSelectedRoute,
    type FloorClearWager
} from './FloorClearDialog';
import OverlayModal, { type ModalAction } from './OverlayModal';
import RelicDraftOfferPanel from './RelicDraftOfferPanel';
import { useGameScreenBoardVisualSettings } from './gameScreenStoreSelectors';
import TileBoard, { type TileBoardHandle } from './TileBoard';

const MemoTileBoard = memo(TileBoard);
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
import boardStyles from './TileBoard.module.css';
import {
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS,
    matchScoreFloatDurationMs
} from './matchScoreFloaterTiming';
import { getStickyBlockedTileId } from '../gameplay/stickyFingersBlockedTileId';
import { useGameScreenPowerTileHints } from './useGameScreenPowerTileHints';
import { useGameScreenTraitRouteTargets } from './useGameScreenTraitRouteTargets';
import type { MatchScorePop, MatchScorePopPayoffChip, MismatchScorePop } from '../store/matchScorePop';

import { MUTATOR_CATALOG } from '../../shared/mechanics-encyclopedia';
import { getChainRewardForecastCues, getChainRewardUrgencyCopy } from '../copy/chainMomentum';
import { matchScoreFloaterChainCue, matchScoreFloaterLiveRegionText } from '../copy/matchScoreFloater';
import {
    mismatchFloaterLiveRegionText,
    mismatchFloaterNextAction,
    mismatchFloaterRecoveryHint,
    mismatchFloaterSignal
} from '../copy/mismatchFloater';

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

const MATCH_PAYOFF_CHIP_IDS: readonly MatchScorePopPayoffChip['id'][] = [
    'score',
    'streak',
    'cascade',
    'tier',
    'trait',
    'pickup',
    'route',
    'chainReward',
    'next'
];

const MATCH_PAYOFF_CHIP_TONES: readonly MatchScorePopPayoffChip['tone'][] = [
    'score',
    'chain',
    'trait',
    'pickup',
    'route',
    'reward',
    'guard',
    'heal'
];

const isMatchPayoffChip = (value: unknown): value is MatchScorePopPayoffChip => {
    if (value == null || typeof value !== 'object') {
        return false;
    }
    const chip = value as { arcadeCue?: unknown; id?: unknown; label?: unknown; tone?: unknown; value?: unknown };
    return (
        typeof chip.label === 'string' &&
        typeof chip.value === 'string' &&
        MATCH_PAYOFF_CHIP_IDS.includes(chip.id as MatchScorePopPayoffChip['id']) &&
        MATCH_PAYOFF_CHIP_TONES.includes(chip.tone as MatchScorePopPayoffChip['tone']) &&
        (chip.arcadeCue == null || typeof chip.arcadeCue === 'string')
    );
};

const matchPayoffChips = (value: unknown): MatchScorePopPayoffChip[] =>
    runFilteredArray(value, isMatchPayoffChip);

const matchTraitInteractionTexts = (value: unknown): string[] => runFilteredStringArray(value);

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

const dungeonExitLockLabel = (lockKind: ReturnType<typeof getDungeonExitStatus>['lockKind']): string => {
    if (lockKind === 'none') {
        return 'Unlocked exit';
    }
    if (lockKind === 'lever') {
        return 'Lever-sealed exit';
    }
    return `${lockKind.charAt(0).toUpperCase()}${lockKind.slice(1)} key exit`;
};

const dungeonExitPromptTitle = (status: ReturnType<typeof getDungeonExitStatus>): string =>
    status.keyFallbackPending ? 'Key fallback pending' : dungeonExitLockLabel(status.lockKind);

const dungeonExitPromptLockLine = (status: ReturnType<typeof getDungeonExitStatus>, run: RunState): string => {
    if (status.keyFallbackPending) {
        return FLOOR_STATUS_COPY.noKeySource;
    }
    if (status.lockKind === 'lever') {
        return `${status.leverCount}/${status.requiredLeverCount} floor levers ready.`;
    }
    if (status.lockKind === 'none') {
        return 'No key required.';
    }
    return `Keys: ${run.dungeonKeys[status.lockKind] ?? 0} matching, ${run.dungeonMasterKeys} master.`;
};

const FLOOR_CLEAR_ROUTE_GLYPHS: Record<RouteNodeType, string> = { greed: '\u2666', mystery: '\u2726', safe: '\u2b21' };

const getClearLifeBonusLabel = (result: NonNullable<RunState['lastLevelResult']>): string | null => {
    if (result.clearLifeGained !== 1) {
        return null;
    }

    if (result.clearLifeReason === 'perfect') {
        return FLOOR_STATUS_COPY.perfectFloorBonus;
    }

    if (result.clearLifeReason === 'clean') {
        return FLOOR_STATUS_COPY.cleanFloorBonus;
    }

    return null;
};







type NextFloorSignalRow = {
    detail: string | null;
    id: string;
    label: string;
    tone: 'counterplay' | 'neutral' | 'pressure' | 'reward' | 'route';
    value: string;
};

/**
 * Pickup toast copy, projected from the resolved-turn event. The claimed kind, the
 * pickup counters and the chain state all come from what the core reported, so the toast
 * cannot disagree with the rules the way a board-snapshot diff could.
 */
const getPickupStackToastText = (turnEvent: BoardTurnResolvedEvent): string | null => {
    const claimedKind = turnEvent.matchedFindableKind;
    if (claimedKind == null) {
        return null;
    }
    const baseText = getFindableToastText(claimedKind);
    const nextReward = getChainRewardForecastCues(
        runNonNegativeInteger(turnEvent.announcement.currentStreakAfter),
        runNonNegativeInteger(turnEvent.announcement.comboShardsAfter),
        runNonNegativeInteger(turnEvent.announcement.livesAfter)
    )[0];
    const pickupClaimed = runNonNegativeInteger(turnEvent.findablesClaimedAfter);
    const pickupTotal = runNonNegativeInteger(turnEvent.findablesTotalAfter);
    const pickupProgress =
        pickupTotal > 0
            ? `Pickups ${pickupClaimed}/${pickupTotal}.`
            : null;

    if (nextReward?.urgency === 'next') {
        return [
            `Stack prime: ${baseText}.`,
            `${getChainRewardUrgencyCopy(nextReward)}: ${nextReward.label} in ${nextReward.distanceLabel}.`,
            pickupProgress
        ]
            .filter(Boolean)
            .join(' ');
    }

    return pickupProgress ? `${baseText}. ${pickupProgress}` : baseText;
};

type MatchFloaterHeat = 'cashout' | 'prime' | 'score' | 'stack' | 'surge';
type MismatchFloaterHeat = 'break' | 'lost-reward' | 'recover' | 'risk' | 'trait-surge';

const getMatchFloaterHeat = (payload: MatchScorePop): MatchFloaterHeat => {
    const impactLabel = payload.impactCue.label.toLowerCase();
    const payoffSummaryLabel = payload.payoffSummary?.label.toLowerCase() ?? '';
    const payoffChipCues = matchPayoffChips(payload.payoffChips).map((chip) => chip.arcadeCue?.toLowerCase() ?? '');

    if (payoffSummaryLabel === 'super stack' || impactLabel === 'super stack') {
        return 'stack';
    }
    if (payoffSummaryLabel === 'stack cashout' || impactLabel === 'stack cashout') {
        return 'stack';
    }
    if (
        payload.impactCue.tone === 'combo' ||
        impactLabel.includes('surge') ||
        payoffChipCues.some((cue) => cue.includes('surge'))
    ) {
        return 'surge';
    }
    if (impactLabel.includes('cashout') || payoffSummaryLabel.includes('cashout')) {
        return 'cashout';
    }
    if (impactLabel.includes('prime') || payoffChipCues.some((cue) => cue.includes('prime'))) {
        return 'prime';
    }
    if (payoffChipCues.some((cue) => cue.includes('cashout'))) {
        return 'cashout';
    }
    return 'score';
};

const getMismatchFloaterHeat = (payload: MismatchScorePop): MismatchFloaterHeat => {
    const traitRiskCount = matchTraitInteractionTexts(payload.traitInteractionTexts).length;
    if (payload.brokenChainRewardCue) {
        return 'lost-reward';
    }
    if ((payload.brokenChainDepth ?? 0) >= 3) {
        return 'break';
    }
    if (traitRiskCount >= 2) {
        return 'trait-surge';
    }
    if (traitRiskCount > 0) {
        return 'risk';
    }
    return 'recover';
};

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
    const [, setRulesHintsExpanded] = useState(false);
    const [viewportResetToken, setViewportResetToken] = useState(0);
    const [gauntletNowMs, setGauntletNowMs] = useState(() => Date.now());
    const [abandonRunConfirmOpen, setAbandonRunConfirmOpen] = useState(false);
    const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
    const gamepadConnected = useGamepadConnected();
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
            toggleBoardPinMode: state.toggleBoardPinMode,
            toggleDestroyPairArmed: state.toggleDestroyPairArmed,
            togglePeekMode: state.togglePeekMode,
            toggleRegionShuffleArmed: state.toggleRegionShuffleArmed,
            toggleTileSwapArmed: state.toggleTileSwapArmed,
            toggleStrayArm: state.toggleStrayArm,
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
        tileFocusAssist: settingsTileFocusAssist
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
    const {
        boardPinMode,
        destroyPairArmed,
        peekModeArmed,
        regionShuffleArmed,
        strayRemoveArmed,
        tileSwapArmed,
        tileSwapFirstTileId
    } =
        useAppStore(
            useShallow((state) => ({
                boardPinMode: state.boardPinMode,
                destroyPairArmed: state.destroyPairArmed,
                peekModeArmed: state.peekModeArmed,
                regionShuffleArmed: state.regionShuffleArmed,
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

    const boardFloaterPayload = useMemo(
        () =>
            matchScorePop
                ? ({ kind: 'match' as const, ...matchScorePop })
                : mismatchScorePop
                  ? ({ kind: 'miss' as const, ...mismatchScorePop })
                  : null,
        [matchScorePop, mismatchScorePop]
    );
    const boardFloaterDurationMs = matchScoreFloatDurationMs(reduceMotion, boardFloaterPayload);
    const boardFloaterDetailLines = useMemo(() => {
        if (!boardFloaterPayload) {
            return [];
        }
        const traitTexts = matchTraitInteractionTexts(boardFloaterPayload.traitInteractionTexts);
        if (boardFloaterPayload.kind === 'match') {
            return [
                boardFloaterPayload.pickupRewardText,
                boardFloaterPayload.routeRewardText,
                boardFloaterPayload.chainRewardText,
                ...traitTexts
            ].filter((line): line is string => Boolean(line));
        }
        return traitTexts;
    }, [boardFloaterPayload]);
    const boardFloaterMismatchSignal =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterSignal(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecovery =
        boardFloaterPayload?.kind === 'miss' ? mismatchFloaterRecoveryHint(boardFloaterDetailLines) : null;
    const boardFloaterMismatchNextAction =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterNextAction(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    /**
     * The floater says three things and no more: what happened, what it was worth, and the one
     * reason worth naming. Everything else the board already shows or the HUD already holds.
     */
    const boardFloaterSignalLabel =
        boardFloaterPayload?.kind === 'match'
            ? boardFloaterPayload.feedbackSignal.label
            : boardFloaterMismatchSignal?.label ?? '';
    const boardFloaterSignalTone =
        boardFloaterPayload?.kind === 'match'
            ? boardFloaterPayload.feedbackSignal.tone
            : boardFloaterMismatchSignal?.tone;
    const boardFloaterChainCue =
        boardFloaterPayload?.kind === 'match' ? matchScoreFloaterChainCue(boardFloaterPayload.chainDepth) : '';
    const boardFloaterReason =
        boardFloaterPayload?.kind === 'match'
            ? boardFloaterDetailLines[0] ?? boardFloaterChainCue
            : boardFloaterMismatchRecovery ?? boardFloaterDetailLines[0] ?? '';
    const boardFloaterIntensity =
        boardFloaterPayload?.kind === 'match'
            ? boardFloaterPayload.feedbackIntensity
            : boardFloaterDetailLines.length > 0
              ? 'penalty'
              : (boardFloaterPayload?.brokenChainDepth ?? 0) >= 3
                ? 'break'
                : 'miss';
    const boardFloaterLiveText = useMemo(() => {
        if (!boardFloaterPayload) {
            return '';
        }
        return boardFloaterPayload.kind === 'match'
            ? matchScoreFloaterLiveRegionText(boardFloaterPayload.amount, {
                  chainDepth: boardFloaterPayload.chainDepth,
                  headline: boardFloaterPayload.feedbackHeadline,
                  reason: boardFloaterReason
              })
            : mismatchFloaterLiveRegionText(boardFloaterSignalLabel, boardFloaterReason);
    }, [boardFloaterPayload, boardFloaterReason, boardFloaterSignalLabel]);
    const boardRecoveryContext =
        boardFloaterPayload?.kind === 'miss' && boardFloaterMismatchNextAction
            ? {
                  action:
                      boardFloaterMismatchNextAction.tone === 'lost-reward'
                          ? 'Save'
                          : boardFloaterMismatchNextAction.tone === 'risk'
                            ? 'Stabilize'
                            : 'Recover',
                  detail: boardFloaterMismatchRecovery ?? boardFloaterMismatchNextAction.value,
                  impactCue: boardFloaterMismatchNextAction.arcadeCue,
                  tone: boardFloaterMismatchNextAction.tone,
                  value: boardFloaterMismatchNextAction.value
              }
            : null;

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
    // A miss escalates in sound, not in stacked labels: the same heat the floater is tinted with
    // picks the tone, and a deeper broken chain hits harder.
    useEffect(() => {
        if (boardFloaterPayload?.kind !== 'miss') {
            mismatchRecoveryCrescendoSfxSignatureRef.current = null;
            return;
        }
        const heat = getMismatchFloaterHeat(boardFloaterPayload);
        const beatCount = Math.max(2, Math.min(5, 2 + runNonNegativeInteger(boardFloaterPayload.brokenChainDepth)));
        const signature = [boardFloaterPayload.key, heat, beatCount].join(':');
        if (mismatchRecoveryCrescendoSfxSignatureRef.current === signature) {
            return;
        }
        mismatchRecoveryCrescendoSfxSignatureRef.current = signature;
        void resumeAudioContext();
        playMismatchRecoveryCrescendoSfx(shuffleSfxGain, heat, beatCount);
    }, [boardFloaterPayload, shuffleSfxGain]);
    // Single source of truth for "what just happened on the board": the typed event the
    // core emitted, rather than a diff of the previous render's tiles.
    const gameplayEventJournal = run.gameplayEventJournal;
    const typedBoardTurnEvent = useMemo(
        () => getLatestBoardTurnResolvedEvent({ gameplayEventJournal }),
        [gameplayEventJournal]
    );
    const seenAchievementToastIdsRef = useRef<Set<string>>(new Set());
    /** OVR-014: queue unlock toasts while the floor-cleared dialog is up; `continueToNextLevel` clears `newlyUnlockedAchievements` before the next paint. */
    const pendingAchievementToastIdsRef = useRef<AchievementId[]>([]);
    /** FX-015: WebGL bloom is medium+ when the toggle is on; add a light CSS rim only on High to avoid doubling cost on phones at Medium. */
    const boardStageCssBloomClass =
        settingsBoardBloomEnabled && settingsGraphicsQuality === 'high' ? styles.boardStageCssBloom : '';
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
        toggleBoardPinMode,
        toggleDestroyPairArmed,
        togglePeekMode,
        toggleRegionShuffleArmed,
        toggleTileSwapArmed,
        toggleStrayArm,
        undoResolvingFlip
    } = gameScreenActions;

    const relicDraftProgressText = run.relicOffer ? relicDraftProgressLine(run.relicOffer) : null;
    const relicBonusFootnoteLines = run.relicOffer ? buildRelicDraftBonusFootnoteLines(run) : [];
    const previousRelicOfferOpenRef = useRef(false);
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

    const openSettingsPlayingMode = useCallback((): void => {
        openSettings('playing');
    }, [openSettings]);

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
        if (!typedBoardTurnEvent) {
            return;
        }
        if (typedBoardTurnEvent.matchedFindableKind == null) {
            return;
        }
        if (typedBoardTurnEvent.findablesClaimedAfter <= typedBoardTurnEvent.findablesClaimedBefore) {
            return;
        }
        const toastText = getPickupStackToastText(typedBoardTurnEvent);
        if (toastText == null) {
            return;
        }
        const { showInfo } = useNotificationStore.getState();
        showInfo(
            toastText,
            reduceMotion ? 2200 : 3200,
            // Keyed on the event id so one resolved turn toasts once, no matter how many
            // times the component re-renders.
            { stackKey: `pickup:${typedBoardTurnEvent.eventId}` }
        );
    }, [typedBoardTurnEvent, reduceMotion]);

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
    // Publishes how much room the HUD deck and the action dock actually take, so the
    // floating board overlays position against measured chrome instead of each guessing.
    useGameplayChromeClearance({
        boardChipClassName: boardStyles.chainOpportunityChip,
        dockClassName: styles.actionDock,
        hudClassName: styles.hudRow,
        shellRef
    });
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
    const clearLifeBonusLabel = run.lastLevelResult ? getClearLifeBonusLabel(run.lastLevelResult) : null;
    const endlessChapterActive =
        run.gameMode === 'endless' && usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion);
    const favorGained = runNonNegativeInteger(run.lastLevelResult?.relicFavorGained);
    const featuredObjectiveResultLine = run.lastLevelResult ? formatLevelResultObjectiveLine(run.lastLevelResult) : null;
    const wagerSuretyActive = run.relicIds.includes('wager_surety');
    const offeredRiskWagerFavor = ENDLESS_RISK_WAGER_BONUS_FAVOR + (wagerSuretyActive ? 1 : 0);
    const endlessRiskWagerOutcomeLine =
        run.lastLevelResult?.endlessRiskWagerOutcome === 'won'
            ? `Risk wager won: +${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerFavorGained)} Favor`
            : run.lastLevelResult?.endlessRiskWagerOutcome === 'lost'
              ? `Risk wager lost: -${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerStreakLost)} streak`
              : null;
    const endlessRiskWagerOfferAvailable = canOfferEndlessRiskWager(run);
    const acceptedEndlessRiskWager =
        run.lastLevelResult && run.endlessRiskWager?.acceptedOnLevel === run.lastLevelResult.level
            ? run.endlessRiskWager
            : null;
    const routeChoices = useMemo(() => routeChoicesForResult(run.lastLevelResult), [run.lastLevelResult]);
    const routeChoiceRequired = routeChoices.length > 0 && !run.pendingRouteCardPlan;
    const firstRouteChoiceRequired = routeChoiceRequired && run.lastLevelResult?.level === 1;
    const routeChoiceRequiredCopy =
        firstRouteChoiceRequired
            ? ROUTE_CHOICE_COPY.prompt
            : ROUTE_CHOICE_COPY.settled;
    const dungeonRouteDecisionPresentation =
        routeChoiceRequired
            ? getDungeonRouteDecisionPresentation(run.dungeonRun, routeChoices)
            : null;
    const floorClearRouteOptions: FloorClearRouteOption[] = routeChoiceRequired
        ? routeChoices.map((choice) => {
              const row = dungeonRouteDecisionPresentation?.rows.find((candidate) => candidate.id === choice.id) ?? null;
              const availability = getRouteChoiceAvailability(run, choice);
              return {
                  id: choice.id,
                  routeType: choice.routeType,
                  label: row?.choiceLabel ?? choice.label,
                  room: row?.nodeLabel ?? '',
                  // The approach matters only when rooms converge on one gate ("Keeper Chamber via Safe passage").
                  approachLabel: row?.approachLabel && /\bvia\b/u.test(row.nodeLabel) ? row.approachLabel : undefined,
                  glyph: FLOOR_CLEAR_ROUTE_GLYPHS[choice.routeType],
                  reward: row?.reward ?? choice.rewardPreview ?? choice.detail,
                  risk: row?.risk ?? choice.riskPreview ?? 'No extra risk.',
                  available: availability.available,
                  unavailableLabel: availability.label
              };
          })
        : [];
    const floorClearSelectedRoute: FloorClearSelectedRoute | null = run.pendingRouteCardPlan
        ? {
              routeType: run.pendingRouteCardPlan.routeType,
              label: routeTypeLabel(run.pendingRouteCardPlan.routeType),
              line:
                  run.pendingRouteCardPlan.routeType === 'safe'
                      ? ROUTE_CHOICE_COPY.safePreview
                      : run.pendingRouteCardPlan.routeType === 'greed'
                        ? ROUTE_CHOICE_COPY.greedPreview
                        : ROUTE_CHOICE_COPY.mysteryPreview
          }
        : null;
    const floorClearWager: FloorClearWager | null = acceptedEndlessRiskWager
        ? {
              armed: true,
              bonusFavor: acceptedEndlessRiskWager.bonusFavorOnSuccess,
              streakAtRisk: acceptedEndlessRiskWager.streakAtRisk,
              suretyActive: wagerSuretyActive
          }
        : !routeChoiceRequired && endlessRiskWagerOfferAvailable
          ? {
                armed: false,
                bonusFavor: offeredRiskWagerFavor,
                streakAtRisk: run.featuredObjectiveStreak,
                suretyActive: wagerSuretyActive
            }
          : null;
    const floorClearObjectiveLine =
        [featuredObjectiveResultLine, favorGained > 0 ? `+${favorGained} Favor` : null, endlessRiskWagerOutcomeLine]
            .filter((part): part is string => Boolean(part))
            .join(' · ') || null;
    const floorClearActions: ModalAction[] = [
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
            variant: 'secondary' as const
        }
    ];
    const dungeonExitStatus = getDungeonExitStatus(run);
    const dungeonExitRouteLine = dungeonExitStatus.routeType
        ? `${routeTypeLabel(dungeonExitStatus.routeType)} beyond this door.`
        : ROUTE_CHOICE_COPY.stair;
    const dungeonExitLockLine = dungeonExitPromptLockLine(dungeonExitStatus, run);
    const dungeonPresentation = getDungeonBoardPresentation(run);
    const activeDungeonPanel = run.status !== 'levelComplete' && dungeonPresentation.visible ? dungeonPresentation : null;
    const activeDungeonObjectiveStatus = activeDungeonPanel ? getDungeonObjectiveStatus(run) : null;
    const traitRouteObjectiveStatus = getTraitRouteObjectiveStatus(run);
    const liveObjectiveStatus = activeDungeonObjectiveStatus ?? traitRouteObjectiveStatus;
    const armedRewardPerkCue = getPrimaryRewardPerkReadinessRow(run);
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
    const nextFloorSignalRows: NextFloorSignalRow[] = [];
    if (nextFloorPreview) {
        nextFloorSignalRows.push({
            id: 'next-floor',
            label: 'Floor',
            value: nextFloorPreview.title ?? 'Next floor',
            detail:
                nextFloorChapterIdentity?.actTitle && nextFloorChapterIdentity.biomeTitle
                    ? `${nextFloorChapterIdentity.actTitle} - ${nextFloorChapterIdentity.biomeTitle}`
                    : null,
            tone: 'route'
        });
        if (nextFloorObjectiveLabel) {
            nextFloorSignalRows.push({
                id: 'next-objective',
                label: 'Objective',
                value: nextFloorObjectiveLabel,
                detail: 'Featured payout target',
                tone: 'reward'
            });
        }
        nextFloorSignalRows.push({
            id: 'next-pressure',
            label: 'Pressure',
            value: nextFloorMutatorNames,
            detail: nextFloorChapterIdentity?.routePreview ?? nextFloorMutatorLabels,
            tone: nextFloorPreview.mutators.length > 0 ? 'pressure' : 'neutral'
        });
        if (nextFloorIdentity) {
            nextFloorSignalRows.push({
                id: 'next-counterplay',
                label: 'Counterplay',
                value: nextFloorIdentity.label,
                detail: nextFloorIdentity.counterplaySentence,
                tone: 'counterplay'
            });
        }
    }

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
    // Passed as just the journal, which is all the projector reads. Handing it the whole
    // run made the memo's real dependency the run object, so it recomputed on every state
    // change and the compiler could not preserve the memoization at all.
    // Every feedback event the journal has produced, not just the latest: one command can raise
    // several, and the live region announces them together as one line for that command.
    const typedGameplayFeedback = useMemo(
        () => projectGameplayFeedback(gameplayEventJournal),
        [gameplayEventJournal]
    );
    const {
        message: politeHudAnnouncement,
        priority: politeHudAnnouncementPriority,
        queuePoliteAnnouncement
    } = useHudPoliteLiveAnnouncement({
        boardTurnEvent: typedBoardTurnEvent,
        gameplayFeedback: typedGameplayFeedback,
        boardLevel: run.board?.level ?? null,
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
        objectiveProgress: liveObjectiveStatus?.progress,
        objectiveRequired: liveObjectiveStatus?.required,
        objectiveLabel: liveObjectiveStatus?.label,
        recallFocus: run.recallFocus,
        recallFocusMax: RECALL_FOCUS_MAX,
        recallMatchesThisFloor: run.recallMatchesThisFloor,
        recallMistakesThisFloor: run.recallMistakesThisFloor,
        recallBonusScoreThisFloor: run.recallBonusScoreThisFloor,
        forgottenTileCountThisFloor: run.forgottenTileIdsThisFloor.length,
        gambitThirdPickActive,
        gambitOpportunityFlippedIds:
            gambitThirdPickActive && run.board ? run.board.flippedTileIds : null,
        reduceMotion,
        dungeonEnemiesDefeatedThisFloor: run.dungeonEnemiesDefeatedThisFloor,
        enemyHazardHitsThisFloor: run.enemyHazardHitsThisFloor,
        enemyHazardsDefeatedThisFloor: run.enemyHazardsDefeatedThisFloor
    });
    const actionFeedbackAnnouncement = boardFloaterLiveText || politeHudAnnouncement;
    const actionFeedbackPriority =
        boardFloaterPayload?.kind === 'miss' ? 'error' : politeHudAnnouncementPriority;
    const visualHudAnnouncement = actionFeedbackAnnouncement
        ? formatHudActionFeedbackText(actionFeedbackAnnouncement)
        : '';

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
    const shuffleDisabled = !canShuffleBoard(run);
    // A row needs two hidden tiles to be worth shuffling, so the button is only live when at least
    // one row on the board qualifies — otherwise the press would spend a charge on nothing.
    const rowCount = Math.ceil(run.board.tiles.length / run.board.columns);
    const hasShufflableRow =
        canRegionShuffle(run) &&
        Array.from({ length: rowCount }, (_unused, row) => row).some((row) => canRegionShuffleRow(run, row));
    const rowShuffleDisabled = !hasShufflableRow;
    const rowShuffleTitle = run.activeContract?.noShuffle
        ? ROW_SHUFFLE_COPY.scholarContract
        : run.board.flippedTileIds.length > 0
          ? ROW_SHUFFLE_COPY.pendingFlip
          : run.regionShuffleCharges < 1 &&
              !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))
            ? ROW_SHUFFLE_COPY.noCharges
            : rowShuffleDisabled
              ? ROW_SHUFFLE_COPY.noRow
              : regionShuffleArmed
                ? ROW_SHUFFLE_COPY.armed
                : ROW_SHUFFLE_COPY.idle;
    const tileSwapTitle = run.activeContract?.noShuffle
        ? TILE_SWAP_COPY.scholarContract
        : run.board.flippedTileIds.length > 0
          ? TILE_SWAP_COPY.pendingFlip
          : hiddenTileCount < 2
            ? TILE_SWAP_COPY.needTwoHidden
              : run.regionShuffleCharges < 1 &&
                  !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))
                ? TILE_SWAP_COPY.noCharges
              : tileSwapArmed
                ? tileSwapFirstTileId
                    ? TILE_SWAP_COPY.secondTile
                    : TILE_SWAP_COPY.firstTile
                : traitSwapHint
                  ? `${TILE_SWAP_COPY.idle}. ${traitSwapHint.text}`
                  : TILE_SWAP_COPY.idle;
    const showFlashPairPower = (run.practiceMode || run.wildMenuRun) && run.status === 'playing';
    const flashPairDisabled =
        !showFlashPairPower ||
        run.flashPairCharges < 1 ||
        run.board.flippedTileIds.length > 0;
    const flashPairTitle =
        run.flashPairCharges < 1
            ? FLASH_PAIR_COPY.noCharges
            : run.board.flippedTileIds.length > 0
              ? FLASH_PAIR_COPY.pendingFlip
              : FLASH_PAIR_COPY.idle;
    const shuffleTitle = run.activeContract?.noShuffle
        ? BOARD_SHUFFLE_COPY.scholarContract
        : shuffleDisabled
          ? run.shuffleCharges < 1 &&
              !(run.freeShuffleThisFloor && run.relicIds.includes('first_shuffle_free_per_floor'))
            ? BOARD_SHUFFLE_COPY.noCharges
            : run.board.flippedTileIds.length > 0
              ? BOARD_SHUFFLE_COPY.pendingFlip
              : BOARD_SHUFFLE_COPY.needTwoPairs
          : BOARD_SHUFFLE_COPY.idle;
    const boardPresentationClass =
        settingsBoardPresentation === 'spaghetti'
            ? styles.boardStageSpaghetti
            : settingsBoardPresentation === 'breathing' && !reduceMotion
              ? styles.boardStageBreathing
              : '';
    const destroyDisabled = run.destroyPairCharges < 1 && !destroyPairArmed;

    // Ids and labels come from the catalog rather than being retyped here, so a tool the catalog
    // names but the dock forgets to build is a type error rather than a missing button.
    const toolSpec = (id: RunShellToolId): Pick<RunShellTool, 'id' | 'label'> => {
        const spec = RUN_SHELL_TOOL_CATALOG.find((candidate) => candidate.id === id);
        if (!spec) {
            throw new Error(`Run dock asked for a tool the catalog does not define: ${id}`);
        }
        return { id: spec.id, label: spec.label };
    };
    const runShellTools: RunShellTool[] = [
            {
                ...toolSpec('shuffle'),
                glyph: RUN_SHELL_GLYPHS.shuffle,
                charges: run.shuffleCharges,
                disabled: shuffleDisabled,
                title: shuffleTitle,
                onClick: shuffleBoard
            },
            {
                ...toolSpec('swap'),
                glyph: RUN_SHELL_GLYPHS.shuffle,
                charges: run.regionShuffleCharges,
                armed: tileSwapArmed,
                disabled: tileSwapDisabled,
                title: tileSwapTitle,
                onClick: toggleTileSwapArmed
            },
            {
                ...toolSpec('row'),
                glyph: RUN_SHELL_GLYPHS.shuffle,
                charges: run.regionShuffleCharges,
                armed: regionShuffleArmed,
                disabled: rowShuffleDisabled,
                title: rowShuffleTitle,
                onClick: toggleRegionShuffleArmed
            },
            {
                ...toolSpec('pin'),
                glyph: RUN_SHELL_GLYPHS.pin,
                armed: boardPinMode,
                title: `Pin up to ${MAX_PINNED_TILES} tiles`,
                onClick: toggleBoardPinMode
            },
            {
                ...toolSpec('destroy'),
                glyph: RUN_SHELL_GLYPHS.destroy,
                charges: run.destroyPairCharges,
                armed: destroyPairArmed,
                disabled: destroyDisabled,
                title: 'Destroy a pair',
                onClick: toggleDestroyPairArmed
            },
            {
                ...toolSpec('peek'),
                glyph: RUN_SHELL_GLYPHS.peek,
                charges: run.peekCharges,
                armed: peekModeArmed,
                title: 'Peek at a hidden tile',
                onClick: togglePeekMode
            },
            ...(showFlashPairPower
                ? [
                      {
                          ...toolSpec('flash'),
                          glyph: RUN_SHELL_GLYPHS.peek,
                          charges: run.flashPairCharges,
                          disabled: flashPairDisabled,
                          title: flashPairTitle,
                          onClick: applyFlashPairPower
                      }
                  ]
                : []),
            {
                ...toolSpec('stray'),
                glyph: RUN_SHELL_GLYPHS.stray,
                armed: strayRemoveArmed,
                title: 'Remove a stray tile',
                onClick: toggleStrayArm
            },
            {
                ...toolSpec('undo'),
                glyph: RUN_SHELL_GLYPHS.undo,
                title: 'Undo the last flip',
                onClick: undoResolvingFlip
            }
        ];

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
                        <RunShell
                            perfectMemory={perfectMemoryStatus(run, saveData)}
                            feedback={visualHudAnnouncement}
                            feedbackPriority={actionFeedbackPriority}
                            gauntletRemainingMs={gauntletRemainingMs}
                            onboardingLine={onboardingStep && run.status === 'playing' ? onboardingStep.prompt : null}
                            onPause={pause}
                            politeAnnouncement={politeHudAnnouncement}
                            run={run}
                            tools={runShellTools}
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
                            style={{ '--gameplay-workshop-table-image': `url(${UI_ART.gameplayWorkshopTable})` } as CSSProperties}
                        >
                            <div className={styles.boardGlow} aria-hidden="true" />
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
                            {boardFloaterPayload ? (
                                <span
                                    key={`live-${boardFloaterPayload.key}`}
                                    aria-atomic="true"
                                    aria-live="polite"
                                    className={styles.srOnly}
                                >
                                    {boardFloaterLiveText}
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
                                    } ${reduceMotion ? styles.matchScoreFloaterReduced : ''}`}
                                    data-testid={
                                        boardFloaterPayload.kind === 'match'
                                            ? 'match-score-floater'
                                            : 'mismatch-score-floater'
                                    }
                                    data-feedback-intensity={boardFloaterIntensity}
                                    data-match-floater-heat={
                                        boardFloaterPayload.kind === 'match'
                                            ? getMatchFloaterHeat(boardFloaterPayload)
                                            : 'none'
                                    }
                                    data-mismatch-floater-heat={
                                        boardFloaterPayload.kind === 'miss'
                                            ? getMismatchFloaterHeat(boardFloaterPayload)
                                            : 'none'
                                    }
                                    style={
                                        {
                                            left: boardFloaterPos.x,
                                            top: boardFloaterPos.y,
                                            '--match-score-float-ms': `${boardFloaterDurationMs}ms`
                                        } as CSSProperties
                                    }
                                >
                                    <span
                                        className={styles.boardFloaterSignal}
                                        data-floater-signal={boardFloaterSignalTone}
                                    >
                                        {boardFloaterSignalLabel}
                                    </span>
                                    {boardFloaterPayload.kind === 'match' ? (
                                        <span
                                            className={styles.boardFloaterAmount}
                                            data-testid="match-score-floater-amount"
                                        >
                                            +{runNonNegativeInteger(boardFloaterPayload.amount).toLocaleString()}
                                        </span>
                                    ) : null}
                                    {boardFloaterReason ? (
                                        <span
                                            className={styles.boardFloaterReason}
                                            data-testid="board-floater-reason"
                                        >
                                            {boardFloaterReason}
                                        </span>
                                    ) : null}
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
                        </div>
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

                {/* One modal at a time: Controls opens over pause, and closing it comes back here. */}
                {!suppressStatusOverlays && !abandonRunConfirmOpen && !shortcutsHelpOpen && run.status === 'paused' && (
                    <OverlayModal
                        actions={[
                            { label: 'Resume', onClick: resume, variant: 'primary' },
                            {
                                label: 'Fit board',
                                onClick: () => {
                                    setViewportResetToken((token) => token + 1);
                                    resume();
                                },
                                variant: 'secondary'
                            },
                            { label: 'Inventory', onClick: openInventoryFromPlaying, variant: 'secondary' },
                            { label: 'Codex', onClick: openCodexFromPlaying, variant: 'secondary' },
                            /*
                             * The shortcuts overlay opened on F1 or ? and nowhere else, which
                             * asks the player to already know the shortcut for finding out the
                             * shortcuts — and a controller has neither key. Pause is where you
                             * look, and it is reachable from the dock and from Start.
                             */
                            {
                                label: 'Controls',
                                onClick: () => {
                                    playMenuOpen();
                                    setShortcutsHelpOpen(true);
                                },
                                variant: 'secondary'
                            },
                            { label: 'Settings', onClick: openSettingsPlayingMode, variant: 'secondary' },
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
                        subtitle={PAUSE_DIALOG_COPY.subtitle}
                        testId="game-pause-overlay"
                        title="Run paused"
                    >
                        <dl aria-label="Run so far" className={styles.pauseStats}>
                            <div>
                                <dt>Floor</dt>
                                <dd>{run.board?.level ?? run.stats.highestLevel}</dd>
                            </div>
                            <div>
                                <dt>Score</dt>
                                <dd>{runNonNegativeInteger(run.stats.totalScore).toLocaleString()}</dd>
                            </div>
                            <div>
                                <dt>Lives</dt>
                                <dd>
                                    {run.lives} / {MAX_LIVES}
                                </dd>
                            </div>
                        </dl>
                    </OverlayModal>
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
                    <FloorClearDialog
                        actions={floorClearActions}
                        bestStreak={run.stats.bestStreak}
                        lifeBonusLine={clearLifeBonusLabel}
                        objectiveLine={floorClearObjectiveLine}
                        onArmWager={() => {
                            playUiClick();
                            acceptEndlessRiskWager();
                        }}
                        onChooseRoute={(id) => {
                            playUiClick();
                            chooseRouteAndContinue(id);
                        }}
                        result={run.lastLevelResult}
                        routeIntro={routeChoiceRequiredCopy}
                        routeOptions={floorClearRouteOptions}
                        routeRequired={routeChoiceRequired}
                        selectedRoute={floorClearSelectedRoute}
                        totalScore={run.stats.totalScore}
                        wager={floorClearWager}
                    />
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
                        subtitle={
                            gamepadConnected
                                ? SHORTCUTS_COPY.touch
                                : SHORTCUTS_COPY.withKeyboard
                        }
                        testId="game-shortcuts-help-overlay"
                        title={gamepadConnected ? 'Controller shortcuts' : 'Keyboard shortcuts'}
                    >
                        {/* One list, not two: a player holding a pad is told what the pad does. */}
                        <ul
                            aria-label={gamepadConnected ? 'Gameplay controller shortcuts' : 'Gameplay keyboard shortcuts'}
                            className={styles.shortcutsHelpList}
                        >
                            {(gamepadConnected ? GAMEPAD_SHORTCUT_ROWS : GAMEPLAY_SHORTCUT_ROWS).map((row) => (
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
                        subtitle={ABANDON_DIALOG_COPY.subtitle}
                        title="Abandon run?"
                    />
                ) : null}
            </div>
        </section>
    );
};

export default GameScreen;
