import { ACHIEVEMENTS } from '../../shared/achievements';
import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    MAX_PINNED_TILES,
    RECALL_FOCUS_MAX,
    type AchievementId,
    type RouteCardKind,
    type RouteNodeType,
    type RouteSpecialKind,
    type RunState,
    type Settings
} from '../../shared/contracts';
import { computeFocusDimmedTileIds } from '../../shared/focusDimmedTileIds';
import { getChainTargetFeedback } from '../../shared/chain-targets';
import { getPrimaryRewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { getFloorClearCausalityRows } from '../../shared/level-result-presentation';
import { getFloorIdentityContract } from '../../shared/boss-encounters';
import { getPlayableOnboardingStep, type OnboardingStepId } from '../../shared/playable-onboarding';
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
import { getDungeonMapPresentation, getDungeonRouteDecisionPresentation, getRepairedSelectedDungeonNode } from '../../shared/run-map';
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
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS,
    matchScoreFloatDurationMs
} from './matchScoreFloaterTiming';
import { getStickyBlockedTileId } from '../gameplay/stickyFingersBlockedTileId';
import { useGameScreenPowerTileHints } from './useGameScreenPowerTileHints';
import { useGameScreenTraitRouteTargets } from './useGameScreenTraitRouteTargets';
import type { MatchScorePop, MatchScorePopPayoffLaneMapEntry, MismatchScorePop } from '../store/matchScorePop';

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
import {
    getChainRewardForecastCues,
    getChainRewardLaneAction,
    getChainRewardProgress,
    getChainRewardStackLabel,
    getChainRewardUrgencyCopy
} from '../copy/chainMomentum';
import { matchScoreFloaterChainCue, matchScoreFloaterLiveRegionText } from '../copy/matchScoreFloater';
import {
    mismatchFloaterLiveRegionText,
    mismatchFloaterNextAction,
    mismatchFloaterRecoveryBurst,
    mismatchFloaterRecoveryChips,
    mismatchFloaterRecoveryCrescendo,
    mismatchFloaterRecoveryCrescendoLabel,
    mismatchFloaterRecoveryHint,
    mismatchFloaterRecoveryLaneMap,
    mismatchFloaterRecoverySequence,
    mismatchFloaterRecoveryStack,
    mismatchFloaterSignal,
    mismatchFloaterVisualLabel,
    type MismatchFloaterRecoveryChip,
    type MismatchFloaterRecoveryLaneMapEntry
} from '../copy/mismatchFloater';
import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr,
    type TraitInteractionLaneMapEntry
} from '../copy/traitInteractionLaneMap';
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

const matchPayoffLaneMapAttr = (laneMap: readonly MatchScorePopPayoffLaneMapEntry[] | undefined): string =>
    laneMap?.map((lane) => `${lane.id}:${lane.count}`).join('>') ?? 'none';

const matchPayoffLaneAction = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'Cash route' | 'Claim pickup' | 'Cash trait' | 'Cash chain' | 'Prime next' => {
    if (lane.id === 'route') {
        return 'Cash route';
    }
    if (lane.id === 'pickup') {
        return 'Claim pickup';
    }
    if (lane.id === 'trait') {
        return 'Cash trait';
    }
    if (lane.id === 'chain') {
        return 'Cash chain';
    }
    return 'Prime next';
};

const matchPayoffLaneActionMapAttr = (laneMap: readonly MatchScorePopPayoffLaneMapEntry[] | undefined): string =>
    laneMap?.map((lane) => `${lane.id}:${matchPayoffLaneAction(lane)}:${lane.count}`).join('>') ?? 'none';

const matchPayoffLaneMapLabel = (laneMap: readonly MatchScorePopPayoffLaneMapEntry[] | undefined): string => {
    if (!laneMap?.length) {
        return '';
    }
    return `Match payoff lane map. ${laneMap
        .map((lane) => `${lane.label}: ${lane.count}. ${matchPayoffLaneAction(lane)}. ${lane.cue}.`)
        .join(' ')}`;
};

const mismatchRecoveryLaneMapAttr = (laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${lane.count}`).join('>') ?? 'none';

const mismatchRecoveryLaneAction = (lane: MismatchFloaterRecoveryLaneMapEntry): string => {
    switch (lane.id) {
        case 'recover':
            return lane.cue === 'Safe pair' ? 'Confirm pair' : 'Stabilize route';
        case 'lost':
            return 'Save cashout';
        case 'chain':
            return lane.count > 1 ? 'Rebuild chain' : 'Reset chain';
        case 'tool':
            return 'Trigger tool';
        case 'risk':
            return 'Route away';
        default:
            return 'Recover';
    }
};

const mismatchRecoveryLaneActionMapAttr = (laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${mismatchRecoveryLaneAction(lane)}:${lane.count}`).join('>') ?? 'none';

const mismatchRecoveryLaneMapLabel = (laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null): string =>
    laneMap?.length
        ? `Recovery lane map. ${laneMap
              .map((lane) => `${lane.label}: ${lane.count}. ${mismatchRecoveryLaneAction(lane)}. ${lane.cue}.`)
              .join(' ')}`
        : '';

const getMismatchRecoveryLaneBeatCount = (lane: MismatchFloaterRecoveryLaneMapEntry): 2 | 3 | 4 => {
    if (lane.id === 'lost' || lane.id === 'risk' || lane.count > 1) {
        return 4;
    }
    if (lane.id === 'chain' || lane.id === 'tool') {
        return 3;
    }
    return 2;
};

const getPrimaryMismatchRecoveryLane = (
    laneMap: readonly MismatchFloaterRecoveryLaneMapEntry[] | null
): MismatchFloaterRecoveryLaneMapEntry | null =>
    laneMap?.reduce<MismatchFloaterRecoveryLaneMapEntry | null>((primary, lane) => {
        if (!primary || getMismatchRecoveryLaneBeatCount(lane) > getMismatchRecoveryLaneBeatCount(primary)) {
            return lane;
        }
        return primary;
    }, null) ?? null;

const getMismatchRecoveryLaneAudioCue = (
    lane: MismatchFloaterRecoveryLaneMapEntry
): 'mismatch-recovery-safe' | 'mismatch-recovery-lost' | 'mismatch-recovery-chain' | 'mismatch-recovery-tool' | 'mismatch-recovery-risk' => {
    switch (lane.id) {
        case 'recover':
            return 'mismatch-recovery-safe';
        case 'lost':
            return 'mismatch-recovery-lost';
        case 'chain':
            return 'mismatch-recovery-chain';
        case 'tool':
            return 'mismatch-recovery-tool';
        default:
            return 'mismatch-recovery-risk';
    }
};

const getMismatchRecoveryLaneScreenCue = (
    lane: MismatchFloaterRecoveryLaneMapEntry
): 'recover' | 'risk' | 'chain' | 'tool' | 'pulse' => {
    if (lane.id === 'lost' || lane.id === 'risk') {
        return 'risk';
    }
    if (lane.id === 'chain') {
        return 'chain';
    }
    if (lane.id === 'tool') {
        return 'tool';
    }
    if (lane.id === 'recover') {
        return 'recover';
    }
    return 'pulse';
};

const getBoardMatchPayoffStackBeatCount = (stack: { laneCount: number; tone: string }): 2 | 3 | 4 | 5 => {
    if (stack.laneCount >= 4 || stack.tone === 'combo') {
        return 5;
    }
    if (stack.laneCount >= 2 || stack.tone === 'reward' || stack.tone === 'chain') {
        return 4;
    }
    if (stack.tone === 'score') {
        return 3;
    }
    return 2;
};

const getBoardMatchPayoffStackAction = (
    stack: { laneCount: number; tone: string }
): 'Cash stack' | 'Claim payoff' | 'Hold chain' | 'Prime next' => {
    if (stack.laneCount >= 2 || stack.tone === 'combo' || stack.tone === 'reward') {
        return 'Cash stack';
    }
    if (stack.tone === 'chain') {
        return 'Hold chain';
    }
    if (stack.tone === 'score') {
        return 'Claim payoff';
    }
    return 'Prime next';
};

const getBoardMatchPayoffStackAudioCue = (
    stack: { laneCount: number; tone: string }
): 'match-stack-super' | 'match-stack-cashout' | 'match-stack-chain' | 'match-stack-prime' => {
    if (stack.laneCount >= 4 || stack.tone === 'combo') {
        return 'match-stack-super';
    }
    if (stack.laneCount >= 2 || stack.tone === 'reward') {
        return 'match-stack-cashout';
    }
    if (stack.tone === 'chain') {
        return 'match-stack-chain';
    }
    return 'match-stack-prime';
};

const getBoardMatchPayoffStackScreenCue = (
    stack: { laneCount: number; tone: string }
): 'super' | 'burst' | 'chain' | 'pulse' => {
    if (stack.laneCount >= 4 || stack.tone === 'combo') {
        return 'super';
    }
    if (stack.laneCount >= 2 || stack.tone === 'reward') {
        return 'burst';
    }
    if (stack.tone === 'chain') {
        return 'chain';
    }
    return 'pulse';
};

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

type RouteSpecialSignalRow = {
    label: string;
    tone: 'build' | 'control' | 'risk' | 'reward' | 'safety';
    value: string;
};

const routeSpecialSignalRows = (
    kind: RouteSpecialKind | RouteCardKind
): RouteSpecialSignalRow[] => {
    switch (kind) {
        case 'safe_ward':
        case 'guard_cache':
        case 'final_ward':
        case 'lantern_ward':
            return [
                { label: 'Role', value: 'Protection', tone: 'safety' },
                { label: 'Payoff', value: 'Guard bank', tone: 'safety' },
                { label: 'Play', value: 'Match before exit', tone: 'control' }
            ];
        case 'greed_cache':
        case 'elite_cache':
        case 'greed_toll':
        case 'fragile_cache':
            return [
                { label: 'Role', value: 'Payout', tone: 'reward' },
                { label: 'Payoff', value: 'Gold score', tone: 'reward' },
                { label: 'Risk', value: 'Lost if destroyed', tone: 'risk' }
            ];
        case 'mimic_cache':
            return [
                { label: 'Role', value: 'Trap loot', tone: 'risk' },
                { label: 'Payoff', value: 'Scout first', tone: 'control' },
                { label: 'Risk', value: 'Blind bite', tone: 'risk' }
            ];
        case 'mystery_veil':
        case 'loaded_gateway':
        case 'secret_door':
            return [
                { label: 'Role', value: 'Discovery', tone: 'build' },
                { label: 'Payoff', value: 'Route value', tone: 'reward' },
                { label: 'Play', value: 'Reveal safely', tone: 'control' }
            ];
        case 'anchor_seal':
        case 'pin_lattice':
            return [
                { label: 'Role', value: 'Board control', tone: 'control' },
                { label: 'Payoff', value: 'Prime turn', tone: 'build' },
                { label: 'Play', value: 'Plan the pair', tone: 'control' }
            ];
        case 'catalyst_altar':
        case 'omen_seal':
            return [
                { label: 'Role', value: 'Combo fuel', tone: 'build' },
                { label: 'Payoff', value: 'Shard spike', tone: 'reward' },
                { label: 'Play', value: 'Chain into it', tone: 'build' }
            ];
        case 'parasite_vessel':
            return [
                { label: 'Role', value: 'Pressure cashout', tone: 'risk' },
                { label: 'Payoff', value: 'Favor swing', tone: 'reward' },
                { label: 'Play', value: 'Use pressure', tone: 'control' }
            ];
        case 'keystone_pair':
            return [
                { label: 'Role', value: 'Boss payoff', tone: 'reward' },
                { label: 'Payoff', value: 'Favor score', tone: 'reward' },
                { label: 'Play', value: 'Secure route', tone: 'control' }
            ];
        default:
            return [
                { label: 'Role', value: 'Special pair', tone: 'build' },
                { label: 'Payoff', value: 'Match reward', tone: 'reward' },
                { label: 'Play', value: 'Find both cards', tone: 'control' }
            ];
    }
};

const getRouteSpecialSignalBeatCount = (row: RouteSpecialSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward') {
        return 4;
    }
    if (row.tone === 'risk' || row.tone === 'build') {
        return 3;
    }
    return 2;
};

const getRouteSpecialSignalAudioCue = (
    row: RouteSpecialSignalRow
): 'route-card-reward' | 'route-card-risk' | 'route-card-build' | 'route-card-guard' | 'route-card-control' => {
    if (row.tone === 'reward') {
        return 'route-card-reward';
    }
    if (row.tone === 'risk') {
        return 'route-card-risk';
    }
    if (row.tone === 'build') {
        return 'route-card-build';
    }
    if (row.tone === 'safety') {
        return 'route-card-guard';
    }
    return 'route-card-control';
};

const getRouteSpecialSignalScreenCue = (
    row: RouteSpecialSignalRow
): 'burst' | 'risk' | 'build' | 'guard' | 'control' => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'risk') {
        return 'risk';
    }
    if (row.tone === 'build') {
        return 'build';
    }
    if (row.tone === 'safety') {
        return 'guard';
    }
    return 'control';
};

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

const dungeonExitPromptTitle = (status: ReturnType<typeof getDungeonExitStatus>): string =>
    status.keyFallbackPending ? 'Key fallback pending' : dungeonExitLockLabel(status.lockKind);

const dungeonExitPromptLockLine = (status: ReturnType<typeof getDungeonExitStatus>, run: RunState): string => {
    if (status.keyFallbackPending) {
        return 'No key source remains; clear the remaining pairs to force this exit open.';
    }
    if (status.lockKind === 'lever') {
        return `${status.leverCount}/${status.requiredLeverCount} floor levers ready.`;
    }
    if (status.lockKind === 'none') {
        return 'No key required.';
    }
    return `Keys: ${run.dungeonKeys[status.lockKind] ?? 0} matching, ${run.dungeonMasterKeys} master.`;
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

type OnboardingPromptSignalTone = 'action' | 'chain' | 'recovery' | 'reward' | 'route';
type OnboardingPromptSignalRow = { label: string; tone: OnboardingPromptSignalTone; value: string };

const getOnboardingPromptSignalBeatCount = (row: OnboardingPromptSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward' || row.tone === 'route') {
        return 4;
    }
    if (row.tone === 'chain' || row.tone === 'recovery') {
        return 3;
    }
    return 2;
};

const getOnboardingPromptSignalAudioCue = (
    row: OnboardingPromptSignalRow
): 'onboarding-action' | 'onboarding-chain' | 'onboarding-recovery' | 'onboarding-reward' | 'onboarding-route' => {
    if (row.tone === 'reward') {
        return 'onboarding-reward';
    }
    if (row.tone === 'route') {
        return 'onboarding-route';
    }
    if (row.tone === 'chain') {
        return 'onboarding-chain';
    }
    if (row.tone === 'recovery') {
        return 'onboarding-recovery';
    }
    return 'onboarding-action';
};

const getOnboardingPromptSignalScreenCue = (
    row: OnboardingPromptSignalRow
): 'action' | 'burst' | 'chain' | 'recover' | 'route' => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'route') {
        return 'route';
    }
    if (row.tone === 'chain') {
        return 'chain';
    }
    if (row.tone === 'recovery') {
        return 'recover';
    }
    return 'action';
};

const getOnboardingPromptSignals = (id: OnboardingStepId | 'room_goal'): OnboardingPromptSignalRow[] => {
    if (id === 'first_match') {
        return [
            { label: 'Action', value: 'Flip pair', tone: 'action' },
            { label: 'Reward', value: 'Score pop', tone: 'reward' },
            { label: 'Chain', value: 'Start streak', tone: 'chain' }
        ];
    }
    if (id === 'recovery') {
        return [
            { label: 'Recovery', value: 'Rebuild', tone: 'recovery' },
            { label: 'Chain', value: 'Keep clean', tone: 'chain' },
            { label: 'Tools', value: 'Save rescues', tone: 'action' }
        ];
    }
    return [
        { label: 'Goal', value: 'Clear pairs', tone: 'action' },
        { label: 'Reward', value: 'Route choice', tone: 'route' },
        { label: 'Chain', value: 'Clean finish', tone: 'chain' }
    ];
};

const GAMBIT_SIGNAL_ROWS = [
    { label: 'Window', value: 'Third flip' },
    { label: 'Payoff', value: 'Recover pair' },
    { label: 'Cost', value: 'No perfect' }
] as const;

const getGambitSignalBeatCount = (signal: (typeof GAMBIT_SIGNAL_ROWS)[number]['label']): 2 | 3 | 4 => {
    if (signal === 'Payoff') {
        return 4;
    }
    if (signal === 'Cost') {
        return 3;
    }
    return 2;
};

const getGambitSignalAudioCue = (
    signal: (typeof GAMBIT_SIGNAL_ROWS)[number]['label']
): 'gambit-window' | 'gambit-payoff' | 'gambit-cost' => {
    if (signal === 'Payoff') {
        return 'gambit-payoff';
    }
    if (signal === 'Cost') {
        return 'gambit-cost';
    }
    return 'gambit-window';
};

const getGambitSignalScreenCue = (signal: (typeof GAMBIT_SIGNAL_ROWS)[number]['label']): 'window' | 'burst' | 'risk' => {
    if (signal === 'Payoff') {
        return 'burst';
    }
    if (signal === 'Cost') {
        return 'risk';
    }
    return 'window';
};

const formatGameplaySignalRowsLabel = (
    label: string,
    rows: readonly { label: string; value: string }[]
): string => {
    const rowCopy = rows.map((row) => `${row.label}: ${row.value}`).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const formatGameplayDetailRowsLabel = (
    label: string,
    rows: readonly { detail?: string | null; label: string; value?: string }[]
): string => {
    const rowCopy = rows
        .map((row) => `${row.label}${row.value ? `: ${row.value}` : ''}${row.detail ? ` - ${row.detail}` : ''}`)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const GAMBIT_SIGNAL_ROWS_LABEL = formatGameplaySignalRowsLabel('Gambit opportunity signals', GAMBIT_SIGNAL_ROWS);

type RiskWagerSignalTone = 'armed' | 'objective' | 'reward' | 'risk';
type RiskWagerSignalRow = { label: string; tone: RiskWagerSignalTone; value: string };
type RiskWagerPrimaryCue = {
    action: 'Arm wager' | 'Protect streak';
    beatCount: 3 | 4;
    label: 'Wager available' | 'Wager armed';
    payoff: string;
    risk: string;
    tone: 'armed' | 'offer';
};

const getRiskWagerSignalBeatCount = (row: RiskWagerSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward') {
        return 4;
    }
    if (row.tone === 'risk' || row.tone === 'armed') {
        return 3;
    }
    return 2;
};

const getRiskWagerSignalAudioCue = (
    row: RiskWagerSignalRow
): 'risk-wager-signal-armed' | 'risk-wager-signal-objective' | 'risk-wager-signal-reward' | 'risk-wager-signal-risk' => {
    if (row.tone === 'armed') {
        return 'risk-wager-signal-armed';
    }
    if (row.tone === 'reward') {
        return 'risk-wager-signal-reward';
    }
    if (row.tone === 'risk') {
        return 'risk-wager-signal-risk';
    }
    return 'risk-wager-signal-objective';
};

const getRiskWagerSignalScreenCue = (row: RiskWagerSignalRow): 'armed' | 'burst' | 'risk' | 'objective' => {
    if (row.tone === 'armed') {
        return 'armed';
    }
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'risk') {
        return 'risk';
    }
    return 'objective';
};

const getRiskWagerSignalRows = ({
    armed,
    bonusFavor,
    streakAtRisk
}: {
    armed: boolean;
    bonusFavor: number;
    streakAtRisk: number;
}): RiskWagerSignalRow[] => [
    { label: armed ? 'Armed' : 'Stake', value: `x${streakAtRisk} streak`, tone: armed ? 'armed' : 'risk' },
    { label: 'Payoff', value: `+${bonusFavor} Favor`, tone: 'reward' },
    { label: 'Trigger', value: 'Next objective', tone: 'objective' }
];

const getRiskWagerPrimaryCue = ({
    armed,
    bonusFavor,
    streakAtRisk
}: {
    armed: boolean;
    bonusFavor: number;
    streakAtRisk: number;
}): RiskWagerPrimaryCue => ({
    action: armed ? 'Protect streak' : 'Arm wager',
    beatCount: armed ? 4 : 3,
    label: armed ? 'Wager armed' : 'Wager available',
    payoff: `+${bonusFavor} Favor`,
    risk: `x${streakAtRisk} streak`,
    tone: armed ? 'armed' : 'offer'
});

const getRiskWagerPrimaryAudioCue = (cue: RiskWagerPrimaryCue): 'risk-wager-armed' | 'risk-wager-offer' =>
    cue.tone === 'armed' ? 'risk-wager-armed' : 'risk-wager-offer';

const getRiskWagerPrimaryScreenCue = (cue: RiskWagerPrimaryCue): 'burst' | 'risk' =>
    cue.tone === 'armed' ? 'burst' : 'risk';

