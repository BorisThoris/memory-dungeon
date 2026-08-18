import {
    getChainRewardLaneAction,
    getChainRewardProgress,
    getChainRewardStackLabel,
    getChainRewardUrgencyCopy,
    type ChainRewardForecastCue
} from '../copy/chainMomentum';

type HudChainRewardLaneId = ChainRewardForecastCue['tone'];

type HudChainRewardLaneMapEntry = {
    action: ReturnType<typeof getChainRewardLaneAction>;
    count: number;
    cue: string;
    id: HudChainRewardLaneId;
    label: 'Shard' | 'Guard' | 'Heal';
};

type HudChainRewardLaneCueBadgeId = 'cashout-crown' | 'heal-lane' | 'prime-cross' | 'protect-lane';

type HudChainRewardLaneCueBadge = {
    glyph: string;
    id: HudChainRewardLaneCueBadgeId;
    label: 'Cashout' | 'Heal' | 'Prime' | 'Protect';
};

type HudChainRewardAudioCue =
    | 'chain-reward-guard'
    | 'chain-reward-heal'
    | 'chain-reward-prime'
    | 'chain-reward-shard'
    | 'chain-reward-stack';

type HudChainRewardScreenCue = 'burst' | 'pulse' | 'tick';

const HUD_CHAIN_REWARD_LANE_ORDER: HudChainRewardLaneId[] = ['reward', 'guard', 'heal'];
const HUD_CHAIN_REWARD_LANE_LABELS: Record<HudChainRewardLaneId, HudChainRewardLaneMapEntry['label']> = {
    guard: 'Guard',
    heal: 'Heal',
    reward: 'Shard'
};

const getHudChainRewardAudioCue = (cue: ChainRewardForecastCue): HudChainRewardAudioCue => {
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

const getHudChainRewardScreenCue = (cue: ChainRewardForecastCue): HudChainRewardScreenCue => {
    if ((cue.stackSize ?? 1) >= 2 || cue.urgency === 'next') {
        return 'burst';
    }
    if (cue.urgency === 'soon') {
        return 'pulse';
    }
    return 'tick';
};

const getHudChainRewardLaneMap = (cues: readonly ChainRewardForecastCue[]): HudChainRewardLaneMapEntry[] => {
    const laneState = new Map<HudChainRewardLaneId, { action: ReturnType<typeof getChainRewardLaneAction>; count: number; cue: string }>();
    cues.forEach((cue) => {
        const state = laneState.get(cue.tone);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(cue.tone, {
            action: getChainRewardLaneAction(cue.urgency),
            count: 1,
            cue: getChainRewardUrgencyCopy(cue)
        });
    });

    return HUD_CHAIN_REWARD_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        return state ? [{ action: state.action, count: state.count, cue: state.cue, id, label: HUD_CHAIN_REWARD_LANE_LABELS[id] }] : [];
    });
};

