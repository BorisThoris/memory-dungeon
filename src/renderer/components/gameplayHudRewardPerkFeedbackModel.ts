import { type RewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { getTraitMarkerCueByShape } from '../copy/traitMarkerCueGlossary';

const REWARD_PERK_FOCUS_PRIORITY: Record<RewardPerkReadinessRow['readiness'], number> = {
    armed: 4,
    soon: 3,
    passive: 2,
    spent: 1
};

const REWARD_PERK_FOCUS_ROW_PRIORITY: Record<RewardPerkReadinessRow['id'], number> = {
    trait_streak_toolkit: 5,
    cursed_opener_greed: 4,
    echo_conduit_double: 3,
    free_first_swap_per_floor: 2,
    hazard_banish_per_floor: 1
};

type HudRewardPerkBeatCueTier = 'cashout' | 'prime' | 'ready';
type HudRewardPerkBeatAudioCue = 'perk-cashout' | 'perk-prime' | 'perk-ready' | 'perk-silent';
type HudRewardPerkLaneRole = 'Cashout' | 'Control' | 'Prime' | 'Route';
type HudRewardPerkLaneRoleId = 'cashout' | 'control' | 'prime' | 'route';
type HudRewardPerkLaneAudioCue = 'reward-perk-cashout' | 'reward-perk-control' | 'reward-perk-prime' | 'reward-perk-route';
type HudRewardPerkLaneScreenCue = 'burst' | 'pulse' | 'recover' | 'tick';

type HudRewardPerkFocus = {
    action: 'Cash perk' | 'Prime perk' | 'Watch perk' | 'Spent';
    row: RewardPerkReadinessRow;
    tone: RewardPerkReadinessRow['readiness'];
} | null;

export type HudRewardPerkBeatCue = {
    action: string;
    audioCue: HudRewardPerkBeatAudioCue;
    beatCount: 2 | 3 | 4;
    label: 'Cashout beat' | 'Prime beat' | 'Ready beat';
    screenCue: 'burst' | 'pulse' | 'tick' | 'none';
    tier: HudRewardPerkBeatCueTier;
};

type HudRewardPerkLaneMapEntry = {
    action: 'Cash perk' | 'Prime perk' | 'Watch perk' | 'Re-prime perk';
    count: number;
    lane: string;
    nextCue: string;
    readiness: RewardPerkReadinessRow['readiness'];
};

type HudRewardPerkLaneCue = {
    glyph: string;
    id: string;
    label: string;
};

export type HudRewardPerkLaneRow = HudRewardPerkLaneMapEntry & {
    ariaLabel: string;
    audioCue: HudRewardPerkLaneAudioCue;
    cue: HudRewardPerkLaneCue;
    role: HudRewardPerkLaneRole;
    roleId: HudRewardPerkLaneRoleId;
    screenCue: HudRewardPerkLaneScreenCue;
};

export type HudRewardPerkFeedbackModel = {
    beatCue: HudRewardPerkBeatCue | null;
    focus: HudRewardPerkFocus;
    laneActionMapAttr: string;
    laneMapAttr: string;
    laneMapLabel: string;
    laneRoleIdMapAttr: string;
    laneRoleMapAttr: string;
    laneRows: HudRewardPerkLaneRow[];
    meterFill: number;
    primaryLane: HudRewardPerkLaneRow | null;
};

const getHudRewardPerkFocus = (rows: readonly RewardPerkReadinessRow[]): HudRewardPerkFocus => {
    const [row] = [...rows].sort((a, b) => {
        const readinessDelta = REWARD_PERK_FOCUS_PRIORITY[b.readiness] - REWARD_PERK_FOCUS_PRIORITY[a.readiness];
        if (readinessDelta !== 0) {
            return readinessDelta;
        }
        const meterDelta = b.meterPercent - a.meterPercent;
        if (meterDelta !== 0) {
            return meterDelta;
        }
        return REWARD_PERK_FOCUS_ROW_PRIORITY[b.id] - REWARD_PERK_FOCUS_ROW_PRIORITY[a.id];
    });
    if (!row) {
        return null;
    }
    const action =
        row.readiness === 'armed'
            ? 'Cash perk'
            : row.readiness === 'soon'
              ? 'Prime perk'
              : row.readiness === 'passive'
                ? 'Watch perk'
                : 'Spent';
    return { action, row, tone: row.readiness };
};

const getHudRewardPerkBeatCue = (focus: HudRewardPerkFocus): HudRewardPerkBeatCue | null => {
    if (!focus) {
        return null;
    }
    if (focus.tone === 'armed') {
        return {
            action: focus.action,
            audioCue: 'perk-cashout',
            beatCount: 4,
            label: 'Cashout beat',
            screenCue: 'burst',
            tier: 'cashout'
        };
    }
    if (focus.tone === 'soon') {
        return {
            action: focus.action,
            audioCue: 'perk-prime',
            beatCount: 3,
            label: 'Prime beat',
            screenCue: 'pulse',
            tier: 'prime'
        };
    }
    return {
        action: focus.action,
        audioCue: 'perk-ready',
        beatCount: 2,
        label: 'Ready beat',
        screenCue: 'tick',
        tier: 'ready'
    };
};

const HUD_REWARD_PERK_ACTION_PRIORITY: Record<HudRewardPerkLaneMapEntry['action'], number> = {
    'Cash perk': 4,
    'Prime perk': 3,
    'Watch perk': 2,
    'Re-prime perk': 1
};

const getHudRewardPerkLaneAction = (
    readiness: RewardPerkReadinessRow['readiness']
): HudRewardPerkLaneMapEntry['action'] => {
    if (readiness === 'armed') {
        return 'Cash perk';
    }
    if (readiness === 'soon') {
        return 'Prime perk';
    }
    if (readiness === 'spent') {
        return 'Re-prime perk';
    }
    return 'Watch perk';
};

const getHudRewardPerkLaneMap = (rows: readonly RewardPerkReadinessRow[]): HudRewardPerkLaneMapEntry[] => {
    const laneState = new Map<string, HudRewardPerkLaneMapEntry>();
    rows.forEach((row) => {
        const action = getHudRewardPerkLaneAction(row.readiness);
        const existing = laneState.get(row.lane);
        if (!existing) {
            laneState.set(row.lane, {
                action,
                count: 1,
                lane: row.lane,
                nextCue: row.nextCue,
                readiness: row.readiness
            });
            return;
        }
        existing.count += 1;
        if (HUD_REWARD_PERK_ACTION_PRIORITY[action] > HUD_REWARD_PERK_ACTION_PRIORITY[existing.action]) {
            existing.action = action;
            existing.nextCue = row.nextCue;
            existing.readiness = row.readiness;
        }
    });
    return [...laneState.values()];
};

const getHudRewardPerkLaneRole = (lane: HudRewardPerkLaneMapEntry): HudRewardPerkLaneRole => {
    const normalizedLane = lane.lane.toLowerCase();
    if (normalizedLane.includes('chain') || lane.action === 'Cash perk') {
        return 'Cashout';
    }
    if (normalizedLane.includes('hazard') || normalizedLane.includes('control')) {
        return 'Control';
    }
    if (normalizedLane.includes('route')) {
        return 'Route';
    }
    return 'Prime';
};

const getHudRewardPerkLaneRoleId = (lane: HudRewardPerkLaneMapEntry): HudRewardPerkLaneRoleId => {
    const role = getHudRewardPerkLaneRole(lane);
    if (role === 'Cashout') {
        return 'cashout';
    }
    if (role === 'Control') {
        return 'control';
    }
    if (role === 'Route') {
        return 'route';
    }
    return 'prime';
};

const getHudRewardPerkLaneCue = (lane: HudRewardPerkLaneMapEntry): HudRewardPerkLaneCue => {
    if (lane.action === 'Cash perk') {
        const cue = getTraitMarkerCueByShape('perk-armed-bar');
        return { glyph: cue.glyph, id: cue.shape, label: cue.label };
    }
    if (lane.action === 'Prime perk' || lane.action === 'Re-prime perk') {
        const cue = getTraitMarkerCueByShape('swap-target-crossbar');
        return { glyph: cue.glyph, id: cue.shape, label: cue.label };
    }
    const roleId = getHudRewardPerkLaneRoleId(lane);
    if (roleId === 'cashout') {
        const cue = getTraitMarkerCueByShape('payoff-bar');
        return { glyph: cue.glyph, id: cue.shape, label: cue.label };
    }
    if (roleId === 'route') {
        const cue = getTraitMarkerCueByShape('linked-route');
        return { glyph: cue.glyph, id: cue.shape, label: cue.label };
    }
    if (roleId === 'prime') {
        const cue = getTraitMarkerCueByShape('swap-target-crossbar');
        return { glyph: cue.glyph, id: cue.shape, label: cue.label };
    }
    return { glyph: '!!', id: 'control-lane', label: 'Control' };
};

const getHudRewardPerkLaneAudioCue = (lane: HudRewardPerkLaneMapEntry): HudRewardPerkLaneAudioCue => {
    const roleId = getHudRewardPerkLaneRoleId(lane);
    if (roleId === 'cashout') {
        return 'reward-perk-cashout';
    }
    if (roleId === 'control') {
        return 'reward-perk-control';
    }
    if (roleId === 'route') {
        return 'reward-perk-route';
    }
    return 'reward-perk-prime';
};

const getHudRewardPerkLaneScreenCue = (lane: HudRewardPerkLaneMapEntry): HudRewardPerkLaneScreenCue => {
    if (lane.readiness === 'armed') {
        return 'burst';
    }
    if (lane.readiness === 'soon') {
        return 'pulse';
    }
    if (lane.readiness === 'spent') {
        return 'recover';
    }
    return 'tick';
};

const decorateHudRewardPerkLaneRow = (lane: HudRewardPerkLaneMapEntry): HudRewardPerkLaneRow => {
    const cue = getHudRewardPerkLaneCue(lane);
    const role = getHudRewardPerkLaneRole(lane);
    const roleId = getHudRewardPerkLaneRoleId(lane);
    return {
        ...lane,
        ariaLabel: `Reward perk lane. ${lane.lane}. ${cue.label} cue: ${cue.glyph}. ${role}. ${lane.action}. ${lane.count} ${
            lane.count === 1 ? 'lane' : 'lanes'
        }. ${lane.nextCue}.`,
        audioCue: getHudRewardPerkLaneAudioCue(lane),
        cue,
        role,
        roleId,
        screenCue: getHudRewardPerkLaneScreenCue(lane)
    };
};

export const buildHudRewardPerkFeedbackModel = (
    rows: readonly RewardPerkReadinessRow[]
): HudRewardPerkFeedbackModel => {
    const focus = getHudRewardPerkFocus(rows);
    const beatCue = getHudRewardPerkBeatCue(focus);
    const laneRows = getHudRewardPerkLaneMap(rows).map(decorateHudRewardPerkLaneRow);

    return {
        beatCue,
        focus,
        laneActionMapAttr: laneRows.length > 0 ? laneRows.map((lane) => `${lane.lane}:${lane.action}:${lane.count}`).join('>') : 'none',
        laneMapAttr: laneRows.length > 0 ? laneRows.map((lane) => `${lane.lane}:${lane.count}`).join('>') : 'none',
        laneMapLabel:
            laneRows.length > 0
                ? `Reward perk lane map. ${laneRows
                      .map((lane) => `${lane.lane} ${lane.cue.label} cue ${lane.cue.glyph}. ${lane.role} x${lane.count}. ${lane.action}. ${lane.nextCue.endsWith('.') ? lane.nextCue : `${lane.nextCue}.`}`)
                      .join(' ')}`
                : 'Reward perk lane map',
        laneRoleIdMapAttr: laneRows.length > 0 ? laneRows.map((lane) => `${lane.lane}:${lane.roleId}:${lane.count}`).join('>') : 'none',
        laneRoleMapAttr: laneRows.length > 0 ? laneRows.map((lane) => `${lane.lane}:${lane.role}:${lane.count}`).join('>') : 'none',
        laneRows,
        meterFill:
            rows.length > 0
                ? Math.round((rows.filter((row) => row.readiness === 'armed' || row.readiness === 'soon').length / rows.length) * 100)
                : 0,
        primaryLane: laneRows[0] ?? null
    };
};
