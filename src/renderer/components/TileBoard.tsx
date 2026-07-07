import { Canvas } from '@react-three/fiber';
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type FocusEvent
} from 'react';
import { flushSync } from 'react-dom';
import type { BoardScreenSpaceAA, BoardState, GraphicsQualityPreset, RewardPerkId, RunStatus } from '../../shared/contracts';
import { getChainTargetFeedback } from '../../shared/chain-targets';
import { resolveAdaptiveBoardRenderQuality } from '../../shared/graphicsQuality';
import { getFindableRewardText } from '../../shared/findables';
import { getHazardTileBoardSummary, getHazardTileTelegraph } from '../../shared/hazard-tiles';
import { getTileSwapTraitPreviewLines, getTileTraitInteractionPreviewLines } from '../../shared/tile-trait-rules';
import {
    getSelectedTraitFollowupTileIds,
    getTraitOpportunitySummary,
    getTraitOpportunityTileIds,
    getTraitSwapOpportunityPreview
} from '../../shared/trait-opportunities';
import {
    getChainMilestonePreview,
    getChainMilestoneBeatCount,
    getChainRewardForecastCues,
    getChainRewardLaneAction,
    getChainRewardProgress,
    getChainRewardUrgencyCopy,
    type ChainRewardForecastCue
} from '../copy/chainMomentum';
import {
    formatChainOpportunityBeatLabel,
    getChainOpportunityBeatSignal,
    type ChainOpportunityBeatSignal
} from '../copy/chainOpportunityBeat';
import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    getTraitInteractionLaneRole,
    TRAIT_INTERACTION_LANE_LABELS,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr,
    traitInteractionLaneRoleMapAttr,
    type TraitInteractionLaneId
} from '../copy/traitInteractionLaneMap';
import { isNarrowShortLandscapeForMenuStack, VIEWPORT_MOBILE_MAX } from '../breakpoints';
import { useCoarsePointer } from '../hooks/useCoarsePointer';
import { useViewportSize } from '../hooks/useViewportSize';
import { getMotionPermissionButtonLabels, shouldOfferDeviceMotionPermission } from '../platformTilt/platformTiltPermissionUi';
import { usePlatformTiltField } from '../platformTilt/usePlatformTiltField';
import styles from './TileBoard.module.css';
import { playChainOpportunityBeatSfx, playShuffleSfx, resumeAudioContext } from '../audio/gameSfx';
import TileBoardScene, { type TileBoardSceneHandle, type TileHoverTiltState } from './TileBoardScene';
import { getResolvingSelectionState } from './tileResolvingSelection';
import { DUNGEON_BOARD_STAGE_LAYER_POLICY, DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET } from './tileBoardStageLayers';
import {
    COMPACT_BOARD_FIT_MARGIN,
    MOBILE_CAMERA_FIT_MARGIN,
    ROOMY_BOARD_FIT_MARGIN,
    carryBoardViewportForward,
    clampBoardViewport,
    createPinchBoardGestureSnapshot,
    createFittedBoardViewport,
    getGestureCentroid,
    getBoardFitZoom,
    resolveDraggedBoardViewport,
    resolvePinchBoardViewport,
    resolveWheelBoardViewport,
    screenPointToWorld,
    type TileBoardGesturePoint,
    type TileBoardPinchGestureSnapshot,
    type TileBoardViewportMetrics,
    type TileBoardViewportState
} from './tileBoardViewport';
import { BOARD_LAYOUT_VIEWPORT_PADDING, TILE_SPACING } from './tileShatter';
import { computeBoardEntranceMotionBudgetMs, computeShuffleMotionBudgetMs } from './shuffleFlipAnimation';
import { boardWebglPerfSampleRecordReactCommit, boardWebglPerfSampleVerboseEnabled } from '../dev/boardWebglPerfSample';
import { preloadTileTextureImages } from './tileTextures';
import {
    DNG065_BOARD_APPLICATION_LABEL,
    DNG065_DUNGEON_COMFORT_FOCUS_ORDER,
    DNG065_MOBILE_BOARD_PRIORITY,
    REG103_BOARD_TOUCH_ACTION,
    REG105_DATA_DAIS,
    REG105_DATA_STAGEVIEW
} from '../gameplay/regPhase4PlayContract';
import {
    getBoardChainAccessibilitySummary,
    getFocusedTileLiveLabel,
    getPickableTileIds,
    moveFocusInGrid
} from './tileBoardDomAccessibility';
import {
    CARD_FEEDBACK_BEAT_TIER_CONTRACT,
    CARD_FEEDBACK_CADENCE_CONTRACT,
    CARD_FEEDBACK_ROUTE_GLYPH_CONTRACT,
    getDevE2ePairPositionsJson,
    getTraitLaneFeedbackBeatCount
} from './tileBoardDomTelemetry';
import { buildTileBoardDomSurfaceModel } from './tileBoardDomSurfaceModel';
import { getTraitRouteReadabilityBeatCount } from './tileBoardReadability';
import { TileBoardErrorBoundary } from './tileBoardWebglBoundary';
import { canUseWebGL } from './tileBoardWebglSupport';
import { TileBoardPrestageOverlay } from './TileBoardPrestageOverlay';
import { useTileBoardWebglContextRecovery } from './useTileBoardWebglContextRecovery';

/** Minimum time the pre-board “gather / release” motif stays visible while GPU warm-up runs in parallel. */
const BOARD_PRESTAGE_DWELL_MS = 360;

/** Decorative deck cards in the prestaging overlay (must match `--prestage-cards` in CSS math). */
const PRESTAGE_CARD_COUNT = 8;

type BoardOpportunityHeat = 'cashout' | 'normal' | 'prime' | 'surge';
type BoardOpportunityTone =
    | 'chain'
    | 'control'
    | 'hazard'
    | 'lost-reward'
    | 'perk'
    | 'pickup'
    | 'recall'
    | 'recover'
    | 'risk'
    | 'setup'
    | 'trait';
type BoardOpportunityCompassRow = {
    action: string;
    detail: string;
    id: 'chain' | 'hazard' | 'perk' | 'pickup' | 'recovery' | 'tool' | 'trait';
    impactCue: string;
    label: string;
    tone: BoardOpportunityTone;
    value: string;
};
type BoardOpportunityLaneId = 'cash' | 'build' | 'pickup' | 'perk' | 'recover' | 'risk' | 'tool' | 'trait';
type BoardOpportunityLaneMapEntry = {
    action: 'Cash now' | 'Prime build' | 'Claim pickup' | 'Cash perk' | 'Recover' | 'Reduce risk' | 'Study traits' | 'Use tool';
    id: BoardOpportunityLaneId;
    label: 'Cash' | 'Build' | 'Pickup' | 'Perk' | 'Recover' | 'Risk' | 'Tool' | 'Trait';
    count: number;
    cue: string;
};
type BoardChainRewardLadderEntry = {
    action: ReturnType<typeof getChainRewardLaneAction>;
    cue: ChainRewardForecastCue;
    filled: number;
    progressLabel: string;
    remainingLabel: string;
    total: number;
};
type BoardFeedbackScreenCue = 'burst' | 'guard' | 'pulse' | 'snap' | 'tick';
type BoardPayoffStackTone = 'build' | 'cashout' | 'followup' | 'setup';
type BoardPayoffStackHeat = 'cashout' | 'prime';
type BoardPayoffStackCrescendoScreenCue = 'burst' | 'pulse' | 'snap' | 'super';
type BoardPayoffStackCrescendoTier = 'cashout' | 'prime' | 'stack' | 'super';
type BoardPayoffStack = {
    action: string;
    crescendo: {
        beatCount: 2 | 3 | 4 | 5;
        detail: string;
        label: string;
        screenCue: BoardPayoffStackCrescendoScreenCue;
        tier: BoardPayoffStackCrescendoTier;
    };
    cue: string;
    detail: string;
    heat: BoardPayoffStackHeat;
    nextCue: string;
    sequence: {
        first: string;
        keep: string;
        then: string;
    };
    sequenceCue: string;
    tone: BoardPayoffStackTone;
    value: string;
};

const getBoardOpportunityHeat = (impactCue: string): BoardOpportunityHeat => {
    const normalizedCue = impactCue.toLowerCase();
    if (normalizedCue.includes('cashout') || normalizedCue.includes('super stack')) {
        return 'cashout';
    }
    if (normalizedCue.includes('surge')) {
        return 'surge';
    }
    if (
        normalizedCue.includes('prime') ||
        normalizedCue.includes('follow-up') ||
        normalizedCue.includes('perk armed')
    ) {
        return 'prime';
    }
    return 'normal';
};

const getBoardOpportunityBeatCount = (row: BoardOpportunityCompassRow): 2 | 3 | 4 | 5 => {
    const heat = getBoardOpportunityHeat(row.impactCue);
    if (heat === 'cashout') {
        return 5;
    }
    if (heat === 'surge') {
        return 4;
    }
    if (heat === 'prime' || row.id === 'hazard') {
        return 3;
    }
    return 2;
};

const getFocusedPreviewBeatCount = ({
    kind,
    rewardHotText,
    tone
}: {
    kind: 'hazard' | 'pickup' | 'trait';
    rewardHotText?: string | null;
    tone: 'cashout' | 'hazard' | 'pickup' | 'setup' | 'trait';
}): 3 | 4 | 5 => {
    if (tone === 'cashout' || rewardHotText) {
        return 5;
    }
    if (kind === 'hazard' || tone === 'hazard') {
        return 3;
    }
    return 4;
};

const getFocusedPreviewAudioCue = ({
    kind,
    rewardHotText,
    tone
}: {
    kind: 'hazard' | 'pickup' | 'trait';
    rewardHotText?: string | null;
    tone: 'cashout' | 'hazard' | 'pickup' | 'setup' | 'trait';
}): 'preview-cashout' | 'preview-hazard' | 'preview-pickup' | 'preview-route' => {
    if (tone === 'cashout' || rewardHotText) {
        return 'preview-cashout';
    }
    if (kind === 'hazard' || tone === 'hazard') {
        return 'preview-hazard';
    }
    if (kind === 'pickup' || tone === 'pickup') {
        return 'preview-pickup';
    }
    return 'preview-route';
};

const getFocusedPreviewScreenCue = ({
    kind,
    rewardHotText,
    tone
}: {
    kind: 'hazard' | 'pickup' | 'trait';
    rewardHotText?: string | null;
    tone: 'cashout' | 'hazard' | 'pickup' | 'setup' | 'trait';
}): BoardFeedbackScreenCue => {
    if (tone === 'cashout' || rewardHotText) {
        return 'burst';
    }
    if (kind === 'hazard' || tone === 'hazard') {
        return 'guard';
    }
    if (kind === 'pickup' || tone === 'pickup') {
        return 'snap';
    }
    return 'pulse';
};

const getTrapResolutionSignalBeatCount = (signal: 'continue' | 'effect' | 'resolved'): 2 | 3 | 4 => {
    if (signal === 'effect') {
        return 4;
    }
    if (signal === 'resolved') {
        return 3;
    }
    return 2;
};

const getTrapResolutionSignalAction = (
    signal: 'continue' | 'effect' | 'resolved'
): 'Chase next pair' | 'Confirm trap' | 'Resolve effect' => {
    if (signal === 'resolved') {
        return 'Confirm trap';
    }
    if (signal === 'effect') {
        return 'Resolve effect';
    }
    return 'Chase next pair';
};

const getTrapResolutionSignalAudioCue = (
    signal: 'continue' | 'effect' | 'resolved'
): 'trap-continue' | 'trap-effect' | 'trap-resolved' => {
    if (signal === 'resolved') {
        return 'trap-resolved';
    }
    if (signal === 'effect') {
        return 'trap-effect';
    }
    return 'trap-continue';
};

const getTrapResolutionSignalScreenCue = (signal: 'continue' | 'effect' | 'resolved'): BoardFeedbackScreenCue => {
    if (signal === 'effect') {
        return 'burst';
    }
    if (signal === 'resolved') {
        return 'snap';
    }
    return 'pulse';
};

const BOARD_OPPORTUNITY_LANE_ORDER: BoardOpportunityLaneId[] = ['cash', 'build', 'trait', 'pickup', 'perk', 'recover', 'risk', 'tool'];

const BOARD_OPPORTUNITY_LANE_LABELS: Record<BoardOpportunityLaneId, BoardOpportunityLaneMapEntry['label']> = {
    build: 'Build',
    cash: 'Cash',
    perk: 'Perk',
    pickup: 'Pickup',
    recover: 'Recover',
    trait: 'Trait',
    risk: 'Risk',
    tool: 'Tool'
};

const BOARD_OPPORTUNITY_LANE_ACTIONS: Record<BoardOpportunityLaneId, BoardOpportunityLaneMapEntry['action']> = {
    build: 'Prime build',
    cash: 'Cash now',
    perk: 'Cash perk',
    pickup: 'Claim pickup',
    recover: 'Recover',
    trait: 'Study traits',
    risk: 'Reduce risk',
    tool: 'Use tool'
};

const boardOpportunityLaneId = (row: BoardOpportunityCompassRow): BoardOpportunityLaneId => {
    if (row.id === 'hazard') {
        return 'risk';
    }
    if (row.id === 'recovery') {
        return 'recover';
    }
    if (row.id === 'perk') {
        return 'perk';
    }
    if (row.id === 'pickup') {
        return 'pickup';
    }
    if (row.id === 'tool') {
        return 'tool';
    }
    if (row.id === 'trait') {
        return 'trait';
    }
    const cue = row.impactCue.toLowerCase();
    if (cue.includes('prime') || cue.includes('follow-up')) {
        return 'build';
    }
    return cue.includes('cashout') || cue.includes('super stack') ? 'cash' : 'build';
};

const boardOpportunityLaneMap = (rows: readonly BoardOpportunityCompassRow[]): BoardOpportunityLaneMapEntry[] => {
    const laneState = new Map<BoardOpportunityLaneId, { count: number; cue: string }>();
    rows.forEach((row) => {
        const laneId = boardOpportunityLaneId(row);
        const state = laneState.get(laneId);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(laneId, { count: 1, cue: row.impactCue });
    });

    return BOARD_OPPORTUNITY_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        return state
            ? [
                  {
                      action: BOARD_OPPORTUNITY_LANE_ACTIONS[id],
                      id,
                      label: BOARD_OPPORTUNITY_LANE_LABELS[id],
                      count: state.count,
                      cue: state.cue
                  }
              ]
            : [];
    });
};

const boardOpportunityLaneMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') : 'none';

const boardOpportunityLaneActionMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') : 'none';

const boardOpportunityLaneBeatCount = (lane: Pick<BoardOpportunityLaneMapEntry, 'count' | 'id'>): 2 | 3 | 4 => {
    if (lane.id === 'cash' || lane.count > 1) {
        return 4;
    }
    if (lane.id === 'build' || lane.id === 'pickup' || lane.id === 'perk') {
        return 3;
    }
    return 2;
};

const boardOpportunityLaneAudioCue = (
    lane: Pick<BoardOpportunityLaneMapEntry, 'id'>
):
    | 'board-opportunity-build'
    | 'board-opportunity-cash'
    | 'board-opportunity-perk'
    | 'board-opportunity-pickup'
    | 'board-opportunity-recover'
    | 'board-opportunity-risk'
    | 'board-opportunity-tool' => {
    switch (lane.id) {
        case 'cash':
            return 'board-opportunity-cash';
        case 'pickup':
            return 'board-opportunity-pickup';
        case 'perk':
            return 'board-opportunity-perk';
        case 'recover':
            return 'board-opportunity-recover';
        case 'risk':
            return 'board-opportunity-risk';
        case 'tool':
            return 'board-opportunity-tool';
        case 'trait':
            return 'board-opportunity-build';
        case 'build':
        default:
            return 'board-opportunity-build';
    }
};

const boardOpportunityLaneScreenCue = (
    lane: Pick<BoardOpportunityLaneMapEntry, 'id'>
): 'burst' | 'guard' | 'pulse' | 'recover' | 'risk' => {
    if (lane.id === 'cash' || lane.id === 'pickup') {
        return 'burst';
    }
    if (lane.id === 'risk') {
        return 'risk';
    }
    if (lane.id === 'recover') {
        return 'recover';
    }
    if (lane.id === 'tool') {
        return 'guard';
    }
    if (lane.id === 'trait') {
        return 'pulse';
    }
    return 'pulse';
};

const boardOpportunityLaneFocus = (
    lane: Pick<BoardOpportunityLaneMapEntry, 'id'>
): 'build' | 'cashout' | 'recover' | 'reward' | 'risk' | 'tool' => {
    switch (lane.id) {
        case 'cash':
            return 'cashout';
        case 'pickup':
        case 'perk':
        case 'trait':
            return 'reward';
        case 'recover':
            return 'recover';
        case 'risk':
            return 'risk';
        case 'tool':
            return 'tool';
        case 'build':
        default:
            return 'build';
    }
};

const boardOpportunityLaneRole = (
    lane: Pick<BoardOpportunityLaneMapEntry, 'id'>
): 'Cashout' | 'Claim' | 'Perk' | 'Prime' | 'Recover' | 'Risk' | 'Study' | 'Tool' => {
    switch (lane.id) {
        case 'cash':
            return 'Cashout';
        case 'pickup':
            return 'Claim';
        case 'perk':
            return 'Perk';
        case 'recover':
            return 'Recover';
        case 'risk':
            return 'Risk';
        case 'tool':
            return 'Tool';
        case 'trait':
            return 'Study';
        case 'build':
        default:
            return 'Prime';
    }
};

const boardOpportunityLaneRoleMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntry[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${boardOpportunityLaneRole(lane)}:${lane.count}`).join('>') : 'none';

const boardOpportunityLaneMapLabel = (laneMap: readonly BoardOpportunityLaneMapEntry[]): string =>
    laneMap.length > 0
        ? `Opportunity lane map. ${laneMap.map((lane) => `${lane.label} ${boardOpportunityLaneRole(lane)} x${lane.count}. ${lane.action}. ${lane.cue}.`).join(' ')}`
        : 'Opportunity lane map';

const boardChainRewardLadder = (
    streak: number,
    cues: readonly ChainRewardForecastCue[]
): BoardChainRewardLadderEntry[] =>
    cues
        .map((cue) => {
            const progress = getChainRewardProgress(streak, cue);
            return progress
                ? {
                      action: getChainRewardLaneAction(cue.urgency),
                      cue,
                      filled: progress.filled,
                      progressLabel: progress.label,
                      remainingLabel: progress.remainingLabel,
                      total: progress.total
                  }
                : null;
        })
        .filter((entry): entry is BoardChainRewardLadderEntry => entry != null);

const boardChainRewardLadderAttr = (entries: readonly BoardChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? entries.map((entry) => `${entry.cue.tone}:${entry.filled}/${entry.total}`).join('>')
        : 'none';

const boardChainRewardLadderActionAttr = (entries: readonly BoardChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? entries.map((entry) => `${entry.cue.tone}:${entry.action}:${entry.filled}/${entry.total}`).join('>')
        : 'none';

const boardChainRewardLadderLabel = (entries: readonly BoardChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? `Board reward ladder. ${entries
              .map(
                  (entry) => {
                      const actionCopy = entry.action === entry.cue.chaseLabel ? '' : ` ${entry.action}:`;
                      return `${entry.cue.chaseLabel}:${actionCopy} ${entry.cue.label}. ${entry.progressLabel}. ${entry.remainingLabel}.`;
                  }
              )
              .join(' ')}`
        : 'Board reward ladder';

const boardChainRewardBeatCount = (entry: BoardChainRewardLadderEntry): 2 | 3 | 4 => {
    if (entry.cue.urgency === 'next' || entry.remainingLabel.startsWith('0 ')) {
        return 4;
    }
    if (entry.filled > 0 || entry.cue.urgency === 'soon') {
        return 3;
    }
    return 2;
};

const boardChainRewardAudioCue = (
    entry: BoardChainRewardLadderEntry
): 'board-reward-guard' | 'board-reward-heal' | 'board-reward-prime' | 'board-reward-shard' | 'board-reward-stack' => {
    if ((entry.cue.stackSize ?? 1) >= 2) {
        return 'board-reward-stack';
    }
    if (entry.cue.tone === 'guard') {
        return 'board-reward-guard';
    }
    if (entry.cue.tone === 'heal') {
        return 'board-reward-heal';
    }
    if (entry.cue.urgency === 'later') {
        return 'board-reward-prime';
    }
    return 'board-reward-shard';
};

const boardChainRewardScreenCue = (entry: BoardChainRewardLadderEntry): BoardFeedbackScreenCue => {
    if ((entry.cue.stackSize ?? 1) >= 2 || entry.cue.urgency === 'next') {
        return 'burst';
    }
    if (entry.cue.urgency === 'soon' || entry.filled > 0) {
        return 'pulse';
    }
    return 'tick';
};

const boardOpportunityAudioCue = (
    row: BoardOpportunityCompassRow
): 'opportunity-cashout' | 'opportunity-hazard' | 'opportunity-perk' | 'opportunity-prime' | 'opportunity-recover' | 'opportunity-tool' => {
    if (row.id === 'hazard') {
        return 'opportunity-hazard';
    }
    if (row.id === 'recovery') {
        return 'opportunity-recover';
    }
    if (row.id === 'tool') {
        return 'opportunity-tool';
    }
    if (row.id === 'perk') {
        return 'opportunity-perk';
    }
    return getBoardOpportunityHeat(row.impactCue) === 'cashout' ? 'opportunity-cashout' : 'opportunity-prime';
};

const boardOpportunityScreenCue = (row: BoardOpportunityCompassRow): BoardFeedbackScreenCue => {
    if (row.id === 'hazard' || row.id === 'recovery') {
        return 'guard';
    }
    const heat = getBoardOpportunityHeat(row.impactCue);
    if (heat === 'cashout') {
        return 'burst';
    }
    if (heat === 'surge' || heat === 'prime') {
        return 'pulse';
    }
    return 'tick';
};

const boardPayoffStackCrescendoAudioCue = (
    tier: BoardPayoffStackCrescendoTier
): 'cashout-pop' | 'prime-pop' | 'stack-burst' | 'super-burst' => {
    if (tier === 'super') {
        return 'super-burst';
    }
    if (tier === 'stack') {
        return 'stack-burst';
    }
    if (tier === 'cashout') {
        return 'cashout-pop';
    }
    return 'prime-pop';
};

export type TileBoardClientRect = {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
};

export type TileBoardHandle = {
    getTileClientRectAtGrid: (row: number, col: number) => TileBoardClientRect | null;
    getTileClientRectById: (tileId: string) => TileBoardClientRect | null;
    runShuffleAnimation: (applyShuffle: () => void) => void;
};

interface TileBoardProps {
    board: BoardState;
    debugPeekActive: boolean;
    interactive: boolean;
    mobileCameraMode: boolean;
    pinnedTileIds?: string[];
    previewActive: boolean;
    reduceMotion: boolean;
    /** When `auto`, follows the legacy motion preference; `smaa` currently falls back to native AA. */
    boardScreenSpaceAA?: BoardScreenSpaceAA;
    graphicsQuality?: GraphicsQualityPreset;
    boardBloomEnabled?: boolean;
    viewportResetToken: number;
    frameStyle?: CSSProperties;
    /** Hidden tiles to dim when focus-assist is on (2D fallback and WebGL scene). */
    dimmedTileIds?: ReadonlySet<string>;
    /** REG-026: optional guided first-run target ids; keyboard focus/picking starts with these tiles. */
    guidedTargetTileIds?: readonly string[];
    /** Trait-route setup ids from the HUD model; marks swap-created route cards before the swap tool is armed. */
    traitRouteTargetTileIds?: readonly string[];
    /** Exact setup action for the currently highlighted trait route, if one exists. */
    traitRouteHintText?: string | null;
    /** Current run chain state, used to preview the payoff of a highlighted chain move. */
    chainContext?: {
        armedPerkId?: RewardPerkId | null;
        armedPerkDetail?: string | null;
        armedPerkLabel?: string | null;
        armedPerkPayoff?: string | null;
        comboShards: number;
        currentStreak: number;
        lives: number;
    };
    recoveryContext?: {
        action: string;
        detail: string;
        impactCue: string;
        value: string;
        tone: 'recover' | 'risk' | 'lost-reward';
    } | null;
    peekRevealedTileIds?: string[];
    allowGambitThirdFlip?: boolean;
    wideRecallInPlay?: boolean;
    silhouetteDuringPlay?: boolean;
    nBackAnchorPairKey?: string | null;
    nBackMutatorActive?: boolean;
    /** Memorize-phase marker for the cursed pair objective (non-color-only ring). */
    cursedPairKey?: string | null;
    /** `shifting_spotlight`: current ward pair (lower match score if matched now). */
    wardPairKey?: string | null;
    /** `shifting_spotlight`: current bounty pair (bonus if matched now). */
    bountyPairKey?: string | null;
    runStatus?: RunStatus;
    /**
     * When false, hides early-tutorial **pair marker** chrome (face-down tiles: DOM inset ring + WebGL back-face badge).
     */
    showTutorialPairMarkers?: boolean;
    /** Guided first-run target tiles that should remain visually emphasized while prompts teach by doing. */
    onboardingTargetTileIds?: readonly string[];
    /** Distance-to-pair badge on flipped tiles (Manhattan grid steps). */
    pairProximityHintsEnabled?: boolean;
    onTileSelect: (tileId: string) => void;
    /** `shifting_spotlight` — show ward/bounty corner markers on face-down tiles. */
    shiftingSpotlightActive?: boolean;
    /** Board power affordances: destroy pair armed and valid run + board state. */
    destroyPowerVisualActive?: boolean;
    destroyEligibleTileIds?: ReadonlySet<string>;
    peekPowerVisualActive?: boolean;
    peekEligibleTileIds?: ReadonlySet<string>;
    strayPowerVisualActive?: boolean;
    strayEligibleTileIds?: ReadonlySet<string>;
    tileSwapPowerVisualActive?: boolean;
    tileSwapEligibleTileIds?: ReadonlySet<string>;
    tileSwapFirstTileId?: string | null;
    pinModeBoardHintActive?: boolean;
    /** Effective SFX gain (0–1) for shuffle whoosh; from settings in GameScreen. */
    shuffleSfxGain?: number;
    /** Sticky fingers: board slot that cannot start the next pair (from `RunState.stickyBlockIndex`). */
    stickyBlockedTileId?: string | null;
    /** Fired once the board has finished prestage/deal-in and is stable enough to begin memorize timing. */
    onMemorizeBoardReady?: (boardKey: string) => void;
}

interface StageWorldViewport {
    height: number;
    width: number;
}

interface MouseDragSnapshot {
    dragActive: boolean;
    pickOnRelease: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    startWorldX: number;
    startWorldY: number;
}

const MOUSE_PAN_DRAG_THRESHOLD_PX = 8;
const EMPTY_TILE_IDS: ReadonlySet<string> = new Set();
const BOARD_MARKER_READABILITY_CONTRACT =
    'hidden selected matched disabled enemy-occupied boss-marked trap-armed trap-resolved relic objective exit lock lever shop trait chain-ready chain-surge chain-reward-hot chain-setup trait-combo trait-combo-surge trait-payoff-stack trait-route-target perk-armed selected-followup';
const BOARD_MARKER_SHAPE_CONTRACT = 'linked-route combo-surge payoff-bar payoff-stack swap-target-crossbar perk-armed-bar followup-target';
const BOARD_MARKER_ACTION_CUE_CONTRACT = 'bank-lane build-lane cash-now follow-up perk-cash route-setup';
const BOARD_MARKER_ACTION_PRIORITY_CONTRACT = 'cash-now perk-cash follow-up build-lane route-setup bank-lane';
const BOARD_MARKER_TRAIT_LANE_CONTRACT = 'shard guard tool risk block recall score';
const CARD_TRAIT_LANE_ORDER_SET = new Set<TraitInteractionLaneId>(
    BOARD_MARKER_TRAIT_LANE_CONTRACT.split(' ') as TraitInteractionLaneId[]
);
const BOARD_MARKER_BEAT_TIER_CONTRACT = CARD_FEEDBACK_BEAT_TIER_CONTRACT;
const BOARD_MARKER_CADENCE_CONTRACT = CARD_FEEDBACK_CADENCE_CONTRACT;
const BOARD_MARKER_ROUTE_GLYPH_CONTRACT = CARD_FEEDBACK_ROUTE_GLYPH_CONTRACT;

const PRELOAD_READY_TIMEOUT_MS = 320;

const formatBoardFeedbackLabel = (
    label: string,
    rows: readonly (string | null | undefined)[]
): string => {
    const rowCopy = rows.filter((row): row is string => Boolean(row)).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const trimTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/u, '');

const CARD_ACTION_PRIORITY_LABELS: Record<string, string> = {
    'bank-lane': 'Bank lane',
    'build-lane': 'Route prime',
    'cash-now': 'Cash now',
    'follow-up': 'Follow-up',
    'perk-cash': 'Perk cash',
    'route-setup': 'Route prime'
};
const CARD_ACTION_SHOT_LABELS: Record<string, string> = {
    'bank-lane': 'Bank',
    'build-lane': 'Build',
    'cash-now': 'Cash',
    'follow-up': 'Tap',
    'perk-cash': 'Perk',
    'route-setup': 'Set'
};
const CARD_ACTION_SHOT_DETAILS: Record<string, string> = {
    'bank-lane': 'Reward lane',
    'build-lane': 'Route lane',
    'cash-now': 'Cashout lane',
    'follow-up': 'Next tap',
    'perk-cash': 'Perk lane',
    'route-setup': 'Setup lane'
};
type CardActionPriorityRole = 'Bank' | 'Cashout' | 'Follow-up' | 'Perk' | 'Setup';
type CardActionPriorityTone = 'bank' | 'cashout' | 'followup' | 'perk' | 'setup';
type CardActionPriorityScreenCue = 'burst' | 'guard' | 'pulse' | 'tick';
type CardFeedbackPulseTone = 'cashout' | 'followup' | 'route' | 'setup' | 'surge';
type CardFeedbackPulseScreenCue = 'burst' | 'guard' | 'pulse' | 'tick';

const cardActionPriorityRole = (id: string): CardActionPriorityRole => {
    if (id === 'bank-lane') {
        return 'Bank';
    }
    if (id === 'follow-up') {
        return 'Follow-up';
    }
    if (id === 'perk-cash') {
        return 'Perk';
    }
    if (id === 'cash-now') {
        return 'Cashout';
    }
    return 'Setup';
};

const cardActionPriorityTone = (id: string): CardActionPriorityTone => {
    if (id === 'bank-lane') {
        return 'bank';
    }
    if (id === 'follow-up') {
        return 'followup';
    }
    if (id === 'perk-cash') {
        return 'perk';
    }
    if (id === 'cash-now') {
        return 'cashout';
    }
    return 'setup';
};

const cardActionPriorityScreenCue = (id: string): CardActionPriorityScreenCue => {
    if (id === 'bank-lane') {
        return 'guard';
    }
    if (id === 'follow-up') {
        return 'pulse';
    }
    if (id === 'cash-now' || id === 'perk-cash') {
        return 'burst';
    }
    return 'tick';
};

const cardFeedbackPulseTone = (id: string): CardFeedbackPulseTone => {
    if (id === 'cashout') {
        return 'cashout';
    }
    if (id === 'follow-up') {
        return 'followup';
    }
    if (id === 'route') {
        return 'route';
    }
    if (id === 'surge') {
        return 'surge';
    }
    return 'setup';
};

const cardFeedbackPulseScreenCue = (id: string): CardFeedbackPulseScreenCue => {
    if (id === 'cashout' || id === 'surge') {
        return 'burst';
    }
    if (id === 'follow-up') {
        return 'pulse';
    }
    if (id === 'route') {
        return 'guard';
    }
    return 'tick';
};
const TRAIT_ROUTE_INTENSITY_PRIORITY = ['stack', 'cashout', 'surge', 'ready', 'setup'] as const;
const TRAIT_ROUTE_INTENSITY_LABELS: Record<(typeof TRAIT_ROUTE_INTENSITY_PRIORITY)[number], string> = {
    cashout: 'Cashout',
    ready: 'Ready',
    setup: 'Prime',
    stack: 'Stack',
    surge: 'Surge'
};
const TRAIT_ROUTE_INTENSITY_ACTIONS: Record<(typeof TRAIT_ROUTE_INTENSITY_PRIORITY)[number], string> = {
    cashout: 'Hit now',
    ready: 'Match route',
    setup: 'Prime payoff',
    stack: 'Cash stack',
    surge: 'Chain routes'
};
const CARD_FEEDBACK_BEAT_PRIORITY = ['cashout', 'surge', 'follow-up', 'route', 'setup'] as const;
const CARD_FEEDBACK_BEAT_LABELS: Record<(typeof CARD_FEEDBACK_BEAT_PRIORITY)[number], string> = {
    cashout: 'Cashout',
    'follow-up': 'Follow-up',
    route: 'Route',
    setup: 'Prime',
    surge: 'Surge'
};
const CARD_FEEDBACK_BEAT_ACTIONS: Record<(typeof CARD_FEEDBACK_BEAT_PRIORITY)[number], string> = {
    cashout: 'hit now',
    'follow-up': 'tap next',
    route: 'build chain',
    setup: 'set route',
    surge: 'chain routes'
};
const CARD_FEEDBACK_CADENCE_PRIORITY = ['cashout', 'surge', 'follow-up', 'route', 'prime'] as const;
const CARD_FEEDBACK_CADENCE_LABELS: Record<(typeof CARD_FEEDBACK_CADENCE_PRIORITY)[number], string> = {
    cashout: 'Cashout',
    'follow-up': 'Follow-up',
    prime: 'Prime',
    route: 'Route',
    surge: 'Surge'
};
const CARD_FEEDBACK_CADENCE_BEATS: Record<(typeof CARD_FEEDBACK_CADENCE_PRIORITY)[number], 2 | 3 | 4 | 5> = {
    cashout: 5,
    surge: 4,
    'follow-up': 3,
    route: 3,
    prime: 2
};

type CardFeedbackBeatId = (typeof CARD_FEEDBACK_BEAT_PRIORITY)[number];
type CardFeedbackCadenceId = (typeof CARD_FEEDBACK_CADENCE_PRIORITY)[number];

const cardPrimaryShotAudioCue = (
    beatId: CardFeedbackBeatId | string | 'none',
    cadenceId: CardFeedbackCadenceId | string | 'none'
):
    | 'card-shot-cashout'
    | 'card-shot-follow-up'
    | 'card-shot-prime'
    | 'card-shot-route'
    | 'card-shot-surge' => {
    if (beatId === 'cashout' || cadenceId === 'cashout') {
        return 'card-shot-cashout';
    }
    if (beatId === 'surge' || cadenceId === 'surge') {
        return 'card-shot-surge';
    }
    if (beatId === 'route' || cadenceId === 'route') {
        return 'card-shot-route';
    }
    if (beatId === 'follow-up' || cadenceId === 'follow-up') {
        return 'card-shot-follow-up';
    }
    return 'card-shot-prime';
};

const cardPrimaryShotScreenCue = (
    beatId: CardFeedbackBeatId | string | 'none',
    cadenceId: CardFeedbackCadenceId | string | 'none'
): 'burst' | 'guard' | 'pulse' => {
    if (beatId === 'cashout' || beatId === 'surge' || cadenceId === 'cashout' || cadenceId === 'surge') {
        return 'burst';
    }
    if (beatId === 'route' || cadenceId === 'route') {
        return 'guard';
    }
    return 'pulse';
};

const cardPrimaryShotFocus = (
    beatId: CardFeedbackBeatId | string | 'none',
    cadenceId: CardFeedbackCadenceId | string | 'none'
): 'cashout' | 'surge' | 'follow-up' | 'route' | 'setup' => {
    if (beatId === 'cashout' || cadenceId === 'cashout') {
        return 'cashout';
    }
    if (beatId === 'surge' || cadenceId === 'surge') {
        return 'surge';
    }
    if (beatId === 'follow-up' || cadenceId === 'follow-up') {
        return 'follow-up';
    }
    if (beatId === 'route' || cadenceId === 'route') {
        return 'route';
    }
    return 'setup';
};

const cardTraitLaneAudioCue = (
    laneId: TraitInteractionLaneId | string
):
    | 'trait-lane-block'
    | 'trait-lane-guard'
    | 'trait-lane-recall'
    | 'trait-lane-risk'
    | 'trait-lane-shard'
    | 'trait-lane-tool' => {
    if (laneId === 'guard') {
        return 'trait-lane-guard';
    }
    if (laneId === 'tool') {
        return 'trait-lane-tool';
    }
    if (laneId === 'risk') {
        return 'trait-lane-risk';
    }
    if (laneId === 'block') {
        return 'trait-lane-block';
    }
    if (laneId === 'recall') {
        return 'trait-lane-recall';
    }
    return 'trait-lane-shard';
};

const cardTraitLaneScreenCue = (laneId: TraitInteractionLaneId | string): 'burst' | 'guard' | 'pulse' | 'risk' => {
    if (laneId === 'risk' || laneId === 'block') {
        return 'risk';
    }
    if (laneId === 'guard' || laneId === 'tool') {
        return 'guard';
    }
    if (laneId === 'recall') {
        return 'pulse';
    }
    return 'burst';
};

const cardTraitLaneRole = (
    laneId: TraitInteractionLaneId | string
): 'Block' | 'Cashout' | 'Protect' | 'Recall' | 'Risk' | 'Tool' =>
    CARD_TRAIT_LANE_ORDER_SET.has(laneId as TraitInteractionLaneId)
        ? getTraitInteractionLaneRole({ id: laneId as TraitInteractionLaneId })
        : 'Cashout';

const parseCountAttribute = (value: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const entry of value.split(/[;>]/u)) {
        if (!entry) {
            continue;
        }
        const [key, countText] = entry.split(':');
        const count = Number(countText);
        if (!key || !Number.isFinite(count)) {
            continue;
        }
        counts.set(key, count);
    }
    return counts;
};

// FX-016 matrix: docs/new_design/FX_REDUCE_MOTION_MATRIX.md
const TileBoard = forwardRef<TileBoardHandle, TileBoardProps>(function TileBoard(
    {
        board,
        debugPeekActive,
        interactive,
        mobileCameraMode,
        pinnedTileIds = [],
        previewActive,
        reduceMotion,
        boardScreenSpaceAA = 'auto',
        graphicsQuality = 'medium',
        viewportResetToken,
        frameStyle,
        dimmedTileIds,
        guidedTargetTileIds = [],
    traitRouteTargetTileIds = [],
    traitRouteHintText = null,
    chainContext,
    recoveryContext = null,
    peekRevealedTileIds = [],
        allowGambitThirdFlip = false,
        wideRecallInPlay = false,
        silhouetteDuringPlay = false,
        nBackAnchorPairKey = null,
        nBackMutatorActive = false,
        cursedPairKey = null,
        wardPairKey = null,
        bountyPairKey = null,
        runStatus = 'playing',
        showTutorialPairMarkers = true,
        pairProximityHintsEnabled = true,
        onTileSelect,
        shiftingSpotlightActive = false,
        destroyPowerVisualActive = false,
        destroyEligibleTileIds = EMPTY_TILE_IDS,
        peekPowerVisualActive = false,
        peekEligibleTileIds = EMPTY_TILE_IDS,
        strayPowerVisualActive = false,
        strayEligibleTileIds = EMPTY_TILE_IDS,
        tileSwapPowerVisualActive = false,
        tileSwapEligibleTileIds = EMPTY_TILE_IDS,
        tileSwapFirstTileId = null,
        pinModeBoardHintActive = false,
        shuffleSfxGain = 1,
        stickyBlockedTileId = null,
        onMemorizeBoardReady
    },
    ref
) {
    const { height, width } = useViewportSize();
    const peekSet = useMemo(() => new Set(peekRevealedTileIds), [peekRevealedTileIds]);
    const compact =
        width <= VIEWPORT_MOBILE_MAX || isNarrowShortLandscapeForMenuStack(width, height);
    const touchPrimary = useCoarsePointer();
    const baselineWebGl = useMemo(() => canUseWebGL(), []);
    const [boardLiveMessage, setBoardLiveMessage] = useState('');
    const announceBoardLiveMessage = useCallback((message: string): void => {
        setBoardLiveMessage(message);
    }, []);
    const {
        gpuSurfaceLost,
        handleCanvasCreated,
        webglCanvasRemountKey
    } = useTileBoardWebglContextRecovery({ announce: announceBoardLiveMessage });
    const boardGraphicsOk = baselineWebGl && !gpuSurfaceLost;
    const cameraViewportMode = mobileCameraMode && boardGraphicsOk;
    const touchGestureMode = cameraViewportMode && touchPrimary;
    /** Mouse wheel / drag pan remains available with WebGL, including hybrid touch + pointer devices. */
    const desktopCameraMode = boardGraphicsOk;
    const frameRef = useRef<HTMLDivElement>(null);
    const boardAppRef = useRef<HTMLDivElement>(null);
    const shuffleClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const entranceClearTimeoutRef = useRef<number | null>(null);
    const [shuffleAnimating, setShuffleAnimating] = useState(false);
    const [shuffleMotionDeadlineMs, setShuffleMotionDeadlineMs] = useState(0);
    /** Mirrors FLIP motion budget for WebGL FX-013 staggered deal-Z (0 = inactive). */
    const [shuffleMotionBudgetMs, setShuffleMotionBudgetMs] = useState(0);
    const [shuffleStaggerTileCount, setShuffleStaggerTileCount] = useState(0);
    const [boardEntranceMotionDeadlineMs, setBoardEntranceMotionDeadlineMs] = useState(0);
    const [boardEntranceMotionBudgetMs, setBoardEntranceMotionBudgetMs] = useState(0);
    const [boardEntranceStaggerTileCount, setBoardEntranceStaggerTileCount] = useState(0);
    const [boardEntranceAnimating, setBoardEntranceAnimating] = useState(false);
    const [boardPreStage, setBoardPreStage] = useState<'dealIn' | 'idle' | 'loading'>('idle');
    const prestageRunIdRef = useRef(0);
    const sceneHandleRef = useRef<TileBoardSceneHandle | null>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const hoverTiltRef = useRef<TileHoverTiltState>({ tileId: null, x: 0, y: 0 });
    const activeTouchPointsRef = useRef<Map<number, TileBoardGesturePoint>>(new Map());
    const gestureSnapshotRef = useRef<TileBoardPinchGestureSnapshot | null>(null);
    const mouseDragSnapshotRef = useRef<MouseDragSnapshot | null>(null);
    const chainOpportunityBeatSfxSignatureRef = useRef<string | null>(null);
    const gestureActiveRef = useRef(false);
    const selectionSuppressedRef = useRef(false);
    const [gestureActive, setGestureActive] = useState(false);
    const [selectionSuppressed, setSelectionSuppressed] = useState(false);
    const [stageWorldViewport, setStageWorldViewport] = useState<StageWorldViewport>({ height: 0, width: 0 });
    const [viewportState, setViewportState] = useState<TileBoardViewportState>(() => createFittedBoardViewport(1));
    const viewportStateRef = useRef<TileBoardViewportState>(viewportState);
    const viewportMetricsRef = useRef<TileBoardViewportMetrics | null>(null);
    const viewportResetTokenRef = useRef(viewportResetToken);
    const [focusedTileId, setFocusedTileId] = useState<string | null>(null);
    /** When false, no tile should show the keyboard focus ring (avoids a permanent “hover” on first pickable tile). */
    const [boardApplicationFocused, setBoardApplicationFocused] = useState(false);
    const [trapResolutionMessage, setTrapResolutionMessage] = useState('');
    const [trapResolutionDetails, setTrapResolutionDetails] = useState<{
        count: number;
        effect: string;
        next: string;
    } | null>(null);
    const [lastResolutionFeedback, setLastResolutionFeedback] = useState('');
    const previousResolvedTrapTileCountRef = useRef<number | null>(null);

    const { tiltRef: fieldTiltRef, motionParallaxSuppressed, permission, requestMotionPermission } = usePlatformTiltField({
        enabled: true,
        reduceMotion,
        surfaceRef: frameRef,
        strength: 1,
        suspended: gestureActive
    });
    const mergedFrameStyle = useMemo(() => ({ ...frameStyle }), [frameStyle]);

    const boardMotionAnimating =
        shuffleAnimating || boardEntranceAnimating || boardPreStage === 'loading';

    const boardRenderDigest = useMemo(
        () =>
            `${board.level}|${board.tiles.map((t) => `${t.id}:${t.state}`).join(',')}|${board.flippedTileIds.join(',')}`,
        [board.flippedTileIds, board.level, board.tiles]
    );

    useLayoutEffect(() => {
        if (!import.meta.env.DEV || !boardWebglPerfSampleVerboseEnabled()) {
            return;
        }

        const t0 = performance.now();
        queueMicrotask(() => {
            boardWebglPerfSampleRecordReactCommit(performance.now() - t0);
        });
    }, [boardRenderDigest]);

    const includeDevAttributes = import.meta.env.DEV;
    const traitRewardHotTileIds = useMemo(() => {
        if (runStatus !== 'playing' || !chainContext) {
            return [];
        }
        const nextReward = getChainRewardForecastCues(
            chainContext.currentStreak + 1,
            chainContext.comboShards,
            chainContext.lives
        )[0];
        if (!nextReward || nextReward.distance > 1) {
            return [];
        }
        return [...getTraitOpportunityTileIds(board)];
    }, [board, chainContext, runStatus]);
    const perkArmedTileIds = useMemo(() => {
        if (runStatus !== 'playing' || !chainContext?.armedPerkId) {
            return [];
        }
        if (chainContext.armedPerkId === 'trait_streak_toolkit') {
            return [...getTraitOpportunityTileIds(board)];
        }
        if (chainContext.armedPerkId === 'cursed_opener_greed') {
            return board.tiles
                .filter((tile) => tile.state === 'hidden' && tile.tileTraitKind === 'cursed')
                .map((tile) => tile.id);
        }
        if (chainContext.armedPerkId === 'echo_conduit_double') {
            return board.tiles
                .filter((tile) => tile.state === 'hidden' && (tile.tileTraitKind === 'echo' || tile.tileTraitKind === 'conduit'))
                .map((tile) => tile.id);
        }
        return [];
    }, [board, chainContext, runStatus]);
    const selectedTraitFollowupTileIds = useMemo(() => {
        if (runStatus !== 'playing') {
            return [];
        }
        return [...getSelectedTraitFollowupTileIds(board)];
    }, [board, runStatus]);
    const {
        cardFeedbackActionCuesAttr,
        cardFeedbackActionPriorityAttr,
        cardFeedbackBeatCountsAttr,
        cardFeedbackBeatTiersAttr,
        cardFeedbackCadencesAttr,
        cardFeedbackStatesAttr,
        cardFeedbackMarkerShapesAttr,
        cardFeedbackPrimaryActionAttr,
        cardFeedbackPrimaryCardCueAttr,
        cardFeedbackRouteGlyphsAttr,
        cardFeedbackTraitLaneActionsAttr,
        cardFeedbackTraitLaneBeatsAttr,
        cardFeedbackTraitLaneCuesAttr,
        cardFeedbackTraitLanePrimaryActionAttr,
        cardFeedbackTraitRouteIntensitiesAttr,
        cardFeedbackTraitRouteTiersAttr,
        cardFeedbackVisibleTraitPreviewCount,
        hiddenSlotsAttr,
        hiddenTileCount,
        hiddenTrapSlotsAttr,
        pickableHiddenSlotsAttr,
        resolvedTrapSlotsAttr,
        resolvedTrapTileCount
    } = useMemo(() => {
        return buildTileBoardDomSurfaceModel({
            allowGambitThirdFlip,
            board,
            boardApplicationFocused,
            debugPeekActive,
            focusedTileId,
            includeDevAttributes,
            interactive,
            peekRevealedTileIds: peekSet,
            previewActive,
            runStatus,
            perkArmedTileIds,
            selectedTraitFollowupTileIds,
            traitRewardHotTileIds,
            traitRouteTargetTileIds
        });
    }, [
        allowGambitThirdFlip,
        board,
        boardApplicationFocused,
        debugPeekActive,
        focusedTileId,
        includeDevAttributes,
        interactive,
        peekSet,
        previewActive,
        perkArmedTileIds,
        runStatus,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    ]);
    const cardFeedbackStatesValue = cardFeedbackStatesAttr ?? '';
    const cardFeedbackTraitPayoffStackActive = /\btrait-payoff-stack:\d+/.test(cardFeedbackStatesValue);
    const cardFeedbackTraitComboSurgeActive = /\btrait-combo-surge:\d+/.test(cardFeedbackStatesValue);
    useEffect(() => {
        const previous = previousResolvedTrapTileCountRef.current;
        previousResolvedTrapTileCountRef.current = resolvedTrapTileCount;
        if (previous == null || resolvedTrapTileCount <= previous) {
            return undefined;
        }

        const trapCount = Math.max(1, Math.round((resolvedTrapTileCount - previous) / 2));
        const trapLabel =
            board.tiles.find((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved')
                ?.label ?? 'Trap';
        const trapEffect = trapCount === 1 ? 'Trap effect paid' : 'Trap effects paid';
        const trapNext = 'Chase next pair';
        const message =
            trapCount === 1
                ? `Trap resolved${trapLabel === 'Trap' ? '' : `: ${trapLabel}`}. ${trapEffect}; ${trapNext}.`
                : `${trapCount} traps resolved. ${trapEffect}; ${trapNext}.`;
        queueMicrotask(() => {
            setTrapResolutionMessage(message);
            setTrapResolutionDetails({ count: trapCount, effect: trapEffect, next: trapNext });
        });
        return undefined;
    }, [board.tiles, resolvedTrapTileCount]);

    useEffect(() => {
        if (resolvedTrapTileCount === 0 && trapResolutionMessage) {
            queueMicrotask(() => {
                setTrapResolutionMessage('');
                setTrapResolutionDetails(null);
            });
        }
    }, [resolvedTrapTileCount, trapResolutionMessage]);

    useEffect(() => {
        const counts = new Map<string, number>();
        for (const tile of board.tiles) {
            const resolvingSelection = getResolvingSelectionState(board, runStatus, tile.id);
            if (resolvingSelection === 'match' || resolvingSelection === 'mismatch') {
                counts.set(resolvingSelection, (counts.get(resolvingSelection) ?? 0) + 1);
            }
        }
        const next = [...counts.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, count]) => `${key}:${count}`)
            .join(';');
        if (next) {
            // Keep the reduced-motion feedback test hook in lockstep with resolution state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLastResolutionFeedback(next);
        }
    }, [board, runStatus]);

    const boardEntranceKey = useMemo(
        () =>
            `${board.level}|${board.columns}x${board.rows}|${[...board.tiles].map((t) => t.id).sort().join('|')}`,
        [board.columns, board.level, board.rows, board.tiles]
    );
    const prevBoardEntranceKeyRef = useRef<string | null>(null);
    const notifiedBoardReadyKeyRef = useRef<string | null>(null);

    const notifyMemorizeBoardReady = useCallback(
        (key: string): void => {
            if (notifiedBoardReadyKeyRef.current === key) {
                return;
            }
            notifiedBoardReadyKeyRef.current = key;
            onMemorizeBoardReady?.(key);
        },
        [onMemorizeBoardReady]
    );

    useEffect(() => {
        if (reduceMotion) {
            prevBoardEntranceKeyRef.current = boardEntranceKey;
            queueMicrotask(() => {
                setBoardPreStage('idle');
                requestAnimationFrame(() => notifyMemorizeBoardReady(boardEntranceKey));
            });
            return;
        }
        if (prevBoardEntranceKeyRef.current === boardEntranceKey) {
            notifyMemorizeBoardReady(boardEntranceKey);
            return;
        }

        prestageRunIdRef.current += 1;
        const runId = prestageRunIdRef.current;
        queueMicrotask(() => {
            setBoardPreStage('loading');
        });

        const armEntrance = (): void => {
            const tileCountForBudget = board.tiles.filter((t) => t.state !== 'removed').length;
            const motionBudgetMs = computeBoardEntranceMotionBudgetMs(tileCountForBudget);
            const deadline = performance.now() + motionBudgetMs;

            if (entranceClearTimeoutRef.current) {
                clearTimeout(entranceClearTimeoutRef.current);
                entranceClearTimeoutRef.current = null;
            }

            setBoardEntranceMotionDeadlineMs(deadline);
            setBoardEntranceMotionBudgetMs(motionBudgetMs);
            setBoardEntranceStaggerTileCount(tileCountForBudget);
            setBoardEntranceAnimating(true);
            setBoardPreStage('dealIn');

            entranceClearTimeoutRef.current = window.setTimeout(() => {
                prevBoardEntranceKeyRef.current = boardEntranceKey;
                setBoardEntranceMotionDeadlineMs(0);
                setBoardEntranceMotionBudgetMs(0);
                setBoardEntranceStaggerTileCount(0);
                setBoardEntranceAnimating(false);
                setBoardPreStage('idle');
                entranceClearTimeoutRef.current = null;
                requestAnimationFrame(() => notifyMemorizeBoardReady(boardEntranceKey));
            }, motionBudgetMs + 100);
        };

        void (async () => {
            const preloadReady = preloadTileTextureImages().catch(() => {
                /* resilient */
            });
            const preloadTimeout = new Promise<void>((resolve) => {
                window.setTimeout(resolve, PRELOAD_READY_TIMEOUT_MS);
            });

            await Promise.all([
                new Promise<void>((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                }),
                new Promise<void>((resolve) => {
                    window.setTimeout(resolve, BOARD_PRESTAGE_DWELL_MS);
                }),
                Promise.race([preloadReady, preloadTimeout])
            ]);

            if (runId !== prestageRunIdRef.current) {
                return;
            }

            armEntrance();
        })();

        return () => {
            prestageRunIdRef.current += 1;
        };
    }, [board.tiles, boardEntranceKey, notifyMemorizeBoardReady, reduceMotion]);

    useEffect(
        () => () => {
            if (entranceClearTimeoutRef.current) {
                clearTimeout(entranceClearTimeoutRef.current);
            }
        },
        []
    );

    /**
     * DEV-only: pairKey → two grid positions for Playwright (WebGL has no memorize-phase button aria-labels).
     * Omitted in production builds — see `e2e/memorizeSnapshot.ts` `readDevPairPositionsFromFrame`.
     */
    const devE2ePairPositionsJson = useMemo(() => {
        return getDevE2ePairPositionsJson(board, includeDevAttributes);
    }, [board, includeDevAttributes]);

    useEffect(() => {
        const pickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
        queueMicrotask(() => {
            setFocusedTileId((cur) => {
                if (pickable.length === 0) {
                    return null;
                }
                if (cur && pickable.includes(cur)) {
                    return cur;
                }
                return null;
            });
        });
    }, [board, interactive, allowGambitThirdFlip]);

    const traitRewardHotText = useMemo(() => {
        if (runStatus !== 'playing' || !chainContext) {
            return null;
        }
        const nextReward = getChainRewardForecastCues(
            chainContext.currentStreak + 1,
            chainContext.comboShards,
            chainContext.lives
        )[0];
        const target = getChainTargetFeedback(chainContext.currentStreak + 1);
        return nextReward && nextReward.distance <= 1
            ? `Next reward ${nextReward.label} in ${nextReward.distanceLabel}. ${getChainRewardUrgencyCopy(nextReward)}. ${target.value}`
            : null;
    }, [chainContext, runStatus]);

    const focusedTileLabel = useMemo(() => {
        return getFocusedTileLiveLabel({
            board,
            debugPeekActive,
            destroyEligibleTileIds,
            destroyPowerVisualActive,
            focusedTileId,
            pairProximityHintsEnabled,
            peekEligibleTileIds,
            peekPowerVisualActive,
            peekRevealedTileIds: peekSet,
            previewActive,
            runStatus,
            strayEligibleTileIds,
            strayPowerVisualActive,
            tileSwapEligibleTileIds,
            tileSwapFirstTileId,
            tileSwapPowerVisualActive,
            traitRewardHotText,
            traitRewardHotTileIds,
            traitRouteHintText,
            traitRouteTargetTileIds
        });
    }, [
        board,
        debugPeekActive,
        destroyEligibleTileIds,
        destroyPowerVisualActive,
        focusedTileId,
        pairProximityHintsEnabled,
        peekEligibleTileIds,
        peekPowerVisualActive,
        peekSet,
        previewActive,
        runStatus,
        strayEligibleTileIds,
        strayPowerVisualActive,
        tileSwapEligibleTileIds,
        tileSwapFirstTileId,
        tileSwapPowerVisualActive,
        traitRewardHotText,
        traitRewardHotTileIds,
        traitRouteHintText,
        traitRouteTargetTileIds
    ]);
    const cardFeedbackActionPriorityRows = useMemo(
        () =>
            cardFeedbackActionPriorityAttr
                .split('>')
                .map((entry) => {
                    const [id, countText] = entry.split(':');
                    const count = Number(countText);
                    if (!id || !Number.isFinite(count)) {
                        return null;
                    }
                    return {
                        count,
                        id,
                        label: CARD_ACTION_PRIORITY_LABELS[id] ?? id,
                        role: cardActionPriorityRole(id),
                        screenCue: cardActionPriorityScreenCue(id),
                        tone: cardActionPriorityTone(id)
                    };
                })
                .filter(
                    (
                        row
                    ): row is {
                        count: number;
                        id: string;
                        label: string;
                        role: CardActionPriorityRole;
                        screenCue: CardActionPriorityScreenCue;
                        tone: CardActionPriorityTone;
                    } => row != null
                ),
        [cardFeedbackActionPriorityAttr]
    );
    const primaryCardActionPriorityRow =
        cardFeedbackActionPriorityRows.find((row) => row.id === cardFeedbackPrimaryActionAttr) ??
        cardFeedbackActionPriorityRows[0] ??
        null;
    const cardFeedbackShotMapRows = useMemo(
        () =>
            cardFeedbackActionPriorityRows.map((row) => ({
                ...row,
                detail: CARD_ACTION_SHOT_DETAILS[row.id] ?? 'Action lane',
                shotLabel: CARD_ACTION_SHOT_LABELS[row.id] ?? row.label
            })),
        [cardFeedbackActionPriorityRows]
    );
    const cardFeedbackShotMapAttr = useMemo(
        () => cardFeedbackShotMapRows.map((row) => `${row.id}:${row.count}`).join('>') || 'none',
        [cardFeedbackShotMapRows]
    );
    const cardFeedbackShotMapLabel = useMemo(
        () =>
            cardFeedbackShotMapRows.length > 0
                ? `Combo shot map. ${cardFeedbackShotMapRows
                      .map((row) => `${row.shotLabel}: ${row.count}. ${row.detail}`)
                      .join('. ')}.`
                : 'Combo shot map',
        [cardFeedbackShotMapRows]
    );
    const primaryCardFeedbackShotRow = cardFeedbackShotMapRows[0] ?? null;
    const cardFeedbackBeatRows = useMemo(() => {
        const counts = parseCountAttribute(cardFeedbackBeatTiersAttr);
        return CARD_FEEDBACK_BEAT_PRIORITY
            .filter((id) => counts.has(id))
            .map((id) => ({
                action: CARD_FEEDBACK_BEAT_ACTIONS[id],
                beatCount: getTraitRouteReadabilityBeatCount(id),
                count: counts.get(id) ?? 0,
                id,
                label: CARD_FEEDBACK_BEAT_LABELS[id],
                screenCue: cardFeedbackPulseScreenCue(id),
                tone: cardFeedbackPulseTone(id)
            }));
    }, [cardFeedbackBeatTiersAttr]);
    const cardFeedbackBeatMapLabel = useMemo(
        () =>
            cardFeedbackBeatRows.length > 0
                ? `Card beat map. ${cardFeedbackBeatRows
                      .map((row) => `${row.label}: ${row.count}. ${row.beatCount}-beat ${row.action}`)
                      .join('. ')}.`
                : 'Card beat map',
        [cardFeedbackBeatRows]
    );
    const cardFeedbackBeatActionMapAttr = useMemo(
        () => cardFeedbackBeatRows.map((row) => `${row.id}:${row.action}:${row.count}`).join('>') || 'none',
        [cardFeedbackBeatRows]
    );
    const primaryCardFeedbackBeatRow = cardFeedbackBeatRows[0] ?? null;
    const cardFeedbackCadenceRows = useMemo(() => {
        const rowsById = new Map(
            cardFeedbackCadencesAttr
                .split('>')
                .map((entry) => {
                    const [id, action, countText] = entry.split(':');
                    const count = Number(countText);
                    if (!id || !action || !Number.isFinite(count)) {
                        return null;
                    }
                    return [id, { action, count, id }] as const;
                })
                .filter((entry): entry is readonly [string, { action: string; count: number; id: string }] => entry != null)
        );
        return CARD_FEEDBACK_CADENCE_PRIORITY
            .filter((id) => rowsById.has(id))
            .map((id) => {
                const row = rowsById.get(id)!;
                return {
                    ...row,
                    beatCount: CARD_FEEDBACK_CADENCE_BEATS[id],
                    label: CARD_FEEDBACK_CADENCE_LABELS[id],
                    screenCue: cardFeedbackPulseScreenCue(id),
                    tone: cardFeedbackPulseTone(id)
                };
            });
    }, [cardFeedbackCadencesAttr]);
    const cardFeedbackCadenceMapLabel = useMemo(
        () =>
            cardFeedbackCadenceRows.length > 0
                ? `Card pulse map. ${cardFeedbackCadenceRows
                      .map((row) => `${row.label}: ${row.count}. ${row.action}. ${row.beatCount}-beat pulse`)
                      .join('. ')}.`
                : 'Card pulse map',
        [cardFeedbackCadenceRows]
    );
    const primaryCardFeedbackCadenceRow = cardFeedbackCadenceRows[0] ?? null;
    const primaryCardFeedbackShotAudioCue = primaryCardFeedbackShotRow
        ? cardPrimaryShotAudioCue(
              primaryCardFeedbackBeatRow?.id ?? 'none',
              primaryCardFeedbackCadenceRow?.id ?? 'none'
          )
        : 'none';
    const primaryCardFeedbackShotScreenCue = primaryCardFeedbackShotRow
        ? cardPrimaryShotScreenCue(
              primaryCardFeedbackBeatRow?.id ?? 'none',
              primaryCardFeedbackCadenceRow?.id ?? 'none'
          )
        : 'none';
    const primaryCardFeedbackShotFocus = primaryCardFeedbackShotRow
        ? cardPrimaryShotFocus(
              primaryCardFeedbackBeatRow?.id ?? 'none',
              primaryCardFeedbackCadenceRow?.id ?? 'none'
          )
        : 'none';
    const cardFeedbackTraitLaneBeatRows = useMemo(() => {
        const counts = parseCountAttribute(cardFeedbackTraitLaneCuesAttr);
        const beatCounts = parseCountAttribute(cardFeedbackTraitLaneBeatsAttr);
        const actionByLane = new Map(
            cardFeedbackTraitLaneActionsAttr
                .split('>')
                .map((entry) => {
                    const [id, action] = entry.split(':') as [TraitInteractionLaneId | undefined, string | undefined, string | undefined];
                    return id && action ? [id, action] as const : null;
                })
                .filter((entry): entry is readonly [TraitInteractionLaneId, string] => entry != null)
        );
        return [...counts.entries()].map(([id, count]) => ({
            action:
                actionByLane.get(id as TraitInteractionLaneId) ??
                (CARD_TRAIT_LANE_ORDER_SET.has(id as TraitInteractionLaneId)
                    ? getTraitInteractionLaneAction(id as TraitInteractionLaneId)
                    : 'trait route'),
            beatCount: beatCounts.get(id) ?? getTraitLaneFeedbackBeatCount(id as Parameters<typeof getTraitLaneFeedbackBeatCount>[0]),
            count,
            id,
            label: CARD_TRAIT_LANE_ORDER_SET.has(id as TraitInteractionLaneId)
                ? TRAIT_INTERACTION_LANE_LABELS[id as TraitInteractionLaneId]
                : id,
            role: cardTraitLaneRole(id)
        }));
    }, [cardFeedbackTraitLaneActionsAttr, cardFeedbackTraitLaneBeatsAttr, cardFeedbackTraitLaneCuesAttr]);
    const cardFeedbackTraitLaneBeatMapLabel = useMemo(
        () =>
            cardFeedbackTraitLaneBeatRows.length > 0
                ? `Trait lane beat map. ${cardFeedbackTraitLaneBeatRows
                      .map((row) => `${row.label}: ${row.count}. ${row.beatCount}-beat ${row.action}`)
                      .join('. ')}.`
                : 'Trait lane beat map',
        [cardFeedbackTraitLaneBeatRows]
    );
    const cardFeedbackTraitLaneBeatMapMeterFill = Math.round(
        Math.min(100, (cardFeedbackTraitLaneBeatRows.length / 5) * 100)
    );
    const primaryTraitLaneBeatRow = cardFeedbackTraitLaneBeatRows[0] ?? null;
    const primaryTraitLaneAudioCue = primaryTraitLaneBeatRow
        ? cardTraitLaneAudioCue(primaryTraitLaneBeatRow.id)
        : 'none';
    const primaryTraitLaneScreenCue = primaryTraitLaneBeatRow
        ? cardTraitLaneScreenCue(primaryTraitLaneBeatRow.id)
        : 'none';
    const chainMarkerIntensity = useMemo(() => {
        const counts = parseCountAttribute(cardFeedbackTraitRouteIntensitiesAttr);
        const id = TRAIT_ROUTE_INTENSITY_PRIORITY.find((candidate) => counts.has(candidate));
        if (!id) {
            return null;
        }
        return {
            action: TRAIT_ROUTE_INTENSITY_ACTIONS[id],
            count: counts.get(id) ?? 0,
            id,
            label: TRAIT_ROUTE_INTENSITY_LABELS[id]
        };
    }, [cardFeedbackTraitRouteIntensitiesAttr]);

    const boardChainAccessibilitySummary = useMemo(
        () =>
            getBoardChainAccessibilitySummary(board, {
                hintText: traitRouteHintText,
                rewardHotText: traitRewardHotText,
                rewardHotTileIds: new Set(traitRewardHotTileIds),
                sequenceText: traitRewardHotText
                    ? `Sequence: First match lit route. Then ${traitRewardHotText.split('.')[0]}. Keep chain target live`
                    : null,
                selectedFollowupTileIds: new Set(selectedTraitFollowupTileIds),
                targetTileIds: tileSwapPowerVisualActive ? undefined : new Set(traitRouteTargetTileIds)
            }),
        [
            board,
            selectedTraitFollowupTileIds,
            tileSwapPowerVisualActive,
            traitRewardHotText,
            traitRewardHotTileIds,
            traitRouteHintText,
            traitRouteTargetTileIds
        ]
    );
    const boardChainOpportunityMeterFill =
        boardChainAccessibilitySummary.tone === 'idle'
            ? 0
            : Math.round(
                  Math.min(
                      100,
                      ((boardChainAccessibilitySummary.readyCount +
                          boardChainAccessibilitySummary.followupCount +
                          boardChainAccessibilitySummary.surgeCount +
                          boardChainAccessibilitySummary.rewardHotCount +
                          boardChainAccessibilitySummary.setupCount) /
                          5) *
                          100
                  )
              );

    const selectedPreviewTileId = useMemo(() => {
        if (boardApplicationFocused || board.flippedTileIds.length !== 1) {
            return null;
        }
        const [tileId] = board.flippedTileIds;
        const tile = board.tiles.find((candidate) => candidate.id === tileId);
        return tile && tile.state === 'flipped' ? tile.id : null;
    }, [board.flippedTileIds, board.tiles, boardApplicationFocused]);
    const previewChipTileId = boardApplicationFocused ? focusedTileId : selectedPreviewTileId;
    const focusedPreviewChip = useMemo((): {
        action: 'Cashout' | 'Claim' | 'Preview' | 'Route' | 'Scout';
        eyebrow: string;
        lines: string[];
        kind: 'hazard' | 'trait' | 'pickup';
        rewardHotText?: string | null;
        source: 'focus' | 'selected';
        tone: 'cashout' | 'hazard' | 'pickup' | 'setup' | 'trait';
    } | null => {
        if (!previewChipTileId) {
            return null;
        }
        const focusedTile = board.tiles.find((tile) => tile.id === previewChipTileId);
        if (!focusedTile) {
            return null;
        }
        const source = boardApplicationFocused ? 'focus' as const : 'selected' as const;
        if (tileSwapPowerVisualActive && tileSwapFirstTileId && previewChipTileId !== tileSwapFirstTileId) {
            const routePreview = getTraitSwapOpportunityPreview(board, tileSwapFirstTileId, previewChipTileId).routeText;
            const lines = [
                ...new Set([
                    ...(routePreview ? [routePreview] : []),
                    ...getTileSwapTraitPreviewLines(board, tileSwapFirstTileId, previewChipTileId)
                ])
            ].slice(0, 2);
            return lines.length > 0
                ? { action: 'Route', eyebrow: 'Swap preview', lines, kind: 'trait', source, tone: 'setup' }
                : null;
        }
        const hazardTelegraph = getHazardTileTelegraph(focusedTile);
        if (hazardTelegraph.hasHazard && hazardTelegraph.label && hazardTelegraph.telegraph) {
            return {
                action: 'Scout',
                eyebrow: 'Hazard',
                lines: [hazardTelegraph.label, hazardTelegraph.telegraph],
                kind: 'hazard',
                source,
                tone: 'hazard'
            };
        }
        const traitLines = [
            ...new Set([
                ...getTileTraitInteractionPreviewLines(board, [focusedTile.id], 'match'),
                ...getTileTraitInteractionPreviewLines(board, [focusedTile.id], 'mismatch')
            ])
        ].slice(0, 2);
        if (traitLines.length > 0) {
            const rewardHot = traitRewardHotTileIds.includes(focusedTile.id) ? traitRewardHotText : null;
            return {
                action: rewardHot ? 'Cashout' : 'Preview',
                eyebrow: 'Trait combo',
                lines: traitLines,
                kind: 'trait',
                rewardHotText: rewardHot,
                source,
                tone: rewardHot ? 'cashout' : 'trait'
            };
        }
        if (focusedTile.findableKind != null) {
            return {
                action: 'Claim',
                eyebrow: 'Pickup',
                lines: [getFindableRewardText(focusedTile.findableKind)],
                kind: 'pickup',
                source,
                tone: 'pickup'
            };
        }
        return null;
    }, [
        board,
        boardApplicationFocused,
        previewChipTileId,
        tileSwapFirstTileId,
        tileSwapPowerVisualActive,
        traitRewardHotText,
        traitRewardHotTileIds
    ]);

    const boardPickupOpportunity = useMemo((): {
        count: number;
        examples: string[];
        sequenceCue: { first: string; keep: string; then: string; tone: 'cashout' | 'reward' } | null;
        stackCue: string | null;
        stackDetail: string | null;
        target: string;
        tileCount: number;
        valueLabel: string;
    } => {
        if (runStatus !== 'playing') {
            return { count: 0, examples: [], sequenceCue: null, stackCue: null, stackDetail: null, target: '', tileCount: 0, valueLabel: '' };
        }
        const examples = new Set<string>();
        const pickupPairs = new Set<string>();
        let tileCount = 0;
        for (const tile of board.tiles) {
            if (tile.state !== 'hidden' || tile.findableKind == null) {
                continue;
            }
            tileCount += 1;
            pickupPairs.add(`${tile.pairKey}:${tile.findableKind}`);
            examples.add(getFindableRewardText(tile.findableKind).replace(/\.$/, ''));
        }
        const count = pickupPairs.size;
        const valueLabel = count === 1 ? '1 reward' : `${count} rewards`;
        const nextReward =
            count > 0 && chainContext
                ? getChainRewardForecastCues(
                      chainContext.currentStreak + 1,
                      chainContext.comboShards,
                      chainContext.lives
                  )[0] ?? null
                : null;
        const stackCue = nextReward?.urgency === 'next' ? getChainRewardUrgencyCopy(nextReward) : null;
        const stackDetail = stackCue ? `${nextReward!.label} in ${nextReward!.distanceLabel}` : null;
        const target = count > 0 ? (stackCue ? 'Claim into cashout' : 'Claim before exit') : '';
        const visibleExamples = [...examples].slice(0, 2);
        const sequenceCue =
            count > 0
                ? {
                      first: target,
                      keep: visibleExamples[0] ?? valueLabel,
                      then: stackDetail ? `Cash ${stackDetail}` : 'Bank pickup reward',
                      tone: stackDetail ? 'cashout' as const : 'reward' as const
                  }
                : null;
        return { count, examples: visibleExamples, sequenceCue, stackCue, stackDetail, target, tileCount, valueLabel };
    }, [board, chainContext, runStatus]);

    const boardChainOpportunity = useMemo((): {
        chainReadyCount: number;
        chainReadyTileCount: number;
        armedPerkDetail: string | null;
        armedPerkLabel: string | null;
        armedPerkPayoff: string | null;
        beatSignal: ChainOpportunityBeatSignal | null;
        cue: string;
        examples: string[];
        nextActionDetail: string | null;
        nextActionId: 'cashout' | 'follow-up' | 'match-route' | 'prime-route' | 'idle';
        nextActionLabel: string | null;
        nextActionTone: 'cashout' | 'ready' | 'setup' | 'idle';
        nextTarget: string | null;
        priorityLabel: string | null;
        momentumLabel: string | null;
        targetPlanLabel: string | null;
        chaseLabel: string | null;
        rewardCue: string | null;
        rewardUrgencyLabel: string | null;
        rewardUrgencyTier: ChainRewardForecastCue['urgency'] | null;
        rewardHot: boolean;
        streakCashoutReady: boolean;
        selectedFollowupCount: number;
        selectedFollowupLabel: string | null;
        arcadeCallout: { label: string; tone: 'cashout' | 'surge' | 'ready' | 'setup'; value: string } | null;
        comboSurgeLabel: string | null;
        setupAction: string | null;
        setupCount: number;
        setupHint: string | null;
        setupStackCue: string | null;
        setupStackDetail: string | null;
        tone: 'ready' | 'setup';
        lines: string[];
        milestoneActionLabel: string | null;
        milestoneTargetLabel: string | null;
        milestoneTone: string | null;
        milestoneMeterFill: number;
        milestoneBeatCount: number;
    } => {
        if (runStatus !== 'playing') {
            return {
                chainReadyCount: 0,
                chainReadyTileCount: 0,
                armedPerkDetail: null,
                armedPerkLabel: null,
                armedPerkPayoff: null,
                beatSignal: null,
                cue: '',
                examples: [],
                nextActionDetail: null,
                nextActionId: 'idle',
                nextActionLabel: null,
                nextActionTone: 'idle',
                nextTarget: null,
                priorityLabel: null,
                momentumLabel: null,
                targetPlanLabel: null,
                chaseLabel: null,
                rewardCue: null,
                rewardUrgencyLabel: null,
                rewardUrgencyTier: null,
                rewardHot: false,
                streakCashoutReady: false,
                selectedFollowupCount: 0,
                selectedFollowupLabel: null,
                arcadeCallout: null,
                comboSurgeLabel: null,
                setupAction: null,
                setupCount: 0,
                setupHint: null,
                setupStackCue: null,
                setupStackDetail: null,
                tone: 'setup',
                lines: [],
                milestoneActionLabel: null,
                milestoneTargetLabel: null,
                milestoneTone: null,
                milestoneMeterFill: 0,
                milestoneBeatCount: 0
            };
        }

        const routeTargetIds = new Set(traitRouteTargetTileIds);
        let setupCount = 0;
        const readyExamples = new Set<string>();
        const traitOpportunityTileIds = getTraitOpportunityTileIds(board);

        for (const tile of board.tiles) {
            if (tile.state !== 'hidden') {
                continue;
            }
            const traitInteractionLines = getTileTraitInteractionPreviewLines(board, [tile.id], 'match');
            if (traitInteractionLines.length > 0) {
                traitInteractionLines.forEach((line) => readyExamples.add(line));
            }
            if (routeTargetIds.has(tile.id)) {
                setupCount += 1;
            }
        }

        const setupAction = setupCount > 0 && traitRouteHintText?.startsWith('Swap ') ? 'Use swap' : null;
        const chainReadyCount = readyExamples.size;
        const chainReadyTileCount = traitOpportunityTileIds.size;
        const armedPerkLabel = chainContext?.armedPerkLabel ?? null;
        const armedPerkPayoff = chainContext?.armedPerkPayoff ?? null;
        const armedPerkDetail = chainContext?.armedPerkDetail ?? null;
        const milestonePreview = chainContext ? getChainMilestonePreview(chainContext.currentStreak) : null;
        const milestoneTargetLabel = milestonePreview
            ? milestonePreview.distance <= 0
                ? milestonePreview.distanceLabel
                : `${milestonePreview.distanceLabel} to ${milestonePreview.target}`
            : null;
        const readyRouteLabel =
            chainReadyCount === 1 ? '1 route ready' : chainReadyCount > 1 ? `${chainReadyCount} routes ready` : null;
        const readyCardLabel =
            chainReadyTileCount > 0
                ? chainReadyTileCount === 1
                    ? '1 card lit'
                    : `${chainReadyTileCount} cards lit`
                : null;
        const selectedFollowupCount = selectedTraitFollowupTileIds.length;
        const selectedFollowupLabel =
            selectedFollowupCount > 0
                ? selectedFollowupCount === 1
                    ? '1 follow-up marked'
                    : `${selectedFollowupCount} follow-ups marked`
                : null;
        const upcomingReward = chainContext
            ? getChainRewardForecastCues(
                  chainContext.currentStreak + 1,
                  chainContext.comboShards,
                  chainContext.lives
              )[0] ?? null
            : null;
        const followupReady = selectedFollowupCount > 0;
        const activeRouteReady = chainReadyCount > 0 || followupReady;
        const nextReward = activeRouteReady ? upcomingReward : null;
        const setupNextReward = !activeRouteReady && setupCount > 0 ? upcomingReward : null;
        const streakCashoutReady = !activeRouteReady && setupCount === 0 && upcomingReward?.urgency === 'next';
        const rewardHotLabel = nextReward && nextReward.distance <= 1 ? 'Reward hot' : null;
        const setupStackCue = setupNextReward && setupNextReward.urgency !== 'later'
            ? getChainRewardUrgencyCopy(setupNextReward)
            : null;
        const setupStackDetail = setupStackCue ? `${setupNextReward!.label} in ${setupNextReward!.distanceLabel}` : null;
        const comboSurgeLabel = chainReadyCount > 1 ? 'Combo surge' : null;
        const priorityLabel = rewardHotLabel
            ? 'Best play'
            : followupReady
              ? 'Follow-up ready'
              : chainReadyCount > 0
                ? 'Chain play'
              : streakCashoutReady
                ? 'Cashout ready'
                : setupCount > 0
                ? 'Prime route'
                : null;
        const nextTarget = rewardHotLabel
            ? 'Match lit route for reward'
            : followupReady
              ? 'Tap marked follow-up'
              : chainReadyCount > 0
                ? nextReward
                    ? 'Prime cashout'
                    : 'Keep streak alive'
              : streakCashoutReady
                ? 'Any clean match pays'
              : setupAction
                ? `${setupAction} to connect route`
                : setupCount > 0
                  ? 'Move traits together'
                  : null;
        const lines = [
            readyRouteLabel,
            readyCardLabel,
            selectedFollowupLabel,
            rewardHotLabel,
            streakCashoutReady ? getChainRewardUrgencyCopy(upcomingReward!) : null,
            setupStackCue,
            comboSurgeLabel,
            setupAction,
            setupCount > 0 ? `${setupCount} primed` : null
        ].filter((line): line is string => line != null);
        const cue = rewardHotLabel
            ? 'Cash out'
            : streakCashoutReady
              ? 'Any match'
              : followupReady
                ? 'Follow up'
                : chainReadyCount > 0
                  ? 'Match now'
                : setupCount > 0
                  ? 'Prime move'
                  : '';
        const tone = activeRouteReady || streakCashoutReady ? 'ready' : 'setup';
        const setupHint = setupCount > 0 ? traitRouteHintText : null;
        const examples = chainReadyCount > 0
            ? [...readyExamples].slice(0, 2)
            : followupReady
              ? ['Match the marked follow-up to resolve the trait route.']
            : streakCashoutReady
              ? ['Any clean pair keeps the streak paying.']
              : setupHint
                ? [setupHint]
                : [];
        const visibleReward = nextReward ?? (streakCashoutReady ? upcomingReward : null);
        const rewardCue = visibleReward
            ? `Next reward ${visibleReward.label} in ${visibleReward.distanceLabel}`
            : null;
        const nextActionId = rewardHotLabel || streakCashoutReady
            ? 'cashout' as const
            : followupReady
              ? 'follow-up' as const
              : chainReadyCount > 0
                ? 'match-route' as const
                : setupCount > 0
                  ? 'prime-route' as const
                  : 'idle' as const;
        const nextActionLabel =
            nextActionId === 'cashout'
                ? 'Do next: cashout'
                : nextActionId === 'follow-up'
                  ? 'Do next: follow-up'
                  : nextActionId === 'match-route'
                    ? 'Do next: match route'
                    : nextActionId === 'prime-route'
                      ? 'Do next: prime route'
                      : null;
        const nextActionDetail =
            nextActionId === 'cashout'
                ? rewardHotLabel
                    ? nextTarget ?? rewardCue ?? 'Match lit route for reward'
                    : rewardCue ?? nextTarget ?? 'Any clean match pays'
                : nextActionId === 'follow-up'
                  ? selectedFollowupLabel ?? nextTarget ?? 'Tap marked follow-up'
                  : nextActionId === 'match-route'
                    ? examples[0] ?? nextTarget ?? 'Match lit route'
                    : nextActionId === 'prime-route'
                      ? setupHint ?? nextTarget ?? 'Move traits together'
                      : null;
        const nextActionTone =
            nextActionId === 'cashout'
                ? 'cashout' as const
                : nextActionId === 'prime-route'
                  ? 'setup' as const
                  : nextActionId === 'idle'
                    ? 'idle' as const
                    : 'ready' as const;
        const rewardUrgencyLabel = visibleReward ? getChainRewardUrgencyCopy(visibleReward) : null;
        const rewardUrgencyTier = visibleReward?.urgency ?? null;
        const momentumLabel = chainContext && chainContext.currentStreak > 0 ? `x${chainContext.currentStreak} streak` : null;
        const targetPlanLabel =
            (activeRouteReady || streakCashoutReady) && chainContext
                ? getChainTargetFeedback(chainContext.currentStreak + 1).value
                : null;
        const chaseLabel = visibleReward ? `${visibleReward.distanceLabel} to reward` : null;
        const rewardHot = Boolean(rewardHotLabel);
        const arcadeCallout = rewardHotLabel
            ? {
                  label: 'Cashout shot',
                  tone: 'cashout' as const,
                  value: nextTarget ?? 'Match lit route'
              }
            : comboSurgeLabel
              ? {
                    label: 'Surge chain',
                    tone: 'surge' as const,
                    value: readyCardLabel ?? readyRouteLabel ?? 'Multiple routes'
                }
              : followupReady
                ? {
                      label: 'Follow-up',
                      tone: 'ready' as const,
                      value: selectedFollowupLabel ?? 'Marked card'
                  }
                : chainReadyCount > 0
                  ? {
                        label: 'Chain shot',
                        tone: 'ready' as const,
                        value: readyCardLabel ?? readyRouteLabel ?? 'Match lit route'
                    }
                  : setupCount > 0
                    ? {
                          label: 'Prime shot',
                          tone: 'setup' as const,
                          value: setupAction ?? 'Move traits together'
                      }
                    : null;
        const beatSignal = getChainOpportunityBeatSignal({
            chainReadyCount,
            comboSurgeLabel,
            followupReady,
            nextTarget,
            readyCardLabel,
            readyRouteLabel,
            rewardCue,
            rewardHot: Boolean(rewardHotLabel),
            selectedFollowupLabel,
            setupAction,
            setupCount,
            streakCashoutReady
        });

        return {
            chainReadyCount,
            chainReadyTileCount,
            armedPerkDetail,
            armedPerkLabel,
            armedPerkPayoff,
            beatSignal,
            cue,
            examples,
            nextActionDetail,
            nextActionId,
            nextActionLabel,
            nextActionTone,
            nextTarget,
            priorityLabel,
            momentumLabel,
            targetPlanLabel,
            chaseLabel,
            rewardCue,
            rewardUrgencyLabel,
            rewardUrgencyTier,
            rewardHot,
            streakCashoutReady,
            selectedFollowupCount,
            selectedFollowupLabel,
            arcadeCallout,
            comboSurgeLabel,
            setupAction,
            setupCount,
            setupHint,
            setupStackCue,
            setupStackDetail,
            tone,
            lines,
            milestoneActionLabel: milestonePreview?.actionLabel ?? null,
            milestoneTargetLabel,
            milestoneTone: milestonePreview?.tone ?? null,
            milestoneBeatCount: chainContext ? getChainMilestoneBeatCount(chainContext.currentStreak) : 0,
            milestoneMeterFill: milestonePreview
                ? Math.max(
                      0,
                      Math.min(
                          100,
                          Math.round(
                              (((milestonePreview.tone === 'combo' ? 10 : milestonePreview.tone === 'surge' ? 6 : 3) -
                                  milestonePreview.distance) /
                                  (milestonePreview.tone === 'combo' ? 10 : milestonePreview.tone === 'surge' ? 6 : 3)) *
                                  100
                          )
                      )
                  )
                : 0
        };
    }, [board, chainContext, runStatus, selectedTraitFollowupTileIds, traitRouteHintText, traitRouteTargetTileIds]);

    const boardChainOpportunityNextActionMeterFill =
        boardChainOpportunity.nextActionId === 'cashout'
            ? 100
            : boardChainOpportunity.nextActionId === 'follow-up'
              ? 75
              : boardChainOpportunity.nextActionId === 'prime-route'
                ? 50
                : 60;
    const boardChainOpportunityNextActionTier =
        boardChainOpportunity.nextActionId === 'cashout'
            ? 'now'
            : boardChainOpportunity.nextActionId === 'follow-up'
              ? 'tap'
              : boardChainOpportunity.nextActionId === 'match-route'
                ? 'route'
                : boardChainOpportunity.nextActionId === 'prime-route'
                  ? 'prime'
                  : 'setup';
    const boardChainOpportunityNextActionVerb =
        boardChainOpportunity.nextActionId === 'cashout'
            ? 'Now'
            : boardChainOpportunity.nextActionId === 'follow-up'
              ? 'Tap'
              : boardChainOpportunity.nextActionId === 'match-route'
                ? 'Match'
                : boardChainOpportunity.nextActionId === 'prime-route'
                  ? 'Prime'
                  : 'Setup';

    useEffect(() => {
        const beatSignal = boardChainOpportunity.beatSignal;
        if (!beatSignal || runStatus !== 'playing') {
            chainOpportunityBeatSfxSignatureRef.current = null;
            return;
        }
        const signature = [
            beatSignal.tier,
            beatSignal.beatCount,
            boardChainOpportunity.nextActionId,
            boardChainOpportunity.nextTarget ?? 'none'
        ].join(':');
        if (chainOpportunityBeatSfxSignatureRef.current === signature) {
            return;
        }
        chainOpportunityBeatSfxSignatureRef.current = signature;
        void resumeAudioContext();
        playChainOpportunityBeatSfx(shuffleSfxGain, beatSignal.tier, beatSignal.beatCount);
    }, [
        boardChainOpportunity.beatSignal,
        boardChainOpportunity.nextActionId,
        boardChainOpportunity.nextTarget,
        runStatus,
        shuffleSfxGain
    ]);

    const boardChainRewardForecastCues = useMemo(
        () =>
            runStatus === 'playing' && chainContext
                ? getChainRewardForecastCues(
                      chainContext.currentStreak,
                      chainContext.comboShards,
                      chainContext.lives
                  )
                : [],
        [chainContext, runStatus]
    );
    const boardRewardLadder = useMemo(
        () =>
            chainContext
                ? boardChainRewardLadder(chainContext.currentStreak, boardChainRewardForecastCues)
                : [],
        [boardChainRewardForecastCues, chainContext]
    );
    const boardRewardLadderAttr = useMemo(() => boardChainRewardLadderAttr(boardRewardLadder), [boardRewardLadder]);
    const boardRewardLadderActionAttr = useMemo(
        () => boardChainRewardLadderActionAttr(boardRewardLadder),
        [boardRewardLadder]
    );
    const boardRewardLadderAccessibleLabel = useMemo(
        () => boardChainRewardLadderLabel(boardRewardLadder),
        [boardRewardLadder]
    );
    const boardRewardLeadEntry = boardRewardLadder[0] ?? null;
    const boardRewardLeadLabel = boardRewardLeadEntry
        ? formatBoardFeedbackLabel('Next reward', [
              boardRewardLeadEntry.cue.chaseLabel,
              boardRewardLeadEntry.action,
              boardRewardLeadEntry.cue.label,
              boardRewardLeadEntry.progressLabel,
              boardRewardLeadEntry.remainingLabel
          ])
        : undefined;
    const boardRewardLadderFocusId = useMemo(
        () => {
            if (boardRewardLadder.some((entry) => entry.cue.urgency === 'next')) {
                return 'next';
            }

            return boardRewardLadder.some((entry) => entry.cue.urgency === 'soon') ? 'soon' : null;
        },
        [boardRewardLadder]
    );

    const boardTraitModeCue = useMemo((): {
        detail: string;
        nextReward: string | null;
        label: 'Trait mode';
        tone: 'cashout' | 'surge' | 'ready' | 'setup';
        value: string;
    } | null => {
        if (runStatus !== 'playing') {
            return null;
        }
        if (boardChainOpportunity.rewardHot) {
            return {
                detail: boardChainOpportunity.rewardUrgencyLabel ?? boardChainOpportunity.nextTarget ?? 'Match lit route for reward',
                nextReward: boardChainOpportunity.rewardCue ?? boardChainOpportunity.nextTarget ?? 'Match lit route for reward',
                label: 'Trait mode',
                tone: 'cashout',
                value: /\btrait-payoff-stack:\d+/.test(cardFeedbackStatesAttr ?? '') ? 'Stack live' : 'Cashout live'
            };
        }
        if (boardChainOpportunity.comboSurgeLabel) {
            return {
                detail:
                    boardChainOpportunity.chainReadyCount === 1
                        ? '1 route ready'
                        : `${boardChainOpportunity.chainReadyCount} routes ready`,
                nextReward: boardChainOpportunity.rewardCue ?? boardChainOpportunity.nextTarget ?? 'Match highlighted traits',
                label: 'Trait mode',
                tone: 'surge',
                value: 'Surge live'
            };
        }
        if (boardChainOpportunity.chainReadyCount > 0 || boardChainOpportunity.selectedFollowupCount > 0) {
            return {
                detail:
                    boardChainOpportunity.selectedFollowupLabel ??
                    boardChainOpportunity.examples[0] ??
                    boardChainOpportunity.nextTarget ??
                    'Match highlighted traits',
                nextReward: boardChainOpportunity.rewardCue ?? boardChainOpportunity.nextTarget ?? 'Keep the chain alive',
                label: 'Trait mode',
                tone: 'ready',
                value: boardChainOpportunity.selectedFollowupCount > 0 ? 'Follow-up live' : 'Route live'
            };
        }
        if (boardChainOpportunity.setupCount > 0) {
            return {
                detail: boardChainOpportunity.setupHint ?? boardChainOpportunity.nextTarget ?? 'Move traits together',
                nextReward: boardChainOpportunity.nextTarget ?? 'Move traits together',
                label: 'Trait mode',
                tone: 'setup',
                value: 'Prime route'
            };
        }
        return null;
    }, [boardChainOpportunity, cardFeedbackStatesAttr, runStatus]);
    const boardChainSequenceCue = useMemo((): {
        first: string;
        keep: string;
        then: string;
        tone: 'cashout' | 'followup' | 'setup';
    } | null => {
        if (runStatus !== 'playing') {
            return null;
        }
        if (boardChainOpportunity.selectedFollowupCount > 0) {
            return {
                first: boardChainOpportunity.nextTarget ?? 'Tap marked follow-up',
                keep: boardChainOpportunity.targetPlanLabel ?? 'Keep chain target live',
                then: boardChainOpportunity.examples[0] ?? 'Resolve trait route',
                tone: 'followup'
            };
        }
        if (boardChainOpportunity.setupCount > 0) {
            return {
                first: boardChainOpportunity.nextActionDetail ?? boardChainOpportunity.nextTarget ?? 'Prime route',
                keep: boardChainOpportunity.setupStackDetail ?? 'Keep reward stack primed',
                then: 'Match lit route',
                tone: 'setup'
            };
        }
        if (boardChainOpportunity.rewardHot || boardChainOpportunity.streakCashoutReady) {
            const rewardLabel = boardChainOpportunity.rewardCue
                ? boardChainOpportunity.rewardCue.replace(/^Next reward /, 'Cash ')
                : boardChainOpportunity.rewardUrgencyLabel ?? 'Cash reward';
            return {
                first: (boardChainOpportunity.nextTarget ?? boardChainOpportunity.cue) || 'Match clean',
                keep: boardChainOpportunity.targetPlanLabel ?? 'Keep chain alive',
                then: rewardLabel,
                tone: 'cashout'
            };
        }
        return null;
    }, [boardChainOpportunity, runStatus]);

    const boardHazardOpportunity = useMemo((): {
        count: number;
        detail: string;
        label: string;
        valueLabel: string;
    } => {
        if (runStatus !== 'playing') {
            return { count: 0, detail: '', label: '', valueLabel: '' };
        }
        const summary = getHazardTileBoardSummary(board);
        const first = summary.rows[0] ?? null;
        if (!first) {
            return { count: 0, detail: '', label: '', valueLabel: '' };
        }
        return {
            count: summary.totalHazardTiles,
            detail: first.telegraph,
            label: first.label,
            valueLabel: summary.totalHazardTiles === 1 ? '1 hazard' : `${summary.totalHazardTiles} hazards`
        };
    }, [board, runStatus]);

    const activePowerBoardChip = useMemo((): {
        detail: string;
        first: string;
        label: string;
        then: string;
        beats: 2 | 3 | 4;
        tone: 'setup' | 'control' | 'recall';
    } | null => {
        if (runStatus !== 'playing') {
            return null;
        }
        if (tileSwapPowerVisualActive) {
            return tileSwapFirstTileId
                ? {
                      beats: 2,
                      label: 'Swap armed',
                      detail: 'Place target',
                      first: 'Pick target',
                      then: 'Preview route payoff',
                      tone: 'setup'
                  }
                : {
                      beats: 2,
                      label: 'Swap armed',
                      detail: 'Pick first tile',
                      first: 'Pick source',
                      then: 'Move into combo route',
                      tone: 'setup'
                  };
        }
        if (destroyPowerVisualActive) {
            return {
                beats: 3,
                label: 'Destroy armed',
                detail: 'Tap hidden pair',
                first: 'Mark pair',
                then: 'Clear blocker',
                tone: 'control'
            };
        }
        if (peekPowerVisualActive) {
            return {
                beats: 3,
                label: 'Peek armed',
                detail: 'Tap hidden tile',
                first: 'Reveal one',
                then: 'Lock memory route',
                tone: 'recall'
            };
        }
        if (strayPowerVisualActive) {
            return {
                beats: 3,
                label: 'Stray armed',
                detail: 'Remove singleton',
                first: 'Find stray',
                then: 'Open board space',
                tone: 'control'
            };
        }
        if (pinModeBoardHintActive) {
            return {
                beats: 3,
                label: 'Pin mode',
                detail: 'Mark memory',
                first: 'Pin clue',
                then: 'Return for pair',
                tone: 'recall'
            };
        }
        return null;
    }, [
        destroyPowerVisualActive,
        peekPowerVisualActive,
        pinModeBoardHintActive,
        runStatus,
        strayPowerVisualActive,
        tileSwapFirstTileId,
        tileSwapPowerVisualActive
    ]);
    const traitOpportunitySummary = useMemo(() => getTraitOpportunitySummary(board), [board]);

    const boardOpportunityCompassRows = useMemo(
        (): BoardOpportunityCompassRow[] => {
            if (runStatus !== 'playing') {
                return [];
            }

            const rows: BoardOpportunityCompassRow[] = [];

            if (recoveryContext) {
                rows.push({
                    action: recoveryContext.action,
                    detail: recoveryContext.detail,
                    id: 'recovery',
                    impactCue: recoveryContext.impactCue,
                    label: 'Recovery',
                    tone: recoveryContext.tone,
                    value: recoveryContext.value
                });
            }

            if (boardChainOpportunity.chainReadyTileCount > 0 || boardChainOpportunity.selectedFollowupCount > 0) {
                rows.push({
                    action: boardChainOpportunity.rewardHot
                        ? 'Cash out'
                        : boardChainOpportunity.selectedFollowupCount > 0
                          ? 'Follow up'
                          : 'Match',
                    detail: [
                        boardChainOpportunity.selectedFollowupLabel,
                        boardChainOpportunity.nextTarget,
                        boardChainOpportunity.examples[0] ?? 'Match a highlighted trait card to cash the route.',
                        boardChainOpportunity.targetPlanLabel,
                        boardChainOpportunity.momentumLabel,
                        boardChainOpportunity.chaseLabel,
                        boardChainOpportunity.rewardUrgencyLabel,
                        boardChainOpportunity.rewardCue
                    ].filter(Boolean).join(' / '),
                    id: 'chain',
                    impactCue: boardChainOpportunity.rewardHot
                        ? boardPickupOpportunity.count > 0 && boardChainOpportunity.armedPerkLabel
                            ? 'Super stack'
                            : boardPickupOpportunity.count > 0 || boardChainOpportunity.armedPerkLabel
                            ? 'Stack cashout'
                            : 'Route cashout'
                        : boardChainOpportunity.selectedFollowupCount > 0
                          ? 'Follow-up route'
                        : boardChainOpportunity.comboSurgeLabel
                          ? 'Combo surge'
                          : boardChainOpportunity.rewardCue
                            ? 'Prime cashout'
                            : 'Keep streak',
                    label: 'Combo route',
                    tone: 'chain',
                    value:
                        boardChainOpportunity.selectedFollowupLabel ??
                        (boardChainOpportunity.chainReadyCount === 1
                            ? '1 route ready'
                            : `${boardChainOpportunity.chainReadyCount} routes ready`)
                });
            } else if (boardChainOpportunity.streakCashoutReady) {
                rows.push({
                    action: 'Match',
                    detail: [
                        boardChainOpportunity.nextTarget,
                        boardChainOpportunity.targetPlanLabel,
                        boardChainOpportunity.momentumLabel,
                        boardChainOpportunity.chaseLabel,
                        boardChainOpportunity.rewardUrgencyLabel,
                        boardChainOpportunity.rewardCue,
                        boardChainOpportunity.examples[0]
                    ].filter(Boolean).join(' / '),
                    id: 'chain',
                    impactCue:
                        boardPickupOpportunity.count > 0 && boardChainOpportunity.armedPerkLabel
                            ? 'Super stack'
                            : boardPickupOpportunity.count > 0 || boardChainOpportunity.armedPerkLabel
                            ? 'Stack cashout'
                            : 'Chain cashout',
                    label: 'Streak reward',
                    tone: 'chain',
                    value: boardChainOpportunity.rewardCue?.replace(/^Next reward /, '') ?? 'Reward ready'
                });
            } else if (boardChainOpportunity.setupCount > 0) {
                rows.push({
                    action: boardChainOpportunity.setupAction ?? 'Route',
                    detail: [
                        boardChainOpportunity.nextTarget,
                        boardChainOpportunity.setupStackCue,
                        boardChainOpportunity.setupStackDetail,
                        boardChainOpportunity.setupHint ?? 'Use row/swap tools to connect the marked route cards.'
                    ].filter(Boolean).join(' / '),
                    id: 'chain',
                    impactCue: boardChainOpportunity.setupStackCue ? 'Stack prime' : 'Route prime',
                    label: 'Route prime',
                    tone: 'setup',
                    value: `${boardChainOpportunity.setupCount} primed`
                });
            }

            if (traitOpportunitySummary.tiles.length > 0) {
                const traitComboRewardCue = (
                    boardChainOpportunity.rewardCue ??
                    boardChainOpportunity.rewardUrgencyLabel ??
                    boardChainOpportunity.nextTarget ??
                    null
                )?.replace(/^Next reward\s*/i, '');
                const traitOpportunityLabel = cardFeedbackTraitPayoffStackActive ? 'Trait stack' : 'Trait combo';
                rows.push({
                    action: 'Study',
                    detail: [
                        traitOpportunitySummary.tiles
                            .slice(0, 4)
                            .map((tile) => `${tile.label} (${tile.traitKind})`)
                            .join(' / '),
                        traitOpportunitySummary.interactionLines[0] ?? 'Trait combo ready',
                        traitComboRewardCue ? `Next reward ${traitComboRewardCue}` : null,
                        traitOpportunitySummary.reason
                    ]
                        .filter(Boolean)
                        .join(' / '),
                    id: 'trait',
                    impactCue:
                        cardFeedbackTraitPayoffStackActive
                            ? traitOpportunitySummary.tiles.length > 1
                                ? 'Trait stack surge'
                                : 'Trait stack route'
                            : traitOpportunitySummary.tiles.length > 1
                              ? 'Trait combo surge'
                              : 'Trait combo route',
                    label: traitOpportunityLabel,
                    tone: 'trait',
                    value:
                        traitOpportunitySummary.tiles.length === 1
                            ? '1 combo card lit'
                            : `${traitOpportunitySummary.tiles.length} combo cards lit`
                });
            }

            if (boardHazardOpportunity.count > 0) {
                rows.push({
                    action: 'Scout',
                    detail: boardHazardOpportunity.detail,
                    id: 'hazard',
                    impactCue: 'Avoid penalty',
                    label: 'Risk',
                    tone: 'hazard',
                    value: boardHazardOpportunity.valueLabel
                });
            }

            if (boardChainOpportunity.armedPerkLabel) {
                rows.push({
                    action: 'Cash',
                    detail: [
                        boardChainOpportunity.armedPerkDetail,
                        boardChainOpportunity.armedPerkPayoff,
                        'Resolve the matching trait route while the perk is armed.'
                    ].filter(Boolean).join(' / '),
                    id: 'perk',
                    impactCue: 'Perk armed',
                    label: 'Perk payoff',
                    tone: 'perk',
                    value: boardChainOpportunity.armedPerkLabel
                });
            }

            if (boardPickupOpportunity.count > 0) {
                rows.push({
                    action: 'Claim',
                    detail: [
                        boardPickupOpportunity.target,
                        boardPickupOpportunity.stackCue,
                        boardPickupOpportunity.stackDetail,
                        boardPickupOpportunity.examples[0] ?? 'Clear pickup-marked pairs before the floor ends.'
                    ].filter(Boolean).join(' / '),
                    id: 'pickup',
                    impactCue: boardPickupOpportunity.stackCue ? 'Stack prime' : 'Pickup cashout',
                    label: 'Rewards',
                    tone: 'pickup',
                    value: boardPickupOpportunity.valueLabel
                });
            }

            if (activePowerBoardChip) {
                rows.push({
                    action: 'Use',
                    detail: activePowerBoardChip.detail,
                    id: 'tool',
                    impactCue:
                        activePowerBoardChip.tone === 'recall'
                            ? 'Recall tool'
                            : activePowerBoardChip.tone === 'control'
                              ? 'Control tool'
                              : 'Tool route',
                    label: 'Tool',
                    tone: activePowerBoardChip.tone,
                    value: activePowerBoardChip.label
                });
            }

            return rows.slice(0, 4);
        },
        [
            activePowerBoardChip,
            boardChainOpportunity,
            boardHazardOpportunity,
            boardPickupOpportunity,
            recoveryContext,
            runStatus,
            cardFeedbackTraitPayoffStackActive,
            traitOpportunitySummary.interactionLines,
            traitOpportunitySummary.reason,
            traitOpportunitySummary.tiles
        ]
    );
    const boardPayoffStackRows = boardOpportunityCompassRows.filter((row) =>
        row.id === 'chain' || row.id === 'perk' || row.id === 'pickup' || row.id === 'recovery' || row.id === 'tool'
    );
    const boardPayoffStackLabelForRow = (row: BoardOpportunityCompassRow): string =>
        row.id === 'chain' ? 'Stack route' : row.label;
    const boardOpportunityLaneMapRows = boardOpportunityLaneMap(boardOpportunityCompassRows);
    const primaryBoardOpportunityLane = boardOpportunityLaneMapRows[0] ?? null;
    const boardOpportunityLaneMapAttrValue = boardOpportunityLaneMapAttr(boardOpportunityLaneMapRows);
    const boardOpportunityLaneActionMapAttrValue = boardOpportunityLaneActionMapAttr(boardOpportunityLaneMapRows);
    const boardOpportunityLaneRoleMapAttrValue = boardOpportunityLaneRoleMapAttr(boardOpportunityLaneMapRows);
    const boardOpportunityLaneMapAccessibleLabel = boardOpportunityLaneMapLabel(boardOpportunityLaneMapRows);
    const boardOpportunityLaneMapMeterFill = primaryBoardOpportunityLane
        ? Math.round(
              Math.min(100, ((boardOpportunityLaneMapRows.length + boardOpportunityLaneBeatCount(primaryBoardOpportunityLane)) / 8) * 100)
          )
        : 0;
    const boardOpportunityLaneMapLiveText =
        boardOpportunityLaneMapRows.length > 1
            ? ` Decision lanes: ${boardOpportunityLaneMapRows.map((lane) => `${lane.label} ${boardOpportunityLaneRole(lane)} ${lane.count}, ${lane.action}`).join(', ')}.`
            : '';
    const boardPayoffStack: BoardPayoffStack | null =
        boardPayoffStackRows.length >= 2
            ? (() => {
                  const impactCues = new Set(boardPayoffStackRows.map((row) => row.impactCue));
                  const tone: BoardPayoffStackTone = impactCues.has('Super stack')
                      ? 'cashout'
                      : impactCues.has('Stack cashout')
                      ? 'cashout'
                      : impactCues.has('Stack prime')
                        ? 'setup'
                        : impactCues.has('Follow-up route')
                          ? 'followup'
                          : 'build';
                  const cue =
                      impactCues.has('Super stack')
                          ? 'Super stack'
                          : tone === 'cashout'
                          ? 'Stack cashout'
                          : tone === 'setup'
                          ? 'Stack prime'
                            : tone === 'followup'
                              ? 'Follow-up stack'
                              : 'Stack prime';
                  const action =
                      impactCues.has('Super stack')
                          ? 'Cash super stack'
                          : tone === 'cashout'
                          ? 'Cash now'
                          : tone === 'setup'
                            ? 'Prime'
                          : tone === 'followup'
                              ? 'Next tap'
                              : 'Prime';
                  const firstRow = boardPayoffStackRows[0] ?? null;
                  const secondRow = boardPayoffStackRows[1] ?? null;
                  const thirdRow = boardPayoffStackRows[2] ?? null;
                  const first = firstRow ? `${firstRow.action} ${boardPayoffStackLabelForRow(firstRow).toLowerCase()}` : 'Act';
                  const then = secondRow ? `${secondRow.action} ${boardPayoffStackLabelForRow(secondRow).toLowerCase()}` : 'Lock payoff route';
                  const keep = thirdRow
                      ? `${thirdRow.action} ${boardPayoffStackLabelForRow(thirdRow).toLowerCase()}`
                      : tone === 'cashout'
                        ? 'Keep chain target live'
                        : tone === 'followup'
                          ? 'Keep route moving'
                          : 'Keep reward stack primed';
                  const crescendo: BoardPayoffStack['crescendo'] =
                      impactCues.has('Super stack')
                          ? {
                                beatCount: 5,
                                detail: 'Five-beat super cashout window',
                                label: 'Super burst',
                                screenCue: 'super',
                                tier: 'super'
                            }
                          : tone === 'cashout'
                            ? {
                                  beatCount: 3,
                                  detail: 'Three-beat cashout route is live',
                                  label: 'Cashout beat',
                                  screenCue: 'snap',
                                  tier: 'cashout'
                              }
                            : boardPayoffStackRows.length >= 3
                              ? {
                                    beatCount: 4,
                                    detail: 'Four-beat stacked route is primed',
                                    label: 'Stack burst',
                                    screenCue: 'burst',
                                    tier: 'stack'
                                }
                              : {
                                    beatCount: 2,
                                    detail: 'Two-beat payoff route is primed',
                                    label: 'Prime beat',
                                    screenCue: 'pulse',
                                    tier: 'prime'
                                };
                  return {
                      action,
                      crescendo,
                      cue,
                      detail: boardPayoffStackRows
                          .slice(0, 3)
                          .map((row) => boardPayoffStackLabelForRow(row))
                          .join(' + '),
                      heat: tone === 'cashout' ? 'cashout' : 'prime',
                      nextCue: `First: ${first}`,
                      sequence: { first, keep, then },
                      sequenceCue: `Then: ${then}`,
                      tone,
                      value: `${boardPayoffStackRows.length} payoffs live`
                  };
              })()
            : null;
    const boardPayoffStackFill = boardPayoffStack ? Math.round(Math.min(100, (boardPayoffStack.crescendo.beatCount / 5) * 100)) : 0;
    const boardBestOpportunity = boardOpportunityCompassRows[0] ?? null;
    const boardBestOpportunityHeat = boardBestOpportunity ? getBoardOpportunityHeat(boardBestOpportunity.impactCue) : 'none';
    const boardBestOpportunityBeatCount = boardBestOpportunity ? getBoardOpportunityBeatCount(boardBestOpportunity) : 0;
    const boardOpportunityCompassMeterFill = Math.round(
        Math.min(100, ((boardOpportunityCompassRows.length + boardBestOpportunityBeatCount) / 10) * 100)
    );
    const boardOpportunityCompassLabel =
        boardOpportunityCompassRows.length > 0
            ? `Board opportunity compass. ${boardOpportunityCompassRows
                      .map(
                          (row, index) =>
                          `${index === 0 ? 'Best play. ' : ''}${row.impactCue}. ${row.label}: ${row.value}. ${row.action}: ${row.detail}`
                      )
                  .join('. ')}.${boardOpportunityLaneMapRows.length > 1 ? ` ${boardOpportunityLaneMapAccessibleLabel}` : ''}`
            : 'Board opportunity compass';
    const boardChainOpportunityLabel = formatBoardFeedbackLabel('Board chain opportunity', [
        boardChainOpportunity.priorityLabel,
        boardChainOpportunity.nextActionLabel,
        boardChainOpportunity.nextActionDetail,
        boardChainOpportunity.cue,
        boardChainOpportunity.arcadeCallout
            ? `${boardChainOpportunity.arcadeCallout.label}: ${boardChainOpportunity.arcadeCallout.value}`
            : null,
        boardChainOpportunity.beatSignal
            ? `${boardChainOpportunity.beatSignal.label}: ${boardChainOpportunity.beatSignal.beatCount} beats: ${boardChainOpportunity.beatSignal.detail}`
            : null,
        boardChainOpportunity.nextTarget,
        boardChainOpportunity.armedPerkLabel,
        boardChainOpportunity.armedPerkPayoff,
        boardChainOpportunity.armedPerkDetail,
        boardChainOpportunity.targetPlanLabel,
        boardChainOpportunity.milestoneActionLabel && boardChainOpportunity.milestoneTargetLabel
            ? `${boardChainOpportunity.milestoneActionLabel}: ${boardChainOpportunity.milestoneTargetLabel}`
            : null,
        boardChainOpportunity.momentumLabel,
        boardChainOpportunity.chaseLabel,
        boardChainOpportunity.rewardUrgencyLabel,
        ...boardChainOpportunity.lines,
        boardChainOpportunity.rewardCue,
        ...boardChainOpportunity.examples
    ].filter((line): line is string => line != null));
    const boardTraitModeCueLabel = boardTraitModeCue
        ? formatBoardFeedbackLabel(boardTraitModeCue.label, [
              boardTraitModeCue.value,
              boardTraitModeCue.nextReward ? `Next reward: ${boardTraitModeCue.nextReward}` : null,
              boardTraitModeCue.detail
          ])
        : undefined;
    const boardChainMarkerKeyRows = useMemo(
        (): Array<{
            action: string;
            id:
                | 'linked-route'
                | 'combo-surge'
                | 'payoff-bar'
                | 'payoff-stack'
                | 'swap-target-crossbar'
                | 'perk-armed-bar'
                | 'followup-target';
            glyph: string;
            label: string;
        }> => {
            const hasPayoffStackMarker = /\bpayoff-stack:\d+/.test(cardFeedbackMarkerShapesAttr);
            const hasPerkArmedMarker = /\bperk-armed-bar:\d+/.test(cardFeedbackMarkerShapesAttr);
            if (boardChainOpportunity.chainReadyTileCount > 0 || boardChainOpportunity.selectedFollowupCount > 0) {
                return [
                    { action: 'Match route', id: 'linked-route', glyph: 'oo', label: 'Route' },
                    ...(selectedTraitFollowupTileIds.length > 0
                        ? [{ action: 'Next tap', id: 'followup-target' as const, glyph: '|=', label: 'Follow-up' }]
                        : []),
                    ...(boardChainOpportunity.chainReadyCount > 1
                        ? [{ action: 'Route prime', id: 'combo-surge' as const, glyph: '++', label: 'Surge' }]
                        : []),
                    ...(boardChainOpportunity.rewardHot
                        ? [{ action: 'Cash now', id: 'payoff-bar' as const, glyph: '=+', label: 'Payoff' }]
                        : []),
                    ...(hasPayoffStackMarker
                        ? [{ action: 'Cash stack', id: 'payoff-stack' as const, glyph: '**', label: 'Stack' }]
                        : []),
                    ...(hasPerkArmedMarker
                        ? [{ action: 'Cash perk', id: 'perk-armed-bar' as const, glyph: '+!', label: 'Perk' }]
                        : [])
                ];
            }
            if (boardChainOpportunity.setupCount > 0) {
                return [
                    { action: 'Route prime', id: 'swap-target-crossbar', glyph: 'x|', label: 'Prime' },
                    ...(hasPerkArmedMarker
                        ? [{ action: 'Cash perk', id: 'perk-armed-bar' as const, glyph: '+!', label: 'Perk' }]
                        : [])
                ];
            }
            if (hasPerkArmedMarker) {
                return [{ action: 'Cash perk', id: 'perk-armed-bar', glyph: '+!', label: 'Perk' }];
            }
            return [];
        },
        [
            boardChainOpportunity.chainReadyCount,
            boardChainOpportunity.chainReadyTileCount,
            boardChainOpportunity.rewardHot,
            boardChainOpportunity.selectedFollowupCount,
            boardChainOpportunity.setupCount,
            cardFeedbackMarkerShapesAttr,
            selectedTraitFollowupTileIds.length
        ]
    );
    const focusedChainMarkerShape = useMemo(() => {
        const markerIds = new Set(boardChainMarkerKeyRows.map((row) => row.id));
        const preferred =
            chainMarkerIntensity?.id === 'stack' || chainMarkerIntensity?.id === 'cashout'
                ? ['payoff-stack', 'payoff-bar']
                : chainMarkerIntensity?.id === 'ready'
                  ? ['followup-target', 'linked-route']
                  : chainMarkerIntensity?.id === 'surge'
                    ? ['combo-surge', 'linked-route']
                    : chainMarkerIntensity?.id === 'setup'
                      ? ['swap-target-crossbar', 'linked-route']
                      : ['perk-armed-bar', 'linked-route'];

        return preferred.find((id) => markerIds.has(id as (typeof boardChainMarkerKeyRows)[number]['id'])) ?? 'none';
    }, [boardChainMarkerKeyRows, chainMarkerIntensity?.id]);
    const boardChainMarkerKeyMeterFill = Math.round(
        Math.min(100, ((boardChainMarkerKeyRows.length + (chainMarkerIntensity ? 2 : 0)) / 6) * 100)
    );
    const boardChainRecipeChips = useMemo(
        () =>
            [
                ...new Set(
                    [...boardChainOpportunity.examples, ...traitOpportunitySummary.interactionLines]
                        .map((line) => line.split(':')[0]?.trim() ?? '')
                        .filter((line) => line.includes(' + '))
                )
            ].slice(0, 3),
        [boardChainOpportunity.examples, traitOpportunitySummary.interactionLines]
    );
    const boardTraitInteractionLines = useMemo(
        () =>
            [
                ...new Set([
                    ...boardChainOpportunity.examples,
                    ...traitOpportunitySummary.interactionLines
                ])
            ],
        [boardChainOpportunity.examples, traitOpportunitySummary.interactionLines]
    );
    const boardTraitInteractionLaneMap = useMemo(
        () => buildTraitInteractionLaneMap(boardTraitInteractionLines),
        [boardTraitInteractionLines]
    );
    const boardTraitInteractionLaneMapAttrValue = traitInteractionLaneMapAttr(boardTraitInteractionLaneMap);
    const boardTraitInteractionLaneActionMapAttrValue = traitInteractionLaneActionMapAttr(boardTraitInteractionLaneMap);
    const boardTraitInteractionLaneRoleMapAttrValue = traitInteractionLaneRoleMapAttr(boardTraitInteractionLaneMap);
    const boardTraitInteractionLaneMapAccessibleLabel = formatTraitInteractionLaneMapLabel(
        'Trait interaction lanes',
        boardTraitInteractionLaneMap
    );
    const primaryBoardTraitInteractionLane = boardTraitInteractionLaneMap[0] ?? null;
    const boardTraitInteractionLaneMapMeterFill = Math.round(Math.min(100, (boardTraitInteractionLaneMap.length / 5) * 100));
    const boardChainHotBand = boardChainOpportunity.rewardHot
        ? {
              cue: boardChainOpportunity.rewardUrgencyLabel ?? boardChainOpportunity.nextTarget ?? 'Cash out now',
              detail: boardChainOpportunity.rewardCue ?? boardChainOpportunity.nextTarget ?? 'Cash out now',
              label: 'Hot lane',
              tone: 'cashout' as const,
              value: 'Reward hot'
          }
        : boardChainOpportunity.streakCashoutReady
          ? {
                cue: boardChainOpportunity.rewardUrgencyLabel ?? boardChainOpportunity.nextTarget ?? 'Keep the streak paying',
                detail: boardChainOpportunity.nextTarget ?? boardChainOpportunity.rewardCue ?? 'Any clean match pays',
                label: 'Streak lane',
                tone: 'ready' as const,
                value: 'Cashout ready'
            }
          : null;
    const boardChainHotBandLabel = boardChainHotBand
        ? formatBoardFeedbackLabel('Chain hot band', [
              boardChainHotBand.value,
              boardChainHotBand.detail,
              boardChainHotBand.cue
          ])
        : undefined;
    const boardChainHotBandMeterFill = boardChainHotBand?.tone === 'cashout' ? 100 : boardChainHotBand ? 70 : 0;
    const boardChainMomentumBeatCount: 2 | 3 | 4 | 5 = boardChainOpportunity.rewardHot
        ? 5
        : boardChainOpportunity.comboSurgeLabel
          ? 4
          : boardChainOpportunity.selectedFollowupCount > 0
            ? 3
            : boardChainOpportunity.chainReadyCount > 0
              ? 3
              : 2;
    const boardChainMomentumTone: 'cashout' | 'followup' | 'ready' | 'setup' | 'surge' = boardChainOpportunity.rewardHot
        ? 'cashout'
        : boardChainOpportunity.comboSurgeLabel
          ? 'surge'
          : boardChainOpportunity.selectedFollowupCount > 0
            ? 'followup'
            : boardChainOpportunity.chainReadyCount > 0 || boardChainOpportunity.streakCashoutReady
              ? 'ready'
              : 'setup';
    const boardChainMomentumTier: 'hot' | 'primed' | 'ready' | 'setup' =
        boardChainMomentumTone === 'cashout'
            ? 'hot'
            : boardChainMomentumTone === 'surge'
              ? 'primed'
              : boardChainMomentumTone === 'ready' || boardChainMomentumTone === 'followup'
                ? 'ready'
                : 'setup';
    const boardChainMomentumScreenCue: 'burst' | 'guard' | 'pulse' | 'tick' =
        boardChainMomentumTone === 'cashout' || boardChainMomentumTone === 'surge'
            ? 'burst'
            : boardChainMomentumTone === 'followup'
              ? 'pulse'
              : boardChainMomentumTone === 'ready'
                ? 'guard'
                : 'tick';
    const boardChainSurgeBand = boardChainOpportunity.comboSurgeLabel
        ? {
              cue: boardChainOpportunity.cue || 'Route prime',
              detail:
                  boardChainOpportunity.chainReadyCount === 1
                      ? '1 route ready'
                      : `${boardChainOpportunity.chainReadyCount} routes ready`,
              label: 'Combo surge',
              tone: 'surge' as const,
              value:
                  boardChainOpportunity.chainReadyTileCount === 1
                      ? '1 card lit'
                      : `${boardChainOpportunity.chainReadyTileCount} cards lit`
          }
        : null;
    const boardChainSurgeBandMeterFill = boardChainSurgeBand
        ? Math.round(Math.min(100, (boardChainOpportunity.chainReadyCount / 5) * 100))
        : 0;
    const boardChainSurgeBandLabel = boardChainSurgeBand
        ? formatBoardFeedbackLabel('Chain surge band', [
              boardChainSurgeBand.label,
              boardChainSurgeBand.value,
              boardChainSurgeBand.detail,
              boardChainSurgeBand.cue
          ])
        : undefined;
    const activePowerBoardChipLabel = activePowerBoardChip
        ? formatBoardFeedbackLabel('Active board power', [
              activePowerBoardChip.label,
              activePowerBoardChip.detail,
              `First ${activePowerBoardChip.first}`,
              `Then ${activePowerBoardChip.then}`
          ])
        : undefined;
    const boardPickupOpportunityLabel = formatBoardFeedbackLabel('Board pickup opportunity', [
        boardPickupOpportunity.valueLabel,
        boardPickupOpportunity.target,
        boardPickupOpportunity.sequenceCue
            ? `Sequence: First ${boardPickupOpportunity.sequenceCue.first}. Then ${boardPickupOpportunity.sequenceCue.then}. Keep ${boardPickupOpportunity.sequenceCue.keep}`
            : null,
        boardPickupOpportunity.stackCue,
        boardPickupOpportunity.stackDetail,
        ...boardPickupOpportunity.examples
    ]);
    const boardPickupOpportunityFocus = boardPickupOpportunity.sequenceCue?.tone ?? 'none';
    const boardPickupOpportunityMeterFill =
        boardPickupOpportunityFocus === 'cashout'
            ? 100
            : Math.min(100, Math.round((boardPickupOpportunity.count / 3) * 100));
    const focusedPreviewChipLabel = focusedPreviewChip
        ? formatBoardFeedbackLabel(
              `${focusedPreviewChip.eyebrow} ${
                  focusedPreviewChip.kind === 'pickup'
                      ? 'reward'
                      : focusedPreviewChip.kind === 'hazard'
                        ? 'risk'
                        : /\btrait-payoff-stack:\d+/.test(cardFeedbackStatesAttr ?? '')
                          ? 'stack'
                          : 'combo'
              } preview`,
              [
              focusedPreviewChip.action,
              ...(focusedPreviewChip.rewardHotText ? ['Cashout', focusedPreviewChip.rewardHotText] : []),
              ...focusedPreviewChip.lines
              ]
          )
        : undefined;

    useEffect(() => {
        queueMicrotask(() => {
            if (!focusedTileLabel) {
                setBoardLiveMessage('');
                return;
            }
            const stackLiveText = boardPayoffStack
                ? ` Board stack: ${boardPayoffStack.cue}. ${boardPayoffStack.action}. ${boardPayoffStack.value}. ${boardPayoffStack.detail}. ${boardPayoffStack.crescendo.label}. ${boardPayoffStack.crescendo.detail}. ${boardPayoffStack.nextCue}.${
                      boardPayoffStack.sequenceCue ? ` ${boardPayoffStack.sequenceCue}.` : ''
                  } Keep: ${boardPayoffStack.sequence.keep}.`
                : '';
            const bestOpportunity = boardOpportunityCompassRows[0];
            const bestOpportunityLiveText = bestOpportunity
                ? ` Best play: ${bestOpportunity.impactCue}. ${bestOpportunity.label}: ${bestOpportunity.value}. ${bestOpportunity.action}: ${bestOpportunity.detail}.`
                : '';
            const rewardLeadLiveText = boardRewardLeadEntry
                ? ` Next reward: ${boardRewardLeadEntry.cue.label}. ${boardRewardLeadEntry.action}. ${boardRewardLeadEntry.progressLabel}. ${boardRewardLeadEntry.remainingLabel}.`
                : '';
            const traitModeLiveText = boardTraitModeCue
                ? ` Trait mode: ${boardTraitModeCue.value}.${boardTraitModeCue.nextReward ? ` ${boardTraitModeCue.nextReward}.` : ''} ${boardTraitModeCue.detail}.`
                : '';
            const chainLiveText =
                boardChainAccessibilitySummary.tone === 'idle' ? '' : ` ${boardChainAccessibilitySummary.label}`;
            setBoardLiveMessage(
                `Focus: ${focusedTileLabel}${bestOpportunityLiveText}${rewardLeadLiveText}${traitModeLiveText}${boardOpportunityLaneMapLiveText}${stackLiveText}${chainLiveText}`
            );
        });
    }, [
        boardChainAccessibilitySummary,
        boardOpportunityCompassRows,
        boardOpportunityLaneMapLiveText,
        boardPayoffStack,
        boardRewardLeadEntry,
        boardTraitModeCue,
        focusedTileLabel
    ]);

    useImperativeHandle(ref, () => ({
        getTileClientRectAtGrid: (row: number, col: number) => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return null;
            }
            const tile = board.tiles[r * board.columns + c];
            if (!tile) {
                return null;
            }
            return sceneHandleRef.current?.getTileClientRectById(tile.id) ?? null;
        },
        getTileClientRectById: (tileId: string) =>
            sceneHandleRef.current?.getTileClientRectById(tileId) ?? null,
        runShuffleAnimation: (applyShuffle: () => void) => {
            const g = shuffleSfxGain;
            prestageRunIdRef.current += 1;
            setBoardPreStage('idle');
            if (entranceClearTimeoutRef.current) {
                clearTimeout(entranceClearTimeoutRef.current);
                entranceClearTimeoutRef.current = null;
            }
            setBoardEntranceMotionDeadlineMs(0);
            setBoardEntranceMotionBudgetMs(0);
            setBoardEntranceStaggerTileCount(0);
            setBoardEntranceAnimating(false);

            if (reduceMotion) {
                if (shuffleClearTimeoutRef.current) {
                    clearTimeout(shuffleClearTimeoutRef.current);
                    shuffleClearTimeoutRef.current = null;
                }
                setShuffleMotionDeadlineMs(0);
                setShuffleMotionBudgetMs(0);
                setShuffleStaggerTileCount(0);
                void resumeAudioContext();
                playShuffleSfx(g, true);
                applyShuffle();
                return;
            }

            void resumeAudioContext();
            playShuffleSfx(g, false);

            const tileCountForBudget = board.tiles.filter((t) => t.state !== 'removed').length;
            const motionBudgetMs = computeShuffleMotionBudgetMs(tileCountForBudget);

            if (shuffleClearTimeoutRef.current) {
                clearTimeout(shuffleClearTimeoutRef.current);
                shuffleClearTimeoutRef.current = null;
            }

            const deadline = performance.now() + motionBudgetMs;
            setShuffleMotionDeadlineMs(deadline);
            shuffleClearTimeoutRef.current = setTimeout(() => {
                setShuffleMotionDeadlineMs(0);
                setShuffleMotionBudgetMs(0);
                setShuffleStaggerTileCount(0);
                setShuffleAnimating(false);
                shuffleClearTimeoutRef.current = null;
            }, motionBudgetMs + 100);

            setShuffleMotionBudgetMs(motionBudgetMs);
            setShuffleStaggerTileCount(tileCountForBudget);
            setShuffleAnimating(true);

            flushSync(() => {
                applyShuffle();
            });
        }
    }), [board.columns, board.rows, board.tiles, reduceMotion, shuffleSfxGain]);

    useEffect(
        () => () => {
            if (shuffleClearTimeoutRef.current) {
                clearTimeout(shuffleClearTimeoutRef.current);
            }
        },
        []
    );
    const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const activeTileCount = useMemo(
        () => board.tiles.filter((t) => t.state !== 'removed').length,
        [board.tiles]
    );
    const adaptive = resolveAdaptiveBoardRenderQuality({
        activeTileCount,
        boardHeavyMotion: boardMotionAnimating,
        boardScreenSpaceAA: boardScreenSpaceAA ?? 'auto',
        compact,
        reduceMotion,
        savedGraphicsQuality: graphicsQuality ?? 'medium'
    });
    /** Cap DPR for GPU cost (PERF-001 + internal adaptive motion tier). */
    const dpr = Math.min(deviceDpr, adaptive.dprCap);
    const resolvedBoardAa = adaptive.resolvedAa;
    /** Native framebuffer antialias; the legacy `smaa` setting falls back here now that post-FX is disabled. */
    const glAntialias = resolvedBoardAa !== 'off';
    /** Avoid forcing discrete/high-power GPU contexts unless the player explicitly chose high quality. */
    const glPowerPreference: WebGLPowerPreference = graphicsQuality === 'high' ? 'high-performance' : 'default';
    const boardWorldWidth = useMemo(
        () => (board.columns - 1) * TILE_SPACING + 1 + 2 * BOARD_LAYOUT_VIEWPORT_PADDING,
        [board.columns]
    );
    const boardWorldHeight = useMemo(
        () => (board.rows - 1) * TILE_SPACING + 1 + 2 * BOARD_LAYOUT_VIEWPORT_PADDING,
        [board.rows]
    );
    const fitMargin = cameraViewportMode ? MOBILE_CAMERA_FIT_MARGIN : compact ? COMPACT_BOARD_FIT_MARGIN : ROOMY_BOARD_FIT_MARGIN;
    const fitZoom = useMemo(
        () =>
            getBoardFitZoom({
                boardHeight: boardWorldHeight,
                boardWidth: boardWorldWidth,
                margin: fitMargin,
                viewportHeight: stageWorldViewport.height,
                viewportWidth: stageWorldViewport.width
            }),
        [boardWorldHeight, boardWorldWidth, fitMargin, stageWorldViewport.height, stageWorldViewport.width]
    );
    const renderedViewportState = useMemo(() => {
        if (!cameraViewportMode && !desktopCameraMode) {
            return createFittedBoardViewport(fitZoom);
        }

        return clampBoardViewport({
            boardHeight: boardWorldHeight,
            boardWidth: boardWorldWidth,
            fitZoom,
            panX: viewportState.panX,
            panY: viewportState.panY,
            viewportHeight: stageWorldViewport.height,
            viewportWidth: stageWorldViewport.width,
            zoom: viewportState.zoom
        });
    }, [
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        cameraViewportMode,
        desktopCameraMode,
        stageWorldViewport.height,
        stageWorldViewport.width,
        viewportState.panX,
        viewportState.panY,
        viewportState.zoom
    ]);

    const syncGestureActive = useCallback((active: boolean): void => {
        gestureActiveRef.current = active;
        setGestureActive((current) => (current === active ? current : active));
    }, [setGestureActive]);

    const syncSelectionSuppressed = useCallback((suppressed: boolean): void => {
        selectionSuppressedRef.current = suppressed;
        setSelectionSuppressed((current) => (current === suppressed ? current : suppressed));
    }, [setSelectionSuppressed]);

    const clearTouchGestureState = useCallback(
        (clearSuppression: boolean): void => {
            activeTouchPointsRef.current.clear();
            gestureSnapshotRef.current = null;
            syncGestureActive(false);
            if (clearSuppression) {
                syncSelectionSuppressed(false);
            }
        },
        [syncGestureActive, syncSelectionSuppressed]
    );

    const handleTileSelect = useCallback(
        (tileId: string): void => {
            if (selectionSuppressedRef.current) {
                return;
            }

            onTileSelect(tileId);
        },
        [onTileSelect]
    );

    const handleBoardApplicationFocus = useCallback((): void => {
        setBoardApplicationFocused(true);
        setFocusedTileId((cur) => {
            const pickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
            if (pickable.length === 0) {
                return null;
            }
            if (cur && pickable.includes(cur)) {
                return cur;
            }
            return pickable[0];
        });
    }, [board, interactive, allowGambitThirdFlip, setBoardApplicationFocused, setFocusedTileId]);

    const handleBoardApplicationBlur = useCallback((event: FocusEvent<HTMLDivElement>): void => {
        const related = event.relatedTarget;
        if (related instanceof Node && boardAppRef.current?.contains(related)) {
            return;
        }
        setBoardApplicationFocused(false);
        setFocusedTileId(null);
    }, [setBoardApplicationFocused, setFocusedTileId]);

    const handleBoardApplicationKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>): void => {
            if (!boardGraphicsOk || !interactive) {
                return;
            }
            const rawPickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
            const guidedPickable =
                guidedTargetTileIds.length > 0
                    ? rawPickable.filter((tileId) => guidedTargetTileIds.includes(tileId))
                    : rawPickable;
            const pickable = guidedPickable.length > 0 ? guidedPickable : rawPickable;
            if (pickable.length === 0) {
                return;
            }
            let dir: 'up' | 'down' | 'left' | 'right' | null = null;
            if (event.key === 'ArrowUp') dir = 'up';
            else if (event.key === 'ArrowDown') dir = 'down';
            else if (event.key === 'ArrowLeft') dir = 'left';
            else if (event.key === 'ArrowRight') dir = 'right';
            else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (focusedTileId) {
                    handleTileSelect(focusedTileId);
                }
                return;
            }
            if (dir) {
                event.preventDefault();
                const next = moveFocusInGrid(board, focusedTileId, dir, interactive, allowGambitThirdFlip);
                if (next && next !== focusedTileId) {
                    setFocusedTileId(next);
                }
            }
        },
        [
            allowGambitThirdFlip,
            board,
            boardGraphicsOk,
            focusedTileId,
            guidedTargetTileIds,
            handleTileSelect,
            interactive,
            setFocusedTileId
        ]
    );

    /**
     * DEV-only: absolute 1-based grid picks for Playwright. Keyboard nav skips non-pickable cells, so row/col offsets
     * from “first pickable” do not match memorize coordinates after the first match — see `e2e/tileBoardGameFlow.ts`.
     */
    useEffect(() => {
        if (!import.meta.env.DEV) {
            return undefined;
        }
        const w = window as Window & {
            __e2eGetTileClientRectAtGrid1?: (
                row: number,
                col: number
            ) => { bottom: number; height: number; left: number; right: number; top: number; width: number } | null;
            __e2eGetTileIdAtGrid1?: (row: number, col: number) => string | null;
            __e2ePanBoardBy?: (panX: number, panY: number) => void;
            __e2ePickTileAtGrid1?: (row: number, col: number) => void;
        };
        w.__e2eGetTileIdAtGrid1 = (row: number, col: number): string | null => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return null;
            }
            return board.tiles[r * board.columns + c]?.id ?? null;
        };
        w.__e2eGetTileClientRectAtGrid1 = (row: number, col: number) => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return null;
            }
            const tile = board.tiles[r * board.columns + c];
            if (!tile) {
                return null;
            }
            return sceneHandleRef.current?.getTileClientRectById(tile.id) ?? null;
        };
        w.__e2ePickTileAtGrid1 = (row: number, col: number): void => {
            const r = row - 1;
            const c = col - 1;
            if (r < 0 || c < 0 || r >= board.rows || c >= board.columns) {
                return;
            }
            const tile = board.tiles[r * board.columns + c];
            if (tile) {
                handleTileSelect(tile.id);
            }
        };
        w.__e2ePanBoardBy = (panX: number, panY: number): void => {
            setViewportState((current) => {
                const nextViewport = clampBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    fitZoom,
                    panX: current.panX + panX,
                    panY: current.panY + panY,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width,
                    zoom: current.zoom
                });

                viewportStateRef.current = nextViewport;
                return nextViewport;
            });
        };
        return () => {
            delete w.__e2eGetTileClientRectAtGrid1;
            delete w.__e2eGetTileIdAtGrid1;
            delete w.__e2ePanBoardBy;
            delete w.__e2ePickTileAtGrid1;
        };
    }, [
        board.columns,
        board.rows,
        board.tiles,
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        handleTileSelect,
        stageWorldViewport.height,
        stageWorldViewport.width
    ]);

    const handleStageViewportChange = useCallback((nextViewport: StageWorldViewport): void => {
        setStageWorldViewport((current) =>
            Math.abs(current.width - nextViewport.width) < 0.0001 && Math.abs(current.height - nextViewport.height) < 0.0001
                ? current
                : nextViewport
        );
    }, [setStageWorldViewport]);

    useEffect(() => {
        viewportStateRef.current = renderedViewportState;
        viewportMetricsRef.current = {
            boardHeight: boardWorldHeight,
            boardWidth: boardWorldWidth,
            fitZoom,
            viewportHeight: stageWorldViewport.height,
            viewportWidth: stageWorldViewport.width
        };
    }, [
        renderedViewportState,
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        stageWorldViewport.height,
        stageWorldViewport.width
    ]);

    useEffect(() => {
        hoverTiltRef.current = { tileId: null, x: 0, y: 0 };
    }, [board.level, board.tiles.length, reduceMotion, selectionSuppressed]);

    /* eslint-disable react-hooks/set-state-in-effect -- viewport React state must track fitted board geometry when the stage or board changes */
    useEffect(() => {
        const resetRequested = viewportResetToken !== viewportResetTokenRef.current;
        const previousViewport = viewportStateRef.current;
        const previousMetrics = viewportMetricsRef.current;
        const nextMetrics: TileBoardViewportMetrics = {
            boardHeight: boardWorldHeight,
            boardWidth: boardWorldWidth,
            fitZoom,
            viewportHeight: stageWorldViewport.height,
            viewportWidth: stageWorldViewport.width
        };

        viewportResetTokenRef.current = viewportResetToken;

        if (
            (!cameraViewportMode && !desktopCameraMode) ||
            stageWorldViewport.width <= 0 ||
            stageWorldViewport.height <= 0
        ) {
            const nextViewport = createFittedBoardViewport(fitZoom);
            viewportStateRef.current = nextViewport;
            viewportMetricsRef.current = nextMetrics;
            setViewportState(nextViewport);
            clearTouchGestureState(true);
            return;
        }

        const nextViewport =
            resetRequested || !previousMetrics
                ? createFittedBoardViewport(fitZoom)
                : carryBoardViewportForward({
                      nextMetrics,
                      previousMetrics,
                      previousViewport
                  });

        viewportStateRef.current = nextViewport;
        viewportMetricsRef.current = nextMetrics;
        setViewportState(nextViewport);
        clearTouchGestureState(true);
    }, [
        board.columns,
        board.level,
        board.rows,
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        cameraViewportMode,
        desktopCameraMode,
        stageWorldViewport.height,
        stageWorldViewport.width,
        viewportResetToken,
        clearTouchGestureState
    ]);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!touchGestureMode) {
            clearTouchGestureState(true); // eslint-disable-line react-hooks/set-state-in-effect -- reset gesture UI when leaving two-finger mode
            return;
        }

        const stageNode = stageRef.current;

        if (!stageNode) {
            return;
        }

        const stopGestureEvent = (event: globalThis.PointerEvent): void => {
            event.preventDefault();
            event.stopPropagation();
        };
        const stopTouchGestureEvent = (event: globalThis.TouchEvent): void => {
            event.preventDefault();
            event.stopPropagation();
        };

        const getTrackedGestureTouches = (): [TileBoardGesturePoint, TileBoardGesturePoint] | null => {
            const snapshot = gestureSnapshotRef.current;

            if (snapshot) {
                const first = activeTouchPointsRef.current.get(snapshot.pointerIds[0]);
                const second = activeTouchPointsRef.current.get(snapshot.pointerIds[1]);

                if (first && second) {
                    return [first, second];
                }
            }

            const touches = Array.from(activeTouchPointsRef.current.values()).slice(0, 2);

            return touches.length === 2 ? [touches[0], touches[1]] : null;
        };

        const beginGestureSession = (): void => {
            const touches = Array.from(activeTouchPointsRef.current.entries()).slice(0, 2);

            if (touches.length < 2 || stageWorldViewport.width <= 0 || stageWorldViewport.height <= 0) {
                return;
            }

            const [[firstPointerId, firstTouch], [secondPointerId, secondTouch]] = touches;
            const stageRect = stageNode.getBoundingClientRect();
            const centroid = getGestureCentroid(firstTouch, secondTouch);
            const centroidWorld = screenPointToWorld(centroid, stageRect, stageWorldViewport.width, stageWorldViewport.height);
            const activeViewport = viewportStateRef.current;

            gestureSnapshotRef.current = createPinchBoardGestureSnapshot({
                centroidWorld,
                firstPointerId,
                firstTouch,
                secondPointerId,
                secondTouch,
                viewport: activeViewport
            });

            syncGestureActive(true);
            syncSelectionSuppressed(true);
        };

        const updateGestureViewport = (): void => {
            const snapshot = gestureSnapshotRef.current;
            const trackedTouches = getTrackedGestureTouches();

            if (!snapshot || !trackedTouches) {
                return;
            }

            const [firstTouch, secondTouch] = trackedTouches;
            const stageRect = stageNode.getBoundingClientRect();
            const centroid = getGestureCentroid(firstTouch, secondTouch);
            const centroidWorld = screenPointToWorld(centroid, stageRect, stageWorldViewport.width, stageWorldViewport.height);

            setViewportState((current) => {
                const nextViewport = resolvePinchBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    centroidWorld,
                    firstTouch,
                    fitZoom,
                    secondTouch,
                    snapshot,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width,
                });

                viewportStateRef.current = nextViewport;
                return current.panX === nextViewport.panX &&
                    current.panY === nextViewport.panY &&
                    current.zoom === nextViewport.zoom &&
                    current.fitZoom === nextViewport.fitZoom
                    ? current
                    : nextViewport;
            });
        };

        const handlePointerDown = (event: globalThis.PointerEvent): void => {
            if (event.pointerType !== 'touch') {
                return;
            }

            activeTouchPointsRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

            if (activeTouchPointsRef.current.size >= 2) {
                beginGestureSession();
                stopGestureEvent(event);
            }
        };

        const handlePointerMove = (event: globalThis.PointerEvent): void => {
            if (!activeTouchPointsRef.current.has(event.pointerId)) {
                return;
            }

            activeTouchPointsRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

            if (activeTouchPointsRef.current.size >= 2 && gestureSnapshotRef.current) {
                updateGestureViewport();
                stopGestureEvent(event);
                return;
            }

            if (selectionSuppressedRef.current) {
                stopGestureEvent(event);
            }
        };

        const handlePointerEnd = (event: globalThis.PointerEvent): void => {
            const wasTracked = activeTouchPointsRef.current.delete(event.pointerId);

            if (!wasTracked && !selectionSuppressedRef.current) {
                return;
            }

            if (selectionSuppressedRef.current) {
                stopGestureEvent(event);
            }

            if (activeTouchPointsRef.current.size >= 2) {
                beginGestureSession();
                return;
            }

            gestureSnapshotRef.current = null;
            syncGestureActive(false);

            if (activeTouchPointsRef.current.size === 0) {
                syncSelectionSuppressed(false);
            }
        };

        const syncTouchList = (touches: TouchList): void => {
            activeTouchPointsRef.current.clear();
            for (const touch of Array.from(touches).slice(0, 2)) {
                activeTouchPointsRef.current.set(touch.identifier, {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        };

        const handleTouchStart = (event: globalThis.TouchEvent): void => {
            if (event.touches.length < 2) {
                return;
            }

            syncTouchList(event.touches);
            beginGestureSession();
            stopTouchGestureEvent(event);
        };

        const handleTouchMove = (event: globalThis.TouchEvent): void => {
            if (event.touches.length < 2) {
                return;
            }

            syncTouchList(event.touches);
            if (!gestureSnapshotRef.current) {
                beginGestureSession();
            }
            updateGestureViewport();
            stopTouchGestureEvent(event);
        };

        const handleTouchEnd = (event: globalThis.TouchEvent): void => {
            if (!gestureSnapshotRef.current && !selectionSuppressedRef.current) {
                return;
            }

            if (event.touches.length >= 2) {
                syncTouchList(event.touches);
                beginGestureSession();
                stopTouchGestureEvent(event);
                return;
            }

            activeTouchPointsRef.current.clear();
            gestureSnapshotRef.current = null;
            syncGestureActive(false);
            syncSelectionSuppressed(false);
            stopTouchGestureEvent(event);
        };

        stageNode.addEventListener('pointerdown', handlePointerDown, true);
        stageNode.addEventListener('pointermove', handlePointerMove, true);
        stageNode.addEventListener('pointerup', handlePointerEnd, true);
        stageNode.addEventListener('pointercancel', handlePointerEnd, true);
        stageNode.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
        stageNode.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        stageNode.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        stageNode.addEventListener('touchcancel', handleTouchEnd, { capture: true, passive: false });

        return () => {
            stageNode.removeEventListener('pointerdown', handlePointerDown, true);
            stageNode.removeEventListener('pointermove', handlePointerMove, true);
            stageNode.removeEventListener('pointerup', handlePointerEnd, true);
            stageNode.removeEventListener('pointercancel', handlePointerEnd, true);
            stageNode.removeEventListener('touchstart', handleTouchStart, true);
            stageNode.removeEventListener('touchmove', handleTouchMove, true);
            stageNode.removeEventListener('touchend', handleTouchEnd, true);
            stageNode.removeEventListener('touchcancel', handleTouchEnd, true);
            clearTouchGestureState(true);
        };
    }, [
        boardWorldHeight,
        boardWorldWidth,
        fitZoom,
        touchGestureMode,
        stageWorldViewport.height,
        stageWorldViewport.width,
        clearTouchGestureState,
        syncGestureActive,
        syncSelectionSuppressed
    ]);

    useEffect(() => {
        if (!desktopCameraMode) {
            mouseDragSnapshotRef.current = null;
            return;
        }

        const stageNode = stageRef.current;

        if (!stageNode) {
            return;
        }

        const stopMouseEvent = (event: globalThis.MouseEvent | globalThis.WheelEvent | globalThis.PointerEvent): void => {
            event.preventDefault();
            event.stopPropagation();
        };

        const handleWheel = (event: WheelEvent): void => {
            if (stageWorldViewport.width <= 0 || stageWorldViewport.height <= 0) {
                return;
            }

            stopMouseEvent(event);

            const stageRect = stageNode.getBoundingClientRect();
            const pointerWorld = screenPointToWorld(
                { clientX: event.clientX, clientY: event.clientY },
                stageRect,
                stageWorldViewport.width,
                stageWorldViewport.height
            );

            setViewportState((current) => {
                const nextViewport = resolveWheelBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    currentViewport: current,
                    deltaY: event.deltaY,
                    pointerWorld,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width
                });

                viewportStateRef.current = nextViewport;
                return current.panX === nextViewport.panX &&
                    current.panY === nextViewport.panY &&
                    current.zoom === nextViewport.zoom &&
                    current.fitZoom === nextViewport.fitZoom
                    ? current
                    : nextViewport;
            });
        };

        const handlePointerDown = (event: globalThis.PointerEvent): void => {
            const dragButton = event.button === 0 || event.button === 1 || event.button === 2;

            if (event.pointerType !== 'mouse' || !dragButton || stageWorldViewport.width <= 0 || stageWorldViewport.height <= 0) {
                return;
            }

            const stageRect = stageNode.getBoundingClientRect();
            const startWorld = screenPointToWorld(
                { clientX: event.clientX, clientY: event.clientY },
                stageRect,
                stageWorldViewport.width,
                stageWorldViewport.height
            );
            const currentViewport = viewportStateRef.current;

            mouseDragSnapshotRef.current = {
                dragActive: event.button !== 0,
                pickOnRelease: event.button === 0,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startPanX: currentViewport.panX,
                startPanY: currentViewport.panY,
                startWorldX: startWorld.panX,
                startWorldY: startWorld.panY
            };

            stageNode.setPointerCapture(event.pointerId);

            if (event.button !== 0) {
                syncGestureActive(true);
                syncSelectionSuppressed(true);
            }

            stopMouseEvent(event);
        };

        const handlePointerMove = (event: globalThis.PointerEvent): void => {
            const snapshot = mouseDragSnapshotRef.current;

            if (!snapshot || event.pointerId !== snapshot.pointerId) {
                return;
            }

            if (!snapshot.dragActive) {
                const dragDistance = Math.hypot(event.clientX - snapshot.startClientX, event.clientY - snapshot.startClientY);

                if (dragDistance < MOUSE_PAN_DRAG_THRESHOLD_PX) {
                    return;
                }

                snapshot.dragActive = true;
                syncGestureActive(true);
                syncSelectionSuppressed(true);
            }

            const stageRect = stageNode.getBoundingClientRect();
            const currentWorld = screenPointToWorld(
                { clientX: event.clientX, clientY: event.clientY },
                stageRect,
                stageWorldViewport.width,
                stageWorldViewport.height
            );

            setViewportState((current) => {
                const nextViewport = resolveDraggedBoardViewport({
                    boardHeight: boardWorldHeight,
                    boardWidth: boardWorldWidth,
                    currentWorld,
                    currentZoom: current.zoom,
                    fitZoom,
                    snapshot,
                    viewportHeight: stageWorldViewport.height,
                    viewportWidth: stageWorldViewport.width
                });

                viewportStateRef.current = nextViewport;
                return current.panX === nextViewport.panX &&
                    current.panY === nextViewport.panY &&
                    current.zoom === nextViewport.zoom &&
                    current.fitZoom === nextViewport.fitZoom
                    ? current
                    : nextViewport;
            });

            stopMouseEvent(event);
        };

        const handlePointerEnd = (event: globalThis.PointerEvent): void => {
            const snapshot = mouseDragSnapshotRef.current;

            if (!snapshot || event.pointerId !== snapshot.pointerId) {
                return;
            }

            const shouldPick = event.type === 'pointerup' && snapshot.pickOnRelease && !snapshot.dragActive;
            mouseDragSnapshotRef.current = null;
            syncGestureActive(false);
            syncSelectionSuppressed(false);
            if (stageNode.hasPointerCapture(event.pointerId)) {
                stageNode.releasePointerCapture(event.pointerId);
            }
            stopMouseEvent(event);

            if (shouldPick) {
                sceneHandleRef.current?.pickTileAtClientPoint(event.clientX, event.clientY);
            }
        };

        const handleContextMenu = (event: globalThis.MouseEvent): void => {
            stopMouseEvent(event);
        };

        stageNode.addEventListener('wheel', handleWheel, { passive: false });
        stageNode.addEventListener('pointerdown', handlePointerDown, true);
        stageNode.addEventListener('pointermove', handlePointerMove, true);
        stageNode.addEventListener('pointerup', handlePointerEnd, true);
        stageNode.addEventListener('pointercancel', handlePointerEnd, true);
        stageNode.addEventListener('contextmenu', handleContextMenu);

        return () => {
            stageNode.removeEventListener('wheel', handleWheel);
            stageNode.removeEventListener('pointerdown', handlePointerDown, true);
            stageNode.removeEventListener('pointermove', handlePointerMove, true);
            stageNode.removeEventListener('pointerup', handlePointerEnd, true);
            stageNode.removeEventListener('pointercancel', handlePointerEnd, true);
            stageNode.removeEventListener('contextmenu', handleContextMenu);
            mouseDragSnapshotRef.current = null;
            syncGestureActive(false);
            syncSelectionSuppressed(false);
        };
    }, [
        boardWorldHeight,
        boardWorldWidth,
        desktopCameraMode,
        fitZoom,
        stageWorldViewport.height,
        stageWorldViewport.width,
        syncGestureActive,
        syncSelectionSuppressed
    ]);

    const showMotionChip = shouldOfferDeviceMotionPermission({
        motionParallaxSuppressed,
        permission,
        touchPrimary
    });
    const motionChipLabels = getMotionPermissionButtonLabels(permission, 'board');

    const sceneErrorFallback = (
        <div className={styles.webglSceneError} data-testid="tile-board-scene-error" role="alert">
            Board graphics encountered an error. Try reloading the page.
        </div>
    );

    const gambitPickWindowOpen =
        allowGambitThirdFlip && runStatus === 'resolving' && board.flippedTileIds.length === 2;

    return (
        <div
            aria-busy={boardPreStage === 'loading'}
            className={`${styles.frame} ${cameraViewportMode ? styles.frameMobileCamera : ''} ${
                boardMotionAnimating ? styles.frameShuffleAnimating : ''
            } ${gambitPickWindowOpen && !reduceMotion ? styles.frameGambitWindow : ''}`}
            data-board-gambit-window={gambitPickWindowOpen ? 'true' : 'false'}
            data-board-prestage={boardPreStage}
            data-board-columns={board.columns}
            data-board-rows={board.rows}
            data-board-run-status={runStatus}
            data-dungeon-stage-layer-policy={DUNGEON_BOARD_STAGE_LAYER_POLICY.version}
            data-dungeon-stage-perf-budget={DUNGEON_BOARD_STAGE_PERFORMANCE_BUDGET.version}
            data-dungeon-comfort-focus-order={DNG065_DUNGEON_COMFORT_FOCUS_ORDER.join('>')}
            data-dungeon-mobile-board-primary={DNG065_MOBILE_BOARD_PRIORITY.boardPrimary ? 'true' : 'false'}
            data-dungeon-touch-target-min={DNG065_MOBILE_BOARD_PRIORITY.minTouchTargetPx}
            data-card-feedback-states={cardFeedbackStatesAttr}
            data-card-feedback-trait-combo-surge={cardFeedbackTraitComboSurgeActive ? 'true' : 'false'}
            data-card-feedback-action-cues={cardFeedbackActionCuesAttr}
            data-card-feedback-action-cue-contract={BOARD_MARKER_ACTION_CUE_CONTRACT}
            data-card-feedback-action-priority={cardFeedbackActionPriorityAttr || 'none'}
            data-card-feedback-action-priority-contract={BOARD_MARKER_ACTION_PRIORITY_CONTRACT}
            data-card-feedback-beat-tiers={cardFeedbackBeatTiersAttr || 'none'}
            data-card-feedback-beat-counts={cardFeedbackBeatCountsAttr || 'none'}
            data-card-feedback-cadences={cardFeedbackCadencesAttr || 'none'}
            data-card-feedback-cadence-contract={BOARD_MARKER_CADENCE_CONTRACT}
            data-card-feedback-beat-tier-contract={BOARD_MARKER_BEAT_TIER_CONTRACT}
            data-card-feedback-shot-map={cardFeedbackShotMapAttr}
            data-card-feedback-primary-shot={primaryCardFeedbackShotRow?.id ?? 'none'}
            data-card-feedback-primary-shot-audio={primaryCardFeedbackShotAudioCue}
            data-card-feedback-primary-shot-detail={primaryCardFeedbackShotRow?.detail ?? 'none'}
            data-card-feedback-primary-shot-focus={primaryCardFeedbackShotFocus}
            data-card-feedback-primary-shot-label={primaryCardFeedbackShotRow?.shotLabel ?? 'none'}
            data-card-feedback-primary-shot-screen-cue={primaryCardFeedbackShotScreenCue}
            data-card-feedback-primary-beat={primaryCardFeedbackBeatRow?.id ?? 'none'}
            data-card-feedback-primary-beat-action={primaryCardFeedbackBeatRow?.action ?? 'none'}
            data-card-feedback-primary-beat-count={primaryCardFeedbackBeatRow?.beatCount ?? 0}
            data-card-feedback-primary-cadence={primaryCardFeedbackCadenceRow?.id ?? 'none'}
            data-card-feedback-primary-cadence-action={primaryCardFeedbackCadenceRow?.action ?? 'none'}
            data-card-feedback-marker-shapes={cardFeedbackMarkerShapesAttr}
            data-card-feedback-trait-lane-beats={cardFeedbackTraitLaneBeatsAttr || 'none'}
            data-card-feedback-trait-lane-actions={cardFeedbackTraitLaneActionsAttr || 'none'}
            data-card-feedback-trait-lanes={cardFeedbackTraitLaneCuesAttr || 'none'}
            data-card-feedback-trait-lane-primary-audio={primaryTraitLaneAudioCue}
            data-card-feedback-trait-lane-primary-action={cardFeedbackTraitLanePrimaryActionAttr}
            data-card-feedback-trait-lane-primary-role={primaryTraitLaneBeatRow?.role ?? 'none'}
            data-card-feedback-trait-lane-primary-screen-cue={primaryTraitLaneScreenCue}
            data-card-feedback-trait-lane-contract={BOARD_MARKER_TRAIT_LANE_CONTRACT}
            data-card-feedback-route-glyphs={cardFeedbackRouteGlyphsAttr || 'none'}
            data-card-feedback-route-glyph-contract={BOARD_MARKER_ROUTE_GLYPH_CONTRACT}
            data-card-feedback-trait-route-intensities={cardFeedbackTraitRouteIntensitiesAttr}
            data-card-feedback-trait-route-tiers={cardFeedbackTraitRouteTiersAttr}
            data-card-feedback-primary-action={cardFeedbackPrimaryActionAttr}
            data-card-feedback-primary-action-role={primaryCardActionPriorityRow?.role ?? 'none'}
            data-card-feedback-primary-action-screen-cue={primaryCardActionPriorityRow?.screenCue ?? 'none'}
            data-card-feedback-primary-action-tone={primaryCardActionPriorityRow?.tone ?? 'none'}
            data-card-feedback-primary-card-cue={cardFeedbackPrimaryCardCueAttr}
            data-card-feedback-trait-payoff-stack={cardFeedbackTraitPayoffStackActive ? 'true' : 'false'}
            data-card-feedback-marker-shape-contract={BOARD_MARKER_SHAPE_CONTRACT}
            data-card-feedback-marker-contract={BOARD_MARKER_READABILITY_CONTRACT}
            data-card-feedback-last-resolution={lastResolutionFeedback}
            data-card-feedback-reduced-motion={reduceMotion ? 'static-state-cues' : 'animated-state-cues'}
            data-chain-opportunity-ready-count={boardChainOpportunity.chainReadyCount}
            data-chain-opportunity-ready-tile-count={boardChainOpportunity.chainReadyTileCount}
            data-chain-opportunity-setup-count={boardChainOpportunity.setupCount}
            data-chain-opportunity-armed-perk={boardChainOpportunity.armedPerkLabel ?? 'none'}
            data-chain-opportunity-armed-perk-payoff={boardChainOpportunity.armedPerkPayoff ?? 'none'}
            data-chain-opportunity-priority={boardChainOpportunity.priorityLabel ?? 'none'}
            data-chain-opportunity-momentum={boardChainOpportunity.momentumLabel ?? 'none'}
            data-chain-opportunity-next-action={boardChainOpportunity.nextActionId}
            data-chain-opportunity-next-action-detail={boardChainOpportunity.nextActionDetail ?? 'none'}
            data-chain-opportunity-next-action-label={boardChainOpportunity.nextActionLabel ?? 'none'}
            data-chain-opportunity-next-action-tone={boardChainOpportunity.nextActionTone}
            data-chain-opportunity-recipes={boardChainRecipeChips.join('|') || 'none'}
            data-trait-interaction-lane-actions={boardTraitInteractionLaneActionMapAttrValue || 'none'}
            data-trait-interaction-lane-map={boardTraitInteractionLaneMapAttrValue || 'none'}
            data-trait-interaction-lane-roles={boardTraitInteractionLaneRoleMapAttrValue || 'none'}
            data-trait-interaction-lane-count={boardTraitInteractionLaneMap.length}
            data-chain-opportunity-target-plan={boardChainOpportunity.targetPlanLabel ?? 'none'}
            data-chain-opportunity-beat-action={boardChainOpportunity.beatSignal?.action ?? 'none'}
            data-chain-opportunity-beat-audio={boardChainOpportunity.beatSignal?.audioCue ?? 'none'}
            data-chain-opportunity-beat-count={boardChainOpportunity.beatSignal?.beatCount ?? 0}
            data-chain-opportunity-beat-cue={boardChainOpportunity.beatSignal?.cue ?? 'none'}
            data-chain-opportunity-beat-screen-cue={boardChainOpportunity.beatSignal?.screenCue ?? 'none'}
            data-chain-opportunity-beat-tier={boardChainOpportunity.beatSignal?.tier ?? 'none'}
            data-chain-opportunity-beat-label={boardChainOpportunity.beatSignal?.label ?? 'none'}
            data-chain-opportunity-callout={boardChainOpportunity.arcadeCallout?.label ?? 'none'}
            data-chain-opportunity-callout-value={boardChainOpportunity.arcadeCallout?.value ?? 'none'}
            data-chain-opportunity-callout-tone={boardChainOpportunity.arcadeCallout?.tone ?? 'none'}
            data-chain-opportunity-chase={boardChainOpportunity.chaseLabel ?? 'none'}
            data-chain-opportunity-milestone-action={boardChainOpportunity.milestoneActionLabel ?? 'none'}
            data-chain-opportunity-milestone-target={boardChainOpportunity.milestoneTargetLabel ?? 'none'}
            data-chain-opportunity-milestone-tone={boardChainOpportunity.milestoneTone ?? 'none'}
            data-chain-opportunity-reward-urgency={boardChainOpportunity.rewardUrgencyLabel ?? 'none'}
            data-chain-opportunity-reward-urgency-tier={boardChainOpportunity.rewardUrgencyTier ?? 'none'}
            data-chain-opportunity-reward-hot={boardChainOpportunity.rewardHot ? 'true' : 'false'}
            data-chain-opportunity-combo-surge={boardChainOpportunity.comboSurgeLabel ? 'true' : 'false'}
            data-chain-opportunity-hot-band={boardChainHotBand?.tone ?? 'none'}
            data-chain-reward-ladder={boardRewardLadderAttr}
            data-chain-reward-ladder-actions={boardRewardLadderActionAttr}
            data-chain-reward-ladder-count={boardRewardLadder.length}
            data-chain-opportunity-streak-cashout-ready={boardChainOpportunity.streakCashoutReady ? 'true' : 'false'}
            data-chain-opportunity-selected-followups={boardChainOpportunity.selectedFollowupCount}
            data-chain-opportunity-selected-followup-label={boardChainOpportunity.selectedFollowupLabel ?? 'none'}
            data-chain-sequence-first={boardChainSequenceCue?.first ?? 'none'}
            data-chain-sequence-keep={boardChainSequenceCue?.keep ?? 'none'}
            data-chain-sequence-then={boardChainSequenceCue?.then ?? 'none'}
            data-chain-sequence-tone={boardChainSequenceCue?.tone ?? 'none'}
            data-chain-opportunity-cue={boardChainOpportunity.cue || 'none'}
            data-chain-opportunity-screen-cue={boardChainOpportunity.beatSignal?.screenCue ?? 'none'}
            data-chain-opportunity-target={boardChainOpportunity.nextTarget ?? 'none'}
            data-chain-accessibility-tone={boardChainAccessibilitySummary.tone}
            data-chain-accessibility-ready-count={boardChainAccessibilitySummary.readyCount}
            data-chain-accessibility-followup-count={boardChainAccessibilitySummary.followupCount}
            data-chain-accessibility-surge-count={boardChainAccessibilitySummary.surgeCount}
            data-chain-accessibility-reward-hot-count={boardChainAccessibilitySummary.rewardHotCount}
            data-chain-accessibility-setup-count={boardChainAccessibilitySummary.setupCount}
            data-chain-accessibility-primary-line={boardChainAccessibilitySummary.primaryLine}
            data-chain-accessibility-secondary-line={boardChainAccessibilitySummary.secondaryLine ?? 'none'}
            data-trait-mode-tone={boardTraitModeCue?.tone ?? 'none'}
            data-trait-mode-value={boardTraitModeCue?.value ?? 'none'}
            data-trait-mode-detail={boardTraitModeCue?.detail ?? 'none'}
            data-hazard-opportunity-count={boardHazardOpportunity.count}
            data-pickup-opportunity-count={boardPickupOpportunity.count}
            data-pickup-opportunity-focus={boardPickupOpportunityFocus}
            data-pickup-sequence-first={boardPickupOpportunity.sequenceCue?.first ?? 'none'}
            data-pickup-sequence-keep={boardPickupOpportunity.sequenceCue?.keep ?? 'none'}
            data-pickup-sequence-then={boardPickupOpportunity.sequenceCue?.then ?? 'none'}
            data-pickup-sequence-tone={boardPickupOpportunity.sequenceCue?.tone ?? 'none'}
            data-pickup-opportunity-tile-count={boardPickupOpportunity.tileCount}
            data-opportunity-best-id={boardBestOpportunity?.id ?? 'none'}
            data-opportunity-best-action={boardBestOpportunity?.action ?? 'none'}
            data-opportunity-best-label={boardBestOpportunity?.label ?? 'none'}
            data-opportunity-best-value={boardBestOpportunity?.value ?? 'none'}
            data-opportunity-best-detail={boardBestOpportunity?.detail ?? 'none'}
            data-opportunity-best-tone={boardBestOpportunity?.tone ?? 'none'}
            data-opportunity-best-impact-cue={boardBestOpportunity?.impactCue ?? 'none'}
            data-opportunity-best-heat={boardBestOpportunityHeat}
            data-opportunity-best-beats={boardBestOpportunityBeatCount}
            data-opportunity-best-audio={boardBestOpportunity ? boardOpportunityAudioCue(boardBestOpportunity) : 'none'}
            data-opportunity-best-screen-cue={boardBestOpportunity ? boardOpportunityScreenCue(boardBestOpportunity) : 'none'}
            data-opportunity-payoff-stack={boardPayoffStack?.value ?? 'none'}
            data-opportunity-payoff-stack-action={boardPayoffStack?.action ?? 'none'}
            data-opportunity-payoff-crescendo-audio={
                boardPayoffStack ? boardPayoffStackCrescendoAudioCue(boardPayoffStack.crescendo.tier) : 'none'
            }
            data-opportunity-payoff-crescendo-beats={boardPayoffStack?.crescendo.beatCount ?? 0}
            data-opportunity-payoff-crescendo-cue={boardPayoffStack?.crescendo.screenCue ?? 'none'}
            data-opportunity-payoff-crescendo-screen-cue={boardPayoffStack?.crescendo.screenCue ?? 'none'}
            data-opportunity-payoff-crescendo-tier={boardPayoffStack?.crescendo.tier ?? 'none'}
            data-opportunity-payoff-stack-cue={boardPayoffStack?.cue ?? 'none'}
            data-opportunity-payoff-first-cue={boardPayoffStack?.nextCue ?? 'none'}
            data-opportunity-payoff-keep-cue={boardPayoffStack?.sequence.keep ?? 'none'}
            data-opportunity-payoff-sequence-cue={boardPayoffStack?.sequenceCue ?? 'none'}
            data-opportunity-payoff-sequence-first={boardPayoffStack?.sequence.first ?? 'none'}
            data-opportunity-payoff-sequence-keep={boardPayoffStack?.sequence.keep ?? 'none'}
            data-opportunity-payoff-sequence-then={boardPayoffStack?.sequence.then ?? 'none'}
            data-opportunity-payoff-stack-tone={boardPayoffStack?.tone ?? 'none'}
            data-opportunity-compass-count={boardOpportunityCompassRows.length}
            data-opportunity-lane-actions={boardOpportunityLaneActionMapAttrValue}
            data-opportunity-lane-map={boardOpportunityLaneMapAttrValue}
            data-opportunity-lane-count={boardOpportunityLaneMapRows.length}
            data-opportunity-lane-label={boardOpportunityLaneMapRows[0]?.label ?? 'none'}
            data-opportunity-lane-roles={boardOpportunityLaneRoleMapAttrValue}
            data-opportunity-primary-lane={primaryBoardOpportunityLane?.id ?? 'none'}
            data-opportunity-primary-lane-action={primaryBoardOpportunityLane?.action ?? 'none'}
            data-opportunity-primary-lane-audio={
                primaryBoardOpportunityLane ? boardOpportunityLaneAudioCue(primaryBoardOpportunityLane) : 'none'
            }
            data-opportunity-primary-lane-beats={
                primaryBoardOpportunityLane ? boardOpportunityLaneBeatCount(primaryBoardOpportunityLane) : 0
            }
            data-opportunity-primary-lane-cue={primaryBoardOpportunityLane?.cue ?? 'none'}
            data-opportunity-primary-lane-focus={
                primaryBoardOpportunityLane ? boardOpportunityLaneFocus(primaryBoardOpportunityLane) : 'none'
            }
            data-opportunity-primary-lane-role={
                primaryBoardOpportunityLane ? boardOpportunityLaneRole(primaryBoardOpportunityLane) : 'none'
            }
            data-opportunity-primary-lane-screen-cue={
                primaryBoardOpportunityLane ? boardOpportunityLaneScreenCue(primaryBoardOpportunityLane) : 'none'
            }
            data-card-feedback-visible-trait-preview-count={cardFeedbackVisibleTraitPreviewCount}
            data-dungeon-resolved-trap-count={resolvedTrapTileCount}
            data-dungeon-resolved-trap-slots={resolvedTrapSlotsAttr}
            data-dungeon-trap-resolution-effect={trapResolutionDetails?.effect ?? 'none'}
            data-dungeon-trap-resolution-message={trapResolutionMessage}
            data-dungeon-trap-resolution-next={trapResolutionDetails?.next ?? 'none'}
            data-selected-tile-count={board.flippedTileIds.length}
            {...(hiddenTrapSlotsAttr != null ? { 'data-e2e-hidden-trap-slots': hiddenTrapSlotsAttr } : {})}
            {...(pickableHiddenSlotsAttr != null ? { 'data-e2e-pickable-hidden-slots': pickableHiddenSlotsAttr } : {})}
            data-hidden-tile-count={hiddenTileCount}
            data-hidden-slots={hiddenSlotsAttr}
            {...(devE2ePairPositionsJson ? { 'data-e2e-pair-positions': devE2ePairPositionsJson } : {})}
            data-shuffle-animating={boardMotionAnimating ? 'true' : 'false'}
            data-board-pan-x={renderedViewportState.panX.toFixed(4)}
            data-board-pan-y={renderedViewportState.panY.toFixed(4)}
            data-board-zoom={renderedViewportState.zoom.toFixed(4)}
            data-gesture-active={gestureActive ? 'true' : 'false'}
            {...{ [REG105_DATA_DAIS]: 'v1' }}
            data-mobile-camera-mode={cameraViewportMode ? 'true' : 'false'}
            data-selection-suppressed={selectionSuppressed ? 'true' : 'false'}
            data-testid="tile-board-frame"
            ref={frameRef}
            style={mergedFrameStyle}
        >
            <div className={styles.srBoardLive} aria-live="polite" data-testid="tile-board-live-region">
                {boardLiveMessage}
            </div>
            {trapResolutionMessage ? (
                <div
                    className={styles.trapResolutionToast}
                    data-testid="trap-resolution-feedback"
                    role="status"
                    aria-live="polite"
                >
                    <span className={styles.trapResolutionSigil} aria-hidden="true">
                        !
                    </span>
                    <span className={styles.trapResolutionCopy}>{trapResolutionMessage}</span>
                    {trapResolutionDetails ? (
                        <span
                            className={styles.trapResolutionSignals}
                            data-testid="trap-resolution-signals"
                            aria-label={`Trap resolution signals: ${trapResolutionDetails.count === 1 ? '1 trap' : `${trapResolutionDetails.count} traps`} resolved. Effect: ${trapResolutionDetails.effect}. Next: ${trapResolutionDetails.next}.`}
                        >
                            <span
                                data-trap-resolution-action={getTrapResolutionSignalAction('resolved')}
                                data-trap-resolution-audio={getTrapResolutionSignalAudioCue('resolved')}
                                data-trap-resolution-beats={getTrapResolutionSignalBeatCount('resolved')}
                                data-trap-resolution-screen-cue={getTrapResolutionSignalScreenCue('resolved')}
                                data-trap-resolution-signal="resolved"
                            >
                                <small>Resolved</small>
                                <b>{trapResolutionDetails.count === 1 ? '1 trap' : `${trapResolutionDetails.count} traps`}</b>
                                <span aria-hidden="true" className={styles.trapResolutionBeatPips}>
                                    {Array.from({ length: getTrapResolutionSignalBeatCount('resolved') }, (_, index) => (
                                        <i
                                            data-trap-resolution-beat={index + 1}
                                            data-trap-resolution-beat-focus={index === 0 ? 'primary' : 'support'}
                                            key={index}
                                        />
                                    ))}
                                </span>
                            </span>
                            <span
                                data-trap-resolution-action={getTrapResolutionSignalAction('effect')}
                                data-trap-resolution-audio={getTrapResolutionSignalAudioCue('effect')}
                                data-trap-resolution-beats={getTrapResolutionSignalBeatCount('effect')}
                                data-trap-resolution-screen-cue={getTrapResolutionSignalScreenCue('effect')}
                                data-trap-resolution-signal="effect"
                            >
                                <small>Effect</small>
                                <b>{trapResolutionDetails.effect}</b>
                                <span aria-hidden="true" className={styles.trapResolutionBeatPips}>
                                    {Array.from({ length: getTrapResolutionSignalBeatCount('effect') }, (_, index) => (
                                        <i
                                            data-trap-resolution-beat={index + 1}
                                            data-trap-resolution-beat-focus={index === 0 ? 'primary' : 'support'}
                                            key={index}
                                        />
                                    ))}
                                </span>
                            </span>
                            <span
                                data-trap-resolution-action={getTrapResolutionSignalAction('continue')}
                                data-trap-resolution-audio={getTrapResolutionSignalAudioCue('continue')}
                                data-trap-resolution-beats={getTrapResolutionSignalBeatCount('continue')}
                                data-trap-resolution-screen-cue={getTrapResolutionSignalScreenCue('continue')}
                                data-trap-resolution-signal="continue"
                            >
                                <small>Next</small>
                                <b>{trapResolutionDetails.next}</b>
                                <span aria-hidden="true" className={styles.trapResolutionBeatPips}>
                                    {Array.from({ length: getTrapResolutionSignalBeatCount('continue') }, (_, index) => (
                                        <i
                                            data-trap-resolution-beat={index + 1}
                                            data-trap-resolution-beat-focus={index === 0 ? 'primary' : 'support'}
                                            key={index}
                                        />
                                    ))}
                                </span>
                            </span>
                        </span>
                    ) : null}
                </div>
            ) : null}
            {!baselineWebGl ? (
                <div className={styles.webglRequired} data-testid="tile-board-webgl-required">
                    This game requires WebGL. Enable hardware acceleration or update your browser, then reload.
                </div>
            ) : (
                <div
                    aria-label={DNG065_BOARD_APPLICATION_LABEL}
                    className={styles.boardCanvasApplication}
                    data-testid="tile-board-application"
                    onBlur={handleBoardApplicationBlur}
                    onFocus={handleBoardApplicationFocus}
                    onKeyDown={handleBoardApplicationKeyDown}
                    ref={boardAppRef}
                    role="application"
                    tabIndex={0}
                >
                    <div
                        className={styles.stage}
                        data-testid="tile-board-stage-shell"
                        {...{ [REG105_DATA_STAGEVIEW]: 'v1' }}
                        ref={stageRef}
                        style={{ touchAction: REG103_BOARD_TOUCH_ACTION }}
                    >
                        {gpuSurfaceLost ? (
                            <div className={styles.webglSceneError} data-testid="tile-board-gpu-lost" role="alert">
                                WebGL context was lost. The board will rebuild when the GPU restores it. If this
                                stays visible, reload the page or update GPU drivers.
                            </div>
                        ) : null}
                        {boardPreStage === 'loading' && baselineWebGl && !gpuSurfaceLost ? (
                            <TileBoardPrestageOverlay cardCount={PRESTAGE_CARD_COUNT} />
                        ) : null}
                        <TileBoardErrorBoundary fallback={sceneErrorFallback}>
                            <div className={styles.scene} data-testid="tile-board-stage">
                                <Canvas
                                    aria-hidden
                                    className={styles.canvas}
                                    dpr={dpr}
                                    key={`tile-board-${webglCanvasRemountKey}-${resolvedBoardAa}`}
                                    gl={{
                                        alpha: true,
                                        antialias: glAntialias,
                                        powerPreference: glPowerPreference,
                                        premultipliedAlpha: false
                                    }}
                                    onCreated={({ gl }) => {
                                        handleCanvasCreated(gl.domElement as HTMLCanvasElement);
                                    }}
                                    shadows={false}
                                    camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0, 10.5] }}
                                >
                                    <TileBoardScene
                                        allowGambitThirdFlip={allowGambitThirdFlip}
                                        board={board}
                                        boardViewport={renderedViewportState}
                                        compact={compact}
                                        cursedPairKey={cursedPairKey}
                                        dimmedTileIds={dimmedTileIds}
                                        stickyBlockedTileId={stickyBlockedTileId}
                                        focusedTileId={boardApplicationFocused ? focusedTileId : null}
                                        graphicsQuality={graphicsQuality}
                                        wardPairKey={wardPairKey}
                                        bountyPairKey={bountyPairKey}
                                        debugPeekActive={debugPeekActive}
                                        fieldTiltRef={fieldTiltRef}
                                        hoverTiltRef={hoverTiltRef}
                                        interactionSuppressed={selectionSuppressed}
                                        interactive={interactive}
                                        nBackAnchorPairKey={nBackAnchorPairKey}
                                        nBackMutatorActive={nBackMutatorActive}
                                        onTilePick={handleTileSelect}
                                        onViewportMetricsChange={handleStageViewportChange}
                                        pairProximityHintsEnabled={pairProximityHintsEnabled}
                                        peekRevealedTileIds={peekRevealedTileIds}
                                        pinnedTileIds={pinnedTileIds}
                                        previewActive={previewActive}
                                        ref={sceneHandleRef}
                                        reduceMotion={reduceMotion}
                                        motionParallaxSuppressed={motionParallaxSuppressed}
                                        runStatus={runStatus}
                                        boardEntranceMotionBudgetMs={boardEntranceMotionBudgetMs}
                                        boardEntranceMotionDeadlineMs={boardEntranceMotionDeadlineMs}
                                        boardEntranceStaggerTileCount={boardEntranceStaggerTileCount}
                                        shuffleMotionBudgetMs={shuffleMotionBudgetMs}
                                        shuffleMotionDeadlineMs={shuffleMotionDeadlineMs}
                                        shuffleStaggerTileCount={shuffleStaggerTileCount}
                                        showTutorialPairMarkers={showTutorialPairMarkers}
                                        silhouetteDuringPlay={silhouetteDuringPlay}
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
                                        perkArmedTileIds={perkArmedTileIds}
                                        selectedTraitFollowupTileIds={selectedTraitFollowupTileIds}
                                        traitRewardHotTileIds={traitRewardHotTileIds}
                                        traitRouteTargetTileIds={traitRouteTargetTileIds}
                                        pinModeBoardHintActive={pinModeBoardHintActive}
                                    />
                                </Canvas>
                            </div>
                        </TileBoardErrorBoundary>
                        {showMotionChip ? (
                            <button
                                aria-label={motionChipLabels.ariaLabel}
                                className={styles.motionChip}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    void requestMotionPermission();
                                }}
                                onPointerDown={(event) => {
                                    event.stopPropagation();
                                }}
                                type="button"
                            >
                                {motionChipLabels.buttonText}
                            </button>
                        ) : null}
                        {boardChainOpportunity.lines.length > 0 ? (
                            <div
                                aria-label={boardChainOpportunityLabel}
                                className={styles.chainOpportunityChip}
                                data-chain-opportunity-tone={boardChainOpportunity.tone}
                                data-testid="chain-opportunity-chip"
                                role="status"
                            >
                                <span className={styles.chainOpportunityEyebrow}>
                                    {boardChainOpportunity.streakCashoutReady ? 'Streak reward' : 'Chain routes'}
                                    <span aria-hidden="true" className={styles.chainOpportunityEyebrowBeatPips}>
                                        {Array.from(
                                            {
                                                length: boardChainOpportunity.streakCashoutReady
                                                    ? 5
                                                    : boardChainOpportunity.comboSurgeLabel
                                                      ? 4
                                                      : boardChainOpportunity.selectedFollowupCount > 0
                                                        ? 3
                                                        : 2
                                            },
                                            (_, index) => (
                                                <i
                                                    data-chain-eyebrow-beat={index + 1}
                                                    data-chain-eyebrow-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            )
                                        )}
                                    </span>
                                </span>
                                {boardChainOpportunity.priorityLabel ? (
                                    <span
                                        className={styles.chainOpportunityPriority}
                                        data-chain-priority={
                                            boardChainOpportunity.rewardHot
                                                ? 'best'
                                                : boardChainOpportunity.selectedFollowupCount > 0
                                                  ? 'followup'
                                                : boardChainOpportunity.tone
                                        }
                                    >
                                        {boardChainOpportunity.priorityLabel}
                                        <span aria-hidden="true" className={styles.chainOpportunityPriorityBeatPips}>
                                            {Array.from(
                                                {
                                                    length:
                                                        boardChainOpportunity.rewardHot
                                                            ? 5
                                                            : boardChainOpportunity.selectedFollowupCount > 0
                                                              ? 3
                                                              : 2
                                                },
                                                (_, index) => (
                                                    <i
                                                        data-chain-priority-beat={index + 1}
                                                        data-chain-priority-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                <span
                                    className={styles.chainOpportunityCue}
                                    data-chain-cue-meter-fill={
                                        boardChainOpportunity.rewardHot || boardChainOpportunity.streakCashoutReady
                                            ? 100
                                            : boardChainOpportunity.selectedFollowupCount > 0
                                              ? 75
                                              : boardChainOpportunity.comboSurgeLabel
                                                ? 60
                                                : 40
                                    }
                                    style={
                                        {
                                            '--chain-cue-meter-fill': `${
                                                boardChainOpportunity.rewardHot || boardChainOpportunity.streakCashoutReady
                                                    ? 100
                                                    : boardChainOpportunity.selectedFollowupCount > 0
                                                      ? 75
                                                      : boardChainOpportunity.comboSurgeLabel
                                                        ? 60
                                                        : 40
                                            }%`
                                        } as CSSProperties
                                    }
                                >
                                    {boardChainOpportunity.cue}
                                    <i aria-hidden="true" className={styles.chainOpportunityCueMeter}>
                                        <i aria-hidden="true" className={styles.chainOpportunityCueMeterFill} />
                                    </i>
                                </span>
                                <span aria-hidden="true" className={styles.chainOpportunityCueBeatPips}>
                                    {Array.from(
                                        {
                                            length:
                                                boardChainOpportunity.rewardHot || boardChainOpportunity.streakCashoutReady
                                                    ? 5
                                                    : boardChainOpportunity.selectedFollowupCount > 0
                                                      ? 3
                                                      : boardChainOpportunity.comboSurgeLabel
                                                        ? 4
                                                        : 2
                                        },
                                        (_, index) => (
                                            <i
                                                data-chain-cue-beat={index + 1}
                                                data-chain-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                                key={index}
                                            />
                                        )
                                    )}
                                </span>
                                <i
                                    aria-hidden="true"
                                    className={styles.chainOpportunityMeterFill}
                                    data-chain-meter-fill={boardChainOpportunityMeterFill}
                                    style={
                                        {
                                            '--chain-meter-fill': `${boardChainOpportunityMeterFill}%`
                                        } as CSSProperties
                                    }
                                />
                                {primaryTraitLaneBeatRow ? (
                                    <span
                                        aria-label={`Primary trait lane action. ${primaryTraitLaneBeatRow.label}: ${primaryTraitLaneBeatRow.count}. ${primaryTraitLaneBeatRow.beatCount}-beat ${primaryTraitLaneBeatRow.action}.`}
                                        className={styles.chainOpportunityPrimaryTraitLane}
                                        data-card-trait-lane-primary={primaryTraitLaneBeatRow.id}
                                        data-card-trait-lane-primary-action={primaryTraitLaneBeatRow.action}
                                        data-card-trait-lane-primary-audio={primaryTraitLaneAudioCue}
                                        data-card-trait-lane-primary-beats={primaryTraitLaneBeatRow.beatCount}
                                        data-card-trait-lane-primary-role={primaryTraitLaneBeatRow.role}
                                        data-card-trait-lane-primary-screen-cue={primaryTraitLaneScreenCue}
                                        data-testid="chain-opportunity-primary-trait-lane"
                                    >
                                        <small>Next lane</small>
                                        <b>{primaryTraitLaneBeatRow.action}</b>
                                        <em>
                                            {primaryTraitLaneBeatRow.label} x{primaryTraitLaneBeatRow.count}
                                        </em>
                                        <span aria-hidden="true" className={styles.chainOpportunityPrimaryTraitLanePips}>
                                            {Array.from({ length: primaryTraitLaneBeatRow.beatCount }, (_, index) => (
                                                <i data-card-trait-lane-primary-pip={index + 1} key={index} />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.beatSignal ? (
                                    <span
                                        aria-label={formatChainOpportunityBeatLabel(boardChainOpportunity.beatSignal)}
                                        className={styles.chainOpportunityBeat}
                                        data-chain-beat-action={boardChainOpportunity.beatSignal.action}
                                        data-chain-beat-meter-fill={Math.round((boardChainOpportunity.beatSignal.beatCount / 5) * 100)}
                                        data-chain-beat-audio={boardChainOpportunity.beatSignal.audioCue}
                                        data-chain-beat-screen-cue={boardChainOpportunity.beatSignal.screenCue}
                                        data-chain-beat-tier={boardChainOpportunity.beatSignal.tier}
                                        data-testid="chain-opportunity-beat"
                                        style={
                                            {
                                                '--chain-beat-meter-fill': `${Math.round(
                                                    (boardChainOpportunity.beatSignal.beatCount / 5) * 100
                                                )}%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small>{boardChainOpportunity.beatSignal.label}</small>
                                        <b>{boardChainOpportunity.beatSignal.action}</b>
                                        <i aria-hidden="true" className={styles.chainOpportunityBeatMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityBeatMeterFill} />
                                        </i>
                                        <strong>
                                            {Array.from({ length: boardChainOpportunity.beatSignal.beatCount }).map(
                                                (_, index) => (
                                                    <i
                                                        aria-hidden="true"
                                                        data-chain-opportunity-beat-pip={index + 1}
                                                        data-chain-opportunity-beat-pip-focus={index === 0 ? 'primary' : 'support'}
                                                        key={`chain-opportunity-beat-${index}`}
                                                    />
                                                )
                                            )}
                                        </strong>
                                        <em>{boardChainOpportunity.beatSignal.detail}</em>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.nextActionLabel ? (
                                    <span
                                        className={styles.chainOpportunityNextAction}
                                        data-chain-next-action={boardChainOpportunity.nextActionId}
                                        data-chain-next-action-meter-fill={boardChainOpportunityNextActionMeterFill}
                                        data-chain-next-action-tone={boardChainOpportunity.nextActionTone}
                                        data-chain-next-action-tier={boardChainOpportunityNextActionTier}
                                        data-testid="chain-opportunity-next-action"
                                        style={
                                            {
                                                '--chain-next-action-meter-fill': `${boardChainOpportunityNextActionMeterFill}%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small>{boardChainOpportunityNextActionVerb}</small>
                                        {boardChainOpportunity.nextActionDetail ? <b>{boardChainOpportunity.nextActionDetail}</b> : null}
                                        <i aria-hidden="true" className={styles.chainOpportunityNextActionMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityNextActionMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityNextActionPips}>
                                            {Array.from(
                                                { length: boardChainOpportunity.nextActionId === 'cashout' ? 5 : boardChainOpportunity.nextActionId === 'prime-route' ? 2 : 3 },
                                                (_, index) => (
                                                    <i
                                                        data-chain-next-action-pip={index + 1}
                                                        data-chain-next-action-pip-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                {primaryCardFeedbackShotRow ? (
                                    <span
                                        aria-label={`Primary combo shot. ${primaryCardFeedbackShotRow.shotLabel}: ${primaryCardFeedbackShotRow.detail}. ${
                                            primaryCardFeedbackBeatRow
                                                ? `${primaryCardFeedbackBeatRow.beatCount}-beat ${primaryCardFeedbackBeatRow.action}.`
                                                : ''
                                        }${
                                            primaryCardFeedbackCadenceRow
                                                ? ` Pulse: ${primaryCardFeedbackCadenceRow.action}.`
                                                : ''
                                        }`}
                                        className={styles.chainOpportunityPrimaryShot}
                                        data-card-primary-shot={primaryCardFeedbackShotRow.id}
                                        data-card-primary-shot-audio={primaryCardFeedbackShotAudioCue}
                                        data-card-primary-shot-beat={primaryCardFeedbackBeatRow?.id ?? 'none'}
                                        data-card-primary-shot-beats={primaryCardFeedbackBeatRow?.beatCount ?? 0}
                                        data-card-primary-shot-cadence={primaryCardFeedbackCadenceRow?.id ?? 'none'}
                                        data-card-primary-shot-cadence-action={primaryCardFeedbackCadenceRow?.action ?? 'none'}
                                        data-card-primary-shot-detail={primaryCardFeedbackShotRow.detail}
                                        data-card-primary-shot-focus={primaryCardFeedbackShotFocus}
                                        data-card-primary-shot-screen-cue={primaryCardFeedbackShotScreenCue}
                                        data-testid="chain-opportunity-primary-shot"
                                    >
                                        <small>Best shot</small>
                                        <b>{primaryCardFeedbackShotRow.shotLabel}</b>
                                        <em>{primaryCardFeedbackShotRow.detail}</em>
                                        {primaryCardFeedbackBeatRow ? (
                                            <span aria-hidden="true" className={styles.chainOpportunityPrimaryShotBeatPips}>
                                                {Array.from({ length: primaryCardFeedbackBeatRow.beatCount }, (_, index) => (
                                                    <i
                                                        data-card-primary-shot-beat-pip={index + 1}
                                                        data-card-primary-shot-beat-pip-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                ))}
                                            </span>
                                        ) : null}
                                        {primaryCardFeedbackCadenceRow ? <strong>{primaryCardFeedbackCadenceRow.action}</strong> : null}
                                    </span>
                                ) : null}
                                {boardChainOpportunity.arcadeCallout ? (
                                    <span
                                        className={styles.chainOpportunityArcadeCallout}
                                        data-chain-callout-tone={boardChainOpportunity.arcadeCallout.tone}
                                        data-testid="chain-opportunity-arcade-callout"
                                    >
                                        <small>{boardChainOpportunity.arcadeCallout.label}</small>
                                        <b>{boardChainOpportunity.arcadeCallout.value}</b>
                                        <span aria-hidden="true" className={styles.chainOpportunityArcadeCalloutBeatPips}>
                                            {Array.from(
                                                {
                                                    length:
                                                        boardChainOpportunity.arcadeCallout.tone === 'cashout'
                                                            ? 5
                                                            : boardChainOpportunity.arcadeCallout.tone === 'surge'
                                                              ? 4
                                                              : 2
                                                },
                                                (_, index) => (
                                                    <i
                                                        data-chain-callout-beat={index + 1}
                                                        data-chain-callout-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainRecipeChips.length > 0 ? (
                                    <span
                                        aria-label={`Combo recipes. ${boardChainRecipeChips.join('. ')}`}
                                        className={styles.chainOpportunityRecipe}
                                        data-chain-recipe-meter-fill={Math.round(
                                            Math.min(100, (boardChainRecipeChips.length / 3) * 100)
                                        )}
                                        data-testid="chain-opportunity-recipes"
                                        style={
                                            {
                                                '--chain-recipe-meter-fill': `${Math.round(
                                                    Math.min(100, (boardChainRecipeChips.length / 3) * 100)
                                                )}%`
                                            } as CSSProperties
                                        }
                                    >
                                        <i aria-hidden="true" className={styles.chainOpportunityRecipeMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityRecipeMeterFill} />
                                        </i>
                                        {boardChainRecipeChips.map((recipe) => {
                                            const recipeBeatCount = Math.max(2, Math.min(5, recipe.split('+').length));
                                            return (
                                                <b data-chain-recipe={recipe} key={recipe}>
                                                    {recipe}
                                                    <span aria-hidden="true" className={styles.chainOpportunityRecipeBeatPips}>
                                                        {Array.from({ length: recipeBeatCount }, (_, index) => (
                                                            <i
                                                                data-chain-recipe-beat={index + 1}
                                                                data-chain-recipe-beat-focus={index === 0 ? 'primary' : 'support'}
                                                                key={index}
                                                            />
                                                        ))}
                                                    </span>
                                                </b>
                                            );
                                        })}
                                    </span>
                                ) : null}
                                {boardTraitInteractionLaneMap.length > 0 ? (
                                    <span
                                        aria-label={boardTraitInteractionLaneMapAccessibleLabel}
                                        className={styles.chainOpportunityTraitLaneMap}
                                        data-trait-interaction-lane-actions={boardTraitInteractionLaneActionMapAttrValue}
                                        data-trait-interaction-lane-map={boardTraitInteractionLaneMapAttrValue}
                                        data-trait-interaction-lane-roles={boardTraitInteractionLaneRoleMapAttrValue}
                                        data-trait-interaction-lane-primary={
                                            primaryBoardTraitInteractionLane?.id ?? 'none'
                                        }
                                        data-trait-interaction-lane-primary-action={
                                            primaryBoardTraitInteractionLane
                                                ? getTraitInteractionLaneAction(primaryBoardTraitInteractionLane.id)
                                                : 'none'
                                        }
                                        data-trait-interaction-lane-primary-audio={
                                            primaryBoardTraitInteractionLane
                                                ? cardTraitLaneAudioCue(primaryBoardTraitInteractionLane.id)
                                                : 'none'
                                        }
                                        data-trait-interaction-lane-primary-role={
                                            primaryBoardTraitInteractionLane
                                                ? getTraitInteractionLaneRole(primaryBoardTraitInteractionLane)
                                                : 'none'
                                        }
                                        data-trait-interaction-lane-primary-screen-cue={
                                            primaryBoardTraitInteractionLane
                                                ? cardTraitLaneScreenCue(primaryBoardTraitInteractionLane.id)
                                                : 'none'
                                        }
                                        data-testid="chain-opportunity-trait-lane-map"
                                    >
                                        <span
                                            className={styles.chainOpportunityTraitLaneMapSummary}
                                            data-testid="chain-opportunity-trait-lane-map-summary"
                                            data-trait-interaction-lane-map-meter-fill={boardTraitInteractionLaneMapMeterFill}
                                            style={
                                                {
                                                    '--trait-interaction-lane-map-meter-fill': `${boardTraitInteractionLaneMapMeterFill}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <small>Traits</small>
                                            <b>
                                                {boardTraitInteractionLaneMap.length}{' '}
                                                {boardTraitInteractionLaneMap.length === 1 ? 'lane' : 'lanes'}
                                            </b>
                                            <span
                                                aria-hidden="true"
                                                className={styles.chainOpportunityTraitLaneMapSummaryBeatPips}
                                            >
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, boardTraitInteractionLaneMap.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-trait-interaction-lane-summary-beat={index + 1}
                                                            data-trait-interaction-lane-summary-beat-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                            <i aria-hidden="true" className={styles.chainOpportunityTraitLaneMapMeter}>
                                                <i aria-hidden="true" className={styles.chainOpportunityTraitLaneMapMeterFill} />
                                            </i>
                                        </span>
                                        {boardTraitInteractionLaneMap.map((lane) => (
                                            <span
                                                data-trait-interaction-lane={lane.id}
                                                data-trait-interaction-lane-action={getTraitInteractionLaneAction(lane.id)}
                                                data-trait-interaction-lane-audio={cardTraitLaneAudioCue(lane.id)}
                                                data-trait-interaction-lane-count={lane.count}
                                                data-trait-interaction-lane-role={getTraitInteractionLaneRole(lane)}
                                                data-trait-interaction-lane-beats={Math.max(2, Math.min(5, lane.count + 1))}
                                                data-trait-interaction-lane-focus={
                                                    lane.id === primaryBoardTraitInteractionLane?.id
                                                        ? 'primary'
                                                        : 'support'
                                                }
                                                data-trait-interaction-lane-screen-cue={cardTraitLaneScreenCue(lane.id)}
                                                key={lane.id}
                                            >
                                                <small>{lane.label}</small>
                                                <b>{getTraitInteractionLaneRole(lane)}</b>
                                                <strong>{getTraitInteractionLaneAction(lane.id)}</strong>
                                                <span aria-hidden="true" className={styles.chainOpportunityTraitLaneMapBeatPips}>
                                                    {Array.from({ length: Math.max(2, Math.min(5, lane.count + 1)) }, (_, index) => (
                                                        <i
                                                            data-trait-interaction-lane-beat={index + 1}
                                                            data-trait-interaction-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                                <em>
                                                    x{lane.count} / {lane.cue}
                                                </em>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {boardChainMarkerKeyRows.length > 0 ? (
                                    <span
                                        aria-label={`Chain marker key. ${[
                                            ...boardChainMarkerKeyRows.map(
                                                (row) => `${row.label}: ${row.glyph}. Action: ${row.action}`
                                            ),
                                            chainMarkerIntensity
                                                ? `Intensity: ${chainMarkerIntensity.label} ${chainMarkerIntensity.count}. Action: ${chainMarkerIntensity.action}`
                                                : null
                                        ]
                                            .filter((row): row is string => row != null)
                                            .join('. ')}`}
                                        className={styles.chainOpportunityMarkerKey}
                                        data-chain-marker-focused-shape={focusedChainMarkerShape}
                                        data-chain-marker-intensity={chainMarkerIntensity?.id ?? 'none'}
                                        data-testid="chain-opportunity-marker-key"
                                    >
                                        <span
                                            className={styles.chainOpportunityMarkerKeySummary}
                                            data-testid="chain-opportunity-marker-key-summary"
                                            data-chain-marker-key-meter-fill={boardChainMarkerKeyMeterFill}
                                            style={
                                                {
                                                    '--chain-marker-key-meter-fill': `${boardChainMarkerKeyMeterFill}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <small>Markers</small>
                                            <b>{boardChainMarkerKeyRows.length} shapes</b>
                                            <span
                                                aria-hidden="true"
                                                className={styles.chainOpportunityMarkerKeySummaryBeatPips}
                                            >
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, boardChainMarkerKeyRows.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-chain-marker-key-summary-beat={index + 1}
                                                            data-chain-marker-key-summary-beat-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                            <i aria-hidden="true" className={styles.chainOpportunityMarkerKeyMeter}>
                                                <i aria-hidden="true" className={styles.chainOpportunityMarkerKeyMeterFill} />
                                            </i>
                                        </span>
                                        {boardChainMarkerKeyRows.map((row) => (
                                            <span
                                                data-chain-marker-focus={row.id === focusedChainMarkerShape ? 'primary' : 'support'}
                                                data-chain-marker-shape={row.id}
                                                key={row.id}
                                            >
                                                <b aria-hidden="true">{row.glyph}</b>
                                                <small>{row.label}</small>
                                                <em>{row.action}</em>
                                            </span>
                                        ))}
                                        {chainMarkerIntensity ? (
                                            <span
                                                data-chain-marker-intensity-chip={chainMarkerIntensity.id}
                                                data-testid="chain-marker-intensity"
                                            >
                                                <b aria-hidden="true">{chainMarkerIntensity.count}</b>
                                                <small>{chainMarkerIntensity.label}</small>
                                                <em>{chainMarkerIntensity.action}</em>
                                                <span aria-hidden="true" className={styles.chainOpportunityMarkerIntensityPips}>
                                                    {Array.from({ length: Math.max(2, Math.min(5, chainMarkerIntensity.count + 1)) }, (_, index) => (
                                                        <i
                                                            data-chain-marker-intensity-pip={index + 1}
                                                            data-chain-marker-intensity-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                    </span>
                                ) : null}
                                {cardFeedbackActionPriorityRows.length > 0 ? (
                                    <span
                                        aria-label={`Card action priority. ${cardFeedbackActionPriorityRows
                                            .map((row) => `${row.label}: ${row.count}`)
                                            .join('. ')}`}
                                        className={styles.chainOpportunityActionPriority}
                                        data-card-action-primary={cardFeedbackPrimaryActionAttr}
                                        data-card-action-primary-role={primaryCardActionPriorityRow?.role ?? 'none'}
                                        data-card-action-primary-screen-cue={primaryCardActionPriorityRow?.screenCue ?? 'none'}
                                        data-card-action-primary-tone={primaryCardActionPriorityRow?.tone ?? 'none'}
                                        data-testid="chain-opportunity-action-priority"
                                    >
                                        <small>Priority</small>
                                        <span
                                            className={styles.chainOpportunityActionPrioritySummary}
                                            data-testid="chain-opportunity-action-priority-summary"
                                        >
                                            <small>Actions</small>
                                            <b>
                                                {cardFeedbackActionPriorityRows.length}{' '}
                                                {cardFeedbackActionPriorityRows.length === 1 ? 'lane' : 'lanes'}
                                            </b>
                                            <span
                                                aria-hidden="true"
                                                className={styles.chainOpportunityActionPrioritySummaryBeatPips}
                                            >
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, cardFeedbackActionPriorityRows.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-card-action-priority-summary-pip={index + 1}
                                                            data-card-action-priority-summary-pip-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                        {cardFeedbackActionPriorityRows.map((row) => (
                                            <span
                                                data-card-action-priority={row.id}
                                                data-card-action-priority-count={row.count}
                                                data-card-action-priority-focus={
                                                    row.id === cardFeedbackPrimaryActionAttr ? 'primary' : 'support'
                                                }
                                                data-card-action-priority-role={row.role}
                                                data-card-action-priority-screen-cue={row.screenCue}
                                                data-card-action-priority-tone={row.tone}
                                                key={row.id}
                                            >
                                                <b>{row.label}</b>
                                                <em>{row.count}</em>
                                                <span aria-hidden="true" className={styles.chainOpportunityActionPriorityPips}>
                                                    {Array.from({ length: Math.max(1, Math.min(5, row.count)) }, (_, index) => (
                                                        <i
                                                            data-card-action-priority-pip={index + 1}
                                                            data-card-action-priority-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {cardFeedbackShotMapRows.length > 0 ? (
                                    <span
                                        aria-label={cardFeedbackShotMapLabel}
                                        className={styles.chainOpportunityShotMap}
                                        data-chain-shot-map-primary={cardFeedbackPrimaryActionAttr}
                                        data-chain-shot-map-primary-role={primaryCardActionPriorityRow?.role ?? 'none'}
                                        data-chain-shot-map-primary-screen-cue={primaryCardActionPriorityRow?.screenCue ?? 'none'}
                                        data-chain-shot-map-primary-tone={primaryCardActionPriorityRow?.tone ?? 'none'}
                                        data-testid="chain-opportunity-shot-map"
                                    >
                                        <small>Shot map</small>
                                        <span className={styles.chainOpportunityShotMapSummary} data-testid="chain-opportunity-shot-map-summary">
                                            <small>Shots</small>
                                            <b>
                                                {cardFeedbackShotMapRows.length}{' '}
                                                {cardFeedbackShotMapRows.length === 1 ? 'lane' : 'lanes'}
                                            </b>
                                            <span aria-hidden="true" className={styles.chainOpportunityShotMapSummaryBeatPips}>
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, cardFeedbackShotMapRows.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-chain-shot-map-summary-pip={index + 1}
                                                            data-chain-shot-map-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                        {cardFeedbackShotMapRows.map((row) => (
                                            <span
                                                data-chain-shot-map-focus={
                                                    row.id === cardFeedbackPrimaryActionAttr ? 'primary' : 'support'
                                                }
                                                data-chain-shot-map-lane={row.id}
                                                data-chain-shot-map-count={row.count}
                                                data-chain-shot-map-role={row.role}
                                                data-chain-shot-map-screen-cue={row.screenCue}
                                                data-chain-shot-map-tone={row.tone}
                                                key={row.id}
                                            >
                                                <b>{row.shotLabel}</b>
                                                <em>{row.count}</em>
                                                <span aria-hidden="true" className={styles.chainOpportunityShotMapBeatPips}>
                                                    {Array.from({ length: Math.max(2, Math.min(5, row.count)) }, (_, index) => (
                                                        <i
                                                            data-chain-shot-map-pip={index + 1}
                                                            data-chain-shot-map-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                                <i>{row.detail}</i>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {cardFeedbackBeatRows.length > 0 ? (
                                    <span
                                        aria-label={cardFeedbackBeatMapLabel}
                                        className={styles.chainOpportunityBeatMap}
                                        data-card-beat-actions={cardFeedbackBeatActionMapAttr}
                                        data-card-beat-primary={cardFeedbackBeatRows[0]?.id ?? 'none'}
                                        data-card-beat-primary-screen-cue={primaryCardFeedbackBeatRow?.screenCue ?? 'none'}
                                        data-card-beat-primary-tone={primaryCardFeedbackBeatRow?.tone ?? 'none'}
                                        data-testid="chain-opportunity-beat-map"
                                    >
                                        <small>Beat map</small>
                                        <span
                                            className={styles.chainOpportunityBeatMapSummary}
                                            data-card-beat-map-summary-meter-fill={Math.round(
                                                Math.min(100, (cardFeedbackBeatRows.length / 5) * 100)
                                            )}
                                            data-testid="chain-opportunity-beat-map-summary"
                                            style={
                                                {
                                                    '--card-beat-map-summary-meter-fill': `${Math.round(
                                                        Math.min(100, (cardFeedbackBeatRows.length / 5) * 100)
                                                    )}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <small>Beats</small>
                                            <b>
                                                {cardFeedbackBeatRows.length}{' '}
                                                {cardFeedbackBeatRows.length === 1 ? 'lane' : 'lanes'}
                                            </b>
                                            <i aria-hidden="true" className={styles.chainOpportunityBeatMapSummaryMeter}>
                                                <i aria-hidden="true" className={styles.chainOpportunityBeatMapSummaryMeterFill} />
                                            </i>
                                            <span aria-hidden="true" className={styles.chainOpportunityBeatMapSummaryPips}>
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, cardFeedbackBeatRows.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-card-beat-map-summary-pip={index + 1}
                                                            data-card-beat-map-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                        {cardFeedbackBeatRows.map((row) => (
                                            <span
                                                data-card-beat-action={row.action}
                                                data-card-beat-focus={row.id === cardFeedbackBeatRows[0]?.id ? 'primary' : 'support'}
                                                data-card-beat-screen-cue={row.screenCue}
                                                data-card-beat-tier={row.id}
                                                data-card-beat-tone={row.tone}
                                                key={row.id}
                                            >
                                                <b>{row.label}</b>
                                                <em>{row.count}</em>
                                                <span aria-hidden="true" className={styles.chainOpportunityBeatMapPips}>
                                                    {Array.from({ length: row.beatCount }, (_, index) => (
                                                        <i
                                                            data-card-beat-pip={index + 1}
                                                            data-card-beat-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                                <i>{row.beatCount}-beat {row.action}</i>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {cardFeedbackCadenceRows.length > 0 ? (
                                    <span
                                        aria-label={cardFeedbackCadenceMapLabel}
                                        className={styles.chainOpportunityCadenceMap}
                                        data-card-cadence-primary={cardFeedbackCadenceRows[0]?.id ?? 'none'}
                                        data-card-cadence-primary-screen-cue={primaryCardFeedbackCadenceRow?.screenCue ?? 'none'}
                                        data-card-cadence-primary-tone={primaryCardFeedbackCadenceRow?.tone ?? 'none'}
                                        data-testid="chain-opportunity-cadence-map"
                                    >
                                        <small>Pulse map</small>
                                        <span className={styles.chainOpportunityCadenceMapSummary} data-testid="chain-opportunity-cadence-map-summary">
                                            <small>Pulses</small>
                                            <b>
                                                {cardFeedbackCadenceRows.length}{' '}
                                                {cardFeedbackCadenceRows.length === 1 ? 'lane' : 'lanes'}
                                            </b>
                                            <span aria-hidden="true" className={styles.chainOpportunityCadenceMapSummaryPips}>
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, cardFeedbackCadenceRows.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-card-cadence-map-summary-pip={index + 1}
                                                            data-card-cadence-map-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                        {cardFeedbackCadenceRows.map((row) => (
                                            <span
                                                data-card-cadence={row.id}
                                                data-card-cadence-focus={row.id === cardFeedbackCadenceRows[0]?.id ? 'primary' : 'support'}
                                                data-card-cadence-screen-cue={row.screenCue}
                                                data-card-cadence-tone={row.tone}
                                                key={row.id}
                                            >
                                                <b>{row.label}</b>
                                                <em>{row.count}</em>
                                                <span aria-hidden="true" className={styles.chainOpportunityCadencePips}>
                                                    {Array.from({ length: row.beatCount }, (_, index) => (
                                                        <i
                                                            data-card-cadence-pip={index + 1}
                                                            data-card-cadence-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                                <i>{row.action}</i>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {cardFeedbackTraitLaneBeatRows.length > 0 ? (
                                    <span
                                        aria-label={cardFeedbackTraitLaneBeatMapLabel}
                                        className={styles.chainOpportunityTraitLaneBeatMap}
                                        data-card-trait-lane-primary-audio={primaryTraitLaneAudioCue}
                                        data-card-trait-lane-beat-primary={cardFeedbackTraitLaneBeatRows[0]?.id ?? 'none'}
                                        data-card-trait-lane-beat-primary-role={cardFeedbackTraitLaneBeatRows[0]?.role ?? 'none'}
                                        data-card-trait-lane-primary-action={cardFeedbackTraitLaneBeatRows[0]?.action ?? 'none'}
                                        data-card-trait-lane-primary-role={cardFeedbackTraitLaneBeatRows[0]?.role ?? 'none'}
                                        data-card-trait-lane-primary-screen-cue={primaryTraitLaneScreenCue}
                                        data-testid="chain-opportunity-trait-lane-beat-map"
                                    >
                                        <span
                                            className={styles.chainOpportunityTraitLaneBeatMapSummary}
                                            data-testid="chain-opportunity-trait-lane-beat-map-summary"
                                            data-card-trait-lane-beat-map-meter-fill={cardFeedbackTraitLaneBeatMapMeterFill}
                                            style={
                                                {
                                                    '--card-trait-lane-beat-map-meter-fill': `${cardFeedbackTraitLaneBeatMapMeterFill}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <small>Beats</small>
                                            <b>
                                                {cardFeedbackTraitLaneBeatRows.length}{' '}
                                                {cardFeedbackTraitLaneBeatRows.length === 1 ? 'lane' : 'lanes'}
                                            </b>
                                            <span
                                                aria-hidden="true"
                                                className={styles.chainOpportunityTraitLaneBeatMapSummaryPips}
                                            >
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, cardFeedbackTraitLaneBeatRows.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-card-trait-lane-beat-map-summary-pip={index + 1}
                                                            data-card-trait-lane-beat-map-summary-pip-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                            <i aria-hidden="true" className={styles.chainOpportunityTraitLaneBeatMapMeter}>
                                                <i aria-hidden="true" className={styles.chainOpportunityTraitLaneBeatMapMeterFill} />
                                            </i>
                                        </span>
                                        {cardFeedbackTraitLaneBeatRows.map((row) => (
                                            <span
                                                data-card-trait-lane-beat={row.id}
                                                data-card-trait-lane-beat-audio={cardTraitLaneAudioCue(row.id)}
                                                data-card-trait-lane-beat-focus={
                                                    row.id === cardFeedbackTraitLaneBeatRows[0]?.id
                                                        ? 'primary'
                                                        : 'support'
                                                }
                                                data-card-trait-lane-beat-role={row.role}
                                                data-card-trait-lane-beat-screen-cue={cardTraitLaneScreenCue(row.id)}
                                                key={row.id}
                                            >
                                                <b>{row.label}</b>
                                                <em>{row.count}</em>
                                                <span aria-hidden="true" className={styles.chainOpportunityTraitLaneBeatPips}>
                                                    {Array.from({ length: row.beatCount }, (_, index) => (
                                                        <i
                                                            data-card-trait-lane-beat-pip={index + 1}
                                                            data-card-trait-lane-beat-pip-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    ))}
                                                </span>
                                                <i>{row.beatCount}-beat {row.action}</i>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {boardChainAccessibilitySummary.tone !== 'idle' ? (
                                    <span
                                        aria-label={boardChainAccessibilitySummary.label}
                                        className={styles.chainOpportunityMeter}
                                        data-chain-meter-fill={boardChainOpportunityMeterFill}
                                        data-chain-meter-tone={boardChainAccessibilitySummary.tone}
                                        data-testid="chain-opportunity-meter"
                                        style={
                                            {
                                                '--chain-meter-fill': `${boardChainOpportunityMeterFill}%`
                                            } as CSSProperties
                                        }
                                    >
                                        {boardChainAccessibilitySummary.readyCount > 0 ? (
                                            <span data-chain-meter-lane="ready">
                                                <small>Lit</small>
                                                <b>{boardChainAccessibilitySummary.readyCount}</b>
                                                <span aria-hidden="true" className={styles.chainOpportunityMeterPips}>
                                                    {Array.from({ length: Math.min(5, boardChainAccessibilitySummary.readyCount) }, (_, index) => (
                                                        <i
                                                            data-chain-meter-pip={index + 1}
                                                            data-chain-meter-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`ready-${index}`}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        {boardChainAccessibilitySummary.followupCount > 0 ? (
                                            <span data-chain-meter-lane="followup">
                                                <small>Follow</small>
                                                <b>{boardChainAccessibilitySummary.followupCount}</b>
                                                <span aria-hidden="true" className={styles.chainOpportunityMeterPips}>
                                                    {Array.from({ length: Math.min(5, boardChainAccessibilitySummary.followupCount) }, (_, index) => (
                                                        <i
                                                            data-chain-meter-pip={index + 1}
                                                            data-chain-meter-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`followup-${index}`}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        {boardChainAccessibilitySummary.surgeCount > 0 ? (
                                            <span data-chain-meter-lane="surge">
                                                <small>Surge</small>
                                                <b>{boardChainAccessibilitySummary.surgeCount}</b>
                                                <span aria-hidden="true" className={styles.chainOpportunityMeterPips}>
                                                    {Array.from({ length: Math.min(5, boardChainAccessibilitySummary.surgeCount) }, (_, index) => (
                                                        <i
                                                            data-chain-meter-pip={index + 1}
                                                            data-chain-meter-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`surge-${index}`}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        {boardChainAccessibilitySummary.rewardHotCount > 0 ? (
                                            <span data-chain-meter-lane="hot">
                                                <small>Hot</small>
                                                <b>{boardChainAccessibilitySummary.rewardHotCount}</b>
                                                <span aria-hidden="true" className={styles.chainOpportunityMeterPips}>
                                                    {Array.from({ length: Math.min(5, boardChainAccessibilitySummary.rewardHotCount) }, (_, index) => (
                                                        <i
                                                            data-chain-meter-pip={index + 1}
                                                            data-chain-meter-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`hot-${index}`}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        {boardChainAccessibilitySummary.setupCount > 0 ? (
                                            <span data-chain-meter-lane="setup">
                                                <small>Prime</small>
                                                <b>{boardChainAccessibilitySummary.setupCount}</b>
                                                <span aria-hidden="true" className={styles.chainOpportunityMeterPips}>
                                                    {Array.from({ length: Math.min(5, boardChainAccessibilitySummary.setupCount) }, (_, index) => (
                                                        <i
                                                            data-chain-meter-pip={index + 1}
                                                            data-chain-meter-pip-focus={index === 0 ? 'primary' : 'support'}
                                                            key={`setup-${index}`}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ) : null}
                                        <span
                                            className={styles.chainOpportunityNextRoute}
                                            data-chain-meter-route-tone={boardChainAccessibilitySummary.tone}
                                        >
                                            <small>{boardChainAccessibilitySummary.tone === 'setup' ? 'Prime' : 'Next'}</small>
                                            <b>{boardChainAccessibilitySummary.primaryLine}</b>
                                            <span aria-hidden="true" className={styles.chainOpportunityNextRoutePips}>
                                                {Array.from({ length: boardChainAccessibilitySummary.tone === 'cashout' ? 5 : boardChainAccessibilitySummary.tone === 'ready' ? 3 : 2 }, (_, index) => (
                                                    <i
                                                        data-chain-next-route-pip={index + 1}
                                                        data-chain-next-route-pip-focus={index === 0 ? 'primary' : 'support'}
                                                        key={`route-${index}`}
                                                    />
                                                ))}
                                            </span>
                                            {boardChainAccessibilitySummary.secondaryLine ? (
                                                <em>{boardChainAccessibilitySummary.secondaryLine}</em>
                                            ) : null}
                                        </span>
                                        <i aria-hidden="true" className={styles.chainOpportunityMeterFill} />
                                    </span>
                                ) : null}
                                {boardRewardLadder.length > 0 ? (
                                    <span
                                        aria-label={boardRewardLadderAccessibleLabel}
                                        className={styles.chainOpportunityRewardLadder}
                                        data-board-chain-reward-ladder-actions={boardRewardLadderActionAttr}
                                        data-board-chain-reward-ladder={boardRewardLadderAttr}
                                        data-board-chain-reward-ladder-focus={boardRewardLadderFocusId ?? 'none'}
                                        data-board-chain-reward-hot-band={boardChainHotBand?.tone ?? 'none'}
                                        data-testid="chain-opportunity-reward-ladder"
                                    >
                                        <span
                                            className={styles.chainOpportunityRewardLadderSummary}
                                            data-board-chain-reward-ladder-summary-meter-fill={Math.round(
                                                Math.min(100, (boardRewardLadder.length / 3) * 100)
                                            )}
                                            data-testid="chain-opportunity-reward-ladder-summary"
                                            style={
                                                {
                                                    '--board-chain-reward-ladder-summary-meter-fill': `${Math.round(
                                                        Math.min(100, (boardRewardLadder.length / 3) * 100)
                                                    )}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <small>Rewards</small>
                                            <b>
                                                {boardRewardLadder.length}{' '}
                                                {boardRewardLadder.length === 1 ? 'reward' : 'rewards'}
                                            </b>
                                            <i aria-hidden="true" className={styles.chainOpportunityRewardLadderSummaryMeter}>
                                                <i aria-hidden="true" className={styles.chainOpportunityRewardLadderSummaryMeterFill} />
                                            </i>
                                            <span
                                                aria-hidden="true"
                                                className={styles.chainOpportunityRewardLadderSummaryBeatPips}
                                            >
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, boardRewardLadder.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-board-chain-reward-summary-beat={index + 1}
                                                            data-board-chain-reward-summary-beat-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                        </span>
                                {boardRewardLeadEntry ? (
                                    <span
                                        aria-label={boardRewardLeadLabel}
                                        className={styles.chainOpportunityRewardLead}
                                        data-board-chain-reward-lead-tier={boardChainOpportunity.rewardUrgencyTier ?? 'none'}
                                        data-board-chain-reward-lead-meter-fill={
                                            boardChainOpportunity.rewardUrgencyTier === 'next'
                                                ? 100
                                                : boardChainOpportunity.rewardUrgencyTier === 'soon'
                                                  ? 75
                                                  : boardChainOpportunity.rewardUrgencyTier === 'later'
                                                    ? 50
                                                    : 60
                                        }
                                        data-board-chain-reward-lead-action={boardRewardLeadEntry.action}
                                        data-board-chain-reward-lead-audio={boardChainRewardAudioCue(boardRewardLeadEntry)}
                                        data-board-chain-reward-lead-screen-cue={boardChainRewardScreenCue(boardRewardLeadEntry)}
                                        data-board-chain-reward-lead-tone={boardRewardLeadEntry.cue.tone}
                                        data-testid="chain-opportunity-reward-lead"
                                        style={
                                            {
                                                '--board-chain-reward-lead-meter-fill': `${
                                                    boardChainOpportunity.rewardUrgencyTier === 'next'
                                                        ? 100
                                                        : boardChainOpportunity.rewardUrgencyTier === 'soon'
                                                          ? 75
                                                          : boardChainOpportunity.rewardUrgencyTier === 'later'
                                                            ? 50
                                                            : 60
                                                }%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small>
                                            {boardChainOpportunity.rewardUrgencyTier === 'next'
                                                ? 'Now'
                                                : boardChainOpportunity.rewardUrgencyTier === 'soon'
                                                  ? 'Soon'
                                                  : boardChainOpportunity.rewardUrgencyTier === 'later'
                                                    ? 'Later'
                                                    : 'Next'}
                                        </small>
                                        <b>{boardRewardLeadEntry.cue.chaseLabel}</b>
                                        <strong>{boardRewardLeadEntry.action}</strong>
                                        <em>{boardRewardLeadEntry.cue.label}</em>
                                        <i>{boardRewardLeadEntry.progressLabel}</i>
                                        <small>{boardRewardLeadEntry.remainingLabel}</small>
                                        <i aria-hidden="true" className={styles.chainOpportunityRewardLeadMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityRewardLeadMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityRewardLeadBeatPips}>
                                            {Array.from(
                                                {
                                                    length:
                                                        boardChainOpportunity.rewardUrgencyTier === 'soon'
                                                            ? 4
                                                            : boardChainOpportunity.rewardUrgencyTier === 'later'
                                                              ? 2
                                                              : 3
                                                },
                                                (_, index) => (
                                                    <i
                                                        data-board-chain-reward-lead-beat={index + 1}
                                                        data-board-chain-reward-lead-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                        {boardRewardLadder.map((entry) => (
                                            <span
                                                data-board-chain-reward-action={entry.action}
                                                data-board-chain-reward-audio={boardChainRewardAudioCue(entry)}
                                                data-board-chain-reward-beats={boardChainRewardBeatCount(entry)}
                                                data-board-chain-reward-filled={entry.filled}
                                                data-board-chain-reward-focus={
                                                    entry.cue.urgency === boardRewardLadderFocusId ? 'primary' : 'support'
                                                }
                                                data-board-chain-reward-screen-cue={boardChainRewardScreenCue(entry)}
                                                data-board-chain-reward-tone={entry.cue.tone}
                                                data-board-chain-reward-total={entry.total}
                                                data-board-chain-reward-urgency={entry.cue.urgency}
                                                data-testid={
                                                    entry.cue.urgency === boardRewardLadderFocusId
                                                        ? 'chain-opportunity-reward-ladder-focus'
                                                        : undefined
                                                }
                                                key={entry.cue.id}
                                                style={{ '--board-chain-reward-fill': `${Math.round((entry.filled / entry.total) * 100)}%` } as CSSProperties}
                                            >
                                                <small>{entry.cue.chaseLabel}</small>
                                                {entry.action !== entry.cue.chaseLabel ? <strong>{entry.action}</strong> : null}
                                                <b>{entry.cue.label}</b>
                                                <em>{entry.progressLabel}</em>
                                                <i>{entry.remainingLabel}</i>
                                                <span aria-hidden="true" className={styles.chainOpportunityRewardBeatPips}>
                                                    {Array.from({ length: boardChainRewardBeatCount(entry) }, (_, beatIndex) => (
                                                        <i
                                                            data-board-chain-reward-beat={beatIndex + 1}
                                                            data-board-chain-reward-beat-focus={
                                                                beatIndex === 0 ? 'primary' : 'support'
                                                            }
                                                            key={`${entry.cue.id}-reward-beat-${beatIndex + 1}`}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {boardChainOpportunity.nextTarget ? (
                                    <span
                                        className={styles.chainOpportunityTarget}
                                        data-chain-target-action={boardChainOpportunity.nextActionId}
                                        data-chain-target-tier={boardChainOpportunityNextActionTier}
                                        data-chain-target-tone={boardChainOpportunity.nextActionTone}
                                        data-chain-opportunity-target={boardChainOpportunity.nextTarget}
                                    >
                                        {boardChainOpportunity.nextTarget}
                                        <span aria-hidden="true" className={styles.chainOpportunityTargetBeatPips}>
                                            {Array.from(
                                                {
                                                    length:
                                                        boardChainOpportunity.nextActionId === 'cashout'
                                                            ? 5
                                                            : boardChainOpportunity.nextActionId === 'follow-up'
                                                              ? 3
                                                              : 2
                                                },
                                                (_, index) => (
                                                    <i
                                                        data-chain-target-beat={index + 1}
                                                        data-chain-target-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.milestoneActionLabel && boardChainOpportunity.milestoneTargetLabel ? (
                                    <span
                                        className={styles.chainOpportunityMilestone}
                                        data-chain-milestone-tone={boardChainOpportunity.milestoneTone ?? 'none'}
                                        data-chain-milestone-meter-fill={boardChainOpportunity.milestoneMeterFill}
                                        data-testid="chain-opportunity-milestone"
                                        style={
                                            {
                                                '--chain-milestone-meter-fill': `${boardChainOpportunity.milestoneMeterFill}%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small>{boardChainOpportunity.milestoneActionLabel}</small>
                                        <b>{boardChainOpportunity.milestoneTargetLabel}</b>
                                        <i
                                            aria-hidden="true"
                                            className={styles.chainOpportunityMilestoneMeter}
                                            data-testid="chain-opportunity-milestone-meter"
                                        >
                                            <i aria-hidden="true" className={styles.chainOpportunityMilestoneMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityMilestoneBeatPips}>
                                            {Array.from(
                                                {
                                                    length: boardChainOpportunity.milestoneBeatCount
                                                },
                                                (_, index) => (
                                                    <i
                                                        data-chain-milestone-beat={index + 1}
                                                        data-chain-milestone-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.targetPlanLabel ? (
                                    <span
                                        className={styles.chainOpportunityTargetPlan}
                                        data-chain-target-plan-action={boardChainOpportunity.nextActionId}
                                        data-chain-target-plan-tier={boardChainOpportunityNextActionTier}
                                        data-chain-target-plan-tone={boardChainOpportunity.nextActionTone}
                                        data-chain-opportunity-target-plan={boardChainOpportunity.targetPlanLabel}
                                    >
                                        {boardChainOpportunity.targetPlanLabel}
                                        <span aria-hidden="true" className={styles.chainOpportunityTargetPlanBeatPips}>
                                            {Array.from(
                                                {
                                                    length:
                                                        boardChainOpportunity.comboSurgeLabel || boardChainOpportunity.rewardHot
                                                            ? 3
                                                            : 2
                                                },
                                                (_, index) => (
                                                    <i
                                                        data-chain-target-plan-beat={index + 1}
                                                        data-chain-target-plan-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainSequenceCue ? (
                                    <span
                                        aria-label={`Chain sequence. First: ${trimTerminalPunctuation(boardChainSequenceCue.first)}. Then: ${trimTerminalPunctuation(boardChainSequenceCue.then)}. Keep: ${trimTerminalPunctuation(boardChainSequenceCue.keep)}.`}
                                        className={styles.chainOpportunitySequenceCue}
                                        data-chain-sequence-tone={boardChainSequenceCue.tone}
                                        data-testid="chain-opportunity-sequence-cue"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={styles.chainOpportunitySequenceStep}
                                            data-chain-sequence-step="first"
                                            data-chain-sequence-step-tone={boardChainSequenceCue.tone}
                                        >
                                            <small>First</small>
                                            <b>{boardChainSequenceCue.first}</b>
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={styles.chainOpportunitySequenceStep}
                                            data-chain-sequence-step="then"
                                            data-chain-sequence-step-tone={boardChainSequenceCue.tone}
                                        >
                                            <small>Then</small>
                                            <b>{boardChainSequenceCue.then}</b>
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={styles.chainOpportunitySequenceStep}
                                            data-chain-sequence-step="keep"
                                            data-chain-sequence-step-tone={boardChainSequenceCue.tone}
                                        >
                                            <small>Keep</small>
                                            <b>{boardChainSequenceCue.keep}</b>
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.comboSurgeLabel ? (
                                    <span
                                        className={styles.chainOpportunitySurge}
                                        data-chain-opportunity-surge-beats={4}
                                        data-chain-opportunity-surge-screen-cue="burst"
                                        data-chain-opportunity-surge="true"
                                        data-chain-opportunity-surge-tone="surge"
                                        data-testid="chain-opportunity-surge"
                                    >
                                        <b>{boardChainOpportunity.comboSurgeLabel}</b>
                                        <span aria-hidden="true" className={styles.chainOpportunitySurgeBeatPips}>
                                            {Array.from({ length: 4 }, (_, index) => (
                                                <i
                                                    data-chain-opportunity-surge-beat={index + 1}
                                                    data-chain-opportunity-surge-beat-focus={
                                                        index === 0 ? 'primary' : 'support'
                                                    }
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.selectedFollowupLabel ? (
                                    <span
                                        aria-label={`Next tap follow-up. ${boardChainOpportunity.selectedFollowupLabel}. 3 beats.`}
                                        className={styles.chainOpportunityFollowup}
                                        data-chain-followup-action="Tap follow-up"
                                        data-chain-followup-meter-fill="100"
                                        data-chain-followup-beats={3}
                                        data-chain-followup-ready="true"
                                        data-chain-followup-screen-cue="pulse"
                                        data-chain-followup-tone="route"
                                        data-testid="chain-opportunity-followup-cue"
                                    >
                                        <small>Next tap</small>
                                        <b>{boardChainOpportunity.selectedFollowupLabel}</b>
                                        <i aria-hidden="true" className={styles.chainOpportunityFollowupMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityFollowupMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityFollowupBeatPips}>
                                            {Array.from({ length: 3 }, (_, index) => (
                                                <i
                                                    data-chain-followup-beat={index + 1}
                                                    data-chain-followup-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.armedPerkLabel ? (
                                    <span
                                        className={styles.chainOpportunityArmedPerk}
                                        data-chain-armed-perk-meter-fill={boardChainOpportunity.armedPerkPayoff ? 100 : 70}
                                        data-chain-armed-perk-tone={boardChainOpportunity.armedPerkPayoff ? 'payoff' : 'armed'}
                                        data-chain-perk-armed="true"
                                    >
                                        <small>{boardChainOpportunity.armedPerkPayoff ? 'Payoff' : 'Ready'}</small>
                                        <b>{boardChainOpportunity.armedPerkLabel}</b>
                                        {boardChainOpportunity.armedPerkPayoff ? (
                                            <em>{boardChainOpportunity.armedPerkPayoff}</em>
                                        ) : null}
                                        <i
                                            aria-hidden="true"
                                            className={styles.chainOpportunityArmedPerkMeter}
                                            style={
                                                {
                                                    '--chain-armed-perk-meter-fill': `${
                                                        boardChainOpportunity.armedPerkPayoff ? 100 : 70
                                                    }%`
                                                } as CSSProperties
                                            }
                                        >
                                            <i aria-hidden="true" className={styles.chainOpportunityArmedPerkMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityArmedPerkBeatPips}>
                                            {Array.from({ length: boardChainOpportunity.armedPerkPayoff ? 4 : 3 }, (_, index) => (
                                                <i
                                                    data-chain-armed-perk-beat={index + 1}
                                                    data-chain-armed-perk-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.rewardUrgencyLabel ? (
                                    <span
                                        className={styles.chainOpportunityRewardUrgency}
                                        data-chain-reward-urgency={boardChainOpportunity.rewardUrgencyTier ?? 'none'}
                                        data-chain-reward-urgency-meter-fill={
                                            boardChainOpportunity.rewardUrgencyTier === 'next'
                                                ? 100
                                                : boardChainOpportunity.rewardUrgencyTier === 'soon'
                                                  ? 75
                                                  : boardChainOpportunity.rewardUrgencyTier === 'later'
                                                    ? 50
                                                    : 60
                                        }
                                        style={
                                            {
                                                '--chain-reward-urgency-meter-fill': `${
                                                    boardChainOpportunity.rewardUrgencyTier === 'next'
                                                        ? 100
                                                        : boardChainOpportunity.rewardUrgencyTier === 'soon'
                                                          ? 75
                                                          : boardChainOpportunity.rewardUrgencyTier === 'later'
                                                            ? 50
                                                            : 60
                                                }%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small>{boardChainOpportunity.rewardUrgencyLabel}</small>
                                        <i aria-hidden="true" className={styles.chainOpportunityRewardUrgencyMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityRewardUrgencyMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityRewardUrgencyBeatPips}>
                                            {Array.from(
                                                {
                                                    length:
                                                        boardChainOpportunity.rewardUrgencyTier === 'soon'
                                                            ? 4
                                                            : boardChainOpportunity.rewardUrgencyTier === 'later'
                                                              ? 2
                                                              : 3
                                                },
                                                (_, index) => (
                                                    <i
                                                        data-chain-reward-urgency-beat={index + 1}
                                                        data-chain-reward-urgency-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                )
                                            )}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.examples.length > 0 ? (
                                    <span
                                        className={styles.chainOpportunityExamples}
                                        data-chain-examples-meter-fill={Math.round(
                                            Math.min(100, (boardChainOpportunity.examples.length / 4) * 100)
                                        )}
                                        data-chain-examples-tone={
                                            boardChainOpportunity.nextActionId === 'prime-route'
                                                ? 'setup'
                                                : boardChainOpportunity.rewardHot
                                                  ? 'cashout'
                                                  : 'forecast'
                                        }
                                        style={
                                            {
                                                '--chain-examples-meter-fill': `${Math.round(
                                                    Math.min(100, (boardChainOpportunity.examples.length / 4) * 100)
                                                )}%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small>Examples</small>
                                        {boardChainOpportunity.examples.join(' / ')}
                                        <i aria-hidden="true" className={styles.chainOpportunityExamplesMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityExamplesMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityExamplesBeatPips}>
                                            {Array.from({ length: Math.min(4, boardChainOpportunity.examples.length + 1) }, (_, index) => (
                                                <i
                                                    data-chain-examples-beat={index + 1}
                                                    data-chain-examples-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.rewardCue ? (
                                    <span
                                        className={
                                            boardChainOpportunity.rewardHot
                                                ? styles.chainOpportunityPayoffBurst
                                                : styles.chainOpportunityRewardCue
                                        }
                                        data-chain-reward-beats={boardChainOpportunity.rewardHot ? 5 : 3}
                                        data-chain-reward-hot={boardChainOpportunity.rewardHot ? 'true' : 'false'}
                                        data-chain-reward-meter-fill={boardChainOpportunity.rewardHot ? 100 : 60}
                                        data-chain-reward-target={boardChainOpportunity.rewardHot ? 'cashout-now' : 'cashout-build'}
                                        data-chain-reward-screen-cue={
                                            boardChainOpportunity.rewardHot ? 'super' : 'pulse'
                                        }
                                        data-chain-reward-tone={
                                            boardChainOpportunity.rewardHot ? 'cashout' : 'forecast'
                                        }
                                        style={
                                            {
                                                '--chain-reward-meter-fill': `${
                                                    boardChainOpportunity.rewardHot ? 100 : 60
                                                }%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small>{boardChainOpportunity.rewardHot ? 'Payoff' : 'Forecast'}</small>
                                        <b>{boardChainOpportunity.rewardCue}</b>
                                        <em>{boardChainOpportunity.rewardHot ? 'Cash in now' : 'Build toward cashout'}</em>
                                        <i aria-hidden="true" className={styles.chainOpportunityRewardMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityRewardMeterFill} />
                                        </i>
                                        {boardChainOpportunity.rewardHot ? (
                                            <span aria-hidden="true" className={styles.chainOpportunityPayoffBeatPips}>
                                                {Array.from({ length: 5 }, (_, index) => (
                                                    <i
                                                        data-chain-reward-beat={index + 1}
                                                        data-chain-reward-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                ))}
                                            </span>
                                        ) : (
                                            <span aria-hidden="true" className={styles.chainOpportunityRewardCueBeatPips}>
                                                {Array.from({ length: 3 }, (_, index) => (
                                                    <i
                                                        data-chain-reward-beat={index + 1}
                                                        data-chain-reward-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                ))}
                                            </span>
                                        )}
                                    </span>
                                ) : null}
                                {boardChainHotBand ? (
                                    <span
                                        aria-label={boardChainHotBandLabel}
                                        className={styles.chainOpportunityHotBand}
                                        data-chain-hot-band-tone={boardChainHotBand.tone}
                                        data-chain-hot-band-meter-fill={boardChainHotBandMeterFill}
                                        data-testid="chain-opportunity-hot-band"
                                        role="status"
                                    >
                                        <small>{boardChainHotBand.label}</small>
                                        <b>{boardChainHotBand.value}</b>
                                        <em>{boardChainHotBand.detail}</em>
                                        <i>{boardChainHotBand.cue}</i>
                                        <i
                                            aria-hidden="true"
                                            className={styles.chainOpportunityHotBandMeter}
                                            data-chain-hot-band-meter-fill={boardChainHotBandMeterFill}
                                            style={
                                                {
                                                    '--chain-hot-band-meter-fill': `${boardChainHotBandMeterFill}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <i aria-hidden="true" className={styles.chainOpportunityHotBandMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityHotBandBeatPips}>
                                            {Array.from({ length: boardChainHotBand.tone === 'cashout' ? 5 : 3 }, (_, index) => (
                                                <i
                                                    data-chain-hot-band-beat={index + 1}
                                                    data-chain-hot-band-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainSurgeBand ? (
                                    <span
                                        aria-label={boardChainSurgeBandLabel}
                                        className={styles.chainOpportunitySurgeBand}
                                        data-chain-surge-band-tone={boardChainSurgeBand.tone}
                                        data-chain-surge-band-meter-fill={boardChainSurgeBandMeterFill}
                                        data-testid="chain-opportunity-surge-band"
                                        role="status"
                                    >
                                        <small>{boardChainSurgeBand.label}</small>
                                        <b>{boardChainSurgeBand.value}</b>
                                        <em>{boardChainSurgeBand.detail}</em>
                                        <i>{boardChainSurgeBand.cue}</i>
                                        <i aria-hidden="true" className={styles.chainOpportunitySurgeBandMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunitySurgeBandMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunitySurgeBandBeatPips}>
                                            {Array.from({ length: 4 }, (_, index) => (
                                                <i
                                                    data-chain-surge-band-beat={index + 1}
                                                    data-chain-surge-band-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardChainOpportunity.momentumLabel || boardChainOpportunity.chaseLabel ? (
                                    <span
                                        className={styles.chainOpportunityMomentum}
                                        data-chain-momentum-beats={boardChainMomentumBeatCount}
                                        data-chain-momentum-meter-fill={Math.round((boardChainMomentumBeatCount / 5) * 100)}
                                        data-chain-momentum-screen-cue={boardChainMomentumScreenCue}
                                        data-chain-momentum-tier={boardChainMomentumTier}
                                        data-chain-momentum-tone={boardChainMomentumTone}
                                        style={
                                            {
                                                '--chain-momentum-meter-fill': `${Math.round(
                                                    (boardChainMomentumBeatCount / 5) * 100
                                                )}%`
                                            } as CSSProperties
                                        }
                                    >
                                        {boardChainOpportunity.momentumLabel ? <b>{boardChainOpportunity.momentumLabel}</b> : null}
                                        {boardChainOpportunity.chaseLabel ? <small>{boardChainOpportunity.chaseLabel}</small> : null}
                                        <i aria-hidden="true" className={styles.chainOpportunityMomentumMeter}>
                                            <i aria-hidden="true" className={styles.chainOpportunityMomentumMeterFill} />
                                        </i>
                                        <span aria-hidden="true" className={styles.chainOpportunityMomentumBeatPips}>
                                            {Array.from({ length: boardChainMomentumBeatCount }, (_, index) => (
                                                <i
                                                    data-chain-momentum-beat={index + 1}
                                                    data-chain-momentum-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                <span
                                    className={styles.chainOpportunityLines}
                                    data-chain-lines-action={boardChainOpportunity.nextActionId}
                                    data-chain-lines-meter-fill={Math.round(Math.min(100, (boardChainOpportunity.lines.length / 3) * 100))}
                                    data-chain-lines-tier={boardChainOpportunityNextActionTier}
                                    data-chain-lines-tone={boardChainOpportunity.nextActionTone}
                                    style={
                                        {
                                            '--chain-lines-meter-fill': `${Math.round(
                                                Math.min(100, (boardChainOpportunity.lines.length / 3) * 100)
                                            )}%`
                                        } as CSSProperties
                                    }
                                >
                                    {boardChainOpportunity.lines.join(' / ')}
                                    <i aria-hidden="true" className={styles.chainOpportunityLinesMeter}>
                                        <i aria-hidden="true" className={styles.chainOpportunityLinesMeterFill} />
                                    </i>
                                    <span aria-hidden="true" className={styles.chainOpportunityLinesBeatPips}>
                                        {Array.from(
                                            { length: Math.max(2, Math.min(5, boardChainOpportunity.lines.length + 1)) },
                                            (_, index) => (
                                                <i
                                                    data-chain-lines-beat={index + 1}
                                                    data-chain-lines-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            )
                                        )}
                                    </span>
                                </span>
                            </div>
                        ) : null}
                        {boardTraitModeCue ? (
                            <div
                                aria-label={boardTraitModeCueLabel}
                                className={styles.traitModeCue}
                                data-testid="trait-mode-cue"
                                data-trait-mode-tone={boardTraitModeCue.tone}
                                role="status"
                            >
                                <span>{boardTraitModeCue.label}</span>
                                <strong>{boardTraitModeCue.value}</strong>
                                {boardTraitModeCue.nextReward ? <small>{boardTraitModeCue.nextReward}</small> : null}
                                <span aria-hidden="true" className={styles.traitModeCueBeatPips}>
                                    {Array.from(
                                        {
                                            length:
                                                boardTraitModeCue.tone === 'cashout' || boardTraitModeCue.tone === 'surge'
                                                    ? 5
                                                    : boardTraitModeCue.tone === 'ready'
                                                      ? 3
                                                      : 2
                                        },
                                        (_, index) => (
                                            <i
                                                data-trait-mode-beat={index + 1}
                                                data-trait-mode-beat-focus={index === 0 ? 'primary' : 'support'}
                                                key={index}
                                            />
                                        )
                                    )}
                                </span>
                                <small>{boardTraitModeCue.detail}</small>
                            </div>
                        ) : null}
                        {activePowerBoardChip ? (
                            <div
                                aria-label={activePowerBoardChipLabel}
                                className={styles.activePowerBoardChip}
                                data-active-power-beats={activePowerBoardChip.beats}
                                data-active-power-first={activePowerBoardChip.first}
                                data-active-power-then={activePowerBoardChip.then}
                                data-active-power-meter-fill={Math.round((activePowerBoardChip.beats / 4) * 100)}
                                data-active-power-tone={activePowerBoardChip.tone}
                                data-testid="active-power-board-chip"
                                role="status"
                            >
                                <span>{activePowerBoardChip.label}</span>
                                <strong>{activePowerBoardChip.detail}</strong>
                                <span
                                    aria-hidden="true"
                                    className={styles.activePowerBoardChipMeter}
                                    data-active-power-meter-fill={Math.round((activePowerBoardChip.beats / 4) * 100)}
                                >
                                    <i
                                        className={styles.activePowerBoardChipMeterFill}
                                        style={{
                                            '--active-power-meter-fill': `${Math.round((activePowerBoardChip.beats / 4) * 100)}%`
                                        } as CSSProperties}
                                    />
                                </span>
                                <span aria-hidden="true" className={styles.activePowerBoardChipBeatPips}>
                                    {Array.from({ length: activePowerBoardChip.beats }, (_, index) => (
                                        <i
                                            data-active-power-beat={index + 1}
                                            data-active-power-beat-focus={index === 0 ? 'primary' : 'support'}
                                            key={index}
                                        />
                                    ))}
                                </span>
                                <small data-active-power-step="first" data-active-power-step-tone={activePowerBoardChip.tone}>
                                    First: {activePowerBoardChip.first}
                                    <span aria-hidden="true" className={styles.activePowerBoardStepBeatPips}>
                                        {Array.from({ length: 2 }, (_, index) => (
                                            <i
                                                data-active-power-step-beat={index + 1}
                                                data-active-power-step-beat-focus={index === 0 ? 'primary' : 'support'}
                                                data-active-power-step-beat-phase="first"
                                                key={`active-power-step-first-${index + 1}`}
                                            />
                                        ))}
                                    </span>
                                </small>
                                <small data-active-power-step="then" data-active-power-step-tone={activePowerBoardChip.tone}>
                                    Then: {activePowerBoardChip.then}
                                    <span aria-hidden="true" className={styles.activePowerBoardStepBeatPips}>
                                        {Array.from({ length: 2 }, (_, index) => (
                                            <i
                                                data-active-power-step-beat={index + 1}
                                                data-active-power-step-beat-focus={index === 0 ? 'primary' : 'support'}
                                                data-active-power-step-beat-phase="then"
                                                key={`active-power-step-then-${index + 1}`}
                                            />
                                        ))}
                                    </span>
                                </small>
                            </div>
                        ) : null}
                        {boardPickupOpportunity.count > 0 ? (
                            <div
                                aria-label={boardPickupOpportunityLabel}
                                className={styles.pickupOpportunityChip}
                                data-pickup-opportunity-focus={boardPickupOpportunityFocus}
                                data-pickup-meter-fill={boardPickupOpportunityMeterFill}
                                data-testid="pickup-opportunity-chip"
                                role="status"
                            >
                                <span>Pickup rewards</span>
                                <strong>{boardPickupOpportunity.valueLabel}</strong>
                                {boardPickupOpportunity.target ? <b>{boardPickupOpportunity.target}</b> : null}
                                <span
                                    aria-hidden="true"
                                    className={styles.pickupOpportunityMeter}
                                    data-pickup-meter-fill={boardPickupOpportunityMeterFill}
                                >
                                    <i
                                        className={styles.pickupOpportunityMeterFill}
                                        style={{ '--pickup-meter-fill': `${boardPickupOpportunityMeterFill}%` } as CSSProperties}
                                    />
                                </span>
                                <span aria-hidden="true" className={styles.pickupOpportunityChipBeatPips}>
                                    {Array.from(
                                        {
                                            length:
                                                boardPickupOpportunityFocus === 'cashout'
                                                    ? 4
                                                    : boardPickupOpportunity.count > 1
                                                      ? 3
                                                      : 2
                                        },
                                        (_, index) => (
                                            <i
                                                data-pickup-chip-beat={index + 1}
                                                data-pickup-chip-beat-focus={index === 0 ? 'primary' : 'support'}
                                                key={index}
                                            />
                                        )
                                    )}
                                </span>
                                {boardPickupOpportunity.stackCue ? (
                                    <em>{boardPickupOpportunity.stackCue}</em>
                                ) : null}
                                {boardPickupOpportunity.stackDetail ? (
                                    <i>{boardPickupOpportunity.stackDetail}</i>
                                ) : null}
                                {boardPickupOpportunity.sequenceCue ? (
                                    <span
                                        aria-label={`Pickup sequence. First: ${boardPickupOpportunity.sequenceCue.first}. Then: ${boardPickupOpportunity.sequenceCue.then}. Keep: ${boardPickupOpportunity.sequenceCue.keep}.`}
                                        className={styles.pickupOpportunitySequence}
                                        data-pickup-sequence-tone={boardPickupOpportunity.sequenceCue.tone}
                                        data-testid="pickup-opportunity-sequence"
                                    >
                                        <small
                                            data-pickup-sequence-phase="first"
                                            data-pickup-sequence-phase-tone={boardPickupOpportunity.sequenceCue.tone}
                                        >
                                            First
                                        </small>
                                        <b
                                            data-pickup-sequence-value-phase="first"
                                            data-pickup-sequence-value-tone={boardPickupOpportunity.sequenceCue.tone}
                                        >
                                            {boardPickupOpportunity.sequenceCue.first}
                                        </b>
                                        <small
                                            data-pickup-sequence-phase="then"
                                            data-pickup-sequence-phase-tone={boardPickupOpportunity.sequenceCue.tone}
                                        >
                                            Then
                                        </small>
                                        <b
                                            data-pickup-sequence-value-phase="then"
                                            data-pickup-sequence-value-tone={boardPickupOpportunity.sequenceCue.tone}
                                        >
                                            {boardPickupOpportunity.sequenceCue.then}
                                        </b>
                                        <small
                                            data-pickup-sequence-phase="keep"
                                            data-pickup-sequence-phase-tone={boardPickupOpportunity.sequenceCue.tone}
                                        >
                                            Keep
                                        </small>
                                        <b
                                            data-pickup-sequence-value-phase="keep"
                                            data-pickup-sequence-value-tone={boardPickupOpportunity.sequenceCue.tone}
                                        >
                                            {boardPickupOpportunity.sequenceCue.keep}
                                        </b>
                                        <span aria-hidden="true" className={styles.pickupOpportunitySequenceBeatPips}>
                                            {Array.from({ length: 3 }, (_, index) => (
                                                <i
                                                    data-pickup-sequence-beat={index + 1}
                                                    data-pickup-sequence-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    data-pickup-sequence-beat-phase={
                                                        index === 0 ? 'first' : index === 1 ? 'then' : 'keep'
                                                    }
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardPickupOpportunity.examples.length > 0 ? (
                                    <small>{boardPickupOpportunity.examples.join(' / ')}</small>
                                ) : null}
                            </div>
                        ) : null}
                        {boardOpportunityCompassRows.length > 0 ? (
                            <div
                                aria-label={boardOpportunityCompassLabel}
                                className={styles.opportunityCompass}
                                data-opportunity-compass-best-screen-cue={
                                    boardBestOpportunity ? boardOpportunityScreenCue(boardBestOpportunity) : 'none'
                                }
                                data-opportunity-compass-best-tone={boardBestOpportunity?.tone ?? 'none'}
                                data-opportunity-compass-heat={boardBestOpportunityHeat}
                                data-opportunity-compass-hot={boardChainHotBand?.tone ?? 'none'}
                                data-opportunity-compass-surge={boardChainOpportunity.comboSurgeLabel ? 'true' : 'false'}
                                data-opportunity-compass-beats={boardOpportunityCompassRows.length}
                                data-opportunity-compass-priority={boardOpportunityCompassRows.length === 1 ? 'single' : 'best'}
                                data-testid="board-opportunity-compass"
                                role="group"
                            >
                                <span
                                    className={styles.opportunityCompassSummary}
                                    data-opportunity-compass-summary-screen-cue={
                                        boardBestOpportunity ? boardOpportunityScreenCue(boardBestOpportunity) : 'none'
                                    }
                                    data-opportunity-compass-summary-tone={boardBestOpportunity?.tone ?? 'none'}
                                    data-testid="board-opportunity-compass-summary"
                                >
                                    <small>{boardOpportunityCompassRows.length === 1 ? 'Only' : 'Best'}</small>
                                    <b>{boardOpportunityCompassRows.length} {boardOpportunityCompassRows.length === 1 ? 'play' : 'plays'}</b>
                                    <span aria-hidden="true" className={styles.opportunityCompassSummaryBeatPips}>
                                        {Array.from(
                                            { length: Math.max(2, Math.min(5, boardOpportunityCompassRows.length + 1)) },
                                            (_, index) => (
                                                <i
                                                    data-opportunity-compass-summary-beat={index + 1}
                                                    data-opportunity-compass-summary-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            )
                                        )}
                                    </span>
                                </span>
                                <i
                                    aria-hidden="true"
                                    className={styles.opportunityCompassMeter}
                                    data-opportunity-compass-meter-fill={boardOpportunityCompassMeterFill}
                                    data-testid="board-opportunity-compass-meter"
                                    style={
                                        {
                                            '--opportunity-compass-meter-fill': `${boardOpportunityCompassMeterFill}%`
                                        } as CSSProperties
                                    }
                                >
                                    <i aria-hidden="true" className={styles.opportunityCompassMeterFill} />
                                </i>
                                {boardPayoffStack ? (
                                    <span
                                        aria-label={`Board payoff stack. ${boardPayoffStack.cue}. ${boardPayoffStack.action}. ${boardPayoffStack.value}. ${boardPayoffStack.detail}. Crescendo: ${boardPayoffStack.crescendo.label}. ${boardPayoffStack.crescendo.detail}. ${boardPayoffStack.crescendo.beatCount} beats. ${boardPayoffStack.nextCue}.${
                                            boardPayoffStack.sequenceCue ? ` ${boardPayoffStack.sequenceCue}.` : ''
                                        } Keep: ${boardPayoffStack.sequence.keep}.`}
                                        className={styles.opportunityPayoffStack}
                                        data-payoff-stack-crescendo-audio={boardPayoffStackCrescendoAudioCue(boardPayoffStack.crescendo.tier)}
                                        data-payoff-stack-crescendo-beats={boardPayoffStack.crescendo.beatCount}
                                        data-payoff-stack-crescendo-cue={boardPayoffStack.crescendo.screenCue}
                                        data-payoff-stack-crescendo-screen-cue={boardPayoffStack.crescendo.screenCue}
                                        data-payoff-stack-crescendo-tier={boardPayoffStack.crescendo.tier}
                                        data-payoff-stack-heat={boardPayoffStack.heat}
                                        data-payoff-stack-sequence-first={boardPayoffStack.sequence.first}
                                        data-payoff-stack-sequence-keep={boardPayoffStack.sequence.keep}
                                        data-payoff-stack-sequence-then={boardPayoffStack.sequence.then}
                                        data-payoff-stack-tone={boardPayoffStack.tone}
                                        data-payoff-stack-fill={boardPayoffStackFill}
                                        data-testid="board-opportunity-payoff-stack"
                                        style={
                                            {
                                                '--payoff-stack-fill': `${boardPayoffStackFill}%`
                                            } as CSSProperties
                                        }
                                    >
                                        <small data-payoff-stack-cue={boardPayoffStack.cue}>{boardPayoffStack.cue}</small>
                                        <span>{boardPayoffStack.action}</span>
                                        <strong>{boardPayoffStack.value}</strong>
                                        <u>{boardPayoffStack.tone === 'cashout' ? 'Hit now' : 'Prime payoff'}</u>
                                        <b>{boardPayoffStack.detail}</b>
                                        <i aria-hidden="true" className={styles.opportunityPayoffStackMeter} />
                                        <span
                                            className={styles.opportunityPayoffCrescendo}
                                            data-payoff-stack-crescendo-label={boardPayoffStack.crescendo.label}
                                            data-payoff-stack-crescendo-fill={Math.round((boardPayoffStack.crescendo.beatCount / 5) * 100)}
                                            style={
                                                {
                                                    '--payoff-stack-crescendo-fill': `${Math.round(
                                                        (boardPayoffStack.crescendo.beatCount / 5) * 100
                                                    )}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <small>{boardPayoffStack.crescendo.label}</small>
                                            <strong>
                                                {Array.from({ length: boardPayoffStack.crescendo.beatCount }, (_, index) => (
                                                    <i
                                                        aria-hidden="true"
                                                        data-payoff-stack-crescendo-beat={index + 1}
                                                        data-payoff-stack-crescendo-beat-focus={index === 0 ? 'primary' : 'support'}
                                                        key={index}
                                                    />
                                                ))}
                                            </strong>
                                            <em>{boardPayoffStack.crescendo.detail}</em>
                                            <i aria-hidden="true" className={styles.opportunityPayoffCrescendoMeter}>
                                                <i aria-hidden="true" className={styles.opportunityPayoffCrescendoMeterFill} />
                                            </i>
                                        </span>
                                        <em data-payoff-stack-sequence-step="first">{boardPayoffStack.nextCue}</em>
                                        {boardPayoffStack.sequenceCue ? (
                                            <i data-payoff-stack-sequence-step="then">{boardPayoffStack.sequenceCue}</i>
                                        ) : null}
                                        <i data-payoff-stack-sequence-step="keep">Keep: {boardPayoffStack.sequence.keep}</i>
                                        <span aria-hidden="true" className={styles.opportunityPayoffStackBeatPips}>
                                            {Array.from({ length: boardPayoffStack.crescendo.beatCount }, (_, index) => (
                                                <i
                                                    data-opportunity-payoff-beat={index + 1}
                                                    data-opportunity-payoff-beat-focus={index === 0 ? 'primary' : 'support'}
                                                    key={index}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                ) : null}
                                {boardOpportunityLaneMapRows.length > 0 ? (
                                    <span
                                        aria-label={boardOpportunityLaneMapAccessibleLabel}
                                        className={styles.opportunityLaneMap}
                                        data-opportunity-lane-actions={boardOpportunityLaneActionMapAttrValue}
                                        data-opportunity-lane-map={boardOpportunityLaneMapAttrValue}
                                        data-opportunity-lane-roles={boardOpportunityLaneRoleMapAttrValue}
                                        data-opportunity-primary-lane={primaryBoardOpportunityLane?.id ?? 'none'}
                                        data-opportunity-primary-lane-action={primaryBoardOpportunityLane?.action ?? 'none'}
                                        data-opportunity-primary-lane-audio={
                                            primaryBoardOpportunityLane ? boardOpportunityLaneAudioCue(primaryBoardOpportunityLane) : 'none'
                                        }
                                        data-opportunity-primary-lane-beats={
                                            primaryBoardOpportunityLane ? boardOpportunityLaneBeatCount(primaryBoardOpportunityLane) : 0
                                        }
                                        data-opportunity-primary-lane-cue={primaryBoardOpportunityLane?.cue ?? 'none'}
                                        data-opportunity-primary-lane-focus={
                                            primaryBoardOpportunityLane ? boardOpportunityLaneFocus(primaryBoardOpportunityLane) : 'none'
                                        }
                                        data-opportunity-primary-lane-role={
                                            primaryBoardOpportunityLane ? boardOpportunityLaneRole(primaryBoardOpportunityLane) : 'none'
                                        }
                                        data-opportunity-primary-lane-screen-cue={
                                            primaryBoardOpportunityLane ? boardOpportunityLaneScreenCue(primaryBoardOpportunityLane) : 'none'
                                        }
                                        data-testid="board-opportunity-lane-map"
                                    >
                                        <span
                                            className={styles.opportunityLaneMapSummary}
                                            data-testid="board-opportunity-lane-map-summary"
                                            data-opportunity-lane-map-meter-fill={boardOpportunityLaneMapMeterFill}
                                            style={
                                                {
                                                    '--opportunity-lane-map-meter-fill': `${boardOpportunityLaneMapMeterFill}%`
                                                } as CSSProperties
                                            }
                                        >
                                            <small>Lanes</small>
                                            <b>
                                                {boardOpportunityLaneMapRows.length}{' '}
                                                {boardOpportunityLaneMapRows.length === 1 ? 'lane' : 'lanes'}
                                            </b>
                                            <span aria-hidden="true" className={styles.opportunityLaneMapSummaryBeatPips}>
                                                {Array.from(
                                                    { length: Math.max(2, Math.min(5, boardOpportunityLaneMapRows.length + 1)) },
                                                    (_, index) => (
                                                        <i
                                                            data-opportunity-lane-map-summary-beat={index + 1}
                                                            data-opportunity-lane-map-summary-beat-focus={
                                                                index === 0 ? 'primary' : 'support'
                                                            }
                                                            key={index}
                                                        />
                                                    )
                                                )}
                                            </span>
                                            <i aria-hidden="true" className={styles.opportunityLaneMapMeter}>
                                                <i aria-hidden="true" className={styles.opportunityLaneMapMeterFill} />
                                            </i>
                                        </span>
                                        {primaryBoardOpportunityLane ? (
                                        <span
                                                aria-label={`Primary opportunity lane. ${primaryBoardOpportunityLane.label} ${boardOpportunityLaneRole(primaryBoardOpportunityLane)}. ${primaryBoardOpportunityLane.action}. ${primaryBoardOpportunityLane.cue}. ${boardOpportunityLaneBeatCount(primaryBoardOpportunityLane)} beats.`}
                                                className={styles.opportunityPrimaryLane}
                                                data-opportunity-primary-lane={primaryBoardOpportunityLane.id}
                                                data-opportunity-primary-lane-action={primaryBoardOpportunityLane.action}
                                                data-opportunity-primary-lane-audio={boardOpportunityLaneAudioCue(primaryBoardOpportunityLane)}
                                                data-opportunity-primary-lane-beats={boardOpportunityLaneBeatCount(primaryBoardOpportunityLane)}
                                                data-opportunity-primary-lane-meter-fill={Math.round((boardOpportunityLaneBeatCount(primaryBoardOpportunityLane) / 5) * 100)}
                                                data-opportunity-primary-lane-cue={primaryBoardOpportunityLane.cue}
                                                data-opportunity-primary-lane-focus={boardOpportunityLaneFocus(primaryBoardOpportunityLane)}
                                                data-opportunity-primary-lane-role={boardOpportunityLaneRole(primaryBoardOpportunityLane)}
                                                data-opportunity-primary-lane-screen-cue={boardOpportunityLaneScreenCue(primaryBoardOpportunityLane)}
                                                data-testid="board-opportunity-primary-lane"
                                                style={
                                                    {
                                                        '--opportunity-primary-lane-meter-fill': `${Math.round(
                                                            (boardOpportunityLaneBeatCount(primaryBoardOpportunityLane) / 5) * 100
                                                        )}%`
                                                    } as CSSProperties
                                                }
                                            >
                                                <small>Board focus</small>
                                                <b>{primaryBoardOpportunityLane.label}</b>
                                                <u>{boardOpportunityLaneRole(primaryBoardOpportunityLane)}</u>
                                                <strong>{primaryBoardOpportunityLane.action}</strong>
                                                <em>{primaryBoardOpportunityLane.cue}</em>
                                                <span aria-hidden="true" className={styles.opportunityPrimaryLaneBeatPips}>
                                                    {Array.from(
                                                        { length: boardOpportunityLaneBeatCount(primaryBoardOpportunityLane) },
                                                        (_, beatIndex) => (
                                                            <i
                                                                data-opportunity-primary-lane-beat={beatIndex + 1}
                                                                data-opportunity-primary-lane-beat-focus={
                                                                    beatIndex === 0 ? 'primary' : 'support'
                                                                }
                                                                key={beatIndex}
                                                            />
                                                        )
                                                    )}
                                                </span>
                                            </span>
                                        ) : null}
                                        {boardOpportunityLaneMapRows.map((lane) => (
                                            <span
                                                data-opportunity-lane={lane.id}
                                                data-opportunity-lane-action={lane.action}
                                                data-opportunity-lane-audio={boardOpportunityLaneAudioCue(lane)}
                                                data-opportunity-lane-beats={boardOpportunityLaneBeatCount(lane)}
                                                data-opportunity-lane-count={lane.count}
                                                data-opportunity-lane-meter-fill={Math.round((boardOpportunityLaneBeatCount(lane) / 5) * 100)}
                                                data-opportunity-lane-role={boardOpportunityLaneRole(lane)}
                                                data-opportunity-lane-screen-cue={boardOpportunityLaneScreenCue(lane)}
                                                style={
                                                    {
                                                        '--opportunity-lane-meter-fill': `${Math.round(
                                                            (boardOpportunityLaneBeatCount(lane) / 5) * 100
                                                        )}%`
                                                    } as CSSProperties
                                                }
                                                key={lane.id}
                                            >
                                                <small>{lane.label}</small>
                                                <b>{lane.count}</b>
                                                <u>{boardOpportunityLaneRole(lane)}</u>
                                                <strong>{lane.action}</strong>
                                                <em>{lane.cue}</em>
                                                <span aria-hidden="true" className={styles.opportunityLaneBeatPips}>
                                                    {Array.from({ length: boardOpportunityLaneBeatCount(lane) }, (_, beatIndex) => (
                                                        <i
                                                            data-opportunity-lane-beat={beatIndex + 1}
                                                            data-opportunity-lane-beat-focus={
                                                                beatIndex === 0 ? 'primary' : 'support'
                                                            }
                                                            key={beatIndex}
                                                        />
                                                    ))}
                                                </span>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                                {boardOpportunityCompassRows.map((row, index) => {
                                    const beatCount = getBoardOpportunityBeatCount(row);
                                    return (
                                        <span
                                            aria-label={`${index === 0 ? 'Best play. ' : ''}${row.impactCue}. ${row.label}: ${row.value}. ${row.action}: ${row.detail}`}
                                            className={styles.opportunityCompassRow}
                                            data-opportunity-audio={boardOpportunityAudioCue(row)}
                                            data-opportunity-beats={beatCount}
                                            data-opportunity-row-meter-fill={Math.round((beatCount / 5) * 100)}
                                            data-opportunity-heat={getBoardOpportunityHeat(row.impactCue)}
                                            data-opportunity-impact-cue={row.impactCue}
                                            data-opportunity-priority={index === 0 ? 'best' : 'normal'}
                                            data-opportunity-tone={row.tone}
                                            data-opportunity-screen-cue={boardOpportunityScreenCue(row)}
                                            data-testid={`board-opportunity-${row.id}`}
                                            style={
                                                {
                                                    '--opportunity-compass-row-meter-fill': `${Math.round((beatCount / 5) * 100)}%`
                                                } as CSSProperties
                                            }
                                            key={`${row.id}:${row.value}`}
                                        >
                                            {index === 0 ? (
                                                <span className={styles.opportunityCompassPriority}>Best</span>
                                            ) : null}
                                            <span className={styles.opportunityCompassImpact}>{row.impactCue}</span>
                                            <span aria-hidden="true" className={styles.opportunityCompassBeatPips}>
                                                {Array.from({ length: beatCount }, (_, beatIndex) => (
                                                    <i
                                                        data-opportunity-beat={beatIndex + 1}
                                                        data-opportunity-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                        key={beatIndex}
                                                    />
                                                ))}
                                            </span>
                                            <b>{row.action}</b>
                                            <small>{row.label}</small>
                                            <strong>{row.value}</strong>
                                            <em>{row.detail}</em>
                                        </span>
                                    );
                                })}
                            </div>
                        ) : null}
                        {focusedPreviewChip ? (() => {
                            const beatCount = getFocusedPreviewBeatCount(focusedPreviewChip);
                            const previewDensity =
                                focusedPreviewChip.kind === 'trait'
                                    ? traitOpportunitySummary.tiles.length
                                    : focusedPreviewChip.kind === 'pickup'
                                      ? 1
                                      : 0;
                            const previewDensityTone =
                                previewDensity >= 3
                                    ? 'cashout'
                                    : previewDensity === 2
                                      ? 'surge'
                                      : previewDensity === 1
                                        ? 'ready'
                                        : focusedPreviewChip.tone;
                            const traitPreviewSummaryLabel =
                                focusedPreviewChip.kind === 'pickup'
                                    ? 'Reward'
                                    : focusedPreviewChip.kind === 'hazard'
                                      ? 'Risk'
                                      : cardFeedbackTraitPayoffStackActive
                                        ? 'Stack'
                                        : 'Combo';
                            const traitPreviewDensityTone =
                                focusedPreviewChip.kind === 'trait' && cardFeedbackTraitPayoffStackActive
                                    ? 'cashout'
                                    : previewDensityTone;
                            const traitPreviewSignalFill = Math.min(100, Math.round((beatCount / 5) * 100));
                            const traitPreviewMeterFill = previewDensity > 0 ? Math.min(100, Math.round((previewDensity / 4) * 100)) : 0;
                            return (
                                <div
                                    aria-label={focusedPreviewChipLabel}
                                    className={styles.traitPreviewChip}
                                    data-preview-action={focusedPreviewChip.action}
                                    data-preview-audio={getFocusedPreviewAudioCue(focusedPreviewChip)}
                                    data-preview-beats={beatCount}
                                    data-preview-density={previewDensity}
                                    data-preview-density-tone={traitPreviewDensityTone}
                                    data-preview-kind={focusedPreviewChip.kind}
                                    data-preview-screen-cue={getFocusedPreviewScreenCue(focusedPreviewChip)}
                                    data-preview-source={focusedPreviewChip.source}
                                    data-preview-signal-fill={traitPreviewSignalFill}
                                    data-preview-tone={focusedPreviewChip.tone}
                                    data-preview-meter-fill={traitPreviewMeterFill}
                                    data-testid="trait-preview-chip"
                                    role="status"
                                    style={traitPreviewSignalFill > 0 ? ({ '--trait-preview-signal-fill': `${traitPreviewSignalFill}%` } as CSSProperties) : undefined}
                                >
                                    <span
                                        className={styles.traitPreviewSummary}
                                        data-preview-summary-kind={focusedPreviewChip.kind}
                                        data-testid="trait-preview-summary"
                                    >
                                        <small>Preview</small>
                                        <b>{traitPreviewSummaryLabel}</b>
                                        {previewDensity > 0 ? (
                                            <strong>
                                                {focusedPreviewChip.kind === 'trait'
                                                    ? `${previewDensity} ${previewDensity === 1 ? 'combo card' : 'combo cards'} lit`
                                                    : `${previewDensity} ${previewDensity === 1 ? 'route' : 'routes'} lit`}
                                            </strong>
                                        ) : null}
                                        <em>{beatCount} beats</em>
                                        <span
                                            aria-hidden="true"
                                            className={styles.traitPreviewDensityMeter}
                                            data-preview-meter-fill={traitPreviewMeterFill}
                                        >
                                            <i
                                                className={styles.traitPreviewDensityMeterFill}
                                                style={{ '--trait-preview-meter-fill': `${traitPreviewMeterFill}%` } as CSSProperties}
                                            />
                                        </span>
                                        <span aria-hidden="true" className={styles.traitPreviewSummaryBeatPips}>
                                            {Array.from({ length: Math.max(2, Math.min(5, beatCount)) }, (_, beatIndex) => (
                                                <i
                                                    data-preview-summary-beat={beatIndex + 1}
                                                    data-preview-summary-beat-focus={
                                                        beatIndex === 0 ? 'primary' : 'support'
                                                    }
                                                    key={`${focusedPreviewChip.kind}-summary-beat-${beatIndex + 1}`}
                                                />
                                            ))}
                                        </span>
                                    </span>
                                    <span className={styles.traitPreviewEyebrow}>
                                        {focusedPreviewChip.eyebrow}
                                    </span>
                                    <span className={styles.traitPreviewSignal}>
                                        {focusedPreviewChip.kind === 'pickup'
                                            ? 'Reward'
                                            : focusedPreviewChip.kind === 'hazard'
                                              ? 'Risk'
                                              : 'Combo'}
                                    </span>
                                    <span aria-hidden="true" className={styles.traitPreviewSignalMeter}>
                                        <i aria-hidden="true" className={styles.traitPreviewSignalMeterFill} />
                                    </span>
                                    <span aria-hidden="true" className={styles.traitPreviewBeatPips}>
                                        {Array.from({ length: beatCount }, (_, beatIndex) => (
                                            <i
                                                data-preview-beat={beatIndex + 1}
                                                data-preview-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                key={beatIndex}
                                            />
                                        ))}
                                    </span>
                                    <b
                                        className={styles.traitPreviewAction}
                                        data-preview-action-kind={focusedPreviewChip.kind}
                                        data-preview-action-tone={focusedPreviewChip.tone}
                                    >
                                        {focusedPreviewChip.action}
                                        <span aria-hidden="true" className={styles.traitPreviewActionBeatPips}>
                                            {Array.from({ length: beatCount }, (_, beatIndex) => (
                                                <i
                                                    data-preview-action-beat={beatIndex + 1}
                                                    data-preview-action-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                    key={`${focusedPreviewChip.action}-beat-${beatIndex + 1}`}
                                                />
                                            ))}
                                        </span>
                                    </b>
                                    {focusedPreviewChip.rewardHotText ? (
                                        <span
                                            className={styles.traitPreviewCashout}
                                            data-preview-cashout-kind={focusedPreviewChip.kind}
                                            data-preview-cashout-tone={focusedPreviewChip.tone}
                                        >
                                            Cashout / {focusedPreviewChip.rewardHotText}
                                            <span aria-hidden="true" className={styles.traitPreviewCashoutBeatPips}>
                                                {Array.from({ length: Math.max(2, beatCount - 1) }, (_, beatIndex) => (
                                                    <i
                                                        data-preview-cashout-beat={beatIndex + 1}
                                                        data-preview-cashout-beat-focus={
                                                            beatIndex === 0 ? 'primary' : 'support'
                                                        }
                                                        key={`${focusedPreviewChip.rewardHotText}-beat-${beatIndex + 1}`}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ) : null}
                                    {focusedPreviewChip.lines.map((line, index) => (
                                        <span
                                            className={styles.traitPreviewLine}
                                            data-preview-line={index + 1}
                                            data-preview-line-beats={index === 0 ? 3 : 2}
                                            data-preview-line-focus={index === 0 ? 'primary' : 'support'}
                                            data-preview-line-kind={focusedPreviewChip.kind}
                                            data-preview-line-tone={focusedPreviewChip.tone}
                                            key={line}
                                        >
                                            {line}
                                            <span aria-hidden="true" className={styles.traitPreviewLineBeatPips}>
                                                {Array.from({ length: index === 0 ? 3 : 2 }, (_, beatIndex) => (
                                                    <i
                                                        data-preview-line-beat={beatIndex + 1}
                                                        data-preview-line-beat-focus={
                                                            beatIndex === 0 ? 'primary' : 'support'
                                                        }
                                                        key={`${line}-beat-${beatIndex + 1}`}
                                                    />
                                                ))}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            );
                        })() : null}
                    </div>
                </div>
            )}
        </div>
    );
});

TileBoard.displayName = 'TileBoard';

export default TileBoard;
