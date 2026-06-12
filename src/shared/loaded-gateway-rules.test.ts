import { describe, expect, it } from 'vitest';
import { createNewRun } from './game-core';
import { loadedGatewayRouteTypeFor } from './loaded-gateway-rules';

describe('loaded-gateway-rules', () => {
    it('chooses a deterministic greed or mystery route from run identity and pair key', () => {
        const run = createNewRun(0, { runSeed: 1234, runRulesVersionOverride: 77 });

        expect(loadedGatewayRouteTypeFor(run, 'gateway-a')).toBe(loadedGatewayRouteTypeFor(run, 'gateway-a'));
        expect(['greed', 'mystery']).toContain(loadedGatewayRouteTypeFor(run, 'gateway-a'));
    });

    it('falls back to highest level when a board is unavailable', () => {
        const run = {
            ...createNewRun(0, { runSeed: 1234, runRulesVersionOverride: 77 }),
            board: null
        };

        expect(['greed', 'mystery']).toContain(loadedGatewayRouteTypeFor(run, 'gateway-a'));
    });
});
