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
    /*
     * The id predates the one-mode collapse and is kept verbatim so a save that already owns this
     * crest still owns it. What earns it moved: the daily is gone, a Sharp floor is not.
     */
    crest_daily_bronze: {
        id: 'crest_daily_bronze',
        slot: 'crest',
        label: 'Bronze Crest',
        description: 'Cosmetic crest slot for the first floor whose chain reached Sharp.',
        unlockSource: 'Honor: Sharp Initiate',
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
    title_twelve_held: {
        id: 'title_twelve_held',
        slot: 'title',
        label: 'Twelve Held',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Twelve Held',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_warden_feller: {
        id: 'title_warden_feller',
        slot: 'title',
        label: 'Warden-Feller',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Warden-Feller',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_alchemist: {
        id: 'title_alchemist',
        slot: 'title',
        label: 'Alchemist',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Alchemist',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_mason: {
        id: 'title_mason',
        slot: 'title',
        label: 'Mason',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Mason',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_encore: {
        id: 'title_encore',
        slot: 'title',
        label: 'Encore',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Encore',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_ring_walker: {
        id: 'title_ring_walker',
        slot: 'title',
        label: 'Ring-Walker',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Ring-Walker',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_night_watch: {
        id: 'title_night_watch',
        slot: 'title',
        label: 'Night Watch',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Night Watch',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_hallbreaker: {
        id: 'title_hallbreaker',
        slot: 'title',
        label: 'Hallbreaker',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Hallbreaker',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_map_burner: {
        id: 'title_map_burner',
        slot: 'title',
        label: 'Map-Burner',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Map-Burner',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_unmasker: {
        id: 'title_unmasker',
        slot: 'title',
        label: 'Unmasker',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Unmasker',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_doorwarden: {
        id: 'title_doorwarden',
        slot: 'title',
        label: 'Doorwarden',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Doorwarden',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_chartwright: {
        id: 'title_chartwright',
        slot: 'title',
        label: 'Chartwright',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Chartwright',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_deep_doorwarden: {
        id: 'title_deep_doorwarden',
        slot: 'title',
        label: 'Deep Doorwarden',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Deep Doorwarden',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_deep_chartwright: {
        id: 'title_deep_chartwright',
        slot: 'title',
        label: 'Deep Chartwright',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Deep Chartwright',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_abyssal: {
        id: 'title_abyssal',
        slot: 'title',
        label: 'Abyssal',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Abyssal',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_lockkeeper: {
        id: 'title_lockkeeper',
        slot: 'title',
        label: 'Lockkeeper',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Lockkeeper',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_second_board: {
        id: 'title_second_board',
        slot: 'title',
        label: 'Second Board',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Second Board',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_known: {
        id: 'title_known',
        slot: 'title',
        label: 'Known',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Known',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_early_riser: {
        id: 'title_early_riser',
        slot: 'title',
        label: 'Early Riser',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Early Riser',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_spiral_breaker: {
        id: 'title_spiral_breaker',
        slot: 'title',
        label: 'Spiral-Breaker',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Spiral-Breaker',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_hollow_stone: {
        id: 'title_hollow_stone',
        slot: 'title',
        label: 'Hollow Stone',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Hollow Stone',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_vault_keeper: {
        id: 'title_vault_keeper',
        slot: 'title',
        label: 'Vault-Keeper',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Vault-Keeper',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_draughtsman: {
        id: 'title_draughtsman',
        slot: 'title',
        label: 'Draughtsman',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Draughtsman',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_second_take: {
        id: 'title_second_take',
        slot: 'title',
        label: 'Second Take',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Second Take',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_tracker: {
        id: 'title_tracker',
        slot: 'title',
        label: 'Tracker',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Tracker',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_giantsbane: {
        id: 'title_giantsbane',
        slot: 'title',
        label: 'Giantsbane',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Giantsbane',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_sandcatcher: {
        id: 'title_sandcatcher',
        slot: 'title',
        label: 'Sandcatcher',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Sandcatcher',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_weathered: {
        id: 'title_weathered',
        slot: 'title',
        label: 'Weathered',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Weathered',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_confluent: {
        id: 'title_confluent',
        slot: 'title',
        label: 'Confluent',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Confluent',
        fallback: 'Seeker title',
        gameplayAffecting: false
    },
    title_past_the_gate: {
        id: 'title_past_the_gate',
        slot: 'title',
        label: 'Past the Gate',
        description: 'A title for a feat of the deep game.',
        unlockSource: 'Feat: Past the Gate',
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

/*
 * Gen 215: `getCosmeticRows` was a second name for `deriveCosmeticStates`, the same alias
 * `getCosmeticCollectionRows` already is, and the Collection screen calls that one. Two names for
 * one function is how a caller ends up reading whichever it happened to find.
 */
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

// Gen 215: `resolveEquippedCardTheme` was a third name for `getEquippedCardTheme`; nothing used it.
/** Re-exported from meta-progression (implementation there avoids a circular import). */
export { getCosmeticTrackDefinitionRows as getCosmeticProgressTrackRows, getCosmeticTrackProgressSummary as getCosmeticTrackRows } from './meta-progression';
