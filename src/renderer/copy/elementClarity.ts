import { plural, tr } from '../../shared/i18n';
import type { RealmId, TileSuit } from '../../shared/contracts';

/** Short outcomes for decisions; exact rules remain in the optional guide. */
export const ELEMENT_ACTION: Record<TileSuit, string> = {
    ember: tr.s('Burn vines · Melt ice'), tide: tr.s('Douse fire · Move cards'),
    bone: tr.s('Freeze nearby cards'), moss: tr.s('Bind nearby cards')
};
export const ARENA_ACTION: Record<RealmId, string> = {
    ember: tr.s('Hot ground · Water makes steam'), tide: tr.s('Wet ground · Fire makes steam'),
    frost: tr.s('Ice anchors cards'), grove: tr.s('Rooted ground · +1 gold on match'),
    storm: tr.s('Every cast reveals a nearby card')
};

export const focusSummary = (suit: TileSuit, rank: number): string => ({
    ember: tr`Charge ${plural(rank, { one: '{0} burning card', other: '{0} burning cards' })}`, tide: tr`Reveal ${plural(rank, { one: '{0} card', other: '{0} cards' })}`,
    bone: tr`Every Frost cast: ${plural(rank, { one: '{0} calm turn', other: '{0} calm turns' })}`, moss: tr`Ripen ${plural(rank, { one: '{0} seed', other: '{0} seeds' })} into 2-gold blooms`
})[suit];
