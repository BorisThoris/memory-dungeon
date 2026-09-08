import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import { getMainMenuHubQualityRows } from './main-menu-hub-quality';

describe('REG-091 main menu hub quality rows', () => {
    it('derives mode entry, profile, local save, and offline social rows from save data', () => {
        const save = createDefaultSaveData();
        save.bestScore = 1200;
        save.playerStats = { ...save.playerStats!, sharpFloors: 2,};

        const rows = getMainMenuHubQualityRows(save, null);
        expect(rows.map((row) => row.id)).toEqual(['mode_entry', 'profile_strip', 'return_loop', 'trust_boundary']);
        expect(rows.find((row) => row.id === 'profile_strip')?.value).toMatch(/level/i);
        expect(rows.every((row) => row.localOnly)).toBe(true);
    });
});