const getHudChainRewardLaneMapAttr = (laneMap: readonly Pick<HudChainRewardLaneMapEntry, 'count' | 'id'>[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') : 'none';

const getHudChainRewardLaneActionMapAttr = (
    laneMap: readonly Pick<HudChainRewardLaneMapEntry, 'action' | 'count' | 'id'>[]
): string => (laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') : 'none');

const getHudChainRewardLaneBeatCount = (lane: Pick<HudChainRewardLaneMapEntry, 'action' | 'id'>): 3 | 4 => {
    if (lane.action === 'Cash next' || lane.id === 'reward' || lane.id === 'guard') {
        return 4;
    }
    return 3;
};

const getHudChainRewardLaneRole = (
    lane: Pick<HudChainRewardLaneMapEntry, 'action' | 'id'>
): 'Cashout' | 'Guard' | 'Heal' | 'Shard' => {
    if (lane.action === 'Cash next') {
        return 'Cashout';
    }
    if (lane.id === 'guard') {
        return 'Guard';
    }
    if (lane.id === 'heal') {
        return 'Heal';
    }
    return 'Shard';
};

const getHudChainRewardLaneCueBadge = (
    lane: Pick<HudChainRewardLaneMapEntry, 'action' | 'id'>
): HudChainRewardLaneCueBadge => {
    if (lane.id === 'guard') {
        return { glyph: '[]', id: 'protect-lane', label: 'Protect' };
    }
    if (lane.id === 'heal') {
        return { glyph: '+!', id: 'heal-lane', label: 'Heal' };
    }
    if (lane.action === 'Prime cashout') {
        return { glyph: 'x|', id: 'prime-cross', label: 'Prime' };
    }
    return { glyph: '=+', id: 'cashout-crown', label: 'Cashout' };
};

const getHudChainRewardForecastCueBadge = (cue: ChainRewardForecastCue): HudChainRewardLaneCueBadge =>
    getHudChainRewardLaneCueBadge({
        action: getChainRewardLaneAction(cue.urgency),
        id: cue.tone
    });

export type HudChainRewardForecastRow = ChainRewardForecastCue & {
    ariaLabel: string;
    audioCue: HudChainRewardAudioCue;
    cueBadge: HudChainRewardLaneCueBadge;
    laneAction: ReturnType<typeof getChainRewardLaneAction>;
    rewardText: string;
    screenCue: HudChainRewardScreenCue;
    stackLabel: string | null;
    urgencyCopy: ReturnType<typeof getChainRewardUrgencyCopy>;
};

const decorateHudChainRewardForecastCue = (cue: ChainRewardForecastCue): HudChainRewardForecastRow => {
    const stackLabel = getChainRewardStackLabel(cue);
    const cueBadge = getHudChainRewardForecastCueBadge(cue);
    const laneAction = getChainRewardLaneAction(cue.urgency);
    const urgencyCopy = getChainRewardUrgencyCopy(cue);

    return {
        ...cue,
        ariaLabel: `Chain reward forecast. ${cue.chaseLabel}. ${cueBadge.label} cue ${cueBadge.glyph}. ${cue.actionLabel}. ${laneAction}. ${cue.label}. ${cue.distanceLabel}. ${urgencyCopy}.`,
        audioCue: getHudChainRewardAudioCue(cue),
        cueBadge,
        laneAction,
        rewardText: `${cueBadge.label} cue ${cueBadge.glyph}: ${laneAction}: ${urgencyCopy}: ${cue.label}${stackLabel ? `: ${stackLabel}` : ''}`,
        screenCue: getHudChainRewardScreenCue(cue),
        stackLabel,
        urgencyCopy
    };
};

export type HudChainRewardLaneRow = HudChainRewardLaneMapEntry & {
    ariaLabel: string;
    audioCue: HudChainRewardAudioCue | 'none';
    beatCount: 3 | 4;
    countLabel: string;
    cueBadge: HudChainRewardLaneCueBadge;
    roleLabel: 'Cashout' | 'Guard' | 'Heal' | 'Shard';
    screenCue: HudChainRewardScreenCue | 'none';
};

const decorateHudChainRewardLane = (
    lane: HudChainRewardLaneMapEntry,
    cue: ChainRewardForecastCue | null
): HudChainRewardLaneRow => {
    const cueBadge = getHudChainRewardLaneCueBadge(lane);
    const beatCount = getHudChainRewardLaneBeatCount(lane);
    const roleLabel = getHudChainRewardLaneRole(lane);
    const countLabel = `${lane.count} ${lane.count === 1 ? 'lane' : 'lanes'}`;

    return {
        ...lane,
        ariaLabel: `Chain reward lane. ${lane.label}. ${cueBadge.label} cue ${cueBadge.glyph}. ${roleLabel}. ${lane.action}. ${countLabel}. ${lane.cue}. ${beatCount} beats.`,
        audioCue: cue ? getHudChainRewardAudioCue(cue) : 'none',
        beatCount,
        countLabel,
        cueBadge,
        roleLabel,
        screenCue: cue ? getHudChainRewardScreenCue(cue) : 'none'
    };
};

const getHudChainRewardLaneMapLabel = (
    laneMap: readonly Pick<HudChainRewardLaneMapEntry, 'action' | 'count' | 'cue' | 'id' | 'label'>[]
): string =>
    laneMap.length > 0
        ? `Chain reward lane map. ${laneMap
              .map((lane) => {
                  const cue = getHudChainRewardLaneCueBadge(lane);
                  return `${lane.label} ${cue.label} cue ${cue.glyph}. ${getHudChainRewardLaneRole(lane)} x${lane.count}. ${lane.action}. ${lane.cue}.`;
              })
              .join(' ')}`
        : 'Chain reward lane map';

type HudChainRewardLadderEntry = {
    action: ReturnType<typeof getChainRewardLaneAction>;
    cue: ChainRewardForecastCue;
    filled: number;
    progressLabel: string;
    remainingLabel: string;
    stackSize: number;
    targetLabel: string;
    total: number;
};

export type HudChainRewardLadderRow = HudChainRewardLadderEntry & {
    ariaLabel: string;
    audioCue: HudChainRewardAudioCue;
    beatCount: 2 | 3 | 4;
    cueBadge: HudChainRewardLaneCueBadge;
    rewardLabel: string;
    screenCue: HudChainRewardScreenCue;
};

const getHudChainRewardLadder = (
    streak: number,
    cues: readonly ChainRewardForecastCue[]
): HudChainRewardLadderEntry[] =>
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
                      stackSize: cue.stackSize ?? 1,
                      targetLabel: progress.targetLabel,
                      total: progress.total
                  }
                : null;
        })
        .filter((entry): entry is HudChainRewardLadderEntry => entry != null);

