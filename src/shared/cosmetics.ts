import type { SaveData } from './contracts';
import { COSMETIC_IDS, type CosmeticId } from './cosmetic-ids';

export { COSMETIC_IDS, type CosmeticId } from './cosmetic-ids';

export type CosmeticSlot = 'title' | 'crest' | 'card_back';
export type CardThemeId = 'classic_card_back';
export type CosmeticStatus = 'owned' | 'locked';
export interface CosmeticDefinition {
    id: CosmeticId;
    slot: CosmeticSlot;
    title?: string;
    label: string;
    description: string;
    unlockHint?: string;
    unlockSource: string;
    fallback: string;
    gameplayAffecting: false;
    defaultOwned?: boolean;
}

export interface CosmeticStateRow extends CosmeticDefinition {
    status: CosmeticStatus;
    equipped: boolean;
}

export interface CardThemeRow {
    id: CardThemeId;
    cosmeticId: CosmeticId | null;
    label: string;
    status: CosmeticStatus;
    equipped: boolean;
    previewAsset: string;
    fallbackAsset: string;
    asset: { back: string };
    unlockSource: string;
    readability: string;
}

export const COSMETIC_UNLOCK_PREFIX = 'cosmetic:' as const;

export const COSMETIC_CATALOG: Record<CosmeticId, CosmeticDefinition> = {
    title_seeker: {
        id: 'title_seeker',
        slot: 'title',
        label: 'Seeker',
        description: 'Default local title for every profile.',
        unlockSource: 'Default',
        fallback: 'Plain title text',
        gameplayAffecting: false,
        defaultOwned: true
    },
    crest_lantern: {
        id: 'crest_lantern',
        slot: 'crest',
        label: 'Lantern Crest',
        description: 'Default archive crest.',
        unlockSource: 'Default',
        fallback: 'Menu seal',
        gameplayAffecting: false,
        defaultOwned: true
    },
    card_back_classic: {
        id: 'card_back_classic',
        slot: 'card_back',
        label: 'Classic Card Back',
        description: 'Default readable card back used by the board renderer.',
        unlockSource: 'Default',
        fallback: 'Procedural card texture',
        gameplayAffecting: false,
        defaultOwned: true
    },
    crest_daily_bronze: {
        id: 'crest_daily_bronze',
        slot: 'crest',
        label: 'Daily Bronze Crest',
        description: 'Cosmetic crest slot for daily participation.',
        unlockSource: 'Honor: Daily Initiate',
        fallback: 'Menu seal',
        gameplayAffecting: false
    },
    title_ascendant_v: {
        id: 'title_ascendant_v',
        slot: 'title',
        label: 'Ascendant V',
        description: 'Cosmetic title slot for no-powers mastery.',
        unlockSource: 'Honor: Ascendant V',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
};

export const CARD_THEME_CATALOG = {
    card_back_classic: {
        id: 'card_back_classic',
        label: 'Classic Card Back',
        asset: { back: '/src/renderer/assets/textures/cards/authored-card-back.svg' },
        fallbackAsset: '/src/renderer/assets/textures/cards/authored-card-back.svg'
    }
} as const;

const buildClassicCardThemeRow = (): CardThemeRow => ({
    id: 'classic_card_back',
    cosmeticId: null,
    label: 'Shared Card Back',
    status: 'owned',
    equipped: true,
    asset: CARD_THEME_CATALOG.card_back_classic.asset,
    previewAsset: CARD_THEME_CATALOG.card_back_classic.asset.back,
    fallbackAsset: CARD_THEME_CATALOG.card_back_classic.fallbackAsset,
    unlockSource: 'Default',
    readability: 'All hidden cards use this same shared back; hidden-card theme variants are not available.'
});

export const getCosmeticCatalogRows = (): CosmeticDefinition[] =>
    COSMETIC_IDS.map((id) => COSMETIC_CATALOG[id]);

const ownedCosmeticTags = (save: SaveData): Set<string> => new Set(save.unlocks ?? []);

export const cosmeticUnlockTag = (id: string): string => `${COSMETIC_UNLOCK_PREFIX}${id}`;

export const unlockedCosmeticIds = (save: SaveData): CosmeticId[] =>
    getCosmeticCatalogRows()
        .map((row) => row.id)
        .filter((id) => ownedCosmeticTags(save).has(cosmeticUnlockTag(id)) && !COSMETIC_CATALOG[id].defaultOwned);

export const cosmeticIsOwned = (save: SaveData, id: string): boolean => {
    const def = getCosmeticCatalogRows().find((entry) => entry.id === id);
    if (!def) {
        return false;
    }
    return def.defaultOwned === true || ownedCosmeticTags(save).has(cosmeticUnlockTag(id));
};

/**
 * What each slot shows, given what the save owns.
 *
 * An earned cosmetic wins over the slot's default. This used to be "first owned in catalog order",
 * and since every slot's default is owned from the start and listed first, the default always won —
 * so earning the Daily Bronze Crest or the Ascendant V title changed nothing a player could see,
 * anywhere. A reward nobody can see is not a reward.
 *
 * There is no equip screen yet, so the rule has to pick for the player. Later-listed earned
 * cosmetics win over earlier ones, which puts the newest thing they worked for in front of them.
 */
export const deriveCosmeticStates = (save: SaveData): CosmeticStateRow[] => {
    const equippedBySlot = new Map<CosmeticSlot, string>();
    for (const def of getCosmeticCatalogRows()) {
        if (!cosmeticIsOwned(save, def.id)) {
            continue;
        }
        const current = equippedBySlot.get(def.slot);
        const currentIsDefault = current !== undefined && COSMETIC_CATALOG[current as CosmeticId].defaultOwned === true;
        if (current === undefined || currentIsDefault || def.defaultOwned !== true) {
            equippedBySlot.set(def.slot, def.id);
        }
    }

    return getCosmeticCatalogRows().map((def) => {
        const owned = cosmeticIsOwned(save, def.id);
        return {
            ...def,
            status: owned ? 'owned' : 'locked',
            equipped: owned && equippedBySlot.get(def.slot) === def.id
        };
    });
};

export const getCosmeticRows = deriveCosmeticStates;

export const getCosmeticCollectionRows = deriveCosmeticStates;

export const getOwnedCosmeticIds = (save: SaveData): CosmeticId[] =>
    deriveCosmeticStates(save)
        .filter((row) => row.status === 'owned')
        .map((row) => row.id);

export const getEquippedCosmeticId = (save: SaveData, slot: CosmeticSlot): CosmeticId | null =>
    deriveCosmeticStates(save).find((row) => row.slot === slot && row.equipped)?.id ?? null;

export const getCardThemeRows = (save: SaveData): CardThemeRow[] => {
    void save;
    return [buildClassicCardThemeRow()];
};

export const getEquippedCardTheme = (save: SaveData): CardThemeRow =>
    getCardThemeRows(save).find((row) => row.equipped) ?? buildClassicCardThemeRow();

export const resolveEquippedCardTheme = getEquippedCardTheme;

/** Re-exported from meta-progression (implementation there avoids a circular import). */
export { getCosmeticTrackDefinitionRows as getCosmeticProgressTrackRows, getCosmeticTrackProgressSummary as getCosmeticTrackRows } from './meta-progression';
