import { runNonNegativeInteger } from '../../shared/run-number-guards';

export type ChainMilestoneFeedback = {
    action: 'Hold the chain' | 'Carry it into the next clump' | 'Keep the fire';
    audioCue: 'chain-start-ping' | 'surge-hit-ping' | 'combo-hit-ping';
    beatCount: 3 | 4 | 5;
    label: 'Clean reached' | 'Sharp reached' | 'Fever reached';
    screenCue: 'reward-loop' | 'surge-live' | 'combo-live';
    target: 'x3' | 'x6' | 'x10';
    tone: 'chain' | 'surge' | 'combo';
    value: string;
};

export const getChainMilestoneFeedback = (
    previousStreak: number,
    nextStreak: number
): ChainMilestoneFeedback | undefined => {
    const previous = runNonNegativeInteger(previousStreak);
    const next = runNonNegativeInteger(nextStreak);
    if (previous < 10 && next >= 10) {
        return {
            action: 'Keep the fire',
            audioCue: 'combo-hit-ping',
            beatCount: 5,
            label: 'Fever reached',
            screenCue: 'combo-live',
            target: 'x10',
            tone: 'combo',
            value: 'Breaks chain into three clumps'
        };
    }
    if (previous < 6 && next >= 6) {
        return {
            action: 'Carry it into the next clump',
            audioCue: 'surge-hit-ping',
            beatCount: 4,
            label: 'Sharp reached',
            screenCue: 'surge-live',
            target: 'x6',
            tone: 'surge',
            value: 'Breaks chain into the next clump'
        };
    }
    if (previous < 3 && next >= 3) {
        return {
            action: 'Hold the chain',
            audioCue: 'chain-start-ping',
            beatCount: 3,
            label: 'Clean reached',
            screenCue: 'reward-loop',
            target: 'x3',
            tone: 'chain',
            value: 'Breaks reach deeper into the clump'
        };
    }
    return undefined;
};
