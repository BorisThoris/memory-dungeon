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

    it('creates a loaded gateway route plan before dungeon gateway plans', () => {
        const run = createNewRun(0, { runSeed: 1234, runRulesVersionOverride: 77 });

        const result = resolveTurnMatchFollowup({
            run,
            matchedPairKey: 'gateway-a',
            encoreKey: 'gateway-a',
            loadedGatewayClaimed: true,
            dungeonGatewayRouteType: 'safe'
        });

        expect(result.pendingRouteCardPlan?.choiceId).toBe('loaded_gateway:77:1234:1:gateway-a');
        expect(['greed', 'mystery']).toContain(result.pendingRouteCardPlan?.routeType);
        expect(result.pendingRouteCardPlan?.sourceLevel).toBe(1);
        expect(result.pendingRouteCardPlan?.targetLevel).toBe(2);
    });

    it('creates a dungeon gateway route plan when no loaded gateway is claimed', () => {
        const run = createNewRun(0, { runSeed: 4321, runRulesVersionOverride: 88 });

        const result = resolveTurnMatchFollowup({
            run,
            matchedPairKey: 'gateway-b',
            encoreKey: 'gateway-b',
            loadedGatewayClaimed: false,
            dungeonGatewayRouteType: 'mystery'
        });

        expect(result.pendingRouteCardPlan).toMatchObject({
            choiceId: 'gateway:88:4321:1:mystery',
            routeType: 'mystery',
            sourceLevel: 1,
            targetLevel: 2
        });
    });

    it('normalizes malformed stat records before building boardless gateway plan ids', () => {
        const run = {
            ...createNewRun(0, { runSeed: 4321, runRulesVersionOverride: 88 }),
            board: null,
            stats: Number.NaN as unknown as RunState['stats']
        };

        const result = resolveTurnMatchFollowup({
            run,
            matchedPairKey: 'gateway-b',
            encoreKey: 'gateway-b',
            loadedGatewayClaimed: false,
            dungeonGatewayRouteType: 'mystery'
        });

        expect(result.pendingRouteCardPlan).toMatchObject({
            choiceId: 'gateway:88:4321:1:mystery',
            sourceLevel: 1,
            targetLevel: 2
        });
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
