import { type TraitOpportunityHudModel, type TraitOpportunitySummary } from '../../shared/trait-opportunities';
import { type TraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    getTraitInteractionLaneCueBadge,
    getTraitInteractionLaneRole,
    getTraitInteractionLaneRoleId,
    type TraitInteractionLaneMapEntry
} from '../copy/traitInteractionLaneMap';

export type HudTraitRouteActionCueModel = {
    actionLabel: string;
    ariaLabel: string;
    audioCue: 'trait-route-cashout' | 'trait-route-prime' | 'trait-route-watch';
    beatCount: 2 | 3 | 4;
    progressLabel: string;
    screenCue: 'burst' | 'pulse' | 'tick';
    stateLabel: string;
    urgency: TraitRouteObjectiveStatus['urgency'];
};

export type HudTraitRouteStackCueModel = {
    action: string;
    ariaLabel: string;
    audioCue: 'trait-stack-cashout';
    beatCount: 4;
    label: string;
    screenCue: 'burst';
    value: string;
};

export type HudTraitRouteFeedbackModel = {
    actionCue: HudTraitRouteActionCueModel | null;
    bestToolLabel: string | null;
    meterPercent: number;
    progressLabel: string;
    stackCue: HudTraitRouteStackCueModel | null;
    urgencyTag: TraitRouteObjectiveStatus['urgency'] | 'ready' | 'setup';
};

const getHudTraitRouteActionBeatCount = (urgency: TraitRouteObjectiveStatus['urgency']): 2 | 3 | 4 => {
    if (urgency === 'next' || urgency === 'paid') {
        return 4;
    }
    if (urgency === 'building') {
        return 3;
    }
    return 2;
};

const getHudTraitRouteActionAudioCue = (
    urgency: TraitRouteObjectiveStatus['urgency']
): 'trait-route-cashout' | 'trait-route-prime' | 'trait-route-watch' => {
    if (urgency === 'next' || urgency === 'paid') {
        return 'trait-route-cashout';
    }
    if (urgency === 'building') {
        return 'trait-route-prime';
    }
    return 'trait-route-watch';
};

const getHudTraitRouteActionScreenCue = (
    urgency: TraitRouteObjectiveStatus['urgency']
): 'burst' | 'pulse' | 'tick' => {
    if (urgency === 'next' || urgency === 'paid') {
        return 'burst';
    }
    if (urgency === 'building') {
        return 'pulse';
    }
    return 'tick';
};

export const buildHudTraitRouteFeedbackModel = ({
    primaryRewardHot,
    primaryRewardLabel,
    routeCountLabel,
    status,
    swapHintActive,
    stackedPayoffCount,
    traitOpportunityActive
}: {
    primaryRewardHot: boolean;
    primaryRewardLabel: string | null;
    routeCountLabel: string;
    status: TraitRouteObjectiveStatus | null;
    swapHintActive: boolean;
    stackedPayoffCount: number;
    traitOpportunityActive: boolean;
}): HudTraitRouteFeedbackModel => {
    const actionCue = status
        ? {
              actionLabel: status.actionLabel,
              ariaLabel: `Trait route action cue. ${status.actionLabel}: ${status.stateLabel}. Reward: ${status.reward}.`,
              audioCue: getHudTraitRouteActionAudioCue(status.urgency),
              beatCount: getHudTraitRouteActionBeatCount(status.urgency),
              progressLabel: `${status.progress}/${status.required}`,
              screenCue: getHudTraitRouteActionScreenCue(status.urgency),
              stateLabel: status.stateLabel,
              urgency: status.urgency
          }
        : null;
    const stackCue =
        traitOpportunityActive && primaryRewardHot && primaryRewardLabel
            ? {
                  action: stackedPayoffCount > 0 ? 'Cash trait super stack' : 'Cash trait stack',
                  ariaLabel: `Trait stack cue. ${stackedPayoffCount > 0 ? 'Trait super stack' : 'Trait + Chain'}: ${
                      stackedPayoffCount > 0 ? 'Cash trait super stack' : 'Cash trait stack'
                  }. ${routeCountLabel} + ${primaryRewardLabel}.`,
                  audioCue: 'trait-stack-cashout' as const,
                  beatCount: 4 as const,
                  label: stackedPayoffCount > 0 ? 'Trait super stack' : 'Trait + Chain',
                  screenCue: 'burst' as const,
                  value: `${routeCountLabel} + ${primaryRewardLabel}`
              }
            : null;

    return {
        actionCue,
        bestToolLabel: swapHintActive ? 'Best tool: Swap' : null,
        meterPercent: status
            ? Math.min(100, (Math.max(0, status.progress) / Math.max(1, status.required)) * 100)
            : 0,
        progressLabel: status ? `${status.progress}/${status.required}` : routeCountLabel,
        stackCue,
        urgencyTag: status?.urgency ?? (swapHintActive ? 'setup' : 'ready')
    };
};

