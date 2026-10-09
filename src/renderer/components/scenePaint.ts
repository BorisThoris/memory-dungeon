/**
 * A painted scene as one picture.
 *
 * The scenes (`GameplayScene`, `CathedralScene`, `PortalScene`) used to be a stack of full-plate
 * elements, one per family of light, each blended over the last by the browser's compositor: up to
 * twenty blended surfaces the size of the screen, every one of them re-composited on each frame
 * anything moved. A surface costs four bytes a device pixel, so the stack that fit a laptop did not
 * fit a 4K monitor or a phone at three device pixels to the point, and when the compositor ran out
 * of room it dropped tiles and the room flashed.
 *
 * Now a scene is a list of draws (`SceneDraw`) painted into a single canvas the size the art was
 * painted at. The cost no longer depends on the screen: one surface, 1376 by 768, on every device.
 * A scene's module turns its props and the clock into that list (a pure function, which is what
 * the tests read), and `paintScene` puts it on the canvas.
 */

/** How a draw meets what is under it. Light adds (`lighter`); paint covers (`source-over`). */
export type SceneBlend = 'source-over' | 'lighter' | 'screen' | 'soft-light';

/** A colour grade baked into a copy of an image once and reused (`sceneBitmaps.ts`). */
export interface SceneFilter {
    hueDeg?: number;
    saturate?: number;
    brightness?: number;
    blurPx?: number;
}

/** A box on the plate, as fractions of its width and height. */
export interface SceneRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** A sub-rectangle of the source image, in its own pixels. */
export interface SceneCrop {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface SceneImageDraw {
    kind: 'image';
    /** What this is, for the tests and for reading a frame: `base`, `ringGlow`, `flame-03`. */
    id: string;
    src: string;
    alpha: number;
    blend?: SceneBlend;
    /** Where on the plate; the whole plate when absent. */
    rect?: SceneRect;
    /** Which part of the image; all of it when absent. */
    crop?: SceneCrop;
    /** The same as fractions of the image, for a draw that does not know its size (a live warp of the base). */
    cropUv?: SceneRect;
    /** One frame of a flipbook laid out left to right inside the crop (or the image). */
    frame?: { index: number; count: number };
    /** Radians about the origin. */
    rotate?: number;
    scaleX?: number;
    scaleY?: number;
    /** The point of the box that rotation and scale hold still, as fractions of it. Default centre. */
    originX?: number;
    originY?: number;
    filter?: SceneFilter;
    /** How much this turns with the pointer on top of the plate's own turn: 0 for the walls, 1 for the things in the room. */
    depth?: number;
}

/** A soft ellipse of colour: a flash, a pool of light, the red edge of peril. */
export interface SceneGlowDraw {
    kind: 'glow';
    id: string;
    alpha: number;
    blend?: SceneBlend;
    /** Centre and radii, fractions of the plate. */
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    /** Gradient stops from the centre (0) to the rim (1). */
    stops: ReadonlyArray<readonly [number, string]>;
}

/** Where fog shows: an ellipse that fades to its rim, or a band that fades at its top and bottom. */
export type SceneFogMask =
    | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; solid: number }
    | { kind: 'band'; top: number; solidFrom: number; solidTo: number; bottom: number };

/** Banks of the baked fog tile sliding over each other, shown through a mask. */
export interface SceneFogDraw {
    kind: 'fog';
    id: string;
    src: string;
    alpha: number;
    blend?: SceneBlend;
    /** Each bank: where the tile has slid to (fractions of one tile), how big a tile is on the plate, how strong. */
    banks: ReadonlyArray<{ offsetX: number; offsetY: number; tileW: number; tileH: number; alpha: number }>;
    mask: SceneFogMask;
}

/** A stroked line through points: the thread a spider hangs on, a bolt of lightning. */
export interface SceneLineDraw {
    kind: 'line';
    id: string;
    alpha: number;
    blend?: SceneBlend;
    /** The points it runs through, fractions of the plate. */
    points: ReadonlyArray<readonly [number, number]>;
    color: string;
    /** Width as a fraction of the plate's height. */
    width: number;
    depth?: number;
}

export type SceneDraw = SceneImageDraw | SceneGlowDraw | SceneFogDraw | SceneLineDraw;

