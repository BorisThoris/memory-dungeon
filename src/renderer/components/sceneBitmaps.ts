import type { SceneFilter, ScenePaintImage } from './scenePaint';

/**
 * The images a painted scene draws, decoded once and held.
 *
 * A background image on an element is decoded when the browser first rasters it and can be thrown
 * away and decoded again whenever its cache is under pressure, and each time that happens the
 * element is blank for a frame. Here every image is decoded up front (`HTMLImageElement.decode`),
 * reused directly from the preloader, so a scene never draws a frame it has to wait for. Do not
 * promote them to a second ImageBitmap: that retained another full set of room pixels, and the
 * reported Chrome renderer crashes occurred in its GPU image decode path while painting a canvas.
 *
 * A graded copy (`SceneFilter`: the ring turning rose with the chain, the snow's blurred glow) is
 * baked into its own small canvas the first time it is asked for and reused, a few to an image.
 */
interface Held {
    image: ScenePaintImage | null;
    failed: boolean;
    graded: Map<string, ScenePaintImage>;
}

const held = new Map<string, Held>();
const offered = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

/** Graded copies kept per image; the oldest goes when a new grade is asked for past this. */
const SCENE_GRADES_HELD = 4;
/** A session-wide pixel budget, rather than four full-resolution copies of every room layer. */
const SCENE_GRADE_PIXEL_BUDGET = 8 * 1024 * 1024;
const gradedImages = new Map<ScenePaintImage, { entry: Held; key: string }>();
let gradedPixels = 0;

const releaseGrade = (image: ScenePaintImage): void => {
    const owner = gradedImages.get(image);
    if (!owner) return;
    owner.entry.graded.delete(owner.key);
    gradedImages.delete(image);
    gradedPixels -= image.width * image.height;
    // Return the backing store now, rather than waiting for a JS garbage collection.
    if (image.image instanceof HTMLCanvasElement) {
        image.image.width = 1;
        image.image.height = 1;
    }
};

const notify = (): void => {
    for (const listener of listeners) {
        listener();
    }
};

/** Called whenever an image finishes loading, so a scene that is not animating can repaint. */
export const subscribeSceneImages = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const canDecode = (): boolean => typeof window !== 'undefined' && typeof Image !== 'undefined';

const load = (src: string, entry: Held): void => {
    // An image the boot or the run's loading screen already fetched and decoded is used as it is:
    // nothing is requested twice, and the scene's first frame has it.
    // (One still on its way belongs to whoever is loading it; this takes its own copy from the cache.)
    const candidate = offered.get(src);
    const ready = candidate && candidate.complete && candidate.naturalWidth > 0 ? candidate : undefined;
    const element = ready ?? new Image();
    if (!ready) {
        element.decoding = 'async';
    }
    const settle = (): void => {
        const width = element.naturalWidth;
        const height = element.naturalHeight;
        if (!width || !height) {
            entry.failed = true;
            return;
        }
        entry.image = { image: element, width, height };
        notify();
    };
    if (ready) {
        settle();
        return;
    }
    element.onerror = () => {
        entry.failed = true;
    };
    element.src = src;
    if (typeof element.decode === 'function') {
        element.decode().then(settle, () => {
            // `decode` rejects on some engines for images that still load; let `onload` decide.
            if (element.complete && element.naturalWidth > 0) {
                settle();
            } else {
                element.onload = settle;
            }
        });
    } else {
        element.onload = settle;
    }
};

const entryFor = (src: string): Held => {
    let entry = held.get(src);
    if (!entry) {
        entry = { image: null, failed: false, graded: new Map() };
        held.set(src, entry);
        if (canDecode() && src) {
            load(src, entry);
        }
    }
    return entry;
};

/**
 * Hand over an image something else has already loaded (`preloadStartupAssets` holds every UI
 * raster for the session). A scene that asks for it later draws from this element at once.
 */
export const offerSceneImage = (src: string, element: HTMLImageElement): void => {
    if (src && !offered.has(src)) {
        offered.set(src, element);
    }
};

/** To the nearest `step`, without the binary dust that 14 * 0.1 leaves behind. */
const round = (value: number, step: number): number => Math.round(Math.round(value / step) * step * 1000) / 1000;

/** Grades are snapped to steps so an eased value bakes a handful of copies on its way, not one a frame. */
export const quantizeSceneFilter = (filter: SceneFilter, coarse = false): Required<SceneFilter> => ({
    hueDeg: round(filter.hueDeg ?? 0, coarse ? 15 : 5),
    saturate: round(filter.saturate ?? 1, coarse ? 0.25 : 0.1),
    brightness: round(filter.brightness ?? 1, coarse ? 0.25 : 0.1),
    blurPx: Math.round(filter.blurPx ?? 0)
});

export const sceneFilterIsIdentity = (filter: Required<SceneFilter>): boolean =>
    filter.hueDeg % 360 === 0 && filter.saturate === 1 && filter.brightness === 1 && filter.blurPx === 0;

export const sceneFilterCss = (filter: Required<SceneFilter>): string =>
    [
        filter.hueDeg % 360 !== 0 ? `hue-rotate(${filter.hueDeg}deg)` : '',
        filter.saturate !== 1 ? `saturate(${filter.saturate})` : '',
        filter.brightness !== 1 ? `brightness(${filter.brightness})` : '',
        filter.blurPx > 0 ? `blur(${filter.blurPx}px)` : ''
    ]
        .filter(Boolean)
        .join(' ');

