import { describe, expect, it } from 'vitest';
import { formatNextUtcReset } from './utc-countdown';

describe('formatNextUtcReset', () => {
    it('returns 00:00:00 at exactly one ms before UTC midnight', () => {
        const t = Date.UTC(2026, 3, 17, 23, 59, 59, 999);
        expect(formatNextUtcReset(t)).toBe('00:00:00');
    });

    it('never returns a negative-looking countdown (remaining is clamped at zero)', () => {
        const t = Date.UTC(2026, 3, 17, 18, 30, 0, 0);
        const s = formatNextUtcReset(t);
        expect(s).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        const [hh, mm, ss] = s.split(':').map(Number);
        expect(hh! * 3600 + mm! * 60 + ss!).toBeGreaterThanOrEqual(0);
    });

    it('formats a mid-day countdown with HH:MM:SS shape', () => {
        const noonUtc = Date.UTC(2026, 3, 17, 12, 0, 0, 0);
        const s = formatNextUtcReset(noonUtc);
        expect(s).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        expect(s).toBe('12:00:00');
    });

    it('uses UTC calendar date (month/year boundary)', () => {
        const newYearsEve = Date.UTC(2026, 11, 31, 12, 0, 0, 0);
        expect(formatNextUtcReset(newYearsEve)).toBe('12:00:00');
    });

    it('at UTC midnight, countdown is a full day until next UTC midnight', () => {
        const utcMidnight = Date.UTC(2026, 6, 4, 0, 0, 0, 0);
        expect(formatNextUtcReset(utcMidnight)).toBe('24:00:00');
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        'formats non-finite input as a safe zero countdown',
        (nowMs) => {
            expect(formatNextUtcReset(nowMs)).toBe('00:00:00');
        }
    );
});
