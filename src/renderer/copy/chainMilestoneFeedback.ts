export type ChainMilestoneFeedback = {
    action: 'Start chain' | 'Push surge' | 'Hold combo';
    audioCue: 'chain-start-ping' | 'surge-hit-ping' | 'combo-hit-ping';
    beatCount: 3 | 4 | 5;
    label: 'Chain started' | 'Surge hit' | 'Combo hit';
    screenCue: 'reward-loop' | 'surge-live' | 'combo-live';
    target: 'x3' | 'x6' | 'x10';
    tone: 'chain' | 'surge' | 'combo';
    value: string;
};

export const getChainMilestoneFeedback = (
    previousStreak: number,
    nextStreak: number
): ChainMilestoneFeedback | undefined => {
    const previous = Math.max(0, Math.floor(Number.isFinite(previousStreak) ? previousStreak : 0));
    const next = Math.max(0, Math.floor(Number.isFinite(nextStreak) ? nextStreak : 0));
    if (previous < 10 && next >= 10) {
        return {
            action: 'Hold combo',
            audioCue: 'combo-hit-ping',
            beatCount: 5,
            label: 'Combo hit',
            screenCue: 'combo-live',
            target: 'x10',
            tone: 'combo',
            value: 'Combo tier live'
        };
    }
    if (previous < 6 && next >= 6) {
        return {
            action: 'Push surge',
            audioCue: 'surge-hit-ping',
            beatCount: 4,
            label: 'Surge hit',
            screenCue: 'surge-live',
            target: 'x6',
            tone: 'surge',
            value: 'Surge tier live'
        };
    }
    if (previous < 3 && next >= 3) {
        return {
            action: 'Start chain',
            audioCue: 'chain-start-ping',
            beatCount: 3,
            label: 'Chain started',
            screenCue: 'reward-loop',
            target: 'x3',
            tone: 'chain',
            value: 'Reward loop online'
        };
    }
    return undefined;
};
