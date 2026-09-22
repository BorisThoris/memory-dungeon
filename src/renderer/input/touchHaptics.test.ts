import { describe, expect, it, vi } from 'vitest';
import { STUDY_CLOSING_TAP_MS, tapStudyClosing } from './touchHaptics';

describe('tapStudyClosing', () => {
    it('taps once, briefly: this fires inside the player\'s concentration', () => {
        const vibrate = vi.fn(() => true);
        expect(tapStudyClosing(false, { vibrate })).toBe(true);
        expect(vibrate).toHaveBeenCalledTimes(1);
        expect(vibrate).toHaveBeenCalledWith(STUDY_CLOSING_TAP_MS);
        // A tick in the hand, not a buzz. Anything a player would describe as vibrating is too long.
        expect(STUDY_CLOSING_TAP_MS).toBeLessThan(30);
    });

    it('is silent under reduce motion, and never asks the device first', () => {
        // The setting is this game's one switch for "less shaking", and a buzz in the hand is
        // shaking. It leaves a reduce-motion player on a muted phone with only the bar, which is
        // the honest trade — the setting is a request, not an oversight to route around.
        const vibrate = vi.fn(() => true);
        expect(tapStudyClosing(true, { vibrate })).toBe(false);
        expect(vibrate).not.toHaveBeenCalled();
    });

    it('is a silent no-op wherever the device cannot or will not', () => {
        // A desktop browser without the API, and a phone that declines because the page has had no
        // user gesture yet — neither is an error, and neither may take the caller down with it.
        expect(tapStudyClosing(false, { vibrate: null })).toBe(false);
        expect(tapStudyClosing(false, { vibrate: () => false })).toBe(false);
        expect(
            tapStudyClosing(false, {
                vibrate: () => {
                    throw new Error('NotAllowedError');
                }
            })
        ).toBe(false);
    });

    it('finds the real API when no override is passed, and shrugs when there is none', () => {
        const original = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
        try {
            const vibrate = vi.fn(() => true);
            Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
            expect(tapStudyClosing(false)).toBe(true);
            expect(vibrate).toHaveBeenCalledWith(STUDY_CLOSING_TAP_MS);

            Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
            expect(tapStudyClosing(false)).toBe(false);
        } finally {
            if (original) {
                Object.defineProperty(navigator, 'vibrate', original);
            } else {
                Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'vibrate');
            }
        }
    });
});
