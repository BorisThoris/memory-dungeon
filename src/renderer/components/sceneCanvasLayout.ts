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
export const SCENE_CANVAS_MAX_SCALE = 2;

/**
 * The most a phone's canvas is scaled past its painting (2026-10-09). A phone held upright shows the
 * middle quarter of a landscape room across its whole height, so the canvas only covers that window
 * (`sceneCanvasWindow`) and can afford the screen's own sharpness there; the realm rooms' bases are
 * twice the painting's size (`upscale_realms.py`), so there is detail to show.
 */
export const SCENE_CANVAS_PHONE_MAX_SCALE = 2.6;

/** The most pixels a scene canvas paints: about a 1440p screen's worth of window. */
export const SCENE_CANVAS_PIXEL_BUDGET = 3_700_000;

/**
 * The part of the plate the canvas covers: the whole plate when the screen shows most of it, or the
 * visible window when it shows little of it (a phone), so the pixels are spent where they are seen.
 */
export const sceneCanvasWindow = (visible: SceneRect): SceneRect =>
    visible.w * visible.h < 0.7 ? visible : { x: 0, y: 0, w: 1, h: 1 };
