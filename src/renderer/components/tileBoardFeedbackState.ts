import type { BoardState } from '../../shared/contracts';
import { getChainTargetFeedback } from '../../shared/chain-targets';
import { getFindableRewardText } from '../../shared/findables';
import { getHazardTileBoardSummary, type HazardTileBoardSummaryRow } from '../../shared/hazard-tiles';
import { getTileTraitInteractionPreviewLines } from '../../shared/tile-trait-rules';
import { getTraitOpportunityTileIds } from '../../shared/trait-opportunities';
import {
    getChainMilestoneBeatCount,
    getChainMilestonePreview,
    getChainRewardForecastCues,
    getChainRewardLaneAction,
    getChainRewardProgress,
    getChainRewardUrgencyCopy,
    type ChainMomentumTier,
    type ChainRewardForecastCue
} from '../copy/chainMomentum';
import { getChainOpportunityBeatSignal, type ChainOpportunityBeatSignal } from '../copy/chainOpportunityBeat';

interface ChainContextLike {
    armedPerkDetail?: string | null;
    armedPerkLabel?: string | null;
    armedPerkPayoff?: string | null;
    comboShards: number;
    currentStreak: number;
    lives: number;
}

interface RecoveryContextLike {
    action: string;
    detail: string;
    impactCue: string;
    tone: 'lost-reward' | 'recover' | 'risk';
    value: string;
}

interface TraitOpportunityTileLike {
    label: string;
    traitKind: string;
}

interface BoardPickupOpportunityState {
    count: number;
    examples: string[];
    sequenceCue: { first: string; keep: string; then: string; tone: 'cashout' | 'reward' } | null;
    stackCue: string | null;
    stackDetail: string | null;
    target: string;
    tileCount: number;
    valueLabel: string;
}

interface BoardChainOpportunityStateLike {
    armedPerkDetail: string | null;
    armedPerkLabel: string | null;
    armedPerkPayoff: string | null;
    chainReadyCount: number;
    chainReadyTileCount: number;
    chaseLabel: string | null;
    comboSurgeLabel: string | null;
    examples: string[];
    momentumLabel: string | null;
    nextTarget: string | null;
    rewardCue: string | null;
    rewardHot: boolean;
    rewardUrgencyLabel: string | null;
    selectedFollowupCount: number;
    selectedFollowupLabel: string | null;
    setupAction: string | null;
    setupCount: number;
    setupHint: string | null;
    setupStackCue: string | null;
    setupStackDetail: string | null;
    streakCashoutReady: boolean;
    targetPlanLabel: string | null;
}

interface BoardHazardOpportunityState {
    action: 'avoid' | 'claim' | 'inspect' | 'weigh';
    count: number;
    detail: string;
    family: HazardTileBoardSummaryRow['family'] | 'none';
    label: string;
    screenCue: 'burst' | 'guard' | 'pulse' | 'tick';
    tier: 'danger' | 'mixed' | 'reward' | 'watch';
    trigger: HazardTileBoardSummaryRow['trigger'] | 'none';
    valueLabel: string;
}

interface ActivePowerBoardChipState {
    action: 'clear' | 'pin' | 'recall' | 'remove' | 'swap';
    beats: 2 | 3 | 4;
    detail: string;
    first: string;
    label: string;
    screenCue: 'burst' | 'guard' | 'pulse' | 'tick';
    then: string;
    tier: 'control' | 'memory' | 'route';
    tone: 'control' | 'recall' | 'setup';
}

export interface BoardOpportunityCompassRowState {
    action: string;
    detail: string;
    id: 'chain' | 'hazard' | 'perk' | 'pickup' | 'recovery' | 'tool' | 'trait';
    impactCue: string;
    label: string;
    tone: string;
    value: string;
}

export interface BoardOpportunityLaneMapEntryState {
    action: 'Cash now' | 'Prime build' | 'Claim pickup' | 'Cash perk' | 'Recover' | 'Reduce risk' | 'Study traits' | 'Use tool';
    count: number;
    cue: string;
    id: 'build' | 'cash' | 'pickup' | 'perk' | 'recover' | 'risk' | 'tool' | 'trait';
    label: 'Build' | 'Cash' | 'Pickup' | 'Perk' | 'Recover' | 'Risk' | 'Tool' | 'Trait';
}

interface TraitOpportunitySummaryLike {
    interactionLines: string[];
    reason: string;
    tiles: TraitOpportunityTileLike[];
}

type BoardFeedbackScreenCue = 'burst' | 'guard' | 'pulse' | 'snap' | 'tick';
type BoardChainArcadeCalloutTone = 'cashout' | 'surge' | 'ready' | 'setup';
type BoardChainMilestoneTier = 'build' | 'cashout' | 'hold' | 'prime';

export interface BoardChainOpportunityState {
    arcadeCallout: { label: string; tone: BoardChainArcadeCalloutTone; value: string } | null;
    armedPerkDetail: string | null;
    armedPerkLabel: string | null;
    armedPerkPayoff: string | null;
    beatSignal: ChainOpportunityBeatSignal | null;
    chainReadyCount: number;
    chainReadyTileCount: number;
    chaseLabel: string | null;
    comboSurgeLabel: string | null;
    cue: string;
    examples: string[];
    lines: string[];
    milestoneActionLabel: string | null;
    milestoneBeatCount: number;
    milestoneMeterFill: number;
    milestoneScreenCue: BoardFeedbackScreenCue | null;
    milestoneTargetLabel: string | null;
    milestoneTier: BoardChainMilestoneTier | null;
    milestoneTone: ChainMomentumTier | null;
    momentumLabel: string | null;
    nextActionDetail: string | null;
    nextActionId: 'cashout' | 'follow-up' | 'idle' | 'match-route' | 'prime-route';
    nextActionLabel: string | null;
    nextActionTone: 'cashout' | 'idle' | 'ready' | 'setup';
    nextTarget: string | null;
    priorityLabel: string | null;
    rewardCue: string | null;
    rewardHot: boolean;
    rewardUrgencyLabel: string | null;
    rewardUrgencyTier: 'later' | 'next' | 'soon' | null;
    selectedFollowupCount: number;
    selectedFollowupLabel: string | null;
    setupAction: string | null;
    setupCount: number;
    setupHint: string | null;
    setupStackCue: string | null;
    setupStackDetail: string | null;
    streakCashoutReady: boolean;
    targetPlanLabel: string | null;
    tone: 'ready' | 'setup';
}

