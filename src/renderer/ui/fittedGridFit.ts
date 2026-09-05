/**
 * How many cards fit, and how tall each row may be.
 *
 * Kept out of the component because it is the only part of a never-scrolling grid that can be
 * wrong in a way nobody sees: the grid clips instead of scrolling, so a row taller than the frame
 * loses its bottom edge silently. Choose Your Path at 1280×768 was rendering a 152px row into a
 * 132px frame and cutting every card's last line off.
 */

export interface GridFitInput {
    readonly frameHeight: number;
    readonly frameWidth: number;
    readonly gap: number;
    readonly minColumnWidth: number;
    readonly rowHeight: number;
}

export interface GridFit {
    readonly columns: number;
    readonly rows: number;
    /** The row height to actually render: never taller than the frame it has to fit inside. */
    readonly rowHeight: number;
}

/**
 * Below this a card is no longer a card — poster, kicker and title stop being legible at all — so
 * a frame shorter than this is a layout that cannot be satisfied.
 *
 * It used to be a floor the row kept even when the frame was shorter, on the reasoning that
 * clipping was the honest result. It was not honest: the frame clips, so the card was cut in
 * half and its middle landed under the pager. On a 1280x800 panel every mode in the browse grid
 * looked like a button and answered to nothing at all, because a click at its centre hit the
 * pager instead. A sliver you can press beats a card you cannot, so the row now takes the frame
 * height and this is what a screen has to give it before the cards read properly.
 */
export const MIN_FITTED_ROW_HEIGHT = 88;

/** Under this a row is not a tap target either, so the frame is the wrong shape at any size. */
export const MIN_CLICKABLE_ROW_HEIGHT = 44;

export const computeGridFit = ({
    frameHeight,
    frameWidth,
    gap,
    minColumnWidth,
    rowHeight
}: GridFitInput): GridFit => {
    const columns = Math.max(1, Math.floor((frameWidth + gap) / (minColumnWidth + gap)));
    const rows = Math.max(1, Math.floor((frameHeight + gap) / (rowHeight + gap)));
    if (rows > 1 || frameHeight >= rowHeight) {
        return { columns, rowHeight, rows };
    }
    // One row that does not fit: shrink it to the frame rather than spill past the clip.
    return { columns, rowHeight: Math.max(MIN_CLICKABLE_ROW_HEIGHT, Math.floor(frameHeight)), rows: 1 };
};

/**
 * The height a short page's rows may grow to so a three-card page does not sit in the top third.
 * Capped at 1.6× so three cards do not become three billboards.
 */
export const growRowHeight = (fit: GridFit, visibleCount: number, gap: number, frameHeight: number): number => {
    const usedRows = Math.max(1, Math.ceil(visibleCount / fit.columns));
    if (usedRows >= fit.rows) {
        return fit.rowHeight;
    }
    const grown = Math.floor((frameHeight - gap * (usedRows - 1)) / usedRows);
    return Math.max(fit.rowHeight, Math.min(Math.floor(fit.rowHeight * 1.6), grown));
};
