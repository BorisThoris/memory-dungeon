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

/**
 * How many of the canvas's pixels to give each of the painting's: as many as the screen shows of
 * it, never fewer than one, never more than `max`. Rounded to a tenth, so the plate's slow drift
 * (a few percent of scale) does not resize the surface every second.
 */
export const sceneCanvasScale = (shownWidthCss: number, devicePixelRatio: number, plateWidth: number, max: number): number => {
    if (!(shownWidthCss > 0) || !(plateWidth > 0) || !(max > 1)) {
        return 1;
    }
    const wanted = (shownWidthCss * (devicePixelRatio > 0 ? devicePixelRatio : 1)) / plateWidth;
    return Math.min(max, Math.max(1, Math.ceil(wanted * 10 - 0.5) / 10));
};

/**
 * The most a scene's canvas is scaled past its painting on a desktop: the painting's masters are
 * half again its size (`scripts/scene-pipeline/upscale_plates.py`), so past that there is nothing
 * more to show. A phone, or the lean tier, keeps the painting's own size.
 */
export const SCENE_CANVAS_MAX_SCALE = 1.5;