export interface BoardTraitModeCueState {
    action: 'cashout' | 'followup' | 'match' | 'prime' | 'surge';
    beatCount: 2 | 3 | 5;
    detail: string;
    label: 'Trait mode';
    nextReward: string | null;
    screenCue: BoardFeedbackScreenCue;
    tier: 'cashout' | 'prime' | 'route' | 'surge';
    tone: 'cashout' | 'ready' | 'setup' | 'surge';
    value: string;
}

export interface BoardChainSequenceCueState {
    first: string;
    keep: string;
    then: string;
    tone: 'cashout' | 'followup' | 'setup';
}

export interface BoardOpportunityLaneMapState {
    accessibleLabel: string;
    actionAttr: string;
    actionIdAttr: string;
    attr: string;
    primaryLane: BoardOpportunityLaneMapEntryState | null;
    roleAttr: string;
    roleIdAttr: string;
    rows: BoardOpportunityLaneMapEntryState[];
}

export interface BoardPickupOpportunityChipState {
    accessibleLabel: string;
    action: 'bank' | 'cashout' | 'stack';
    beatCount: 2 | 3 | 4;
    examples: string[];
    focus: 'cashout' | 'none' | 'reward';
    meterFill: number;
    screenCue: BoardFeedbackScreenCue;
    sequenceCue: BoardPickupOpportunityState['sequenceCue'];
    stackCue: string | null;
    stackDetail: string | null;
    target: string | null;
    tier: 'cashout' | 'multi' | 'reward';
    valueLabel: string;
}

interface BoardChainRewardLadderEntry {
    action: ReturnType<typeof getChainRewardLaneAction>;
    cue: ChainRewardForecastCue;
    filled: number;
    progressLabel: string;
    remainingLabel: string;
    total: number;
}

interface BoardRewardLadderEntryState {
    action: string;
    ariaLabel: string;
    audioCue: 'board-reward-guard' | 'board-reward-heal' | 'board-reward-prime' | 'board-reward-shard' | 'board-reward-stack';
    beatCount: 2 | 3 | 4;
    chaseLabel: string;
    fillPercent: number;
    filled: number;
    focus: 'primary' | 'support';
    id: string;
    isFocus: boolean;
    label: string;
    progressLabel: string;
    remainingLabel: string;
    screenCue: BoardFeedbackScreenCue;
    tone: string;
    total: number;
    urgency: string;
}

interface BoardRewardLeadState {
    action: string;
    audioCue: 'board-reward-guard' | 'board-reward-heal' | 'board-reward-prime' | 'board-reward-shard' | 'board-reward-stack';
    beatCount: 2 | 3 | 4;
    chaseLabel: string;
    label: string;
    meterFill: number;
    progressLabel: string;
    remainingLabel: string;
    screenCue: BoardFeedbackScreenCue;
    tier: 'later' | 'next' | 'soon' | 'none';
    tone: string;
    urgencyLabel: string;
}

export interface BoardRewardLadderState {
    accessibleLabel: string;
    actionAttr: string;
    attr: string;
    entries: BoardRewardLadderEntryState[];
    focusId: ChainRewardForecastCue['urgency'] | null;
    lead: BoardRewardLeadState | null;
    leadAccessibleLabel?: string;
    summaryAction: 'cashout' | 'hold' | 'prime' | null;
    summaryBeatCount: number;
    summaryMeterFill: number;
    summaryScreenCue: BoardFeedbackScreenCue | null;
    summaryTier: 'later' | 'next' | 'soon' | null;
}

export interface BoardPayoffStackState {
    action: string;
    crescendo: {
        beatCount: 2 | 3 | 4 | 5;
        detail: string;
        label: string;
        screenCue: 'burst' | 'pulse' | 'snap' | 'super';
        tier: 'cashout' | 'prime' | 'stack' | 'super';
    };
    cue: string;
    cueId: 'cashout' | 'followup' | 'prime' | 'super';
    detail: string;
    heat: 'cashout' | 'prime';
    nextCue: string;
    sequence: {
        first: string;
        keep: string;
        then: string;
    };
    sequenceCue: string;
    tone: 'build' | 'cashout' | 'followup' | 'setup';
    value: string;
}

interface BoardRewardLadderFormatDeps {
    formatLabel: (label: string, rows: readonly (string | null | undefined)[]) => string;
}

interface BoardPickupOpportunityChipFormatDeps {
    formatLabel: (label: string, rows: readonly (string | null | undefined)[]) => string;
}

const boardChainMilestoneTier = (
    milestoneTone: ChainMomentumTier | null | undefined,
    meterFill: number
): BoardChainMilestoneTier => {
    if (milestoneTone === 'combo') {
        return 'hold';
    }
    if (meterFill >= 67) {
        return 'cashout';
    }
    if (meterFill >= 34) {
        return 'prime';
    }
    return 'build';
};

const boardChainMilestoneScreenCue = (tier: BoardChainMilestoneTier): BoardFeedbackScreenCue => {
    if (tier === 'cashout' || tier === 'hold') {
        return 'burst';
    }
    if (tier === 'prime') {
        return 'pulse';
    }
    return 'tick';
};

