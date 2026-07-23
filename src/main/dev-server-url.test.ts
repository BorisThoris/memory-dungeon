import { describe, expect, it } from 'vitest';
import { resolveDevServerUrl } from './dev-server-url';

describe('resolveDevServerUrl', () => {
    it.each([
        ['http://127.0.0.1:5173', 'http://127.0.0.1:5173/'],
        ['http://localhost:5173/app', 'http://localhost:5173/app'],
        ['https://[::1]:5173', 'https://[::1]:5173/']
    ])('accepts unpackaged loopback URL %s', (rawValue, expected) => {
        expect(resolveDevServerUrl(rawValue, false)).toBe(expected);
    });

    it.each([
        undefined,
        'not-a-url',
        'file:///tmp/renderer.html',
        'javascript:alert(1)',
        'https://example.com',
        'http://0.0.0.0:5173',
        'http://user:password@localhost:5173'
    ])('rejects unsafe development URL %j', (rawValue) => {
        expect(resolveDevServerUrl(rawValue, false)).toBeNull();
    });

    it('rejects loopback development URLs in packaged builds', () => {
        expect(resolveDevServerUrl('http://127.0.0.1:5173', true)).toBeNull();
    });
});

