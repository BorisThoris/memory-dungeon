import type { BoardState } from '../../shared/contracts';
import { STATIC_CARD_TEXTURE_HEIGHT } from '../cardFace/staticCardTextureSize';
import { colossusReservedRows } from './colossusStoneLayout';
import { boardGridWorldSize } from './tileBoardResponsiveLayout';
import { CARD_PLANE_HEIGHT } from './tileShatter';

/**
 * How much detail a floor's card faces are baked at: level of detail, the way a racing game draws
 * the far cars with less.
 *
 * Every face was baked at 1024 pixels tall whatever the board, and on a floor of many cards each
 * one is a small thing on screen: the owner's call (2026-10-17) was that a board zoomed out over
 * many cards should carry less detail. Each face is three ~3MB textures and every one is uploaded
 * whole, so they were the frame a floor change dropped. The face is baked at the smallest of these
 * heights that still holds the card's on-screen size with headroom (a hovered or lifted card grows),
 * and never below the floor, so the art stays crisp at its real size.
 */
export const CARD_FACE_HEIGHTS = [512, 768, STATIC_CARD_TEXTURE_HEIGHT] as const;
export type CardFaceHeight = (typeof CARD_FACE_HEIGHTS)[number];

/**
 * Texture pixels per screen pixel of card. Generous on purpose: a lifted card grows, the camera can
 * zoom in, and the brief was less detail for boards zoomed out over many cards - not softer cards on
 * an ordinary floor. At 3 a small board keeps the full face and only a crowded one steps down.
 */
const CARD_FACE_OVERSAMPLE = 3;
/**
 * The share of the window the board's fit is given. The fit itself lives in the board's camera;
 * this is the same rough frame for every caller (the loading screen, the board, the next floor's
 * warm-up), so all three choose the same height and nothing is baked twice.
 */
const BOARD_FRAME_WIDTH_SHARE = 0.9;
const BOARD_FRAME_HEIGHT_SHARE = 0.62;

export interface CardFaceView {
    /** CSS pixels. */
    width: number;
    height: number;
    devicePixelRatio: number;
}

export const cardFaceHeightFor = (
    board: Pick<BoardState, 'columns' | 'rows' | 'colossus'>,
    view: CardFaceView
): CardFaceHeight => {
    const { width: boardWidth, height: boardHeight } = boardGridWorldSize(board.columns, board.rows + colossusReservedRows(board), false);
    if (!(boardWidth > 0 && boardHeight > 0 && view.width > 0 && view.height > 0)) return STATIC_CARD_TEXTURE_HEIGHT;
    const pixelsPerWorld = Math.min((view.width * BOARD_FRAME_WIDTH_SHARE) / boardWidth, (view.height * BOARD_FRAME_HEIGHT_SHARE) / boardHeight);
    const needed = CARD_PLANE_HEIGHT * pixelsPerWorld * Math.max(1, view.devicePixelRatio || 1) * CARD_FACE_OVERSAMPLE;
    return CARD_FACE_HEIGHTS.find((height) => height >= needed) ?? STATIC_CARD_TEXTURE_HEIGHT;
};

/** The view the game is drawn in now, for the callers that are not inside the board's canvas. */
export const currentCardFaceView = (): CardFaceView =>
    typeof window === 'undefined'
        ? { width: 0, height: 0, devicePixelRatio: 1 }
        : { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 };
