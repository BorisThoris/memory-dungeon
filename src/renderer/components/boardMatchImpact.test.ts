import { describe, expect, it } from 'vitest';
import { beginMatchImpact, MATCH_CONTACT_SECONDS, sampleMatchImpact } from './boardMatchImpact';

describe('match contact choreography', () => {
    it('shares the committed onset with the card without restarting a clear or replaying a restored card', () => {
        const frame = { matchedVictoryBurstT0Ref: { current: null as number | null }, prevTileMatchedRef: { current: false } };
        beginMatchImpact(frame, 10);
        beginMatchImpact(frame, 10.1);
        expect(frame.matchedVictoryBurstT0Ref.current).toBe(10);
        expect(frame.prevTileMatchedRef.current).toBe(true);
        frame.matchedVictoryBurstT0Ref.current = null;
        beginMatchImpact(frame, 20);
        expect(frame.matchedVictoryBurstT0Ref.current).toBeNull();
    });
    it('lifts before falling into contact, compresses on contact, then settles', () => {
        expect(sampleMatchImpact(0, false).z).toBe(0);
        expect(sampleMatchImpact(0.065, false).z).toBeCloseTo(0.18);
        const contact = sampleMatchImpact(MATCH_CONTACT_SECONDS, false);
        expect(contact.z).toBeLessThan(0);
        expect(contact.scaleX).toBeGreaterThan(1);
        expect(contact.scaleY).toBeLessThan(1);
        expect(Math.abs(sampleMatchImpact(0.35, false).z)).toBeLessThan(Math.abs(contact.z));
        expect(sampleMatchImpact(1, false)).toEqual({ z: 0, scaleX: 1, scaleY: 1 });
    });

    it('never moves or squashes cards with reduced motion', () => {
        for (const seconds of [0, 0.05, 0.14, 0.2, 0.4]) {
            expect(sampleMatchImpact(seconds, true)).toEqual({ z: 0, scaleX: 1, scaleY: 1 });
        }
    });
});
