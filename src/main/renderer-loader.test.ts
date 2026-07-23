import { describe, expect, it, vi } from 'vitest';
import { loadRendererEntry } from './renderer-loader';

describe('loadRendererEntry', () => {
    it('loads a configured development renderer without touching the bundle', async () => {
        const loadDevelopmentUrl = vi.fn(async () => undefined);
        const loadBundledFile = vi.fn(async () => undefined);

        await expect(
            loadRendererEntry({
                developmentUrl: 'http://127.0.0.1:5173/',
                loadDevelopmentUrl,
                loadBundledFile,
                reportError: vi.fn()
            })
        ).resolves.toBe('development');
        expect(loadDevelopmentUrl).toHaveBeenCalledWith('http://127.0.0.1:5173/');
        expect(loadBundledFile).not.toHaveBeenCalled();
    });

    it('falls back to the bundled renderer after a development load failure', async () => {
        const devError = new Error('dev server unavailable');
        const reportError = vi.fn();
        const loadBundledFile = vi.fn(async () => undefined);

        await expect(
            loadRendererEntry({
                developmentUrl: 'http://127.0.0.1:5173/',
                loadDevelopmentUrl: vi.fn(async () => Promise.reject(devError)),
                loadBundledFile,
                reportError
            })
        ).resolves.toBe('bundled');
        expect(reportError).toHaveBeenCalledWith('development', devError);
        expect(loadBundledFile).toHaveBeenCalledTimes(1);
    });

    it('returns a controlled failure after every available renderer rejects', async () => {
        const bundledError = new Error('bundle missing');
        const reportError = vi.fn();

        await expect(
            loadRendererEntry({
                developmentUrl: null,
                loadDevelopmentUrl: vi.fn(),
                loadBundledFile: vi.fn(async () => Promise.reject(bundledError)),
                reportError
            })
        ).resolves.toBe('failed');
        expect(reportError).toHaveBeenCalledWith('bundled', bundledError);
    });
});

