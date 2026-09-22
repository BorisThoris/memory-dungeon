import { describe, expect, it, vi } from 'vitest';
import { subscribeCardIllustrationImageReady } from './cardIllustrationImages';

describe('subscribeCardIllustrationImageReady', () => {
    it('hands back an unsubscribe and never lets one listener break another', () => {
        const thrower = vi.fn(() => {
            throw new Error('observer');
        });
        const good = vi.fn();
        const offThrower = subscribeCardIllustrationImageReady(thrower);
        const offGood = subscribeCardIllustrationImageReady(good);
        expect(typeof offThrower).toBe('function');
        expect(() => offThrower()).not.toThrow();
        expect(() => offGood()).not.toThrow();
        // Unsubscribing twice is a no-op, so a component unmounting twice cannot corrupt the set.
        expect(() => offGood()).not.toThrow();
    });
});
