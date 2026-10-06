import { BOARD_LAYOUT_VIEWPORT_PADDING, BOARD_LAYOUT_ROW_STAGGER_X, CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT, getTileColumnSpacing, TILE_SPACING } from './tileShatter';

export const boardGridWorldSize = (columns: number, rows: number, compact: boolean) => ({
    width: (columns - 1) * getTileColumnSpacing(compact) + CARD_PLANE_WIDTH + 2 * BOARD_LAYOUT_VIEWPORT_PADDING + (rows > 1 ? BOARD_LAYOUT_ROW_STAGGER_X * (compact ? 0.85 : 1) : 0),
    height: (rows - 1) * TILE_SPACING + CARD_PLANE_HEIGHT + 2 * BOARD_LAYOUT_VIEWPORT_PADDING
});

/** Maximize the uniform card scale, accounting for card spacing and the incomplete last row. */
export const responsiveBoardColumns = (count: number, width: number, height: number, compact: boolean): number => {
    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
    const tiles = Math.floor(count);
    let bestColumns = 1;
    let bestScale = 0;
    let bestEmpty = tiles;
    for (let columns = 1; columns <= tiles; columns++) {
        const rows = Math.ceil(tiles / columns);
        const bounds = boardGridWorldSize(columns, rows, compact);
        const scale = Math.min(width / bounds.width, height / bounds.height);
        const empty = columns * rows - tiles;
        if (scale > bestScale + 1e-6 || (Math.abs(scale - bestScale) <= 1e-6 && empty < bestEmpty)) {
            bestColumns = columns;
            bestScale = scale;
            bestEmpty = empty;
        }
    }
    return bestColumns;
};

/** A centered camera wastes space when the HUD and dock have different heights. */
export const boardFitFrame = (
    stage: Pick<DOMRect, 'top' | 'bottom' | 'height' | 'left' | 'right' | 'width'>,
    hudBottom: number,
    dockTop: number,
    rail?: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'width'>
) => {
    if (stage.height <= 0 || stage.width <= 0) return { heightFraction: 1, centerYFraction: 0, widthFraction: 1, centerXFraction: 0 };
    const top = Math.min(stage.height, Math.max(0, hudBottom - stage.top));
    const bottom = Math.min(stage.height - top, Math.max(0, stage.bottom - dockTop));
    // On desktop the combo rail extends below the running head. Mobile combo text is inside it.
    const left = rail && rail.bottom > hudBottom + 1 && rail.width > 0 && rail.width < stage.width / 2
        ? Math.min(stage.width, Math.max(0, rail.right - stage.left + 12)) : 0;
    return {
        heightFraction: Math.max(0.01, 1 - (top + bottom) / stage.height),
        centerYFraction: (bottom - top) / (2 * stage.height),
        widthFraction: Math.max(0.01, 1 - left / stage.width),
        centerXFraction: left / (2 * stage.width)
    };
};