/** The parts of a 2D canvas context `paintScene` uses. The tests hand it a recorder. */
export type ScenePaintContext = Pick<
    CanvasRenderingContext2D,
    | 'clearRect'
    | 'drawImage'
    | 'setTransform'
    | 'fillRect'
    | 'createRadialGradient'
    | 'createLinearGradient'
    | 'beginPath'
    | 'moveTo'
    | 'lineTo'
    | 'stroke'
    | 'rect'
    | 'clip'
    | 'save'
    | 'restore'
> & {
    globalAlpha: number;
    globalCompositeOperation: GlobalCompositeOperation;
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    lineJoin: CanvasLineJoin;
    lineCap: CanvasLineCap;
    /** Present where the engine's canvas can filter as it draws (not Safari's). */
    filter?: string;
};

export interface ScenePaintImage {
    image: CanvasImageSource;
    width: number;
    height: number;
}

export interface ScenePaintEnv {
    /**
     * The whole plate's size in the canvas's pixels. When the canvas is a window onto the plate (a
     * phone, which shows the middle of the painting), this is bigger than the canvas, and
     * `originX/originY` say where the window starts, in the same pixels.
     */
    width: number;
    height: number;
    originX?: number;
    originY?: number;
    /** A loaded image, graded if asked; null while it is still loading (the draw is skipped). */
    image: (src: string, filter?: SceneFilter) => ScenePaintImage | null;
    /** Where the player is looking, -1..1 (`useSceneLook`). */
    lookX: number;
    lookY: number;
    /** The part of the plate the screen shows, as fractions; draws are clipped to it. */
    visible?: SceneRect;
    /**
     * The CSS for a grade the context can apply as it draws, or null to have it baked into a copy
     * of the image instead. A colour grade that changes with the run (the ring turning rose) is
     * applied live where the engine can: nothing is allocated mid-play. Absent, everything is baked.
     */
    liveFilter?: (filter: SceneFilter) => string | null;
    /** A small spare canvas the fog is built in before it is added to the room. */
    scratch?: () => { canvas: CanvasImageSource; context: ScenePaintContext; width: number; height: number } | null;
}

/** Below this a draw changes nothing a player can see, so it is not made. */
export const SCENE_ALPHA_FLOOR = 0.004;

/** How far the things in the room turn with the pointer beyond the plate, as a fraction of the plate per unit of depth. */
export const SCENE_DEPTH_SHIFT_X = 0.0045;
const SCENE_DEPTH_SHIFT_Y = 0.003;

const clampAlpha = (alpha: number): number => (Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 0);

const paintImage = (context: ScenePaintContext, draw: SceneImageDraw, env: ScenePaintEnv): boolean => {
    const live = draw.filter && env.liveFilter ? env.liveFilter(draw.filter) : null;
    const source = env.image(draw.src, live === null ? draw.filter : undefined);
    if (!source) {
        return false;
    }
    if (live) {
        context.filter = live;
    }
    const rect = draw.rect;
    const depth = draw.depth ?? 0;
    const dx = ((rect?.x ?? 0) - env.lookX * depth * SCENE_DEPTH_SHIFT_X) * env.width;
    const dy = ((rect?.y ?? 0) - env.lookY * depth * SCENE_DEPTH_SHIFT_Y) * env.height;
    const dw = (rect?.w ?? 1) * env.width;
    const dh = (rect?.h ?? 1) * env.height;
    let sx = draw.cropUv ? draw.cropUv.x * source.width : (draw.crop?.x ?? 0);
    const sy = draw.cropUv ? draw.cropUv.y * source.height : (draw.crop?.y ?? 0);
    let sw = draw.cropUv ? draw.cropUv.w * source.width : (draw.crop?.w ?? source.width);
    const sh = draw.cropUv ? draw.cropUv.h * source.height : (draw.crop?.h ?? source.height);
    if (draw.frame && draw.frame.count > 1) {
        sw /= draw.frame.count;
        sx += sw * (((draw.frame.index % draw.frame.count) + draw.frame.count) % draw.frame.count);
    }
    context.globalAlpha = clampAlpha(draw.alpha);
    context.globalCompositeOperation = draw.blend ?? 'source-over';
    const rotate = draw.rotate ?? 0;
    const scaleX = draw.scaleX ?? 1;
    const scaleY = draw.scaleY ?? 1;
    if (rotate === 0 && scaleX === 1 && scaleY === 1) {
        context.drawImage(source.image, sx, sy, sw, sh, dx, dy, dw, dh);
        if (live) {
            context.filter = 'none';
        }
        return true;
    }
    const ox = dx + dw * (draw.originX ?? 0.5);
    const oy = dy + dh * (draw.originY ?? 0.5);
    const cos = Math.cos(rotate);
    const sin = Math.sin(rotate);
    context.setTransform(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, ox - (env.originX ?? 0), oy - (env.originY ?? 0));
    context.drawImage(source.image, sx, sy, sw, sh, dx - ox, dy - oy, dw, dh);
    context.setTransform(1, 0, 0, 1, (-(env.originX ?? 0) || 0), (-(env.originY ?? 0) || 0));
    if (live) {
        context.filter = 'none';
    }
    return true;
};

