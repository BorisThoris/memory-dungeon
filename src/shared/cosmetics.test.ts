import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import {
    CARD_THEME_CATALOG,
    COSMETIC_CATALOG,
    COSMETIC_IDS,
    getCosmeticTrackRows,
    getCardThemeRows,
    getCosmeticRows,
    resolveEquippedCardTheme,
    unlockedCosmeticIds,
    type CosmeticId
} from './cosmetics';

describe('REG-025 cosmetics catalog', () => {
    it('keeps cosmetics as unlock-tag driven visual-only rows', () => {
        const save = createDefaultSaveData();
        save.unlocks = ['cosmetic:crest_daily_bronze', 'cosmetic:title_ascendant_v'];

        expect(Object.keys(COSMETIC_CATALOG)).toEqual(COSMETIC_IDS satisfies readonly CosmeticId[]);
        expect(unlockedCosmeticIds(save)).toEqual(['crest_daily_bronze', 'title_ascendant_v']);

        const rows = getCosmeticRows(save);
        expect(rows.find((row) => row.id === 'crest_daily_bronze')?.status).toBe('owned');
        expect(rows.find((row) => row.id === 'title_ascendant_v')?.status).toBe('owned');
        expect(rows.some((row) => row.label.includes('Relic Gold'))).toBe(false);
        expect(rows.every((row) => row.gameplayAffecting === false)).toBe(true);
    });

    it('REG-066 exposes one shared equipped card-back theme', () => {
        const save = createDefaultSaveData();
        save.unlocks = ['cosmetic:obsolete_card_back'];

        expect(Object.keys(CARD_THEME_CATALOG)).toEqual(['card_back_classic']);
        expect(resolveEquippedCardTheme(save).id).toBe('classic_card_back');
        expect(resolveEquippedCardTheme(save).asset.back).toBe('/src/renderer/assets/textures/cards/authored-card-back.svg');

        const rows = getCardThemeRows(save);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: 'classic_card_back',
            equipped: true,
            asset: { back: '/src/renderer/assets/textures/cards/authored-card-back.svg' }
        });
        expect(rows[0]?.readability).toContain('same shared back');
    });

    it('REG-080 maps cosmetics onto a local visual-only progression track', () => {
        const save = createDefaultSaveData();
        save.unlocks = ['cosmetic:crest_daily_bronze'];

        const rows = getCosmeticTrackRows(save);
        expect(rows.map((row) => row.trackId)).toEqual(['starter', 'daily', 'mastery']);
        expect(rows.find((row) => row.trackId === 'daily')?.owned).toBe(1);
        expect(rows.every((row) => row.gameplayAffecting === false)).toBe(true);
    });
});