const RiskWagerPrimaryCueView = ({ cue }: { cue: RiskWagerPrimaryCue }) => (
    <span
        aria-label={`${cue.label}. ${cue.action}. Payoff ${cue.payoff}. Risk ${cue.risk}. ${cue.beatCount} beats.`}
        className={styles.endlessRiskWagerPrimaryCue}
        data-risk-wager-primary-action={cue.action}
        data-risk-wager-primary-audio={getRiskWagerPrimaryAudioCue(cue)}
        data-risk-wager-primary-beats={cue.beatCount}
        data-risk-wager-primary-payoff={cue.payoff}
        data-risk-wager-primary-risk={cue.risk}
        data-risk-wager-primary-screen-cue={getRiskWagerPrimaryScreenCue(cue)}
        data-risk-wager-primary-tone={cue.tone}
        data-testid="endless-risk-wager-primary-cue"
    >
        <small>{cue.label}</small>
        <b>{cue.action}</b>
        <em>{cue.payoff}</em>
        <strong>{cue.risk}</strong>
        <span aria-hidden="true" className={styles.endlessRiskWagerPrimaryBeatPips}>
            {Array.from({ length: cue.beatCount }, (_, index) => (
                <i
                    data-risk-wager-primary-beat={index + 1}
                    data-risk-wager-primary-beat-focus={index === 0 ? 'primary' : 'support'}
                    key={index}
                />
            ))}
        </span>
    </span>
);

const RiskWagerSignalRowsView = ({
    label,
    rows
}: {
    label: string;
    rows: readonly RiskWagerSignalRow[];
}) => (
    <div className={styles.endlessRiskWagerSignals} data-testid="endless-risk-wager-signals" aria-label={label}>
        {rows.map((row) => {
            const beatCount = getRiskWagerSignalBeatCount(row);
            return (
                <span
                    data-risk-wager-signal-audio={getRiskWagerSignalAudioCue(row)}
                    data-risk-wager-signal-beats={beatCount}
                    data-risk-wager-signal-screen-cue={getRiskWagerSignalScreenCue(row)}
                    data-risk-wager-signal-tone={row.tone}
                    key={`${row.label}:${row.value}`}
                >
                    <small>{row.label}</small>
                    <b>{row.value}</b>
                    <span aria-hidden="true" className={styles.endlessRiskWagerBeatPips}>
                        {Array.from({ length: beatCount }, (_, index) => (
                            <i data-risk-wager-signal-beat={index + 1} data-risk-wager-signal-beat-focus={index === 0 ? 'primary' : 'support'} key={index} />
                        ))}
                    </span>
                </span>
            );
        })}
    </div>
);

type FloorClearCashoutTone = 'chain' | 'missed' | 'reward';
type FloorClearCashoutRow = {
    detail: string;
    id: 'cashout' | 'missed' | 'next';
    label: string;
    tone: FloorClearCashoutTone;
    value: string;
};

type FloorClearCarryForwardCue = {
    detail: string;
    label: 'Carry forward';
    tone: 'chain' | 'missed' | 'reward' | 'trait';
    value: string;
};

type FloorClearPayoffStackSignal = {
    detail: string;
    label: 'Floor payoff stack' | 'Super stack';
    tone: 'combo' | 'missed' | 'reward' | 'setup' | 'super';
    value: string;
};

type FloorClearActionSequenceCue = {
    first: string;
    keep: string;
    label: 'Next floor loop';
    then: string;
    tone: 'cashout' | 'recover' | 'reward' | 'route';
};

type FloorClearObjectiveSignalRow = {
    id: string;
    label: string;
    tone: 'momentum' | 'neutral' | 'reward' | 'risk' | 'trait';
    value: string;
};

const getFloorClearPayoffStackBeatCount = (signal: FloorClearPayoffStackSignal): 2 | 3 | 4 | 5 => {
    if (signal.tone === 'super') {
        return 5;
    }
    if (signal.tone === 'combo') {
        return 4;
    }
    if (signal.tone === 'missed') {
        return 3;
    }
    return 2;
};

const getFloorClearPayoffStackAction = (
    signal: FloorClearPayoffStackSignal
): 'Bank stack' | 'Build bigger' | 'Recover value' | 'Rebuild stack' => {
    if (signal.tone === 'super') {
        return 'Rebuild stack';
    }
    if (signal.tone === 'combo' || signal.tone === 'reward') {
        return 'Bank stack';
    }
    if (signal.tone === 'missed') {
        return 'Recover value';
    }
    return 'Build bigger';
};

const getFloorClearPayoffStackAudioCue = (
    signal: FloorClearPayoffStackSignal
): 'floor-stack-combo' | 'floor-stack-missed' | 'floor-stack-reward' | 'floor-stack-setup' | 'floor-stack-super' => {
    if (signal.tone === 'super') {
        return 'floor-stack-super';
    }
    if (signal.tone === 'combo') {
        return 'floor-stack-combo';
    }
    if (signal.tone === 'missed') {
        return 'floor-stack-missed';
    }
    if (signal.tone === 'reward') {
        return 'floor-stack-reward';
    }
    return 'floor-stack-setup';
};

const getFloorClearPayoffStackScreenCue = (
    signal: FloorClearPayoffStackSignal
): 'burst' | 'pulse' | 'risk' | 'super' => {
    if (signal.tone === 'super') {
        return 'super';
    }
    if (signal.tone === 'combo' || signal.tone === 'reward') {
        return 'burst';
    }
    if (signal.tone === 'missed') {
        return 'risk';
    }
    return 'pulse';
};

const getFloorClearObjectiveSignalBeatCount = (row: FloorClearObjectiveSignalRow): 1 | 2 | 3 | 4 => {
    if (row.tone === 'reward' || row.tone === 'trait') {
        return 4;
    }
    if (row.tone === 'risk' || row.tone === 'momentum') {
        return 3;
    }
    return 2;
};

const getFloorClearObjectiveSignalAudioCue = (
    row: FloorClearObjectiveSignalRow
): 'floor-objective-momentum' | 'floor-objective-neutral' | 'floor-objective-reward' | 'floor-objective-risk' | 'floor-objective-trait' => {
    if (row.tone === 'reward') {
        return 'floor-objective-reward';
    }
    if (row.tone === 'trait') {
        return 'floor-objective-trait';
    }
    if (row.tone === 'risk') {
        return 'floor-objective-risk';
    }
    if (row.tone === 'momentum') {
        return 'floor-objective-momentum';
    }
    return 'floor-objective-neutral';
};

const getFloorClearObjectiveSignalScreenCue = (
    row: FloorClearObjectiveSignalRow
): 'burst' | 'guard' | 'pulse' | 'tick' | 'trait' => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'trait') {
        return 'trait';
    }
    if (row.tone === 'risk') {
        return 'guard';
    }
    if (row.tone === 'momentum') {
        return 'pulse';
    }
    return 'tick';
};

type NextFloorSignalRow = {
    detail: string | null;
    id: string;
    label: string;
    tone: 'counterplay' | 'neutral' | 'pressure' | 'reward' | 'route';
    value: string;
};

const getNextFloorSignalBeatCount = (row: NextFloorSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward' || row.tone === 'counterplay') {
        return 4;
    }
    if (row.tone === 'pressure') {
        return 3;
    }
    return 2;
};

const getNextFloorSignalAudioCue = (
    row: NextFloorSignalRow
): 'next-floor-counterplay' | 'next-floor-neutral' | 'next-floor-pressure' | 'next-floor-reward' | 'next-floor-route' => {
    if (row.tone === 'counterplay') {
        return 'next-floor-counterplay';
    }
    if (row.tone === 'pressure') {
        return 'next-floor-pressure';
    }
    if (row.tone === 'reward') {
        return 'next-floor-reward';
    }
    if (row.tone === 'route') {
        return 'next-floor-route';
    }
    return 'next-floor-neutral';
};

const getNextFloorSignalScreenCue = (
    row: NextFloorSignalRow
): 'burst' | 'guard' | 'pulse' | 'route' | 'tick' => {
    if (row.tone === 'reward' || row.tone === 'counterplay') {
        return 'burst';
    }
    if (row.tone === 'pressure') {
        return 'guard';
    }
    if (row.tone === 'route') {
        return 'route';
    }
    return row.tone === 'neutral' ? 'tick' : 'pulse';
};

const getFloorClearChainCashoutLabels = (run: RunState): string[] => {
    const bestStreak = Math.max(0, Math.floor(run.stats.bestStreak ?? 0));
    if (bestStreak < 4) {
        return [];
    }

    for (let probeStreak = bestStreak - 1; probeStreak >= 0; probeStreak -= 1) {
        const hitCues = getChainRewardForecastCues(probeStreak, run.stats.comboShards, run.lives).filter(
            (cue) => cue.urgency === 'next' && cue.targetStreak <= bestStreak
        );
        if (hitCues.length > 0) {
            return hitCues.map((cue) => cue.label);
        }
    }

    return [];
};

const getFloorClearCashoutRows = (run: RunState): FloorClearCashoutRow[] => {
    const result = run.lastLevelResult;
    if (!result) {
        return [];
    }
    const pickupTotal = Math.max(0, run.findablesTotalThisFloor ?? 0);
    const pickupClaimed = Math.max(0, run.findablesClaimedThisFloor ?? 0);
    const missedPickups = Math.max(0, pickupTotal - pickupClaimed);
    const bestStreak = Math.max(0, run.stats.bestStreak ?? 0);
    const traitPaid = Boolean(result.traitRouteObjectiveCompleted);
    const objectivePaid = Boolean(result.featuredObjectiveCompleted);
    const chainTarget = getChainTargetFeedback(bestStreak);
    const chainCashoutLabels = getFloorClearChainCashoutLabels(run);
    const chainCashoutValue = chainCashoutLabels.length > 0 ? chainCashoutLabels.join(' + ') : null;
    const rewardStack = [
        traitPaid ? 'trait route' : null,
        objectivePaid ? 'objective' : null,
        pickupClaimed > 0 ? `${pickupClaimed} pickup${pickupClaimed === 1 ? '' : 's'}` : null,
        chainCashoutValue ? `chain ${chainCashoutValue}` : null
    ].filter((item): item is string => item != null);
    const cashoutValue =
        rewardStack.length > 0
            ? rewardStack.join(' + ')
            : bestStreak >= 3
              ? `x${bestStreak} chain`
              : `+${result.scoreGained.toLocaleString()} score`;
    const cashoutDetail = [
        traitPaid
            ? result.traitRouteObjectiveReward ?? 'Trait route cashout paid.'
            : objectivePaid
              ? `+${(result.objectiveBonusScore ?? 0).toLocaleString()} objective score`
              : null,
        chainCashoutValue ? `Chain cashout: ${chainCashoutValue}.` : null
    ]
        .filter(Boolean)
        .join(' ');
    const missedValue =
        missedPickups > 0
            ? `${missedPickups} pickup${missedPickups === 1 ? '' : 's'} left`
            : !traitPaid && result.traitRouteObjectiveRequired != null
              ? 'trait route missed'
              : result.perfect
                ? 'perfect clear'
                : `${result.mistakes} miss${result.mistakes === 1 ? '' : 'es'}`;
    const nextValue =
        missedPickups > 0
            ? 'claim pickups'
            : chainTarget.value;

    return [
        {
            detail: cashoutDetail || 'Main score banked.',
            id: 'cashout',
            label: 'Cashout',
            tone: 'reward',
            value: cashoutValue
        },
        {
            detail: missedPickups > 0
                ? 'Visible reward pairs were left on the board.'
                : result.perfect
                  ? 'No miss tax; tempo stayed clean.'
                  : 'Misses broke chain pressure.',
            id: 'missed',
            label: missedPickups > 0 || !result.perfect ? 'Missed value' : 'Clean read',
            tone: missedPickups > 0 || !result.perfect ? 'missed' : 'reward',
            value: missedValue
        },
        {
            detail: missedPickups > 0
                ? 'Prioritize marked reward pairs before ending the floor.'
                : chainTarget.actionHint,
            id: 'next',
            label: 'Next chase',
            tone: missedPickups === 0 ? 'chain' : 'reward',
            value: nextValue
        }
    ];
};

const getFloorClearPayoffStackSignal = (
    run: RunState,
    floorClearCashoutRows: readonly FloorClearCashoutRow[],
    floorClearObjectiveSignalRows: readonly { id: string; label: string; value: string; tone: string }[],
    favorBankedPickCount: number
): FloorClearPayoffStackSignal | null => {
    const result = run.lastLevelResult;
    if (!result) {
        return null;
    }

    const lanes = [
        result.traitRouteObjectiveCompleted ? 'Trait route' : null,
        result.featuredObjectiveCompleted ? 'Objective' : null,
        run.findablesClaimedThisFloor > 0 ? 'Pickup' : null,
        getFloorClearChainCashoutLabels(run).length > 0 ? 'Chain cashout' : run.stats.bestStreak >= 3 ? 'Chain' : null,
        run.stats.comboShards > 0 ? 'Shard' : null,
        favorBankedPickCount > 0 ? 'Relic pick' : null
    ].filter((lane): lane is string => lane != null);
    const missedRows = floorClearCashoutRows.filter((row) => row.tone === 'missed');
    const objectivePaidRows = floorClearObjectiveSignalRows.filter(
        (row) => row.tone === 'reward' || row.tone === 'trait' || row.tone === 'momentum'
    );

    if (lanes.length >= 4) {
        return {
            detail: `${lanes.join(' + ')} paid on the clear; open the next floor by rebuilding the super-stack route.`,
            label: 'Super stack',
            tone: 'super',
            value: `${lanes.length} payoffs paid`
        };
    }

    if (lanes.length >= 2) {
        return {
            detail: `${lanes.join(' + ')} paid on the clear; route choice should build the next linked payoff.`,
            label: 'Floor payoff stack',
            tone: lanes.length >= 3 || objectivePaidRows.length >= 2 ? 'combo' : 'reward',
            value: `${lanes.length} payoffs paid`
        };
    }

    if (missedRows.length > 0) {
        return {
            detail: 'The clear landed, but the next floor should recover the missed value before ending.',
            label: 'Floor payoff stack',
            tone: 'missed',
            value: 'Value left open'
        };
    }

    return {
        detail: 'Score is banked; use the route choice to prime a bigger reward stack.',
        label: 'Floor payoff stack',
        tone: 'setup',
        value: 'Prime clear'
    };
};

type PickupStackToastState = Pick<RunState, 'findablesClaimedThisFloor' | 'findablesTotalThisFloor' | 'lives'> & {
    comboShards: number;
    currentStreak: number;
};

const getPickupStackToastText = (
    pickupState: PickupStackToastState,
    claimedKind: Parameters<typeof getFindableToastText>[0]
): string => {
    const baseText = getFindableToastText(claimedKind);
    const nextReward = getChainRewardForecastCues(
        pickupState.currentStreak,
        pickupState.comboShards,
        pickupState.lives
    )[0];
    const pickupProgress =
        pickupState.findablesTotalThisFloor > 0
            ? `Pickups ${pickupState.findablesClaimedThisFloor}/${pickupState.findablesTotalThisFloor}.`
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

const getFloorClearCarryForwardCue = (run: RunState, favorBankedPickCount: number): FloorClearCarryForwardCue | null => {
    const result = run.lastLevelResult;
    if (!result) {
        return null;
    }
    const pickupTotal = Math.max(0, run.findablesTotalThisFloor ?? 0);
    const pickupClaimed = Math.max(0, run.findablesClaimedThisFloor ?? 0);
    const missedPickups = Math.max(0, pickupTotal - pickupClaimed);
    const bestStreak = Math.max(0, run.stats.bestStreak ?? 0);
    const chainCashoutLabels = getFloorClearChainCashoutLabels(run);

    if (favorBankedPickCount > 0) {
        return {
            detail: 'Spend it at the next milestone draft.',
            label: 'Carry forward',
            tone: 'reward',
            value: `+${favorBankedPickCount} relic pick banked`
        };
    }
    if (result.traitRouteObjectiveCompleted) {
        return {
            detail: 'Open next floor by connecting trait cards.',
            label: 'Carry forward',
            tone: 'trait',
            value: 'Trait route engine live'
        };
    }
    if (bestStreak >= 6) {
        return {
            detail: chainCashoutLabels.length > 0
                ? `${chainCashoutLabels.join(' + ')} paid; chase reward-hot routes early.`
                : 'Chase reward-hot routes early.',
            label: 'Carry forward',
            tone: 'chain',
            value: chainCashoutLabels.length > 0 ? 'Chain cashout banked' : `x${bestStreak} chain ceiling`
        };
    }
    if (missedPickups > 0) {
        return {
            detail: 'Claim marked pairs before exit.',
            label: 'Carry forward',
            tone: 'missed',
            value: 'Pickup priority'
        };
    }
    return {
        detail: result.perfect ? 'Start the next floor with a confirmed-pair chain.' : 'Use safe matches to rebuild tempo.',
        label: 'Carry forward',
        tone: result.perfect ? 'reward' : 'chain',
        value: result.perfect ? 'Clean tempo' : 'Rebuild chain'
    };
};

const getFloorClearActionSequenceCue = ({
    carryForwardCue,
    cashoutRows,
    payoffStackSignal,
    routeChoiceRequired,
    run
}: {
    carryForwardCue: FloorClearCarryForwardCue | null;
    cashoutRows: readonly FloorClearCashoutRow[];
    payoffStackSignal: FloorClearPayoffStackSignal | null;
    routeChoiceRequired: boolean;
    run: RunState;
}): FloorClearActionSequenceCue | null => {
    if (!run.lastLevelResult) {
        return null;
    }

    const chainTarget = getChainTargetFeedback(Math.max(0, run.stats.bestStreak ?? 0));
    const missedRow = cashoutRows.find((row) => row.tone === 'missed');
    const nextRow = cashoutRows.find((row) => row.id === 'next');
    const first = routeChoiceRequired
        ? 'Choose route card'
        : run.pendingRouteCardPlan
          ? `Enter ${routeTypeLabel(run.pendingRouteCardPlan.routeType)} floor`
          : 'Continue descent';
    const then =
        carryForwardCue?.tone === 'reward'
            ? 'Spend banked relic pick'
            : missedRow
              ? `Recover ${missedRow.value}`
              : carryForwardCue?.tone === 'trait'
                ? 'Connect trait cards'
                : payoffStackSignal?.tone === 'combo' || payoffStackSignal?.tone === 'super'
                  ? 'Rebuild reward stack'
                  : 'Open with safe match';
    const keep =
        missedRow && carryForwardCue?.tone === 'reward'
            ? 'Claim pickups early'
            : nextRow?.tone === 'chain'
              ? nextRow.value
              : chainTarget.value;
    const tone =
        missedRow && carryForwardCue?.tone !== 'reward'
            ? 'recover'
            : routeChoiceRequired
              ? 'route'
              : payoffStackSignal?.tone === 'combo' || payoffStackSignal?.tone === 'super'
                ? 'cashout'
                : 'reward';

    return {
        first,
        keep,
        label: 'Next floor loop',
        then,
        tone
    };
};

const getRouteChoiceSignalLabels = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): { reward: string; risk: string } => {
    if (routeType === 'safe') {
        return { reward: 'Stable reward', risk: 'Low risk' };
    }
    if (routeType === 'greed') {
        return { reward: 'High reward', risk: 'High risk' };
    }
    return { reward: 'Board change', risk: 'Unknown risk' };
};

type RouteChoiceBeatCue = {
    action: string;
    audioCue: 'route-guard-beat' | 'route-cashout-beat' | 'route-prime-beat';
    beatCount: number;
    detail: string;
    label: string;
    screenCue: 'guard' | 'super' | 'pulse';
    tier: 'cashout' | 'guard' | 'prime';
};

const getRouteChoiceBeatCue = (routeType: RouteNodeType): RouteChoiceBeatCue => {
    switch (routeType) {
        case 'greed':
            return {
                action: 'Cash greed',
                audioCue: 'route-cashout-beat',
                beatCount: 5,
                detail: 'Take only after recall is repaired.',
                label: 'Cashout beat',
                screenCue: 'super',
                tier: 'cashout'
            };
        case 'mystery':
            return {
                action: 'Prime mystery',
                audioCue: 'route-prime-beat',
                beatCount: 3,
                detail: 'Anchor the clue before accepting the remix.',
                label: 'Prime beat',
                screenCue: 'pulse',
                tier: 'prime'
            };
        case 'safe':
        default:
            return {
                action: 'Stabilize route',
                audioCue: 'route-guard-beat',
                beatCount: 2,
                detail: 'Guard the next floor before stacking value.',
                label: 'Guard beat',
                screenCue: 'guard',
                tier: 'guard'
            };
    }
};

