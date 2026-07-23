import { afterEach, describe, expect, it, vi } from 'vitest';

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock('opentype.js', () => ({
    default: { parse }
}));

import {
    preloadCardRankOpentypeFont,
    resetCardRankOpentypeFontForTests,
    subscribeCardRankFontLoaded
} from './opentypeCardRankFont';

const successfulResponse = (): Pick<Response, 'arrayBuffer' | 'ok'> => ({
    arrayBuffer: async () => new ArrayBuffer(8),
    ok: true
});

describe('opentypeCardRankFont preload', () => {
    afterEach(() => {
        resetCardRankOpentypeFontForTests();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        parse.mockReset();
    });

    it('deduplicates concurrent loads and caches a successful font', async () => {
        const fetchFont = vi.fn(async () => successfulResponse());
        vi.stubGlobal('fetch', fetchFont);
        parse.mockReturnValue({});

        const first = preloadCardRankOpentypeFont('high');
        const concurrent = preloadCardRankOpentypeFont('high');

        expect(concurrent).toBe(first);
        await first;
        await preloadCardRankOpentypeFont('high');

        expect(fetchFont).toHaveBeenCalledTimes(1);
        expect(parse).toHaveBeenCalledTimes(1);
    });

    it('allows a later retry after an HTTP failure', async () => {
        const fetchFont = vi
            .fn()
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce(successfulResponse());
        vi.stubGlobal('fetch', fetchFont);
        parse.mockReturnValue({});

        await preloadCardRankOpentypeFont('high');
        await preloadCardRankOpentypeFont('high');

        expect(fetchFont).toHaveBeenCalledTimes(2);
        expect(parse).toHaveBeenCalledTimes(1);
    });

    it('allows a later retry after a rejected fetch', async () => {
        const fetchFont = vi
            .fn()
            .mockRejectedValueOnce(new Error('network unavailable'))
            .mockResolvedValueOnce(successfulResponse());
        vi.stubGlobal('fetch', fetchFont);
        parse.mockReturnValue({});

        await preloadCardRankOpentypeFont('high');
        await preloadCardRankOpentypeFont('high');

        expect(fetchFont).toHaveBeenCalledTimes(2);
        expect(parse).toHaveBeenCalledTimes(1);
    });

    it('isolates notification failures and still notifies remaining subscribers', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => successfulResponse()));
        parse.mockReturnValue({});
        const failingListener = vi.fn(() => {
            throw new Error('observer failed');
        });
        const healthyListener = vi.fn();
        subscribeCardRankFontLoaded(failingListener);
        subscribeCardRankFontLoaded(healthyListener);

        await preloadCardRankOpentypeFont('high');

        expect(failingListener).toHaveBeenCalledTimes(1);
        expect(healthyListener).toHaveBeenCalledTimes(1);
    });

    it('does not load the optional font below high quality', async () => {
        const fetchFont = vi.fn(async () => successfulResponse());
        vi.stubGlobal('fetch', fetchFont);

        await preloadCardRankOpentypeFont('medium');

        expect(fetchFont).not.toHaveBeenCalled();
    });
});
