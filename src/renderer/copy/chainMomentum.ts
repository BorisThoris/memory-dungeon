import { plural, tr } from '../../shared/i18n';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

type ChainMomentumTier = 'building' | 'chain' | 'surge' | 'combo';

interface ChainMilestonePreview {
    actionLabel: string;
    distance: number;
    distanceLabel: string;
    label: string;
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
            return tr.s('Combo');
        case 'surge':
            return tr.s('Surge');
        case 'chain':
            return tr.s('Chain');
        default:
            return tr.s('Priming');
    }
};

export const getChainMomentumCue = (streak?: number): string => {
    const depth = runNonNegativeInteger(streak);
    if (depth < 3) {
        return '';
    }
    if (depth >= 10) {
        return tr.s('Combo live');
    }
    if (depth >= 6) {
        const distance = Math.max(1, 10 - depth);
        return tr`${plural(distance, { one: '{0} match', other: '{0} matches' })} to x10`;
    }
    const distance = Math.max(1, 6 - depth);
    return tr`${plural(distance, { one: '{0} match', other: '{0} matches' })} to x6`;
};

export const getChainMomentumSubline = (streak: number, traitRouteActive: boolean): string => {
    if (traitRouteActive) {
        return tr.s('Trait route live');
    }
    const safeStreak = runNonNegativeInteger(streak);
    const earlyDistance = Math.max(1, 3 - safeStreak);
    return getChainMomentumCue(streak) || tr`${plural(earlyDistance, { one: '{0} match', other: '{0} matches' })} to x3`;
};

export const getChainMilestonePreview = (streak: number): ChainMilestonePreview => {
    const safeStreak = runNonNegativeInteger(streak);
    if (safeStreak >= 10) {
        return {
            actionLabel: tr.s('Hold combo'),
            distance: 0,
            distanceLabel: tr.s('Combo max'),
            label: tr.s('Combo max'),
            target: 'x10',
            tone: 'combo'
        };
    }
    if (safeStreak >= 6) {
        const distance = Math.max(1, 10 - safeStreak);
        return {
            actionLabel: tr.s('Push combo'),
            distance,
            distanceLabel: `${plural(distance, { one: '{0} match', other: '{0} matches' })}`,
            label: tr.s('Combo tier'),
            target: 'x10',
            tone: 'surge'
        };
    }
    if (safeStreak >= 3) {
        const distance = Math.max(1, 6 - safeStreak);
        return {
            actionLabel: tr.s('Push surge'),
            distance,
            distanceLabel: `${plural(distance, { one: '{0} match', other: '{0} matches' })}`,
            label: tr.s('Surge tier'),
            target: 'x6',
            tone: 'chain'
        };
    }
    const distance = Math.max(1, 3 - safeStreak);
    return {
        actionLabel: tr.s('Start chain'),
        distance,
        distanceLabel: `${plural(distance, { one: '{0} match', other: '{0} matches' })}`,
        label: tr.s('Chain tier'),
        target: 'x3',
        tone: 'building'
    };
};
