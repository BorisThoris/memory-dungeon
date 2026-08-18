import { getTraitMarkerCueByRouteGlyph, getTraitMarkerCueByShape } from '../copy/traitMarkerCueGlossary';
import {
    getStackCashoutLaneCount,
    type VisualHudAnnouncementDetail,
    type VisualHudAnnouncementImpact
} from './gameScreenFeedback';

type HudRecentActionImpactCueBadgeId =
    | 'cashout-crown'
    | 'linked-route'
    | 'payoff-stack'
    | 'prime-cross'
    | 'protect-lane'
    | 'recover-lane'
    | 'risk-lane'
    | 'surge-burst';

type HudRecentActionImpactCueBadge = {
    glyph: string;
    id: HudRecentActionImpactCueBadgeId;
    label: 'Cashout' | 'Prime' | 'Protect' | 'Recover' | 'Risk' | 'Route' | 'Stack' | 'Surge';
};

type HudRecentActionLaneId = 'cash' | 'route' | 'chain' | 'utility' | 'recover';
type HudRecentActionLaneCueBadgeId =
    | 'cashout-crown'
    | 'linked-route'
    | 'payoff-stack'
    | 'perk-armed-bar'
    | 'recover-lane';

type HudRecentActionLaneCueBadge = {
    glyph: string;
    id: HudRecentActionLaneCueBadgeId;
    label: 'Cashout' | 'Recover' | 'Route' | 'Stack' | 'Tool';
};

type HudRecentActionLaneMapEntry = {
    action: string;
    count: number;
    id: HudRecentActionLaneId;
    label: string;
};

type HudRecentActionLaneAudioCue =
    | 'hud-action-cash'
    | 'hud-action-chain'
    | 'hud-action-recover'
    | 'hud-action-route'
    | 'hud-action-utility';

type HudRecentActionLaneScreenCue = 'burst' | 'guard' | 'pulse' | 'recover';
type HudRecentActionImpactScreenCue = 'burst' | 'guard' | 'pulse' | 'recover' | 'risk';

export type HudRecentActionLaneRow = HudRecentActionLaneMapEntry & {
    ariaLabel: string;
    audioCue: HudRecentActionLaneAudioCue;
    beatCount: 2 | 3 | 4;
    countLabel: string;
    cueBadge: HudRecentActionLaneCueBadge;
    mapLabel: string;
    primaryAriaLabel: string;
    screenCue: HudRecentActionLaneScreenCue;
    summaryLead: string;
    summaryLeadLabel: string;
};

export type HudRecentActionFeedbackModel = {
    impactBeatCount: 2 | 3 | 4;
    impactCue: string | null;
    impactCueBadge: HudRecentActionImpactCueBadge | null;
    impactScreenCue: HudRecentActionImpactScreenCue;
    laneActionMapAttr: string;
    laneMapAttr: string;
    laneMapLabel: string | null;
    laneRows: HudRecentActionLaneRow[];
    primaryLane: HudRecentActionLaneRow | null;
    stackLabel: string | null;
    stackSummary: HudRecentActionStackSummary | null;
};

export type HudRecentActionStackSummary = {
    action: string;
    firstCue: string;
    keepCue: string;
    label: string;
    nextCue: string;
    thenCue: string;
    tone: 'cashout' | 'build' | 'risk' | 'trait' | 'reward';
    value: string;
};

const HUD_RECENT_ACTION_LANE_LABELS: Record<HudRecentActionLaneId, string> = {
    cash: 'Cash',
    chain: 'Chain',
    recover: 'Fix',
    route: 'Route',
    utility: 'Tool'
};

const HUD_RECENT_ACTION_LANE_ACTIONS: Record<HudRecentActionLaneId, string> = {
    cash: 'Collect',
    chain: 'Keep streak',
    recover: 'Recover',
    route: 'Route next',
    utility: 'Use tool'
};

