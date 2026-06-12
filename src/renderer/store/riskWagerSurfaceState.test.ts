import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import { createRiskWagerSurfaceResult } from './riskWagerSurfaceState';

describe('riskWagerSurfaceState', () => {
    it('ignores missing runs', () => {
        expect(createRiskWagerSurfaceResult(null)).toEqual({ kind: 'ignored' });
    });

    it('applies the wager rule for existing runs', () => {
        const run = createNewRun(0);
        const result = createRiskWagerSurfaceResult(run);

        expect(result.kind).toBe('applied');
        if (result.kind !== 'applied') {
            return;
        }
        expect(result.patch.run).toBe(run);
    });
});
