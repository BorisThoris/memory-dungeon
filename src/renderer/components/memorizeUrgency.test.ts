import { describe, expect, it } from 'vitest';
import { MEMORIZE_CLOSING_FROM, MEMORIZE_URGENT_FROM, memorizeUrgency } from './memorizeUrgency';

describe('memorizeUrgency', () => {
    it('leaves the player alone for the part of the window that is for looking', () => {
        // Memorizing is the work. A countdown that looks urgent from the start is pressure applied
        // to the exact activity it is supposed to be timing.
        expect(memorizeUrgency(0).level).toBe(0);
        expect(memorizeUrgency(0.3).level).toBe(0);
        expect(memorizeUrgency(MEMORIZE_URGENT_FROM).level).toBe(0);
        expect(memorizeUrgency(0.5).closing).toBe(false);
    });

    it('accelerates shut rather than crossing at a second constant rate', () => {
        // The bar beside it is already linear. If this were linear too it would say nothing the
        // bar's own width does not, which is the whole reason the last seconds read as flat today.
        const early = memorizeUrgency(0.75).level - memorizeUrgency(MEMORIZE_URGENT_FROM).level;
        const late = memorizeUrgency(1).level - memorizeUrgency(0.93).level;
        expect(late).toBeGreaterThan(early);
        expect(memorizeUrgency(1).level).toBe(1);
    });

    it('calls the window closing only at the end of it, and stays closed once it is', () => {
        expect(memorizeUrgency(MEMORIZE_CLOSING_FROM - 0.01).closing).toBe(false);
        expect(memorizeUrgency(MEMORIZE_CLOSING_FROM).closing).toBe(true);
        expect(memorizeUrgency(1).closing).toBe(true);
        // Closing is strictly inside the urgent stretch: the colour never arrives before the rise.
        expect(MEMORIZE_CLOSING_FROM).toBeGreaterThan(MEMORIZE_URGENT_FROM);
    });

    it('climbs without stepping back', () => {
        let previous = -1;
        for (let p = 0; p <= 1.0001; p += 0.02) {
            const level = memorizeUrgency(p).level;
            expect(level).toBeGreaterThanOrEqual(previous);
            previous = level;
        }
    });

    it('reads a broken clock as a window that has just opened, not one about to shut', () => {
        // A missing snapshot gives progress 0; garbage must not flash the head red on arrival.
        for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -4]) {
            expect(memorizeUrgency(bad)).toEqual({ level: 0, closing: false });
        }
        expect(memorizeUrgency(9)).toEqual(memorizeUrgency(1));
    });
});
