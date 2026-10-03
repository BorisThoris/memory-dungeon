import type { ElementCastImpact, Tile } from './contracts';
import { ELEMENT_NAMES } from './element-alchemy-rules';

/** Keep attempted spells visible even when a counter, reaction or safety rule stops the hold. */
export const finishElementCast = (cast: ElementCastImpact, tiles: readonly Tile[]): ElementCastImpact => {
    const contacts = cast.contacts.map(contact => {
        const cell = tiles.findIndex(tile => tile.id === contact.tileId);
        const tile = tiles[cell];
        const effect = contact.effect === 'current' ? 'current' : tile?.vined ? 'entangled' : (tile?.frost ?? 0) > 0 ? 'frozen'
            : tile?.fuse != null ? 'ignited' : tile?.rime ? 'rimed' : tile?.seeded ? 'seeded' : 'cleared';
        const landed = contact.attempt === 'entangled' ? tile?.vined : contact.attempt === 'frozen' ? (tile?.frost ?? 0) > 0 : tile?.fuse != null;
        if (contact.attempt && contact.outcome === 'affected' && !landed) {
            return { ...contact, cell, effect, outcome: 'blocked' as const, reason: 'Released by a reaction or board protection' };
        }
        return { ...contact, cell, effect };
    }) as ElementCastImpact['contacts'];
    const changed = contacts.filter(c => c.outcome === 'affected');
    const primary = { ember: 'ignited', tide: 'current', bone: 'frozen', moss: 'entangled' }[cast.suit];
    const count = changed.filter(c => c.effect === primary).length;
    const blocked = contacts.filter(c => c.outcome === 'blocked');
    const charged = contacts.filter(c => c.outcome === 'charged').length;
    const resisted = contacts.filter(c => c.outcome === 'neutralized').length;
    const verb = { ember: 'burning', tide: 'moved', bone: 'frozen', moss: 'tied down' }[cast.suit];
    const action = count ? `${count} ${verb}` : blocked.length ? 'cast blocked' : changed.length ? `${changed.length} affected` : resisted ? `${resisted} resisted` : charged ? `${charged} charged` : 'no targets';
    const headline = `${ELEMENT_NAMES[cast.suit]}: ${action}`;
    const consequence = count ? {
        ember: 'Match burning cards for +2 gold; expired fuses cost 1 gold each',
        tide: 'The current changes card positions',
        bone: 'Frozen cards cannot turn until they thaw or a nearby match breaks the ice',
        moss: 'Vines prevent turning; match nearby or burn them to release the cards'
    }[cast.suit] : '';
    const detail = [headline, consequence,
        blocked.length ? `${blocked.length} attempts blocked: ${[...new Set(blocked.map(c => c.reason ?? 'Protected'))].join('; ')}` : '',
        resisted ? `${resisted} counter-cards resisted` : '', charged ? `${charged} cards charged` : '', cast.detail
    ].filter(Boolean).join(' · ');
    return { ...cast, headline, contacts, detail };
};
