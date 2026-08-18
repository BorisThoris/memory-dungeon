import type { ComponentProps } from 'react';
import type { TileBoardChainOpportunityChipProps } from './TileBoardChainOpportunityChip';
import type TileBoardChainOpportunityActionPriority from './TileBoardChainOpportunityActionPriority';
import type TileBoardChainOpportunityBeatMap from './TileBoardChainOpportunityBeatMap';
import type TileBoardChainOpportunityCadenceMap from './TileBoardChainOpportunityCadenceMap';
import type TileBoardChainOpportunityMarkerKey from './TileBoardChainOpportunityMarkerKey';
import type { BoardPickupOpportunityChipState, BoardTraitModeCueState } from './tileBoardFeedbackState';
import type TileBoardBoardStatusChips from './TileBoardBoardStatusChips';
import type TileBoardChainOpportunityProgressionCues from './TileBoardChainOpportunityProgressionCues';
import type TileBoardChainOpportunityRewardLadder from './TileBoardChainOpportunityRewardLadder';
import type TileBoardChainOpportunityShotMap from './TileBoardChainOpportunityShotMap';
import type TileBoardOpportunityCompass from './TileBoardOpportunityCompass';
import type TileBoardOpportunityLaneMap from './TileBoardOpportunityLaneMap';
import type TileBoardChainOpportunityStatusMeters from './TileBoardChainOpportunityStatusMeters';
import type TileBoardTraitPreviewChip from './TileBoardTraitPreviewChip';

type OpportunityLanePrimaryView = NonNullable<ComponentProps<typeof TileBoardOpportunityLaneMap>['primaryLane']>;
type OpportunityLaneRowView = ComponentProps<typeof TileBoardOpportunityLaneMap>['rows'][number];
type OpportunityLaneMapSurfaceViewData = ComponentProps<typeof TileBoardOpportunityLaneMap>;
type OpportunityPayoffStackView = NonNullable<ComponentProps<typeof TileBoardOpportunityCompass>['payoffStack']>;
type OpportunityCompassRowView = ComponentProps<typeof TileBoardOpportunityCompass>['rows'][number];
type OpportunityCompassSurfaceViewData = Pick<
    ComponentProps<typeof TileBoardOpportunityCompass>,
    | 'bestScreenCue'
    | 'bestTone'
    | 'beats'
    | 'heat'
    | 'hot'
    | 'label'
    | 'meterFill'
    | 'payoffStack'
    | 'priority'
    | 'rows'
    | 'summaryAction'
    | 'summaryActionLabel'
    | 'summaryBeatCount'
    | 'summaryScreenCue'
    | 'summaryTier'
    | 'summaryTone'
    | 'surge'
>;
type TraitPreviewView = NonNullable<ComponentProps<typeof TileBoardTraitPreviewChip>['preview']>;
type BoardStatusChipsViewData = Pick<ComponentProps<typeof TileBoardBoardStatusChips>, 'activePower' | 'pickupOpportunity' | 'traitMode'>;
type ChainOpportunitySurfaceViewData = TileBoardChainOpportunityChipProps;
type ChainActionPriorityViewData = ComponentProps<typeof TileBoardChainOpportunityActionPriority>;
type ChainBeatMapViewData = ComponentProps<typeof TileBoardChainOpportunityBeatMap>;
type ChainCadenceMapViewData = ComponentProps<typeof TileBoardChainOpportunityCadenceMap>;
type ChainMarkerKeyViewData = ComponentProps<typeof TileBoardChainOpportunityMarkerKey>;
type ChainStatusMetersViewData = ComponentProps<typeof TileBoardChainOpportunityStatusMeters>;
type ChainProgressionCuesViewData = ComponentProps<typeof TileBoardChainOpportunityProgressionCues>;
type ChainRewardLadderViewData = ComponentProps<typeof TileBoardChainOpportunityRewardLadder>;
type ChainShotMapViewData = ComponentProps<typeof TileBoardChainOpportunityShotMap>;
type ChainOpportunityChipViewData = Pick<
    TileBoardChainOpportunityChipProps,
    | 'arcadeCallout'
    | 'beat'
    | 'cue'
    | 'eyebrow'
    | 'meter'
    | 'nextAction'
    | 'primaryShot'
    | 'primaryTraitLane'
    | 'priority'
    | 'recipes'
    | 'roleSummaryLanes'
    | 'traitInteractionLaneMap'
    | 'traitLaneBeatMap'
>;

interface BoardOpportunityLaneMapEntryLike {
    action: string;
    count: number;
    cue: string;
    id: string;
    label: string;
}

interface BoardOpportunityCompassRowLike {
    action: string;
    detail: string;
    id: string;
    impactCue: string;
    label: string;
    tone: string;
    value: string;
}

interface HazardOpportunityLike {
    action: string;
    family: string;
    screenCue: string;
    tier: string;
    trigger: string;
}

interface BoardPayoffStackLike {
    action: string;
    crescendo: {
        beatCount: number;
        detail: string;
        label: string;
        screenCue: string;
        tier: string;
    };
    cue: string;
    cueId: string;
    detail: string;
    heat: string;
    nextCue: string;
    sequence: {
        first: string;
        keep: string;
        then: string;
    };
    sequenceCue: string | null;
    tone: string;
    value: string;
}

interface FocusedPreviewChipLike {
    action: string;
    eyebrow: string;
    kind: 'hazard' | 'pickup' | 'trait';
    lines: string[];
    rewardHotText?: string | null;
    source: 'focus' | 'selected';
    tone: string;
}

interface OpportunityCompassViewDeps {
    getActionId: (row: BoardOpportunityCompassRowLike | null) => string | null;
    getAudio: (row: BoardOpportunityCompassRowLike) => string;
    getBeatCount: (row: BoardOpportunityCompassRowLike) => number;
    getCrescendoAudioCue: (tier: string) => string;
    getHeat: (impactCue: string) => string;
    getImpactCueId: (impactCue: string) => string | null;
    getScreenCue: (row: BoardOpportunityCompassRowLike) => string;
    getSummaryAction: (row: BoardOpportunityCompassRowLike | null) => string | null;
    getSummaryTier: (row: BoardOpportunityCompassRowLike | null) => string | null;
}

interface FocusedPreviewViewDeps {
    getAudio: (preview: FocusedPreviewChipLike) => string;
    getBeatCount: (preview: FocusedPreviewChipLike) => number;
    getScreenCue: (preview: FocusedPreviewChipLike) => string;
}

interface BoardChainAccessibilitySummaryLike {
    followupCount: number;
    label: string;
    payoffStackCount: number;
    primaryLine: string;
    readyCount: number;
    rewardHotCount: number;
    secondaryLine: string | null;
    setupCount: number;
    surgeCount: number;
    tone: string;
}

