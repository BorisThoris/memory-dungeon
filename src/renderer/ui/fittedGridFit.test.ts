import { describe, expect, it } from 'vitest';
import { MIN_CLICKABLE_ROW_HEIGHT, computeGridFit, growRowHeight } from './fittedGridFit';

const base = { frameHeight: 340, frameWidth: 947, gap: 10, minColumnWidth: 260, rowHeight: 152 };

describe('computeGridFit', () => {
    it('fits as many whole columns and rows as the frame holds', () => {
        expect(computeGridFit(base)).toEqual({ columns: 3, rowHeight: 152, rows: 2 });
    });

    it('always offers one column and one row, even in a frame too small for either', () => {
        const fit = computeGridFit({ ...base, frameHeight: 40, frameWidth: 100 });
        expect(fit.columns).toBe(1);
        expect(fit.rows).toBe(1);
    });

    it('shrinks the single row to the frame instead of clipping past it', () => {
        // Choose Your Path at 1280x768: a 132px frame was rendering a 152px row.
        const fit = computeGridFit({ ...base, frameHeight: 132 });
        expect(fit.rows).toBe(1);
        expect(fit.rowHeight).toBe(132);
        expect(fit.rowHeight).toBeLessThanOrEqual(132);
    });

    it('never renders a row taller than the frame that clips it', () => {
        // The old floor of 88 painted a card half outside a 60px frame, and its middle — the point
        // a click lands on — sat under the pager, so the card did nothing when pressed.
        expect(computeGridFit({ ...base, frameHeight: 60 }).rowHeight).toBe(60);
    });

    it('stops shrinking where a row stops being a tap target', () => {
        expect(computeGridFit({ ...base, frameHeight: 20 }).rowHeight).toBe(MIN_CLICKABLE_ROW_HEIGHT);
    });

    it('leaves a row that already fits exactly alone', () => {
        expect(computeGridFit({ ...base, frameHeight: 152 }).rowHeight).toBe(152);
    });
});

describe('growRowHeight', () => {
    it('grows a short page to use the space it was given', () => {
        const fit = computeGridFit(base);
        expect(growRowHeight(fit, 3, 10, 340)).toBe(243);
    });

    it('caps the growth so three cards do not become three billboards', () => {
        const fit = computeGridFit({ ...base, frameHeight: 900 });
        expect(growRowHeight(fit, 1, 10, 900)).toBe(Math.floor(152 * 1.6));
    });

    it('leaves a full page at its measured row height', () => {
        const fit = computeGridFit(base);
        expect(growRowHeight(fit, 6, 10, 340)).toBe(152);
    });

    it('never grows a row past the shrunk height a tight frame forced', () => {
        const fit = computeGridFit({ ...base, frameHeight: 132 });
        expect(growRowHeight(fit, 3, 10, 132)).toBe(132);
    });
});
