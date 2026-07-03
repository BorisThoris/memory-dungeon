import { describe, expect, it } from 'vitest';
import { formatChainOpportunityBeatLabel, getChainOpportunityBeatSignal } from './chainOpportunityBeat';

const baseContext = {
    chainReadyCount: 0,
    comboSurgeLabel: null,
    followupReady: false,
    nextTarget: null,
    readyCardLabel: null,
    readyRouteLabel: null,
    rewardCue: null,
    rewardHot: false,
    selectedFollowupLabel: null,
    setupAction: null,
    setupCount: 0,
    streakCashoutReady: false
};

describe('getChainOpportunityBeatSignal', () => {
    it('returns null when no chain opportunity is active', () => {
        expect(getChainOpportunityBeatSignal(baseContext)).toBeNull();
    });

    it('uses a two-beat prime signal for setup targets', () => {
        expect(getChainOpportunityBeatSignal({ ...baseContext, setupAction: 'Use swap', setupCount: 2 })).toEqual({
            action: 'Prime route',
            audioCue: 'setup-beat',
            beatCount: 2,
            cue: 'pulse',
            detail: 'Use swap',
            label: 'Prime beat',
            screenCue: 'pulse',
            tier: 'setup'
        });
    });

    it('uses a three-beat route signal for playable routes', () => {
        expect(
            getChainOpportunityBeatSignal({
                ...baseContext,
                chainReadyCount: 1,
                readyRouteLabel: '1 route ready'
            })
        ).toEqual({
            action: 'Match route',
            audioCue: 'route-beat',
            beatCount: 3,
            cue: 'snap',
            detail: '1 route ready',
            label: 'Route beat',
            screenCue: 'snap',
            tier: 'route'
        });
    });

    it('uses a three-beat follow-up signal for selected followups', () => {
        expect(
            getChainOpportunityBeatSignal({
                ...baseContext,
                followupReady: true,
                selectedFollowupLabel: '1 follow-up marked'
            })
        ).toMatchObject({
            action: 'Tap follow-up',
            audioCue: 'follow-up-beat',
            beatCount: 3,
            detail: '1 follow-up marked',
            label: 'Follow-up beat',
            screenCue: 'snap',
            tier: 'follow-up'
        });
    });

    it('uses a four-beat surge signal for multi-route combo surge', () => {
        expect(
            getChainOpportunityBeatSignal({
                ...baseContext,
                chainReadyCount: 5,
                comboSurgeLabel: 'Combo surge',
                readyRouteLabel: '5 routes ready'
            })
        ).toMatchObject({
            action: 'Chain routes',
            audioCue: 'surge-beat',
            beatCount: 4,
            cue: 'burst',
            detail: '5 routes ready',
            label: 'Surge beat',
            screenCue: 'burst',
            tier: 'surge'
        });
    });

    it('uses the maximum beat signal for live cashouts', () => {
        expect(
            getChainOpportunityBeatSignal({
                ...baseContext,
                nextTarget: 'Match lit route for reward',
                rewardHot: true
            })
        ).toEqual({
            action: 'Cash out',
            audioCue: 'cashout-beat',
            beatCount: 5,
            cue: 'super',
            detail: 'Match lit route for reward',
            label: 'Cashout beat',
            screenCue: 'super',
            tier: 'cashout'
        });
    });

    it('formats accessible labels', () => {
        const signal = getChainOpportunityBeatSignal({ ...baseContext, setupAction: 'Use swap', setupCount: 2 });
        expect(signal && formatChainOpportunityBeatLabel(signal)).toBe('Prime beat: Prime route. 2 beats. Use swap.');
    });
});
