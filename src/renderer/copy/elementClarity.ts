import type { RealmId, TileSuit } from '../../shared/contracts';

/** Short outcomes for decisions; exact rules remain in the optional guide. */
export const ELEMENT_ACTION: Record<TileSuit, string> = {
    ember: 'Burn vines · Melt ice', tide: 'Douse fire · Move cards',
    bone: 'Anchor cards · Bank calm', moss: 'Plant seeds · Harvest gold'
};
export const FOCUS_ACTION: Record<TileSuit, string> = {
    ember: 'Burning card → charge', tide: 'Reveal +1 card',
    bone: 'Rime match → +1 calm turn', moss: '+1 seed → 2-gold bloom'
};
export const ARENA_ACTION: Record<RealmId, string> = {
    ember: 'Hot ground · Water makes steam', tide: 'Wet ground · Fire makes steam',
    frost: 'Ice anchors cards', grove: 'Rooted ground · +1 gold on match',
    storm: 'Every cast reveals a nearby card'
};

export const focusSummary = (suit: TileSuit, rank: number): string => ({
    ember: `Charge ${rank} burning cards`, tide: `Reveal ${rank} cards`,
    bone: `Rime: +${rank} calm`, moss: `Ripen ${rank} seeds`
})[suit];
