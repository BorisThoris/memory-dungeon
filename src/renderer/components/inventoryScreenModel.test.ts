import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import { createInventoryQuantityMap, modeTitle } from './inventoryScreenModel';

describe('inventoryScreenModel', () => {
    /*
     * Gen 214: this suite used to cover `createInventoryScreenModel` and the two signal helpers
     * behind it - five of its seven cases. They were the module's only consumers, which is what
     * kept eleven unrendered projections alive and green. What is left is what the Inventory screen
     * actually calls.
     */
    it('resolves known game mode titles and falls back to the raw id', () => {
        expect(modeTitle('endless')).toBe('Classic Run');
        expect(modeTitle('custom_lab')).toBe('custom_lab');
    });

    it('maps every inventory item the screen prints a count for', () => {
        const quantities = createInventoryQuantityMap(createNewRun(0));

        expect(quantities.get('peek_charge')).toBeGreaterThanOrEqual(0);
        expect(quantities.get('shuffle_charge')).toBeGreaterThanOrEqual(0);
        expect(quantities.get('region_shuffle_charge')).toBeGreaterThanOrEqual(0);
    });
});
