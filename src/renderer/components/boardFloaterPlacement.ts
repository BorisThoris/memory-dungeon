import type { GameShellProfile } from '../gameShellLayout';

/**
 * Where the match / mismatch floater is anchored, relative to the board stage.
 *
 * - `centroid`: the midpoint of the flipped pair, rising through it. A pointer does not hide
 *   what it clicks, so the number can sit on the cards it came from.
 * - `above-pair`: the midpoint's x, but the top edge of the pair. A finger covers the card it
 *   just tapped and the hand covers the cards under it; the number rises from above the pair,
 *   where the player can see it.
 * - `stage-top`: docked under the HUD, centered. A phone held sideways has no vertical room for
 *   a floater to rise through - two rows of cards are the whole height - so it reads as a strip
 *   between the stats and the board.
 */
export type BoardFloaterPlacement = 'centroid' | 'above-pair' | 'stage-top';

export interface BoardFloaterAnchor {
    x: number;
    y: number;
    placement: BoardFloaterPlacement;
}

export interface StageRelativeRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** Widest the floater can be (`max-width: min(18rem, 72vi)` in the module CSS), at a 16px root. */
const FLOATER_MAX_WIDTH_REM = 18;
const FLOATER_MAX_WIDTH_VI = 0.72;
const ROOT_FONT_PX = 16;

/** Roughly what three floater lines take, so a rising floater cannot leave the stage. */
const FLOATER_ESTIMATED_HEIGHT_PX = 72;
/** `matchScoreFloaterRise` ends at `translateY(-148%)`. */
const FLOATER_RISE_FACTOR = 1.48;

const STAGE_EDGE_MARGIN_PX = 8;
const STAGE_TOP_STRIP_INSET_PX = 6;

const centerOf = (rect: StageRelativeRect): { x: number; y: number } => ({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
});

/** Keep the floater's whole width inside the stage; a pair at the edge used to push half of it off. */
export const clampFloaterX = (x: number, stageWidth: number, viewportWidth: number): number => {
    const halfWidth = Math.min(FLOATER_MAX_WIDTH_REM * ROOT_FONT_PX, FLOATER_MAX_WIDTH_VI * viewportWidth) / 2;
    const min = STAGE_EDGE_MARGIN_PX + halfWidth;
    const max = stageWidth - STAGE_EDGE_MARGIN_PX - halfWidth;
    if (max <= min) {
        return stageWidth / 2;
    }
    return Math.min(max, Math.max(min, x));
};

export const resolveBoardFloaterAnchor = ({
    hudClearance,
    profile,
    stage,
    tiles,
    viewportWidth
}: {
    /** Pixels of stage hidden under the HUD at the top; 0 when the stage already starts below it. */
    hudClearance: number;
    profile: Pick<GameShellProfile, 'input' | 'layout'>;
    stage: { width: number; height: number };
    /** Stage-relative rects of the tiles the turn resolved on (two, or three for a gambit). */
    tiles: readonly StageRelativeRect[];
    viewportWidth: number;
}): BoardFloaterAnchor => {
    if (profile.layout === 'phone-landscape') {
        return {
            x: stage.width / 2,
            y: Math.max(0, hudClearance) + STAGE_TOP_STRIP_INSET_PX,
            placement: 'stage-top'
        };
    }

    if (tiles.length === 0) {
        return { x: stage.width / 2, y: stage.height / 2, placement: 'centroid' };
    }

    const centers = tiles.map(centerOf);
    const centroidX = centers.reduce((sum, center) => sum + center.x, 0) / centers.length;
    const x = clampFloaterX(centroidX, stage.width, viewportWidth);

    if (profile.input === 'touch' || profile.layout === 'phone-portrait') {
        const pairTop = Math.min(...tiles.map((rect) => rect.top));
        // Never so high that the rise carries it out of the stage (or under the HUD).
        const floor = Math.max(0, hudClearance) + FLOATER_ESTIMATED_HEIGHT_PX * FLOATER_RISE_FACTOR;
        return { x, y: Math.max(pairTop, floor), placement: 'above-pair' };
    }

    const centroidY = centers.reduce((sum, center) => sum + center.y, 0) / centers.length;
    return { x, y: centroidY, placement: 'centroid' };
};
