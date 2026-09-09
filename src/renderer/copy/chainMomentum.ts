import { runNonNegativeInteger } from '../../shared/run-number-guards';

type ChainMomentumTier = 'building' | 'chain' | 'surge' | 'combo';

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