/** An ellipse as a circle under a vertical squash, so one radial gradient serves any proportions. */
const fillEllipseGradient = (
    context: ScenePaintContext,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    stops: ReadonlyArray<readonly [number, string]>,
    width: number,
    height: number,
    originX = 0,
    originY = 0
): void => {
    const squash = ry / Math.max(rx, 1e-6);
    context.setTransform(1, 0, 0, squash, -originX || 0, cy - cy * squash - originY);
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, rx);
    for (const [offset, color] of stops) {
        gradient.addColorStop(Math.min(1, Math.max(0, offset)), color);
    }
    context.fillStyle = gradient;
    // The fill has to reach the canvas's corners in the squashed space.
    context.fillRect(0, -height / Math.max(squash, 1e-3), width, (height * 3) / Math.max(squash, 1e-3));
    context.setTransform(1, 0, 0, 1, -originX || 0, -originY || 0);
};

const paintGlow = (context: ScenePaintContext, draw: SceneGlowDraw, env: ScenePaintEnv): void => {
    context.globalAlpha = clampAlpha(draw.alpha);
    context.globalCompositeOperation = draw.blend ?? 'lighter';
    fillEllipseGradient(context, draw.cx * env.width, draw.cy * env.height, draw.rx * env.width, draw.ry * env.height, draw.stops, env.width, env.height, env.originX ?? 0, env.originY ?? 0);
};

const paintFog = (context: ScenePaintContext, draw: SceneFogDraw, env: ScenePaintEnv): boolean => {
    const tile = env.image(draw.src);
    const scratch = env.scratch?.();
    if (!tile || !scratch) {
        return false;
    }
    const { context: fog, width, height } = scratch;
    fog.setTransform(1, 0, 0, 1, 0, 0);
    fog.globalCompositeOperation = 'source-over';
    fog.globalAlpha = 1;
    fog.clearRect(0, 0, width, height);
    fog.globalCompositeOperation = 'lighter';
    for (const bank of draw.banks) {
        const tileW = Math.max(0.05, bank.tileW) * width;
        const tileH = Math.max(0.05, bank.tileH) * height;
        const startX = -((((bank.offsetX % 1) + 1) % 1) * tileW);
        const startY = -((((bank.offsetY % 1) + 1) % 1) * tileH);
        fog.globalAlpha = clampAlpha(bank.alpha);
        for (let y = startY; y < height; y += tileH) {
            for (let x = startX; x < width; x += tileW) {
                // A hair of overlap, so two tiles never show the seam between them.
                fog.drawImage(tile.image, 0, 0, tile.width, tile.height, x, y, tileW + 0.5, tileH + 0.5);
            }
        }
    }
    fog.globalAlpha = 1;
    fog.globalCompositeOperation = 'destination-in';
    const mask = draw.mask;
    if (mask.kind === 'ellipse') {
        fillEllipseGradient(
            fog,
            mask.cx * width,
            mask.cy * height,
            mask.rx * width,
            mask.ry * height,
            [
                [0, 'rgba(0,0,0,1)'],
                [Math.min(0.99, Math.max(0, mask.solid)), 'rgba(0,0,0,1)'],
                [1, 'rgba(0,0,0,0)']
            ],
            width,
            height
        );
    } else {
        const gradient = fog.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(Math.min(1, Math.max(0, mask.top)), 'rgba(0,0,0,0)');
        gradient.addColorStop(Math.min(1, Math.max(0, mask.solidFrom)), 'rgba(0,0,0,1)');
        gradient.addColorStop(Math.min(1, Math.max(0, mask.solidTo)), 'rgba(0,0,0,1)');
        gradient.addColorStop(Math.min(1, Math.max(0, mask.bottom)), 'rgba(0,0,0,0)');
        fog.fillStyle = gradient;
        fog.fillRect(0, 0, width, height);
    }
    fog.globalCompositeOperation = 'source-over';
    context.globalAlpha = clampAlpha(draw.alpha);
    context.globalCompositeOperation = draw.blend ?? 'lighter';
    context.drawImage(scratch.canvas, 0, 0, width, height, 0, 0, env.width, env.height);
    return true;
};

