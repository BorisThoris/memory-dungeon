import { useEffect, useRef, type MutableRefObject } from 'react';
import { getSceneImage, sceneFilterIsLive, sceneLiveFilterCss, subscribeSceneImages } from './sceneBitmaps';
import { createSceneClock, type SceneClock } from './sceneClock';
import { SCENE_FPS_FULL, sceneCanvasScale, visiblePlateRect } from './sceneCanvasLayout';
import { paintScene, SCENE_ALPHA_FLOOR, type SceneDraw, type SceneFilter, type ScenePaintContext, type SceneRect } from './scenePaint';
import styles from './scenePlate.module.css';

/**
 * The one canvas a painted scene is drawn in (`scenePaint.ts` says why it is one).
 *
 * It is the size the art was painted at, or up to `maxScale` times that where the screen shows the
 * plate bigger than the painting (a desktop at 1080p and up), and CSS fits it over the plate. What
 * it costs is bounded: a phone or the lean tier keeps the painting's own size, a 4K monitor gets
 * half as many pixels again and no more, since past that the masters have nothing more to show (a
 * canvas stretched 2.8 times over a 4K screen was the room going soft). All the canvases on a page
 * share one animation-frame loop, which paints each of them at its own pace (thirty frames a
 * second on a desktop, twenty-four on a phone: a painting with fourteen-frame-a-second flames in
 * it does not need sixty), stops while the page is hidden, and paints a scene that holds still
 * (reduce motion) only when something about it changes.
 */
export interface SceneLevels {
    /** `--scene-base-opacity`: how far the parent sinks the painting into the page. */
    base: number;
    /** `--scene-light-opacity`: how far it sinks the lights. */
    light: number;
}

interface SceneCanvasProps {
    /** The painting's size in its own pixels. */
    plate: readonly [number, number];
    /** This frame's draws. Called every frame while the scene is alive; must not keep state of its own. */
    compose: (clock: SceneClock, levels: SceneLevels) => readonly SceneDraw[];
    /** Reduce motion: one frame, repainted only when `compose` changes. */
    still: boolean;
    /** Frames a second while alive. */
    fps?: number;
    /** Where the player is looking, -1..1, kept current by `useSceneLook`. */
    lookRef?: MutableRefObject<{ x: number; y: number }>;
    testId?: string;
    /** The most canvas pixels per painting pixel (`sceneCanvasScale`); 1 keeps the painting's size. */
    maxScale?: number;
}

/** The fog is built at a fraction of the plate's size: it is soft, and a quarter of the pixels is a quarter of the work. */
const SCRATCH_SCALE = 0.25;
/** A scene still missing an image after this long is shown as it is. */
const REVEAL_ANYWAY_MS = 1200;

interface Painter {
    paint: (now: number) => void;
    fps: number;
    last: number;
    still: boolean;
    dirty: boolean;
    /** Look at the plate again before the next frame: its size, the levels, the clip. */
    remeasure: () => void;
}

const painters = new Set<Painter>();
let loop = 0;
let listening = false;

const tick = (now: number): void => {
    loop = 0;
    for (const painter of painters) {
        if (painter.still) {
            if (painter.dirty) {
                painter.dirty = false;
                painter.paint(now);
            }
            continue;
        }
        // A frame is due a little early rather than a whole display frame late.
        if (now - painter.last >= 1000 / painter.fps - 2) {
            painter.last = now;
            painter.paint(now);
        }
    }
    schedule();
};

const schedule = (): void => {
    if (loop || painters.size === 0 || typeof window === 'undefined') {
        return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
        return;
    }
    // Nothing alive and nothing waiting to be painted: no reason to wake up sixty times a second.
    let wanted = false;
    for (const painter of painters) {
        if (!painter.still || painter.dirty) {
            wanted = true;
            break;
        }
    }
    if (wanted) {
        loop = window.requestAnimationFrame(tick);
    }
};

const listen = (): void => {
    if (listening || typeof document === 'undefined') {
        return;
    }
    listening = true;
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            schedule();
        }
    });
};

const readLevel = (style: CSSStyleDeclaration, name: string): number => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : 1;
};

