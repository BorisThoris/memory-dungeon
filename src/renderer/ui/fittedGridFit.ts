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
 * a frame shorter than this is a layout that cannot be satisfied, and clipping is the honest
 * result rather than a row of slivers.
 */
export const MIN_FITTED_ROW_HEIGHT = 88;

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
    return { columns, rowHeight: Math.max(MIN_FITTED_ROW_HEIGHT, Math.floor(frameHeight)), rows: 1 };
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
