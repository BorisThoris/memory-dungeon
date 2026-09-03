import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import {
    COSMETIC_CATALOG,
    cosmeticUnlockTag,
    deriveCosmeticStates,
    getCosmeticCatalogRows,
    getEquippedCosmeticId,
    type CosmeticId
} from './cosmetics';
import { getProfileSummaryRows } from './profile-summary';

/**
 * A cosmetic is a reward, and a reward nobody can see is not one. These tests walk the whole path a
 * cosmetic takes — granted by an honor, equipped by the slot rule, then named on the Profile —
 * because it was broken in two places at once and each layer passed its own tests regardless.
 */
const withCosmetic = (id: CosmeticId) => {
    const save = createDefaultSaveData();
    save.unlocks = [cosmeticUnlockTag(id)];
    return save;
};

const EARNED_COSMETICS = getCosmeticCatalogRows()
    .filter((def) => def.defaultOwned !== true)
    .map((def) => def.id);

describe('a cosmetic a player earns', () => {
    it('has something to earn in the first place', () => {
        expect(EARNED_COSMETICS.length).toBeGreaterThan(0);
    });

    it('takes its slot from the default rather than losing to it', () => {
        for (const id of EARNED_COSMETICS) {
            const save = withCosmetic(id);
            // The old rule equipped the first owned in catalog order. Every default is owned from
            // the start and listed first, so nothing earned could ever displace one.
            expect(getEquippedCosmeticId(save, COSMETIC_CATALOG[id].slot)).toBe(id);
        }
    });

    it('is named somewhere the player can read it', () => {
        for (const id of EARNED_COSMETICS) {
            const rows = getProfileSummaryRows(withCosmetic(id));
            const named = rows.some(
                (row) => row.value.includes(COSMETIC_CATALOG[id].label) || row.source.includes(COSMETIC_CATALOG[id].label)
            );

            expect(named, `${id} is granted but never named on the Profile`).toBe(true);
        }
    });

    it('does not claim its unlock is still to come', () => {
        for (const id of EARNED_COSMETICS) {
            // The honor bridge that grants these has been live; the copy said "Future" long after.
            expect(COSMETIC_CATALOG[id].unlockSource.toLowerCase()).not.toContain('future');
        }
    });
});

describe('a slot with nothing earned in it', () => {
    it('still shows the default rather than nothing', () => {
        const save = createDefaultSaveData();
        const equipped = deriveCosmeticStates(save).filter((row) => row.equipped);

        expect(equipped.length).toBeGreaterThan(0);
        expect(equipped.every((row) => row.defaultOwned === true)).toBe(true);
        expect(getProfileSummaryRows(save).find((row) => row.id === 'cosmetics')?.value).toBe('Seeker');
    });

    it('never equips something the save does not own', () => {
        const save = withCosmetic(EARNED_COSMETICS[0]!);
        for (const row of deriveCosmeticStates(save)) {
            expect(row.equipped && row.status === 'locked').toBe(false);
        }
    });
});
