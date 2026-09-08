import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchFollowup } from './turn-match-followup-rules';

describe('resolveTurnMatchFollowup', () => {
    it('increments n-back counter without changing the anchor when the mutator is inactive', () => {
        const run = { ...createNewRun(0), nBackMatchCounter: 1, nBackAnchorPairKey: 'previous' };

        const result = resolveTurnMatchFollowup({
            run,
            matchedPairKey: 'sun',
            encoreKey: 'sun',
            loadedGatewayClaimed: false,
            dungeonGatewayRouteType: null
        });

        expect(result.nBackMatchCounter).toBe(2);
        expect(result.nBackAnchorPairKey).toBe('previous');
    });

    it('anchors every second match when n-back anchor is active', () => {
        const run = {
            ...createNewRun(0, { activeMutators: ['n_back_anchor'] }),
            nBackMatchCounter: 1,
            nBackAnchorPairKey: null
        };

        const result = resolveTurnMatchFollowup({
            run,
            matchedPairKey: 'moon',
            encoreKey: 'moon:encore',
            loadedGatewayClaimed: false,
            dungeonGatewayRouteType: null
        });

        expect(result.nBackMatchCounter).toBe(2);
        expect(result.nBackAnchorPairKey).toBe('moon:encore');
    });

    it('normalizes malformed n-back counters before advancing follow-up state', () => {
        const run = {
            ...createNewRun(0, { activeMutators: ['n_back_anchor'] }),
            nBackMatchCounter: Number.NaN,
            nBackAnchorPairKey: 'previous'
        };

        const result = resolveTurnMatchFollowup({
            run,
            matchedPairKey: 'star',
            encoreKey: 'star:encore',
            loadedGatewayClaimed: false,
            dungeonGatewayRouteType: null
        });

        expect(result.nBackMatchCounter).toBe(1);
        expect(result.nBackAnchorPairKey).toBe('previous');
    });




    it('preserves an existing pending route plan', () => {
        const run = {
            ...createNewRun(0),
            pendingRouteCardPlan: {
                choiceId: 'existing',
                routeType: 'safe' as const,
                sourceLevel: 3,
                targetLevel: 4
            }
        };

        const result = resolveTurnMatchFollowup({
            run,
            matchedPairKey: 'gateway-c',
            encoreKey: 'gateway-c',
            loadedGatewayClaimed: true,
            dungeonGatewayRouteType: 'greed'
        });

        expect(result.pendingRouteCardPlan).toBe(run.pendingRouteCardPlan);
    });
});
