import styles from './GameScreen.module.css';
import { getStackCashoutLaneCount, type VisualHudAnnouncementDetail } from './gameScreenFeedback';
import type { MatchScorePop, MatchScorePopCrescendo } from '../store/matchScorePop';

interface GameScreenActionFeedbackRailProps {
    burstTier?: 'none' | 'chain' | 'reward' | 'combo' | 'risk' | 'trait';
    crescendo?: MatchScorePop['crescendo'] | null;
    details?: VisualHudAnnouncementDetail[];
    followup: string | null;
    label: string;
    message: string;
    intensity?: 'low' | 'medium' | 'high';
    signal?: {
        label: string;
        tone: string;
    } | null;
    tone: 'error' | 'info';
}

type ActionFeedbackLaneId = 'cash' | 'route' | 'chain' | 'trait' | 'recover';
type ActionFeedbackLaneRoleId = 'cashout' | 'protect' | 'recover' | 'route' | 'trait';

type ActionFeedbackLaneMapEntry = {
    id: ActionFeedbackLaneId;
    label: 'Cash' | 'Route' | 'Chain' | 'Trait' | 'Recover';
    count: number;
    action: 'Cash now' | 'Route next' | 'Protect streak' | 'Cash trait' | 'Recover';
    cue: string;
};

const ACTION_FEEDBACK_LANE_ORDER: ActionFeedbackLaneId[] = ['cash', 'route', 'chain', 'trait', 'recover'];

const ACTION_FEEDBACK_LANE_LABELS: Record<ActionFeedbackLaneId, ActionFeedbackLaneMapEntry['label']> = {
    cash: 'Cash',
    chain: 'Chain',
    recover: 'Recover',
    route: 'Route',
    trait: 'Trait'
};

const actionFeedbackLaneId = (detail: VisualHudAnnouncementDetail): ActionFeedbackLaneId => {
    const normalized = detail.label.toLowerCase();
    if (detail.tone === 'risk') {
        return 'recover';
    }
    if (normalized.includes('route')) {
        return 'route';
    }
    if (detail.tone === 'trait' || normalized.includes('perk')) {
        return 'trait';
    }
    if (
        detail.tone === 'chain' ||
        normalized.includes('chain') ||
        normalized.includes('one-away') ||
        normalized.includes('setup') ||
        normalized.includes('prime')
    ) {
        return 'chain';
    }
    return 'cash';
};

const actionFeedbackLaneAction = (
    laneId: ActionFeedbackLaneId
): ActionFeedbackLaneMapEntry['action'] => {
    if (laneId === 'route') {
        return 'Route next';
    }
    if (laneId === 'chain') {
        return 'Protect streak';
    }
    if (laneId === 'trait') {
        return 'Cash trait';
    }
    if (laneId === 'recover') {
        return 'Recover';
    }
    return 'Cash now';
};

const actionFeedbackLaneMap = (
    details: readonly VisualHudAnnouncementDetail[]
): ActionFeedbackLaneMapEntry[] | null => {
    if (details.length < 2) {
        return null;
    }
    const laneState = new Map<ActionFeedbackLaneId, { count: number; cue: string }>();
    details.forEach((detail) => {
        const laneId = actionFeedbackLaneId(detail);
        const state = laneState.get(laneId);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(laneId, { count: 1, cue: detail.label });
    });
    const lanes = ACTION_FEEDBACK_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        return state
            ? [
                  {
                      id,
                      action: actionFeedbackLaneAction(id),
                      label: ACTION_FEEDBACK_LANE_LABELS[id],
                      count: state.count,
                      cue: state.cue
                  }
              ]
            : [];
    });
    return lanes.length >= 2 ? lanes : null;
};

const actionFeedbackLaneMapAttr = (laneMap: readonly ActionFeedbackLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${lane.count}`).join('>') ?? 'none';

const actionFeedbackLaneActionMapAttr = (laneMap: readonly ActionFeedbackLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') ?? 'none';

const actionFeedbackLaneRole = (lane: ActionFeedbackLaneMapEntry): 'Cashout' | 'Protect' | 'Recover' | 'Route' | 'Trait' => {
    if (lane.id === 'cash') {
        return 'Cashout';
    }
    if (lane.id === 'chain') {
        return 'Protect';
    }
    if (lane.id === 'recover') {
        return 'Recover';
    }
    if (lane.id === 'trait') {
        return 'Trait';
    }
    return 'Route';
};

const actionFeedbackLaneRoleId = (lane: ActionFeedbackLaneMapEntry | null): ActionFeedbackLaneRoleId | null => {
    if (!lane) {
        return null;
    }
    if (lane.id === 'cash') {
        return 'cashout';
    }
    if (lane.id === 'chain') {
        return 'protect';
    }
    if (lane.id === 'recover') {
        return 'recover';
    }
    if (lane.id === 'trait') {
        return 'trait';
    }
    return 'route';
};

const actionFeedbackLaneRoleMapAttr = (laneMap: readonly ActionFeedbackLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${actionFeedbackLaneRole(lane)}:${lane.count}`).join('>') ?? 'none';

const actionFeedbackLaneRoleIdMapAttr = (laneMap: readonly ActionFeedbackLaneMapEntry[] | null): string =>
    laneMap?.map((lane) => `${lane.id}:${actionFeedbackLaneRoleId(lane)}:${lane.count}`).join('>') ?? 'none';

const actionFeedbackLaneMapLabel = (laneMap: readonly ActionFeedbackLaneMapEntry[] | null): string =>
    laneMap?.length
        ? `Action lane map. ${laneMap.map((lane) => `${lane.label} ${actionFeedbackLaneRole(lane)} x${lane.count}. ${lane.action}. ${lane.cue}.`).join(' ')}`
        : '';