interface BoardChainOpportunityLike {
    armedPerkLabel: string | null;
    armedPerkPayoff: string | null;
    arcadeCallout: { label: string; tone: string; value: string } | null;
    beatSignal: {
        action: string;
        audioCue: string;
        beatCount: number;
        detail: string;
        label: string;
        screenCue: string;
        tier: string;
    } | null;
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
    milestoneScreenCue: string | null;
    milestoneTargetLabel: string | null;
    milestoneTier: string | null;
    milestoneTone: string | null;
    momentumLabel: string | null;
    nextActionDetail: string | null;
    nextActionId: string;
    nextActionLabel: string | null;
    nextActionTone: string;
    nextTarget: string | null;
    priorityLabel: string | null;
    rewardCue: string | null;
    rewardHot: boolean;
    rewardUrgencyLabel: string | null;
    rewardUrgencyTier: 'later' | 'next' | 'soon' | null;
    selectedFollowupCount: number;
    selectedFollowupLabel?: string | null;
    streakCashoutReady: boolean;
}

interface TraitInteractionLaneLike {
    count: number;
    cue: string;
    id: string;
    label: string;
}

interface TraitLaneBeatRowLike {
    action: string;
    beatCount: number;
    count: number;
    id: string;
    label: string;
    role: string;
}

interface PrimaryCardFeedbackShotRowLike {
    detail: string;
    id: string;
    shotLabel: string;
}

interface CardFeedbackBeatRowLike {
    action: string;
    beatCount: number;
    id: string;
}

interface CardFeedbackCadenceRowLike {
    action: string;
    id: string;
}

interface ChainRecipeRowLike {
    action: string;
    label: string;
    laneId: string;
    recipe: string;
    roleId: string;
    sourceLine: string;
}

interface BoardChainOpportunityViewDeps {
    cardTraitLaneAudioCue: (laneId: string) => string;
    cardTraitLaneBeatMapSummaryAction: (role: string | null) => string | null;
    cardTraitLaneScreenCue: (laneId: string) => string;
    formatBeatLabel: (beatSignal: NonNullable<BoardChainOpportunityLike['beatSignal']>) => string;
    getCalloutAction: (tone: string) => string;
    getCalloutAudioCue: (tone: string) => string;
    getCalloutScreenCue: (tone: string) => string;
    getCueAction: (state: string) => string;
    getCueAudioCue: (state: string) => string;
    getCueScreenCue: (state: string) => string;
    getPriorityAudioCue: (priorityId: string) => string;
    getPriorityScreenCue: (priorityId: string) => string;
    getTraitInteractionLaneAction: (laneId: string) => string;
    getTraitInteractionLaneRole: (lane: TraitInteractionLaneLike) => string;
}

interface BoardStatusChipViewDeps {
    formatLabel: (label: string, rows: readonly (string | null | undefined)[]) => string;
}

interface ActivePowerBoardChipLike {
    action: string;
    beats: number;
    detail: string;
    first: string;
    label: string;
    screenCue: string;
    then: string;
    tier: string;
    tone: string;
}

interface RewardLeadLike {
    beatCount: number;
    meterFill: number;
}

interface RewardLadderStateLike {
    accessibleLabel: string;
    actionAttr: string;
    attr: string;
    entries: ChainRewardLadderViewData['entries'];
    focusId: string | null;
    lead: ChainRewardLadderViewData['lead'];
    leadAccessibleLabel?: string;
    summaryAction: string | null;
    summaryBeatCount: number;
    summaryMeterFill: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
}

const boardOpportunityLaneBeatCount = (lane: Pick<BoardOpportunityLaneMapEntryLike, 'count' | 'id'>): 2 | 3 | 4 => {
    if (lane.id === 'cash' || lane.count > 1) {
        return 4;
    }
    if (lane.id === 'build' || lane.id === 'pickup' || lane.id === 'perk') {
        return 3;
    }
    return 2;
};

const boardOpportunityLaneAudioCue = (
    lane: Pick<BoardOpportunityLaneMapEntryLike, 'id'>
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
    lane: Pick<BoardOpportunityLaneMapEntryLike, 'id'>
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
    return 'pulse';
};

