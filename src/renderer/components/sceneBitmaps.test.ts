import { describe, expect, it, vi } from 'vitest';
import {
    getSceneImage,
    offerSceneImage,
    quantizeSceneFilter,
    sceneFilterCss,
    sceneFilterIsIdentity,
    sceneFilterIsLive,
    sceneFilterMatrix,
    sceneLiveFilterCss,
    subscribeSceneImages
} from './sceneBitmaps';

const apply = (m: number[], rgb: [number, number, number]): number[] => [
    m[0]! * rgb[0] + m[1]! * rgb[1] + m[2]! * rgb[2],
    m[3]! * rgb[0] + m[4]! * rgb[1] + m[5]! * rgb[2],
    m[6]! * rgb[0] + m[7]! * rgb[1] + m[8]! * rgb[2]
];

describe('scene grades', () => {
    it('snaps a grade to steps, so an eased value bakes a handful of copies and not one a frame', () => {
        expect(quantizeSceneFilter({ hueDeg: -37.2, saturate: 1.33 })).toEqual({ hueDeg: -35, saturate: 1.3, brightness: 1, blurPx: 0 });
        expect(quantizeSceneFilter({ hueDeg: -37.2, saturate: 1.33 }, true)).toEqual({ hueDeg: -30, saturate: 1.25, brightness: 1, blurPx: 0 });
        const steps = new Set<string>();
        for (let hue = 0; hue >= -40; hue -= 0.25) {
            steps.add(JSON.stringify(quantizeSceneFilter({ hueDeg: hue })));
        }
        expect(steps.size).toBeLessThanOrEqual(9);
    });

    it('knows a grade that changes nothing, and writes the rest as CSS', () => {
        expect(sceneFilterIsIdentity(quantizeSceneFilter({}))).toBe(true);
        expect(sceneFilterIsIdentity(quantizeSceneFilter({ hueDeg: 360 }))).toBe(true);
        expect(sceneFilterIsIdentity(quantizeSceneFilter({ hueDeg: 2 }))).toBe(true);
        expect(sceneFilterIsIdentity(quantizeSceneFilter({ blurPx: 2 }))).toBe(false);
        expect(sceneFilterCss(quantizeSceneFilter({ hueDeg: 165, saturate: 1.4, brightness: 1.2 }))).toBe('hue-rotate(165deg) saturate(1.4) brightness(1.2)');
        expect(sceneFilterCss(quantizeSceneFilter({ blurPx: 7, brightness: 1.4 }))).toBe('brightness(1.4) blur(7px)');
        expect(sceneFilterCss(quantizeSceneFilter({}))).toBe('');
    });

    it('applies a colour grade live and bakes a blur', () => {
        expect(sceneFilterIsLive({ hueDeg: -20, saturate: 1.2 })).toBe(true);
        expect(sceneFilterIsLive({ blurPx: 7, brightness: 1.4 })).toBe(false);
        // Live grades are exact, not snapped: the ring turns smoothly.
        expect(sceneLiveFilterCss({ hueDeg: -37.23, saturate: 1.33 })).toBe('hue-rotate(-37.2deg) saturate(1.33)');
        expect(sceneLiveFilterCss({})).toBe('');
    });

    it('grades by matrix the way CSS does, for a canvas that cannot filter', () => {
        const identity = sceneFilterMatrix({ hueDeg: 0, saturate: 1, brightness: 1, blurPx: 0 });
        expect(apply(identity, [200, 100, 50]).map((v) => Math.round(v))).toEqual([200, 100, 50]);
        // Brightness scales every channel.
        expect(apply(sceneFilterMatrix({ hueDeg: 0, saturate: 1, brightness: 1.5, blurPx: 0 }), [100, 60, 20]).map((v) => Math.round(v))).toEqual([150, 90, 30]);
        // No saturation is a grey of the pixel's own luminance.
        const grey = apply(sceneFilterMatrix({ hueDeg: 0, saturate: 0, brightness: 1, blurPx: 0 }), [200, 100, 50]);
        expect(grey[0]).toBeCloseTo(grey[1]!, 6);
        expect(grey[1]).toBeCloseTo(grey[2]!, 6);
        expect(grey[0]).toBeCloseTo(0.213 * 200 + 0.715 * 100 + 0.072 * 50, 3);
        // A grey pixel has no hue to turn.
        const turned = apply(sceneFilterMatrix({ hueDeg: 120, saturate: 1, brightness: 1, blurPx: 0 }), [90, 90, 90]);
        for (const channel of turned) {
            expect(channel).toBeCloseTo(90, 0);
        }
        // Turning red a third of the way round takes it toward green.
        const red = apply(sceneFilterMatrix({ hueDeg: 120, saturate: 1, brightness: 1, blurPx: 0 }), [255, 0, 0]);
        expect(red[1]).toBeGreaterThan(red[0]!);
        // A full turn is no turn.
        const full = apply(sceneFilterMatrix({ hueDeg: 360, saturate: 1, brightness: 1, blurPx: 0 }), [200, 100, 50]);
        expect(full.map((v) => Math.round(v))).toEqual([200, 100, 50]);
    });
});

