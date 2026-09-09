import { MAX_COMBO_SHARDS } from '../../shared/contracts';
import { COMBO_SHARD_STREAK_STEP } from '../../shared/combo-shard-rules';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

type ChainMomentumTier = 'building' | 'chain' | 'surge' | 'combo';

export interface ChainRewardForecastCue {
    actionLabel: 'Next' | 'Soon' | 'Later';
    chaseLabel: 'Hit now' | 'Prime' | 'Hold streak';
    distance: number;
    distanceLabel: string;
    id: string;
    label: string;
    stackSize?: number;
    targetStreak: number;
    tone: 'reward';
    urgency: 'next' | 'soon' | 'later';
}

interface ChainRewardProgress {
    filled: number;
    label: string;
    remainingLabel: string;
    targetLabel: string;
    total: number;
}

interface ChainMilestonePreview {
    actionLabel: 'Start chain' | 'Push surge' | 'Push combo' | 'Hold combo';
    distance: number;
    distanceLabel: string;
    label: 'Chain tier' | 'Surge tier' | 'Combo tier' | 'Combo max';
    target: 'x3' | 'x6' | 'x10';
    tone: ChainMomentumTier;
}

export const getChainMomentumTier = (streak: number): ChainMomentumTier => {
    const safeStreak = runNonNegativeInteger(streak);
    if (safeStreak >= 10) return 'combo';
    if (safeStreak >= 6) return 'surge';
    if (safeStreak >= 3) return 'chain';
    return 'building';
};

export const getChainMomentumLabel = (tier: ChainMomentumTier): string => {
    switch (tier) {
        case 'combo':
            return 'Combo';
        case 'surge':
            return 'Surge';
        case 'chain':
            return 'Chain';
        default:
            return 'Priming';
    }
};

export const getChainMomentumCue = (streak?: number): string => {
    const depth = runNonNegativeInteger(streak);
    if (depth < 3) {
        return '';
    }
    if (depth >= 10) {
        return 'Combo live';
    }
    if (depth >= 6) {
        const distance = Math.max(1, 10 - depth);
        return `${distance} ${distance === 1 ? 'match' : 'matches'} to x10`;
    }
    const distance = Math.max(1, 6 - depth);
    return `${distance} ${distance === 1 ? 'match' : 'matches'} to x6`;
};

export const getChainMomentumSubline = (streak: number, traitRouteActive: boolean): string => {
    if (traitRouteActive) {
        return 'Trait route live';
    }
    const safeStreak = runNonNegativeInteger(streak);
    const earlyDistance = Math.max(1, 3 - safeStreak);
    return getChainMomentumCue(streak) || `${earlyDistance} ${earlyDistance === 1 ? 'match' : 'matches'} to x3`;
};

export const getChainMilestonePreview = (streak: number): ChainMilestonePreview => {
    const safeStreak = runNonNegativeInteger(streak);
    if (safeStreak >= 10) {
        return {
            actionLabel: 'Hold combo',
            distance: 0,
            distanceLabel: 'Combo max',
            label: 'Combo max',
            target: 'x10',
            tone: 'combo'
        };
    }
    if (safeStreak >= 6) {
        const distance = Math.max(1, 10 - safeStreak);
        return {
            actionLabel: 'Push combo',
            distance,
            distanceLabel: `${distance} ${distance === 1 ? 'match' : 'matches'}`,
            label: 'Combo tier',
            target: 'x10',
            tone: 'surge'
        };
    }
    if (safeStreak >= 3) {
        const distance = Math.max(1, 6 - safeStreak);
        return {
            actionLabel: 'Push surge',
            distance,
            distanceLabel: `${distance} ${distance === 1 ? 'match' : 'matches'}`,
            label: 'Surge tier',
            target: 'x6',
            tone: 'chain'
        };
    }
    const distance = Math.max(1, 3 - safeStreak);
    return {
        actionLabel: 'Start chain',
        distance,
        distanceLabel: `${distance} ${distance === 1 ? 'match' : 'matches'}`,
        label: 'Chain tier',
        target: 'x3',
        tone: 'building'
    };
};