const getHudChainRewardBeatCount = (entry: HudChainRewardLadderEntry): 2 | 3 | 4 => {
    if (entry.cue.urgency === 'next' || entry.remainingLabel.startsWith('0 ')) {
        return 4;
    }
    if (entry.filled > 0 || entry.cue.urgency === 'soon') {
        return 3;
    }
    return 2;
};

const decorateHudChainRewardLadderEntry = (entry: HudChainRewardLadderEntry): HudChainRewardLadderRow => {
    const cueBadge = getHudChainRewardLaneCueBadge({
        action: entry.action,
        id: entry.cue.tone
    });
    const beatCount = getHudChainRewardBeatCount(entry);
    const rewardLabel =
        entry.action === entry.cue.chaseLabel ? entry.cue.label : `${entry.action} / ${entry.cue.label}`;

    return {
        ...entry,
        ariaLabel: `Chain reward ladder entry. ${entry.cue.chaseLabel}. ${cueBadge.label} cue ${cueBadge.glyph}. ${entry.action}. ${entry.cue.label}. ${entry.progressLabel}. ${entry.remainingLabel}.`,
        audioCue: getHudChainRewardAudioCue(entry.cue),
        beatCount,
        cueBadge,
        rewardLabel,
        screenCue: getHudChainRewardScreenCue(entry.cue)
    };
};

const getHudChainRewardLadderAttr = (entries: readonly HudChainRewardLadderEntry[]): string =>
    entries.length > 0 ? entries.map((entry) => `${entry.cue.tone}:${entry.filled}/${entry.total}`).join('>') : 'none';

