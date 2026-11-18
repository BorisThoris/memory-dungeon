import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleChunk, shouldRegisterServiceWorker, STALE_CHUNK_RELOAD_KEY } from './serviceWorker';

const web = { production: true, desktop: false, secureContext: true, supported: true, protocol: 'https:' };

describe('offline service worker registration', () => {
    it('registers on a production web build', () => {
        expect(shouldRegisterServiceWorker(web)).toBe(true);
    });

    it('stays off on the dev server, the desktop build and insecure pages', () => {
        expect(shouldRegisterServiceWorker({ ...web, production: false })).toBe(false);
        expect(shouldRegisterServiceWorker({ ...web, desktop: true })).toBe(false);
        expect(shouldRegisterServiceWorker({ ...web, protocol: 'app:' })).toBe(false);
        expect(shouldRegisterServiceWorker({ ...web, secureContext: false })).toBe(false);
        expect(shouldRegisterServiceWorker({ ...web, supported: false })).toBe(false);
    });
});

describe('a chunk a newer deploy renamed', () => {
    const fakeWindow = () => {
        const target = new EventTarget() as EventTarget & { sessionStorage: Storage; location: { reload: () => void } };
        const values = new Map<string, string>();
        target.sessionStorage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => void values.set(key, value)
        } as Storage;
        target.location = { reload: vi.fn() };
        return target;
    };

    it('reloads once to pick up the new build, and never again in that session', () => {
        const target = fakeWindow();
        reloadOnStaleChunk(target as unknown as Window);
        const first = new Event('vite:preloadError', { cancelable: true });
        target.dispatchEvent(first);
        expect(target.location.reload).toHaveBeenCalledTimes(1);
        expect(first.defaultPrevented).toBe(true);
        expect(target.sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)).toBe('1');
        const second = new Event('vite:preloadError', { cancelable: true });
        target.dispatchEvent(second);
        expect(target.location.reload).toHaveBeenCalledTimes(1);
        expect(second.defaultPrevented).toBe(false);
    });
});