const nextMultipleAfter = (streak: number, step: number): number => {
    const safeStreak = runNonNegativeInteger(streak);
    return Math.max(step, Math.ceil((safeStreak + 1) / step) * step);
};

const chainRewardStackSize = (stackSize: number | undefined): number =>
    Math.max(1, runNonNegativeInteger(stackSize ?? 1));

export const getChainRewardProgress = (
    streak: number,
    cue: ChainRewardForecastCue | null | undefined
): ChainRewardProgress | null => {
    if (!cue) {
        return null;
    }
    const safeStreak = runNonNegativeInteger(streak);
    const total = COMBO_SHARD_STREAK_STEP;
    const previousTarget = Math.max(0, cue.targetStreak - total);
    const filled = Math.max(0, Math.min(total, safeStreak - previousTarget));
    const remaining = Math.max(0, cue.targetStreak - safeStreak);
    const remainingLabel = remaining === 1 ? '1 match left' : `${remaining} matches left`;
    return {
        filled,
        label: `${filled}/${total}`,
        remainingLabel,
        targetLabel: cue.label,
        total
    };
};

export const getChainRewardUrgencyCopy = (cue: Pick<ChainRewardForecastCue, 'distance' | 'stackSize' | 'tone' | 'urgency'>): string => {
    const stackSize = chainRewardStackSize(cue.stackSize);
    if (stackSize >= 3) {
        if (cue.urgency === 'next') return 'Triple cashout';
        if (cue.urgency === 'soon') return 'Triple prime';
        return 'Future super stack';
    }
    if (stackSize >= 2) {
        if (cue.urgency === 'next') return 'Double cashout';
        if (cue.urgency === 'soon') return 'Double prime';
        return 'Future stack';
    }
    if (cue.urgency === 'next') {
        return 'One-away cashout';
    }
    if (cue.urgency === 'soon') {
        return 'Combo prime';
    }
    return cue.distance <= 5 ? 'Combo chase' : 'Future payoff';
};

export const getChainRewardStackLabel = (cue: Pick<ChainRewardForecastCue, 'stackSize'>): string | null => {
    const stackSize = chainRewardStackSize(cue.stackSize);
    return stackSize >= 2 ? `${stackSize}x stack` : null;
};

export const getChainRewardLaneAction = (
    urgency: ChainRewardForecastCue['urgency']
): 'Cash next' | 'Prime cashout' | 'Hold streak' => {
    if (urgency === 'next') {
        return 'Cash next';
    }
    if (urgency === 'soon') {
        return 'Prime cashout';
    }
    return 'Hold streak';
};

/**
 * The chain's next payoff: the shard the next streak step banks, or nothing once the bank is full.
 * Guard tokens and the chain heal were the other two lanes here until Gen 183; with no lives to
 * protect or restore, the shard is the only thing a chain still pays out.
 */
export const getChainRewardForecastCues = (streak: number, comboShards: number): ChainRewardForecastCue[] => {
    if (runNonNegativeInteger(comboShards) >= MAX_COMBO_SHARDS) {
        return [];
    }
    const safeStreak = runNonNegativeInteger(streak);
    const targetStreak = nextMultipleAfter(streak, COMBO_SHARD_STREAK_STEP);
    const distance = Math.max(1, targetStreak - safeStreak);
    const urgency = distance <= 1 ? 'next' : distance <= 3 ? 'soon' : 'later';
    return [
        {
            actionLabel: urgency === 'next' ? 'Next' : urgency === 'soon' ? 'Soon' : 'Later',
            chaseLabel: urgency === 'next' ? 'Hit now' : urgency === 'soon' ? 'Prime' : 'Hold streak',
            distance,
            distanceLabel: distance === 1 ? '1 match' : `${distance} matches`,
            id: `shard-${targetStreak}`,
            label: `x${targetStreak} +1 shard`,
            targetStreak,
            tone: 'reward',
            urgency
        }
    ];
};
