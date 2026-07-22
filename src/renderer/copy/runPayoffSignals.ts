import type { RunSummary } from '../../shared/contracts';
import { getChainTargetFeedback } from '../../shared/chain-targets';

type RunPayoffSignalTone = 'chain' | 'reward' | 'build' | 'risk';

type RunPayoffSignalRow = {
    action: RunPayoffSignalAction;
    arcadeCue: string;
    audioCue: RunPayoffSignalAudioCue;
    id: string;
    label: string;
    nextCue?: string;
    screenCue: RunPayoffSignalScreenCue;
    tone: RunPayoffSignalTone;
    value: string;
};

type RunPayoffSignalAction =
    | 'Protect chain'
    | 'Chase target'
    | 'Cash reward'
    | 'Claim pickups'
    | 'Perfect floor'
    | 'Build route'
    | 'Reduce risk'
    | 'Bank score';

type RunPayoffSignalAudioCue =
    | 'run-payoff-chain'
    | 'run-payoff-target'
    | 'run-payoff-cashout'
    | 'run-payoff-pickup'
    | 'run-payoff-perfect'
    | 'run-payoff-build'
    | 'run-payoff-risk'
    | 'run-payoff-score';

type RunPayoffSignalScreenCue = 'pulse' | 'snap' | 'burst' | 'guard';

type RunPayoffBurstSignal = {
    action: 'Chase again' | 'Prime next' | 'Rebuild super stack';
    label: 'Combo burst' | 'Payoff burst' | 'Payoff stack' | 'Super stack';
    tone: 'chain' | 'reward' | 'super';
    value: string;
};

type RunPayoffCrescendoSignal = {
    audioCue: 'prime-pop' | 'cashout-pop' | 'stack-burst' | 'super-burst';
    beatCount: 2 | 3 | 4 | 5;
    detail: string;
    label: 'Prime beat' | 'Cashout beat' | 'Stack burst' | 'Super burst';
    screenCue: 'pulse' | 'snap' | 'burst' | 'super';
    tier: 'prime' | 'cashout' | 'stack' | 'super';
};

type RunPayoffSequenceSignal = {
    first: string;
    keep: string;
    then: string;
    tone: 'chain' | 'reward' | 'super';
};

type RunPayoffLaneId = 'chain' | 'cash' | 'build' | 'risk';

type RunPayoffLaneMapEntry = {
    action: 'Protect chain' | 'Cash reward' | 'Build route' | 'Reduce risk';
    count: number;
    id: RunPayoffLaneId;
    label: 'Chain' | 'Cash' | 'Build' | 'Risk';
    cue: string;
};

type RunPayoffBeatCount = 1 | 2 | 3 | 4;
type RunPayoffLaneAudioCue = 'run-payoff-lane-chain' | 'run-payoff-lane-cash' | 'run-payoff-lane-build' | 'run-payoff-lane-risk';
type RunPayoffLaneScreenCue = 'burst' | 'cashout' | 'build' | 'risk';

type RunPayoffSignalOptions = {
    includeChainTarget?: boolean;
    pickupClaimed?: number;
    pickupTotal?: number;
    pressureExtra?: number;
    rewardPerkCount?: number;
    routePaid?: boolean;
    routeRewardText?: string | null;
};

const RUN_PAYOFF_LANE_ORDER: RunPayoffLaneId[] = ['chain', 'cash', 'build', 'risk'];

const RUN_PAYOFF_LANE_LABELS: Record<RunPayoffLaneId, RunPayoffLaneMapEntry['label']> = {
    build: 'Build',
    cash: 'Cash',
    chain: 'Chain',
    risk: 'Risk'
};

const RUN_PAYOFF_LANE_ACTIONS: Record<RunPayoffLaneId, RunPayoffLaneMapEntry['action']> = {
    build: 'Build route',
    cash: 'Cash reward',
    chain: 'Protect chain',
    risk: 'Reduce risk'
};

const RUN_PAYOFF_SIGNAL_BEATS_BY_ID: Record<string, RunPayoffBeatCount> = {
    'build-engines': 3,
    'chain-next-target': 3,
    'chain-seed': 2,
    'chain-threshold': 4,
    'combo-tier': 4,
    'perfect-clears': 3,
    'pickup-claim': 3,
    'pressure-burst': 2,
    'route-cashout': 4,
    'score-bank': 2
};