const actionFeedbackLaneBeatCount = (lane: ActionFeedbackLaneMapEntry): 2 | 3 | 4 => {
    if (lane.id === 'cash' || lane.id === 'route') {
        return lane.count > 1 ? 4 : 3;
    }
    if (lane.id === 'chain' || lane.id === 'trait') {
        return 3;
    }
    return 2;
};

const actionFeedbackLaneAudioCue = (
    lane: ActionFeedbackLaneMapEntry
): 'feedback-cash-lane' | 'feedback-chain-lane' | 'feedback-recover-lane' | 'feedback-route-lane' | 'feedback-trait-lane' => {
    if (lane.id === 'route') {
        return 'feedback-route-lane';
    }
    if (lane.id === 'chain') {
        return 'feedback-chain-lane';
    }
    if (lane.id === 'trait') {
        return 'feedback-trait-lane';
    }
    if (lane.id === 'recover') {
        return 'feedback-recover-lane';
    }
    return 'feedback-cash-lane';
};

const actionFeedbackLaneScreenCue = (
    lane: ActionFeedbackLaneMapEntry
): 'burst' | 'guard' | 'pulse' | 'recover' | 'route' => {
    if (lane.id === 'cash') {
        return 'burst';
    }
    if (lane.id === 'route') {
        return 'route';
    }
    if (lane.id === 'chain') {
        return 'pulse';
    }
    if (lane.id === 'recover') {
        return 'recover';
    }
    return 'guard';
};

const followupTone = (followup: string | null): 'chain' | 'reward' | 'risk' | 'info' => {
    const normalized = followup?.toLowerCase() ?? '';
    if (!normalized) {
        return 'info';
    }
    if (/\b(risky|risk|protect|rebuild|recover|unsafe|danger|last life)\b/.test(normalized)) {
        return 'risk';
    }
    if (/\b(cashout|reward|banked|streak|chainable|payoff)\b/.test(normalized)) {
        return normalized.includes('streak') || normalized.includes('chainable') ? 'chain' : 'reward';
    }
    return 'info';
};

const stackBadgeLabel = (
    burstTier: NonNullable<GameScreenActionFeedbackRailProps['burstTier']>,
    details: readonly VisualHudAnnouncementDetail[]
): string | null => {
    if (details.length < 2 || burstTier === 'none') {
        return null;
    }
    if (burstTier === 'combo') {
        return `${details.length}x combo`;
    }
    if (burstTier === 'reward') {
        return `${details.length}x reward`;
    }
    if (burstTier === 'trait') {
        return `${details.length}x trait`;
    }
    if (burstTier === 'chain') {
        return `${details.length}x chain`;
    }
    return `${details.length}x risk`;
};

const stackSummary = (
    burstTier: NonNullable<GameScreenActionFeedbackRailProps['burstTier']>,
    details: readonly VisualHudAnnouncementDetail[],
    followup: string | null
): { action: string; label: string; nextCue: string; tone: 'cashout' | 'build' | 'risk' | 'trait' | 'reward'; value: string } | null => {
    if (details.length < 2 || burstTier === 'none') {
        return null;
    }
    const meaningfulDetails = details.filter((detail) => detail.label !== 'Streak live');
    const uniqueLabels = [...new Set((meaningfulDetails.length >= 2 ? meaningfulDetails : details).map((detail) => detail.label))].slice(0, 4);
    if (uniqueLabels.length < 2) {
        return null;
    }
    const hasSuperStack = uniqueLabels.includes('Super stack');
    const stackCashoutLaneCount = getStackCashoutLaneCount(uniqueLabels);
    const label =
        hasSuperStack
            ? 'Super stack'
            : stackCashoutLaneCount >= 2
            ? 'Stack cashout'
            : burstTier === 'risk'
            ? 'Risk stack'
            : burstTier === 'combo'
              ? 'Payoff stack'
              : burstTier === 'reward'
                ? 'Reward stack'
                : burstTier === 'trait'
                  ? 'Trait stack'
                  : 'Chain stack';
    const fallbackNextCue =
        burstTier === 'risk'
            ? 'Recover control'
            : burstTier === 'combo'
              ? 'Cash out safest payoff'
              : burstTier === 'reward'
                ? 'Keep streak alive'
                : burstTier === 'trait'
                  ? 'Look for the next trait route'
                  : 'Protect the chain';
    const tone =
        hasSuperStack || stackCashoutLaneCount >= 2
            ? 'cashout'
            : burstTier === 'risk'
              ? 'risk'
              : burstTier === 'trait'
                ? 'trait'
                : burstTier === 'reward'
                  ? 'reward'
                  : 'build';
    const action =
        hasSuperStack
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
    return { action, label, nextCue: followup ?? `Next: ${fallbackNextCue}.`, tone, value: uniqueLabels.join(' + ') };
};

