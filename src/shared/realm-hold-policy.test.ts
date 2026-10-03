import { describe, expect, it } from 'vitest';
import type { Tile } from './contracts';
import { reconcileRealmHolds } from './realm-hold-policy';

const deal = (pairs = 4): Tile[] => Array.from({ length: pairs * 2 }, (_, i) => ({
    id: String(i), pairKey: String(Math.floor(i / 2)), symbol: String(i), label: String(i), state: 'hidden', suit: 'tide'
}));
const held = (t: Tile) => !!t.vined || (t.frost ?? 0) > 0;

describe('holds preserve the memory puzzle', () => {
    it.each(['frost', 'vined'] as const)('a single requested %s card becomes two complete pairs, with a free pair', kind => {
        const before = deal(); const tiles = [...before];
        tiles[0] = { ...tiles[0]!, [kind]: kind === 'frost' ? 2 : true };
        reconcileRealmHolds(tiles, 4, before);
        expect(tiles.filter(held)).toHaveLength(4);
        const keys = new Set(tiles.filter(held).map(t => t.pairKey));
        expect(keys.size).toBe(2);
        for (const key of keys) expect(tiles.filter(t => t.pairKey === key).every(held)).toBe(true);
        expect(tiles.filter(t => !held(t)).length).toBeGreaterThanOrEqual(2);
    });
    it('declines a hold on a two-pair board rather than exposing a pair or blocking the floor', () => {
        const before = deal(2), tiles = [...before]; tiles[0] = { ...tiles[0]!, frost: 2 };
        reconcileRealmHolds(tiles, 2, before);
        expect(tiles.some(held)).toBe(false);
    });
    it('does not recruit immune or pinned partners', () => {
        const before = deal(4).map((t, i) => i >= 4 ? { ...t, suit: 'bone' as const } : t);
        const tiles = [...before]; tiles[0] = { ...tiles[0]!, frost: 2 };
        reconcileRealmHolds(tiles, 4, before, new Set(['3']));
        expect(tiles.some(held)).toBe(false);
    });
    it('cutting half of a two-pair cohort frees all of it, without recruiting replacements', () => {
        const tiles = deal().map((t, i) => i < 4 ? { ...t, vined: true } : t);
        delete tiles[0]!.vined;
        const result = reconcileRealmHolds(tiles, 4);
        expect(tiles.some(held)).toBe(false);
        expect(result.added).toEqual([]);
        expect(result.freed).toHaveLength(3);
    });
    it('a bomb cannot leave a singular identifiable locked pair behind', () => {
        const tiles = deal().map((t, i) => i < 4 ? { ...t, frost: 2 } : t);
        tiles[0] = { ...tiles[0]!, state: 'removed' };
        tiles[1] = { ...tiles[1]!, state: 'removed' };
        reconcileRealmHolds(tiles, 4);
        expect(tiles.filter(t => t.state === 'hidden').some(held)).toBe(false);
    });
    it('new requests preserve existing pairs and cannot extend their expiry', () => {
        const before = deal(6).map((t, i) => i < 4 ? { ...t, frost: 2 } : t);
        const tiles = before.map((t, i) => i < 4 ? { ...t, frost: 1 } : i === 6 ? { ...t, frost: 3 } : t);
        reconcileRealmHolds(tiles, 4, before);
        expect(tiles.slice(0, 4).every(t => t.frost === 1)).toBe(true);
        expect(new Set(tiles.filter(held).map(t => t.frost))).toEqual(new Set([1]));
    });
    it.each(['frost', 'vined'] as const)('a rejected new hold preserves an established %s cohort', kind => {
        const other = kind === 'frost' ? 'vined' : 'frost';
        const before = deal(7).map((t, i) => i < 12 ? { ...t, [kind]: kind === 'frost' ? 2 : true } : t);
        const tiles = before.map((t, i) => i >= 12 ? { ...t, [other]: other === 'frost' ? 2 : true } : t);
        reconcileRealmHolds(tiles, 4, before);
        expect(tiles.slice(0, 12).every(t => t[kind])).toBe(true);
        expect(tiles.slice(12).some(held)).toBe(false);
        expect(tiles.some(t => t[other])).toBe(false);
    });
    it('repairing ice cannot steal cards from an established vine cohort', () => {
        const before = deal(6).map((t, i) => i < 4 ? { ...t, frost: 1 } : i < 8 ? { ...t, vined: true } : t);
        const tiles = before.map((t, i) => i < 2 ? { ...t, state: 'matched' as const } : i === 8 ? { ...t, frost: 2 } : t);
        reconcileRealmHolds(tiles, 4, before, new Set(['9', '10']));
        expect(tiles.slice(4, 8).every(t => t.vined && !t.frost)).toBe(true);
        expect(tiles.filter(t => t.state === 'hidden').some(t => t.frost)).toBe(false);
    });
    it('uses one duration for the whole cohort, and keeps no-op tile references', () => {
        const tiles = deal().map((t, i) => i < 4 ? { ...t, frost: i < 2 ? 1 : 2 } : t);
        reconcileRealmHolds(tiles, 4);
        expect(tiles.filter(held).map(t => t.frost)).toEqual([2, 2, 2, 2]);
        const before = [...tiles]; reconcileRealmHolds(tiles, 4);
        expect(tiles.every((t, i) => t === before[i])).toBe(true);
    });
});