const RUN_PAYOFF_LANE_BEATS_BY_ID: Record<RunPayoffLaneId, RunPayoffBeatCount> = {
    build: 3,
    cash: 4,
    chain: 4,
    risk: 2
};

const runPayoffArrayCount = (value: unknown): number => Array.isArray(value) ? value.length : 0;

const runPayoffLaneId = (row: Pick<RunPayoffSignalRow, 'id' | 'tone'>): RunPayoffLaneId => {
    if (row.tone === 'build') {
        return 'build';
    }
    if (row.tone === 'risk') {
        return 'risk';
    }
    if (row.tone === 'reward') {
        return 'cash';
    }
    return 'chain';
};

const runPayoffSignalAction = (row: Pick<RunPayoffSignalRow, 'id' | 'tone'>): RunPayoffSignalAction => {
    if (row.id === 'chain-next-target') {
        return 'Chase target';
    }
    if (row.id === 'route-cashout') {
        return 'Cash reward';
    }
    if (row.id === 'pickup-claim') {
        return 'Claim pickups';
    }
    if (row.id === 'perfect-clears') {
        return 'Perfect floor';
    }
    if (row.id === 'build-engines' || row.tone === 'build') {
        return 'Build route';
    }
    if (row.id === 'pressure-burst' || row.tone === 'risk') {
        return 'Reduce risk';
    }
    if (row.id === 'score-bank') {
        return 'Bank score';
    }
    return 'Protect chain';
};

const runPayoffSignalAudioCue = (row: Pick<RunPayoffSignalRow, 'id' | 'tone'>): RunPayoffSignalAudioCue => {
    if (row.id === 'chain-next-target') {
        return 'run-payoff-target';
    }
    if (row.id === 'route-cashout') {
        return 'run-payoff-cashout';
    }
    if (row.id === 'pickup-claim') {
        return 'run-payoff-pickup';
    }
    if (row.id === 'perfect-clears') {
        return 'run-payoff-perfect';
    }
    if (row.id === 'build-engines' || row.tone === 'build') {
        return 'run-payoff-build';
    }
    if (row.id === 'pressure-burst' || row.tone === 'risk') {
        return 'run-payoff-risk';
    }
    if (row.id === 'score-bank') {
        return 'run-payoff-score';
    }
    return 'run-payoff-chain';
};

const runPayoffSignalScreenCue = (row: Pick<RunPayoffSignalRow, 'id' | 'tone'>): RunPayoffSignalScreenCue => {
    if (row.tone === 'risk') {
        return 'guard';
    }
    if (row.id === 'route-cashout' || row.id === 'combo-tier' || row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'build' || row.id === 'chain-next-target' || row.id === 'chain-threshold') {
        return 'snap';
    }
    return 'pulse';
};

