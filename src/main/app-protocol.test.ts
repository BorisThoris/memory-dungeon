import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ENTRY_URL, resolveAppRequestPath } from './app-protocol';
import { rendererNavigationIsAllowed } from './renderer-security-policy';

const dist = path.resolve('/game/dist');

describe('the app:// scheme the packaged game is served from', () => {
    it('maps the site-root paths the web build asks for into dist', () => {
        expect(resolveAppRequestPath(dist, 'app://game/assets/main-abc.js')).toBe(path.join(dist, 'assets', 'main-abc.js'));
        expect(resolveAppRequestPath(dist, 'app://game/audio/sfx%20one.ogg')).toBe(path.join(dist, 'audio', 'sfx one.ogg'));
        expect(resolveAppRequestPath(dist, APP_ENTRY_URL)).toBe(path.join(dist, 'index.html'));
        expect(resolveAppRequestPath(dist, 'app://game/')).toBe(path.join(dist, 'index.html'));
        expect(resolveAppRequestPath(dist, 'app://game/assets/x.js?v=2#h')).toBe(path.join(dist, 'assets', 'x.js'));
    });

    it('serves nothing outside dist, on another host or from a malformed URL', () => {
        expect(resolveAppRequestPath(dist, 'app://game/../secret.txt')).toBe(path.join(dist, 'secret.txt'));
        // The URL parser folds encoded dot segments before we see them; whatever it makes, it stays in dist.
        const folded = resolveAppRequestPath(dist, 'app://game/%2e%2e/%2e%2e/secret.txt');
        expect(folded === null || !path.relative(dist, folded).startsWith('..')).toBe(true);
        expect(resolveAppRequestPath(dist, 'app://game/assets/..%2F..%2Fsecret.txt')).toBeNull();
        expect(resolveAppRequestPath(dist, 'app://game/a%00.js')).toBeNull();
        expect(resolveAppRequestPath(dist, 'app://game/%E0%A4%A')).toBeNull();
        expect(resolveAppRequestPath(dist, 'app://other/index.html')).toBeNull();
        expect(resolveAppRequestPath(dist, 'file:///C:/assets/main.js')).toBeNull();
        expect(resolveAppRequestPath(dist, 'not a url')).toBeNull();
    });

    it('lets the window navigate within the game and nowhere else', () => {
        expect(rendererNavigationIsAllowed('app://game/index.html?hallRoom=x', APP_ENTRY_URL)).toBe(true);
        expect(rendererNavigationIsAllowed('https://example.com/', APP_ENTRY_URL)).toBe(false);
        expect(rendererNavigationIsAllowed('file:///C:/index.html', APP_ENTRY_URL)).toBe(false);
        expect(rendererNavigationIsAllowed('app://other/index.html', APP_ENTRY_URL)).toBe(false);
        expect(rendererNavigationIsAllowed('javascript:alert(1)', APP_ENTRY_URL)).toBe(false);
    });
});
