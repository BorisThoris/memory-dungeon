import { describe, expect, it } from 'vitest';
import { resolveGameShellLayout, resolveGameShellOrientation, resolveGameShellProfile } from './gameShellLayout';

describe('resolveGameShellLayout', () => {
    it('names phones by how they are held', () => {
        expect(resolveGameShellLayout(390, 844)).toBe('phone-portrait');
        expect(resolveGameShellLayout(360, 740)).toBe('phone-portrait');
        expect(resolveGameShellLayout(844, 390)).toBe('phone-landscape');
        expect(resolveGameShellLayout(812, 375)).toBe('phone-landscape');
    });

    it('keeps tablets and short HD out of the phone buckets', () => {
        expect(resolveGameShellLayout(768, 1024)).toBe('tablet');
        expect(resolveGameShellLayout(1024, 768)).toBe('tablet');
        expect(resolveGameShellLayout(1280, 720)).toBe('desktop');
        expect(resolveGameShellLayout(1440, 900)).toBe('desktop');
    });

    it('treats a square window as portrait', () => {
        expect(resolveGameShellOrientation(900, 900)).toBe('portrait');
        expect(resolveGameShellOrientation(901, 900)).toBe('landscape');
    });

    it('publishes the input mode alongside the shape', () => {
        expect(resolveGameShellProfile(390, 844, true)).toEqual({
            layout: 'phone-portrait',
            input: 'touch',
            orientation: 'portrait'
        });
        expect(resolveGameShellProfile(1440, 900, false)).toEqual({
            layout: 'desktop',
            input: 'pointer',
            orientation: 'landscape'
        });
    });
});