export const getRunPayoffSignals = (
    summary: RunSummary,
    options: RunPayoffSignalOptions = {}
): RunPayoffSignalRow[] => {
    const rows: (Omit<RunPayoffSignalRow, 'action' | 'audioCue' | 'screenCue'> & { priority: number })[] = [];
    const pickupClaimed = Math.max(0, options.pickupClaimed ?? summary.payoffPickupClaimed ?? 0);
    const pickupTotal = Math.max(0, options.pickupTotal ?? summary.payoffPickupTotal ?? 0);
    const relicCount = runPayoffArrayCount(summary.relicIds);
    const perkCount = Math.max(0, options.rewardPerkCount ?? summary.payoffRewardPerkCount ?? 0);
    const mutatorCount = runPayoffArrayCount(summary.activeMutators);
    const pressureCount = mutatorCount + Math.max(0, options.pressureExtra ?? summary.payoffPressureExtra ?? 0);

    if (summary.bestStreak >= 10) {
        rows.push({
            arcadeCue: 'Combo live',
            id: 'combo-tier',
            label: 'Combo tier',
            nextCue: 'Protect the chain and cash the next reward band',
            value: `x${summary.bestStreak}`,
            tone: 'chain',
            priority: 100
        });
    } else if (summary.bestStreak >= 4) {
        rows.push({
            arcadeCue: 'Chain cashout',
            id: 'chain-threshold',
            label: summary.bestStreak >= 6 ? 'Chain cashout' : 'Chain burst',
            nextCue: summary.bestStreak >= 6
                ? 'Repeat the cashout, then push the next reward threshold'
                : 'Push the next chain reward threshold',
            value: `x${summary.bestStreak}`,
            tone: 'chain',
            priority: 90
        });
    } else {
        rows.push({
            arcadeCue: summary.bestStreak > 0 ? 'Prime chain' : 'Prime payoff',
            id: 'chain-seed',
            label: 'Chain primer',
            nextCue: 'Open with safe matches before chasing bonuses',
            value: `x${summary.bestStreak}`,
            tone: 'chain',
            priority: 35
        });
    }

    const chainTarget = getChainTargetFeedback(summary.bestStreak);
    if (options.includeChainTarget && chainTarget.band !== 'mastery') {
        rows.push({
            arcadeCue: 'Next chase',
            id: 'chain-next-target',
            label: chainTarget.payoffLabel,
            nextCue: 'Aim the next run at this reward band',
            value: chainTarget.payoffValue,
            tone: 'chain',
            priority: summary.bestStreak >= 3 ? 88 : 36
        });
    }

    if (options.routePaid ?? summary.payoffRoutePaid) {
        rows.push({
            arcadeCue: 'Route cashout',
            id: 'route-cashout',
            label: 'Route paid',
            nextCue: 'Keep feeding the route that paid out',
            value: options.routeRewardText ?? summary.payoffRouteRewardText ?? 'cashout',
            tone: 'reward',
            priority: 95
        });
    }

    if (pickupTotal > 0) {
        rows.push({
            arcadeCue: pickupClaimed >= pickupTotal ? 'Claimed all' : 'Left value',
            id: 'pickup-claim',
            label: 'Pickups',
            nextCue: pickupClaimed >= pickupTotal ? 'Keep claiming before exit' : 'Claim visible rewards before leaving',
            value: `${pickupClaimed}/${pickupTotal}`,
            tone: pickupClaimed >= pickupTotal ? 'reward' : 'risk',
            priority: pickupClaimed > 0 ? 82 : 42
        });
    }

    if (summary.perfectClears > 0) {
        rows.push({
            arcadeCue: 'Clean floor',
            id: 'perfect-clears',
            label: 'Perfects',
            nextCue: 'Use memory tools to preserve no-miss floors',
            value: `${summary.perfectClears}`,
            tone: 'reward',
            priority: 76
        });
    }

    if (relicCount + perkCount > 0) {
        rows.push({
            arcadeCue: perkCount > 0 ? 'Perk online' : 'Relic online',
            id: 'build-engines',
            label: relicCount > 0 && perkCount === 0 ? 'Prime' : 'Prime online',
            nextCue: 'Draft and shop around these payoff routes',
            value: perkCount > 0 ? `${relicCount + perkCount}` : `${relicCount} relic${relicCount === 1 ? '' : 's'}`,
            tone: 'build',
            priority: 72
        });
    }

    if (pressureCount > 0) {
        rows.push({
            arcadeCue: pressureCount >= 4 ? 'Danger stack' : 'Pressure read',
            id: 'pressure-burst',
            label: 'Pressure',
            nextCue: 'Bring guards, cleanses, or control tools',
            value: mutatorCount > 0 && options.pressureExtra == null
                ? `${mutatorCount} mutator${mutatorCount === 1 ? '' : 's'}`
                : `${pressureCount}`,
            tone: 'risk',
            priority: pressureCount >= 4 ? 62 : 50
        });
    }

    if (rows.length < 3) {
        rows.push({
            arcadeCue: summary.totalScore > 0 ? 'Score banked' : 'Prime score',
            id: 'score-bank',
            label: 'Score pop bank',
            nextCue: 'Push streaks for bigger score pops',
            value: summary.totalScore.toLocaleString(),
            tone: 'reward',
            priority: 30
        });
    }

    return rows
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5)
        .map((row) => ({
            action: runPayoffSignalAction(row),
            arcadeCue: row.arcadeCue,
            audioCue: runPayoffSignalAudioCue(row),
            id: row.id,
            label: row.label,
            nextCue: row.nextCue,
            screenCue: runPayoffSignalScreenCue(row),
            tone: row.tone,
            value: row.value
        }));
};

export const getRunPayoffSignalBeatCount = (
    row: Pick<RunPayoffSignalRow, 'id' | 'tone'>
): RunPayoffBeatCount => RUN_PAYOFF_SIGNAL_BEATS_BY_ID[row.id] ?? (row.tone === 'risk' ? 2 : row.tone === 'build' ? 3 : 4);

