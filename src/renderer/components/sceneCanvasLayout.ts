import type { SceneRect } from './scenePaint';

/**
 * The numbers `SceneCanvas` paints by: its pace, and which part of the plate the screen shows.
 */

/** Frames a second. A painting with fourteen-frame-a-second flames in it does not need sixty. */
export const SCENE_FPS_FULL = 30;
export const SCENE_FPS_LEAN = 24;

/** The plate is drawn this much past what the screen shows, so its slow drift never uncovers an unpainted edge. */
const VISIBLE_MARGIN = 0.07;

/** The part of the plate that is on screen, as fractions of it, with a margin for the drift. */
export const visiblePlateRect = (
    scene: { left: number; top: number; width: number; height: number },
    plate: { left: number; top: number; width: number; height: number }
): SceneRect => {
    if (!(plate.width > 0) || !(plate.height > 0) || !(scene.width > 0) || !(scene.height > 0)) {
        return { x: 0, y: 0, w: 1, h: 1 };
    }
    const x0 = Math.max(0, (scene.left - plate.left) / plate.width - VISIBLE_MARGIN);
    const y0 = Math.max(0, (scene.top - plate.top) / plate.height - VISIBLE_MARGIN);
    const x1 = Math.min(1, (scene.left + scene.width - plate.left) / plate.width + VISIBLE_MARGIN);
    const y1 = Math.min(1, (scene.top + scene.height - plate.top) / plate.height + VISIBLE_MARGIN);
    if (!(x1 > x0) || !(y1 > y0)) {
        return { x: 0, y: 0, w: 1, h: 1 };
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
