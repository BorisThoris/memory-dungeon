import {
    CHAIN_HEAL_STREAK_STEP,
    COMBO_GUARD_STREAK_STEP,
    MAX_COMBO_SHARDS,
    MAX_LIVES
} from '../../shared/contracts';
import { COMBO_SHARDS_PER_LIFE, COMBO_SHARD_STREAK_STEP } from '../../shared/combo-shard-rules';

export type ChainMomentumTier = 'building' | 'chain' | 'surge' | 'combo';

export interface ChainRewardForecastCue {
    actionLabel: 'Next' | 'Soon' | 'Later';
    chaseLabel: 'Hit now' | 'Prime' | 'Hold streak';
    distance: number;
    distanceLabel: string;
    id: string;
    label: string;
    stackSize?: number;
    targetStreak: number;
    tone: 'reward' | 'guard' | 'heal';
    urgency: 'next' | 'soon' | 'later';
}

export interface ChainRewardProgress {
    filled: number;
    label: string;
    remainingLabel: string;
    targetLabel: string;
    total: number;
}

export interface ChainMilestonePreview {
    actionLabel: 'Start chain' | 'Push surge' | 'Push combo' | 'Hold combo';
    distance: number;
    distanceLabel: string;
    label: 'Chain tier' | 'Surge tier' | 'Combo tier' | 'Combo max';
    target: 'x3' | 'x6' | 'x10';
    tone: ChainMomentumTier;
}

export const getChainMomentumTier = (streak: number): ChainMomentumTier => {
    if (streak >= 10) return 'combo';
    if (streak >= 6) return 'surge';
    if (streak >= 3) return 'chain';
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
    if (streak == null || !Number.isFinite(streak) || streak < 3) {
        return '';
    }
    const depth = Math.floor(streak);
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
    const safeStreak = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0));
    const earlyDistance = Math.max(1, 3 - safeStreak);
    return getChainMomentumCue(streak) || `${earlyDistance} ${earlyDistance === 1 ? 'match' : 'matches'} to x3`;
};

export const getChainMilestonePreview = (streak: number): ChainMilestonePreview => {
    const safeStreak = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0));
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
    const safeStreak = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0));
    return Math.max(step, Math.ceil((safeStreak + 1) / step) * step);
};

const stepForRewardCue = (cue: ChainRewardForecastCue): number => {
    if (cue.id.startsWith('guard-')) {
        return COMBO_GUARD_STREAK_STEP;
    }
    if (cue.id.startsWith('heal-')) {
        return CHAIN_HEAL_STREAK_STEP;
    }
    return COMBO_SHARD_STREAK_STEP;
};

export const getChainRewardProgress = (
    streak: number,
    cue: ChainRewardForecastCue | null | undefined
): ChainRewardProgress | null => {
    if (!cue) {
        return null;
    }
    const safeStreak = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0));
    const total = stepForRewardCue(cue);
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
    const stackSize = Math.max(1, Math.floor(cue.stackSize ?? 1));
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
        return cue.tone === 'heal' ? 'One-away heal' : cue.tone === 'guard' ? 'One-away guard' : 'One-away cashout';
    }
    if (cue.urgency === 'soon') {
        return cue.tone === 'heal' ? 'Heal prime' : cue.tone === 'guard' ? 'Guard prime' : 'Combo prime';
    }
    return cue.distance <= 5 ? 'Combo chase' : 'Future payoff';
};

export const getChainRewardStackLabel = (cue: Pick<ChainRewardForecastCue, 'stackSize'>): string | null => {
    const stackSize = Math.max(1, Math.floor(cue.stackSize ?? 1));
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

export const getChainRewardForecastCues = (
    streak: number,
    comboShards: number,
    lives: number
): ChainRewardForecastCue[] => {
    const shardStreak = nextMultipleAfter(streak, COMBO_SHARD_STREAK_STEP);
    const guardStreak = nextMultipleAfter(streak, COMBO_GUARD_STREAK_STEP);
    const healStreak = nextMultipleAfter(streak, CHAIN_HEAL_STREAK_STEP);
    const cues: ChainRewardForecastCue[] = [];
    const safeStreak = Math.max(0, Math.floor(Number.isFinite(streak) ? streak : 0));
    const safeComboShards = Math.max(0, Math.floor(Number.isFinite(comboShards) ? comboShards : 0));
    const safeLives = Math.max(0, Math.floor(Number.isFinite(lives) ? lives : 0));
    const cueMeta = (
        targetStreak: number
    ): Pick<ChainRewardForecastCue, 'actionLabel' | 'chaseLabel' | 'distance' | 'distanceLabel' | 'targetStreak' | 'urgency'> => {
        const distance = Math.max(1, targetStreak - safeStreak);
        const urgency = distance <= 1 ? 'next' : distance <= 3 ? 'soon' : 'later';
        return {
            actionLabel: urgency === 'next' ? 'Next' : urgency === 'soon' ? 'Soon' : 'Later',
            chaseLabel: urgency === 'next' ? 'Hit now' : urgency === 'soon' ? 'Prime' : 'Hold streak',
            distance,
            distanceLabel: distance === 1 ? '1 match' : `${distance} matches`,
            targetStreak,
            urgency
        };
    };

    if (safeComboShards >= COMBO_SHARDS_PER_LIFE - 1 && safeLives < MAX_LIVES) {
        cues.push({
            ...cueMeta(shardStreak),
            id: `shard-life-${shardStreak}`,
            label: `x${shardStreak} +1 life`,
            tone: 'heal'
        });
    } else if (safeComboShards < MAX_COMBO_SHARDS) {
        cues.push({
            ...cueMeta(shardStreak),
            id: `shard-${shardStreak}`,
            label: `x${shardStreak} +1 shard`,
            tone: 'reward'
        });
    }

    cues.push({
        ...cueMeta(guardStreak),
        id: `guard-${guardStreak}`,
        label: `x${guardStreak} +1 guard`,
        tone: 'guard'
    });

    if (safeLives < MAX_LIVES) {
        cues.push({
            ...cueMeta(healStreak),
            id: `heal-${healStreak}`,
            label: `x${healStreak} +1 life`,
            tone: 'heal'
        });
    }

    const dedupedCues = cues
        .filter((cue, index, all) => all.findIndex((candidate) => candidate.label === cue.label) === index)
        .sort((a, b) => {
            const aMatch = Number(a.label.match(/^x(\d+)/)?.[1] ?? 0);
            const bMatch = Number(b.label.match(/^x(\d+)/)?.[1] ?? 0);
            return aMatch - bMatch;
        });
    const stackSizeByTarget = new Map<number, number>();
    for (const cue of dedupedCues) {
        stackSizeByTarget.set(cue.targetStreak, (stackSizeByTarget.get(cue.targetStreak) ?? 0) + 1);
    }
    return dedupedCues
        .map((cue) => {
            const stackSize = stackSizeByTarget.get(cue.targetStreak) ?? 1;
            return stackSize > 1 ? { ...cue, stackSize } : cue;
        })
        .slice(0, 3);
};