export const getRunPayoffLaneBeatCount = (
    lane: Pick<RunPayoffLaneMapEntry, 'count' | 'id'>
): RunPayoffBeatCount => Math.min(4, Math.max(RUN_PAYOFF_LANE_BEATS_BY_ID[lane.id], lane.count)) as RunPayoffBeatCount;

export const getRunPayoffLaneAudioCue = (lane: Pick<RunPayoffLaneMapEntry, 'id'>): RunPayoffLaneAudioCue => {
    switch (lane.id) {
        case 'cash':
            return 'run-payoff-lane-cash';
        case 'build':
            return 'run-payoff-lane-build';
        case 'risk':
            return 'run-payoff-lane-risk';
        default:
            return 'run-payoff-lane-chain';
    }
};

export const getRunPayoffLaneScreenCue = (lane: Pick<RunPayoffLaneMapEntry, 'id'>): RunPayoffLaneScreenCue => {
    if (lane.id === 'cash') {
        return 'cashout';
    }
    if (lane.id === 'build') {
        return 'build';
    }
    if (lane.id === 'risk') {
        return 'risk';
    }
    return 'burst';
};

export const formatRunPayoffSignalsLabel = (
    label: string,
    rows: readonly Pick<RunPayoffSignalRow, 'arcadeCue' | 'label' | 'nextCue' | 'value'>[]
): string => {
    const rowCopy = rows.map((row) => `${row.arcadeCue}: ${row.label}: ${row.value}${row.nextCue ? `. Next: ${row.nextCue}` : ''}`).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

export const getRunPayoffLaneMap = (
    rows: readonly Pick<RunPayoffSignalRow, 'arcadeCue' | 'id' | 'tone'>[]
): RunPayoffLaneMapEntry[] => {
    const laneState = new Map<RunPayoffLaneId, { count: number; cue: string }>();
    rows.forEach((row) => {
        const laneId = runPayoffLaneId(row);
        const state = laneState.get(laneId);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(laneId, { count: 1, cue: row.arcadeCue });
    });

    return RUN_PAYOFF_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        return state
            ? [
                  {
                      action: RUN_PAYOFF_LANE_ACTIONS[id],
                      count: state.count,
                      cue: state.cue,
                      id,
                      label: RUN_PAYOFF_LANE_LABELS[id]
                  }
              ]
            : [];
    });
};