const paintLine = (context: ScenePaintContext, draw: SceneLineDraw, env: ScenePaintEnv): boolean => {
    if (draw.points.length < 2) {
        return false;
    }
    const depth = draw.depth ?? 0;
    const shiftX = -env.lookX * depth * SCENE_DEPTH_SHIFT_X * env.width;
    const shiftY = -env.lookY * depth * SCENE_DEPTH_SHIFT_Y * env.height;
    context.globalAlpha = clampAlpha(draw.alpha);
    context.globalCompositeOperation = draw.blend ?? 'source-over';
    context.strokeStyle = draw.color;
    context.lineWidth = Math.max(0.5, draw.width * env.height);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    draw.points.forEach(([x, y], index) => {
        if (index === 0) {
            context.moveTo(x * env.width + shiftX, y * env.height + shiftY);
        } else {
            context.lineTo(x * env.width + shiftX, y * env.height + shiftY);
        }
    });
    context.stroke();
    return true;
};

/**
 * Paint one frame. Returns how many draws were made; a draw whose image has not loaded yet is
 * skipped rather than waited for, so the first frames of a cold start are the room filling in.
 */
export const paintScene = (context: ScenePaintContext, draws: readonly SceneDraw[], env: ScenePaintEnv): number => {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, env.width, env.height);
    // A window onto the plate: everything below is drawn in the plate's pixels, shifted to the window.
    context.setTransform(1, 0, 0, 1, (-(env.originX ?? 0) || 0), (-(env.originY ?? 0) || 0));
    const clipped = env.visible && (env.visible.x > 0 || env.visible.y > 0 || env.visible.w < 1 || env.visible.h < 1);
    if (clipped && env.visible) {
        context.save();
        context.beginPath();
        context.rect(env.visible.x * env.width, env.visible.y * env.height, env.visible.w * env.width, env.visible.h * env.height);
        context.clip();
    }
    let made = 0;
    for (const draw of draws) {
        if (!(draw.alpha > SCENE_ALPHA_FLOOR)) {
            continue;
        }
        if (draw.kind === 'image') {
            made += paintImage(context, draw, env) ? 1 : 0;
        } else if (draw.kind === 'glow') {
            paintGlow(context, draw, env);
            made += 1;
        } else if (draw.kind === 'fog') {
            made += paintFog(context, draw, env) ? 1 : 0;
        } else {
            made += paintLine(context, draw, env) ? 1 : 0;
        }
    }
    if (clipped) {
        context.restore();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    return made;
};

/** The draws a frame would make, by id, for a test or a data attribute. */
export const sceneDrawIds = (draws: readonly SceneDraw[]): string[] =>
    draws.filter((draw) => draw.alpha > SCENE_ALPHA_FLOOR).map((draw) => draw.id);

export const findSceneDraw = <K extends SceneDraw['kind'] = 'image'>(
    draws: readonly SceneDraw[],
    id: string,
    kind?: K
): Extract<SceneDraw, { kind: K }> | undefined =>
    draws.find((draw) => draw.id === id && (kind === undefined || draw.kind === kind)) as Extract<SceneDraw, { kind: K }> | undefined;
