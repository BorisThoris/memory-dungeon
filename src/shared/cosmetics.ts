import { tr } from './i18n';
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
        label: tr.s('Seeker'),
        description: tr.s('Default local title for every profile.'),
        unlockSource: tr.s('Default'),
        fallback: tr.s('Plain title text'),
        gameplayAffecting: false,
        defaultOwned: true
    },
    crest_lantern: {
        id: 'crest_lantern',
        slot: 'crest',
        label: tr.s('Lantern Crest'),
        description: tr.s('Default archive crest.'),
        unlockSource: tr.s('Default'),
        fallback: tr.s('Menu seal'),
        gameplayAffecting: false,
        defaultOwned: true
    },
    card_back_classic: {
        id: 'card_back_classic',
        slot: 'card_back',
        label: tr.s('Classic Card Back'),
        description: tr.s('Default readable card back used by the board renderer.'),
        unlockSource: tr.s('Default'),
        fallback: tr.s('Procedural card texture'),
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
        label: tr.s('Bronze Crest'),
        description: tr.s('Cosmetic crest slot for the first floor whose chain reached Sharp.'),
        unlockSource: tr.s('Honor: Sharp Initiate'),
        fallback: tr.s('Menu seal'),
        gameplayAffecting: false
    },
    title_ascendant_v: {
        id: 'title_ascendant_v',
        slot: 'title',
        label: tr.s('Ascendant V'),
        description: tr.s('Cosmetic title slot for no-powers mastery.'),
        unlockSource: tr.s('Honor: Ascendant V'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_twelve_held: {
        id: 'title_twelve_held',
        slot: 'title',
        label: tr.s('Twelve Held'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Twelve Held'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_warden_feller: {
        id: 'title_warden_feller',
        slot: 'title',
        label: tr.s('Warden-Feller'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Warden-Feller'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_alchemist: {
        id: 'title_alchemist',
        slot: 'title',
        label: tr.s('Alchemist'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Alchemist'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_mason: {
        id: 'title_mason',
        slot: 'title',
        label: tr.s('Mason'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Mason'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_encore: {
        id: 'title_encore',
        slot: 'title',
        label: tr.s('Encore'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Encore'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_ring_walker: {
        id: 'title_ring_walker',
        slot: 'title',
        label: tr.s('Ring-Walker'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Ring-Walker'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_night_watch: {
        id: 'title_night_watch',
        slot: 'title',
        label: tr.s('Night Watch'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Night Watch'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_hallbreaker: {
        id: 'title_hallbreaker',
        slot: 'title',
        label: tr.s('Hallbreaker'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Hallbreaker'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_map_burner: {
        id: 'title_map_burner',
        slot: 'title',
        label: tr.s('Map-Burner'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Map-Burner'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_unmasker: {
        id: 'title_unmasker',
        slot: 'title',
        label: tr.s('Unmasker'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Unmasker'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_doorwarden: {
        id: 'title_doorwarden',
        slot: 'title',
        label: tr.s('Doorwarden'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Doorwarden'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_chartwright: {
        id: 'title_chartwright',
        slot: 'title',
        label: tr.s('Chartwright'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Chartwright'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_deep_doorwarden: {
        id: 'title_deep_doorwarden',
        slot: 'title',
        label: tr.s('Deep Doorwarden'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Deep Doorwarden'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_deep_chartwright: {
        id: 'title_deep_chartwright',
        slot: 'title',
        label: tr.s('Deep Chartwright'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Deep Chartwright'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_abyssal: {
        id: 'title_abyssal',
        slot: 'title',
        label: tr.s('Abyssal'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Abyssal'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_lockkeeper: {
        id: 'title_lockkeeper',
        slot: 'title',
        label: tr.s('Lockkeeper'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Lockkeeper'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_second_board: {
        id: 'title_second_board',
        slot: 'title',
        label: tr.s('Second Board'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Second Board'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_known: {
        id: 'title_known',
        slot: 'title',
        label: tr.s('Known'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Known'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_early_riser: {
        id: 'title_early_riser',
        slot: 'title',
        label: tr.s('Early Riser'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Early Riser'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_spiral_breaker: {
        id: 'title_spiral_breaker',
        slot: 'title',
        label: tr.s('Spiral-Breaker'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Spiral-Breaker'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_hollow_stone: {
        id: 'title_hollow_stone',
        slot: 'title',
        label: tr.s('Hollow Stone'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Hollow Stone'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_vault_keeper: {
        id: 'title_vault_keeper',
        slot: 'title',
        label: tr.s('Vault-Keeper'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Vault-Keeper'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_draughtsman: {
        id: 'title_draughtsman',
        slot: 'title',
        label: tr.s('Draughtsman'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Draughtsman'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_second_take: {
        id: 'title_second_take',
        slot: 'title',
        label: tr.s('Second Take'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Second Take'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_tracker: {
        id: 'title_tracker',
        slot: 'title',
        label: tr.s('Tracker'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Tracker'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_giantsbane: {
        id: 'title_giantsbane',
        slot: 'title',
        label: tr.s('Giantsbane'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Giantsbane'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_sandcatcher: {
        id: 'title_sandcatcher',
        slot: 'title',
        label: tr.s('Sandcatcher'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Sandcatcher'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_weathered: {
        id: 'title_weathered',
        slot: 'title',
        label: tr.s('Weathered'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Weathered'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_confluent: {
        id: 'title_confluent',
        slot: 'title',
        label: tr.s('Confluent'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Confluent'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
    title_past_the_gate: {
        id: 'title_past_the_gate',
        slot: 'title',
        label: tr.s('Past the Gate'),
        description: tr.s('A title for a feat of the deep game.'),
        unlockSource: tr.s('Feat: Past the Gate'),
        fallback: tr.s('Seeker title'),
        gameplayAffecting: false
    },
};

export const CARD_THEME_CATALOG = {
    card_back_classic: {
        id: 'card_back_classic',
        label: tr.s('Classic Card Back'),
        asset: { back: '/src/renderer/assets/textures/cards/authored-card-back.svg' },
        fallbackAsset: '/src/renderer/assets/textures/cards/authored-card-back.svg'
    }
} as const;

const buildClassicCardThemeRow = (): CardThemeRow => ({
    id: 'classic_card_back',
    cosmeticId: null,
    label: tr.s('Shared Card Back'),
    status: 'owned',
    equipped: true,
    asset: CARD_THEME_CATALOG.card_back_classic.asset,
    previewAsset: CARD_THEME_CATALOG.card_back_classic.asset.back,
    fallbackAsset: CARD_THEME_CATALOG.card_back_classic.fallbackAsset,
    unlockSource: tr.s('Default'),
    readability: tr.s('All hidden cards use this same shared back; hidden-card theme variants are not available.')
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
