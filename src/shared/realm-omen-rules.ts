import { tr } from './i18n';
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
    frost: { frost: tr.s('Deep Freeze'), ember: tr.s('Thaw'), tide: tr.s('Meltwater'), storm: tr.s('Hailstorm'), grove: tr.s('First Spring') },
    ember: { frost: tr.s('Quench'), ember: tr.s('Flare'), tide: tr.s('Steam'), storm: tr.s('Firestorm'), grove: tr.s('Ashbloom') },
    tide: { frost: tr.s('Freeze-over'), ember: tr.s('Boil'), tide: tr.s('Surge'), storm: tr.s('Downpour'), grove: tr.s('Mire') },
    storm: { frost: tr.s('Whiteout'), ember: tr.s('Kindled Sky'), tide: tr.s('Deluge'), storm: tr.s('Squall'), grove: tr.s('Thornstorm') },
    grove: { frost: tr.s('Frostbloom'), ember: tr.s('Wildfire'), tide: tr.s('Flood'), storm: tr.s('Green Lightning'), grove: tr.s('Overrun') }
};

export const realmReactionName = (from: RealmId, to: RealmId): string => REALM_REACTION_NAMES[from][to];