export type HudTraitInteractionLaneRow = TraitInteractionLaneMapEntry & {
    action: string;
    ariaLabel: string;
    countLabel: string;
    cueBadge: ReturnType<typeof getTraitInteractionLaneCueBadge>;
    role: ReturnType<typeof getTraitInteractionLaneRole>;
    roleId: ReturnType<typeof getTraitInteractionLaneRoleId>;
};

export type HudTraitInteractionLaneFeedbackModel = {
    actionMapAttr: string;
    laneMapLabel: string;
    laneRows: HudTraitInteractionLaneRow[];
    mapAttr: string;
    primaryLane: HudTraitInteractionLaneRow | null;
    roleIdMapAttr: string;
    roleMapAttr: string;
    summaryAriaLabel: string;
    summaryBeatCount: number;
    summaryScreenCue: string;
};

export type HudTraitOpportunitySummaryModel = {
    cardCountLabel: string | null;
    cardLine: string | null;
    detailBuildLabel: string;
    detailInteractionLines: string[];
    kindLine: string | null;
    summaryLine: string;
    title: string;
};

const decorateHudTraitInteractionLaneRow = (lane: TraitInteractionLaneMapEntry): HudTraitInteractionLaneRow => {
    const cueBadge = getTraitInteractionLaneCueBadge(lane);
    const role = getTraitInteractionLaneRole(lane);
    const roleId = getTraitInteractionLaneRoleId(lane);
    const action = getTraitInteractionLaneAction(lane.id);
    const countLabel = `${lane.count} ${lane.count === 1 ? 'line' : 'lines'}`;

    return {
        ...lane,
        action,
        ariaLabel: `Trait interaction lane. ${lane.label}. ${cueBadge.label} cue: ${cueBadge.glyph}. ${role}. ${action}. ${countLabel}. ${lane.cue}.`,
        countLabel,
        cueBadge,
        role,
        roleId
    };
};

export const buildHudTraitInteractionLaneFeedbackModel = ({
    lines,
    summaryScreenCue
}: {
    lines: readonly string[];
    summaryScreenCue: string;
}): HudTraitInteractionLaneFeedbackModel => {
    const laneMap = buildTraitInteractionLaneMap(lines);
    const laneRows = laneMap.map(decorateHudTraitInteractionLaneRow);
    const primaryLane = laneRows[0] ?? null;

    return {
        actionMapAttr: laneRows.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>'),
        laneMapLabel: formatTraitInteractionLaneMapLabel('Trait interaction lanes', laneMap),
        laneRows,
        mapAttr: laneRows.map((lane) => `${lane.id}:${lane.count}`).join('>'),
        primaryLane,
        roleIdMapAttr: laneRows.map((lane) => `${lane.id}:${lane.roleId ?? 'none'}:${lane.count}`).join('>'),
        roleMapAttr: laneRows.map((lane) => `${lane.id}:${lane.role}:${lane.count}`).join('>'),
        summaryAriaLabel: `Trait route lane summary. ${laneRows.length} ${laneRows.length === 1 ? 'lane' : 'lanes'}. ${
            primaryLane
                ? `${primaryLane.cueBadge.label} cue ${primaryLane.cueBadge.glyph}. ${primaryLane.role} ${primaryLane.label}`
                : 'No lead lane'
        }.`,
        summaryBeatCount: Math.max(2, Math.min(5, laneRows.length + 1)),
        summaryScreenCue
    };
};

export const buildHudTraitOpportunitySummaryModel = ({
    hud,
    summary
}: {
    hud: TraitOpportunityHudModel;
    summary: TraitOpportunitySummary;
}): HudTraitOpportunitySummaryModel => {
    const cardLine =
        summary.tiles.length > 0
            ? summary.tiles
                  .slice(0, 5)
                  .map((tile) => `${tile.label} (${tile.traitKind})`)
                  .join(', ')
            : null;
    const kindLine = summary.tiles.length > 0 ? summary.tiles.map((tile) => tile.traitKind).join(', ') : null;
    const cardCountLabel =
        summary.tiles.length > 0
            ? `${summary.tiles.length} combo card${summary.tiles.length === 1 ? '' : 's'}`
            : null;
    const title = summary.reason
        ? `Trait combo opportunities. ${cardCountLabel ?? 'No combo cards'}. Types: ${kindLine ?? 'none'}. ${summary.reason}.`
        : cardLine
          ? `Trait combo opportunities. ${cardCountLabel ?? 'Combo cards'}. ${cardLine}.`
          : 'Trait combo opportunities';

    return {
        cardCountLabel,
        cardLine,
        detailBuildLabel: summary.buildLabels.length > 0 ? summary.buildLabels.join(' / ') : hud.buildLabel,
        detailInteractionLines: summary.interactionLines.slice(0, 3),
        kindLine,
        summaryLine: cardLine ?? summary.reason ?? 'No combo lines yet',
        title
    };
};
