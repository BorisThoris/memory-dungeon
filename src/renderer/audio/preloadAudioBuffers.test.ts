import { describe, expect, it, vi } from 'vitest';
import { preloadAudioBuffers } from './preloadAudioBuffers';

describe('preloadAudioBuffers', () => {
    it('limits concurrent fetch and decode work', async () => {
        const active = { count: 0, max: 0 };
        const releaseQueue: Array<() => void> = [];
        const fetchArrayBuffer = vi.fn(async () => {
            active.count += 1;
            active.max = Math.max(active.max, active.count);
            await new Promise<void>((resolve) => {
                releaseQueue.push(resolve);
            });
            active.count -= 1;
            return new ArrayBuffer(8);
        });
        const decode = vi.fn(async () => ({ duration: 0.1 }) as AudioBuffer);

        const preload = preloadAudioBuffers({
            concurrency: 2,
            decode,
            fetchArrayBuffer,
            keys: ['a', 'b', 'c', 'd'],
            urlForKey: (key) => `${key}.wav`
        });

        await vi.waitFor(() => expect(fetchArrayBuffer).toHaveBeenCalledTimes(2));
        releaseQueue.splice(0).forEach((release) => release());
        await vi.waitFor(() => expect(fetchArrayBuffer).toHaveBeenCalledTimes(4));
        releaseQueue.splice(0).forEach((release) => release());

        const loaded = await preload;

        expect(active.max).toBe(2);
        expect(decode).toHaveBeenCalledTimes(4);
        expect([...loaded.keys()]).toEqual(['a', 'b', 'c', 'd']);
    });

    it('skips missing URLs and failed samples without rejecting the preload', async () => {
        const decode = vi.fn(async () => ({ duration: 0.1 }) as AudioBuffer);
        const fetchArrayBuffer = vi.fn(async (url: string) => {
            if (url === 'bad.wav') {
                throw new Error('decode source unavailable');
            }
            return new ArrayBuffer(8);
        });

        const loaded = await preloadAudioBuffers({
            concurrency: 3,
            decode,
            fetchArrayBuffer,
            keys: ['good', 'missing', 'bad'],
            urlForKey: (key) => (key === 'missing' ? undefined : `${key}.wav`)
        });

        expect([...loaded.keys()]).toEqual(['good']);
        expect(decode).toHaveBeenCalledTimes(1);
    });

    it('dedupes repeated sample keys before fetching and decoding', async () => {
        const decode = vi.fn(async () => ({ duration: 0.1 }) as AudioBuffer);
        const fetchArrayBuffer = vi.fn(async () => new ArrayBuffer(8));

        const loaded = await preloadAudioBuffers({
            concurrency: 2,
            decode,
            fetchArrayBuffer,
            keys: ['click', 'click', 'confirm', 'click'],
            urlForKey: (key) => `${key}.wav`
        });

        expect(fetchArrayBuffer).toHaveBeenCalledTimes(2);
        expect(fetchArrayBuffer).toHaveBeenNthCalledWith(1, 'click.wav');
        expect(fetchArrayBuffer).toHaveBeenNthCalledWith(2, 'confirm.wav');
        expect(decode).toHaveBeenCalledTimes(2);
        expect([...loaded.keys()]).toEqual(['click', 'confirm']);
    });

    it('does not let a stalled fetch or decode hold the preload queue open', async () => {
        vi.useFakeTimers();

        const fetchArrayBuffer = vi.fn(async (url: string) => {
            if (url === 'fetch-stall.wav') {
                return new Promise<ArrayBuffer>(() => undefined);
            }

            return new ArrayBuffer(8);
        });
        const decode = vi.fn(async () => new Promise<AudioBuffer>(() => undefined));

        try {
            const preload = preloadAudioBuffers({
                concurrency: 1,
                decode,
                fetchArrayBuffer,
                keys: ['fetch-stall', 'decode-stall'],
                timeoutMs: 250,
                urlForKey: (key) => `${key}.wav`
            });

            await vi.advanceTimersByTimeAsync(500);

            await expect(preload).resolves.toEqual(new Map());
            expect(fetchArrayBuffer).toHaveBeenCalledTimes(2);
            expect(decode).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});
