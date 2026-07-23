import { describe, expect, it } from 'vitest';
import { buildAudioUrlMapByFilename, filenameFromAudioGlobPath } from './audioGlobUrlMap';

describe('audioGlobUrlMap', () => {
    it('extracts filenames from Vite glob paths', () => {
        expect(filenameFromAudioGlobPath('../assets/audio/sfx/flip.ogg')).toBe('flip.ogg');
        expect(filenameFromAudioGlobPath('/absolute/path/to/ui-click.ogg')).toBe('ui-click.ogg');
        expect(filenameFromAudioGlobPath('intro-sting.ogg')).toBe('intro-sting.ogg');
    });

    it('builds a filename lookup with Map insertion precedence', () => {
        const urls = buildAudioUrlMapByFilename({
            '../assets/audio/sfx/flip.ogg': '/assets/flip-a.ogg',
            '../assets/audio/ui/ui-click.ogg': '/assets/ui-click.ogg',
            '../overrides/flip.ogg': '/assets/flip-b.ogg'
        });

        expect([...urls.keys()]).toEqual(['flip.ogg', 'ui-click.ogg']);
        expect(urls.get('flip.ogg')).toBe('/assets/flip-b.ogg');
        expect(urls.get('ui-click.ogg')).toBe('/assets/ui-click.ogg');
    });
});
