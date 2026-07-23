import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('preloadCardIllustrationImages', () => {
    const originalImage = globalThis.Image;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: originalImage
        });
    });

    it('limits concurrent image warm-up work and dedupes URLs', async () => {
        const active = { count: 0, max: 0 };
        const releaseQueue: Array<() => void> = [];
        const requestedUrls: string[] = [];

        class MockImage {
            decoding: 'async' | 'auto' | 'sync' = 'auto';
            naturalWidth = 64;
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;

            decode = vi.fn(async () => undefined);

            set src(value: string) {
                requestedUrls.push(value);
                active.count += 1;
                active.max = Math.max(active.max, active.count);
                releaseQueue.push(() => {
                    active.count -= 1;
                    this.onload?.();
                });
            }
        }

        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: MockImage
        });

        const { preloadCardIllustrationImages } = await import('./cardIllustrationImages');
        const preload = preloadCardIllustrationImages(['a.png', 'b.png', 'a.png', 'c.png'], {
            concurrency: 2
        });

        await vi.waitFor(() => expect(releaseQueue).toHaveLength(2));
        releaseQueue.splice(0).forEach((release) => release());
        await vi.waitFor(() => expect(releaseQueue).toHaveLength(1));
        releaseQueue.splice(0).forEach((release) => release());
        await preload;

        expect(active.max).toBe(2);
        expect(requestedUrls).toEqual(['a.png', 'b.png', 'c.png']);
    });

    it('normalizes malformed preload concurrency before starting workers', async () => {
        const active = { count: 0, max: 0 };
        const releaseQueue: Array<() => void> = [];

        class MockImage {
            decoding: 'async' | 'auto' | 'sync' = 'auto';
            naturalWidth = 64;
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;

            decode = vi.fn(async () => undefined);

            set src(_value: string) {
                active.count += 1;
                active.max = Math.max(active.max, active.count);
                releaseQueue.push(() => {
                    active.count -= 1;
                    this.onload?.();
                });
            }
        }

        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: MockImage
        });

        const { preloadCardIllustrationImages } = await import('./cardIllustrationImages');
        const preload = preloadCardIllustrationImages(['a.png', 'b.png', 'c.png', 'd.png', 'e.png'], {
            concurrency: Number.NaN
        });

        await vi.waitFor(() => expect(releaseQueue).toHaveLength(4));
        expect(active.max).toBe(4);
        releaseQueue.splice(0).forEach((release) => release());
        await vi.waitFor(() => expect(releaseQueue).toHaveLength(1));
        releaseQueue.splice(0).forEach((release) => release());
        await preload;

        const negativeConcurrencyPreload = preloadCardIllustrationImages(['f.png'], { concurrency: -2 });
        await vi.waitFor(() => expect(releaseQueue).toHaveLength(1));
        releaseQueue.splice(0).forEach((release) => release());
        await negativeConcurrencyPreload;
    });

    it('caches the image after async decode completes', async () => {
        let decodeResolve: (() => void) | null = null;

        class MockImage {
            decoding: 'async' | 'auto' | 'sync' = 'auto';
            naturalWidth = 64;
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;

            decode = vi.fn(
                () =>
                    new Promise<void>((resolve) => {
                        decodeResolve = resolve;
                    })
            );

            set src(_value: string) {
                queueMicrotask(() => {
                    this.onload?.();
                });
            }
        }

        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: MockImage
        });

        const { getCardIllustrationImageByUrl, preloadCardIllustrationImages } = await import('./cardIllustrationImages');
        const preload = preloadCardIllustrationImages(['decoded.png']);

        await vi.waitFor(() => expect(decodeResolve).not.toBeNull());
        expect(getCardIllustrationImageByUrl('decoded.png')).toBeNull();

        expect(decodeResolve).toBeTypeOf('function');
        const resolveDecode = decodeResolve as unknown as () => void;
        resolveDecode();
        await preload;

        expect(getCardIllustrationImageByUrl('decoded.png')).not.toBeNull();
    });

    it('does not let a stalled image request hold the preload queue open', async () => {
        vi.useFakeTimers();

        class MockImage {
            decoding: 'async' | 'auto' | 'sync' = 'auto';
            naturalWidth = 0;
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;

            set src(_value: string) {
                /* Deliberately never fires load or error. */
            }
        }

        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: MockImage
        });

        try {
            const { getCardIllustrationImageByUrl, preloadCardIllustrationImages } = await import('./cardIllustrationImages');
            const preload = preloadCardIllustrationImages(['stalled.png'], { concurrency: 1 });

            await vi.advanceTimersByTimeAsync(1500);
            await expect(preload).resolves.toBeUndefined();
            expect(getCardIllustrationImageByUrl('stalled.png')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