type RouteChoicePayoffTone = 'reward' | 'risk' | 'memory' | 'build' | 'route';
type RouteChoicePayoffRow = { id: string; label: string; tone: RouteChoicePayoffTone; value: string };
type RouteChoiceDecisionStack = {
    label: 'Route stack' | 'Route safety' | 'Route gamble' | 'Route mystery';
    nextCue: string;
    tone: RouteChoicePayoffTone;
    value: string;
};
type RouteChoiceActionCue = {
    action: 'Stabilize route' | 'Cash greed' | 'Prime mystery';
    detail: string;
    label: 'Do next';
    tone: RouteChoicePayoffTone;
};
type RouteChoiceImpactCue = {
    label: 'Safe route' | 'Greed route' | 'Mystery route';
    tone: RouteChoicePayoffTone;
    value: string;
};
type SelectedRouteActionCue = {
    detail: string;
    label: 'Opening tactic';
    tone: RouteChoicePayoffTone;
    value: string;
};

const getRouteChoiceToneBeatCount = (tone: RouteChoicePayoffTone): 2 | 3 | 4 => {
    if (tone === 'reward') {
        return 4;
    }
    if (tone === 'risk' || tone === 'build') {
        return 3;
    }
    return 2;
};

const getRouteChoicePayoffAudioCue = (
    tone: RouteChoicePayoffTone
): 'route-payoff-reward' | 'route-payoff-risk' | 'route-payoff-memory' | 'route-payoff-build' | 'route-payoff-route' => {
    if (tone === 'reward') {
        return 'route-payoff-reward';
    }
    if (tone === 'risk') {
        return 'route-payoff-risk';
    }
    if (tone === 'memory') {
        return 'route-payoff-memory';
    }
    if (tone === 'build') {
        return 'route-payoff-build';
    }
    return 'route-payoff-route';
};

const getRouteChoicePayoffScreenCue = (tone: RouteChoicePayoffTone): 'burst' | 'risk' | 'memory' | 'build' | 'pulse' => {
    if (tone === 'reward') {
        return 'burst';
    }
    if (tone === 'risk') {
        return 'risk';
    }
    if (tone === 'memory') {
        return 'memory';
    }
    if (tone === 'build') {
        return 'build';
    }
    return 'pulse';
};

const getRouteChoiceSignalAudioCue = (signal: 'reward' | 'risk'): 'route-signal-reward' | 'route-signal-risk' =>
    signal === 'reward' ? 'route-signal-reward' : 'route-signal-risk';

const getRouteChoiceSignalScreenCue = (signal: 'reward' | 'risk'): 'burst' | 'risk' =>
    signal === 'reward' ? 'burst' : 'risk';

const trimTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/u, '');

const getRouteChoiceNextFloorRow = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): RouteChoicePayoffRow => {
    if (routeType === 'safe') {
        return { id: 'next', label: 'Next', tone: 'route', value: 'ward support' };
    }
    if (routeType === 'greed') {
        return { id: 'next', label: 'Next', tone: 'risk', value: 'richer caches' };
    }
    return { id: 'next', label: 'Next', tone: 'build', value: 'changed board' };
};

const getSelectedRouteActionCue = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): SelectedRouteActionCue => {
    if (routeType === 'safe') {
        return {
            detail: 'Use ward support to preserve the first chain.',
            label: 'Opening tactic',
            tone: 'memory',
            value: 'Stabilize first pair'
        };
    }
    if (routeType === 'greed') {
        return {
            detail: 'Confirm recall before chasing richer caches.',
            label: 'Opening tactic',
            tone: 'risk',
            value: 'Verify before cashout'
        };
    }
    return {
        detail: 'Anchor the clue before the changed board spreads.',
        label: 'Opening tactic',
        tone: 'build',
        value: 'Solve clue first'
    };
};

const getRouteChoicePayoffRows = ({
    memoryChoice,
    routeType
}: {
    memoryChoice?: ReturnType<typeof getMemoryRecallFeedback>['choices'][number];
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
}): RouteChoicePayoffRow[] => {
    const baseRows: RouteChoicePayoffRow[] =
        routeType === 'safe'
            ? [
                  { id: 'reward', label: 'Payoff', tone: 'reward' as const, value: 'steady clear' },
                  { id: 'risk', label: 'Risk', tone: 'memory' as const, value: 'low pressure' }
              ]
            : routeType === 'greed'
              ? [
                    { id: 'reward', label: 'Payoff', tone: 'reward' as const, value: 'bonus value' },
                    { id: 'risk', label: 'Risk', tone: 'risk' as const, value: 'high pressure' }
                ]
              : [
                    { id: 'reward', label: 'Payoff', tone: 'build' as const, value: 'board twist' },
                    { id: 'risk', label: 'Risk', tone: 'risk' as const, value: 'unknown' }
                ];

    const nextFloorRow = getRouteChoiceNextFloorRow(routeType);
    if (!memoryChoice) {
        return [...baseRows, nextFloorRow];
    }
    const memoryTone: RouteChoicePayoffTone =
        memoryChoice.readiness === 'ready' ? 'memory' : memoryChoice.readiness === 'unsafe' ? 'risk' : 'build';

    const rows: RouteChoicePayoffRow[] = [
        ...baseRows,
        nextFloorRow,
        {
            id: 'memory',
            label: 'Recall',
            tone: memoryTone,
            value: memoryChoice.readinessLabel
        }
    ];
    return rows.slice(0, 4);
};

const getRouteChoiceDecisionStack = ({
    memoryChoice,
    payoffRows,
    routeType,
    signalLabels
}: {
    memoryChoice?: ReturnType<typeof getMemoryRecallFeedback>['choices'][number];
    payoffRows: RouteChoicePayoffRow[];
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
    signalLabels: { reward: string; risk: string };
}): RouteChoiceDecisionStack => {
    const payoff = payoffRows.find((row) => row.id === 'reward')?.value ?? signalLabels.reward;
    const next = payoffRows.find((row) => row.id === 'next')?.value ?? 'next room';
    const recall = memoryChoice?.readinessLabel ? trimTerminalPunctuation(memoryChoice.readinessLabel) : undefined;
    const value = recall ? `${signalLabels.reward} + ${recall}` : `${signalLabels.reward} + ${next}`;
    if (routeType === 'safe') {
        return {
            label: 'Route safety',
            nextCue: `First: stabilize with ${next}`,
            tone: 'memory',
            value
        };
    }
    if (routeType === 'greed') {
        return {
            label: 'Route gamble',
            nextCue: `First: confirm recall before ${payoff}`,
            tone: 'risk',
            value
        };
    }
    return {
        label: 'Route mystery',
        nextCue: `First: anchor clue before ${next}`,
        tone: 'build',
        value
    };
};

const getRouteChoiceActionCue = ({
    decisionStack,
    memoryChoice,
    routeType
}: {
    decisionStack: RouteChoiceDecisionStack;
    memoryChoice?: ReturnType<typeof getMemoryRecallFeedback>['choices'][number];
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
}): RouteChoiceActionCue => {
    if (routeType === 'safe') {
        return {
            action: 'Stabilize route',
            detail: memoryChoice?.readinessLabel ?? decisionStack.nextCue.replace(/^First:\s*/u, ''),
            label: 'Do next',
            tone: 'memory'
        };
    }
    if (routeType === 'greed') {
        return {
            action: 'Cash greed',
            detail:
                memoryChoice?.readiness === 'unsafe'
                    ? 'Repair recall before taking pressure cashout'
                    : memoryChoice?.readinessLabel ?? 'Confirm recall before bonus value',
            label: 'Do next',
            tone: memoryChoice?.readiness === 'unsafe' ? 'risk' : 'reward'
        };
    }
    return {
        action: 'Prime mystery',
        detail: memoryChoice?.readinessLabel ?? 'Anchor clue before board remix',
        label: 'Do next',
        tone: 'build'
    };
};

const getRouteChoiceImpactCue = ({
    decisionStack,
    routeType
}: {
    decisionStack: RouteChoiceDecisionStack;
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType'];
}): RouteChoiceImpactCue => {
    if (routeType === 'safe') {
        return { label: 'Safe route', tone: decisionStack.tone, value: 'Shield next floor' };
    }
    if (routeType === 'greed') {
        return { label: 'Greed route', tone: decisionStack.tone, value: 'Pressure cashout' };
    }
    return { label: 'Mystery route', tone: decisionStack.tone, value: 'Board remix' };
};

const getSelectedRouteImpactCue = (
    routeType: NonNullable<RunState['pendingRouteCardPlan']>['routeType']
): RouteChoiceImpactCue => {
    if (routeType === 'safe') {
        return { label: 'Safe route', tone: 'memory', value: 'Ward support locked' };
    }
    if (routeType === 'greed') {
        return { label: 'Greed route', tone: 'risk', value: 'Risk cashout locked' };
    }
    return { label: 'Mystery route', tone: 'build', value: 'Remix locked' };
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

const actualMatchPayoffLaneCount = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>,
    payoffChips: readonly NonNullable<MatchScorePop['payoffChips']>[number][] = []
): number => {
    const summaryLaneCount = /^(\d+)\s+(?:payoffs|lanes)\b/.exec(payoffSummary.value)?.[1];
    if (summaryLaneCount) {
        return Number(summaryLaneCount);
    }
    const cashoutChipCount = payoffChips.filter((chip) =>
        chip.id === 'route' || chip.id === 'pickup' || chip.id === 'trait' || chip.id === 'chainReward'
    ).length;
    return Math.max(cashoutChipCount, payoffSummary.tier === 'score' ? 0 : 1);
};

type MatchFloaterHeat = 'cashout' | 'prime' | 'score' | 'stack' | 'surge';
type MismatchFloaterHeat = 'break' | 'lost-reward' | 'recover' | 'risk' | 'trait-surge';
type MatchPayoffChip = NonNullable<MatchScorePop['payoffChips']>[number];
type MatchFloaterJackpotCue = {
    action: string;
    beatCount: 3 | 4 | 5;
    label: string;
    tier: 'cashout' | 'stack' | 'super';
    value: string;
};

const getMatchFloaterHeat = (payload: MatchScorePop): MatchFloaterHeat => {
    const impactLabel = payload.impactCue.label.toLowerCase();
    const payoffSummaryLabel = payload.payoffSummary?.label.toLowerCase() ?? '';
    const payoffChipCues = payload.payoffChips?.map((chip) => chip.arcadeCue?.toLowerCase() ?? '') ?? [];

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

const getBoardFloaterImpactCueBeatCount = (payload: MatchScorePop): 2 | 3 | 4 | 5 => {
    const cueLabel = payload.impactCue.label.toLowerCase();
    const baseBeatCount =
        cueLabel === 'super stack'
            ? 5
            : cueLabel === 'stack cashout' || cueLabel.includes('cashout')
              ? 4
              : payload.impactCue.tone === 'reward' ||
                  payload.impactCue.tone === 'pickup' ||
                  payload.impactCue.tone === 'route' ||
                  payload.impactCue.tone === 'trait'
                ? 4
                : payload.impactCue.tone === 'combo' || payload.impactCue.tone === 'chain'
                  ? 3
                  : 2;
    return Math.max(baseBeatCount, payload.crescendo?.beatCount ?? 0) as 2 | 3 | 4 | 5;
};

const getBoardFloaterImpactCueScreenCue = (payload: MatchScorePop): 'burst' | 'pulse' | 'route' | 'surge' => {
    const cueLabel = payload.impactCue.label.toLowerCase();
    if (cueLabel === 'super stack' || cueLabel.includes('stack') || cueLabel.includes('cashout')) {
        return 'burst';
    }
    if (payload.impactCue.tone === 'trait' || payload.impactCue.tone === 'combo' || cueLabel.includes('surge')) {
        return 'surge';
    }
    if (payload.impactCue.tone === 'route') {
        return 'route';
    }
    return 'pulse';
};

const getBoardFloaterRewardBurstBeatCount = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 3 | 4 | 5 => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 5;
    }
    if (rewardBurst.tier === 'stack') {
        return 4;
    }
    return 3;
};

const getBoardFloaterRewardBurstAudioCue = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 'reward-burst-hit' | 'reward-burst-stack' | 'reward-burst-super' => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 'reward-burst-super';
    }
    if (rewardBurst.tier === 'stack') {
        return 'reward-burst-stack';
    }
    return 'reward-burst-hit';
};

const getBoardFloaterRewardBurstScreenCue = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 'pulse' | 'burst' | 'super' => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 'super';
    }
    if (rewardBurst.tier === 'stack') {
        return 'burst';
    }
    return 'pulse';
};

const getBoardFloaterCascadeBeatCount = (
    cascadeCue: NonNullable<MatchScorePop['cascadeCue']>
): 3 | 4 | 5 => {
    if (cascadeCue.tier === 'combo') {
        return 5;
    }
    if (cascadeCue.tier === 'reward') {
        return 4;
    }
    return 3;
};

const getBoardFloaterPayoffSummaryBeatCount = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 2 | 3 | 4 | 5 => {
    if (payoffSummary.label === 'Super stack') {
        return 5;
    }
    if (payoffSummary.label === 'Stack cashout' || payoffSummary.tier === 'reward') {
        return 4;
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 3;
    }
    return 2;
};

const getBoardFloaterPayoffSummaryAudioCue = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 'payoff-summary-score' | 'payoff-summary-chain' | 'payoff-summary-cashout' | 'payoff-summary-stack' | 'payoff-summary-super' => {
    if (payoffSummary.label === 'Super stack') {
        return 'payoff-summary-super';
    }
    if (payoffSummary.label === 'Stack cashout') {
        return 'payoff-summary-stack';
    }
    if (payoffSummary.tier === 'reward' || payoffSummary.label.includes('cashout')) {
        return 'payoff-summary-cashout';
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 'payoff-summary-chain';
    }
    return 'payoff-summary-score';
};

const getBoardFloaterPayoffSummaryScreenCue = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 'tick' | 'pulse' | 'burst' | 'super' => {
    if (payoffSummary.label === 'Super stack') {
        return 'super';
    }
    if (payoffSummary.label === 'Stack cashout' || payoffSummary.tier === 'reward') {
        return 'burst';
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 'pulse';
    }
    return 'tick';
};

const getMatchFloaterJackpotCue = (payload: MatchScorePop): MatchFloaterJackpotCue | null => {
    const summary = payload.payoffSummary;
    const rewardBurst = payload.rewardBurst;
    const laneCount = Math.max(payload.payoffLaneMap?.length ?? 0, summary ? actualMatchPayoffLaneCount(summary, payload.payoffChips) : 0);
    const impactLabel = payload.impactCue.label;
    const impactLabelLower = impactLabel.toLowerCase();
    const crescendo = payload.crescendo;

    if (summary?.label === 'Super stack' || rewardBurst?.label === 'Super stack' || crescendo?.tier === 'super') {
        return {
            action: rewardBurst?.action ?? 'Cash super stack',
            beatCount: 5,
            label: 'Super stack',
            tier: 'super',
            value: summary?.value ?? rewardBurst?.value ?? `${Math.max(laneCount, 4)} payoff lanes`
        };
    }
    if (summary?.label === 'Stack cashout' || rewardBurst?.tier === 'stack' || crescendo?.tier === 'stack' || laneCount >= 3) {
        return {
            action: rewardBurst?.action ?? 'Cash stack',
            beatCount: Math.max(4, crescendo?.beatCount ?? 0) as 4 | 5,
            label: 'Stack cashout',
            tier: 'stack',
            value: summary?.value ?? rewardBurst?.value ?? `${laneCount} payoff lanes`
        };
    }
    if (
        summary?.label === 'Route cashout' ||
        summary?.label === 'Pickup cashout' ||
        summary?.label === 'Trait cashout' ||
        summary?.label === 'Chain cashout' ||
        impactLabelLower.includes('cashout') ||
        crescendo?.tier === 'cashout'
    ) {
        return {
            action: rewardBurst?.action ?? 'Cash now',
            beatCount: Math.max(3, crescendo?.beatCount ?? 0) as 3 | 4 | 5,
            label: summary?.label ?? 'Cashout',
            tier: 'cashout',
            value: summary?.value ?? rewardBurst?.value ?? payload.routeRewardText ?? `+${payload.amount.toLocaleString()}`
        };
    }
    return null;
};

const getBoardFloaterJackpotAudioCue = (
    cue: MatchFloaterJackpotCue
): 'match-jackpot-cashout' | 'match-jackpot-stack' | 'match-jackpot-super' => {
    if (cue.tier === 'super') {
        return 'match-jackpot-super';
    }
    if (cue.tier === 'stack') {
        return 'match-jackpot-stack';
    }
    return 'match-jackpot-cashout';
};

const getBoardFloaterJackpotScreenCue = (
    cue: MatchFloaterJackpotCue
): 'burst' | 'cashout' | 'super' => {
    if (cue.tier === 'super') {
        return 'super';
    }
    if (cue.tier === 'stack') {
        return 'burst';
    }
    return 'cashout';
};

const getBoardFloaterPayoffLaneBeatCount = (
    lane: MatchScorePopPayoffLaneMapEntry
): 2 | 3 | 4 => {
    if (lane.tone === 'reward' || lane.tone === 'pickup' || lane.tone === 'route') {
        return lane.count > 1 ? 4 : 3;
    }
    if (lane.tone === 'trait' || lane.tone === 'chain') {
        return 3;
    }
    return 2;
};

const getBoardFloaterPayoffLaneAudioCue = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'match-payoff-route' | 'match-payoff-pickup' | 'match-payoff-trait' | 'match-payoff-chain' | 'match-payoff-reward' | 'match-payoff-prime' => {
    if (lane.tone === 'route') {
        return 'match-payoff-route';
    }
    if (lane.tone === 'pickup') {
        return 'match-payoff-pickup';
    }
    if (lane.tone === 'trait') {
        return 'match-payoff-trait';
    }
    if (lane.tone === 'chain') {
        return 'match-payoff-chain';
    }
    if (lane.tone === 'reward') {
        return 'match-payoff-reward';
    }
    return 'match-payoff-prime';
};

const getBoardFloaterPayoffLaneScreenCue = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'burst' | 'route' | 'trait' | 'chain' | 'pulse' => {
    if (lane.tone === 'route' || lane.tone === 'pickup' || lane.tone === 'reward' || lane.count > 1) {
        return 'burst';
    }
    if (lane.tone === 'trait') {
        return 'trait';
    }
    if (lane.tone === 'chain') {
        return 'chain';
    }
    return 'pulse';
};

const getBoardFloaterPayoffLaneFocus = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'cashout' | 'route' | 'pickup' | 'trait' | 'chain' | 'reward' => {
    const action = matchPayoffLaneAction(lane).toLowerCase();
    const cue = lane.cue.toLowerCase();

    if (action.includes('cash') || cue.includes('cashout')) {
        return 'cashout';
    }

    return lane.tone;
};

const getBoardFloaterTraitLaneAudioCue = (
    lane: TraitInteractionLaneMapEntry
): 'match-trait-shard' | 'match-trait-guard' | 'match-trait-risk' | 'match-trait-score' | 'match-trait-tool' | 'match-trait-block' | 'match-trait-recall' => {
    if (lane.id === 'shard') {
        return 'match-trait-shard';
    }
    if (lane.id === 'guard') {
        return 'match-trait-guard';
    }
    if (lane.id === 'risk') {
        return 'match-trait-risk';
    }
    if (lane.id === 'score') {
        return 'match-trait-score';
    }
    if (lane.id === 'tool') {
        return 'match-trait-tool';
    }
    if (lane.id === 'block') {
        return 'match-trait-block';
    }
    return 'match-trait-recall';
};

const getBoardFloaterTraitLaneScreenCue = (
    lane: TraitInteractionLaneMapEntry
): 'burst' | 'guard' | 'risk' | 'control' | 'pulse' => {
    if (lane.count > 1 || lane.id === 'shard' || lane.id === 'score') {
        return 'burst';
    }
    if (lane.id === 'guard') {
        return 'guard';
    }
    if (lane.id === 'risk') {
        return 'risk';
    }
    if (lane.id === 'tool' || lane.id === 'block') {
        return 'control';
    }
    return 'pulse';
};

const getBoardFloaterPayoffLadderBeatCount = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 3 | 4 | 5 => {
    const laneCount = ladder.lanes?.length ?? 0;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 5;
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 4;
    }
    return 3;
};

const getBoardFloaterPayoffLadderAudioCue = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 'payoff-ladder-chain' | 'payoff-ladder-reward' | 'payoff-ladder-super' => {
    const laneCount = ladder.lanes?.length ?? 0;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 'payoff-ladder-super';
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 'payoff-ladder-reward';
    }
    return 'payoff-ladder-chain';
};

const getBoardFloaterPayoffLadderScreenCue = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 'burst' | 'pulse' | 'super' => {
    const laneCount = ladder.lanes?.length ?? 0;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 'super';
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 'burst';
    }
    return 'pulse';
};