describe('scene images', () => {
    const loaded = (width = 1376, height = 768): HTMLImageElement => {
        const element = new Image();
        Object.defineProperty(element, 'complete', { value: true });
        Object.defineProperty(element, 'naturalWidth', { value: width });
        Object.defineProperty(element, 'naturalHeight', { value: height });
        return element;
    };

    it('draws at once from an image the preloader already holds, without asking for it again', () => {
        const element = loaded();
        let notified = 0;
        subscribeSceneImages(() => {
            notified += 1;
        });
        offerSceneImage('/held.webp', element);
        const image = getSceneImage('/held.webp');
        expect(image).not.toBeNull();
        expect(image!.width).toBe(1376);
        expect(image!.height).toBe(768);
        // The very element that was offered: no second image was made to fetch it.
        expect(element.getAttribute('src')).toBeNull();
        expect(notified).toBeGreaterThan(0);
    });

    it('keeps the first image offered for a URL', () => {
        const first = loaded(100, 50);
        offerSceneImage('/a.webp', first);
        offerSceneImage('/a.webp', loaded(200, 100));
        expect(getSceneImage('/a.webp')!.width).toBe(100);
    });

    it('reuses decoded preloaded pixels without retaining a second bitmap for every scene layer', async () => {
        const createBitmap = vi.fn();
        vi.stubGlobal('createImageBitmap', createBitmap);
        try {
            const element = loaded();
            offerSceneImage('/single-decoded-source.webp', element);
            expect(getSceneImage('/single-decoded-source.webp')?.image).toBe(element);
            await Promise.resolve();
            expect(createBitmap).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('bounds filtered backing stores across all rooms and releases evicted pixels immediately', () => {
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            filter: 'none', drawImage: vi.fn()
        } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
        try {
            const copies: HTMLCanvasElement[] = [];
            for (let room = 0; room < 24; room++) {
                const src = `/bounded-grade-${room}.webp`;
                offerSceneImage(src, loaded(1024, 1024));
                copies.push(getSceneImage(src, { brightness: 1.5, blurPx: 4 })!.image as HTMLCanvasElement);
            }
            expect(copies.filter((copy) => copy.width > 1)).toHaveLength(8);
            expect(copies[0]!.width).toBe(1);
            expect(copies[0]!.height).toBe(1);
            expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
            const latest = copies.at(-1)!;
            expect(getSceneImage('/bounded-grade-23.webp', { brightness: 1.5, blurPx: 4 })?.image).toBe(latest);
        } finally {
            getContext.mockRestore();
        }
    });

    it('has nothing for an image still on its way, and nothing for no image at all', () => {
        expect(getSceneImage('')).toBeNull();
        expect(getSceneImage('/not-yet.webp')).toBeNull();
        // Asking twice does not start it twice or throw.
        expect(getSceneImage('/not-yet.webp')).toBeNull();
    });
});
