import { describe, expect, it } from 'vitest';
import { buildBoardOpportunitySurfaceState } from './tileBoardOpportunitySurfaceState';

describe('tileBoardOpportunitySurfaceState', () => {
    it('builds lane map, payoff stack, and compass surface data from rows', () => {
        const state = buildBoardOpportunitySurfaceState({
            chainHotBandTone: 'cashout',
            chainOpportunity: { comboSurgeLabel: 'Routes lit' },
            deps: {
                getActionId: (row) => (row?.action.toLowerCase().includes('cash') ? 'cashout' : 'route'),
                getAudio: (row) => (row.impactCue.includes('cashout') ? 'opportunity-cashout' : 'opportunity-prime'),
                getBeatCount: (row) => (row.impactCue.includes('cashout') ? 5 : 2),
                getCrescendoAudioCue: (tier) => `${tier}-audio`,
                getHeat: (impactCue) => (impactCue.includes('cashout') ? 'cashout' : 'prime'),
                getImpactCueId: (impactCue) => impactCue.replace(/\s+/g, '-'),
                getScreenCue: (row) => (row.impactCue.includes('cashout') ? 'burst' : 'pulse'),
                getSummaryAction: (row) => (row?.impactCue.includes('cashout') ? 'cashout' : 'route'),
                getSummaryTier: (row) => (row?.impactCue.includes('cashout') ? 'cashout' : 'route')
            },
            hazardOpportunity: null,
            rows: [
                {
                    action: 'Cash now',
                    detail: 'Two pairs are primed',
                    id: 'chain',
                    impactCue: 'route cashout',
                    label: 'Cash route',
                    tone: 'chain',
                    value: '2 pairs'
                },
                {
                    action: 'Prime build',
                    detail: 'Stack another route',
                    id: 'trait',
                    impactCue: 'route prime',
                    label: 'Prime route',
                    tone: 'setup',
                    value: '1 route'
                }
            ]
        });

        expect(state.boardBestOpportunity?.id).toBe('chain');
        expect(state.boardOpportunityLaneMapView.primaryLane?.id).toBe('cash');
        expect(state.boardOpportunityCompassView.hot).toBe('cashout');
        expect(state.boardOpportunityCompassView.surge).toBe('true');
        expect(state.boardOpportunityCompassView.rows).toHaveLength(2);
    });
});