const boardOpportunityLaneFocus = (
    lane: Pick<BoardOpportunityLaneMapEntryLike, 'id'>
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
    lane: Pick<BoardOpportunityLaneMapEntryLike, 'id'>
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
    lane: Pick<BoardOpportunityLaneMapEntryLike, 'id'> | null
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

const boardOpportunityLaneRoleId = (lane: Pick<BoardOpportunityLaneMapEntryLike, 'id'> | null): string | null =>
    boardOpportunityLaneSummaryAction(lane);

export const buildBoardOpportunityLaneMapViewData = ({
    primaryLane,
    rows
}: {
    primaryLane: BoardOpportunityLaneMapEntryLike | null;
    rows: BoardOpportunityLaneMapEntryLike[];
}): {
    liveText: string;
    meterFill: number;
    primaryView: OpportunityLanePrimaryView | null;
    rowViews: OpportunityLaneRowView[];
    summaryAction: string | null;
    summaryBeatCount: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
} => {
    const summaryAction = boardOpportunityLaneSummaryAction(primaryLane);
    const summaryTier = primaryLane ? boardOpportunityLaneFocus(primaryLane) : null;
    const summaryScreenCue = primaryLane ? boardOpportunityLaneScreenCue(primaryLane) : null;
    const primaryBeatCount = primaryLane ? boardOpportunityLaneBeatCount(primaryLane) : 0;
    const meterFill = primaryLane ? Math.round(Math.min(100, ((rows.length + primaryBeatCount) / 8) * 100)) : 0;
    const summaryBeatCount = primaryLane ? Math.max(2, Math.min(5, rows.length + primaryBeatCount - 1)) : 0;
    const primaryView = primaryLane
        ? {
              action: primaryLane.action,
              actionId: summaryAction ?? 'none',
              ariaLabel: `Primary opportunity lane. ${primaryLane.label} ${boardOpportunityLaneRole(primaryLane)}. ${primaryLane.action}. ${primaryLane.cue}. ${primaryBeatCount} beats.`,
              audio: boardOpportunityLaneAudioCue(primaryLane),
              beatCount: primaryBeatCount,
              cue: primaryLane.cue,
              focus: boardOpportunityLaneFocus(primaryLane),
              id: primaryLane.id,
              label: primaryLane.label,
              meterFill: Math.round((primaryBeatCount / 5) * 100),
              role: boardOpportunityLaneRole(primaryLane),
              roleId: boardOpportunityLaneRoleId(primaryLane) ?? 'none',
              screenCue: boardOpportunityLaneScreenCue(primaryLane)
          }
        : null;
    const rowViews = rows.map((lane) => {
        const beatCount = boardOpportunityLaneBeatCount(lane);
        return {
            action: lane.action,
            actionId: boardOpportunityLaneSummaryAction(lane) ?? 'none',
            ariaLabel: `Opportunity lane. ${lane.label}. ${boardOpportunityLaneRole(lane)}. ${lane.action}. ${lane.cue}. ${lane.count}. ${beatCount} beats.`,
            audio: boardOpportunityLaneAudioCue(lane),
            beatCount,
            count: lane.count,
            cue: lane.cue,
            id: lane.id,
            label: lane.label,
            meterFill: Math.round((beatCount / 5) * 100),
            role: boardOpportunityLaneRole(lane),
            roleId: boardOpportunityLaneRoleId(lane) ?? 'none',
            screenCue: boardOpportunityLaneScreenCue(lane)
        };
    });
    const liveText =
        rows.length > 1
            ? ` Decision lanes: ${rows.map((lane) => `${lane.label} ${boardOpportunityLaneRole(lane)} ${lane.count}, ${lane.action}`).join(', ')}.`
            : '';

    return {
        liveText,
        meterFill,
        primaryView,
        rowViews,
        summaryAction,
        summaryBeatCount,
        summaryScreenCue,
        summaryTier
    };
};

export const buildBoardOpportunityCompassViewData = ({
    hazardOpportunity,
    laneMapAccessibleLabel,
    laneMapRows,
    payoffStack,
    payoffStackFill,
    rows,
    deps
}: {
    deps: OpportunityCompassViewDeps;
    hazardOpportunity: HazardOpportunityLike;
    laneMapAccessibleLabel: string;
    laneMapRows: BoardOpportunityLaneMapEntryLike[];
    payoffStack: BoardPayoffStackLike | null;
    payoffStackFill: number;
    rows: BoardOpportunityCompassRowLike[];
}): {
    bestOpportunityActionId: string | null;
    bestOpportunityBeatCount: number;
    bestOpportunityHeat: string;
    bestOpportunityImpactCueId: string | null;
    compassLabel: string;
    meterFill: number;
    payoffStackView: OpportunityPayoffStackView | null;
    rowViews: OpportunityCompassRowView[];
    summaryAction: string | null;
    summaryActionLabel: string;
    summaryBeatCount: 2 | 3 | 4 | 5;
    summaryScreenCue: string | null;
    summaryTier: string | null;
} => {
    const bestOpportunity = rows[0] ?? null;
    const bestOpportunityActionId = deps.getActionId(bestOpportunity);
    const bestOpportunityHeat = bestOpportunity ? deps.getHeat(bestOpportunity.impactCue) : 'none';
    const bestOpportunityImpactCueId = bestOpportunity ? deps.getImpactCueId(bestOpportunity.impactCue) : null;
    const bestOpportunityBeatCount = bestOpportunity ? deps.getBeatCount(bestOpportunity) : 0;
    const summaryBeatCount = Math.max(2, Math.min(5, rows.length + 1)) as 2 | 3 | 4 | 5;
    const summaryAction = deps.getSummaryAction(bestOpportunity);
    const summaryActionLabel = bestOpportunity?.action ?? 'none';
    const summaryScreenCue = bestOpportunity ? deps.getScreenCue(bestOpportunity) : null;
    const summaryTier = deps.getSummaryTier(bestOpportunity);
    const meterFill = Math.round(Math.min(100, ((rows.length + bestOpportunityBeatCount) / 10) * 100));
    const compassLabel =
        rows.length > 0
            ? `Board opportunity compass. ${rows
                  .map(
                      (row, index) =>
                          `${index === 0 ? 'Best play. ' : ''}${row.impactCue}. ${row.label}: ${row.value}. ${row.action}: ${row.detail}`
                  )
                  .join('. ')}.${laneMapRows.length > 1 ? ` ${laneMapAccessibleLabel}` : ''}`
            : 'Board opportunity compass';
    const payoffStackView = payoffStack
        ? {
              action: payoffStack.action,
              accessibleLabel: `Board payoff stack. ${payoffStack.cue}. ${payoffStack.action}. ${payoffStack.value}. ${payoffStack.detail}. Crescendo: ${payoffStack.crescendo.label}. ${payoffStack.crescendo.detail}. ${payoffStack.crescendo.beatCount} beats. ${payoffStack.nextCue}.${payoffStack.sequenceCue ? ` ${payoffStack.sequenceCue}.` : ''} Keep: ${payoffStack.sequence.keep}.`,
              crescendo: {
                  beatCount: payoffStack.crescendo.beatCount,
                  detail: payoffStack.crescendo.detail,
                  fill: Math.round((payoffStack.crescendo.beatCount / 5) * 100),
                  label: payoffStack.crescendo.label,
                  screenCue: payoffStack.crescendo.screenCue,
                  tier: payoffStack.crescendo.tier
              },
              crescendoAudio: deps.getCrescendoAudioCue(payoffStack.crescendo.tier),
              cue: payoffStack.cue,
              cueId: payoffStack.cueId,
              detail: payoffStack.detail,
              fill: payoffStackFill,
              heat: payoffStack.heat,
              nextCue: payoffStack.nextCue,
              sequenceCue: payoffStack.sequenceCue,
              sequenceFirst: payoffStack.sequence.first,
              sequenceKeep: payoffStack.sequence.keep,
              sequenceThen: payoffStack.sequence.then,
              tone: payoffStack.tone,
              value: payoffStack.value
          }
        : null;
    const rowViews = rows.map((row, index) => {
        const beatCount = deps.getBeatCount(row);
        return {
            action: row.action,
            actionId: deps.getActionId(row) ?? 'none',
            ariaLabel: `${index === 0 ? 'Best play. ' : ''}${row.impactCue}. ${row.label}: ${row.value}. ${row.action}: ${row.detail}`,
            audio: deps.getAudio(row),
            beatCount,
            detail: row.detail,
            hazardAction: row.id === 'hazard' ? hazardOpportunity.action : 'none',
            hazardFamily: row.id === 'hazard' ? hazardOpportunity.family : 'none',
            hazardScreenCue: row.id === 'hazard' ? hazardOpportunity.screenCue : 'none',
            hazardTier: row.id === 'hazard' ? hazardOpportunity.tier : 'none',
            hazardTrigger: row.id === 'hazard' ? hazardOpportunity.trigger : 'none',
            heat: deps.getHeat(row.impactCue),
            id: row.id,
            impactCue: row.impactCue,
            impactCueId: deps.getImpactCueId(row.impactCue),
            isBest: index === 0,
            label: row.label,
            rowMeterFill: Math.round((beatCount / 5) * 100),
            screenCue: deps.getScreenCue(row),
            tone: row.tone,
            value: row.value
        };
    });

    return {
        bestOpportunityActionId,
        bestOpportunityBeatCount,
        bestOpportunityHeat,
        bestOpportunityImpactCueId,
        compassLabel,
        meterFill,
        payoffStackView,
        rowViews,
        summaryAction,
        summaryActionLabel,
        summaryBeatCount,
        summaryScreenCue,
        summaryTier
    };
};

export const buildFocusedPreviewChipViewData = ({
    accessibleLabel,
    deps,
    preview,
    traitOpportunityTileCount,
    traitPayoffStackActive
}: {
    accessibleLabel: string;
    deps: FocusedPreviewViewDeps;
    preview: FocusedPreviewChipLike | null;
    traitOpportunityTileCount: number;
    traitPayoffStackActive: boolean;
}): TraitPreviewView | null => {
    if (!preview) {
        return null;
    }

    const beatCount = deps.getBeatCount(preview);
    const density = preview.kind === 'trait' ? traitOpportunityTileCount : preview.kind === 'pickup' ? 1 : 0;
    const densityTone = density >= 3 ? 'cashout' : density === 2 ? 'surge' : density === 1 ? 'ready' : preview.tone;
    const summaryLabel =
        preview.kind === 'pickup' ? 'Reward' : preview.kind === 'hazard' ? 'Risk' : traitPayoffStackActive ? 'Stack' : 'Combo';
    const summaryAction = summaryLabel.toLowerCase();
    const summaryDensityTone = preview.kind === 'trait' && traitPayoffStackActive ? 'cashout' : densityTone;
    const densityLabel =
        density > 0
            ? preview.kind === 'trait'
                ? `${density} ${density === 1 ? 'combo card' : 'combo cards'} lit`
                : `${density} ${density === 1 ? 'route' : 'routes'} lit`
            : null;
    const summaryLabelAccessible =
        density > 0 ? `${summaryLabel} preview, ${densityLabel}, ${beatCount} beats` : `${summaryLabel} preview, ${beatCount} beats`;

    return {
        accessibleLabel,
        action: preview.action,
        actionKind: preview.kind,
        actionTone: preview.tone,
        audio: deps.getAudio(preview),
        beatCount,
        cashoutBeatCount: Math.max(2, beatCount - 1),
        density,
        densityLabel,
        densityMeterFill: density > 0 ? Math.min(100, Math.round((density / 4) * 100)) : 0,
        densityTone: summaryDensityTone,
        eyebrow: preview.eyebrow,
        kind: preview.kind,
        lines: preview.lines,
        rewardHotText: preview.rewardHotText ?? null,
        screenCue: deps.getScreenCue(preview),
        signalFill: Math.min(100, Math.round((beatCount / 5) * 100)),
        signalLabel: preview.kind === 'pickup' ? 'Reward' : preview.kind === 'hazard' ? 'Risk' : 'Combo',
        source: preview.source,
        summaryAction,
        summaryBeatCount: Math.max(2, Math.min(5, beatCount)),
        summaryDensityTone,
        summaryKind: preview.kind,
        summaryLabel,
        summaryLabelAccessible,
        summaryTone: preview.tone,
        tone: preview.tone
    };
};

export const buildBoardChainOpportunityChipViewData = ({
    accessibilitySummary,
    beatActionId,
    cueMeterFill,
    cueMeterState,
    deps,
    nextActionMeterFill,
    nextActionTier,
    nextActionVerb,
    opportunity,
    opportunityMeterFill,
    primaryShotAudio,
    primaryShotFocus,
    primaryShotRow,
    primaryShotScreenCue,
    primaryTraitLaneAudio,
    primaryTraitLaneRow,
    primaryTraitLaneScreenCue,
    priorityId,
    recipeChips,
    recipeRows,
    shotBeatRow,
    shotCadenceRow,
    traitInteractionLaneActionMap,
    traitInteractionLaneAttrValue,
    traitInteractionLaneMap,
    traitInteractionLaneMapAccessibleLabel,
    traitInteractionLaneMapMeterFill,
    traitInteractionLanePrimary,
    traitInteractionLaneRoleMap,
    traitLaneBeatMapLabel,
    traitLaneBeatMapMeterFill,
    traitLaneBeatRows,
    traitLaneBeatSummaryAction,
    traitLaneBeatSummaryBeatCount,
    traitLaneBeatSummaryScreenCue,
    traitLaneBeatSummaryTier
}: {
    accessibilitySummary: BoardChainAccessibilitySummaryLike;
    beatActionId: string | null;
    cueMeterFill: number;
    cueMeterState: string;
    deps: BoardChainOpportunityViewDeps;
    nextActionMeterFill: number;
    nextActionTier: string;
    nextActionVerb: string;
    opportunity: BoardChainOpportunityLike;
    opportunityMeterFill: number;
    primaryShotAudio: string;
    primaryShotFocus: string;
    primaryShotRow: PrimaryCardFeedbackShotRowLike | null;
    primaryShotScreenCue: string;
    primaryTraitLaneAudio: string;
    primaryTraitLaneRow: TraitLaneBeatRowLike | null;
    primaryTraitLaneScreenCue: string;
    priorityId: string;
    recipeChips: string[];
    recipeRows: ChainRecipeRowLike[];
    shotBeatRow: CardFeedbackBeatRowLike | null;
    shotCadenceRow: CardFeedbackCadenceRowLike | null;
    traitInteractionLaneActionMap: string;
    traitInteractionLaneAttrValue: string;
    traitInteractionLaneMap: TraitInteractionLaneLike[];
    traitInteractionLaneMapAccessibleLabel: string;
    traitInteractionLaneMapMeterFill: number;
    traitInteractionLaneRoleMap: string;
    traitInteractionLanePrimary: TraitInteractionLaneLike | null;
    traitLaneBeatMapLabel: string;
    traitLaneBeatMapMeterFill: number;
    traitLaneBeatRows: TraitLaneBeatRowLike[];
    traitLaneBeatSummaryAction: string | null;
    traitLaneBeatSummaryBeatCount: number;
    traitLaneBeatSummaryScreenCue: string | null;
    traitLaneBeatSummaryTier: string | null;
}): ChainOpportunityChipViewData => {
    const eyebrowBeatCount = opportunity.streakCashoutReady ? 5 : opportunity.comboSurgeLabel ? 4 : opportunity.selectedFollowupCount > 0 ? 3 : 2;
    const priorityBeatCount = opportunity.rewardHot ? 5 : opportunity.selectedFollowupCount > 0 ? 3 : 2;
    const cueBeatCount =
        opportunity.rewardHot || opportunity.streakCashoutReady
            ? 5
            : opportunity.selectedFollowupCount > 0
              ? 3
              : opportunity.comboSurgeLabel
                ? 4
                : 2;

    return {
        arcadeCallout: opportunity.arcadeCallout
            ? {
                  action: deps.getCalloutAction(opportunity.arcadeCallout.tone),
                  audio: deps.getCalloutAudioCue(opportunity.arcadeCallout.tone),
                  beatCount:
                      opportunity.arcadeCallout.tone === 'cashout'
                          ? 5
                          : opportunity.arcadeCallout.tone === 'surge'
                            ? 4
                            : 2,
                  label: opportunity.arcadeCallout.label,
                  screenCue: deps.getCalloutScreenCue(opportunity.arcadeCallout.tone),
                  tone: opportunity.arcadeCallout.tone,
                  value: opportunity.arcadeCallout.value
              }
            : null,
        beat: opportunity.beatSignal
            ? {
                  action: opportunity.beatSignal.action,
                  actionId: beatActionId ?? 'none',
                  accessibleLabel: deps.formatBeatLabel(opportunity.beatSignal),
                  audio: opportunity.beatSignal.audioCue,
                  beatCount: opportunity.beatSignal.beatCount,
                  detail: opportunity.beatSignal.detail,
                  label: opportunity.beatSignal.label,
                  meterFill: Math.round((opportunity.beatSignal.beatCount / 5) * 100),
                  screenCue: opportunity.beatSignal.screenCue,
                  tier: opportunity.beatSignal.tier
              }
            : null,
        cue: {
            beatAction: deps.getCueAction(cueMeterState),
            beatAudio: deps.getCueAudioCue(cueMeterState),
            beatCount: cueBeatCount,
            beatScreenCue: deps.getCueScreenCue(cueMeterState),
            beatState: cueMeterState,
            fill: cueMeterFill,
            label: opportunity.cue
        },
        eyebrow: {
            beatAction: deps.getCueAction(cueMeterState),
            beatAudio: deps.getCueAudioCue(cueMeterState),
            beatCount: eyebrowBeatCount,
            beatScreenCue: deps.getCueScreenCue(cueMeterState),
            beatState: cueMeterState,
            label: opportunity.streakCashoutReady ? 'Streak reward' : 'Chain routes'
        },
        meter:
            accessibilitySummary.tone !== 'idle'
                ? {
                      accessibleLabel: accessibilitySummary.label,
                      fill: opportunityMeterFill,
                      lanes: [
                          accessibilitySummary.readyCount > 0
                              ? {
                                    action: 'match-route',
                                    count: accessibilitySummary.readyCount,
                                    id: 'ready',
                                    label: 'Lit',
                                    pipCount: Math.min(5, accessibilitySummary.readyCount),
                                    tone: 'ready'
                                }
                              : null,
                          accessibilitySummary.followupCount > 0
                              ? {
                                    action: 'follow-up',
                                    count: accessibilitySummary.followupCount,
                                    id: 'followup',
                                    label: 'Follow',
                                    pipCount: Math.min(5, accessibilitySummary.followupCount),
                                    tone: 'followup'
                                }
                              : null,
                          accessibilitySummary.surgeCount > 0
                              ? {
                                    action: 'combo-surge',
                                    count: accessibilitySummary.surgeCount,
                                    id: 'surge',
                                    label: 'Surge',
                                    pipCount: Math.min(5, accessibilitySummary.surgeCount),
                                    tone: 'surge'
                                }
                              : null,
                          accessibilitySummary.rewardHotCount > 0
                              ? {
                                    action: 'cashout',
                                    count: accessibilitySummary.rewardHotCount,
                                    id: 'hot',
                                    label: 'Hot',
                                    pipCount: Math.min(5, accessibilitySummary.rewardHotCount),
                                    tone: 'cashout'
                                }
                              : null,
                          accessibilitySummary.setupCount > 0
                              ? {
                                    action: 'prime-route',
                                    count: accessibilitySummary.setupCount,
                                    id: 'setup',
                                    label: 'Prime',
                                    pipCount: Math.min(5, accessibilitySummary.setupCount),
                                    tone: 'setup'
                                }
                              : null
                      ].filter(
                          (lane): lane is NonNullable<ChainOpportunityChipViewData['meter']>['lanes'][number] => lane !== null
                      ),
                      nextRouteBeatCount: accessibilitySummary.tone === 'cashout' ? 5 : accessibilitySummary.tone === 'ready' ? 3 : 2,
                      nextRouteLabel: accessibilitySummary.primaryLine,
                      secondaryRouteLabel: accessibilitySummary.secondaryLine ?? null,
                      tone: accessibilitySummary.tone
                  }
                : null,
        nextAction: opportunity.nextActionLabel
            ? {
                  accessibleLabel: `Next chain action. ${nextActionVerb}. ${opportunity.nextActionDetail ?? opportunity.nextActionLabel}.`,
                  detail: opportunity.nextActionDetail,
                  id: opportunity.nextActionId,
                  meterFill: nextActionMeterFill,
                  pipCount: opportunity.nextActionId === 'cashout' ? 5 : opportunity.nextActionId === 'prime-route' ? 2 : 3,
                  tier: nextActionTier,
                  tone: opportunity.nextActionTone,
                  verb: nextActionVerb
              }
            : null,
        primaryShot: primaryShotRow
            ? {
                  accessibleLabel: `Primary combo shot. ${primaryShotRow.shotLabel}: ${primaryShotRow.detail}. ${
                      shotBeatRow ? `${shotBeatRow.beatCount}-beat ${shotBeatRow.action}.` : ''
                  }${shotCadenceRow ? ` Pulse: ${shotCadenceRow.action}.` : ''}`,
                  beatCount: shotBeatRow?.beatCount ?? 0,
                  beatId: shotBeatRow?.id ?? 'none',
                  cadenceAction: shotCadenceRow?.action ?? null,
                  cadenceId: shotCadenceRow?.id ?? 'none',
                  detail: primaryShotRow.detail,
                  focus: primaryShotFocus,
                  id: primaryShotRow.id,
                  screenCue: primaryShotScreenCue,
                  shotAudio: primaryShotAudio,
                  shotLabel: primaryShotRow.shotLabel
              }
            : null,
        primaryTraitLane: primaryTraitLaneRow
            ? {
                  accessibleLabel: `Primary trait lane action. ${primaryTraitLaneRow.label}: ${primaryTraitLaneRow.count}. ${primaryTraitLaneRow.beatCount}-beat ${primaryTraitLaneRow.action}.`,
                  action: primaryTraitLaneRow.action,
                  audio: primaryTraitLaneAudio,
                  beatCount: primaryTraitLaneRow.beatCount,
                  count: primaryTraitLaneRow.count,
                  label: primaryTraitLaneRow.label,
                  role: primaryTraitLaneRow.role,
                  roleId: deps.cardTraitLaneBeatMapSummaryAction(primaryTraitLaneRow.role) ?? 'none',
                  screenCue: primaryTraitLaneScreenCue,
                  traitLaneId: primaryTraitLaneRow.id
              }
            : null,
        priority: opportunity.priorityLabel
            ? {
                  beatAudio: deps.getPriorityAudioCue(priorityId),
                  beatCount: priorityBeatCount,
                  beatScreenCue: deps.getPriorityScreenCue(priorityId),
                  id: priorityId,
                  label: opportunity.priorityLabel
              }
            : null,
        recipes:
            recipeChips.length > 0
                ? {
                      accessibleLabel: `Combo recipes. ${recipeChips.join('. ')}`,
                      meterFill: Math.round(Math.min(100, (recipeChips.length / 3) * 100)),
                      rows: recipeRows.map((row) => ({
                          action: row.action,
                          beatCount: Math.max(2, Math.min(5, row.recipe.split('+').length)),
                          label: row.label,
                          laneId: row.laneId,
                          recipe: row.recipe,
                          roleId: row.roleId,
                          sourceLine: row.sourceLine
                      }))
                  }
                : null,
        roleSummaryLanes: [
            accessibilitySummary.readyCount > 0
                ? { action: 'match-route', count: accessibilitySummary.readyCount, id: 'lit', label: 'Lit', tone: 'ready' }
                : null,
            accessibilitySummary.followupCount > 0
                ? { action: 'follow-up', count: accessibilitySummary.followupCount, id: 'followup', label: 'Follow', tone: 'surge' }
                : null,
            accessibilitySummary.surgeCount > 0
                ? { action: 'combo-surge', count: accessibilitySummary.surgeCount, id: 'surge', label: 'Surge', tone: 'surge' }
                : null,
            accessibilitySummary.rewardHotCount > 0
                ? { action: 'cashout', count: accessibilitySummary.rewardHotCount, id: 'hot', label: 'Hot', tone: 'cashout' }
                : null,
            accessibilitySummary.payoffStackCount > 0
                ? { action: 'payoff-stack', count: accessibilitySummary.payoffStackCount, id: 'payoff', label: 'Payoff', tone: 'cashout' }
                : null,
            accessibilitySummary.setupCount > 0
                ? { action: 'prime-route', count: accessibilitySummary.setupCount, id: 'prime', label: 'Prime', tone: 'setup' }
                : null
        ].filter((lane): lane is ChainOpportunityChipViewData['roleSummaryLanes'][number] => lane !== null),
    traitInteractionLaneMap:
            traitInteractionLaneMap.length > 0
                ? {
                      accessibleLabel: traitInteractionLaneMapAccessibleLabel,
                      actionMap: traitInteractionLaneActionMap,
                      laneMap: traitInteractionLaneAttrValue,
                      meterFill: traitInteractionLaneMapMeterFill,
                      primary: traitInteractionLanePrimary
                          ? {
                                action: deps.getTraitInteractionLaneAction(traitInteractionLanePrimary.id),
                                audio: deps.cardTraitLaneAudioCue(traitInteractionLanePrimary.id),
                                id: traitInteractionLanePrimary.id,
                                role: deps.getTraitInteractionLaneRole(traitInteractionLanePrimary),
                                roleId:
                                    deps.cardTraitLaneBeatMapSummaryAction(
                                        deps.getTraitInteractionLaneRole(traitInteractionLanePrimary)
                                    ) ?? 'none',
                                screenCue: deps.cardTraitLaneScreenCue(traitInteractionLanePrimary.id)
                            }
                          : null,
                      roleMap: traitInteractionLaneRoleMap,
                      rows: traitInteractionLaneMap.map((lane) => ({
                          action: deps.getTraitInteractionLaneAction(lane.id),
                          audio: deps.cardTraitLaneAudioCue(lane.id),
                          beats: Math.max(2, Math.min(5, lane.count + 1)),
                          count: lane.count,
                          cue: lane.cue,
                          focus: lane.id === traitInteractionLanePrimary?.id ? 'primary' : 'support',
                          id: lane.id,
                          label: lane.label,
                          role: deps.getTraitInteractionLaneRole(lane),
                          roleId: deps.cardTraitLaneBeatMapSummaryAction(deps.getTraitInteractionLaneRole(lane)) ?? 'none',
                          screenCue: deps.cardTraitLaneScreenCue(lane.id)
                      })),
                      summaryAccessibleLabel: `Trait lane summary. ${traitInteractionLaneMap.length} ${
                          traitInteractionLaneMap.length === 1 ? 'lane' : 'lanes'
                      }. ${traitInteractionLanePrimary ? deps.getTraitInteractionLaneAction(traitInteractionLanePrimary.id) : 'No primary lane'}.`,
                      summaryBeatCount: Math.max(2, Math.min(5, traitInteractionLaneMap.length + 1))
                  }
                : null,
        traitLaneBeatMap:
            traitLaneBeatRows.length > 0
                ? {
                      accessibleLabel: traitLaneBeatMapLabel,
                      meterFill: traitLaneBeatMapMeterFill,
                      primaryAction: traitLaneBeatRows[0]?.action ?? 'none',
                      primaryAudio: primaryTraitLaneAudio,
                      primaryId: traitLaneBeatRows[0]?.id ?? 'none',
                      primaryRole: traitLaneBeatRows[0]?.role ?? 'none',
                      primaryRoleId: deps.cardTraitLaneBeatMapSummaryAction(traitLaneBeatRows[0]?.role ?? null) ?? 'none',
                      primaryScreenCue: primaryTraitLaneScreenCue,
                      rows: traitLaneBeatRows.map((row) => ({
                          action: row.action,
                          audio: deps.cardTraitLaneAudioCue(row.id),
                          beatCount: row.beatCount,
                          count: row.count,
                          focus: row.id === traitLaneBeatRows[0]?.id ? 'primary' : 'support',
                          id: row.id,
                          label: row.label,
                          role: row.role,
                          roleId: deps.cardTraitLaneBeatMapSummaryAction(row.role) ?? 'none',
                          screenCue: deps.cardTraitLaneScreenCue(row.id)
                      })),
                      summaryAccessibleLabel: `Trait beat map summary. ${traitLaneBeatRows.length} ${
                          traitLaneBeatRows.length === 1 ? 'lane' : 'lanes'
                      }. ${traitLaneBeatSummaryAction ?? 'No action'}.`,
                      summaryAction: traitLaneBeatSummaryAction ?? 'none',
                      summaryBeatCount: traitLaneBeatSummaryBeatCount,
                      summaryScreenCue: traitLaneBeatSummaryScreenCue ?? 'none',
                      summaryTier: traitLaneBeatSummaryTier ?? 'none'
                  }
                : null
    };
};

export const buildBoardChainStatusMetersViewData = ({
    deps,
    opportunity,
    rewardLead
}: {
    deps: BoardStatusChipViewDeps;
    opportunity: BoardChainOpportunityLike;
    rewardLead: RewardLeadLike | null;
}): {
    hotBandTone: string;
    nextTargetBeatCount: 2 | 3 | 5;
    statusMeters: ChainStatusMetersViewData;
    targetPlanBeatCount: 2 | 3;
} => {
    const hotBand = opportunity.rewardHot
        ? {
              accessibleLabel: deps.formatLabel('Chain hot band', [
                  'Reward hot',
                  opportunity.rewardCue ?? opportunity.nextTarget ?? 'Cash out now',
                  opportunity.rewardUrgencyLabel ?? opportunity.nextTarget ?? 'Cash out now'
              ]),
              action: 'cashout',
              beatCount: 5,
              cue: opportunity.rewardUrgencyLabel ?? opportunity.nextTarget ?? 'Cash out now',
              detail: opportunity.rewardCue ?? opportunity.nextTarget ?? 'Cash out now',
              label: 'Hot lane',
              meterFill: 100,
              screenCue: 'burst',
              tier: 'hot',
              tone: 'cashout',
              value: 'Reward hot'
          }
        : opportunity.streakCashoutReady
          ? {
                accessibleLabel: deps.formatLabel('Chain hot band', [
                    'Cashout ready',
                    opportunity.nextTarget ?? opportunity.rewardCue ?? 'Any clean match pays',
                    opportunity.rewardUrgencyLabel ?? opportunity.nextTarget ?? 'Keep the streak paying'
                ]),
                action: 'hold',
                beatCount: 3,
                cue: opportunity.rewardUrgencyLabel ?? opportunity.nextTarget ?? 'Keep the streak paying',
                detail: opportunity.nextTarget ?? opportunity.rewardCue ?? 'Any clean match pays',
                label: 'Streak lane',
                meterFill: 70,
                screenCue: 'guard',
                tier: 'ready',
                tone: 'ready',
                value: 'Cashout ready'
            }
          : null;

    const surgeBand = opportunity.comboSurgeLabel
        ? {
              accessibleLabel: deps.formatLabel('Chain surge band', [
                  'Combo surge',
                  opportunity.chainReadyTileCount === 1 ? '1 card lit' : `${opportunity.chainReadyTileCount} cards lit`,
                  opportunity.chainReadyCount === 1 ? '1 route ready' : `${opportunity.chainReadyCount} routes ready`,
                  opportunity.cue || 'Route prime'
              ]),
              action: 'surge',
              beatCount: 4,
              cue: opportunity.cue || 'Route prime',
              detail: opportunity.chainReadyCount === 1 ? '1 route ready' : `${opportunity.chainReadyCount} routes ready`,
              label: 'Combo surge',
              meterFill: Math.round(Math.min(100, (opportunity.chainReadyCount / 5) * 100)),
              screenCue: 'burst',
              tier: 'combo',
              tone: 'surge',
              value: opportunity.chainReadyTileCount === 1 ? '1 card lit' : `${opportunity.chainReadyTileCount} cards lit`
          }
        : null;

    const momentumBeatCount: 2 | 3 | 4 | 5 = opportunity.rewardHot
        ? 5
        : opportunity.comboSurgeLabel
          ? 4
          : opportunity.selectedFollowupCount > 0 || opportunity.chainReadyCount > 0
            ? 3
            : 2;
    const momentumTone: 'cashout' | 'followup' | 'ready' | 'setup' | 'surge' = opportunity.rewardHot
        ? 'cashout'
        : opportunity.comboSurgeLabel
          ? 'surge'
          : opportunity.selectedFollowupCount > 0
            ? 'followup'
            : opportunity.chainReadyCount > 0 || opportunity.streakCashoutReady
              ? 'ready'
              : 'setup';
    const momentumTier: 'hot' | 'primed' | 'ready' | 'setup' =
        momentumTone === 'cashout' ? 'hot' : momentumTone === 'surge' ? 'primed' : momentumTone === 'ready' || momentumTone === 'followup' ? 'ready' : 'setup';
    const momentumScreenCue: 'burst' | 'guard' | 'pulse' | 'tick' =
        momentumTone === 'cashout' || momentumTone === 'surge' ? 'burst' : momentumTone === 'followup' ? 'pulse' : momentumTone === 'ready' ? 'guard' : 'tick';
    const rewardUrgencyTone: 'cashout' | 'forecast' = opportunity.rewardUrgencyTier === 'next' ? 'cashout' : 'forecast';
    const rewardUrgencyScreenCue: 'burst' | 'pulse' | 'tick' =
        opportunity.rewardUrgencyTier === 'next' ? 'burst' : opportunity.rewardUrgencyTier === 'soon' ? 'pulse' : 'tick';
    const examplesTone = opportunity.nextActionId === 'prime-route' ? 'setup' : opportunity.rewardHot ? 'cashout' : 'forecast';

    return {
        hotBandTone: hotBand?.tone ?? 'none',
        nextTargetBeatCount: opportunity.nextActionId === 'cashout' ? 5 : opportunity.nextActionId === 'follow-up' ? 3 : 2,
        statusMeters: {
            armedPerk: opportunity.armedPerkLabel
                ? {
                      beatCount: opportunity.armedPerkPayoff ? 4 : 3,
                      label: opportunity.armedPerkLabel,
                      meterFill: opportunity.armedPerkPayoff ? 100 : 70,
                      payoff: opportunity.armedPerkPayoff,
                      tone: opportunity.armedPerkPayoff ? 'payoff' : 'armed',
                      valueNow: opportunity.armedPerkPayoff ? 100 : 70
                  }
                : null,
            examples:
                opportunity.examples.length > 0
                    ? {
                          beatCount: Math.min(4, opportunity.examples.length + 1),
                          items: opportunity.examples,
                          meterFill: Math.round(Math.min(100, (opportunity.examples.length / 4) * 100)),
                          tone: examplesTone
                      }
                    : null,
            hotBand,
            lines: {
                action: opportunity.nextActionId,
                beatCount: Math.max(2, Math.min(5, opportunity.lines.length + 1)),
                items: opportunity.lines,
                meterFill: Math.round(Math.min(100, (opportunity.lines.length / 3) * 100)),
                tier:
                    opportunity.nextActionId === 'cashout'
                        ? 'now'
                        : opportunity.nextActionId === 'follow-up'
                          ? 'tap'
                          : opportunity.nextActionId === 'match-route'
                            ? 'route'
                            : opportunity.nextActionId === 'prime-route'
                              ? 'prime'
                              : 'setup',
                tone: opportunity.nextActionTone
            },
            momentum:
                opportunity.momentumLabel || opportunity.chaseLabel
                    ? {
                          beatCount: momentumBeatCount,
                          chaseLabel: opportunity.chaseLabel,
                          label: opportunity.momentumLabel,
                          meterFill: Math.round((momentumBeatCount / 5) * 100),
                          screenCue: momentumScreenCue,
                          tier: momentumTier,
                          tone: momentumTone
                      }
                    : null,
            rewardCue:
                opportunity.rewardCue
                    ? {
                          beatCount: opportunity.rewardHot ? 5 : 3,
                          cue: opportunity.rewardCue,
                          hot: opportunity.rewardHot,
                          meterFill: opportunity.rewardHot ? 100 : 60,
                          screenCue: opportunity.rewardHot ? 'super' : 'pulse',
                          target: opportunity.rewardHot ? 'cashout-now' : 'cashout-build',
                          tone: opportunity.rewardHot ? 'cashout' : 'forecast'
                      }
                    : null,
            rewardUrgency:
                opportunity.rewardUrgencyLabel
                    ? {
                          beatCount: rewardLead?.beatCount ?? 3,
                          label: opportunity.rewardUrgencyLabel,
                          meterFill: rewardLead?.meterFill ?? 60,
                          screenCue: rewardUrgencyScreenCue,
                          tier: opportunity.rewardUrgencyTier ?? 'none',
                          tone: rewardUrgencyTone
                      }
                    : null,
            surgeBand
        },
        targetPlanBeatCount: opportunity.comboSurgeLabel || opportunity.rewardHot ? 3 : 2
    };
};

export const buildBoardStatusChipsViewData = ({
    activePower,
    deps,
    pickupOpportunity,
    traitMode,
    traitModeAccessibleLabel
}: {
    activePower: ActivePowerBoardChipLike | null;
    deps: BoardStatusChipViewDeps;
    pickupOpportunity: BoardPickupOpportunityChipState | null;
    traitMode: BoardTraitModeCueState | null;
    traitModeAccessibleLabel: string | undefined;
}): BoardStatusChipsViewData => ({
    activePower: activePower
        ? {
              accessibleLabel: deps.formatLabel('Active board power', [
                  activePower.label,
                  activePower.detail,
                  `First ${activePower.first}`,
                  `Then ${activePower.then}`
              ]),
              action: activePower.action,
              beats: activePower.beats,
              detail: activePower.detail,
              first: activePower.first,
              label: activePower.label,
              meterFill: Math.round((activePower.beats / 4) * 100),
              screenCue: activePower.screenCue,
              then: activePower.then,
              tier: activePower.tier,
              tone: activePower.tone
          }
        : null,
    pickupOpportunity,
    traitMode: traitMode
        ? {
              accessibleLabel: traitModeAccessibleLabel,
              action: traitMode.action,
              beatCount: traitMode.beatCount,
              detail: traitMode.detail,
              label: traitMode.label,
              nextReward: traitMode.nextReward,
              screenCue: traitMode.screenCue,
              tier: traitMode.tier,
              tone: traitMode.tone,
              value: traitMode.value
          }
        : null
});

export const buildBoardChainProgressionCuesViewData = ({
    nextActionTier,
    nextTargetBeatCount,
    opportunity,
    sequenceAccessibleLabel,
    sequenceCue,
    targetPlanBeatCount
}: {
    nextActionTier: 'now' | 'prime' | 'route' | 'setup' | 'tap';
    nextTargetBeatCount: 2 | 3 | 5;
    opportunity: BoardChainOpportunityLike;
    sequenceAccessibleLabel: string | null;
    sequenceCue: { first: string; keep: string; then: string; tone: string } | null;
    targetPlanBeatCount: 2 | 3;
}): ChainProgressionCuesViewData => ({
    followupLabel: opportunity.selectedFollowupLabel ?? null,
    milestone:
        opportunity.milestoneActionLabel && opportunity.milestoneTargetLabel
            ? {
                  actionLabel: opportunity.milestoneActionLabel,
                  beatCount: opportunity.milestoneBeatCount,
                  meterFill: opportunity.milestoneMeterFill,
                  screenCue: opportunity.milestoneScreenCue ?? 'none',
                  targetLabel: opportunity.milestoneTargetLabel,
                  tier: opportunity.milestoneTier ?? 'none',
                  tone: opportunity.milestoneTone ?? 'none'
              }
            : null,
    nextTarget: opportunity.nextTarget
        ? {
              actionId: opportunity.nextActionId,
              beatCount: nextTargetBeatCount,
              target: opportunity.nextTarget,
              tier: nextActionTier,
              tone: opportunity.nextActionTone
          }
        : null,
    sequenceCue:
        sequenceCue && sequenceAccessibleLabel
            ? {
                  accessibleLabel: sequenceAccessibleLabel,
                  first: sequenceCue.first,
                  keep: sequenceCue.keep,
                  then: sequenceCue.then,
                  tone: sequenceCue.tone
              }
            : null,
    surgeLabel: opportunity.comboSurgeLabel,
    targetPlan: opportunity.targetPlanLabel
        ? {
              actionId: opportunity.nextActionId,
              beatCount: targetPlanBeatCount,
              label: opportunity.targetPlanLabel,
              nextActionLabel: opportunity.nextActionLabel ?? 'Setup',
              tier: nextActionTier,
              tone: opportunity.nextActionTone
          }
        : null
});

export const buildBoardChainRewardLadderViewData = ({
    hotBandTone,
    rewardLadder
}: {
    hotBandTone: string;
    rewardLadder: RewardLadderStateLike;
}): ChainRewardLadderViewData => ({
    accessibleLabel: rewardLadder.accessibleLabel,
    entries: rewardLadder.entries,
    focusId: rewardLadder.focusId,
    hotBandTone,
    ladderActionAttr: rewardLadder.actionAttr,
    ladderAttr: rewardLadder.attr,
    lead: rewardLadder.lead,
    leadAccessibleLabel: rewardLadder.leadAccessibleLabel,
    summaryAction: rewardLadder.summaryAction,
    summaryBeatCount: rewardLadder.summaryBeatCount,
    summaryMeterFill: rewardLadder.summaryMeterFill,
    summaryScreenCue: rewardLadder.summaryScreenCue,
    summaryTier: rewardLadder.summaryTier
});

export const buildBoardChainShotMapViewData = ({
    label,
    primaryActionId,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
}: ChainShotMapViewData): ChainShotMapViewData => ({
    label,
    primaryActionId,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
});

export const buildBoardChainActionPriorityViewData = ({
    primaryActionId,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
}: ChainActionPriorityViewData): ChainActionPriorityViewData => ({
    primaryActionId,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
});

export const buildBoardChainBeatMapViewData = ({
    actionMapAttr,
    label,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
}: ChainBeatMapViewData): ChainBeatMapViewData => ({
    actionMapAttr,
    label,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
});

export const buildBoardChainCadenceMapViewData = ({
    label,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
}: ChainCadenceMapViewData): ChainCadenceMapViewData => ({
    label,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
});

export const buildBoardChainMarkerKeyViewData = ({
    focusedChainMarkerShape,
    intensity,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
}: ChainMarkerKeyViewData): ChainMarkerKeyViewData => ({
    focusedChainMarkerShape,
    intensity,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
});

export const buildBoardOpportunityCompassSurfaceViewData = ({
    bestOpportunity,
    chainOpportunity,
    compassLabel,
    heat,
    hotBandTone,
    meterFill,
    payoffStack,
    rows,
    summaryAction,
    summaryActionLabel,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
}: {
    bestOpportunity: { tone: string } | null;
    chainOpportunity: { comboSurgeLabel: string | null };
    compassLabel: string;
    heat: string;
    hotBandTone: string;
    meterFill: number;
    payoffStack: OpportunityPayoffStackView | null;
    rows: OpportunityCompassRowView[];
    summaryAction: string | null;
    summaryActionLabel: string;
    summaryBeatCount: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
}): OpportunityCompassSurfaceViewData => ({
    bestScreenCue: bestOpportunity ? rows[0]?.screenCue ?? 'none' : 'none',
    bestTone: bestOpportunity?.tone ?? 'none',
    beats: rows.length,
    heat,
    hot: hotBandTone,
    label: compassLabel,
    meterFill,
    payoffStack,
    priority: rows.length === 1 ? 'single' : 'best',
    rows,
    summaryAction,
    summaryActionLabel,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier,
    summaryTone: bestOpportunity?.tone ?? 'none',
    surge: chainOpportunity.comboSurgeLabel ? 'true' : 'false'
});

export const buildBoardOpportunityLaneMapSurfaceViewData = ({
    accessibleLabel,
    actionIdMap,
    actionMap,
    laneMap,
    primaryLane,
    roleIdMap,
    roleMap,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
}: OpportunityLaneMapSurfaceViewData): OpportunityLaneMapSurfaceViewData => ({
    accessibleLabel,
    actionIdMap,
    actionMap,
    laneMap,
    primaryLane,
    roleIdMap,
    roleMap,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
});

export const buildBoardChainOpportunitySurfaceViewData = ({
    accessibleLabel,
    actionPriority,
    arcadeCallout,
    beat,
    beatMap,
    cadenceMap,
    cue,
    eyebrow,
    markerKey,
    meter,
    nextAction,
    primaryShot,
    primaryTraitLane,
    priority,
    progressionCues,
    recipes,
    rewardLadder,
    roleSummaryLanes,
    shotMap,
    statusMeters,
    tone,
    traitInteractionLaneMap,
    traitLaneBeatMap
}: ChainOpportunitySurfaceViewData): ChainOpportunitySurfaceViewData => ({
    accessibleLabel,
    actionPriority,
    arcadeCallout,
    beat,
    beatMap,
    cadenceMap,
    cue,
    eyebrow,
    markerKey,
    meter,
    nextAction,
    primaryShot,
    primaryTraitLane,
    priority,
    progressionCues,
    recipes,
    rewardLadder,
    roleSummaryLanes,
    shotMap,
    statusMeters,
    tone,
    traitInteractionLaneMap,
    traitLaneBeatMap
});
