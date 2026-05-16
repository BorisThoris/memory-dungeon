import { describe, expect, it } from 'vitest';
import { RUN_MODE_CATALOG } from '../../../shared/run-mode-catalog';
import {
    getModePosterArtRows,
    MODE_CARD_ART,
    MODE_POSTER_FALLBACK_KEY,
    modePosterHasCustomArt,
    type ModePosterKey
} from './modeArt';

describe('modeArt vs run-mode-catalog', () => {
    it('every catalog posterKey resolves to bundled art (no missing keys)', () => {
        const keys = Object.keys(MODE_CARD_ART) as ModePosterKey[];
        for (const mode of RUN_MODE_CATALOG) {
            expect(keys, `mode "${mode.id}" posterKey "${mode.posterKey}"`).toContain(mode.posterKey);
        }
    });

    it('REG-013 documents custom vs fallback poster coverage', () => {
        const rows = getModePosterArtRows();
        expect(rows.find((row) => row.key === 'classic')?.status).toBe('custom');
        expect(rows.find((row) => row.key === MODE_POSTER_FALLBACK_KEY)?.status).toBe('fallback');
        expect(rows.find((row) => row.key === 'dungeon_showcase')?.status).toBe('custom');
        expect(rows.find((row) => row.key === 'gauntlet')?.status).toBe('custom');
        expect(modePosterHasCustomArt('daily')).toBe(true);
        expect(modePosterHasCustomArt('scholar')).toBe(true);
        expect(RUN_MODE_CATALOG.every((mode) => modePosterHasCustomArt(mode.posterKey))).toBe(true);
        expect(rows.every((row) => row.assetUrl.length > 0)).toBe(true);
    });
});