const getHudChainRewardLadderActionAttr = (entries: readonly HudChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? entries.map((entry) => `${entry.cue.tone}:${entry.action}:${entry.filled}/${entry.total}`).join('>')
        : 'none';

const getHudChainRewardLadderLabel = (entries: readonly HudChainRewardLadderEntry[]): string =>
    entries.length > 0
        ? `Chain reward ladder. ${entries
              .map((entry) => {
                  const cue = getHudChainRewardLaneCueBadge({
                      action: entry.action,
                      id: entry.cue.tone
                  });
                  const rewardCopy =
                      entry.action === entry.cue.chaseLabel
                          ? entry.cue.label
                          : `${entry.action}: ${entry.cue.label}`;
                  return `${entry.cue.chaseLabel}: ${cue.label} cue ${cue.glyph}. ${rewardCopy}. ${entry.progressLabel}. ${entry.remainingLabel}.`;
              })
              .join(' ')}`
        : 'Chain reward ladder';

export type HudChainRewardFeedbackModel = {
    forecastRows: HudChainRewardForecastRow[];
    ladderActionAttr: string;
    ladderAttr: string;
    ladderLabel: string;
    ladderRows: HudChainRewardLadderRow[];
    laneActionMapAttr: string;
    laneMapAttr: string;
    laneMapLabel: string;
    laneRows: HudChainRewardLaneRow[];
    leadCue: HudChainRewardForecastRow | null;
    primaryLane: HudChainRewardLaneRow | null;
    summaryFill: number;
};

export const buildHudChainRewardFeedbackModel = (
    cues: readonly ChainRewardForecastCue[],
    streak: number
): HudChainRewardFeedbackModel => {
    const forecastRows = cues.map(decorateHudChainRewardForecastCue);
    const laneMap = getHudChainRewardLaneMap(cues);
    const laneRows = laneMap.map((lane) =>
        decorateHudChainRewardLane(lane, cues.find((cue) => cue.tone === lane.id) ?? null)
    );
    const ladderEntries = getHudChainRewardLadder(streak, cues);
    const ladderRows = ladderEntries.map(decorateHudChainRewardLadderEntry);

    return {
        forecastRows,
        ladderActionAttr: getHudChainRewardLadderActionAttr(ladderEntries),
        ladderAttr: getHudChainRewardLadderAttr(ladderEntries),
        ladderLabel: getHudChainRewardLadderLabel(ladderEntries),
        ladderRows,
        laneActionMapAttr: getHudChainRewardLaneActionMapAttr(laneMap),
        laneMapAttr: getHudChainRewardLaneMapAttr(laneMap),
        laneMapLabel: getHudChainRewardLaneMapLabel(laneMap),
        laneRows,
        leadCue: forecastRows[0] ?? null,
        primaryLane: laneRows[0] ?? null,
        summaryFill: Math.min(100, ((laneRows.length + ladderRows.length) / 5) * 100)
    };
};

export const getHudPrimaryRewardBeatCount = (cue: ChainRewardForecastCue): 2 | 3 | 4 => {
    if (cue.urgency === 'next' || (cue.stackSize ?? 1) >= 2 || cue.distance <= 1) {
        return 4;
    }
    if (cue.urgency === 'soon' || cue.distance <= 2) {
        return 3;
    }
    return 2;
};

export const getHudPrimaryRewardAudioCue = (
    cue: ChainRewardForecastCue
): 'reward-guard' | 'reward-heal' | 'reward-prime' | 'reward-shard' | 'reward-stack' => {
    if ((cue.stackSize ?? 1) >= 2) {
        return 'reward-stack';
    }
    if (cue.tone === 'guard') {
        return 'reward-guard';
    }
    if (cue.tone === 'heal') {
        return 'reward-heal';
    }
    if (cue.urgency === 'later') {
        return 'reward-prime';
    }
    return 'reward-shard';
};

export const getHudPrimaryRewardScreenCue = (
    cue: ChainRewardForecastCue
): 'burst' | 'pulse' | 'tick' => {
    if ((cue.stackSize ?? 1) >= 2 || cue.urgency === 'next') {
        return 'burst';
    }
    if (cue.urgency === 'soon') {
        return 'pulse';
    }
    return 'tick';
};

type HudChainLaneCueTone = 'setup' | 'cashout' | 'stack' | 'route' | 'combo';
type HudChainLaneAction = 'Cash now' | 'Hold combo' | 'Prime chain' | 'Prime route' | 'Stack cashout';
type HudChainLaneAudioCue = 'chain-cashout' | 'chain-hold' | 'chain-prime' | 'chain-route' | 'chain-stack';
type HudChainLaneScreenCue = 'burst' | 'pulse' | 'tick';

export type HudChainLaneFeedbackModel = {
    action: HudChainLaneAction;
    audioCue: HudChainLaneAudioCue;
    detail: string;
    label: string;
    screenCue: HudChainLaneScreenCue;
    tone: HudChainLaneCueTone;
};

const getHudChainLaneCue = ({
    primaryRewardHot,
    primaryRewardLabel,
    streak,
    stackedPayoffCount,
    traitRouteActive
}: {
    primaryRewardHot: boolean;
    primaryRewardLabel?: string | null;
    streak: number;
    stackedPayoffCount: number;
    traitRouteActive: boolean;
}): { detail: string; label: string; tone: HudChainLaneCueTone } => {
    if (stackedPayoffCount >= 2) {
        return { label: 'Stack cashout', tone: 'stack', detail: `${stackedPayoffCount} rewards on the next clean match` };
    }
    if (primaryRewardHot) {
        return {
            label: 'Cashout now',
            tone: 'cashout',
            detail: primaryRewardLabel
                ? `Next clean match pays ${primaryRewardLabel}`
                : 'Next clean match pays the nearest chain reward'
        };
    }
    if (traitRouteActive) {
        return { label: 'Route chain', tone: 'route', detail: 'Keep streak while converting trait adjacency' };
    }
    if (streak >= 10) {
        return { label: 'Combo hold', tone: 'combo', detail: 'Protect the capped combo lane' };
    }
    if (streak <= 0) {
        return { label: 'Prime chain', tone: 'setup', detail: 'First safe match starts the payoff lane' };
    }
    return { label: 'Prime cashout', tone: 'setup', detail: 'Keep matching toward the next reward threshold' };
};

const getHudChainLaneAction = (cue: Pick<HudChainLaneFeedbackModel, 'tone'>): HudChainLaneAction => {
    if (cue.tone === 'stack') {
        return 'Stack cashout';
    }
    if (cue.tone === 'cashout') {
        return 'Cash now';
    }
    if (cue.tone === 'route') {
        return 'Prime route';
    }
    if (cue.tone === 'combo') {
        return 'Hold combo';
    }
    return 'Prime chain';
};

const getHudChainLaneAudioCue = (cue: Pick<HudChainLaneFeedbackModel, 'tone'>): HudChainLaneAudioCue => {
    if (cue.tone === 'stack') {
        return 'chain-stack';
    }
    if (cue.tone === 'cashout') {
        return 'chain-cashout';
    }
    if (cue.tone === 'route') {
        return 'chain-route';
    }
    if (cue.tone === 'combo') {
        return 'chain-hold';
    }
    return 'chain-prime';
};

const getHudChainLaneScreenCue = (cue: Pick<HudChainLaneFeedbackModel, 'tone'>): HudChainLaneScreenCue => {
    if (cue.tone === 'stack' || cue.tone === 'cashout') {
        return 'burst';
    }
    if (cue.tone === 'route' || cue.tone === 'setup') {
        return 'pulse';
    }
    return 'tick';
};

export const buildHudChainLaneFeedbackModel = ({
    primaryRewardHot,
    primaryRewardLabel,
    streak,
    stackedPayoffCount,
    traitRouteActive
}: {
    primaryRewardHot: boolean;
    primaryRewardLabel?: string | null;
    streak: number;
    stackedPayoffCount: number;
    traitRouteActive: boolean;
}): HudChainLaneFeedbackModel => {
    const cue = getHudChainLaneCue({
        primaryRewardHot,
        primaryRewardLabel,
        streak,
        stackedPayoffCount,
        traitRouteActive
    });

    return {
        ...cue,
        action: getHudChainLaneAction(cue),
        audioCue: getHudChainLaneAudioCue(cue),
        screenCue: getHudChainLaneScreenCue(cue)
    };
};
