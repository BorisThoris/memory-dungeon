import { describe, expect, it } from 'vitest';
import { MIN_CLICKABLE_ROW_HEIGHT, computeGridFit, growRowHeight, readFrameBox } from './fittedGridFit';

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

describe('readFrameBox', () => {
    /*
     * An element under a `zoom` has two boxes and they disagree by exactly the zoom: the rect is
     * visual, `clientWidth`/`clientHeight` are layout. This is the Profile ledger frame at a UI
     * scale of 1.4 on a 1280x800 panel, with both boxes as the browser actually reported them.
     */
    const zoomedFrame = {
        clientHeight: 132,
        clientWidth: 823,
        getBoundingClientRect: () => ({ height: 184.8, width: 1152.2 })
    };

    it('reads the layout box, which is the unit the grid lays out in', () => {
        expect(readFrameBox(zoomedFrame)).toEqual({ height: 132, width: 823 });
    });

    it('would fit a different grid from the visual box, which is what made cards spill', () => {
        // The negative control: if this ever stops mattering the two fits agree, and it does not.
        const shared = { gap: 10, minColumnWidth: 220, rowHeight: 104 };
        const layout = computeGridFit({ ...shared, frameHeight: 132, frameWidth: 823 });
        const visual = computeGridFit({ ...shared, frameHeight: 184.8, frameWidth: 1152.2 });
        expect(layout.columns * layout.rows).toBeLessThan(visual.columns * visual.rows);
        /*
         * The mechanism, stated as the numbers give it rather than as it first reads. Both boxes
         * fit ONE row here; the overshoot is in the columns - 5 against 3 - so the page was filled
         * with five cards while the CSS grid, laying out in layout px, had three cells per row.
         * The extra two wrapped onto a second row inside a one-row frame that clips, which is the
         * card with its bottom cut off and nothing to scroll it back.
         */
        expect(visual.columns).toBeGreaterThan(layout.columns);
        const rowsTheCssNeeds = Math.ceil((visual.columns * visual.rows) / layout.columns);
        expect(rowsTheCssNeeds).toBeGreaterThan(layout.rows);
    });

    it('is unchanged when nothing is zoomed, so the fix costs the ordinary case nothing', () => {
        expect(readFrameBox({ clientHeight: 456, clientWidth: 1152 })).toEqual({ height: 456, width: 1152 });
    });
});
