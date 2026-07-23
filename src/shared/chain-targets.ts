import { runNonNegativeInteger } from './run-number-guards';

export type ChainTargetBand = 'seed' | 'reward' | 'combo' | 'mastery';

export interface ChainTargetFeedback {
    band: ChainTargetBand;
    bestStreak: number;
    value: string;
    detail: string;
    actionHint: string;
    payoffLabel: string;
    payoffValue: string;
}

export const getChainTargetFeedback = (bestStreakInput: number | null | undefined): ChainTargetFeedback => {
    const bestStreak = runNonNegativeInteger(bestStreakInput);
    if (bestStreak >= 10) {
        return {
            band: 'mastery',
            bestStreak,
            value: 'Hold x10 pressure',
            detail: `Best chain x${bestStreak}; keep the combo engine alive while routing pickups and side rewards.`,
            actionHint: 'Use early safe pairs to bank momentum, then spend tools to protect the chain.',
            payoffLabel: 'Chain mastery',
            payoffValue: 'hold x10'
        };
    }
    if (bestStreak >= 6) {
        return {
            band: 'combo',
            bestStreak,
            value: 'Break into x10',
            detail: `Best chain x${bestStreak}; one cleaner floor can turn reward-threshold chains into a combo-tier burst.`,
            actionHint: 'Prioritize visible pairs and use peek/shuffle before the chain drops.',
            payoffLabel: 'Chain chase',
            payoffValue: 'x10 next'
        };
    }
    if (bestStreak >= 3) {
        return {
            band: 'reward',
            bestStreak,
            value: 'Push x6 reward',
            detail: `Best chain x${bestStreak}; extend the x3 reward loop before chasing greedy pickups.`,
            actionHint: 'Open with confirmed pairs, then convert tools into one longer streak.',
            payoffLabel: 'Chain chase',
            payoffValue: 'x6 next'
        };
    }
    return {
        band: 'seed',
        bestStreak,
        value: 'Start x3 loop',
        detail: bestStreak > 0 ? `Best chain x${bestStreak}; reach x3 to make rewards feel online.` : 'No chain started; reach x3 to turn matching into a reward engine.',
        actionHint: 'Memorize one cluster first, then clear those pairs before risky exploration.',
        payoffLabel: 'Chain chase',
        payoffValue: 'x3 next'
    };
};