const actionFeedbackImpactCue = (
    burstTier: NonNullable<GameScreenActionFeedbackRailProps['burstTier']>,
    details: readonly VisualHudAnnouncementDetail[],
    followup: string | null
): { label: string; tone: 'chain' | 'reward' | 'combo' | 'risk' | 'trait' | 'info' } => {
    const detailLabels = details.map((detail) => detail.label.toLowerCase());
    const normalizedFollowup = followup?.toLowerCase() ?? '';
    if (burstTier !== 'combo' && detailLabels.some((label) => label.includes('perk pop'))) {
        return { label: 'Perk pop', tone: 'trait' };
    }
    if (burstTier !== 'combo' && detailLabels.some((label) => label.includes('trait cashout'))) {
        return { label: 'Trait cashout', tone: 'trait' };
    }
    if (burstTier === 'risk') {
        if (detailLabels.some((label) => label.includes('lost reward')) || normalizedFollowup.includes('lost reward')) {
            return { label: 'Save cashout', tone: 'risk' };
        }
        if (detailLabels.some((label) => label.includes('chain break')) || normalizedFollowup.includes('rebuild')) {
            return { label: 'Rebuild chain', tone: 'risk' };
        }
        return { label: 'Recover lane', tone: 'risk' };
    }
    if (burstTier === 'combo') {
        if (detailLabels.some((label) => label.includes('super stack'))) {
            return { label: 'Super stack', tone: 'combo' };
        }
        if (detailLabels.some((label) => label.includes('stack cashout'))) {
            return { label: 'Stack cashout', tone: 'combo' };
        }
        const structuralStackLaneCount = getStackCashoutLaneCount(details.map((detail) => detail.label));
        if (structuralStackLaneCount >= 2) {
            return { label: 'Stack cashout', tone: 'combo' };
        }
        if (
            detailLabels.some(
                (label) =>
                    label.includes('cashout armed') ||
                    label.includes('one-away') ||
                    label.includes('shard cashout') ||
                    label.includes('combo setup') ||
                    label.includes('guard setup') ||
                    label.includes('heal setup') ||
                    label.includes('combo prime') ||
                    label.includes('guard prime') ||
                    label.includes('heal prime')
            ) ||
            normalizedFollowup.includes('build the cashout') ||
            normalizedFollowup.includes('prime the cashout')
        ) {
            return { label: 'Prime cashout', tone: 'combo' };
        }
        if (detailLabels.some((label) => label.includes('combo cascade'))) {
            return { label: 'Combo cashout', tone: 'combo' };
        }
        return { label: 'Payoff stack', tone: 'combo' };
    }
    if (burstTier === 'reward') {
        return {
            label: detailLabels.some((label) => label.includes('pickup cashout'))
                ? 'Pickup cashout'
                : detailLabels.some((label) => label.includes('cashout armed'))
                  ? 'Cashout armed'
                  : detailLabels.some((label) => label.includes('one-away'))
                  ? 'Cashout ready'
                  : 'Reward cashout',
            tone: 'reward'
        };
    }
    if (burstTier === 'trait') {
        return { label: detailLabels.some((label) => label.includes('surge')) ? 'Trait surge' : 'Trait cashout', tone: 'trait' };
    }
    if (burstTier === 'chain') {
        return {
            label:
                detailLabels.some((label) => label.includes('one-away')) ||
                normalizedFollowup.includes('cashout') ||
                normalizedFollowup.includes('reward')
                    ? 'Prime cashout'
                    : 'Keep streak',
            tone: 'chain'
        };
    }
    if (normalizedFollowup.includes('exit is ready')) {
        return { label: 'Exit ready', tone: 'reward' };
    }
    return { label: 'Next move', tone: 'info' };
};

const actionFeedbackTempoCue = (
    burstTier: NonNullable<GameScreenActionFeedbackRailProps['burstTier']>,
    impactCue: ReturnType<typeof actionFeedbackImpactCue>
): { label: 'Now' | 'Next' | 'Fix'; value: string; tone: 'combo' | 'reward' | 'chain' | 'trait' | 'risk' | 'info' } => {
    if (impactCue.label === 'Perk pop') {
        return { label: 'Now', value: 'Cash perk', tone: 'trait' };
    }
    if (impactCue.label === 'Trait cashout') {
        return { label: 'Now', value: 'Cash trait', tone: 'trait' };
    }
    if (burstTier === 'combo') {
        return { label: 'Now', value: impactCue.label.includes('cashout') ? 'Cash combo' : 'Route combo', tone: 'combo' };
    }
    if (burstTier === 'reward') {
        return { label: 'Now', value: impactCue.label.includes('cashout') ? 'Cash reward' : 'Prime reward', tone: 'reward' };
    }
    if (burstTier === 'chain') {
        return { label: 'Next', value: impactCue.label.includes('cashout') ? 'Cash soon' : 'Protect streak', tone: 'chain' };
    }
    if (burstTier === 'trait') {
        return {
            label: 'Now',
            value: impactCue.label.includes('Perk')
                ? 'Cash perk'
                : impactCue.label.includes('cashout')
                  ? 'Cash trait'
                  : impactCue.label.includes('surge')
                    ? 'Route surge'
                    : 'Route trait',
            tone: 'trait'
        };
    }
    if (burstTier === 'risk') {
        return { label: 'Fix', value: impactCue.label.includes('cashout') ? 'Save payoff' : 'Recover', tone: 'risk' };
    }
    return { label: 'Next', value: impactCue.label, tone: 'info' };
};

const actionFeedbackTempoBeat = (
    tempoCue: ReturnType<typeof actionFeedbackTempoCue>
): { beatCount: 2 | 3 | 4 | 5; cadence: 'cashout' | 'prime' | 'sustain' | 'recover'; label: string } => {
    if (tempoCue.tone === 'combo') {
        return { beatCount: 5, cadence: 'cashout', label: 'Combo snap' };
    }
    if (tempoCue.tone === 'reward' || tempoCue.tone === 'trait') {
        return { beatCount: 4, cadence: 'cashout', label: 'Cashout pulse' };
    }
    if (tempoCue.tone === 'chain') {
        return { beatCount: 3, cadence: 'sustain', label: 'Streak pulse' };
    }
    if (tempoCue.tone === 'risk') {
        return { beatCount: 2, cadence: 'recover', label: 'Recovery pulse' };
    }
    return { beatCount: 2, cadence: 'prime', label: 'Prime pulse' };
};