export const formatRunPayoffLaneMapAttr = (laneMap: readonly Pick<RunPayoffLaneMapEntry, 'count' | 'id'>[]): string =>
    laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.count}`).join('>') : 'none';

export const formatRunPayoffLaneActionMapAttr = (
    laneMap: readonly Pick<RunPayoffLaneMapEntry, 'action' | 'count' | 'id'>[]
): string => (laneMap.length > 0 ? laneMap.map((lane) => `${lane.id}:${lane.action}:${lane.count}`).join('>') : 'none');

export const formatRunPayoffLaneMapLabel = (
    label: string,
    laneMap: readonly Pick<RunPayoffLaneMapEntry, 'action' | 'count' | 'cue' | 'label'>[]
): string =>
    laneMap.length > 0
        ? `${label}. ${laneMap.map((lane) => `${lane.label}: ${lane.count}. ${lane.action}. ${lane.cue}.`).join(' ')}`
        : label;

export const getRunPayoffBurstSignal = (
    rows: readonly Pick<RunPayoffSignalRow, 'id' | 'tone'>[]
): RunPayoffBurstSignal | null => {
    const payoffRows = rows.filter(
        (row) =>
            !['chain-next-target', 'chain-seed', 'score-bank'].includes(row.id) &&
            (row.tone === 'chain' || row.tone === 'reward' || row.tone === 'build' || row.id === 'pickup-claim')
    );
    if (payoffRows.length < 3) {
        return null;
    }
    const hasCombo = payoffRows.some((row) => row.id === 'combo-tier');
    const hasChain = payoffRows.some((row) => row.tone === 'chain');
    if (payoffRows.length >= 4) {
        return {
            action: 'Rebuild super stack',
            label: 'Super stack',
            tone: 'super',
            value: `${payoffRows.length} payoffs`
        };
    }
    return {
        action: hasChain ? 'Chase again' : 'Prime next',
        label: hasCombo ? 'Combo burst' : hasChain ? 'Payoff burst' : 'Payoff stack',
        tone: hasChain ? 'chain' : 'reward',
        value: `${payoffRows.length} payoffs`
    };
};

export const formatRunPayoffBurstSignalLabel = (
    label: string,
    burst: RunPayoffBurstSignal | null
): string => (burst ? `${label}. ${burst.label}: ${burst.action}. ${burst.value}.` : label);

export const getRunPayoffCrescendoSignal = (
    rows: readonly Pick<RunPayoffSignalRow, 'id' | 'tone'>[],
    burst: RunPayoffBurstSignal | null = getRunPayoffBurstSignal(rows)
): RunPayoffCrescendoSignal | null => {
    const hasCashout = rows.some((row) => row.id === 'route-cashout' || row.id === 'chain-threshold');
    const hasCombo = rows.some((row) => row.id === 'combo-tier');
    const payoffRows = rows.filter(
        (row) =>
            !['chain-next-target', 'chain-seed', 'score-bank'].includes(row.id) &&
            (row.tone === 'chain' || row.tone === 'reward' || row.tone === 'build' || row.id === 'pickup-claim')
    );

    if (burst?.tone === 'super' || payoffRows.length >= 4) {
        return {
            audioCue: 'super-burst',
            beatCount: 5,
            detail: 'Archive this route as a full payoff stack to rebuild next run',
            label: 'Super burst',
            screenCue: 'super',
            tier: 'super'
        };
    }
    if (burst || payoffRows.length >= 3) {
        return {
            audioCue: 'stack-burst',
            beatCount: 4,
            detail: hasCombo ? 'Combo plus payoff lanes are ready to chase again' : 'Multiple payoff lanes are primed together',
            label: 'Stack burst',
            screenCue: 'burst',
            tier: 'stack'
        };
    }
    if (hasCashout) {
        return {
            audioCue: 'cashout-pop',
            beatCount: 3,
            detail: 'A chain or route paid out; repeat the cashout path',
            label: 'Cashout beat',
            screenCue: 'snap',
            tier: 'cashout'
        };
    }
    if (rows.some((row) => row.tone === 'chain' || row.tone === 'build' || row.tone === 'reward')) {
        return {
            audioCue: 'prime-pop',
            beatCount: 2,
            detail: 'A payoff lane is seeded for the next run',
            label: 'Prime beat',
            screenCue: 'pulse',
            tier: 'prime'
        };
    }
    return null;
};

export const formatRunPayoffCrescendoSignalLabel = (
    label: string,
    crescendo: RunPayoffCrescendoSignal | null
): string => (crescendo ? `${label}. ${crescendo.label}: ${crescendo.detail}. ${crescendo.beatCount} beats.` : label);

export const getRunPayoffSequenceSignal = (
    rows: readonly RunPayoffSignalRow[]
): RunPayoffSequenceSignal | null => {
    const cashoutRow =
        rows.find((row) => row.id === 'route-cashout') ??
        rows.find((row) => row.id === 'combo-tier') ??
        rows.find((row) => row.id === 'chain-threshold') ??
        rows.find((row) => row.tone === 'reward') ??
        rows[0];
    if (!cashoutRow) {
        return null;
    }
    const nextRow =
        rows.find((row) => row.id === 'chain-next-target') ??
        rows.find((row) => row.id === 'pickup-claim') ??
        rows.find((row) => row.id !== cashoutRow.id && row.nextCue) ??
        cashoutRow;
    const keepRow =
        rows.find((row) => row.id === 'build-engines') ??
        rows.find((row) => row.id === 'route-cashout') ??
        rows.find((row) => row.tone === 'chain') ??
        nextRow;
    const payoffCount = rows.filter((row) => row.id !== 'chain-seed' && row.id !== 'score-bank').length;
    return {
        first: `${cashoutRow.arcadeCue}: ${cashoutRow.value}`,
        then: nextRow.nextCue ?? `${nextRow.arcadeCue}: ${nextRow.value}`,
        keep: keepRow.nextCue ?? `${keepRow.arcadeCue}: ${keepRow.value}`,
        tone: payoffCount >= 4 ? 'super' : cashoutRow.tone === 'chain' ? 'chain' : 'reward'
    };
};

export const formatRunPayoffSequenceSignalLabel = (
    label: string,
    sequence: RunPayoffSequenceSignal | null
): string =>
    sequence
        ? `${label}. First: ${sequence.first}. Then: ${sequence.then}. Keep: ${sequence.keep}.`
        : label;