const HUD_RECENT_ACTION_LANE_ORDER: readonly HudRecentActionLaneId[] = ['cash', 'route', 'chain', 'utility', 'recover'];

const getHudRecentActionImpactCue = (impact: VisualHudAnnouncementImpact | null): string | null => {
    if (!impact || impact.details.length === 0 || impact.burstTier === 'none') {
        return null;
    }
    const labels = new Set(impact.details.map((detail) => detail.label));
    if (impact.burstTier === 'risk') {
        return labels.has('Lost reward') || labels.has('Chain break') ? 'Recovery lane' : 'Risk lane';
    }
    if (impact.burstTier === 'combo') {
        if (labels.has('Super stack')) {
            return 'Super stack';
        }
        if (labels.has('Stack cashout')) {
            return 'Stack cashout';
        }
        if (labels.has('Payoff stack')) {
            return 'Payoff stack';
        }
        if (labels.has('Cashout hit')) {
            return 'Cashout hit';
        }
        if (getStackCashoutLaneCount([...labels]) >= 2) {
            return 'Stack cashout';
        }
        if (
            labels.has('Combo prime') ||
            labels.has('Guard prime') ||
            labels.has('Heal prime') ||
            labels.has('Shard setup') ||
            labels.has('Combo setup') ||
            labels.has('Guard setup') ||
            labels.has('Heal setup')
        ) {
            return 'Prime cashout';
        }
        return labels.has('Cashout armed') || labels.has('One-away cashout') || labels.has('Shard cashout')
            ? 'Chain cashout'
            : 'Combo build';
    }
    if (impact.burstTier === 'reward') {
        if (labels.has('Payoff stack')) {
            return 'Payoff stack';
        }
        if (labels.has('Cashout hit')) {
            return 'Cashout hit';
        }
        if (labels.has('Reward cashout')) {
            return 'Reward cashout';
        }
        if (labels.has('Pickup cashout')) {
            return 'Pickup cashout';
        }
        if (labels.has('Cashout armed')) {
            return 'Cashout armed';
        }
        return labels.has('Pickup') ? 'Reward cashout' : 'Chain cashout';
    }
    if (impact.burstTier === 'trait') {
        return labels.has('Trait surge') ? 'Trait surge' : 'Trait cashout';
    }
    return 'Keep streak';
};

const getHudRecentActionImpactBeatCount = (impact: VisualHudAnnouncementImpact | null): 2 | 3 | 4 => {
    if (!impact || impact.details.length === 0 || impact.burstTier === 'none') {
        return 2;
    }
    if (impact.level === 'high' || impact.burstTier === 'combo' || impact.burstTier === 'risk') {
        return 4;
    }
    if (impact.level === 'medium' || impact.burstTier === 'reward' || impact.burstTier === 'trait') {
        return 3;
    }
    return 2;
};

const getHudRecentActionImpactScreenCue = (cue: string | null): HudRecentActionImpactScreenCue => {
    if (!cue) {
        return 'pulse';
    }
    if (cue === 'Recovery lane') {
        return 'recover';
    }
    if (cue === 'Risk lane') {
        return 'risk';
    }
    if (
        cue === 'Trait surge' ||
        cue === 'Super stack' ||
        cue.includes('cashout') ||
        cue.includes('Cashout') ||
        cue.includes('stack')
    ) {
        return 'burst';
    }
    if (cue.includes('Prime') || cue.includes('armed') || cue.includes('build')) {
        return 'pulse';
    }
    return 'guard';
};