const actionFeedbackImpactAction = (
    impactCue: ReturnType<typeof actionFeedbackImpactCue>
): 'Cash now' | 'Cash trait' | 'Confirm exit' | 'Inspect' | 'Prime route' | 'Protect streak' | 'Recover' | 'Route next' => {
    if (impactCue.tone === 'risk') {
        return 'Recover';
    }
    if (impactCue.label === 'Exit ready') {
        return 'Confirm exit';
    }
    if (impactCue.label === 'Perk pop' || impactCue.label === 'Trait cashout') {
        return 'Cash trait';
    }
    if (impactCue.tone === 'combo' || impactCue.tone === 'reward') {
        return impactCue.label.toLowerCase().includes('prime') ? 'Prime route' : 'Cash now';
    }
    if (impactCue.tone === 'chain') {
        return impactCue.label.toLowerCase().includes('cashout') ? 'Prime route' : 'Protect streak';
    }
    if (impactCue.tone === 'trait') {
        return 'Route next';
    }
    return 'Inspect';
};

const actionFeedbackImpactAudioCue = (
    impactCue: ReturnType<typeof actionFeedbackImpactCue>
): 'action-cashout' | 'action-exit' | 'action-info' | 'action-prime' | 'action-recover' | 'action-trait' => {
    if (impactCue.tone === 'risk') {
        return 'action-recover';
    }
    if (impactCue.label === 'Exit ready') {
        return 'action-exit';
    }
    if (impactCue.tone === 'trait') {
        return 'action-trait';
    }
    if (impactCue.tone === 'combo' || impactCue.tone === 'reward') {
        return impactCue.label.toLowerCase().includes('prime') ? 'action-prime' : 'action-cashout';
    }
    if (impactCue.tone === 'chain') {
        return 'action-prime';
    }
    return 'action-info';
};

const actionFeedbackImpactScreenCue = (
    impactCue: ReturnType<typeof actionFeedbackImpactCue>
): 'burst' | 'guard' | 'pulse' | 'snap' | 'tick' => {
    if (impactCue.tone === 'risk') {
        return 'guard';
    }
    if (impactCue.tone === 'combo' || impactCue.label.toLowerCase().includes('cashout')) {
        return 'burst';
    }
    if (impactCue.tone === 'reward' || impactCue.tone === 'trait') {
        return 'snap';
    }
    if (impactCue.tone === 'chain') {
        return 'pulse';
    }
    return 'tick';
};

const actionFeedbackTempoAudioCue = (
    tempoCue: ReturnType<typeof actionFeedbackTempoCue>
): 'tempo-cashout' | 'tempo-prime' | 'tempo-recover' | 'tempo-streak' | 'tempo-trait' => {
    if (tempoCue.tone === 'risk') {
        return 'tempo-recover';
    }
    if (tempoCue.tone === 'chain') {
        return 'tempo-streak';
    }
    if (tempoCue.tone === 'trait') {
        return 'tempo-trait';
    }
    if (tempoCue.tone === 'combo' || tempoCue.tone === 'reward') {
        return 'tempo-cashout';
    }
    return 'tempo-prime';
};

const actionFeedbackTempoScreenCue = (
    tempoCue: ReturnType<typeof actionFeedbackTempoCue>
): 'burst' | 'guard' | 'pulse' | 'snap' | 'tick' => {
    if (tempoCue.tone === 'risk') {
        return 'guard';
    }
    if (tempoCue.tone === 'combo') {
        return 'burst';
    }
    if (tempoCue.tone === 'reward' || tempoCue.tone === 'trait') {
        return 'snap';
    }
    if (tempoCue.tone === 'chain') {
        return 'pulse';
    }
    return 'tick';
};

const cleanFollowupCue = (followup: string | null): string | null => {
    const cleaned = followup?.replace(/^Next:\s*/i, '').replace(/\.$/, '').trim() ?? '';
    return cleaned || null;
};

const actionFeedbackSequenceCue = ({
    burstTier,
    followup,
    impactCue,
    stackRead,
    tempoCue
}: {
    burstTier: NonNullable<GameScreenActionFeedbackRailProps['burstTier']>;
    followup: string | null;
    impactCue: ReturnType<typeof actionFeedbackImpactCue>;
    stackRead: ReturnType<typeof stackSummary>;
    tempoCue: ReturnType<typeof actionFeedbackTempoCue>;
}): { first: string; keep: string; then: string; tone: 'combo' | 'reward' | 'chain' | 'trait' | 'risk' | 'info' } | null => {
    if (burstTier === 'none' && !followup) {
        return null;
    }
    const followupCue = cleanFollowupCue(followup);
    if (burstTier === 'risk') {
        return {
            first: impactCue.label,
            keep: followupCue ?? 'recover with a safe match',
            then: tempoCue.value,
            tone: 'risk'
        };
    }
    if (stackRead) {
        return {
            first: stackRead.action,
            keep: followupCue ?? stackRead.nextCue.replace(/^Next:\s*/i, '').replace(/\.$/, ''),
            then: tempoCue.value,
            tone: tempoCue.tone
        };
    }
    if (burstTier === 'combo' || burstTier === 'reward' || burstTier === 'chain' || burstTier === 'trait') {
        return {
            first: impactCue.label,
            keep: followupCue ?? (burstTier === 'chain' ? 'protect the chain' : 'look for the next payoff'),
            then: tempoCue.value,
            tone: tempoCue.tone
        };
    }
    return followupCue ? { first: impactCue.label, keep: followupCue, then: tempoCue.value, tone: 'info' } : null;
};