const getBoardFloaterTraitLaneBeatCount = (
    lane: TraitInteractionLaneMapEntry
): 2 | 3 | 4 => {
    if (lane.id === 'shard' || lane.id === 'guard') {
        return lane.count > 1 ? 4 : 3;
    }
    if (lane.id === 'risk' || lane.id === 'block') {
        return 3;
    }
    return 2;
};

const getBoardFloaterChainMilestoneBeatCount = (
    milestone: NonNullable<MatchScorePop['chainMilestone']>
): 3 | 4 | 5 => {
    if (milestone.beatCount) {
        return milestone.beatCount;
    }
    if (milestone.tone === 'combo') {
        return 5;
    }
    if (milestone.tone === 'surge') {
        return 4;
    }
    return 3;
};

const getMismatchFloaterHeat = (payload: MismatchScorePop): MismatchFloaterHeat => {
    const traitRiskCount = payload.traitInteractionTexts?.length ?? 0;
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

const getMatchPayoffChipBeatCount = (chip: MatchPayoffChip): 1 | 2 | 3 | 4 => {
    const arcadeCue = chip.arcadeCue?.toLowerCase() ?? '';
    if (arcadeCue.includes('one-away') || arcadeCue.includes('cashout') || chip.id === 'chainReward' || chip.id === 'next') {
        return 4;
    }
    if (chip.id === 'pickup' || chip.id === 'route' || chip.id === 'trait' || chip.id === 'tier') {
        return 3;
    }
    if (chip.id === 'streak' || chip.id === 'cascade') {
        return 2;
    }
    return 1;
};

const getMatchPayoffChipAudioCue = (
    chip: MatchPayoffChip
):
    | 'match-payoff-chain'
    | 'match-payoff-guard'
    | 'match-payoff-heal'
    | 'match-payoff-pickup'
    | 'match-payoff-reward'
    | 'match-payoff-route'
    | 'match-payoff-score'
    | 'match-payoff-trait' => {
    if (chip.tone === 'guard') {
        return 'match-payoff-guard';
    }
    if (chip.tone === 'heal') {
        return 'match-payoff-heal';
    }
    if (chip.tone === 'pickup') {
        return 'match-payoff-pickup';
    }
    if (chip.tone === 'route') {
        return 'match-payoff-route';
    }
    if (chip.tone === 'trait') {
        return 'match-payoff-trait';
    }
    if (chip.tone === 'reward' || chip.id === 'next' || chip.id === 'chainReward') {
        return 'match-payoff-reward';
    }
    if (chip.tone === 'chain' || chip.id === 'streak' || chip.id === 'cascade' || chip.id === 'tier') {
        return 'match-payoff-chain';
    }
    return 'match-payoff-score';
};

const getMatchPayoffChipScreenCue = (
    chip: MatchPayoffChip
): 'burst' | 'chain' | 'guard' | 'heal' | 'pulse' | 'tick' | 'trait' => {
    const arcadeCue = chip.arcadeCue?.toLowerCase() ?? '';
    if (arcadeCue.includes('one-away') || arcadeCue.includes('cashout') || chip.id === 'next' || chip.id === 'chainReward') {
        return 'burst';
    }
    if (chip.tone === 'guard') {
        return 'guard';
    }
    if (chip.tone === 'heal') {
        return 'heal';
    }
    if (chip.tone === 'trait') {
        return 'trait';
    }
    if (chip.tone === 'pickup' || chip.tone === 'route' || chip.tone === 'reward') {
        return 'burst';
    }
    if (chip.tone === 'chain') {
        return 'chain';
    }
    return chip.id === 'score' ? 'tick' : 'pulse';
};

const getBoardFloaterRewardForecastBeatCount = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 2 | 3 | 4 => {
    if (cue.urgency === 'next' || cue.distance <= 1 || (cue.stackSize ?? 1) >= 2) {
        return 4;
    }
    if (cue.urgency === 'soon' || cue.distance <= 2) {
        return 3;
    }
    return 2;
};

const getBoardFloaterRewardForecastAudioCue = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 'chain-reward-guard' | 'chain-reward-heal' | 'chain-reward-prime' | 'chain-reward-shard' | 'chain-reward-stack' => {
    if ((cue.stackSize ?? 1) >= 2) {
        return 'chain-reward-stack';
    }
    if (cue.tone === 'guard') {
        return 'chain-reward-guard';
    }
    if (cue.tone === 'heal') {
        return 'chain-reward-heal';
    }
    if (cue.urgency === 'later') {
        return 'chain-reward-prime';
    }
    return 'chain-reward-shard';
};

const getBoardFloaterRewardForecastScreenCue = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 'burst' | 'pulse' | 'tick' => {
    if ((cue.stackSize ?? 1) >= 2 || cue.urgency === 'next') {
        return 'burst';
    }
    if (cue.urgency === 'soon') {
        return 'pulse';
    }
    return 'tick';
};

const getMismatchRecoveryChipBeatCount = (chip: MismatchFloaterRecoveryChip): 1 | 2 | 3 | 4 => {
    if (chip.arcadeCue === 'Lost cashout' || chip.urgency === 'one-away') {
        return 4;
    }
    if (chip.tone === 'risk' || chip.tone === 'chain') {
        return 3;
    }
    if (chip.tone === 'tool' || chip.tone === 'tempo') {
        return 2;
    }
    return 1;
};

const getMismatchRecoveryChipAudioCue = (
    chip: MismatchFloaterRecoveryChip
):
    | 'mismatch-chip-chain'
    | 'mismatch-chip-lost'
    | 'mismatch-chip-recover'
    | 'mismatch-chip-risk'
    | 'mismatch-chip-tempo'
    | 'mismatch-chip-tool' => {
    if (chip.arcadeCue === 'Lost cashout') {
        return 'mismatch-chip-lost';
    }
    if (chip.tone === 'chain') {
        return 'mismatch-chip-chain';
    }
    if (chip.tone === 'risk') {
        return 'mismatch-chip-risk';
    }
    if (chip.tone === 'tool') {
        return 'mismatch-chip-tool';
    }
    if (chip.tone === 'tempo') {
        return 'mismatch-chip-tempo';
    }
    return 'mismatch-chip-recover';
};

const getMismatchRecoveryChipScreenCue = (
    chip: MismatchFloaterRecoveryChip
): 'chain' | 'lost' | 'recover' | 'risk' | 'tempo' | 'tool' => {
    if (chip.arcadeCue === 'Lost cashout') {
        return 'lost';
    }
    if (chip.tone === 'chain') {
        return 'chain';
    }
    if (chip.tone === 'risk') {
        return 'risk';
    }
    if (chip.tone === 'tool') {
        return 'tool';
    }
    if (chip.tone === 'tempo') {
        return 'tempo';
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
    const boardFloaterDurationMs = matchScoreFloatDurationMs(boardFloaterReducedMotion, boardFloaterPayload);
    const boardFloaterDetailLines = useMemo(() => {
        if (!boardFloaterPayload) {
            return [];
        }
        if (boardFloaterPayload.kind === 'match') {
            return [
                boardFloaterPayload.pickupRewardText,
                boardFloaterPayload.chainRewardText,
                ...(boardFloaterPayload.traitInteractionTexts ?? [])
            ].filter((line): line is string => Boolean(line));
        }
        return boardFloaterPayload.traitInteractionTexts ?? [];
    }, [boardFloaterPayload]);
    const boardFloaterTraitLaneMap = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match'
                ? buildTraitInteractionLaneMap(boardFloaterPayload.traitInteractionTexts)
                : [],
        [boardFloaterPayload]
    );
    const boardFloaterTraitLaneMapAttr = traitInteractionLaneMapAttr(boardFloaterTraitLaneMap);
    const boardFloaterTraitLaneActionMapAttr = traitInteractionLaneActionMapAttr(boardFloaterTraitLaneMap);
    const boardFloaterPrimaryTraitLane = boardFloaterTraitLaneMap[0] ?? null;
    const boardFloaterChainCue =
        boardFloaterPayload?.kind === 'match' ? matchScoreFloaterChainCue(boardFloaterPayload.chainDepth) : '';
    const boardFloaterMismatchSignal =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterSignal(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecovery =
        boardFloaterPayload?.kind === 'miss' ? mismatchFloaterRecoveryHint(boardFloaterDetailLines) : null;
    const boardFloaterMismatchRecoveryCrescendo =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryCrescendo(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryCrescendoLabel = boardFloaterMismatchRecoveryCrescendo
        ? mismatchFloaterRecoveryCrescendoLabel('Mismatch recovery crescendo', boardFloaterMismatchRecoveryCrescendo)
        : '';
    const boardFloaterLiveText = useMemo(() => {
        if (!boardFloaterPayload) {
            return '';
        }
        if (boardFloaterPayload.kind === 'match') {
            return matchScoreFloaterLiveRegionText(
                boardFloaterPayload.amount,
                boardFloaterDetailLines,
                boardFloaterPayload.feedbackHeadline,
                boardFloaterPayload.chainDepth,
                boardFloaterPayload.chainRewardForecastCues?.map(
                    (cue) =>
                        `${getChainRewardLaneAction(cue.urgency)}: ${getChainRewardUrgencyCopy(cue)}: ${cue.distanceLabel} to ${cue.label}`
                ) ?? [],
                boardFloaterPayload.rewardBurst
                    ? `${boardFloaterPayload.rewardBurst.label}: ${boardFloaterPayload.rewardBurst.action}: ${boardFloaterPayload.rewardBurst.value}`
                    : undefined,
                boardFloaterPayload.cascadeCue
                    ? `${boardFloaterPayload.cascadeCue.label}: ${boardFloaterPayload.cascadeCue.value}`
                    : undefined,
                boardFloaterPayload.payoffSummary
                    ? `${boardFloaterPayload.payoffSummary.label}: ${boardFloaterPayload.payoffSummary.value}`
                    : undefined,
                boardFloaterPayload.payoffLadder
                    ? `${boardFloaterPayload.impactCue.label}. First: ${boardFloaterPayload.payoffLadder.first}. Then: ${boardFloaterPayload.payoffLadder.then}. Keep: ${boardFloaterPayload.payoffLadder.keep}${
                          boardFloaterPayload.payoffLadder.lanes?.length
                              ? `. Lanes: ${boardFloaterPayload.payoffLadder.lanes.join(' to ')}`
                              : ''
                      }`
                    : boardFloaterPayload.impactCue.label,
                matchPayoffLaneMapLabel(boardFloaterPayload.payoffLaneMap),
                boardFloaterTraitLaneMap.length > 0
                    ? formatTraitInteractionLaneMapLabel('Match trait interaction lanes', boardFloaterTraitLaneMap)
                    : undefined,
                boardFloaterPayload.crescendo
                    ? `${boardFloaterPayload.crescendo.label}: ${boardFloaterPayload.crescendo.detail}`
                    : undefined,
                boardFloaterPayload.chainMilestone
                    ? `${boardFloaterPayload.chainMilestone.action}: ${boardFloaterPayload.chainMilestone.label}: ${boardFloaterPayload.chainMilestone.target}: ${boardFloaterPayload.chainMilestone.value}. ${boardFloaterPayload.chainMilestone.beatCount} beats.`
                    : undefined
            );
        }
        const mismatchContext = {
            brokenChainDepth: boardFloaterPayload.brokenChainDepth,
            brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
        };
        return mismatchFloaterLiveRegionText(
            boardFloaterDetailLines,
            boardFloaterMismatchRecovery,
            mismatchContext,
            mismatchRecoveryLaneMapLabel(
                mismatchFloaterRecoveryLaneMap(mismatchFloaterRecoveryChips(boardFloaterDetailLines, mismatchContext))
            ),
            boardFloaterMismatchRecoveryCrescendo
                ? `${boardFloaterMismatchRecoveryCrescendo.label}: ${boardFloaterMismatchRecoveryCrescendo.detail}`
                : undefined
        );
    }, [
        boardFloaterDetailLines,
        boardFloaterMismatchRecovery,
        boardFloaterMismatchRecoveryCrescendo,
        boardFloaterPayload,
        boardFloaterTraitLaneMap
    ]);
    const boardFloaterMismatchRecoveryBurst =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryBurst(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchNextAction =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterNextAction(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryChips =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryChips(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : [];
    const boardFloaterMismatchRecoveryLaneMap =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryLaneMap(boardFloaterMismatchRecoveryChips)
            : null;
    const boardFloaterPrimaryMismatchRecoveryLane = getPrimaryMismatchRecoveryLane(boardFloaterMismatchRecoveryLaneMap);
    const boardFloaterMismatchRecoveryStack =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryStack(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoverySequence =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoverySequence(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardRecoveryContext =
        boardFloaterPayload?.kind === 'miss' && boardFloaterMismatchNextAction
            ? {
                  action:
                      boardFloaterMismatchNextAction.tone === 'lost-reward'
                          ? 'Save'
                          : boardFloaterMismatchNextAction.tone === 'risk'
                            ? 'Stabilize'
                            : 'Recover',
                  detail:
                      boardFloaterMismatchRecoveryStack?.detail ??
                      boardFloaterMismatchRecovery ??
                      boardFloaterMismatchNextAction.value,
                  impactCue: boardFloaterMismatchNextAction.arcadeCue,
                  tone: boardFloaterMismatchNextAction.tone,
                  value: boardFloaterMismatchNextAction.value
              }
            : null;
    const boardMatchPayoffStackCue =
        boardFloaterPayload?.kind === 'match' && boardFloaterPayload.payoffSummary
            ? {
                  label: boardFloaterPayload.payoffSummary.label,
                  value: boardFloaterPayload.payoffSummary.value,
                  tone: boardFloaterPayload.payoffSummary.tier,
                  laneCount: actualMatchPayoffLaneCount(
                      boardFloaterPayload.payoffSummary,
                      boardFloaterPayload.payoffChips
                  ),
                  firstCue: boardFloaterPayload.payoffChips?.[0]?.arcadeCue ?? boardFloaterPayload.impactCue.label,
                  sequenceFirstCue:
                      boardFloaterPayload.payoffChips?.find((chip) => chip.id !== 'score')?.arcadeCue ??
                      boardFloaterPayload.impactCue.label,
                  nextCue:
                      boardFloaterPayload.payoffChips?.find((chip) => chip.id === 'next')?.arcadeCue ??
                      boardFloaterPayload.rewardBurst?.value ??
                      null,
                  sequenceKeepCue:
                      boardFloaterPayload.chainRewardForecastCues?.[0]?.chaseLabel ??
                      boardFloaterPayload.payoffChips?.find((chip) => chip.id === 'next')?.value ??
                      'Chase next safe match'
              }
            : null;
    const boardFloaterJackpotCue =
        boardFloaterPayload?.kind === 'match' ? getMatchFloaterJackpotCue(boardFloaterPayload) : null;
    const boardFloaterPrimaryPayoffLane =
        boardFloaterPayload?.kind === 'match' ? boardFloaterPayload.payoffLaneMap?.[0] ?? null : null;

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
    const relicDraftPayoffEngineSignal = run.relicOffer ? getInventoryPayoffEngineSignal(run) : null;
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
                showInfo(
                    getPickupStackToastText(
                        {
                            comboShards: run.stats.comboShards,
                            currentStreak: run.stats.currentStreak,
                            findablesClaimedThisFloor: run.findablesClaimedThisFloor,
                            findablesTotalThisFloor: run.findablesTotalThisFloor,
                            lives: run.lives
                        },
                        claimedKind
                    ),
                    infoDuration,
                    {
                    stackKey: `pickup:${run.board.level}:${run.findablesClaimedThisFloor}`
                    }
                );
            }
        }

        pickupToastSnapshotRef.current = nextSnapshot;
    }, [
        run.board,
        run.findablesClaimedThisFloor,
        run.findablesTotalThisFloor,
        run.lives,
        run.stats.comboShards,
        run.stats.currentStreak,
        settingsReduceMotion
    ]);

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
                ? `Trait routes: Complete (${run.lastLevelResult.traitRouteObjectiveReward ?? 'trait route cashout'})`
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
    const favorGained = run.lastLevelResult?.relicFavorGained ?? 0;
    const favorBankedPickCount = countFavorBonusPicksBanked(run.relicFavorProgress, favorGained);
    const floorClearMomentumRows = run.lastLevelResult
        ? [
              {
                  id: 'score',
                  label: 'Score pop',
                  value: `+${run.lastLevelResult.scoreGained.toLocaleString()}`
              },
              {
                  id: 'rating',
                  label: 'Rating',
                  value: run.lastLevelResult.rating
              },
              run.stats.bestStreak > 0
                  ? {
                        id: 'streak',
                        label: 'Best chain',
                        value: `x${run.stats.bestStreak}`
                    }
                  : null,
              run.findablesTotalThisFloor > 0
                  ? {
                        id: 'pickups',
                        label: 'Pickups',
                        value: `${run.findablesClaimedThisFloor}/${run.findablesTotalThisFloor}`
                    }
                  : null,
              run.stats.comboShards > 0
                  ? {
                        id: 'shards',
                        label: 'Shards',
                        value: `${run.stats.comboShards}`
                    }
                  : null,
              favorGained > 0
                  ? {
                        id: 'favor',
                        label: 'Favor',
                        value:
                            favorBankedPickCount > 0
                                ? `+${favorGained} pick banked`
                                : `+${favorGained} -> ${run.relicFavorProgress}/3`
                    }
                  : null
          ].filter((row): row is { id: string; label: string; value: string } => row != null)
        : [];
    const floorClearMomentumRowsLabel = formatGameplaySignalRowsLabel(
        'Floor clear momentum signals',
        floorClearMomentumRows
    );
    const floorClearCashoutRows = getFloorClearCashoutRows(run);
    const floorClearCashoutRowsLabel = formatGameplayDetailRowsLabel(
        'Floor clear cashout read',
        floorClearCashoutRows
    );
    const floorClearCarryForwardCue = getFloorClearCarryForwardCue(run, favorBankedPickCount);
    const floorClearObjectiveSignalRows = run.lastLevelResult
        ? [
              run.lastLevelResult.featuredObjectiveId != null
                  ? {
                        id: 'featured-objective',
                        label: run.lastLevelResult.featuredObjectiveCompleted ? 'Objective paid' : 'Objective missed',
                        value: run.lastLevelResult.featuredObjectiveCompleted
                            ? `+${(run.lastLevelResult.objectiveBonusScore ?? 0).toLocaleString()} score`
                            : 'Payout lost',
                        tone: run.lastLevelResult.featuredObjectiveCompleted ? 'reward' : 'risk'
                    }
                  : null,
              run.lastLevelResult.featuredObjectiveId != null
                  ? {
                        id: 'objective-streak',
                        label: 'Objective streak',
                        value: `x${run.lastLevelResult.featuredObjectiveStreak ?? 0}${
                            (run.lastLevelResult.featuredObjectiveStreakBonus ?? 0) > 0
                                ? ` +${run.lastLevelResult.featuredObjectiveStreakBonus!.toLocaleString()}`
                                : ''
                        }`,
                        tone: (run.lastLevelResult.featuredObjectiveStreak ?? 0) > 1 ? 'momentum' : 'neutral'
                    }
                  : null,
              run.lastLevelResult.traitRouteObjectiveRequired != null
                  ? {
                        id: 'trait-route-objective',
                        label: run.lastLevelResult.traitRouteObjectiveCompleted ? 'Trait route paid' : 'Trait route',
                        value: run.lastLevelResult.traitRouteObjectiveCompleted
                            ? run.lastLevelResult.traitRouteObjectiveReward ?? 'Trait route cashout'
                            : `${run.lastLevelResult.traitRouteObjectiveProgress ?? 0}/${run.lastLevelResult.traitRouteObjectiveRequired}`,
                        tone: run.lastLevelResult.traitRouteObjectiveCompleted ? 'trait' : 'neutral'
                    }
                  : null,
              run.lastLevelResult.endlessRiskWagerOutcome
                  ? {
                        id: 'risk-wager',
                        label:
                            run.lastLevelResult.endlessRiskWagerOutcome === 'won'
                                ? 'Wager paid'
                                : 'Wager lost',
                        value:
                            run.lastLevelResult.endlessRiskWagerOutcome === 'won'
                                ? `+${run.lastLevelResult.endlessRiskWagerFavorGained ?? 0} Favor`
                                : `-${run.lastLevelResult.endlessRiskWagerStreakLost ?? 0} streak`,
                        tone: run.lastLevelResult.endlessRiskWagerOutcome === 'won' ? 'reward' : 'risk'
                    }
                  : null
          ].filter((row): row is FloorClearObjectiveSignalRow => row != null)
        : [];
    const floorClearObjectiveSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Floor clear objective signals',
        floorClearObjectiveSignalRows
    );
    const floorClearPayoffStackSignal = getFloorClearPayoffStackSignal(
        run,
        floorClearCashoutRows,
        floorClearObjectiveSignalRows,
        favorBankedPickCount
    );
    const featuredObjectiveResultLine = run.lastLevelResult ? formatLevelResultObjectiveLine(run.lastLevelResult) : null;
    const featuredObjectiveFailureLine = featuredObjectiveFailReason(run);
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
    const visibleRiskWagerSignalRows =
        acceptedEndlessRiskWager || endlessRiskWagerOfferAvailable
            ? getRiskWagerSignalRows({
                  armed: Boolean(acceptedEndlessRiskWager),
                  bonusFavor: acceptedEndlessRiskWager?.bonusFavorOnSuccess ?? offeredRiskWagerFavor,
                  streakAtRisk: acceptedEndlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
              })
            : [];
    const riskWagerPrimaryCue =
        acceptedEndlessRiskWager || endlessRiskWagerOfferAvailable
            ? getRiskWagerPrimaryCue({
                  armed: Boolean(acceptedEndlessRiskWager),
                  bonusFavor: acceptedEndlessRiskWager?.bonusFavorOnSuccess ?? offeredRiskWagerFavor,
                  streakAtRisk: acceptedEndlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
              })
            : null;
    const riskWagerArmAriaLabel =
        visibleRiskWagerSignalRows.length > 0
            ? `Arm wager. ${visibleRiskWagerSignalRows
                  .map((row) => `${row.label}: ${row.value}`)
                  .join('. ')}. Complete the next featured objective for bonus Favor; miss it and the streak ${
                  wagerSuretyActive ? 'falls to x1' : 'breaks'
              }.`
            : 'Arm wager';
    const riskWagerSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Risk wager decision signals',
        visibleRiskWagerSignalRows
    );
    const routeChoiceRequired = Boolean(run.lastLevelResult?.routeChoices && !run.pendingRouteCardPlan);
    const floorClearActionSequenceCue = getFloorClearActionSequenceCue({
        carryForwardCue: floorClearCarryForwardCue,
        cashoutRows: floorClearCashoutRows,
        payoffStackSignal: floorClearPayoffStackSignal,
        routeChoiceRequired,
        run
    });
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
    const routeChoiceRecommendation = useMemo(() => {
        if (!routeChoiceRequired || !run.lastLevelResult?.routeChoices || !dungeonRouteDecisionPresentation) {
            return null;
        }

        const readinessScore = {
            ready: 30,
            risky: 12,
            unsafe: -20
        } as const;

        return dungeonRouteDecisionPresentation.rows
            .map((row, index) => {
                const choice = run.lastLevelResult?.routeChoices?.find((option) => option.id === row.id);
                const availability = choice ? getRouteChoiceAvailability(run, choice) : { available: true as const };
                if (!availability.available) {
                    return null;
                }

                const memoryChoice = routeChoiceMemoryById.get(row.id);
                const signalLabels = getRouteChoiceSignalLabels(row.routeType);
                const payoffRows = getRouteChoicePayoffRows({ memoryChoice, routeType: row.routeType });
                const decisionStack = getRouteChoiceDecisionStack({
                    memoryChoice,
                    payoffRows,
                    routeType: row.routeType,
                    signalLabels
                });
                const actionCue = getRouteChoiceActionCue({
                    decisionStack,
                    memoryChoice,
                    routeType: row.routeType
                });
                const beatCue = getRouteChoiceBeatCue(row.routeType);
                const primaryPayoff = payoffRows[0] ?? null;
                const score =
                    (memoryChoice ? readinessScore[memoryChoice.readiness] : 0) +
                    (firstRouteChoiceRequired && row.routeType === 'safe' ? 4 : 0) -
                    index;

                return {
                    actionCue,
                    beatCue,
                    decisionStack,
                    index,
                    memoryChoice,
                    primaryPayoff,
                    row,
                    score
                };
            })
            .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
            .sort((a, b) => b.score - a.score || a.index - b.index)[0] ?? null;
    }, [
        dungeonRouteDecisionPresentation,
        firstRouteChoiceRequired,
        routeChoiceMemoryById,
        routeChoiceRequired,
        run
    ]);
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
    const pendingRouteSignalLabels = run.pendingRouteCardPlan
        ? getRouteChoiceSignalLabels(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingRouteImpactCue = run.pendingRouteCardPlan
        ? getSelectedRouteImpactCue(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingRouteActionCue = run.pendingRouteCardPlan
        ? getSelectedRouteActionCue(run.pendingRouteCardPlan.routeType)
        : null;
    const pendingDungeonNode = run.pendingRouteCardPlan ? getRepairedSelectedDungeonNode(run.dungeonRun) : null;
    const dungeonExitStatus = getDungeonExitStatus(run);
    const dungeonExitRouteLine = dungeonExitStatus.routeType
        ? `${routeTypeLabel(dungeonExitStatus.routeType)} beyond this door.`
        : 'This stair leaves the current floor.';
    const dungeonExitLockLine = dungeonExitPromptLockLine(dungeonExitStatus, run);
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
    const activeRouteSignalRows = activeRouteSpecialKind ? routeSpecialSignalRows(activeRouteSpecialKind) : [];
    const activeRouteSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Route card payoff signals',
        activeRouteSignalRows
    );
    const dungeonPresentation = getDungeonBoardPresentation(run);
    const activeDungeonPanel = run.status !== 'levelComplete' && dungeonPresentation.visible ? dungeonPresentation : null;
    const activeDungeonObjectiveStatus = activeDungeonPanel ? getDungeonObjectiveStatus(run) : null;
    const traitRouteObjectiveStatus = getTraitRouteObjectiveStatus(run);
    const liveObjectiveStatus = activeDungeonObjectiveStatus ?? traitRouteObjectiveStatus;
    const armedRewardPerkCue = getPrimaryRewardPerkReadinessRow(run);
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
    const nextFloorSignalRowsLabel = formatGameplayDetailRowsLabel(
        'Next floor preview signals',
        nextFloorSignalRows
    );
    const floorClearCausalityRowsLabel = formatGameplayDetailRowsLabel(
        'Floor clear cause signals',
        floorClearCausalityRows
    );

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
                            {activeRouteBannerLine ? (
                                <div className={styles.routeCardBanner} data-testid="route-card-board-banner">
                                    <strong>{routeSpecialDisplayLabel(activeRouteSpecialKind!)}</strong>
                                    <span>{routeSpecialDisplayRewardLine(activeRouteSpecialKind!)}</span>
                                    <div
                                        className={styles.routeCardBannerSignals}
                                        data-testid="route-card-board-banner-signals"
                                        aria-label={activeRouteSignalRowsLabel}
                                    >
                                        {activeRouteSignalRows.map((row) => {
                                            const beatCount = getRouteSpecialSignalBeatCount(row);
                                            return (
                                                <span
                                                    data-route-card-signal-audio={getRouteSpecialSignalAudioCue(row)}
                                                    data-route-card-signal-beats={beatCount}
                                                    data-route-card-signal-screen-cue={getRouteSpecialSignalScreenCue(row)}
                                                    data-route-card-signal-tone={row.tone}
                                                    key={`${row.label}:${row.value}`}
                                                >
                                                    <small>{row.label}</small>
                                                    <b>{row.value}</b>
                                                    <span aria-hidden="true" className={styles.routeCardBannerBeatPips}>
                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                            <i
                                                                data-route-card-signal-beat={index + 1}
                                                                data-route-card-signal-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={index}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
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
                                    data-match-payoff-stack-keep={boardMatchPayoffStackCue.sequenceKeepCue}
                                    data-match-payoff-stack-screen-cue={getBoardMatchPayoffStackScreenCue(boardMatchPayoffStackCue)}
                                    data-match-payoff-stack-sequence-first={boardMatchPayoffStackCue.sequenceFirstCue}
                                    data-match-payoff-stack-sequence-then={
                                        boardMatchPayoffStackCue.nextCue ?? 'Lock payoff route'
                                    }
                                    data-match-payoff-stack-tone={boardMatchPayoffStackCue.tone}
                                    data-testid="board-match-payoff-stack-cue"
                                    role="status"
                                >
                                    <small>{boardMatchPayoffStackCue.label}</small>
                                    <strong>{boardMatchPayoffStackCue.value}</strong>
                                    <b>{getBoardMatchPayoffStackAction(boardMatchPayoffStackCue)}</b>
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
                                    } ${boardFloaterReducedMotion ? styles.matchScoreFloaterReduced : ''}`}
                                    data-testid={
                                        boardFloaterPayload.kind === 'match'
                                            ? 'match-score-floater'
                                            : 'mismatch-score-floater'
                                    }
                                    data-feedback-intensity={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.feedbackIntensity
                                            : boardFloaterDetailLines.length > 0
                                              ? 'penalty'
                                              : (boardFloaterPayload.brokenChainDepth ?? 0) >= 3
                                                ? 'break'
                                              : 'miss'
                                    }
                                    data-match-floater-heat={
                                        boardFloaterPayload.kind === 'match'
                                            ? getMatchFloaterHeat(boardFloaterPayload)
                                            : 'none'
                                    }
                                    data-match-crescendo-audio={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.audioCue ?? 'none'
                                            : 'none'
                                    }
                                    data-match-crescendo-beats={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.beatCount ?? 0
                                            : 0
                                    }
                                    data-match-crescendo-cue={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-match-crescendo-screen-cue={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-match-crescendo-tier={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.crescendo?.tier ?? 'none'
                                            : 'none'
                                    }
                                    data-match-jackpot-beats={
                                        boardFloaterPayload.kind === 'match' ? boardFloaterJackpotCue?.beatCount ?? 0 : 0
                                    }
                                    data-match-jackpot-audio={
                                        boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue
                                            ? getBoardFloaterJackpotAudioCue(boardFloaterJackpotCue)
                                            : 'none'
                                    }
                                    data-match-jackpot-screen-cue={
                                        boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue
                                            ? getBoardFloaterJackpotScreenCue(boardFloaterJackpotCue)
                                            : 'none'
                                    }
                                    data-match-jackpot-tier={
                                        boardFloaterPayload.kind === 'match' ? boardFloaterJackpotCue?.tier ?? 'none' : 'none'
                                    }
                                    data-match-trait-lane-count={
                                        boardFloaterPayload.kind === 'match' ? boardFloaterTraitLaneMap.length : 0
                                    }
                                    data-match-trait-lane-map={
                                        boardFloaterPayload.kind === 'match'
                                            ? boardFloaterTraitLaneMapAttr || 'none'
                                            : 'none'
                                    }
                                    data-mismatch-floater-heat={
                                        boardFloaterPayload.kind === 'miss'
                                            ? getMismatchFloaterHeat(boardFloaterPayload)
                                            : 'none'
                                    }
                                    data-mismatch-recovery-crescendo-beats={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.beatCount ?? 0
                                            : 0
                                    }
                                    data-mismatch-recovery-crescendo-cue={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-mismatch-recovery-crescendo-screen-cue={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.screenCue ?? 'none'
                                            : 'none'
                                    }
                                    data-mismatch-recovery-crescendo-tier={
                                        boardFloaterPayload.kind === 'miss'
                                            ? boardFloaterMismatchRecoveryCrescendo?.tier ?? 'none'
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
                                    {boardFloaterPayload.kind === 'match' ? (
                                        <span
                                            className={styles.boardFloaterSignal}
                                            data-floater-signal={boardFloaterPayload.feedbackSignal.tone}
                                        >
                                            {boardFloaterPayload.feedbackSignal.label}
                                        </span>
                                    ) : (
                                        <span
                                            className={styles.boardFloaterSignal}
                                            data-floater-signal={boardFloaterMismatchSignal?.tone}
                                        >
                                            {boardFloaterMismatchSignal?.label}
                                        </span>
                                    )}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue ? (
                                        <span
                                            aria-label={`${boardFloaterJackpotCue.label}: ${boardFloaterJackpotCue.action}: ${boardFloaterJackpotCue.value}. ${boardFloaterJackpotCue.beatCount} beats.`}
                                            className={styles.boardFloaterJackpotCue}
                                            data-match-jackpot-action={boardFloaterJackpotCue.action}
                                            data-match-jackpot-audio={getBoardFloaterJackpotAudioCue(boardFloaterJackpotCue)}
                                            data-match-jackpot-beats={boardFloaterJackpotCue.beatCount}
                                            data-match-jackpot-screen-cue={getBoardFloaterJackpotScreenCue(boardFloaterJackpotCue)}
                                            data-match-jackpot-tier={boardFloaterJackpotCue.tier}
                                            data-testid="match-score-floater-jackpot"
                                        >
                                            <small>{boardFloaterJackpotCue.label}</small>
                                            <b>{boardFloaterJackpotCue.action}</b>
                                            <em>{boardFloaterJackpotCue.value}</em>
                                            <span aria-hidden="true" className={styles.boardFloaterJackpotBeats}>
                                                {Array.from({ length: boardFloaterJackpotCue.beatCount }, (_, index) => (
                                                    <i
                                                        data-match-jackpot-beat={index + 1}
                                                        data-match-jackpot-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={`match-jackpot-beat-${index + 1}`}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' ? (
                                        <span
                                            aria-label={`Match impact cue: ${boardFloaterPayload.impactCue.label}`}
                                            className={styles.boardFloaterImpactCue}
                                            data-match-impact-cue-beats={getBoardFloaterImpactCueBeatCount(boardFloaterPayload)}
                                            data-match-impact-cue-screen-cue={getBoardFloaterImpactCueScreenCue(boardFloaterPayload)}
                                            data-match-impact-cue-tone={boardFloaterPayload.impactCue.tone}
                                            data-testid="match-score-floater-impact-cue"
                                        >
                                            {boardFloaterPayload.impactCue.label}
                                            <span aria-hidden="true" className={styles.boardFloaterImpactBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterImpactCueBeatCount(boardFloaterPayload) },
                                                    (_, index) => (
                                                        <i
                                                            data-match-impact-cue-beat={index + 1}
                                                            data-match-impact-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`match-impact-cue-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.crescendo ? (
                                        <span
                                            aria-label={`Match crescendo ${boardFloaterPayload.crescendo.label}: ${boardFloaterPayload.crescendo.detail}. ${boardFloaterPayload.crescendo.beatCount} beats.`}
                                            className={styles.boardFloaterCrescendo}
                                            data-match-crescendo-cue={boardFloaterPayload.crescendo.screenCue}
                                            data-match-crescendo-screen-cue={boardFloaterPayload.crescendo.screenCue}
                                            data-match-crescendo-tier={boardFloaterPayload.crescendo.tier}
                                            data-testid="match-score-floater-crescendo"
                                        >
                                            <small>{boardFloaterPayload.crescendo.label}</small>
                                            <span className={styles.boardFloaterCrescendoBeats}>
                                                {Array.from({ length: boardFloaterPayload.crescendo.beatCount }, (_, index) => (
                                                    <i
                                                        aria-hidden
                                                        data-match-crescendo-beat={index + 1}
                                                        data-match-crescendo-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={`crescendo-beat-${index + 1}`}
                                                    />
                                                ))}
                                            </span>
                                            <b>{boardFloaterPayload.crescendo.detail}</b>
                                        </span>
                                    ) : null}
                                    <span className={styles.boardFloaterMain}>
                                        {boardFloaterPayload.kind === 'match'
                                            ? boardFloaterPayload.feedbackHeadline
                                            : mismatchFloaterVisualLabel(boardFloaterDetailLines, {
                                                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                                                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
                                              })}
                                    </span>
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.cascadeCue ? (
                                        <span
                                            aria-label={`${boardFloaterPayload.cascadeCue.label}: ${boardFloaterPayload.cascadeCue.value}`}
                                            className={styles.boardFloaterCascadeCue}
                                            data-cascade-beats={getBoardFloaterCascadeBeatCount(boardFloaterPayload.cascadeCue)}
                                            data-cascade-tier={boardFloaterPayload.cascadeCue.tier}
                                            data-testid="match-score-floater-cascade"
                                        >
                                            <small>{boardFloaterPayload.cascadeCue.label}</small>
                                            <b>{boardFloaterPayload.cascadeCue.value}</b>
                                            <span aria-hidden="true" className={styles.boardFloaterCascadeBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterCascadeBeatCount(boardFloaterPayload.cascadeCue) },
                                                    (_, index) => (
                                                        <i
                                                            data-cascade-beat={index + 1}
                                                            data-cascade-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`cascade-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.chainMilestone ? (
                                        <span
                                            aria-label={`Chain milestone ${boardFloaterPayload.chainMilestone.label}: ${boardFloaterPayload.chainMilestone.target}. Action: ${boardFloaterPayload.chainMilestone.action}. ${boardFloaterPayload.chainMilestone.value}. ${getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone)} beats.`}
                                            className={styles.boardFloaterChainMilestone}
                                            data-chain-milestone-action={boardFloaterPayload.chainMilestone.action}
                                            data-chain-milestone-audio={boardFloaterPayload.chainMilestone.audioCue}
                                            data-chain-milestone-beats={getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone)}
                                            data-chain-milestone-cue={boardFloaterPayload.chainMilestone.screenCue}
                                            data-chain-milestone-screen-cue={boardFloaterPayload.chainMilestone.screenCue}
                                            data-chain-milestone-target={boardFloaterPayload.chainMilestone.target}
                                            data-chain-milestone-tone={boardFloaterPayload.chainMilestone.tone}
                                            data-testid="match-score-floater-chain-milestone"
                                        >
                                            <small>{boardFloaterPayload.chainMilestone.label}</small>
                                            <b>{boardFloaterPayload.chainMilestone.target}</b>
                                            <strong>{boardFloaterPayload.chainMilestone.action}</strong>
                                            <em>{boardFloaterPayload.chainMilestone.value}</em>
                                            <span aria-hidden="true" className={styles.boardFloaterChainMilestoneBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone) },
                                                    (_, index) => (
                                                        <i
                                                            data-chain-milestone-beat={index + 1}
                                                            data-chain-milestone-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`chain-milestone-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.rewardBurst ? (
                                        <span
                                            aria-label={`${boardFloaterPayload.rewardBurst.label}: ${boardFloaterPayload.rewardBurst.action}: ${boardFloaterPayload.rewardBurst.value}`}
                                            className={styles.boardFloaterRewardBurst}
                                            data-reward-burst-action={boardFloaterPayload.rewardBurst.action}
                                            data-reward-burst-audio={getBoardFloaterRewardBurstAudioCue(boardFloaterPayload.rewardBurst)}
                                            data-reward-burst-beats={getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst)}
                                            data-reward-burst-label={boardFloaterPayload.rewardBurst.label}
                                            data-reward-burst-screen-cue={getBoardFloaterRewardBurstScreenCue(boardFloaterPayload.rewardBurst)}
                                            data-reward-burst-tier={boardFloaterPayload.rewardBurst.tier}
                                            data-testid="match-score-floater-reward-burst"
                                        >
                                            <small>{boardFloaterPayload.rewardBurst.label}</small>
                                            <u>{boardFloaterPayload.rewardBurst.action}</u>
                                            <b>{boardFloaterPayload.rewardBurst.value}</b>
                                            <span aria-hidden="true" className={styles.boardFloaterRewardBurstBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst) },
                                                    (_, index) => (
                                                        <i
                                                            data-reward-burst-beat={index + 1}
                                                            data-reward-burst-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`reward-burst-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.payoffSummary ? (
                                        <span
                                            aria-label={`${boardFloaterPayload.payoffSummary.label}: ${boardFloaterPayload.payoffSummary.value}`}
                                            className={styles.boardFloaterPayoffSummary}
                                            data-payoff-summary-audio={getBoardFloaterPayoffSummaryAudioCue(boardFloaterPayload.payoffSummary)}
                                            data-payoff-summary-beats={getBoardFloaterPayoffSummaryBeatCount(boardFloaterPayload.payoffSummary)}
                                            data-payoff-summary-label={boardFloaterPayload.payoffSummary.label}
                                            data-payoff-summary-focus={
                                                boardFloaterPayload.payoffSummary.label === 'Super stack' ||
                                                boardFloaterPayload.payoffSummary.label === 'Stack cashout'
                                                    ? 'cashout'
                                                    : boardFloaterPayload.payoffSummary.tier
                                            }
                                            data-payoff-summary-screen-cue={getBoardFloaterPayoffSummaryScreenCue(boardFloaterPayload.payoffSummary)}
                                            data-payoff-summary-tier={boardFloaterPayload.payoffSummary.tier}
                                            data-testid="match-score-floater-payoff-summary"
                                        >
                                            <small>{boardFloaterPayload.payoffSummary.label}</small>
                                            <b>{boardFloaterPayload.payoffSummary.value}</b>
                                            <span aria-hidden="true" className={styles.boardFloaterPayoffSummaryBeatPips}>
                                                {Array.from(
                                                    { length: getBoardFloaterPayoffSummaryBeatCount(boardFloaterPayload.payoffSummary) },
                                                    (_, index) => (
                                                        <i
                                                            data-payoff-summary-beat={index + 1}
                                                            data-payoff-summary-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`payoff-summary-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.payoffLaneMap?.length ? (
                                        <span
                                            aria-label={matchPayoffLaneMapLabel(boardFloaterPayload.payoffLaneMap)}
                                            className={styles.boardFloaterPayoffLaneMap}
                                            data-match-payoff-lane-primary={boardFloaterPrimaryPayoffLane?.id ?? 'none'}
                                            data-match-payoff-lane-primary-action={
                                                boardFloaterPrimaryPayoffLane
                                                    ? matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-match-payoff-lane-primary-audio={
                                                boardFloaterPrimaryPayoffLane
                                                    ? getBoardFloaterPayoffLaneAudioCue(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-match-payoff-lane-primary-focus={
                                                boardFloaterPrimaryPayoffLane
                                                    ? getBoardFloaterPayoffLaneFocus(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-match-payoff-lane-actions={matchPayoffLaneActionMapAttr(
                                                boardFloaterPayload.payoffLaneMap
                                            )}
                                            data-match-payoff-lane-map={matchPayoffLaneMapAttr(boardFloaterPayload.payoffLaneMap)}
                                            data-match-payoff-lane-primary-screen-cue={
                                                boardFloaterPrimaryPayoffLane
                                                    ? getBoardFloaterPayoffLaneScreenCue(boardFloaterPrimaryPayoffLane)
                                                    : 'none'
                                            }
                                            data-testid="match-score-floater-payoff-lane-map"
                                        >
                                            <span
                                                className={styles.boardFloaterPayoffLaneMapSummary}
                                                data-match-payoff-lane-count={boardFloaterPayload.payoffLaneMap.length}
                                                data-testid="match-score-floater-payoff-lane-map-summary"
                                            >
                                                <small>Lanes</small>
                                                <b>
                                                    {boardFloaterPayload.payoffLaneMap.length}{' '}
                                                    {boardFloaterPayload.payoffLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterPayoffLaneMapSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, boardFloaterPayload.payoffLaneMap.length + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-match-payoff-lane-map-summary-beat={index + 1}
                                                                data-match-payoff-lane-map-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`payoff-lane-map-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                            {boardFloaterPrimaryPayoffLane ? (
                                                <span
                                                    aria-label={`Primary paid lane. ${matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)}: ${boardFloaterPrimaryPayoffLane.label}. ${boardFloaterPrimaryPayoffLane.cue}. ${getBoardFloaterPayoffLaneBeatCount(boardFloaterPrimaryPayoffLane)} beats.`}
                                                    data-match-payoff-primary-lane={boardFloaterPrimaryPayoffLane.id}
                                                    data-match-payoff-primary-lane-action={matchPayoffLaneAction(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-audio={getBoardFloaterPayoffLaneAudioCue(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-beats={getBoardFloaterPayoffLaneBeatCount(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-focus={getBoardFloaterPayoffLaneFocus(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-screen-cue={getBoardFloaterPayoffLaneScreenCue(
                                                        boardFloaterPrimaryPayoffLane
                                                    )}
                                                    data-match-payoff-primary-lane-tone={boardFloaterPrimaryPayoffLane.tone}
                                                    data-testid="match-score-floater-primary-payoff-lane"
                                                >
                                                    <small>Paid lane</small>
                                                    <strong>{matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)}</strong>
                                                    <em>{boardFloaterPrimaryPayoffLane.cue}</em>
                                                    <span aria-hidden="true" className={styles.boardFloaterPrimaryPayoffLaneBeatPips}>
                                                        {Array.from(
                                                            { length: getBoardFloaterPayoffLaneBeatCount(boardFloaterPrimaryPayoffLane) },
                                                            (_, index) => (
                                                                <i
                                                                    data-match-payoff-primary-lane-beat={index + 1}
                                                                    data-match-payoff-primary-lane-beat-focus={
                                                                        index === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={`${boardFloaterPrimaryPayoffLane.id}-primary-payoff-lane-beat-${index + 1}`}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ) : null}
                                            {boardFloaterPayload.payoffLaneMap.map((lane) => (
                                                <span
                                                    data-match-payoff-lane={lane.id}
                                                    data-match-payoff-lane-action={matchPayoffLaneAction(lane)}
                                                    data-match-payoff-lane-audio={getBoardFloaterPayoffLaneAudioCue(lane)}
                                                    data-match-payoff-lane-beats={getBoardFloaterPayoffLaneBeatCount(lane)}
                                                    data-match-payoff-lane-count={lane.count}
                                                    data-match-payoff-lane-screen-cue={getBoardFloaterPayoffLaneScreenCue(lane)}
                                                    data-match-payoff-lane-tone={lane.tone}
                                                    key={lane.id}
                                                >
                                                    <small>{lane.label}</small>
                                                    {lane.count > 1 ? <b>x{lane.count}</b> : null}
                                                    <em>{lane.cue}</em>
                                                    <strong>{matchPayoffLaneAction(lane)}</strong>
                                                    <span aria-hidden="true" className={styles.boardFloaterPayoffLaneBeatPips}>
                                                        {Array.from({ length: getBoardFloaterPayoffLaneBeatCount(lane) }, (_, index) => (
                                                            <i
                                                                data-match-payoff-lane-beat={index + 1}
                                                                data-match-payoff-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={`${lane.id}-payoff-lane-beat-${index + 1}`}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.payoffLadder ? (
                                        <span
                                            aria-label={`Match payoff ladder. First: ${boardFloaterPayload.payoffLadder.first}. Then: ${boardFloaterPayload.payoffLadder.then}. Keep: ${boardFloaterPayload.payoffLadder.keep}.${
                                                boardFloaterPayload.payoffLadder.lanes?.length
                                                    ? ` Lanes: ${boardFloaterPayload.payoffLadder.lanes.join(' to ')}.`
                                                    : ''
                                            }`}
                                            className={styles.boardFloaterPayoffLadder}
                                            data-match-payoff-ladder-audio={getBoardFloaterPayoffLadderAudioCue(
                                                boardFloaterPayload.payoffLadder
                                            )}
                                            data-match-payoff-ladder-beats={getBoardFloaterPayoffLadderBeatCount(
                                                boardFloaterPayload.payoffLadder
                                            )}
                                            data-match-payoff-ladder-lanes={
                                                boardFloaterPayload.payoffLadder.lanes?.join('|') ?? undefined
                                            }
                                            data-match-payoff-ladder-screen-cue={getBoardFloaterPayoffLadderScreenCue(
                                                boardFloaterPayload.payoffLadder
                                            )}
                                            data-match-payoff-ladder-tone={boardFloaterPayload.payoffLadder.tone}
                                            data-testid="match-score-floater-payoff-ladder"
                                        >
                                            <span
                                                className={styles.boardFloaterPayoffLadderSummary}
                                                data-match-payoff-ladder-count={boardFloaterPayload.payoffLadder.lanes?.length ?? 0}
                                                data-testid="match-score-floater-payoff-ladder-summary"
                                            >
                                                <small>Ladder</small>
                                                <b>
                                                    {(boardFloaterPayload.payoffLadder.lanes?.length ?? 0) > 0
                                                        ? `${boardFloaterPayload.payoffLadder.lanes!.length} lanes`
                                                        : 'No lanes'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterPayoffLadderSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, (boardFloaterPayload.payoffLadder.lanes?.length ?? 0) + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-match-payoff-ladder-summary-beat={index + 1}
                                                                data-match-payoff-ladder-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`payoff-ladder-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                            <small>First</small>
                                            <b data-match-payoff-ladder-step="first">{boardFloaterPayload.payoffLadder.first}</b>
                                            <small>Then</small>
                                            <b data-match-payoff-ladder-step="then">{boardFloaterPayload.payoffLadder.then}</b>
                                            <small>Keep</small>
                                            <b data-match-payoff-ladder-step="keep">{boardFloaterPayload.payoffLadder.keep}</b>
                                            {boardFloaterPayload.payoffLadder.lanes?.length ? (
                                                <span className={styles.boardFloaterPayoffLaneStrip}>
                                                    {boardFloaterPayload.payoffLadder.lanes.map((lane, index) => (
                                                        <i data-match-payoff-lane-index={index + 1} key={`${lane}-${index}`}>
                                                            {lane}
                                                        </i>
                                                    ))}
                                                </span>
                                            ) : null}
                                            <span aria-hidden="true" className={styles.boardFloaterPayoffLadderBeatPips}>
                                                {Array.from(
                                                    {
                                                        length: getBoardFloaterPayoffLadderBeatCount(
                                                            boardFloaterPayload.payoffLadder
                                                        )
                                                    },
                                                    (_, index) => (
                                                        <i
                                                            data-match-payoff-ladder-beat={index + 1}
                                                            data-match-payoff-ladder-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`payoff-ladder-beat-${index + 1}`}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' ? (
                                        <span className={styles.boardFloaterScore}>
                                            {boardFloaterPayload.routeRewardText ??
                                                `+${boardFloaterPayload.amount.toLocaleString()}`}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterPayload.chainDepth >= 3 ? (
                                        <span
                                            className={styles.boardFloaterStreak}
                                            data-chain-streak-depth={boardFloaterPayload.chainDepth}
                                        >
                                            <span className={styles.boardFloaterStreakPips} aria-hidden="true">
                                                {Array.from(
                                                    { length: Math.min(5, boardFloaterPayload.chainDepth) },
                                                    (_, index) => (
                                                        <i
                                                            data-chain-streak-beat={index + 1}
                                                            data-chain-streak-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`board-streak-beat-${index + 1}`}
                                                        />
                                                )
                                            )}
                                        </span>
                                            <span className={styles.boardFloaterStreakText}>x{boardFloaterPayload.chainDepth} streak</span>
                                            {boardFloaterChainCue ? (
                                                <span className={styles.boardFloaterStreakCue}>
                                                    <span aria-hidden="true" className={styles.boardFloaterStreakCuePips}>
                                                        {Array.from(
                                                            { length: Math.min(5, Math.max(2, boardFloaterPayload.chainDepth)) },
                                                            (_, index) => (
                                                                <i
                                                                    data-chain-streak-cue-beat={index + 1}
                                                                    data-chain-streak-cue-beat-focus={
                                                                        index === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={`board-streak-cue-beat-${index + 1}`}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                    {boardFloaterChainCue}
                                                </span>
                                            ) : null}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' &&
                                    (boardFloaterPayload.chainRewardForecastCues?.length ?? 0) > 0 ? (
                                        <span
                                            aria-label={`Match score floater reward forecast. ${boardFloaterPayload.chainRewardForecastCues!
                                                .slice(0, 3)
                                                .map((cue) => {
                                                    const stackLabel = getChainRewardStackLabel(cue);
                                                    const progress = getChainRewardProgress(boardFloaterPayload.chainDepth, cue);

                                                    return `${cue.chaseLabel}: ${cue.actionLabel}: ${getChainRewardLaneAction(cue.urgency)}: ${cue.label}: ${cue.distanceLabel}: ${getChainRewardUrgencyCopy(cue)}${
                                                        progress ? `: ${progress.label}: ${progress.remainingLabel}` : ''
                                                    }${stackLabel ? `: ${stackLabel}` : ''}`;
                                                })
                                                .join('. ')}.`}
                                            className={styles.boardFloaterRewardForecast}
                                            data-testid="match-score-floater-reward-forecast"
                                        >
                                            <span
                                                className={styles.boardFloaterRewardForecastSummary}
                                                data-chain-reward-forecast-count={boardFloaterPayload.chainRewardForecastCues!.slice(0, 3).length}
                                                data-testid="match-score-floater-reward-forecast-summary"
                                            >
                                                <small>Forecast</small>
                                                <b>
                                                    {boardFloaterPayload.chainRewardForecastCues!.slice(0, 3).length}{' '}
                                                    {boardFloaterPayload.chainRewardForecastCues!.slice(0, 3).length === 1 ? 'reward' : 'rewards'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterRewardForecastSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, boardFloaterPayload.chainRewardForecastCues!.slice(0, 3).length + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-chain-reward-forecast-summary-beat={index + 1}
                                                                data-chain-reward-forecast-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`reward-forecast-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                            {boardFloaterPayload.chainRewardForecastCues!.slice(0, 3).map((cue) => {
                                                const stackLabel = getChainRewardStackLabel(cue);
                                                const progress = getChainRewardProgress(boardFloaterPayload.chainDepth, cue);
                                                const beatCount = getBoardFloaterRewardForecastBeatCount(cue);

                                                return (
                                                    <span
                                                        data-chain-reward-arcade-cue={getChainRewardUrgencyCopy(cue)}
                                                        data-chain-reward-audio={getBoardFloaterRewardForecastAudioCue(cue)}
                                                        data-chain-reward-beats={beatCount}
                                                        data-chain-reward-distance={cue.distance}
                                                        data-chain-reward-lane-action={getChainRewardLaneAction(cue.urgency)}
                                                        data-chain-reward-progress={progress?.label ?? 'none'}
                                                        data-chain-reward-screen-cue={getBoardFloaterRewardForecastScreenCue(cue)}
                                                        data-chain-reward-stack-size={cue.stackSize ?? 1}
                                                        data-chain-reward-tone={cue.tone}
                                                        data-chain-reward-urgency={cue.urgency}
                                                        key={cue.id}
                                                    >
                                                        <strong>{cue.chaseLabel}</strong>
                                                        <small>{cue.actionLabel}</small>
                                                        <u>{getChainRewardLaneAction(cue.urgency)}</u>
                                                        <b>{cue.label}</b>
                                                        <em>{cue.distanceLabel}</em>
                                                        <i>{getChainRewardUrgencyCopy(cue)}</i>
                                                        {progress ? (
                                                            <span className={styles.boardFloaterRewardProgress}>
                                                                {progress.label}
                                                            </span>
                                                        ) : null}
                                                        {stackLabel ? (
                                                            <>
                                                                <mark>{stackLabel}</mark>
                                                                <span aria-hidden="true" className={styles.boardFloaterRewardStackPips}>
                                                                    {Array.from({ length: cue.stackSize ?? 1 }, (_, index) => (
                                                                        <i
                                                                            data-chain-reward-stack-beat={index + 1}
                                                                            data-chain-reward-stack-beat-focus={
                                                                                index === 0 ? 'primary' : 'support'
                                                                            }
                                                                            key={`${cue.id}-board-reward-stack-${index + 1}`}
                                                                        />
                                                                    ))}
                                                                </span>
                                                            </>
                                                        ) : null}
                                                        <span aria-hidden="true" className={styles.boardFloaterRewardBeatPips}>
                                                            {Array.from({ length: beatCount }, (_, index) => (
                                                                <i
                                                                    data-chain-reward-beat={index + 1}
                                                                    data-chain-reward-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                    key={`${cue.id}-board-reward-beat-${index + 1}`}
                                                                />
                                                            ))}
                                                        </span>
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' &&
                                    (boardFloaterPayload.payoffChips?.length ?? 0) > 0 ? (
                                        <span
                                            aria-label={`Match score payoff chips. ${boardFloaterPayload.payoffChips!
                                                .map((chip) => `${chip.arcadeCue ? `${chip.arcadeCue}: ` : ''}${chip.label}: ${chip.value}`)
                                                .join('. ')}.`}
                                            className={styles.boardFloaterPayoffChips}
                                            data-testid="match-score-floater-payoff-chips"
                                        >
                                            {boardFloaterPayload.payoffChips!.map((chip) => (
                                                <span
                                                    data-match-payoff-arcade-cue={chip.arcadeCue ?? 'none'}
                                                    data-match-payoff-arcade-screen-cue={getMatchPayoffChipScreenCue(chip)}
                                                    data-match-payoff-audio={getMatchPayoffChipAudioCue(chip)}
                                                    data-match-payoff-beats={getMatchPayoffChipBeatCount(chip)}
                                                    data-match-payoff-id={chip.id}
                                                    data-match-payoff-screen-cue={getMatchPayoffChipScreenCue(chip)}
                                                    data-match-payoff-tone={chip.tone}
                                                    key={chip.id}
                                                >
                                                    {chip.arcadeCue ? <em>{chip.arcadeCue}</em> : null}
                                                    <small>{chip.label}</small>
                                                    <b>{chip.value}</b>
                                                    <span className={styles.boardFloaterChipBeats} aria-hidden="true">
                                                        {Array.from({ length: getMatchPayoffChipBeatCount(chip) }, (_, index) => (
                                                            <i
                                                                data-match-payoff-chip-beat={index + 1}
                                                                data-match-payoff-chip-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={`match-payoff-chip-beat-${chip.id}-${index + 1}`}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'match' && boardFloaterTraitLaneMap.length > 1 ? (
                                        <span
                                            aria-label={formatTraitInteractionLaneMapLabel(
                                                'Match trait interaction lanes',
                                                boardFloaterTraitLaneMap
                                            )}
                                            className={styles.boardFloaterTraitLaneMap}
                                            data-match-trait-lane-actions={boardFloaterTraitLaneActionMapAttr}
                                            data-match-trait-lane-map={boardFloaterTraitLaneMapAttr}
                                            data-match-trait-primary-lane={boardFloaterPrimaryTraitLane?.id ?? 'none'}
                                            data-match-trait-primary-lane-action={
                                                boardFloaterPrimaryTraitLane
                                                    ? getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)
                                                    : 'none'
                                            }
                                            data-match-trait-primary-lane-audio={
                                                boardFloaterPrimaryTraitLane
                                                    ? getBoardFloaterTraitLaneAudioCue(boardFloaterPrimaryTraitLane)
                                                    : 'none'
                                            }
                                            data-match-trait-primary-lane-beats={
                                                boardFloaterPrimaryTraitLane
                                                    ? getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane)
                                                    : 0
                                            }
                                            data-match-trait-primary-lane-cue={boardFloaterPrimaryTraitLane?.cue ?? 'none'}
                                            data-match-trait-primary-lane-screen-cue={
                                                boardFloaterPrimaryTraitLane
                                                    ? getBoardFloaterTraitLaneScreenCue(boardFloaterPrimaryTraitLane)
                                                    : 'none'
                                            }
                                            data-testid="match-score-floater-trait-lane-map"
                                        >
                                            <span
                                                className={styles.boardFloaterTraitLaneMapSummary}
                                                data-match-trait-lane-count={boardFloaterTraitLaneMap.length}
                                                data-testid="match-score-floater-trait-lane-map-summary"
                                            >
                                                <small>Traits</small>
                                                <b>
                                                    {boardFloaterTraitLaneMap.length}{' '}
                                                    {boardFloaterTraitLaneMap.length === 1 ? 'lane' : 'lanes'}
                                                </b>
                                                <span aria-hidden="true" className={styles.boardFloaterTraitLaneMapSummaryBeatPips}>
                                                    {Array.from(
                                                        { length: Math.max(2, Math.min(5, boardFloaterTraitLaneMap.length + 1)) },
                                                        (_, index) => (
                                                            <i
                                                                data-match-trait-lane-map-summary-beat={index + 1}
                                                                data-match-trait-lane-map-summary-beat-focus={
                                                                    index === 0 ? 'primary' : 'support'
                                                                }
                                                                key={`trait-lane-map-summary-beat-${index + 1}`}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                            {boardFloaterPrimaryTraitLane ? (
                                                <span
                                                    aria-label={`Primary trait payoff lane. ${boardFloaterPrimaryTraitLane.label}: ${getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)}. ${boardFloaterPrimaryTraitLane.cue}. ${getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane)} beats.`}
                                                    className={styles.boardFloaterPrimaryTraitLane}
                                                    data-match-trait-primary-lane={boardFloaterPrimaryTraitLane.id}
                                                    data-match-trait-primary-lane-action={getTraitInteractionLaneAction(
                                                        boardFloaterPrimaryTraitLane.id
                                                    )}
                                                    data-match-trait-primary-lane-audio={getBoardFloaterTraitLaneAudioCue(
                                                        boardFloaterPrimaryTraitLane
                                                    )}
                                                    data-match-trait-primary-lane-beats={getBoardFloaterTraitLaneBeatCount(
                                                        boardFloaterPrimaryTraitLane
                                                    )}
                                                    data-match-trait-primary-lane-cue={boardFloaterPrimaryTraitLane.cue}
                                                    data-match-trait-primary-lane-screen-cue={getBoardFloaterTraitLaneScreenCue(
                                                        boardFloaterPrimaryTraitLane
                                                    )}
                                                    data-testid="match-score-floater-primary-trait-lane"
                                                >
                                                    <small>Trait focus</small>
                                                    <b>{boardFloaterPrimaryTraitLane.label}</b>
                                                    <strong>{getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)}</strong>
                                                    <em>{boardFloaterPrimaryTraitLane.cue}</em>
                                                    <span aria-hidden="true" className={styles.boardFloaterPrimaryTraitLaneBeatPips}>
                                                        {Array.from(
                                                            { length: getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane) },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-match-trait-primary-lane-beat={beatIndex + 1}
                                                                    data-match-trait-primary-lane-beat-focus={
                                                                        beatIndex === 0 ? 'primary' : 'support'
                                                                    }
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ) : null}
                                            {boardFloaterTraitLaneMap.map((lane) => (
                                                <span
                                                    data-match-trait-lane={lane.id}
                                                    data-match-trait-lane-action={getTraitInteractionLaneAction(lane.id)}
                                                    data-match-trait-lane-audio={getBoardFloaterTraitLaneAudioCue(lane)}
                                                    data-match-trait-lane-beats={getBoardFloaterTraitLaneBeatCount(lane)}
                                                    data-match-trait-lane-count={lane.count}
                                                    data-match-trait-lane-screen-cue={getBoardFloaterTraitLaneScreenCue(lane)}
                                                    key={lane.id}
                                                >
                                                    <small>{lane.label}</small>
                                                    {lane.count > 1 ? <b>x{lane.count}</b> : null}
                                                    <strong>{getTraitInteractionLaneAction(lane.id)}</strong>
                                                    <em>{lane.cue}</em>
                                                    <span aria-hidden="true" className={styles.boardFloaterTraitLaneBeatPips}>
                                                        {Array.from({ length: getBoardFloaterTraitLaneBeatCount(lane) }, (_, index) => (
                                                            <i
                                                                data-match-trait-lane-beat={index + 1}
                                                                data-match-trait-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={`${lane.id}-trait-lane-beat-${index + 1}`}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterDetailLines.slice(0, 2).map((line) => (
                                        <span className={styles.boardFloaterTraitLine} key={line}>
                                            {line}
                                        </span>
                                    ))}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecovery ? (
                                        <span
                                            className={styles.boardFloaterRecoveryHint}
                                            data-testid="mismatch-score-floater-recovery"
                                        >
                                            {boardFloaterMismatchRecovery}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchNextAction ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchNextAction.arcadeCue}: ${boardFloaterMismatchNextAction.label}: ${boardFloaterMismatchNextAction.value}`}
                                            className={styles.boardFloaterNextAction}
                                            data-mismatch-next-action-cue={boardFloaterMismatchNextAction.arcadeCue}
                                            data-mismatch-next-action={boardFloaterMismatchNextAction.tone}
                                            data-testid="mismatch-score-floater-next-action"
                                        >
                                            <em>{boardFloaterMismatchNextAction.arcadeCue}</em>
                                            <small>{boardFloaterMismatchNextAction.label}</small>
                                            <b>{boardFloaterMismatchNextAction.value}</b>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryBurst ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchRecoveryBurst.label}: ${boardFloaterMismatchRecoveryBurst.value}`}
                                            className={styles.boardFloaterRecoveryBurst}
                                            data-recovery-burst-tier={boardFloaterMismatchRecoveryBurst.tier}
                                            data-testid="mismatch-score-floater-recovery-burst"
                                        >
                                            <small>{boardFloaterMismatchRecoveryBurst.label}</small>
                                            <b>{boardFloaterMismatchRecoveryBurst.value}</b>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryCrescendo ? (
                                        <span
                                            aria-label={boardFloaterMismatchRecoveryCrescendoLabel}
                                            className={styles.boardFloaterRecoveryCrescendo}
                                            data-mismatch-recovery-crescendo-screen-cue={
                                                boardFloaterMismatchRecoveryCrescendo.screenCue
                                            }
                                            data-mismatch-recovery-crescendo-tier={
                                                boardFloaterMismatchRecoveryCrescendo.tier
                                            }
                                            data-testid="mismatch-score-floater-recovery-crescendo"
                                        >
                                            <small>{boardFloaterMismatchRecoveryCrescendo.label}</small>
                                            <strong>
                                                {Array.from({ length: boardFloaterMismatchRecoveryCrescendo.beatCount }).map(
                                                    (_, index) => (
                                                        <i aria-hidden="true" key={`mismatch-recovery-beat-${index}`} />
                                                    )
                                                )}
                                            </strong>
                                            <em>{boardFloaterMismatchRecoveryCrescendo.detail}</em>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryStack ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchRecoveryStack.label}: ${boardFloaterMismatchRecoveryStack.value}. ${boardFloaterMismatchRecoveryStack.detail}`}
                                            className={styles.boardFloaterRecoveryStack}
                                            data-mismatch-recovery-stack={boardFloaterMismatchRecoveryStack.tone}
                                            data-testid="mismatch-score-floater-recovery-stack"
                                        >
                                            <small>{boardFloaterMismatchRecoveryStack.label}</small>
                                            <b>{boardFloaterMismatchRecoveryStack.value}</b>
                                            <em>{boardFloaterMismatchRecoveryStack.detail}</em>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoverySequence ? (
                                        <span
                                            aria-label={`${boardFloaterMismatchRecoverySequence.label}. First: ${boardFloaterMismatchRecoverySequence.first}. Then: ${boardFloaterMismatchRecoverySequence.then}. Keep: ${boardFloaterMismatchRecoverySequence.keep}.`}
                                            className={styles.boardFloaterRecoverySequence}
                                            data-mismatch-recovery-sequence={boardFloaterMismatchRecoverySequence.tone}
                                            data-mismatch-sequence-first={boardFloaterMismatchRecoverySequence.first}
                                            data-mismatch-sequence-keep={boardFloaterMismatchRecoverySequence.keep}
                                            data-mismatch-sequence-then={boardFloaterMismatchRecoverySequence.then}
                                            data-testid="mismatch-score-floater-recovery-sequence"
                                        >
                                            <small>First</small>
                                            <b>{boardFloaterMismatchRecoverySequence.first}</b>
                                            <small>Then</small>
                                            <b>{boardFloaterMismatchRecoverySequence.then}</b>
                                            <small>Keep</small>
                                            <b>{boardFloaterMismatchRecoverySequence.keep}</b>
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryLaneMap ? (
                                        <span
                                            aria-label={mismatchRecoveryLaneMapLabel(boardFloaterMismatchRecoveryLaneMap)}
                                            className={styles.boardFloaterRecoveryLaneMap}
                                            data-mismatch-recovery-lane-actions={mismatchRecoveryLaneActionMapAttr(
                                                boardFloaterMismatchRecoveryLaneMap
                                            )}
                                            data-mismatch-recovery-lane-map={mismatchRecoveryLaneMapAttr(boardFloaterMismatchRecoveryLaneMap)}
                                            data-mismatch-recovery-primary-lane={boardFloaterPrimaryMismatchRecoveryLane?.id ?? 'none'}
                                            data-mismatch-recovery-primary-lane-action={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 'none'
                                            }
                                            data-mismatch-recovery-primary-lane-audio={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? getMismatchRecoveryLaneAudioCue(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 'none'
                                            }
                                            data-mismatch-recovery-primary-lane-beats={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 0
                                            }
                                            data-mismatch-recovery-primary-lane-cue={boardFloaterPrimaryMismatchRecoveryLane?.cue ?? 'none'}
                                            data-mismatch-recovery-primary-lane-screen-cue={
                                                boardFloaterPrimaryMismatchRecoveryLane
                                                    ? getMismatchRecoveryLaneScreenCue(boardFloaterPrimaryMismatchRecoveryLane)
                                                    : 'none'
                                            }
                                            data-testid="mismatch-score-floater-recovery-lane-map"
                                        >
                                            {boardFloaterPrimaryMismatchRecoveryLane ? (
                                                <span
                                                    aria-label={`Primary recovery lane. ${boardFloaterPrimaryMismatchRecoveryLane.label}: ${mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)}. ${boardFloaterPrimaryMismatchRecoveryLane.cue}. ${getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane)} beats.`}
                                                    className={styles.boardFloaterRecoveryPrimaryLane}
                                                    data-mismatch-recovery-primary-lane={boardFloaterPrimaryMismatchRecoveryLane.id}
                                                    data-mismatch-recovery-primary-lane-action={mismatchRecoveryLaneAction(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-mismatch-recovery-primary-lane-audio={getMismatchRecoveryLaneAudioCue(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-mismatch-recovery-primary-lane-beats={getMismatchRecoveryLaneBeatCount(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-mismatch-recovery-primary-lane-cue={boardFloaterPrimaryMismatchRecoveryLane.cue}
                                                    data-mismatch-recovery-primary-lane-screen-cue={getMismatchRecoveryLaneScreenCue(
                                                        boardFloaterPrimaryMismatchRecoveryLane
                                                    )}
                                                    data-testid="mismatch-score-floater-primary-recovery-lane"
                                                >
                                                    <small>Recovery focus</small>
                                                    <b>{boardFloaterPrimaryMismatchRecoveryLane.label}</b>
                                                    <strong>
                                                        {mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)}
                                                    </strong>
                                                    <em>{boardFloaterPrimaryMismatchRecoveryLane.cue}</em>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.boardFloaterRecoveryPrimaryLaneBeatPips}
                                                    >
                                                        {Array.from(
                                                            {
                                                                length: getMismatchRecoveryLaneBeatCount(
                                                                    boardFloaterPrimaryMismatchRecoveryLane
                                                                )
                                                            },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-mismatch-recovery-primary-lane-beat={beatIndex + 1}
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ) : null}
                                            {boardFloaterMismatchRecoveryLaneMap.map((lane) => (
                                                <span
                                                    data-mismatch-recovery-lane={lane.id}
                                                    data-mismatch-recovery-lane-action={mismatchRecoveryLaneAction(lane)}
                                                    data-mismatch-recovery-lane-audio={getMismatchRecoveryLaneAudioCue(lane)}
                                                    data-mismatch-recovery-lane-beats={getMismatchRecoveryLaneBeatCount(lane)}
                                                    data-mismatch-recovery-lane-count={lane.count}
                                                    data-mismatch-recovery-lane-screen-cue={getMismatchRecoveryLaneScreenCue(lane)}
                                                    key={lane.id}
                                                >
                                                    <small>{lane.label}</small>
                                                    <b>{lane.count}</b>
                                                    <strong>{mismatchRecoveryLaneAction(lane)}</strong>
                                                    <em>{lane.cue}</em>
                                                    <span
                                                        aria-hidden="true"
                                                        className={styles.boardFloaterRecoveryLaneBeatPips}
                                                    >
                                                        {Array.from(
                                                            { length: getMismatchRecoveryLaneBeatCount(lane) },
                                                            (_, beatIndex) => (
                                                                <i
                                                                    data-mismatch-recovery-lane-beat={beatIndex + 1}
                                                                    key={beatIndex}
                                                                />
                                                            )
                                                        )}
                                                    </span>
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                    {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryChips.length > 0 ? (
                                        <span
                                            className={styles.boardFloaterRecoveryChips}
                                            data-testid="mismatch-score-floater-recovery-chips"
                                        >
                                            {boardFloaterMismatchRecoveryChips.map((chip) => (
                                                <span
                                                    aria-label={`${chip.arcadeCue}: ${chip.label}: ${chip.value}`}
                                                    data-mismatch-recovery-chip={chip.tone}
                                                    data-mismatch-recovery-chip-audio={getMismatchRecoveryChipAudioCue(chip)}
                                                    data-mismatch-recovery-chip-beats={getMismatchRecoveryChipBeatCount(chip)}
                                                    data-mismatch-recovery-chip-cue={chip.arcadeCue}
                                                    data-mismatch-recovery-chip-screen-cue={getMismatchRecoveryChipScreenCue(chip)}
                                                    data-mismatch-recovery-urgency={chip.urgency ?? 'none'}
                                                    key={chip.id}
                                                >
                                                    <em>{chip.arcadeCue}</em>
                                                    <small>{chip.label}</small>
                                                    <b>{chip.value}</b>
                                                    <span className={styles.boardFloaterChipBeats} aria-hidden="true">
                                                        {Array.from({ length: getMismatchRecoveryChipBeatCount(chip) }, (_, index) => (
                                                            <i
                                                                data-mismatch-recovery-chip-beat={index + 1}
                                                                key={`mismatch-recovery-chip-beat-${chip.id}-${index + 1}`}
                                                            />
                                                        ))}
                                                    </span>
                                                </span>
                                            ))}
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
                        subtitle={`Level ${run.lastLevelResult.level} cleared. Score +${run.lastLevelResult.scoreGained}. Try Daily or Scholar contract from the menu for different goals.`}
                        title="Floor cleared"
                    >
                        <div
                            className={styles.floorClearResultStack}
                            data-route-choice-required={routeChoiceRequired ? 'true' : 'false'}
                            data-testid="floor-clear-result-stack"
                        >
                            {floorClearMomentumRows.length > 0 ? (
                                <div
                                    aria-label={floorClearMomentumRowsLabel}
                                    className={styles.floorClearMomentumStrip}
                                    data-testid="floor-clear-momentum-strip"
                                >
                                    {floorClearMomentumRows.map((row) => (
                                        <span className={styles.floorClearMomentumChip} data-momentum-kind={row.id} key={row.id}>
                                            <small>{row.label}</small>
                                            <strong>{row.value}</strong>
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {floorClearPayoffStackSignal ? (
                                <div
                                    aria-label={`${floorClearPayoffStackSignal.label}: ${floorClearPayoffStackSignal.value}. ${getFloorClearPayoffStackAction(
                                        floorClearPayoffStackSignal
                                    )}. ${getFloorClearPayoffStackBeatCount(floorClearPayoffStackSignal)} beats. ${
                                        floorClearPayoffStackSignal.detail
                                    }`}
                                    className={styles.floorClearPayoffStackSignal}
                                    data-floor-payoff-stack-action={getFloorClearPayoffStackAction(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-audio={getFloorClearPayoffStackAudioCue(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-beats={getFloorClearPayoffStackBeatCount(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-screen-cue={getFloorClearPayoffStackScreenCue(floorClearPayoffStackSignal)}
                                    data-floor-payoff-stack-tone={floorClearPayoffStackSignal.tone}
                                    data-testid="floor-clear-payoff-stack"
                                >
                                    <small>{floorClearPayoffStackSignal.label}</small>
                                    <strong>{floorClearPayoffStackSignal.value}</strong>
                                    <span aria-hidden="true" className={styles.floorClearPayoffStackBeatPips}>
                                        {Array.from(
                                            { length: getFloorClearPayoffStackBeatCount(floorClearPayoffStackSignal) },
                                            (_, index) => (
                                                <i
                                                    data-floor-payoff-stack-beat={index + 1}
                                                    data-floor-payoff-stack-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            )
                                        )}
                                    </span>
                                    <b>{getFloorClearPayoffStackAction(floorClearPayoffStackSignal)}</b>
                                    <em>{floorClearPayoffStackSignal.detail}</em>
                                </div>
                            ) : null}
                            {floorClearCashoutRows.length > 0 ? (
                                <div
                                    aria-label={floorClearCashoutRowsLabel}
                                    className={styles.floorClearCashoutStrip}
                                    data-testid="floor-clear-cashout-strip"
                                >
                                    {floorClearCashoutRows.map((row) => (
                                        <span data-cashout-tone={row.tone} key={row.id}>
                                            <small>{row.label}</small>
                                            <strong>{row.value}</strong>
                                            <em>{row.detail}</em>
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            {floorClearCarryForwardCue ? (
                                <div
                                    aria-label={`${floorClearCarryForwardCue.label}: ${floorClearCarryForwardCue.value}. ${floorClearCarryForwardCue.detail}`}
                                    className={styles.floorClearCarryForwardCue}
                                    data-carry-forward-tone={floorClearCarryForwardCue.tone}
                                    data-testid="floor-clear-carry-forward"
                                >
                                    <small>{floorClearCarryForwardCue.label}</small>
                                    <strong>{floorClearCarryForwardCue.value}</strong>
                                    <em>{floorClearCarryForwardCue.detail}</em>
                                </div>
                            ) : null}
                            {floorClearActionSequenceCue ? (
                                <div
                                    aria-label={`${floorClearActionSequenceCue.label}. First: ${floorClearActionSequenceCue.first}. Then: ${floorClearActionSequenceCue.then}. Keep: ${floorClearActionSequenceCue.keep}.`}
                                    className={styles.floorClearActionSequenceCue}
                                    data-floor-clear-sequence-first={floorClearActionSequenceCue.first}
                                    data-floor-clear-sequence-keep={floorClearActionSequenceCue.keep}
                                    data-floor-clear-sequence-then={floorClearActionSequenceCue.then}
                                    data-floor-clear-sequence-tone={floorClearActionSequenceCue.tone}
                                    data-testid="floor-clear-action-sequence"
                                >
                                    <small>{floorClearActionSequenceCue.label}</small>
                                    <span>
                                        <b>First</b>
                                        <strong>{floorClearActionSequenceCue.first}</strong>
                                    </span>
                                    <span>
                                        <b>Then</b>
                                        <strong>{floorClearActionSequenceCue.then}</strong>
                                    </span>
                                    <span>
                                        <b>Keep</b>
                                        <strong>{floorClearActionSequenceCue.keep}</strong>
                                    </span>
                                </div>
                            ) : null}
                            {floorClearObjectiveSignalRows.length > 0 ? (
                                <div
                                    aria-label={floorClearObjectiveSignalRowsLabel}
                                    className={styles.floorClearObjectiveStrip}
                                    data-testid="floor-clear-objective-strip"
                                >
                                    {floorClearObjectiveSignalRows.map((row) => {
                                        const beatCount = getFloorClearObjectiveSignalBeatCount(row);
                                        return (
                                            <span
                                                data-objective-audio={getFloorClearObjectiveSignalAudioCue(row)}
                                                data-objective-beats={beatCount}
                                                data-objective-screen-cue={getFloorClearObjectiveSignalScreenCue(row)}
                                                data-objective-tone={row.tone}
                                                key={row.id}
                                            >
                                                <small>{row.label}</small>
                                                <strong>{row.value}</strong>
                                                <span
                                                    aria-hidden="true"
                                                    className={styles.floorClearObjectiveBeatPips}
                                                >
                                                    {Array.from({ length: beatCount }, (_, index) => (
                                                        <i
                                                            data-objective-beat={index + 1}
                                                            data-objective-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : null}
                            {floorClearCausalityRows.length > 0 ? (
                                <div
                                    aria-label={floorClearCausalityRowsLabel}
                                    className={styles.floorClearCausalityGrid}
                                    data-testid="floor-clear-causality-grid"
                                >
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
                            {nextFloorSignalRows.length > 0 ? (
                                <div
                                    aria-label={nextFloorSignalRowsLabel}
                                    className={styles.floorClearNextSignalStrip}
                                    data-testid="floor-clear-next-signal-strip"
                                >
                                    {nextFloorSignalRows.map((row) => {
                                        const beatCount = getNextFloorSignalBeatCount(row);
                                        return (
                                            <span
                                                data-next-audio={getNextFloorSignalAudioCue(row)}
                                                data-next-beats={beatCount}
                                                data-next-screen-cue={getNextFloorSignalScreenCue(row)}
                                                data-next-tone={row.tone}
                                                key={row.id}
                                            >
                                                <small>{row.label}</small>
                                                <strong>{row.value}</strong>
                                                <span aria-hidden="true" className={styles.floorClearNextBeatPips}>
                                                    {Array.from({ length: beatCount }, (_, index) => (
                                                        <i
                                                            data-next-beat={index + 1}
                                                            data-next-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                                {row.detail ? <em>{row.detail}</em> : null}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : null}
                            {currentDungeonNode ? (
                                <p className={styles.modalNote}>
                                    Cleared node: {currentDungeonNode.label}. Choose a connected room to shape the next board.
                                </p>
                            ) : null}
                        </div>
                        {pendingRouteLine && pendingRouteSignalLabels && pendingRouteImpactCue && pendingRouteActionCue && run.pendingRouteCardPlan ? (
                            <div
                                className={styles.routeSelectedNote}
                                data-route-action-cue={pendingRouteActionCue.label}
                                data-route-action-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteActionCue.tone)}
                                data-route-action-cue-beats={getRouteChoiceToneBeatCount(pendingRouteActionCue.tone)}
                                data-route-action-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteActionCue.tone)}
                                data-route-action-cue-tone={pendingRouteActionCue.tone}
                                data-route-impact-cue={pendingRouteImpactCue.label}
                                data-route-impact-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteImpactCue.tone)}
                                data-route-impact-cue-beats={getRouteChoiceToneBeatCount(pendingRouteImpactCue.tone)}
                                data-route-impact-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteImpactCue.tone)}
                                data-route-impact-cue-tone={pendingRouteImpactCue.tone}
                                data-route-type={run.pendingRouteCardPlan.routeType}
                                data-testid="route-selected-note"
                            >
                                <span className={styles.routeSelectedCopy}>{pendingRouteLine}</span>
                                <span
                                    aria-label={`Selected route impact cue: ${pendingRouteImpactCue.label}: ${pendingRouteImpactCue.value}.`}
                                    className={styles.routeSelectedImpactCue}
                                    data-route-impact-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteImpactCue.tone)}
                                    data-route-impact-cue-beats={getRouteChoiceToneBeatCount(pendingRouteImpactCue.tone)}
                                    data-route-impact-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteImpactCue.tone)}
                                    data-route-impact-cue-tone={pendingRouteImpactCue.tone}
                                    data-testid="route-selected-impact-cue"
                                >
                                    <small>{pendingRouteImpactCue.label}</small>
                                    <strong>{pendingRouteImpactCue.value}</strong>
                                        <span aria-hidden="true" className={styles.routeSelectedBeatPips}>
                                            {Array.from(
                                                { length: getRouteChoiceToneBeatCount(pendingRouteImpactCue.tone) },
                                                (_, index) => (
                                                <i
                                                    data-route-impact-cue-beat={index + 1}
                                                    data-route-impact-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                                )
                                            )}
                                        </span>
                                </span>
                                <span
                                    aria-label={`Selected route action cue: ${pendingRouteActionCue.label}: ${pendingRouteActionCue.value}. ${pendingRouteActionCue.detail}`}
                                    className={styles.routeSelectedActionCue}
                                    data-route-action-cue-audio={getRouteChoicePayoffAudioCue(pendingRouteActionCue.tone)}
                                    data-route-action-cue-beats={getRouteChoiceToneBeatCount(pendingRouteActionCue.tone)}
                                    data-route-action-cue-screen-cue={getRouteChoicePayoffScreenCue(pendingRouteActionCue.tone)}
                                    data-route-action-cue-tone={pendingRouteActionCue.tone}
                                    data-testid="route-selected-action-cue"
                                >
                                    <small>{pendingRouteActionCue.label}</small>
                                    <strong>{pendingRouteActionCue.value}</strong>
                                        <span aria-hidden="true" className={styles.routeSelectedBeatPips}>
                                            {Array.from(
                                                { length: getRouteChoiceToneBeatCount(pendingRouteActionCue.tone) },
                                                (_, index) => (
                                                <i
                                                    data-route-action-cue-beat={index + 1}
                                                    data-route-action-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                                )
                                            )}
                                        </span>
                                    <em>{pendingRouteActionCue.detail}</em>
                                </span>
                                <span className={styles.routeSelectedSignals}>
                                    <span
                                        data-route-signal="reward"
                                        data-route-signal-audio={getRouteChoiceSignalAudioCue('reward')}
                                        data-route-signal-beats={4}
                                        data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('reward')}
                                    >
                                        {pendingRouteSignalLabels.reward}
                                        <span aria-hidden="true" className={styles.routeSelectedSignalBeatPips}>
                                            {Array.from({ length: 4 }, (_, index) => (
                                                <i
                                                    data-route-signal-beat={index + 1}
                                                    data-route-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span
                                        data-route-signal="risk"
                                        data-route-signal-audio={getRouteChoiceSignalAudioCue('risk')}
                                        data-route-signal-beats={3}
                                        data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('risk')}
                                    >
                                        {pendingRouteSignalLabels.risk}
                                        <span aria-hidden="true" className={styles.routeSelectedSignalBeatPips}>
                                            {Array.from({ length: 3 }, (_, index) => (
                                                <i
                                                    data-route-signal-beat={index + 1}
                                                    data-route-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                </span>
                            </div>
                        ) : null}
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
                                {routeChoiceRecommendation ? (
                                    <span
                                        aria-label={`Recommended route. ${routeChoiceRecommendation.row.choiceLabel}. ${
                                            routeChoiceRecommendation.actionCue.action
                                        }. ${trimTerminalPunctuation(
                                            routeChoiceRecommendation.memoryChoice?.readinessLabel ??
                                                routeChoiceRecommendation.decisionStack.nextCue
                                        )}. ${routeChoiceRecommendation.beatCue.beatCount} beats. Primary payoff: ${
                                            routeChoiceRecommendation.primaryPayoff?.value ?? 'none'
                                        }.`}
                                        className={styles.dungeonMapChoiceRecommendation}
                                        data-route-recommendation-action={routeChoiceRecommendation.actionCue.action}
                                        data-route-recommendation-audio={routeChoiceRecommendation.beatCue.audioCue}
                                        data-route-recommendation-beats={routeChoiceRecommendation.beatCue.beatCount}
                                        data-route-recommendation-payoff={routeChoiceRecommendation.primaryPayoff?.value ?? 'none'}
                                        data-route-recommendation-route={routeChoiceRecommendation.row.routeType}
                                        data-route-recommendation-screen-cue={routeChoiceRecommendation.beatCue.screenCue}
                                        data-route-recommendation-tone={routeChoiceRecommendation.decisionStack.tone}
                                        data-testid="route-choice-recommendation"
                                    >
                                        <small>Recommended route</small>
                                        <strong>{routeChoiceRecommendation.row.choiceLabel}</strong>
                                        <em>{routeChoiceRecommendation.actionCue.action}</em>
                                        <span aria-hidden="true" className={styles.dungeonMapChoiceRecommendationBeatPips}>
                                            {Array.from({ length: routeChoiceRecommendation.beatCue.beatCount }, (_, index) => (
                                                <i
                                                    data-route-recommendation-beat={index + 1}
                                                    data-route-recommendation-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                        {routeChoiceRecommendation.primaryPayoff ? <b>{routeChoiceRecommendation.primaryPayoff.value}</b> : null}
                                    </span>
                                ) : null}
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
                                        const routeChoiceSignalLabels = getRouteChoiceSignalLabels(row.routeType);
                                        const routeChoicePayoffRows = getRouteChoicePayoffRows({
                                            memoryChoice,
                                            routeType: row.routeType
                                        });
                                        const primaryRouteChoicePayoff = routeChoicePayoffRows[0] ?? null;
                                        const routeChoiceDecisionStack = getRouteChoiceDecisionStack({
                                            memoryChoice,
                                            payoffRows: routeChoicePayoffRows,
                                            routeType: row.routeType,
                                            signalLabels: routeChoiceSignalLabels
                                        });
                                        const routeChoiceActionCue = getRouteChoiceActionCue({
                                            decisionStack: routeChoiceDecisionStack,
                                            memoryChoice,
                                            routeType: row.routeType
                                        });
                                        const routeChoiceBeatCue = getRouteChoiceBeatCue(row.routeType);
                                        const routeChoiceImpactCue = getRouteChoiceImpactCue({
                                            decisionStack: routeChoiceDecisionStack,
                                            routeType: row.routeType
                                        });
                                        const routeChoiceSignalsLabel = `Route choice ${row.routeType} signals. Reward: ${routeChoiceSignalLabels.reward}. Risk: ${routeChoiceSignalLabels.risk}.`;
                                        const routeChoicePayoffsLabel = formatGameplaySignalRowsLabel(
                                            `Route choice ${row.routeType} payoffs`,
                                            routeChoicePayoffRows
                                        );
                                        const routeChoiceDecisionStackLabel = `${routeChoiceDecisionStack.label}: ${routeChoiceDecisionStack.value}. ${routeChoiceDecisionStack.nextCue}.`;
                                        const routeChoiceActionCueLabel = `${routeChoiceActionCue.label}: ${routeChoiceActionCue.action}. ${trimTerminalPunctuation(routeChoiceActionCue.detail)}.`;
                                        const routeChoiceBeatCueLabel = `Route beat ${row.routeType}: ${routeChoiceBeatCue.label}. ${routeChoiceBeatCue.beatCount} beats. ${routeChoiceBeatCue.action}: ${routeChoiceBeatCue.detail}`;
                                        const routeChoiceRecipeSteps = [
                                            { id: 'first', label: 'First', value: routeChoiceActionCue.action },
                                            {
                                                id: 'payoff',
                                                label: 'Payoff',
                                                value:
                                                    routeChoicePayoffRows.find((payoff) => payoff.id === 'reward')?.value ??
                                                    routeChoiceSignalLabels.reward
                                            },
                                            {
                                                id: 'risk',
                                                label: memoryChoice ? 'Recall' : 'Risk',
                                                value:
                                                    memoryChoice?.readinessLabel ??
                                                    routeChoicePayoffRows.find((payoff) => payoff.id === 'risk')?.value ??
                                                    routeChoiceSignalLabels.risk
                                            },
                                            { id: 'keep', label: 'Keep', value: routeChoiceDecisionStack.nextCue.replace(/^First:\s*/i, '') }
                                        ];
                                        const routeChoiceRecipeValue = routeChoiceRecipeSteps.map((step) => step.value).join(' -> ');
                                        const routeChoiceRecipeLabel = `Route recipe ${row.routeType}. ${routeChoiceRecipeSteps
                                            .map((step) => `${step.label}: ${trimTerminalPunctuation(step.value)}`)
                                            .join('. ')}.`;
                                        const routeChoiceAriaLabel = [
                                            row.choiceLabel,
                                            `Impact cue: ${routeChoiceImpactCue.label}: ${routeChoiceImpactCue.value}`,
                                            `Route action: ${routeChoiceActionCue.action}: ${routeChoiceActionCue.detail}`,
                                            `Reward signal: ${routeChoiceSignalLabels.reward}`,
                                            `Risk signal: ${routeChoiceSignalLabels.risk}`,
                                            routeChoiceBeatCueLabel,
                                            routeChoiceRecipeLabel,
                                            routeChoiceDecisionStackLabel,
                                            ...routeChoicePayoffRows.map((payoff) => `${payoff.label}: ${payoff.value}`),
                                            row.approachLabel ? `Approach: ${row.approachLabel}` : null,
                                            `${row.nodeLabel}: ${row.mechanic}`,
                                            `Reward: ${row.reward}`,
                                            firstRouteTeachingLabel,
                                            memoryChoice ? `Memory: ${memoryChoice.memoryPrompt}` : null,
                                            memoryChoice ? `Recall: ${memoryChoice.readinessLabel}` : null,
                                            memoryChoice ? `Atmosphere: ${memoryChoice.atmosphericCue}` : null,
                                            availability.available ? `Risk: ${row.risk}` : availability.label
                                        ]
                                            .filter((part): part is string => Boolean(part))
                                            .join('. ');
                                        return (
                                            <button
                                                aria-label={routeChoiceAriaLabel}
                                                className={styles.dungeonMapRoomButton}
                                                disabled={!availability.available}
                                                data-route-beat-action={routeChoiceBeatCue.action}
                                                data-route-beat-audio={routeChoiceBeatCue.audioCue}
                                                data-route-beat-count={routeChoiceBeatCue.beatCount}
                                                data-route-beat-cue={routeChoiceBeatCue.label}
                                                data-route-beat-screen-cue={routeChoiceBeatCue.screenCue}
                                                data-route-beat-tier={routeChoiceBeatCue.tier}
                                                data-route-impact-cue={routeChoiceImpactCue.label}
                                                data-route-impact-cue-tone={routeChoiceImpactCue.tone}
                                                data-route-next-action={routeChoiceActionCue.action}
                                                data-route-next-action-tone={routeChoiceActionCue.tone}
                                                data-route-primary-payoff={primaryRouteChoicePayoff?.value ?? 'none'}
                                                data-route-primary-payoff-audio={
                                                    primaryRouteChoicePayoff
                                                        ? getRouteChoicePayoffAudioCue(primaryRouteChoicePayoff.tone)
                                                        : 'none'
                                                }
                                                data-route-primary-payoff-beats={
                                                    primaryRouteChoicePayoff ? getRouteChoiceToneBeatCount(primaryRouteChoicePayoff.tone) : 0
                                                }
                                                data-route-primary-payoff-id={primaryRouteChoicePayoff?.id ?? 'none'}
                                                data-route-primary-payoff-screen-cue={
                                                    primaryRouteChoicePayoff
                                                        ? getRouteChoicePayoffScreenCue(primaryRouteChoicePayoff.tone)
                                                        : 'none'
                                                }
                                                data-route-primary-payoff-tone={primaryRouteChoicePayoff?.tone ?? 'none'}
                                                data-route-recipe={routeChoiceRecipeValue}
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
                                                    <span
                                                        aria-label={`Route impact cue: ${routeChoiceImpactCue.label}: ${routeChoiceImpactCue.value}.`}
                                                        className={styles.dungeonMapRoomImpactCue}
                                                        data-route-impact-cue-tone={routeChoiceImpactCue.tone}
                                                        data-testid={`route-choice-${row.routeType}-impact-cue`}
                                                    >
                                                        <small>{routeChoiceImpactCue.label}</small>
                                                        <strong>{routeChoiceImpactCue.value}</strong>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceActionCueLabel}
                                                        className={styles.dungeonMapRoomActionCue}
                                                        data-route-action-tone={routeChoiceActionCue.tone}
                                                        data-testid={`route-choice-${row.routeType}-action-cue`}
                                                    >
                                                        <small>{routeChoiceActionCue.label}</small>
                                                        <strong>{routeChoiceActionCue.action}</strong>
                                                        <em>{routeChoiceActionCue.detail}</em>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceSignalsLabel}
                                                        className={styles.dungeonMapRoomSignalRow}
                                                        data-testid={`route-choice-${row.routeType}-signals`}
                                                    >
                                                        <span
                                                            data-route-signal="reward"
                                                            data-route-signal-audio={getRouteChoiceSignalAudioCue('reward')}
                                                            data-route-signal-beats={4}
                                                            data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('reward')}
                                                        >
                                                            {routeChoiceSignalLabels.reward}
                                                            <span aria-hidden="true" className={styles.dungeonMapRoomSignalBeatPips}>
                                                                {Array.from({ length: 4 }, (_, index) => (
                                                                    <i
                                                                        data-route-choice-signal-beat={index + 1}
                                                                        data-route-choice-signal-beat-focus={
                                                                            index === 0 ? 'primary' : 'support'
                                                                        }
                                                                        key={index}
                                                                    />
                                                                ))}
                                                            </span>
                                                        </span>
                                                        <span
                                                            data-route-signal="risk"
                                                            data-route-signal-audio={getRouteChoiceSignalAudioCue('risk')}
                                                            data-route-signal-beats={3}
                                                            data-route-signal-screen-cue={getRouteChoiceSignalScreenCue('risk')}
                                                        >
                                                            {routeChoiceSignalLabels.risk}
                                                            <span aria-hidden="true" className={styles.dungeonMapRoomSignalBeatPips}>
                                                                {Array.from({ length: 3 }, (_, index) => (
                                                                    <i
                                                                        data-route-choice-signal-beat={index + 1}
                                                                        data-route-choice-signal-beat-focus={
                                                                            index === 0 ? 'primary' : 'support'
                                                                        }
                                                                        key={index}
                                                                    />
                                                                ))}
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceBeatCueLabel}
                                                        className={styles.dungeonMapRoomBeatCue}
                                                        data-route-beat-action={routeChoiceBeatCue.action}
                                                        data-route-beat-audio={routeChoiceBeatCue.audioCue}
                                                        data-route-beat-screen-cue={routeChoiceBeatCue.screenCue}
                                                        data-route-beat-tier={routeChoiceBeatCue.tier}
                                                        data-testid={`route-choice-${row.routeType}-beat-cue`}
                                                    >
                                                        <small>{routeChoiceBeatCue.label}</small>
                                                        <span
                                                            aria-hidden="true"
                                                            className={styles.dungeonMapRoomBeatPips}
                                                        >
                                                            {Array.from({ length: routeChoiceBeatCue.beatCount }).map((_, beatIndex) => (
                                                                <i
                                                                    data-route-beat-pip={beatIndex + 1}
                                                                    data-route-beat-pip-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                                    key={beatIndex}
                                                                />
                                                            ))}
                                                        </span>
                                                        <strong>{routeChoiceBeatCue.action}</strong>
                                                        <em>{routeChoiceBeatCue.detail}</em>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoicePayoffsLabel}
                                                        className={styles.dungeonMapRoomPayoffRows}
                                                        data-route-primary-payoff={primaryRouteChoicePayoff?.value ?? 'none'}
                                                        data-route-primary-payoff-audio={
                                                            primaryRouteChoicePayoff
                                                                ? getRouteChoicePayoffAudioCue(primaryRouteChoicePayoff.tone)
                                                                : 'none'
                                                        }
                                                        data-route-primary-payoff-id={primaryRouteChoicePayoff?.id ?? 'none'}
                                                        data-route-primary-payoff-screen-cue={
                                                            primaryRouteChoicePayoff
                                                                ? getRouteChoicePayoffScreenCue(primaryRouteChoicePayoff.tone)
                                                                : 'none'
                                                        }
                                                        data-route-primary-payoff-tone={primaryRouteChoicePayoff?.tone ?? 'none'}
                                                        data-testid={`route-choice-${row.routeType}-payoffs`}
                                                    >
                                                        {primaryRouteChoicePayoff ? (
                                                            <span
                                                                aria-label={`Primary route payoff. ${primaryRouteChoicePayoff.label}: ${primaryRouteChoicePayoff.value}. ${getRouteChoiceToneBeatCount(primaryRouteChoicePayoff.tone)} beats.`}
                                                                data-route-primary-payoff-beats={getRouteChoiceToneBeatCount(
                                                                    primaryRouteChoicePayoff.tone
                                                                )}
                                                                data-route-primary-payoff-audio={getRouteChoicePayoffAudioCue(
                                                                    primaryRouteChoicePayoff.tone
                                                                )}
                                                                data-route-primary-payoff-id={primaryRouteChoicePayoff.id}
                                                                data-route-primary-payoff-screen-cue={getRouteChoicePayoffScreenCue(
                                                                    primaryRouteChoicePayoff.tone
                                                                )}
                                                                data-route-primary-payoff-tone={primaryRouteChoicePayoff.tone}
                                                                data-testid={`route-choice-${row.routeType}-primary-payoff`}
                                                            >
                                                                <small>Primary payoff</small>
                                                                <strong>{primaryRouteChoicePayoff.value}</strong>
                                                                <em>{primaryRouteChoicePayoff.label}</em>
                                                                <span aria-hidden="true" className={styles.dungeonMapRoomPrimaryPayoffBeatPips}>
                                                                    {Array.from(
                                                                        { length: getRouteChoiceToneBeatCount(primaryRouteChoicePayoff.tone) },
                                                                        (_, index) => (
                                                                            <i
                                                                                data-route-primary-payoff-beat={index + 1}
                                                                                data-route-primary-payoff-beat-focus={
                                                                                    index === 0 ? 'primary' : 'support'
                                                                                }
                                                                                key={index}
                                                                            />
                                                                        )
                                                                    )}
                                                                </span>
                                                            </span>
                                                        ) : null}
                                                        {routeChoicePayoffRows.map((payoff) => {
                                                            const beatCount = getRouteChoiceToneBeatCount(payoff.tone);
                                                            return (
                                                                <span
                                                                    data-route-payoff-audio={getRouteChoicePayoffAudioCue(payoff.tone)}
                                                                    data-route-payoff-beats={beatCount}
                                                                    data-route-payoff-id={payoff.id}
                                                                    data-route-payoff-screen-cue={getRouteChoicePayoffScreenCue(payoff.tone)}
                                                                    data-route-payoff-tone={payoff.tone}
                                                                    key={payoff.id}
                                                                >
                                                                    <small>{payoff.label}</small>
                                                                    <strong>{payoff.value}</strong>
                                                                    <span
                                                                        aria-hidden="true"
                                                                        className={styles.dungeonMapRoomPayoffBeatPips}
                                                                    >
                                                                        {Array.from({ length: beatCount }, (_, index) => (
                                                                            <i
                                                                                data-route-payoff-beat={index + 1}
                                                                                data-route-payoff-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                                key={index}
                                                                            />
                                                                        ))}
                                                                    </span>
                                                                </span>
                                                            );
                                                        })}
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceDecisionStackLabel}
                                                        className={styles.dungeonMapRoomDecisionStack}
                                                        data-route-decision-stack-tone={routeChoiceDecisionStack.tone}
                                                        data-testid={`route-choice-${row.routeType}-decision-stack`}
                                                    >
                                                        <small>{routeChoiceDecisionStack.label}</small>
                                                        <strong>{routeChoiceDecisionStack.value}</strong>
                                                        <em>{routeChoiceDecisionStack.nextCue}</em>
                                                    </span>
                                                    <span
                                                        aria-label={routeChoiceRecipeLabel}
                                                        className={styles.dungeonMapRoomRecipe}
                                                        data-route-recipe-tone={routeChoiceDecisionStack.tone}
                                                        data-testid={`route-choice-${row.routeType}-recipe`}
                                                    >
                                                        {routeChoiceRecipeSteps.map((step) => (
                                                            <span data-route-recipe-step={step.id} key={step.id}>
                                                                <small>{step.label}</small>
                                                                <strong>{step.value}</strong>
                                                            </span>
                                                        ))}
                                                    </span>
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
