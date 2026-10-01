import type { RealmId } from './contracts';

/**
 * Reactions: what it is called when a floor turns from one realm into another.
 *
 * Omen cards (2026-09-30) were the first way to turn a realm: one pair a floor carried another
 * realm's sigil in its top corner, and matching it set off the reaction. The owner retired them on
 * 2026-10-01: "these cards with the effect on the top right should not be added anymore. All cards
 * are elemental cards now, given their group." Every card is its suit's element
 * (`element-group-rules.ts`, `element-alchemy-rules.ts`), and the sway of the player's matches
 * (`realm-sway-rules.ts`) is what turns the realm now. The names stayed: a tip is still a reaction,
 * frost meeting ember is still a Thaw.
 */

/** What a reaction between two realms is called. */
export const REALM_REACTION_NAMES: Readonly<Record<RealmId, Readonly<Record<RealmId, string>>>> = {
    frost: { frost: 'Deep Freeze', ember: 'Thaw', tide: 'Meltwater', storm: 'Hailstorm', grove: 'First Spring' },
    ember: { frost: 'Quench', ember: 'Flare', tide: 'Steam', storm: 'Firestorm', grove: 'Ashbloom' },
    tide: { frost: 'Freeze-over', ember: 'Boil', tide: 'Surge', storm: 'Downpour', grove: 'Mire' },
    storm: { frost: 'Whiteout', ember: 'Kindled Sky', tide: 'Deluge', storm: 'Squall', grove: 'Thornstorm' },
    grove: { frost: 'Frostbloom', ember: 'Wildfire', tide: 'Flood', storm: 'Green Lightning', grove: 'Overrun' }
};

export const realmReactionName = (from: RealmId, to: RealmId): string => REALM_REACTION_NAMES[from][to];
