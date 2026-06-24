import { describe, expect, it } from 'vitest';
import type { RelicId } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import { createNewRun } from '../../shared/game-core';
import {
    createInventoryQuantityMap,
    createInventoryScreenModel,
    getActiveTraitBuildRows,
    modeTitle
} from './inventoryScreenModel';

describe('inventoryScreenModel', () => {
    it('resolves known game mode titles and falls back to the raw id', () => {
        expect(modeTitle('endless')).toBe('Classic Run');
        expect(modeTitle('custom_lab')).toBe('custom_lab');
    });

    it('normalizes charge and token quantities through the run inventory model', () => {
        const run = {
            ...createNewRun(0),
            shuffleCharges: -2,
            destroyPairCharges: -1,
            peekCharges: -4,
            stats: { ...createNewRun(0).stats, guardTokens: -2, comboShards: -5 }
        };

        const quantityById = createInventoryQuantityMap(run);

        expect(quantityById.get('shuffle_charge')).toBe(0);
        expect(quantityById.get('destroy_charge')).toBe(0);
        expect(quantityById.get('peek_charge')).toBe(0);
        expect(quantityById.get('guard_token')).toBe(0);
        expect(quantityById.get('combo_shard')).toBe(0);
    });

    it('dedupes trait build rows from loadout and drafted relics', () => {
        const run = {
            ...createNewRun(0, { startingLoadoutId: 'route_tactician' }),
            relicIds: ['chapter_compass', 'region_shuffle_free_first'] as RelicId[]
        };

        const ids = getActiveTraitBuildRows(run).map((row) => row.id);

        expect(ids).toContain('drift_routing');
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('creates the inventory screen model without reaching into renderer store state', () => {
        const run = {
            ...createNewRun(0),
            relicIds: ['peek_charge_plus_one', 'pin_cap_plus_one', 'stray_charge_plus_one'] as RelicId[]
        };
        const model = createInventoryScreenModel(run, createDefaultSaveData());

        expect(model.buildProfile.summary).toContain('The Seer');
        expect(model.inventoryRows.length).toBeGreaterThan(0);
        expect(model.equippedCosmetic?.id).toBe('title_seeker');
    });
});