const actionFeedbackDetailKind = (label: string): string =>
    label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'detail';

const actionFeedbackBuildAction = (
    burstTier: NonNullable<GameScreenActionFeedbackRailProps['burstTier']>
): string => {
    if (burstTier === 'trait') {
        return 'Route next';
    }
    if (burstTier === 'reward') {
        return 'Cash reward';
    }
    if (burstTier === 'chain') {
        return 'Protect streak';
    }
    return 'Route combo';
};

const actionFeedbackPayoffIntensity = ({
    burstTier,
    details,
    impactCue,
    stackRead
}: {
    burstTier: NonNullable<GameScreenActionFeedbackRailProps['burstTier']>;
    details: readonly VisualHudAnnouncementDetail[];
    impactCue: ReturnType<typeof actionFeedbackImpactCue>;
    stackRead: ReturnType<typeof stackSummary>;
}): { action: string; count: number; id: 'build' | 'cashout' | 'none' | 'prime' | 'risk' | 'stack' | 'surge'; label: string } => {
    if (burstTier === 'none') {
        return { action: 'Keep matching', count: 0, id: 'none', label: 'None' };
    }
    const count = Math.max(1, details.length);
    const hasTraitSurge = impactCue.label === 'Trait surge' || details.some((detail) => detail.label === 'Trait surge');
    if (impactCue.label === 'Prime cashout') {
        return { action: 'Prime route', count, id: 'prime', label: 'Prime' };
    }
    if (stackRead) {
        if (stackRead.label === 'Super stack' || (burstTier === 'combo' && stackRead.label === 'Stack cashout')) {
            return { action: 'Cash stack', count, id: 'stack', label: 'Stack' };
        }
        if (stackRead.tone === 'cashout') {
            return { action: 'Hit now', count, id: 'cashout', label: 'Cashout' };
        }
        if (stackRead.tone === 'risk') {
            return { action: 'Recover', count, id: 'risk', label: 'Risk' };
        }
        if (hasTraitSurge) {
            return { action: 'Chain routes', count, id: 'surge', label: 'Surge' };
        }
        return { action: stackRead.action, count, id: 'build', label: 'Prime' };
    }
    if (hasTraitSurge) {
        return { action: 'Chain routes', count, id: 'surge', label: 'Surge' };
    }
    if (impactCue.label.toLowerCase().includes('cashout')) {
        return { action: 'Hit now', count, id: 'cashout', label: 'Cashout' };
    }
    if (burstTier === 'risk') {
        return { action: 'Recover', count, id: 'risk', label: 'Risk' };
    }
    return { action: actionFeedbackBuildAction(burstTier), count, id: 'build', label: 'Prime' };
};

const actionFeedbackCrescendoTone = (
    crescendo: NonNullable<GameScreenActionFeedbackRailProps['crescendo']>
): 'chain' | 'combo' | 'reward' | 'score' => {
    if (crescendo.tier === 'super' || crescendo.tier === 'stack') {
        return 'combo';
    }
    if (crescendo.tier === 'cashout') {
        return 'reward';
    }
    if (crescendo.tier === 'prime') {
        return 'chain';
    }
    return 'score';
};

const actionFeedbackDerivedCrescendo = (
    payoffIntensity: ReturnType<typeof actionFeedbackPayoffIntensity>
): NonNullable<GameScreenActionFeedbackRailProps['crescendo']> | null => {
    if (payoffIntensity.id === 'stack') {
        const superStack = payoffIntensity.count >= 4;
        return {
            audioCue: superStack ? 'super-burst' : 'stack-burst',
            beatCount: superStack ? 5 : 4,
            detail: `${payoffIntensity.count} payoff signals`,
            label: superStack ? 'Super burst' : 'Stack burst',
            screenCue: superStack ? 'super' : 'burst',
            tier: superStack ? 'super' : 'stack'
        };
    }
    if (payoffIntensity.id === 'cashout') {
        return {
            audioCue: 'cashout-pop',
            beatCount: 3,
            detail: payoffIntensity.action,
            label: 'Cashout beat',
            screenCue: 'snap',
            tier: 'cashout'
        };
    }
    if (payoffIntensity.id === 'prime' || payoffIntensity.id === 'build' || payoffIntensity.id === 'surge') {
        return {
            audioCue: 'prime-pop',
            beatCount: 2,
            detail: payoffIntensity.action,
            label: 'Prime beat',
            screenCue: 'pulse',
            tier: 'prime'
        };
    }
    return null;
};

const actionFeedbackPayoffBeatCount = (
    payoffIntensity: ReturnType<typeof actionFeedbackPayoffIntensity>,
    displayedCrescendo: NonNullable<GameScreenActionFeedbackRailProps['crescendo']> | null
): 0 | 1 | 2 | 3 | 4 | 5 => {
    if (payoffIntensity.id === 'none') {
        return 0;
    }
    if (displayedCrescendo) {
        return displayedCrescendo.beatCount;
    }
    if (payoffIntensity.id === 'risk') {
        return 2;
    }
    return 2;
};

const actionFeedbackPayoffAudioCue = (
    payoffIntensity: ReturnType<typeof actionFeedbackPayoffIntensity>,
    displayedCrescendo: NonNullable<GameScreenActionFeedbackRailProps['crescendo']> | null
): MatchScorePopCrescendo['audioCue'] | 'risk-recover' | 'silent' => {
    if (displayedCrescendo) {
        return displayedCrescendo.audioCue;
    }
    if (payoffIntensity.id === 'risk') {
        return 'risk-recover';
    }
    if (payoffIntensity.id === 'none') {
        return 'silent';
    }
    return 'prime-pop';
};

