import { describe, expect, it } from 'vitest';
import { isLegendaryBreak, PUSH_IN_BASE, PUSH_IN_CEILING, PUSH_IN_DAMPING, PUSH_IN_HOLD_SECONDS, PUSH_IN_SETTLE_SECONDS, pushInDamping, pushInDepth, pushInTarget } from './legendaryPushIn';

describe('legendaryPushIn', () => {
    it('fires on a break at Legendary, not on a plain match or below Legendary', () => {
        expect(isLegendaryBreak(10, 16, 25)).toBe(true);
        expect(isLegendaryBreak(10, 12, 40)).toBe(false);
        expect(isLegendaryBreak(10, 16, 24)).toBe(false);
    });

    it('pushes in while it holds and lets go after', () => {
        expect(pushInTarget(0, 25, false)).toBeCloseTo(1 + PUSH_IN_BASE);
        expect(pushInTarget(PUSH_IN_HOLD_SECONDS, 25, false)).toBe(1);
        expect(pushInTarget(null, 25, false)).toBe(1);
        expect(pushInTarget(0.2, 25, true)).toBe(1);
    });

    it('goes further with every link and never past its ceiling', () => {
        expect(pushInDepth(50)).toBeGreaterThan(pushInDepth(25));
        expect(pushInDepth(500)).toBeGreaterThan(pushInDepth(50));
        expect(pushInDepth(500) - pushInDepth(50)).toBeGreaterThan(0.01);
        expect(pushInDepth(1e7)).toBeLessThanOrEqual(1 + PUSH_IN_BASE + PUSH_IN_CEILING);
    });
});

describe('pushInDamping', () => {
    it('is slow through the hold and the settle, then hands back', () => {
        expect(pushInDamping(0.1, false)).toBe(PUSH_IN_DAMPING);
        expect(pushInDamping(PUSH_IN_HOLD_SECONDS + PUSH_IN_SETTLE_SECONDS - 0.01, false)).toBe(PUSH_IN_DAMPING);
        expect(pushInDamping(PUSH_IN_HOLD_SECONDS + PUSH_IN_SETTLE_SECONDS, false)).toBeNull();
        expect(pushInDamping(0.1, true)).toBeNull();
        expect(pushInDamping(null, false)).toBeNull();
    });
});
