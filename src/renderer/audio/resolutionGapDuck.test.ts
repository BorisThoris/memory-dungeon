import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import type { RunState } from '../../shared/contracts';
import { getReg114DuckRow } from './audioMixDuckingPolicy';
import { RESOLUTION_GAP_DUCK_MULTIPLIER, resolutionGapDuckMultiplier } from './resolutionGapDuck';

describe('the resolution gap duck', () => {
    const playing = (): RunState => finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));

    it('dips the music only while a turn is unresolved', () => {
        const run = playing();
        expect(resolutionGapDuckMultiplier(run)).toBe(1);
        expect(resolutionGapDuckMultiplier({ ...run, status: 'resolving' })).toBe(RESOLUTION_GAP_DUCK_MULTIPLIER);
        expect(resolutionGapDuckMultiplier({ ...run, status: 'memorize' })).toBe(1);
        expect(resolutionGapDuckMultiplier(null)).toBe(1);
    });

    it('is a slight dip, quieter than nothing and louder than the Fever duck', () => {
        // Thesis §46.4: "duck slightly". A bed that vanished on every second flip would read as a
        // fault, and a dip deeper than the Fever break's would make the gap bigger than the payoff.
        const fever = getReg114DuckRow('fever_break')?.musicVolumeMultiplier ?? 0;
        expect(RESOLUTION_GAP_DUCK_MULTIPLIER).toBeLessThan(1);
        expect(RESOLUTION_GAP_DUCK_MULTIPLIER).toBeGreaterThan(fever);
    });
});