export function SceneCanvas({ plate, compose, still, fps = SCENE_FPS_FULL, lookRef, testId = 'scene-canvas', maxScale = 1 }: SceneCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const composeRef = useRef(compose);
    const painterRef = useRef<Painter | null>(null);
    const maxScaleRef = useRef(maxScale);
    composeRef.current = compose;
    maxScaleRef.current = maxScale;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof window === 'undefined') {
            return undefined;
        }
        let context: CanvasRenderingContext2D | null = null;
        try {
            context = canvas.getContext('2d');
        } catch {
            context = null;
        }
        if (!context) {
            return undefined;
        }
        const drawing = context;
        // Set here as well as in the markup: unmounting hands the surface back (below), and a
        // remount of the same element (React's strict mode in development) has to take it again.
        canvas.width = plate[0];
        canvas.height = plate[1];
        drawing.imageSmoothingQuality = 'medium';
        let scale = 1;
        const clock = createSceneClock();
        // Where the canvas can filter as it draws, a colour grade costs nothing to change; elsewhere it is baked.
        const liveFilter =
            typeof drawing.filter === 'string'
                ? (filter: SceneFilter): string | null => (sceneFilterIsLive(filter) ? sceneLiveFilterCss(filter) || 'none' : null)
                : undefined;
        let scratch: { canvas: HTMLCanvasElement; context: ScenePaintContext; width: number; height: number } | null = null;
        let visible: SceneRect = { x: 0, y: 0, w: 1, h: 1 };
        let levels: SceneLevels = { base: 1, light: 1 };
        let measuredAt = Number.NEGATIVE_INFINITY;
        let shown = false;
        let firstPaintAt = -1;

        const measure = (now: number): void => {
            measuredAt = now;
            const scene = canvas.closest<HTMLElement>(`.${styles.scene}`) ?? canvas.parentElement;
            if (!scene) {
                return;
            }
            const style = window.getComputedStyle(scene);
            levels = { base: readLevel(style, '--scene-base-opacity'), light: readLevel(style, '--scene-light-opacity') };
            const shown = canvas.getBoundingClientRect();
            visible = visiblePlateRect(scene.getBoundingClientRect(), shown);
            const next = sceneCanvasScale(shown.width, window.devicePixelRatio, plate[0], maxScaleRef.current);
            if (next !== scale) {
                // A new surface: the draws are in fractions of the plate, so only the pixel count changes.
                scale = next;
                canvas.width = Math.round(plate[0] * scale);
                canvas.height = Math.round(plate[1] * scale);
                drawing.imageSmoothingQuality = 'medium';
                if (scratch) {
                    scratch.canvas.width = 1;
                    scratch.canvas.height = 1;
                    scratch = null;
                }
            }
        };

        const painter: Painter = {
            fps,
            last: Number.NEGATIVE_INFINITY,
            still,
            dirty: true,
            remeasure: () => {
                measuredAt = Number.NEGATIVE_INFINITY;
            },
            paint: (now) => {
                // The plate drifts and the page resizes; a look once a second keeps the clip and the levels honest.
                if (now - measuredAt > 1000) {
                    measure(now);
                }
                const frame = clock.frame(now, painter.still);
                const draws = composeRef.current(frame, levels);
                const made = paintScene(drawing, draws, {
                    width: canvas.width,
                    height: canvas.height,
                    image: getSceneImage,
                    liveFilter,
                    lookX: lookRef?.current.x ?? 0,
                    lookY: lookRef?.current.y ?? 0,
                    visible,
                    scratch: () => {
                        if (!scratch) {
                            const spare = document.createElement('canvas');
                            spare.width = Math.max(1, Math.round(canvas.width * SCRATCH_SCALE));
                            spare.height = Math.max(1, Math.round(canvas.height * SCRATCH_SCALE));
                            const spareContext = spare.getContext('2d');
                            if (!spareContext) {
                                return null;
                            }
                            scratch = { canvas: spare, context: spareContext, width: spare.width, height: spare.height };
                        }
                        return scratch;
                    }
                });
                // Shown once it is whole: the first frame with every image in it, or after a moment
                // regardless, so a cold start fades a finished room in instead of assembling one.
                if (!shown) {
                    firstPaintAt = firstPaintAt < 0 ? now : firstPaintAt;
                    let wanted = 0;
                    for (const draw of draws) {
                        wanted += draw.alpha > SCENE_ALPHA_FLOOR ? 1 : 0;
                    }
                    if (made >= wanted || now - firstPaintAt > REVEAL_ANYWAY_MS) {
                        shown = true;
                        canvas.dataset.ready = 'true';
                    }
                }
            }
        };
        painterRef.current = painter;
        painters.add(painter);
        listen();
        const repaint = (): void => {
            painter.dirty = true;
            measuredAt = Number.NEGATIVE_INFINITY;
            schedule();
        };
        const unsubscribe = subscribeSceneImages(repaint);
        window.addEventListener('resize', repaint);
        // The browser can take a canvas's surface away (a GPU reset) and hand back a blank one. A
        // scene that is animating repaints on its next frame anyway; one holding still has to be told.
        canvas.addEventListener('contextrestored', repaint);
        schedule();
        return () => {
            painters.delete(painter);
            painterRef.current = null;
            unsubscribe();
            window.removeEventListener('resize', repaint);
            canvas.removeEventListener('contextrestored', repaint);
            // Hand the surface back now rather than whenever the collector gets to it.
            canvas.width = 1;
            canvas.height = 1;
            if (scratch) {
                scratch.canvas.width = 1;
                scratch.canvas.height = 1;
            }
        };
        // The canvas is set up once; the pace and stillness are fed to the painter below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plate[0], plate[1], lookRef]);

    // Every render is a reason to repaint a scene that holds still, and a change of pace or stillness for one that does not.
    useEffect(() => {
        const painter = painterRef.current;
        if (!painter) {
            return;
        }
        painter.fps = fps;
        painter.still = still;
        painter.dirty = true;
        schedule();
    });

    // A tier change (a phone turned to low quality, a desktop back to full) resizes the surface on the next frame.
    useEffect(() => {
        painterRef.current?.remeasure();
    }, [maxScale]);

    return <canvas className={styles.canvas} data-testid={testId} height={plate[1]} ref={canvasRef} width={plate[0]} />;
}