const getHudRecentActionImpactCueBadge = (cue: string | null): HudRecentActionImpactCueBadge | null => {
    if (!cue) {
        return null;
    }
    if (cue === 'Trait surge') {
        const badge = getTraitMarkerCueByRouteGlyph('surge-burst');
        return { glyph: badge.glyph, id: 'surge-burst', label: 'Surge' };
    }
    if (cue === 'Recovery lane') {
        return { glyph: '!!', id: 'recover-lane', label: 'Recover' };
    }
    if (cue === 'Risk lane') {
        return { glyph: '##', id: 'risk-lane', label: 'Risk' };
    }
    if (cue === 'Keep streak') {
        return { glyph: '[]', id: 'protect-lane', label: 'Protect' };
    }
    if (cue === 'Prime cashout' || cue === 'Cashout armed') {
        const badge = getTraitMarkerCueByShape('swap-target-crossbar');
        return { glyph: badge.glyph, id: 'prime-cross', label: 'Prime' };
    }
    if (cue === 'Super stack' || cue === 'Payoff stack' || cue === 'Stack cashout') {
        const badge = getTraitMarkerCueByShape('payoff-stack');
        return { glyph: badge.glyph, id: 'payoff-stack', label: 'Stack' };
    }
    if (cue === 'Trait cashout' || cue === 'Trait lane') {
        const badge = getTraitMarkerCueByShape('linked-route');
        return { glyph: badge.glyph, id: 'linked-route', label: 'Route' };
    }
    if (cue.includes('cashout') || cue.includes('Cashout')) {
        const badge = getTraitMarkerCueByShape('payoff-bar');
        return { glyph: badge.glyph, id: 'cashout-crown', label: 'Cashout' };
    }
    if (cue.includes('Trait')) {
        const badge = getTraitMarkerCueByShape('linked-route');
        return { glyph: badge.glyph, id: 'linked-route', label: 'Route' };
    }
    return { glyph: '[]', id: 'protect-lane', label: 'Protect' };
};

const getHudRecentActionLaneId = (detail: VisualHudAnnouncementDetail): HudRecentActionLaneId => {
    const label = detail.label.toLowerCase();
    if (detail.tone === 'risk' || /\b(break|lost|risk|recover|save)\b/.test(label)) {
        return 'recover';
    }
    if (detail.tone === 'trait' || /\b(route|trait)\b/.test(label)) {
        return 'route';
    }
    if (detail.tone === 'chain' || /\b(chain|streak|combo)\b/.test(label)) {
        return 'chain';
    }
    if (detail.tone === 'guard' || detail.tone === 'objective' || /\b(guard|objective|ward|tool)\b/.test(label)) {
        return 'utility';
    }
    return 'cash';
};

