import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import {
    CARD_THEME_CATALOG,
    COSMETIC_CATALOG,
    COSMETIC_IDS,
    getCosmeticCatalogRows,
    getCosmeticTrackRows,
    getCardThemeRows,
    getCosmeticCollectionRows,
    getEquippedCardTheme,
    getOwnedCosmeticIds,
    type CosmeticId
} from './cosmetics';

describe('REG-025 cosmetics catalog', () => {
    it('keeps cosmetics as unlock-tag driven visual-only rows', () => {
        const save = createDefaultSaveData();
        save.unlocks = ['cosmetic:crest_daily_bronze', 'cosmetic:title_ascendant_v'];

        expect(Object.keys(COSMETIC_CATALOG)).toEqual(COSMETIC_IDS satisfies readonly CosmeticId[]);
        expect(getCosmeticCatalogRows().map((row) => row.id)).toEqual(COSMETIC_IDS);
        /*
         * Gen 215: this called `unlockedCosmeticIds`, `getCosmeticRows` and
         * `resolveEquippedCardTheme` - three exports nothing in the game reached, two of them
         * second names for functions that at least had one live caller. Repointing the suite at
         * those showed the plainer half of the truth: `getCosmeticCollectionRows` is reached by
         * the Collection screen, and `getOwnedCosmeticIds` and `getEquippedCardTheme` are not
         * reached by anything either. They stay listed as debt rather than relabelled as design.
         */
        expect(getOwnedCosmeticIds(save)).toEqual(
            expect.arrayContaining(['crest_daily_bronze', 'title_ascendant_v'])
        );

        const rows = getCosmeticCollectionRows(save);
        expect(rows.find((row) => row.id === 'crest_daily_bronze')?.status).toBe('owned');
        expect(rows.find((row) => row.id === 'title_ascendant_v')?.status).toBe('owned');
        expect(rows.some((row) => row.label.includes('Relic Gold'))).toBe(false);
        expect(rows.every((row) => row.gameplayAffecting === false)).toBe(true);
    });

    it('REG-066 exposes one shared equipped card-back theme', () => {
        const save = createDefaultSaveData();
        save.unlocks = ['cosmetic:obsolete_card_back'];

        expect(Object.keys(CARD_THEME_CATALOG)).toEqual(['card_back_classic']);
        expect(getEquippedCardTheme(save).id).toBe('classic_card_back');
        expect(getEquippedCardTheme(save).asset.back).toBe('/src/renderer/assets/textures/cards/authored-card-back.svg');

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
        expect(rows.map((row) => row.trackId)).toEqual(['starter', 'sharp', 'mastery']);
        expect(rows.find((row) => row.trackId === 'sharp')?.owned).toBe(1);
        expect(rows.every((row) => row.gameplayAffecting === false)).toBe(true);
    });
});
