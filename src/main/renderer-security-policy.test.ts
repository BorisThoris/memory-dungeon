import { describe, expect, it } from 'vitest';
import {
    RENDERER_SECURITY_WEB_PREFERENCES,
    rendererNavigationIsAllowed
} from './renderer-security-policy';

describe('renderer security policy', () => {
    it('keeps the renderer isolated, Node-free, and sandboxed', () => {
        expect(RENDERER_SECURITY_WEB_PREFERENCES).toEqual({
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        });
    });

    it.each([
        ['http://127.0.0.1:5173/game?mode=daily', 'http://127.0.0.1:5173/'],
        ['file:///opt/memory-dungeon/dist/index.html#settings', 'file:///opt/memory-dungeon/dist/index.html']
    ])('allows renderer navigation within the configured entry boundary', (candidateUrl, entryUrl) => {
        expect(rendererNavigationIsAllowed(candidateUrl, entryUrl)).toBe(true);
    });

    it.each([
        ['https://example.com', 'http://127.0.0.1:5173/'],
        ['http://localhost:5173/', 'http://127.0.0.1:5173/'],
        ['file:///tmp/other.html', 'file:///opt/memory-dungeon/dist/index.html'],
        ['javascript:alert(1)', 'file:///opt/memory-dungeon/dist/index.html'],
        ['not-a-url', 'file:///opt/memory-dungeon/dist/index.html']
    ])('rejects renderer navigation outside the configured entry boundary', (candidateUrl, entryUrl) => {
        expect(rendererNavigationIsAllowed(candidateUrl, entryUrl)).toBe(false);
    });
});