const getHudRecentActionLaneMap = (impact: VisualHudAnnouncementImpact | null): HudRecentActionLaneMapEntry[] => {
    if (!impact || impact.details.length === 0 || impact.burstTier === 'none') {
        return [];
    }
    const counts = new Map<HudRecentActionLaneId, number>();
    for (const detail of impact.details) {
        const id = getHudRecentActionLaneId(detail);
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return HUD_RECENT_ACTION_LANE_ORDER.filter((id) => counts.has(id)).map((id) => ({
        action: HUD_RECENT_ACTION_LANE_ACTIONS[id],
        count: counts.get(id) ?? 0,
        id,
        label: HUD_RECENT_ACTION_LANE_LABELS[id]
    }));
};

const getHudRecentActionLaneCueBadge = (
    lane: Pick<HudRecentActionLaneMapEntry, 'id'>
): HudRecentActionLaneCueBadge => {
    if (lane.id === 'route') {
        const cue = getTraitMarkerCueByShape('linked-route');
        return { glyph: cue.glyph, id: 'linked-route', label: 'Route' };
    }
    if (lane.id === 'chain') {
        const cue = getTraitMarkerCueByShape('payoff-stack');
        return { glyph: cue.glyph, id: 'payoff-stack', label: 'Stack' };
    }
    if (lane.id === 'utility') {
        const cue = getTraitMarkerCueByShape('perk-armed-bar');
        return { glyph: cue.glyph, id: 'perk-armed-bar', label: 'Tool' };
    }
    if (lane.id === 'recover') {
        return { glyph: '!!', id: 'recover-lane', label: 'Recover' };
    }
    const cue = getTraitMarkerCueByShape('payoff-bar');
    return { glyph: cue.glyph, id: 'cashout-crown', label: 'Cashout' };
};

const getHudRecentActionLaneBeatCount = (lane: Pick<HudRecentActionLaneMapEntry, 'id'>): 2 | 3 | 4 => {
    if (lane.id === 'cash') {
        return 4;
    }
    if (lane.id === 'route' || lane.id === 'chain') {
        return 3;
    }
    return 2;
};

const getHudRecentActionLaneAudioCue = (
    lane: Pick<HudRecentActionLaneMapEntry, 'id'>
): HudRecentActionLaneAudioCue => {
    if (lane.id === 'route') {
        return 'hud-action-route';
    }
    if (lane.id === 'chain') {
        return 'hud-action-chain';
    }
    if (lane.id === 'utility') {
        return 'hud-action-utility';
    }
    if (lane.id === 'recover') {
        return 'hud-action-recover';
    }
    return 'hud-action-cash';
};

const getHudRecentActionLaneScreenCue = (
    lane: Pick<HudRecentActionLaneMapEntry, 'id'>
): HudRecentActionLaneScreenCue => {
    if (lane.id === 'cash') {
        return 'burst';
    }
    if (lane.id === 'utility') {
        return 'guard';
    }
    if (lane.id === 'recover') {
        return 'recover';
    }
    return 'pulse';
};

const decorateHudRecentActionLane = (lane: HudRecentActionLaneMapEntry): HudRecentActionLaneRow => {
    const cueBadge = getHudRecentActionLaneCueBadge(lane);
    const beatCount = getHudRecentActionLaneBeatCount(lane);
    const countLabel = `${lane.count} ${lane.count === 1 ? 'lane' : 'lanes'}`;

    return {
        ...lane,
        ariaLabel: `Recent action lane. ${lane.label}. ${cueBadge.label} cue ${cueBadge.glyph}. ${lane.action}. ${countLabel}. ${beatCount} beats.`,
        audioCue: getHudRecentActionLaneAudioCue(lane),
        beatCount,
        countLabel,
        cueBadge,
        mapLabel: `${lane.label}. ${cueBadge.label} cue ${cueBadge.glyph}. ${countLabel}. ${lane.action}.`,
        primaryAriaLabel: `Primary recent action lane. ${lane.label}. ${cueBadge.label} cue ${cueBadge.glyph}. ${lane.action}. ${countLabel}. ${beatCount} beats.`,
        screenCue: getHudRecentActionLaneScreenCue(lane),
        summaryLead: `${lane.label} ${lane.action}`,
        summaryLeadLabel: `${cueBadge.label} cue ${cueBadge.glyph}. ${lane.label}: ${lane.action}`
    };
};

const getHudRecentActionStackLabel = (impact: VisualHudAnnouncementImpact | null): string | null => {
    if (!impact || impact.details.length < 2 || impact.burstTier === 'none') {
        return null;
    }
    if (impact.burstTier === 'combo') {
        return `${impact.details.length}x combo`;
    }
    if (impact.burstTier === 'reward') {
        return `${impact.details.length}x reward`;
    }
    if (impact.burstTier === 'trait') {
        return `${impact.details.length}x trait`;
    }
    if (impact.burstTier === 'chain') {
        return `${impact.details.length}x chain`;
    }
    return `${impact.details.length}x risk`;
};

const getHudRecentActionStackSummary = (impact: VisualHudAnnouncementImpact | null): HudRecentActionStackSummary | null => {
    if (!impact || impact.details.length < 2 || impact.burstTier === 'none') {
        return null;
    }
    const meaningfulDetails = impact.details.filter((detail) => detail.label !== 'Streak live');
    const uniqueLabels = [
        ...new Set((meaningfulDetails.length >= 2 ? meaningfulDetails : impact.details).map((detail) => detail.label))
    ].slice(0, 4);
    if (uniqueLabels.length < 2) {
        return null;
    }
    const hasSuperStack = uniqueLabels.includes('Super stack');
    const stackCashoutLaneCount = getStackCashoutLaneCount(uniqueLabels);
    const label = hasSuperStack
        ? 'Super stack'
        : stackCashoutLaneCount >= 2
          ? 'Stack cashout'
          : impact.burstTier === 'risk'
            ? 'Risk stack'
            : impact.burstTier === 'combo'
              ? 'Payoff stack'
              : impact.burstTier === 'reward'
                ? 'Reward stack'
                : impact.burstTier === 'trait'
                  ? 'Trait stack'
                  : 'Chain stack';
    const nextCue = hasSuperStack
        ? 'First: cash the super stack'
        : impact.burstTier === 'risk'
          ? 'First: recover control'
          : impact.burstTier === 'combo'
            ? 'First: cash out safest payoff'
            : impact.burstTier === 'reward'
              ? 'First: keep streak alive'
              : impact.burstTier === 'trait'
                ? 'First: look for the next trait route'
                : 'First: protect the chain';
    const thenCue = hasSuperStack
        ? 'Then: rebuild the next stack'
        : impact.burstTier === 'risk'
          ? 'Then: rebuild with a safe match'
          : impact.burstTier === 'combo'
            ? 'Then: route the chained payoff'
            : impact.burstTier === 'reward'
              ? 'Then: bank the next threshold'
              : impact.burstTier === 'trait'
                ? 'Then: convert adjacent traits'
                : 'Then: match a safe follow-up';
    const keepCue = hasSuperStack
        ? 'Keep: chain before spending'
        : impact.burstTier === 'risk'
          ? 'Keep: stop the chain break'
          : impact.burstTier === 'combo'
            ? 'Keep: stack before spending'
            : impact.burstTier === 'reward'
              ? 'Keep: streak stays hot'
              : impact.burstTier === 'trait'
                ? 'Keep: route chain alive'
                : 'Keep: protect momentum';
    const tone =
        hasSuperStack || stackCashoutLaneCount >= 2
            ? 'cashout'
            : impact.burstTier === 'risk'
              ? 'risk'
              : impact.burstTier === 'trait'
                ? 'trait'
                : impact.burstTier === 'reward'
                  ? 'reward'
                  : 'build';
    const action = hasSuperStack
        ? 'Cash super stack'
        : tone === 'cashout'
          ? 'Cash now'
          : tone === 'risk'
            ? 'Recover'
            : tone === 'trait'
              ? 'Route next'
              : tone === 'reward'
                ? 'Keep streak'
                : 'Prime';

    return { action, firstCue: nextCue, keepCue, label, nextCue, thenCue, tone, value: uniqueLabels.join(' + ') };
};

export const buildHudRecentActionFeedbackModel = (
    impact: VisualHudAnnouncementImpact | null
): HudRecentActionFeedbackModel => {
    const impactCue = getHudRecentActionImpactCue(impact);
    const laneRows = getHudRecentActionLaneMap(impact).map(decorateHudRecentActionLane);
    const stackLabel = getHudRecentActionStackLabel(impact);
    const stackSummary = getHudRecentActionStackSummary(impact);

    return {
        impactBeatCount: getHudRecentActionImpactBeatCount(impact),
        impactCue,
        impactCueBadge: getHudRecentActionImpactCueBadge(impactCue),
        impactScreenCue: getHudRecentActionImpactScreenCue(impactCue),
        laneActionMapAttr: laneRows.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') || 'none',
        laneMapAttr: laneRows.map((lane) => `${lane.id}:${lane.count}`).join('>') || 'none',
        laneMapLabel: laneRows.length > 0 ? `Lane map. ${laneRows.map((lane) => lane.mapLabel).join(' ')}` : null,
        laneRows,
        primaryLane: laneRows[0] ?? null,
        stackLabel,
        stackSummary
    };
};
