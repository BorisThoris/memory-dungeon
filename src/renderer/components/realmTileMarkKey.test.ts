import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { isTileFlipBlocked } from '../../shared/realm-weather-rules';
import { cardStatusMark, cardStatusBlocksTurning, realmTileMarkKey } from './realmTileMarkKey';

const tile = (changes: Partial<Tile> = {}): Tile => ({ id: 'a', pairKey: 'a', symbol: 'A', label: 'A', state: 'hidden', ...changes });

describe('persistent card status', () => {
    it('uses the same lock conditions as gameplay, including combined states', () => {
        for (const frost of [-1, 0, 0.5, 1, 3, NaN, Infinity]) for (const vined of [false, true]) {
            const card = tile({ frost, vined, snowed: true, fuse: 2, rime: true, seeded: 2 });
            expect(cardStatusBlocksTurning(cardStatusMark(card))).toBe(isTileFlipBlocked(card));
        }
    });
    it('never mistakes concealment, danger or protection for a lock', () => {
        for (const state of [{ snowed: true }, { fuse: 2 }, { rime: true }, { seeded: 2 }]) {
            expect(cardStatusMark(tile(state))).not.toBeNull();
            expect(cardStatusBlocksTurning(cardStatusMark(tile(state)))).toBe(false);
        }
    });
    it('clears released and resolved holds, and supports opening locks', () => {
        expect(cardStatusMark(tile())).toBeNull();
        expect(cardStatusBlocksTurning(cardStatusMark(tile(), true))).toBe(true);
        for (const state of ['flipped', 'matched', 'removed'] as const) {
            expect(cardStatusMark(tile({ state, vined: true, frost: 2 }), true)).toBeNull();
        }
    });
    it('invalidates the texture when a hold or its counter changes', () => {
        const keys = [tile({ frost: 1 }), tile({ frost: 2 }), tile({ vined: true }), tile({ vined: true, bloom: true })]
            .map(card => realmTileMarkKey(cardStatusMark(card)!));
        keys.push(realmTileMarkKey(cardStatusMark(tile(), true)!));
        expect(new Set(keys).size).toBe(keys.length);
    });
});