const BOARD_OPPORTUNITY_LANE_ORDER: BoardOpportunityLaneMapEntryState['id'][] = [
    'cash',
    'build',
    'trait',
    'pickup',
    'perk',
    'recover',
    'risk',
    'tool'
];

const BOARD_OPPORTUNITY_LANE_LABELS: Record<BoardOpportunityLaneMapEntryState['id'], BoardOpportunityLaneMapEntryState['label']> = {
    build: 'Build',
    cash: 'Cash',
    perk: 'Perk',
    pickup: 'Pickup',
    recover: 'Recover',
    risk: 'Risk',
    tool: 'Tool',
    trait: 'Trait'
};

const BOARD_OPPORTUNITY_LANE_ACTIONS: Record<BoardOpportunityLaneMapEntryState['id'], BoardOpportunityLaneMapEntryState['action']> = {
    build: 'Prime build',
    cash: 'Cash now',
    perk: 'Cash perk',
    pickup: 'Claim pickup',
    recover: 'Recover',
    risk: 'Reduce risk',
    tool: 'Use tool',
    trait: 'Study traits'
};

const boardOpportunityLaneId = (row: BoardOpportunityCompassRowState): BoardOpportunityLaneMapEntryState['id'] => {
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

const boardOpportunityLaneMap = (rows: readonly BoardOpportunityCompassRowState[]): BoardOpportunityLaneMapEntryState[] => {
    const laneState = new Map<BoardOpportunityLaneMapEntryState['id'], { count: number; cue: string }>();
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
                      count: state.count,
                      cue: state.cue,
                      id,
                      label: BOARD_OPPORTUNITY_LANE_LABELS[id]
                  }
              ]
            : [];
    });
};

const boardOpportunityLaneMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntryState[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') : 'none';

const boardOpportunityLaneRole = (
    lane: Pick<BoardOpportunityLaneMapEntryState, 'id'>
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

const boardOpportunityLaneSummaryAction = (
    lane: Pick<BoardOpportunityLaneMapEntryState, 'id'> | null
): 'cashout' | 'claim' | 'perk' | 'prime' | 'recover' | 'risk' | 'study' | 'tool' | null => {
    if (!lane) {
        return null;
    }
    switch (lane.id) {
        case 'cash':
            return 'cashout';
        case 'pickup':
            return 'claim';
        case 'perk':
            return 'perk';
        case 'recover':
            return 'recover';
        case 'risk':
            return 'risk';
        case 'tool':
            return 'tool';
        case 'trait':
            return 'study';
        case 'build':
        default:
            return 'prime';
    }
};

const boardOpportunityLaneActionMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntryState[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') : 'none';

const boardOpportunityLaneActionIdMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntryState[]): string =>
    laneMap.length > 0
        ? laneMap.map((lane) => `${lane.id}:${boardOpportunityLaneSummaryAction(lane)}:${lane.count}`).join('>')
        : 'none';

const boardOpportunityLaneRoleMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntryState[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${boardOpportunityLaneRole(lane)}:${lane.count}`).join('>') : 'none';

const boardOpportunityLaneRoleIdMapAttr = (laneMap: readonly BoardOpportunityLaneMapEntryState[]): string =>
    laneMap.length > 0
        ? laneMap.map((lane) => `${lane.id}:${boardOpportunityLaneSummaryAction(lane)}:${lane.count}`).join('>')
        : 'none';

const boardOpportunityLaneMapLabel = (laneMap: readonly BoardOpportunityLaneMapEntryState[]): string =>
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
              .map((entry) => {
                  const actionCopy = entry.action === entry.cue.chaseLabel ? '' : ` ${entry.action}:`;
                  return `${entry.cue.chaseLabel}:${actionCopy} ${entry.cue.label}. ${entry.progressLabel}. ${entry.remainingLabel}.`;
              })
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

const getBoardChainRewardLadderSummaryAction = (
    entry: BoardChainRewardLadderEntry | null
): 'cashout' | 'hold' | 'prime' | null => {
    if (!entry) {
        return null;
    }
    if (entry.action.toLowerCase().includes('hold')) {
        return 'hold';
    }
    if (entry.cue.urgency === 'next' || entry.remainingLabel.startsWith('0 ')) {
        return 'cashout';
    }
    return 'prime';
};

const getBoardChainRewardLadderSummaryTier = (
    focusId: ChainRewardForecastCue['urgency'] | null,
    entry: BoardChainRewardLadderEntry | null
): 'later' | 'next' | 'soon' | null => focusId ?? entry?.cue.urgency ?? null;

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

const boardHazardOpportunityTier = (
    row: HazardTileBoardSummaryRow | null,
    hazardCount: number
): BoardHazardOpportunityState['tier'] => {
    if (!row) {
        return 'watch';
    }
    if (row.family === 'reward') {
        return 'reward';
    }
    if (row.family === 'dual') {
        return 'mixed';
    }
    if (hazardCount > 1 || row.trigger === 'mismatch' || row.trigger === 'match_or_mismatch') {
        return 'danger';
    }
    return 'watch';
};

const boardHazardOpportunityAction = (tier: BoardHazardOpportunityState['tier']): BoardHazardOpportunityState['action'] => {
    if (tier === 'reward') {
        return 'claim';
    }
    if (tier === 'mixed') {
        return 'weigh';
    }
    if (tier === 'danger') {
        return 'avoid';
    }
    return 'inspect';
};

const boardHazardOpportunityScreenCue = (tier: BoardHazardOpportunityState['tier']): BoardHazardOpportunityState['screenCue'] => {
    if (tier === 'reward') {
        return 'pulse';
    }
    if (tier === 'mixed') {
        return 'burst';
    }
    if (tier === 'danger') {
        return 'guard';
    }
    return 'tick';
};

export const buildBoardPickupOpportunity = ({
    board,
    chainContext,
    runStatus
}: {
    board: BoardState;
    chainContext: ChainContextLike | undefined;
    runStatus: string | undefined;
}): BoardPickupOpportunityState => {
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
            ? getChainRewardForecastCues(chainContext.currentStreak + 1, chainContext.comboShards, chainContext.lives)[0] ?? null
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
                  tone: stackDetail ? ('cashout' as const) : ('reward' as const)
              }
            : null;
    return { count, examples: visibleExamples, sequenceCue, stackCue, stackDetail, target, tileCount, valueLabel };
};

export const buildBoardPickupOpportunityChipState = ({
    deps,
    opportunity
}: {
    deps: BoardPickupOpportunityChipFormatDeps;
    opportunity: BoardPickupOpportunityState;
}): BoardPickupOpportunityChipState | null => {
    if (opportunity.count <= 0) {
        return null;
    }

    const focus = opportunity.sequenceCue?.tone ?? 'none';
    const tier = focus === 'cashout' ? 'cashout' : opportunity.count > 1 ? 'multi' : 'reward';
    const action = tier === 'cashout' ? 'cashout' : tier === 'multi' ? 'stack' : 'bank';
    const screenCue = tier === 'cashout' ? 'burst' : tier === 'multi' ? 'pulse' : 'tick';
    const beatCount = tier === 'cashout' ? 4 : tier === 'multi' ? 3 : 2;

    return {
        accessibleLabel: deps.formatLabel('Board pickup opportunity', [
            opportunity.valueLabel,
            opportunity.target,
            opportunity.sequenceCue
                ? `Sequence: First ${opportunity.sequenceCue.first}. Then ${opportunity.sequenceCue.then}. Keep ${opportunity.sequenceCue.keep}`
                : null,
            opportunity.stackCue,
            opportunity.stackDetail,
            ...opportunity.examples
        ]),
        action,
        beatCount,
        examples: opportunity.examples,
        focus,
        meterFill: focus === 'cashout' ? 100 : Math.min(100, Math.round((opportunity.count / 3) * 100)),
        screenCue,
        sequenceCue: opportunity.sequenceCue,
        stackCue: opportunity.stackCue,
        stackDetail: opportunity.stackDetail,
        target: opportunity.target,
        tier,
        valueLabel: opportunity.valueLabel
    };
};

export const buildBoardHazardOpportunity = ({
    board,
    runStatus
}: {
    board: BoardState;
    runStatus: string | undefined;
}): BoardHazardOpportunityState => {
    if (runStatus !== 'playing') {
        return {
            action: 'inspect',
            count: 0,
            detail: '',
            family: 'none',
            label: '',
            screenCue: 'tick',
            tier: 'watch',
            trigger: 'none',
            valueLabel: ''
        };
    }

    const summary = getHazardTileBoardSummary(board);
    const first = summary.rows[0] ?? null;
    if (!first) {
        return {
            action: 'inspect',
            count: 0,
            detail: '',
            family: 'none',
            label: '',
            screenCue: 'tick',
            tier: 'watch',
            trigger: 'none',
            valueLabel: ''
        };
    }

    const tier = boardHazardOpportunityTier(first, summary.totalHazardTiles);
    return {
        action: boardHazardOpportunityAction(tier),
        count: summary.totalHazardTiles,
        detail: first.telegraph,
        family: first.family,
        label: first.label,
        screenCue: boardHazardOpportunityScreenCue(tier),
        tier,
        trigger: first.trigger,
        valueLabel: summary.totalHazardTiles === 1 ? '1 hazard' : `${summary.totalHazardTiles} hazards`
    };
};

export const buildActivePowerBoardChip = ({
    destroyPowerVisualActive,
    peekPowerVisualActive,
    pinModeBoardHintActive,
    runStatus,
    strayPowerVisualActive,
    tileSwapFirstTileId,
    tileSwapPowerVisualActive
}: {
    destroyPowerVisualActive: boolean;
    peekPowerVisualActive: boolean;
    pinModeBoardHintActive: boolean;
    runStatus: string | undefined;
    strayPowerVisualActive: boolean;
    tileSwapFirstTileId: string | null | undefined;
    tileSwapPowerVisualActive: boolean;
}): ActivePowerBoardChipState | null => {
    if (runStatus !== 'playing') {
        return null;
    }
    if (tileSwapPowerVisualActive) {
        return tileSwapFirstTileId
            ? {
                  action: 'swap',
                  beats: 2,
                  detail: 'Place target',
                  first: 'Pick target',
                  label: 'Swap armed',
                  screenCue: 'pulse',
                  then: 'Preview route payoff',
                  tier: 'route',
                  tone: 'setup'
              }
            : {
                  action: 'swap',
                  beats: 2,
                  detail: 'Pick first tile',
                  first: 'Pick source',
                  label: 'Swap armed',
                  screenCue: 'tick',
                  then: 'Move into combo route',
                  tier: 'route',
                  tone: 'setup'
              };
    }
    if (destroyPowerVisualActive) {
        return {
            action: 'clear',
            beats: 3,
            detail: 'Tap hidden pair',
            first: 'Mark pair',
            label: 'Destroy armed',
            screenCue: 'burst',
            then: 'Clear blocker',
            tier: 'control',
            tone: 'control'
        };
    }
    if (peekPowerVisualActive) {
        return {
            action: 'recall',
            beats: 3,
            detail: 'Tap hidden tile',
            first: 'Reveal one',
            label: 'Peek armed',
            screenCue: 'pulse',
            then: 'Lock memory route',
            tier: 'memory',
            tone: 'recall'
        };
    }
    if (strayPowerVisualActive) {
        return {
            action: 'remove',
            beats: 3,
            detail: 'Remove singleton',
            first: 'Find stray',
            label: 'Stray armed',
            screenCue: 'guard',
            then: 'Open board space',
            tier: 'control',
            tone: 'control'
        };
    }
    if (pinModeBoardHintActive) {
        return {
            action: 'pin',
            beats: 3,
            detail: 'Mark memory',
            first: 'Pin clue',
            label: 'Pin mode',
            screenCue: 'pulse',
            then: 'Return for pair',
            tier: 'memory',
            tone: 'recall'
        };
    }
    return null;
};

export const buildBoardOpportunityCompassRows = ({
    activePowerBoardChip,
    boardChainOpportunity,
    boardHazardOpportunity,
    boardPickupOpportunity,
    cardFeedbackTraitPayoffStackActive,
    recoveryContext,
    runStatus,
    traitOpportunitySummary
}: {
    activePowerBoardChip: ActivePowerBoardChipState | null;
    boardChainOpportunity: BoardChainOpportunityStateLike;
    boardHazardOpportunity: BoardHazardOpportunityState;
    boardPickupOpportunity: BoardPickupOpportunityState;
    cardFeedbackTraitPayoffStackActive: boolean;
    recoveryContext: RecoveryContextLike | null | undefined;
    runStatus: string | undefined;
    traitOpportunitySummary: TraitOpportunitySummaryLike;
}): BoardOpportunityCompassRowState[] => {
    if (runStatus !== 'playing') {
        return [];
    }

    const rows: BoardOpportunityCompassRowState[] = [];

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
            action: boardChainOpportunity.rewardHot ? 'Cash out' : boardChainOpportunity.selectedFollowupCount > 0 ? 'Follow up' : 'Match',
            detail: [
                boardChainOpportunity.selectedFollowupLabel,
                boardChainOpportunity.nextTarget,
                boardChainOpportunity.examples[0] ?? 'Match a highlighted trait card to cash the route.',
                boardChainOpportunity.targetPlanLabel,
                boardChainOpportunity.momentumLabel,
                boardChainOpportunity.chaseLabel,
                boardChainOpportunity.rewardUrgencyLabel,
                boardChainOpportunity.rewardCue
            ]
                .filter(Boolean)
                .join(' / '),
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
                (boardChainOpportunity.chainReadyCount === 1 ? '1 route ready' : `${boardChainOpportunity.chainReadyCount} routes ready`)
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
            ]
                .filter(Boolean)
                .join(' / '),
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
            ]
                .filter(Boolean)
                .join(' / '),
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
            impactCue: cardFeedbackTraitPayoffStackActive
                ? traitOpportunitySummary.tiles.length > 1
                    ? 'Trait stack surge'
                    : 'Trait stack route'
                : traitOpportunitySummary.tiles.length > 1
                  ? 'Trait combo surge'
                  : 'Trait combo route',
            label: traitOpportunityLabel,
            tone: 'trait',
            value: traitOpportunitySummary.tiles.length === 1 ? '1 combo card lit' : `${traitOpportunitySummary.tiles.length} combo cards lit`
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
            ]
                .filter(Boolean)
                .join(' / '),
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
            ]
                .filter(Boolean)
                .join(' / '),
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
};

export const buildBoardOpportunityLaneMapState = ({
    rows
}: {
    rows: BoardOpportunityCompassRowState[];
}): BoardOpportunityLaneMapState => {
    const laneRows = boardOpportunityLaneMap(rows);

    return {
        accessibleLabel: boardOpportunityLaneMapLabel(laneRows),
        actionAttr: boardOpportunityLaneActionMapAttr(laneRows),
        actionIdAttr: boardOpportunityLaneActionIdMapAttr(laneRows),
        attr: boardOpportunityLaneMapAttr(laneRows),
        primaryLane: laneRows[0] ?? null,
        roleAttr: boardOpportunityLaneRoleMapAttr(laneRows),
        roleIdAttr: boardOpportunityLaneRoleIdMapAttr(laneRows),
        rows: laneRows
    };
};

export const buildTraitRewardHotText = ({
    chainContext,
    runStatus
}: {
    chainContext: ChainContextLike | undefined;
    runStatus: string | undefined;
}): string | null => {
    if (runStatus !== 'playing' || !chainContext) {
        return null;
    }
    const nextReward = getChainRewardForecastCues(chainContext.currentStreak + 1, chainContext.comboShards, chainContext.lives)[0];
    const target = getChainTargetFeedback(chainContext.currentStreak + 1);
    return nextReward && nextReward.distance <= 1
        ? `Next reward ${nextReward.label} in ${nextReward.distanceLabel}. ${getChainRewardUrgencyCopy(nextReward)}. ${target.value}`
        : null;
};

export const buildBoardChainOpportunity = ({
    board,
    chainContext,
    runStatus,
    selectedTraitFollowupTileIds,
    traitRouteHintText,
    traitRouteTargetTileIds
}: {
    board: BoardState;
    chainContext: ChainContextLike | undefined;
    runStatus: string | undefined;
    selectedTraitFollowupTileIds: string[];
    traitRouteHintText: string | null | undefined;
    traitRouteTargetTileIds: readonly string[] | undefined;
}): BoardChainOpportunityState => {
    if (runStatus !== 'playing') {
        return {
            arcadeCallout: null,
            armedPerkDetail: null,
            armedPerkLabel: null,
            armedPerkPayoff: null,
            beatSignal: null,
            chainReadyCount: 0,
            chainReadyTileCount: 0,
            chaseLabel: null,
            comboSurgeLabel: null,
            cue: '',
            examples: [],
            lines: [],
            milestoneActionLabel: null,
            milestoneBeatCount: 0,
            milestoneMeterFill: 0,
            milestoneScreenCue: null,
            milestoneTargetLabel: null,
            milestoneTier: null,
            milestoneTone: null,
            momentumLabel: null,
            nextActionDetail: null,
            nextActionId: 'idle',
            nextActionLabel: null,
            nextActionTone: 'idle',
            nextTarget: null,
            priorityLabel: null,
            rewardCue: null,
            rewardHot: false,
            rewardUrgencyLabel: null,
            rewardUrgencyTier: null,
            selectedFollowupCount: 0,
            selectedFollowupLabel: null,
            setupAction: null,
            setupCount: 0,
            setupHint: null,
            setupStackCue: null,
            setupStackDetail: null,
            streakCashoutReady: false,
            targetPlanLabel: null,
            tone: 'setup'
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
    const milestoneMeterFill = milestonePreview
        ? Math.max(
              0,
              Math.min(
                  100,
                  Math.round(
                      (((milestonePreview.tone === 'combo' ? 10 : milestonePreview.tone === 'surge' ? 6 : 3) - milestonePreview.distance) /
                          (milestonePreview.tone === 'combo' ? 10 : milestonePreview.tone === 'surge' ? 6 : 3)) *
                          100
                  )
              )
          )
        : 0;
    const milestoneTier = milestonePreview ? boardChainMilestoneTier(milestonePreview.tone, milestoneMeterFill) : null;
    const milestoneScreenCue = milestoneTier ? boardChainMilestoneScreenCue(milestoneTier) : null;
    const readyRouteLabel = chainReadyCount === 1 ? '1 route ready' : chainReadyCount > 1 ? `${chainReadyCount} routes ready` : null;
    const readyCardLabel =
        chainReadyTileCount > 0 ? (chainReadyTileCount === 1 ? '1 card lit' : `${chainReadyTileCount} cards lit`) : null;
    const selectedFollowupCount = selectedTraitFollowupTileIds.length;
    const selectedFollowupLabel =
        selectedFollowupCount > 0
            ? selectedFollowupCount === 1
                ? '1 follow-up marked'
                : `${selectedFollowupCount} follow-ups marked`
            : null;
    const upcomingReward = chainContext
        ? getChainRewardForecastCues(chainContext.currentStreak + 1, chainContext.comboShards, chainContext.lives)[0] ?? null
        : null;
    const followupReady = selectedFollowupCount > 0;
    const activeRouteReady = chainReadyCount > 0 || followupReady;
    const nextReward = activeRouteReady ? upcomingReward : null;
    const setupNextReward = !activeRouteReady && setupCount > 0 ? upcomingReward : null;
    const streakCashoutReady = !activeRouteReady && setupCount === 0 && upcomingReward?.urgency === 'next';
    const rewardHotLabel = nextReward && nextReward.distance <= 1 ? 'Reward hot' : null;
    const setupStackCue = setupNextReward && setupNextReward.urgency !== 'later' ? getChainRewardUrgencyCopy(setupNextReward) : null;
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
    const setupHint = setupCount > 0 ? traitRouteHintText ?? null : null;
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
    const rewardCue = visibleReward ? `Next reward ${visibleReward.label} in ${visibleReward.distanceLabel}` : null;
    const nextActionId = rewardHotLabel || streakCashoutReady
        ? 'cashout'
        : followupReady
          ? 'follow-up'
          : chainReadyCount > 0
            ? 'match-route'
            : setupCount > 0
              ? 'prime-route'
              : 'idle';
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
    const nextActionTone = nextActionId === 'cashout' ? 'cashout' : nextActionId === 'prime-route' ? 'setup' : nextActionId === 'idle' ? 'idle' : 'ready';
    const rewardUrgencyLabel = visibleReward ? getChainRewardUrgencyCopy(visibleReward) : null;
    const rewardUrgencyTier = visibleReward?.urgency ?? null;
    const momentumLabel = chainContext && chainContext.currentStreak > 0 ? `x${chainContext.currentStreak} streak` : null;
    const targetPlanLabel = (activeRouteReady || streakCashoutReady) && chainContext ? getChainTargetFeedback(chainContext.currentStreak + 1).value : null;
    const chaseLabel = visibleReward ? `${visibleReward.distanceLabel} to reward` : null;
    const rewardHot = Boolean(rewardHotLabel);
    const arcadeCallout = rewardHotLabel
        ? { label: 'Cashout shot', tone: 'cashout' as const, value: nextTarget ?? 'Match lit route' }
        : comboSurgeLabel
          ? { label: 'Surge chain', tone: 'surge' as const, value: readyCardLabel ?? readyRouteLabel ?? 'Multiple routes' }
          : followupReady
            ? { label: 'Follow-up', tone: 'ready' as const, value: selectedFollowupLabel ?? 'Marked card' }
            : chainReadyCount > 0
              ? { label: 'Chain shot', tone: 'ready' as const, value: readyCardLabel ?? readyRouteLabel ?? 'Match lit route' }
              : setupCount > 0
                ? { label: 'Prime shot', tone: 'setup' as const, value: setupAction ?? 'Move traits together' }
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
        arcadeCallout,
        armedPerkDetail,
        armedPerkLabel,
        armedPerkPayoff,
        beatSignal,
        chainReadyCount,
        chainReadyTileCount,
        chaseLabel,
        comboSurgeLabel,
        cue,
        examples,
        lines,
        milestoneActionLabel: milestonePreview?.actionLabel ?? null,
        milestoneBeatCount: chainContext ? getChainMilestoneBeatCount(chainContext.currentStreak) : 0,
        milestoneMeterFill,
        milestoneScreenCue,
        milestoneTargetLabel,
        milestoneTier,
        milestoneTone: milestonePreview?.tone ?? null,
        momentumLabel,
        nextActionDetail,
        nextActionId,
        nextActionLabel,
        nextActionTone,
        nextTarget,
        priorityLabel,
        rewardCue,
        rewardHot,
        rewardUrgencyLabel,
        rewardUrgencyTier,
        selectedFollowupCount,
        selectedFollowupLabel,
        setupAction,
        setupCount,
        setupHint,
        setupStackCue,
        setupStackDetail,
        streakCashoutReady,
        targetPlanLabel,
        tone
    };
};

export const buildBoardTraitModeCue = ({
    boardChainOpportunity,
    cardFeedbackStatesAttr,
    runStatus
}: {
    boardChainOpportunity: BoardChainOpportunityState;
    cardFeedbackStatesAttr: string | null | undefined;
    runStatus: string | undefined;
}): BoardTraitModeCueState | null => {
    if (runStatus !== 'playing') {
        return null;
    }
    if (boardChainOpportunity.rewardHot) {
        return {
            action: 'cashout',
            beatCount: 5,
            detail: boardChainOpportunity.rewardUrgencyLabel ?? boardChainOpportunity.nextTarget ?? 'Match lit route for reward',
            nextReward: boardChainOpportunity.rewardCue ?? boardChainOpportunity.nextTarget ?? 'Match lit route for reward',
            label: 'Trait mode',
            screenCue: 'burst',
            tier: 'cashout',
            tone: 'cashout',
            value: /\btrait-payoff-stack:\d+/.test(cardFeedbackStatesAttr ?? '') ? 'Stack live' : 'Cashout live'
        };
    }
    if (boardChainOpportunity.comboSurgeLabel) {
        return {
            action: 'surge',
            beatCount: 5,
            detail:
                boardChainOpportunity.chainReadyCount === 1
                    ? '1 route ready'
                    : `${boardChainOpportunity.chainReadyCount} routes ready`,
            nextReward: boardChainOpportunity.rewardCue ?? boardChainOpportunity.nextTarget ?? 'Match highlighted traits',
            label: 'Trait mode',
            screenCue: 'burst',
            tier: 'surge',
            tone: 'surge',
            value: 'Surge live'
        };
    }
    if (boardChainOpportunity.chainReadyCount > 0 || boardChainOpportunity.selectedFollowupCount > 0) {
        const followupLive = boardChainOpportunity.selectedFollowupCount > 0;
        return {
            action: followupLive ? 'followup' : 'match',
            beatCount: 3,
            detail:
                boardChainOpportunity.selectedFollowupLabel ??
                boardChainOpportunity.examples[0] ??
                boardChainOpportunity.nextTarget ??
                'Match highlighted traits',
            nextReward: boardChainOpportunity.rewardCue ?? boardChainOpportunity.nextTarget ?? 'Keep the chain alive',
            label: 'Trait mode',
            screenCue: 'pulse',
            tier: 'route',
            tone: 'ready',
            value: followupLive ? 'Follow-up live' : 'Route live'
        };
    }
    if (boardChainOpportunity.setupCount > 0) {
        return {
            action: 'prime',
            beatCount: 2,
            detail: boardChainOpportunity.setupHint ?? boardChainOpportunity.nextTarget ?? 'Move traits together',
            nextReward: boardChainOpportunity.nextTarget ?? 'Move traits together',
            label: 'Trait mode',
            screenCue: 'tick',
            tier: 'prime',
            tone: 'setup',
            value: 'Prime route'
        };
    }
    return null;
};

export const buildBoardChainSequenceCue = ({
    boardChainOpportunity,
    runStatus
}: {
    boardChainOpportunity: BoardChainOpportunityState;
    runStatus: string | undefined;
}): BoardChainSequenceCueState | null => {
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
};

export const buildBoardRewardLadderState = ({
    chainContext,
    deps,
    rewardUrgencyTier,
    runStatus
}: {
    chainContext: ChainContextLike | undefined;
    deps: BoardRewardLadderFormatDeps;
    rewardUrgencyTier: BoardChainOpportunityState['rewardUrgencyTier'];
    runStatus: string | undefined;
}): BoardRewardLadderState => {
    const forecastCues =
        runStatus === 'playing' && chainContext
            ? getChainRewardForecastCues(chainContext.currentStreak, chainContext.comboShards, chainContext.lives)
            : [];
    const ladder = chainContext ? boardChainRewardLadder(chainContext.currentStreak, forecastCues) : [];
    const attr = boardChainRewardLadderAttr(ladder);
    const actionAttr = boardChainRewardLadderActionAttr(ladder);
    const accessibleLabel = boardChainRewardLadderLabel(ladder);
    const leadEntry = ladder[0] ?? null;
    const leadAccessibleLabel = leadEntry
        ? deps.formatLabel('Next reward', [
              leadEntry.cue.chaseLabel,
              leadEntry.action,
              leadEntry.cue.label,
              leadEntry.progressLabel,
              leadEntry.remainingLabel
          ])
        : undefined;
    const focusId = ladder.some((entry) => entry.cue.urgency === 'next')
        ? 'next'
        : ladder.some((entry) => entry.cue.urgency === 'soon')
          ? 'soon'
          : null;
    const summaryAction = getBoardChainRewardLadderSummaryAction(leadEntry);
    const summaryTier = getBoardChainRewardLadderSummaryTier(focusId, leadEntry);
    const summaryScreenCue = leadEntry ? boardChainRewardScreenCue(leadEntry) : null;
    const summaryBeatCount = leadEntry
        ? Math.max(2, Math.min(5, ladder.length + boardChainRewardBeatCount(leadEntry) - 1))
        : 0;
    const summaryMeterFill = Math.round(Math.min(100, (ladder.length / 3) * 100));
    const leadMeterFill =
        rewardUrgencyTier === 'next' ? 100 : rewardUrgencyTier === 'soon' ? 75 : rewardUrgencyTier === 'later' ? 50 : 60;
    const leadUrgencyLabel =
        rewardUrgencyTier === 'next' ? 'Now' : rewardUrgencyTier === 'soon' ? 'Soon' : rewardUrgencyTier === 'later' ? 'Later' : 'Next';
    const leadBeatCount = rewardUrgencyTier === 'soon' ? 4 : rewardUrgencyTier === 'later' ? 2 : 3;

    return {
        accessibleLabel,
        actionAttr,
        attr,
        entries: ladder.map((entry) => ({
            action: entry.action,
            ariaLabel: `Chain reward. ${entry.cue.chaseLabel}. ${entry.action}. ${entry.cue.label}. ${entry.progressLabel}. ${entry.remainingLabel}.`,
            audioCue: boardChainRewardAudioCue(entry),
            beatCount: boardChainRewardBeatCount(entry),
            chaseLabel: entry.cue.chaseLabel,
            fillPercent: Math.round((entry.filled / entry.total) * 100),
            filled: entry.filled,
            focus: entry.cue.urgency === focusId ? 'primary' : 'support',
            id: entry.cue.id,
            isFocus: entry.cue.urgency === focusId,
            label: entry.cue.label,
            progressLabel: entry.progressLabel,
            remainingLabel: entry.remainingLabel,
            screenCue: boardChainRewardScreenCue(entry),
            tone: entry.cue.tone,
            total: entry.total,
            urgency: entry.cue.urgency
        })),
        focusId,
        lead: leadEntry
            ? {
                  action: leadEntry.action,
                  audioCue: boardChainRewardAudioCue(leadEntry),
                  beatCount: leadBeatCount,
                  chaseLabel: leadEntry.cue.chaseLabel,
                  label: leadEntry.cue.label,
                  meterFill: leadMeterFill,
                  progressLabel: leadEntry.progressLabel,
                  remainingLabel: leadEntry.remainingLabel,
                  screenCue: boardChainRewardScreenCue(leadEntry),
                  tier: rewardUrgencyTier ?? 'none',
                  tone: leadEntry.cue.tone,
                  urgencyLabel: leadUrgencyLabel
              }
            : null,
        leadAccessibleLabel,
        summaryAction,
        summaryBeatCount,
        summaryMeterFill,
        summaryScreenCue,
        summaryTier
    };
};

export const buildBoardPayoffStackState = ({
    rows
}: {
    rows: BoardOpportunityCompassRowState[];
}): { fill: number; stack: BoardPayoffStackState | null } => {
    const payoffRows = rows.filter(
        (row) => row.id === 'chain' || row.id === 'perk' || row.id === 'pickup' || row.id === 'recovery' || row.id === 'tool'
    );
    const labelForRow = (row: BoardOpportunityCompassRowState): string => (row.id === 'chain' ? 'Stack route' : row.label);
    const stack =
        payoffRows.length >= 2
            ? (() => {
                  const impactCues = new Set(payoffRows.map((row) => row.impactCue));
                  const tone: BoardPayoffStackState['tone'] = impactCues.has('Super stack')
                      ? 'cashout'
                      : impactCues.has('Stack cashout')
                        ? 'cashout'
                        : impactCues.has('Stack prime')
                          ? 'setup'
                          : impactCues.has('Follow-up route')
                            ? 'followup'
                            : 'build';
                  const cue = impactCues.has('Super stack')
                      ? 'Super stack'
                      : tone === 'cashout'
                        ? 'Stack cashout'
                        : tone === 'setup'
                          ? 'Stack prime'
                          : tone === 'followup'
                            ? 'Follow-up stack'
                            : 'Stack prime';
                  const action = impactCues.has('Super stack')
                      ? 'Cash super stack'
                      : tone === 'cashout'
                        ? 'Cash now'
                        : tone === 'setup'
                          ? 'Prime'
                          : tone === 'followup'
                            ? 'Next tap'
                            : 'Prime';
                  const cueId: BoardPayoffStackState['cueId'] = impactCues.has('Super stack')
                      ? 'super'
                      : tone === 'cashout'
                        ? 'cashout'
                        : tone === 'followup'
                          ? 'followup'
                          : 'prime';
                  const firstRow = payoffRows[0] ?? null;
                  const secondRow = payoffRows[1] ?? null;
                  const thirdRow = payoffRows[2] ?? null;
                  const first = firstRow ? `${firstRow.action} ${labelForRow(firstRow).toLowerCase()}` : 'Act';
                  const then = secondRow ? `${secondRow.action} ${labelForRow(secondRow).toLowerCase()}` : 'Lock payoff route';
                  const keep = thirdRow
                      ? `${thirdRow.action} ${labelForRow(thirdRow).toLowerCase()}`
                      : tone === 'cashout'
                        ? 'Keep chain target live'
                        : tone === 'followup'
                          ? 'Keep route moving'
                          : 'Keep reward stack primed';
                  const crescendo: BoardPayoffStackState['crescendo'] = impactCues.has('Super stack')
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
                        : payoffRows.length >= 3
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
                      cueId,
                      detail: payoffRows
                          .slice(0, 3)
                          .map((row) => labelForRow(row))
                          .join(' + '),
                      heat: tone === 'cashout' ? 'cashout' : 'prime',
                      nextCue: `First: ${first}`,
                      sequence: { first, keep, then },
                      sequenceCue: `Then: ${then}`,
                      tone,
                      value: `${payoffRows.length} payoffs live`
                  };
              })()
            : null;

    return {
        fill: stack ? Math.round(Math.min(100, (stack.crescendo.beatCount / 5) * 100)) : 0,
        stack
    };
};
