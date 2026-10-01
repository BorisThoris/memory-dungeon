import { describe, expect, it } from 'vitest';
import type { Tile } from './contracts';
import { REALM_SWAY_TIP, SUIT_REALM, leadingSway, swayAfterTurn, swaySuitOf, swayTip } from './realm-sway-rules';

const tile = (pairKey: string, suit?: Tile['suit']): Tile => ({ id: `${pairKey}-1`, pairKey, symbol: 'x', label: 'x', state: 'hidden', suit }) as Tile;

describe('the sway', () => {
    it('counts only suits whose realm the floor is not in', () => {
        const sway = swayAfterTurn({}, 'ember', 'match', { ember: 2, tide: 1, moss: 1 });
        expect(sway).toEqual({ tide: 1, moss: 1 });
    });

    it('carries what it had and a miss wipes it', () => {
        const sway = swayAfterTurn({ tide: 3 }, 'frost', 'match', { tide: 1 });
        expect(sway).toEqual({ tide: 4 });
        expect(swayAfterTurn(sway, 'frost', 'miss', { tide: 3 })).toEqual({});
    });

    it('tips at the threshold into the suit’s realm, once a floor, never into the storm', () => {
        expect(swayTip({ tide: REALM_SWAY_TIP - 1 }, 'frost', 0)).toBeNull();
        expect(swayTip({ tide: REALM_SWAY_TIP }, 'frost', 0)).toBe('tide');
        expect(swayTip({ moss: REALM_SWAY_TIP + 2 }, 'storm', 0)).toBe('grove');
        expect(swayTip({ tide: REALM_SWAY_TIP }, 'frost', 1)).toBeNull();
        expect(swayTip({ tide: REALM_SWAY_TIP }, null, 0)).toBeNull();
        expect(Object.values(SUIT_REALM)).not.toContain('storm');
    });

    it('leads with the suit leaning hardest, ignoring the floor’s own', () => {
        expect(leadingSway({ ember: 4, tide: 2 }, 'ember')).toEqual({ suit: 'tide', realm: 'tide', pairs: 2 });
        expect(leadingSway({ bone: 3, moss: 3 }, 'tide')).toEqual({ suit: 'moss', realm: 'grove', pairs: 3 });
        expect(leadingSway({}, 'tide')).toBeNull();
    });

    it('gives the joker, a singleton and a suitless card no suit', () => {
        expect(swaySuitOf(tile('a', 'tide'))).toBe('tide');
        expect(swaySuitOf(tile('a'))).toBeNull();
        expect(swaySuitOf(undefined)).toBeNull();
    });
});
