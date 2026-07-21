import { describe, expect, it } from 'vitest';
import { RUN_MODE_CATALOG } from '../../../shared/run-mode-catalog';
import {
    getModePosterArtRows,
    MODE_CARD_ART,
    MODE_POSTER_FALLBACK_KEY,
    MODE_POSTER_KEYS,
    modePosterHasCustomArt,
    resolveModePosterUrl,
    resolveUiBackgroundUrl
} from './modeArt';

describe('modeArt vs run-mode-catalog', () => {
    it('every catalog posterKey resolves to bundled art (no missing keys)', () => {
        expect(Object.keys(MODE_CARD_ART)).toEqual([...MODE_POSTER_KEYS]);
        for (const mode of RUN_MODE_CATALOG) {
            expect(MODE_POSTER_KEYS, `mode "${mode.id}" posterKey "${mode.posterKey}"`).toContain(mode.posterKey);
        }
    });

    it('REG-013 documents custom vs fallback poster coverage', () => {
        const rows = getModePosterArtRows();
        expect(rows.map((row) => row.key)).toEqual([...MODE_POSTER_KEYS]);
        expect(rows.find((row) => row.key === 'classic')?.status).toBe('custom');
        expect(rows.find((row) => row.key === MODE_POSTER_FALLBACK_KEY)?.status).toBe('fallback');
        expect(rows.find((row) => row.key === 'dungeon_showcase')?.status).toBe('custom');
        expect(rows.find((row) => row.key === 'gauntlet')?.status).toBe('custom');
        expect(modePosterHasCustomArt('daily')).toBe(true);
        expect(modePosterHasCustomArt('scholar')).toBe(true);
        expect(RUN_MODE_CATALOG.every((mode) => modePosterHasCustomArt(mode.posterKey))).toBe(true);
        expect(rows.every((row) => row.assetUrl.length > 0)).toBe(true);
    });

    it('falls back to visible inline art for unknown or absent browser-demo backgrounds', () => {
        expect(resolveModePosterUrl('unknown-mode')).toBe(MODE_CARD_ART.fallback);
        expect(resolveUiBackgroundUrl('missing-background-from-demo-build.png')).toMatch(/^data:image\/svg\+xml/);
    });
});