const actionFeedbackPayoffScreenCue = (
    payoffIntensity: ReturnType<typeof actionFeedbackPayoffIntensity>,
    displayedCrescendo: NonNullable<GameScreenActionFeedbackRailProps['crescendo']> | null
): MatchScorePopCrescendo['screenCue'] | 'guard' | 'none' => {
    if (displayedCrescendo) {
        return displayedCrescendo.screenCue;
    }
    if (payoffIntensity.id === 'risk') {
        return 'guard';
    }
    if (payoffIntensity.id === 'none') {
        return 'none';
    }
    return 'pulse';
};

export const GameScreenActionFeedbackRail = ({
    burstTier = 'none',
    crescendo = null,
    details = [],
    followup,
    intensity = 'low',
    label,
    message,
    signal,
    tone
}: GameScreenActionFeedbackRailProps) => {
    const stackLabel = stackBadgeLabel(burstTier, details);
    const stackRead = stackSummary(burstTier, details, followup);
    const impactCue = actionFeedbackImpactCue(burstTier, details, followup);
    const tempoCue = actionFeedbackTempoCue(burstTier, impactCue);
    const tempoBeat = actionFeedbackTempoBeat(tempoCue);
    const sequenceCue = actionFeedbackSequenceCue({ burstTier, followup, impactCue, stackRead, tempoCue });
    const payoffIntensity = actionFeedbackPayoffIntensity({ burstTier, details, impactCue, stackRead });
    const displayedCrescendo = crescendo ?? actionFeedbackDerivedCrescendo(payoffIntensity);
    const payoffBeatCount = actionFeedbackPayoffBeatCount(payoffIntensity, displayedCrescendo);
    const impactAction = actionFeedbackImpactAction(impactCue);
    const impactAudioCue = actionFeedbackImpactAudioCue(impactCue);
    const impactScreenCue = actionFeedbackImpactScreenCue(impactCue);
    const payoffAudioCue = actionFeedbackPayoffAudioCue(payoffIntensity, displayedCrescendo);
    const payoffScreenCue = actionFeedbackPayoffScreenCue(payoffIntensity, displayedCrescendo);
    const tempoAudioCue = actionFeedbackTempoAudioCue(tempoCue);
    const tempoScreenCue = actionFeedbackTempoScreenCue(tempoCue);
    const laneMap = actionFeedbackLaneMap(details);
    const primaryLane = laneMap?.[0] ?? null;
    return (
        <div
            aria-hidden="true"
            className={styles.actionFeedbackRail}
            data-burst-tier={burstTier}
            data-action-feedback-impact-cue={impactCue.label}
            data-action-feedback-impact-action={impactAction}
            data-action-feedback-impact-audio={impactAudioCue}
            data-action-feedback-impact-screen-cue={impactScreenCue}
            data-action-feedback-lane-map={actionFeedbackLaneMapAttr(laneMap)}
            data-action-feedback-lane-actions={actionFeedbackLaneActionMapAttr(laneMap)}
            data-action-feedback-lane-roles={actionFeedbackLaneRoleMapAttr(laneMap)}
            data-action-feedback-lane-role-ids={actionFeedbackLaneRoleIdMapAttr(laneMap)}
            data-action-feedback-payoff-action={payoffIntensity.action}
            data-action-feedback-payoff-audio={payoffAudioCue}
            data-action-feedback-payoff-beats={payoffBeatCount}
            data-action-feedback-payoff-count={payoffIntensity.count}
            data-action-feedback-payoff-intensity={payoffIntensity.id}
            data-action-feedback-payoff-screen-cue={payoffScreenCue}
            data-action-feedback-crescendo-action={displayedCrescendo?.detail ?? 'none'}
            data-action-feedback-crescendo-audio={displayedCrescendo?.audioCue ?? 'none'}
            data-action-feedback-crescendo-beats={displayedCrescendo?.beatCount ?? 0}
            data-action-feedback-crescendo-cue={displayedCrescendo?.screenCue ?? 'none'}
            data-action-feedback-crescendo-screen-cue={displayedCrescendo?.screenCue ?? 'none'}
            data-action-feedback-crescendo-tier={displayedCrescendo?.tier ?? 'none'}
            data-action-feedback-sequence-first={sequenceCue?.first ?? 'none'}
            data-action-feedback-sequence-keep={sequenceCue?.keep ?? 'none'}
            data-action-feedback-sequence-then={sequenceCue?.then ?? 'none'}
            data-action-feedback-sequence-tone={sequenceCue?.tone ?? 'none'}
            data-action-feedback-tempo-beats={tempoBeat.beatCount}
            data-action-feedback-tempo-cadence={tempoBeat.cadence}
            data-action-feedback-tempo-action={tempoCue.value}
            data-action-feedback-tempo-audio={tempoAudioCue}
            data-action-feedback-tempo-cue={tempoCue.value}
            data-action-feedback-tempo-label={tempoBeat.label}
            data-action-feedback-tempo-screen-cue={tempoScreenCue}
            data-intensity={intensity}
            data-testid="action-feedback-rail"
            data-tone={tone}
        >
            <span className={styles.actionFeedbackHeader}>
                <span>{label}</span>
                {signal ? (
                    <span className={styles.actionFeedbackSignal} data-action-feedback-signal={signal.tone}>
                        {signal.label}
                    </span>
                ) : null}
                {stackLabel ? (
                    <span className={styles.actionFeedbackStackBadge} data-action-feedback-stack={burstTier}>
                        {stackLabel}
                    </span>
                ) : null}
                {payoffIntensity.id !== 'none' ? (
                    <span
                        className={styles.actionFeedbackPayoffIntensity}
                        data-action-feedback-payoff-action={payoffIntensity.action}
                        data-action-feedback-payoff-audio={payoffAudioCue}
                        data-action-feedback-payoff-beats={payoffBeatCount}
                        data-action-feedback-payoff-intensity={payoffIntensity.id}
                        data-action-feedback-payoff-screen-cue={payoffScreenCue}
                        data-testid="action-feedback-payoff-intensity"
                    >
                        <small>{payoffIntensity.count}</small>
                        <strong>{payoffIntensity.label}</strong>
                        <span aria-hidden="true" className={styles.actionFeedbackPayoffPips}>
                            {Array.from({ length: payoffBeatCount }, (_, beatIndex) => (
                                <i
                                    data-action-feedback-payoff-beat={beatIndex + 1}
                                    data-action-feedback-payoff-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    key={beatIndex}
                                />
                            ))}
                        </span>
                        <em>{payoffIntensity.action}</em>
                    </span>
                ) : null}
                {displayedCrescendo ? (
                    <span
                        className={styles.actionFeedbackCrescendo}
                        data-action-feedback-crescendo-action={displayedCrescendo.detail}
                        data-action-feedback-crescendo-audio={displayedCrescendo.audioCue}
                        data-action-feedback-crescendo-cue={displayedCrescendo.screenCue}
                        data-action-feedback-crescendo-screen-cue={displayedCrescendo.screenCue}
                        data-action-feedback-crescendo-tier={displayedCrescendo.tier}
                        data-action-feedback-crescendo-tone={actionFeedbackCrescendoTone(displayedCrescendo)}
                        data-testid="action-feedback-crescendo"
                    >
                        <small>{displayedCrescendo.beatCount} beat</small>
                        <span aria-hidden="true" className={styles.actionFeedbackCrescendoPips}>
                            {Array.from({ length: displayedCrescendo.beatCount }, (_, beatIndex) => (
                                <i
                                    data-action-feedback-crescendo-beat={beatIndex + 1}
                                    data-action-feedback-crescendo-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    key={beatIndex}
                                />
                            ))}
                        </span>
                        <strong>{displayedCrescendo.label}</strong>
                        <em>{displayedCrescendo.detail}</em>
                    </span>
                ) : null}
                <span
                    className={styles.actionFeedbackImpactCue}
                    data-action-feedback-impact-action={impactAction}
                    data-action-feedback-impact-audio={impactAudioCue}
                    data-action-feedback-impact-screen-cue={impactScreenCue}
                    data-action-feedback-impact-tone={impactCue.tone}
                    data-testid="action-feedback-impact-cue"
                >
                    {impactCue.label}
                    <em>{impactAction}</em>
                </span>
                <span
                    className={styles.actionFeedbackTempoCue}
                    data-action-feedback-tempo-action={tempoCue.value}
                    data-action-feedback-tempo-audio={tempoAudioCue}
                    data-action-feedback-tempo-beats={tempoBeat.beatCount}
                    data-action-feedback-tempo-cadence={tempoBeat.cadence}
                    data-action-feedback-tempo-label={tempoBeat.label}
                    data-action-feedback-tempo-screen-cue={tempoScreenCue}
                    data-action-feedback-tempo-tone={tempoCue.tone}
                    data-testid="action-feedback-tempo-cue"
                >
                    <small>{tempoCue.label}</small>
                    <strong>{tempoCue.value}</strong>
                    <span aria-hidden="true" className={styles.actionFeedbackTempoPips}>
                        {Array.from({ length: tempoBeat.beatCount }, (_, beatIndex) => (
                            <i
                                data-action-feedback-tempo-beat={beatIndex + 1}
                                data-action-feedback-tempo-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                key={beatIndex}
                            />
                        ))}
                    </span>
                    <em>{tempoBeat.label}</em>
                </span>
            </span>
            <strong>{message}</strong>
            {details.length > 0 ? (
                <span className={styles.actionFeedbackDetails} data-testid="action-feedback-details">
                    {details.map((detail) => (
                        <span
                            data-action-feedback-detail={detail.tone}
                            data-action-feedback-detail-kind={actionFeedbackDetailKind(detail.label)}
                            key={`${detail.tone}:${detail.label}`}
                        >
                            {detail.label}
                        </span>
                    ))}
                </span>
            ) : null}
            {laneMap ? (
                <span
                    aria-label={actionFeedbackLaneMapLabel(laneMap)}
                    className={styles.actionFeedbackLaneMap}
                    data-action-feedback-lane-actions={actionFeedbackLaneActionMapAttr(laneMap)}
                    data-action-feedback-lane-map={actionFeedbackLaneMapAttr(laneMap)}
                    data-action-feedback-lane-roles={actionFeedbackLaneRoleMapAttr(laneMap)}
                    data-action-feedback-lane-role-ids={actionFeedbackLaneRoleIdMapAttr(laneMap)}
                    data-action-feedback-primary-lane={primaryLane?.id ?? 'none'}
                    data-action-feedback-primary-lane-action={primaryLane?.action ?? 'none'}
                    data-action-feedback-primary-lane-audio={primaryLane ? actionFeedbackLaneAudioCue(primaryLane) : 'none'}
                    data-action-feedback-primary-lane-beats={primaryLane ? actionFeedbackLaneBeatCount(primaryLane) : 0}
                    data-action-feedback-primary-lane-cue={primaryLane?.cue ?? 'none'}
                    data-action-feedback-primary-lane-role={primaryLane ? actionFeedbackLaneRole(primaryLane) : 'none'}
                    data-action-feedback-primary-lane-role-id={actionFeedbackLaneRoleId(primaryLane) ?? 'none'}
                    data-action-feedback-primary-lane-screen-cue={primaryLane ? actionFeedbackLaneScreenCue(primaryLane) : 'none'}
                    data-testid="action-feedback-lane-map"
                >
                    <span
                        className={styles.actionFeedbackLaneMapSummary}
                        data-action-feedback-lane-count={laneMap.length}
                        data-testid="action-feedback-lane-map-summary"
                    >
                        <small>Lanes</small>
                        <b>
                            {laneMap.length} {laneMap.length === 1 ? 'lane' : 'lanes'}
                        </b>
                        <span aria-hidden="true" className={styles.actionFeedbackLaneMapSummaryBeatPips}>
                            {Array.from({ length: Math.max(2, Math.min(5, laneMap.length + 1)) }, (_, beatIndex) => (
                                <i
                                    data-action-feedback-lane-map-summary-beat={beatIndex + 1}
                                    data-action-feedback-lane-map-summary-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    key={beatIndex}
                                />
                            ))}
                        </span>
                    </span>
                    {primaryLane ? (
                        <span
                            aria-label={`Primary feedback lane. ${actionFeedbackLaneRole(primaryLane)} ${primaryLane.label}: ${primaryLane.action}. ${primaryLane.cue}. ${actionFeedbackLaneBeatCount(primaryLane)} beats.`}
                            className={styles.actionFeedbackPrimaryLaneCue}
                            data-action-feedback-primary-lane={primaryLane.id}
                            data-action-feedback-primary-lane-action={primaryLane.action}
                            data-action-feedback-primary-lane-audio={actionFeedbackLaneAudioCue(primaryLane)}
                            data-action-feedback-primary-lane-beats={actionFeedbackLaneBeatCount(primaryLane)}
                            data-action-feedback-primary-lane-cue={primaryLane.cue}
                            data-action-feedback-primary-lane-role={actionFeedbackLaneRole(primaryLane)}
                            data-action-feedback-primary-lane-role-id={actionFeedbackLaneRoleId(primaryLane) ?? 'none'}
                            data-action-feedback-primary-lane-screen-cue={actionFeedbackLaneScreenCue(primaryLane)}
                            data-testid="action-feedback-primary-lane"
                        >
                            <small>Next chase</small>
                            <b>{actionFeedbackLaneRole(primaryLane)}</b>
                            <strong>{primaryLane.action}</strong>
                            <em>{primaryLane.cue}</em>
                            <span aria-hidden="true" className={styles.actionFeedbackPrimaryLaneBeatPips}>
                                {Array.from({ length: actionFeedbackLaneBeatCount(primaryLane) }, (_, beatIndex) => (
                                    <i
                                        data-action-feedback-primary-lane-beat={beatIndex + 1}
                                        data-action-feedback-primary-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                        key={beatIndex}
                                    />
                                ))}
                            </span>
                        </span>
                    ) : null}
                    {laneMap.map((lane) => (
                        <span
                            data-action-feedback-lane={lane.id}
                            data-action-feedback-lane-action={lane.action}
                            data-action-feedback-lane-audio={actionFeedbackLaneAudioCue(lane)}
                            data-action-feedback-lane-beats={actionFeedbackLaneBeatCount(lane)}
                            data-action-feedback-lane-count={lane.count}
                            data-action-feedback-lane-role={actionFeedbackLaneRole(lane)}
                            data-action-feedback-lane-role-id={actionFeedbackLaneRoleId(lane) ?? 'none'}
                            data-action-feedback-lane-screen-cue={actionFeedbackLaneScreenCue(lane)}
                            key={lane.id}
                        >
                            <small>{lane.label}</small>
                            <b>{actionFeedbackLaneRole(lane)}</b>
                            <strong>{lane.action}</strong>
                            <em>
                                x{lane.count} / {lane.cue}
                            </em>
                            <span aria-hidden="true" className={styles.actionFeedbackLaneBeatPips}>
                                {Array.from({ length: actionFeedbackLaneBeatCount(lane) }, (_, beatIndex) => (
                                    <i
                                        data-action-feedback-lane-beat={beatIndex + 1}
                                        data-action-feedback-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                        key={beatIndex}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </span>
            ) : null}
            {stackRead ? (
                <span
                    aria-label={`${stackRead.label}: ${stackRead.action}. ${stackRead.value}. ${stackRead.nextCue}`}
                    className={styles.actionFeedbackStackSummary}
                    data-action-feedback-stack-action={stackRead.action}
                    data-action-feedback-stack-summary={burstTier}
                    data-action-feedback-stack-tone={stackRead.tone}
                    data-testid="action-feedback-stack-summary"
                >
                    <small>{stackRead.label}</small>
                    <span>{stackRead.action}</span>
                    <strong>{stackRead.value}</strong>
                    <em>{stackRead.nextCue}</em>
                </span>
            ) : null}
            {sequenceCue ? (
                <span
                    aria-label={`Action sequence. First: ${sequenceCue.first}. Then: ${sequenceCue.then}. Keep: ${sequenceCue.keep}.`}
                    className={styles.actionFeedbackSequenceCue}
                    data-action-feedback-sequence-tone={sequenceCue.tone}
                    data-testid="action-feedback-sequence-cue"
                >
                    <small>First</small>
                    <b>{sequenceCue.first}</b>
                    <small>Then</small>
                    <b>{sequenceCue.then}</b>
                    <small>Keep</small>
                    <b>{sequenceCue.keep}</b>
                </span>
            ) : null}
            {followup ? <small data-action-feedback-followup={followupTone(followup)}>{followup}</small> : null}
        </div>
    );
};
