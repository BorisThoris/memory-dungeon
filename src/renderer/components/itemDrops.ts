import type { FindableKind } from '../../shared/contracts';
import type { StoreItemId } from '../../shared/run-store-rules';
import type { ScreenCallout } from './screenCallouts';

/**
 * Item drops (2026-10-08): what the player just got, shown the way an RPG shows loot.
 *
 * The owner asked for "an RPG-style popup when you get an item drop". Pickups claimed off the
 * board, an Hourglass's prize and everything bought at a stop used to be one small stamp each,
 * gone in under a second. Now each is a drop: the item's glyph in a gem, its name, what it does,
 * and its rarity in the colour grammar players already read from loot and gacha games (the
 * research: low rarity cool and quiet, mid rarity warming through purple, the top one gold), with
 * a beam of that colour behind it. It holds long enough to read, and a tap, a click or a key skips
 * it (`ItemDropPopup.tsx`).
 */
export type ItemDropId = FindableKind | StoreItemId | 'hourglass_prize';
export type ItemDropRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemDropGlyph = 'star' | 'comet' | 'heart' | 'eye' | 'shuffle' | 'bomb' | 'gem' | 'flask' | 'focus' | 'hourglass';

export const ITEM_DROP_RARITY_COLOR: Readonly<Record<ItemDropRarity, string>> = {
    common: '#c3cfdb',
    uncommon: '#5fd38a',
    rare: '#4aa8ff',
    epic: '#b26bff',
    legendary: '#ffc34d'
};

export const ITEM_DROP_RARITY_LABEL: Readonly<Record<ItemDropRarity, string>> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary'
};

/** How long a drop holds before it goes by itself; rarer ones longer. */
export const ITEM_DROP_HOLD_MS: Readonly<Record<ItemDropRarity, number>> = {
    common: 1900,
    uncommon: 2200,
    rare: 2600,
    epic: 3000,
    legendary: 3400
};

const RELICS: ReadonlySet<string> = new Set(['deep_pockets', 'gilded_chain', 'long_look', 'tallow_candle']);

export const itemDropRarity = (id: ItemDropId): ItemDropRarity => {
    if (RELICS.has(id)) return 'epic';
    if (id === 'meteor_shard' || id.startsWith('focus_')) return 'rare';
    if (id.startsWith('prime_') || id === 'bomb' || id === 'hourglass_prize') return 'uncommon';
    return 'common';
};

export const itemDropGlyph = (id: ItemDropId): ItemDropGlyph => {
    if (RELICS.has(id)) return 'gem';
    if (id.startsWith('focus_')) return 'focus';
    if (id.startsWith('prime_')) return 'flask';
    switch (id) {
        case 'meteor_shard':
            return 'comet';
        case 'miss':
            return 'heart';
        case 'peek':
            return 'eye';
        case 'shuffle':
            return 'shuffle';
        case 'bomb':
            return 'bomb';
        case 'hourglass_prize':
            return 'hourglass';
        default:
            return 'star';
    }
};

export interface ItemDrop {
    key: string;
    id: ItemDropId;
    rarity: ItemDropRarity;
    glyph: ItemDropGlyph;
    /** The item's name, as the stamp named it. */
    name: string;
    /** What it gives, in a line. */
    line: string;
}

/** The drop a stamp carries, if it carries one (`ScreenCallout.drop`). */
export const itemDropFromCallout = (callout: ScreenCallout): ItemDrop | null => {
    if (!callout.drop) return null;
    const rarity = itemDropRarity(callout.drop);
    const title = callout.title.replace(/!+$/u, '');
    return {
        key: callout.key,
        id: callout.drop,
        rarity,
        glyph: itemDropGlyph(callout.drop),
        name: title.charAt(0) + title.slice(1).toLowerCase(),
        line: callout.sub
    };
};
