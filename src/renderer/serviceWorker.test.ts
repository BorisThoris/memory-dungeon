import { describe, expect, it } from 'vitest';
import { shouldRegisterServiceWorker } from './serviceWorker';

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
