import type { RealmId, TileSuit } from '../../shared/contracts';

/** Short outcomes for decisions; exact rules remain in the optional guide. */
export const ELEMENT_ACTION: Record<TileSuit, string> = {
    ember: 'Burn vines and seeds · Melt ice · Ignite blocks', tide: 'Douse fire · Move cards',
    bone: 'Freeze cards · Match nearby to thaw', moss: 'Tie cards down · Match nearby to cut vines'
};
export const ARENA_ACTION: Record<RealmId, string> = {
    ember: 'Hot ground · Water makes steam', tide: 'Wet ground · Fire makes steam',
    frost: 'Ice anchors cards', grove: 'Rooted ground · +1 gold on match',
    storm: 'Every cast reveals a nearby card'
};

export const focusSummary = (suit: TileSuit, rank: number): string => ({
    ember: `Charge ${rank} burning ${rank === 1 ? 'card' : 'cards'}`, tide: `Reveal ${rank} ${rank === 1 ? 'card' : 'cards'}`,
    bone: `Every Frost cast: ${rank} calm ${rank === 1 ? 'turn' : 'turns'}`, moss: `Ripen ${rank} ${rank === 1 ? 'seed' : 'seeds'} into 2-gold blooms`
})[suit];