/**
 * The same grade as a colour matrix, for engines whose canvas has no `filter` (Safari): the
 * matrices CSS defines for hue-rotate and saturate, multiplied, then brightness. Rows are r, g, b.
 */
export const sceneFilterMatrix = (filter: Required<SceneFilter>): number[] => {
    const angle = (filter.hueDeg * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hue = [
        0.213 + cos * 0.787 - sin * 0.213,
        0.715 - cos * 0.715 - sin * 0.715,
        0.072 - cos * 0.072 + sin * 0.928,
        0.213 - cos * 0.213 + sin * 0.143,
        0.715 + cos * 0.285 + sin * 0.14,
        0.072 - cos * 0.072 - sin * 0.283,
        0.213 - cos * 0.213 - sin * 0.787,
        0.715 - cos * 0.715 + sin * 0.715,
        0.072 + cos * 0.928 + sin * 0.072
    ];
    const s = filter.saturate;
    const sat = [
        0.213 + 0.787 * s,
        0.715 - 0.715 * s,
        0.072 - 0.072 * s,
        0.213 - 0.213 * s,
        0.715 + 0.285 * s,
        0.072 - 0.072 * s,
        0.213 - 0.213 * s,
        0.715 - 0.715 * s,
        0.072 + 0.928 * s
    ];
    const out: number[] = [];
    for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
            let sum = 0;
            for (let k = 0; k < 3; k += 1) {
                sum += sat[row * 3 + k]! * hue[k * 3 + column]!;
            }
            out.push(sum * filter.brightness);
        }
    }
    return out;
};

/** A grade the canvas can apply as it draws: colour only. A blur is baked once instead (`getSceneImage`). */
export const sceneFilterIsLive = (filter: SceneFilter): boolean => !(filter.blurPx && filter.blurPx > 0);

/** The CSS for a grade at exactly the values asked, for a context that filters as it draws. */
export const sceneLiveFilterCss = (filter: SceneFilter): string =>
    sceneFilterCss({ hueDeg: Math.round((filter.hueDeg ?? 0) * 10) / 10, saturate: filter.saturate ?? 1, brightness: filter.brightness ?? 1, blurPx: 0 });

let canvasFilterSupport: boolean | null = null;

const supportsCanvasFilter = (context: CanvasRenderingContext2D): boolean => {
    if (canvasFilterSupport === null) {
        canvasFilterSupport = typeof (context as { filter?: unknown }).filter === 'string';
    }
    return canvasFilterSupport;
};

const grade = (source: ScenePaintImage, filter: Required<SceneFilter>): ScenePaintImage | null => {
    if (typeof document === 'undefined') {
        return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    // These are one-time cached paints. Keep their pixels on the CPU instead of asking Chrome's
    // accelerated canvas image decoder to create another GPU surface for every grade.
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        return null;
    }
    if (supportsCanvasFilter(context)) {
        context.filter = sceneFilterCss(filter);
        context.drawImage(source.image, 0, 0);
        context.filter = 'none';
        return { image: canvas, width: source.width, height: source.height };
    }
    context.drawImage(source.image, 0, 0);
    try {
        const pixels = context.getImageData(0, 0, source.width, source.height);
        const data = pixels.data;
        const m = sceneFilterMatrix(filter);
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]!;
            const g = data[i + 1]!;
            const b = data[i + 2]!;
            data[i] = m[0]! * r + m[1]! * g + m[2]! * b;
            data[i + 1] = m[3]! * r + m[4]! * g + m[5]! * b;
            data[i + 2] = m[6]! * r + m[7]! * g + m[8]! * b;
        }
        context.putImageData(pixels, 0, 0);
    } catch {
        // A canvas the page may not read back: the ungraded copy is better than nothing.
    }
    return { image: canvas, width: source.width, height: source.height };
};

/** The image for a draw, graded if asked; null until it has loaded. Asking starts the load. */
export const getSceneImage = (src: string, filter?: SceneFilter): ScenePaintImage | null => {
    if (!src) {
        return null;
    }
    const entry = entryFor(src);
    if (!entry.image) {
        return null;
    }
    if (!filter) {
        return entry.image;
    }
    const quantized = quantizeSceneFilter(filter, canvasFilterSupport === false);
    if (sceneFilterIsIdentity(quantized)) {
        return entry.image;
    }
    const key = `${quantized.hueDeg}|${quantized.saturate.toFixed(2)}|${quantized.brightness.toFixed(2)}|${quantized.blurPx}`;
    const ready = entry.graded.get(key);
    if (ready) {
        // Most recently used goes to the back of the line.
        entry.graded.delete(key);
        entry.graded.set(key, ready);
        const owner = gradedImages.get(ready)!;
        gradedImages.delete(ready);
        gradedImages.set(ready, owner);
        return ready;
    }
    const baked = grade(entry.image, quantized);
    if (!baked) {
        return entry.image;
    }
    entry.graded.set(key, baked);
    gradedImages.set(baked, { entry, key });
    gradedPixels += baked.width * baked.height;
    while (entry.graded.size > SCENE_GRADES_HELD || (gradedPixels > SCENE_GRADE_PIXEL_BUDGET && gradedImages.size > 1)) {
        const oldest = entry.graded.size > SCENE_GRADES_HELD
            ? entry.graded.values().next().value
            : gradedImages.keys().next().value;
        if (!oldest) break;
        releaseGrade(oldest);
    }
    return baked;
};
