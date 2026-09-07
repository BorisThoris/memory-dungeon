import { describe, expect, it } from 'vitest';
import {
    createMemorizeSkipTapState,
    MEMORIZE_SKIP_TAP_WINDOW_MS,
    registerMemorizeSkipTap
} from './memorizeSkipGesture';

describe('the study-period skip gesture', () => {
    it('does not end the phase on one tap', () => {
        expect(registerMemorizeSkipTap(createMemorizeSkipTapState(), 1_000).skip).toBe(false);
    });

    it('ends the phase on a second tap inside the window', () => {
        const first = registerMemorizeSkipTap(createMemorizeSkipTapState(), 1_000);

        expect(registerMemorizeSkipTap(first.state, 1_000 + MEMORIZE_SKIP_TAP_WINDOW_MS).skip).toBe(true);
    });

    it('treats a slow second tap as a fresh first tap', () => {
        const first = registerMemorizeSkipTap(createMemorizeSkipTapState(), 1_000);
        const late = registerMemorizeSkipTap(first.state, 1_000 + MEMORIZE_SKIP_TAP_WINDOW_MS + 1);

        expect(late.skip).toBe(false);
        expect(late.state.lastTapAtMs).toBe(1_000 + MEMORIZE_SKIP_TAP_WINDOW_MS + 1);
    });

    it('needs two more taps after a skip rather than firing on every later tap', () => {
        const first = registerMemorizeSkipTap(createMemorizeSkipTapState(), 1_000);
        const skipped = registerMemorizeSkipTap(first.state, 1_100);

        expect(skipped.state.lastTapAtMs).toBeNull();
        expect(registerMemorizeSkipTap(skipped.state, 1_150).skip).toBe(false);
    });
});
