import { describe, expect, it } from 'vitest';
import type { RealmId, TileSuit } from './contracts';
import { flipTile } from './game';
import { castElement } from './element-group-rules';
import { finishElementCast } from './element-cast-feedback';
import { boardHasTurnablePair, isTileFlipBlocked } from './realm-weather-rules';
import { TEST_HALL_ROOMS, playTestHallStep } from './test-hall-rooms';

const names = { ember: 'fire', tide: 'water', bone: 'frost', moss: 'grove' } as const;
const start = (suit: TileSuit, realmId: RealmId = 'storm') => ({
    ...TEST_HALL_ROOMS.find(room => room.id === `element-single-${names[suit]}`)!.build(), realmId
});
const primary = (suit: TileSuit) => ({ ember: 'ignited', tide: 'current', bone: 'frozen', moss: 'entangled' } as const)[suit];

describe('every elemental match has an observable consequence', () => {
    for (const suit of Object.keys(names) as TileSuit[]) {
        it.each(['ember', 'tide', 'frost', 'grove', 'storm'] as const)(`${suit} casts on %s ground with a truthful receipt`, realm => {
            const run = start(suit, realm);
            const next = playTestHallStep(run, { do: 'match', pairKey: 'a' })!;
            expect(next.turnsThisFloor).toBe(1);
            expect(next.elementCastsThisFloor).toBe(1);
            const cast = next.board!.elementCast!;
            expect(cast.suit).toBe(suit);
            expect(cast.contacts.length).toBeGreaterThan(0);
            expect(cast.headline).toBeTruthy();
            const affected = cast.contacts.filter(c => c.outcome === 'affected' && c.effect === primary(suit));
            for (const contact of affected) {
                const tile = next.board!.tiles[contact.cell]!;
                expect(tile.id).toBe(contact.tileId);
                if (suit === 'ember') expect(tile.fuse).toBeGreaterThan(0);
                if (suit === 'bone') expect(tile.frost).toBeGreaterThan(0);
                if (suit === 'moss') expect(tile.vined).toBe(true);
            }
            if (!affected.length) {
                const blocked = cast.contacts.filter(c => c.outcome === 'blocked');
                expect(blocked.length).toBeGreaterThan(0);
                expect(blocked.every(c => c.reason && c.attempt)).toBe(true);
                expect(cast.detail).toContain('blocked');
            }
            expect(boardHasTurnablePair(next.board!.tiles)).toBe(true);
            expect(next.board!.elementalGround!.filter(Boolean).length).toBeGreaterThan(0);
        });
        it(`${suit} casts again on the very next same-element match`, () => {
            const run = start(suit);
            run.board = { ...run.board!, tiles: run.board!.tiles.map(t => t.pairKey === 'h' ? { ...t, suit } : t) };
            const first = playTestHallStep(run, { do: 'match', pairKey: 'a' })!;
            const second = playTestHallStep(first, { do: 'match', pairKey: 'h' })!;
            expect(second.turnsThisFloor).toBe(2);
            expect(second.elementCastsThisFloor).toBe(2);
            expect(second.board!.elementCast!.key).not.toBe(first.board!.elementCast!.key);
            expect(second.board!.elementCast!.contacts.some(c => c.outcome === 'affected' && c.effect === primary(suit))).toBe(true);
        });
    }
    it.each(['bone', 'moss'] as const)('%s really blocks flipping and releases when the free pair is matched', suit => {
        const first = playTestHallStep(start(suit), { do: 'match', pairKey: 'a' })!;
        const held = first.board!.tiles.filter(isTileFlipBlocked);
        expect(held).toHaveLength(12);
        for (const tile of held) expect(flipTile(first, tile.id)).toBe(first);
        const free = first.board!.tiles.filter(t => t.state === 'hidden' && !isTileFlipBlocked(t));
        expect(free).toHaveLength(2);
        const next = playTestHallStep(first, { do: 'match', pairKey: free[0]!.pairKey })!;
        expect(next.turnsThisFloor).toBe(2);
        expect(boardHasTurnablePair(next.board!.tiles)).toBe(true);
        expect(next.board!.tiles.filter(isTileFlipBlocked).length).toBeLessThan(held.length);
    });
    it.each(['bone', 'moss'] as const)('%s reports failed holds on a board too small for a safe cohort', suit => {
        const tiles = start(suit).board!.tiles.slice(0, 6).map(t => t.pairKey === 'a' ? { ...t, state: 'matched' as const } : t);
        const cast = castElement({ tiles, columns: 4, groupTileIds: ['a-1', 'a-2'], realmId: 'storm', pinned: new Set() })!;
        expect(tiles.some(isTileFlipBlocked)).toBe(false);
        expect(tiles.some(t => t.seeded || t.rime)).toBe(false);
        expect(cast.contacts.filter(c => c.outcome === 'blocked')).toHaveLength(2);
        expect(cast.contacts.every(c => c.reason?.includes('free pair'))).toBe(true);
    });
    it('calm pauses weather but never suppresses a Fire cast', () => {
        const run = { ...start('ember'), realmStillTurns: 3 };
        const next = playTestHallStep(run, { do: 'match', pairKey: 'a' })!;
        expect(next.board!.tiles.filter(t => t.fuse === 3)).toHaveLength(14);
        expect(next.board!.elementCast!.headline).toBe('Fire: 14 burning');
        expect(next.realmWeatherThisFloor ?? 0).toBe(0);
    });
    it('Frost focus banks calm on every Frost cast without requiring a rime harvest', () => {
        const run = { ...start('bone'), elementalFocus: { bone: 2 } };
        const next = playTestHallStep(run, { do: 'match', pairKey: 'a' })!;
        expect(next.realmStillTurns).toBe(2);
        expect(next.board!.elementCast!.detail).toContain('2 calm turns banked by Frost focus');
        expect(next.board!.tiles.some(t => t.frost)).toBe(true);
    });
    it('a final receipt cannot claim a hold that a reaction removed', () => {
        const run = playTestHallStep(start('moss'), { do: 'match', pairKey: 'a' })!;
        const cast = { ...run.board!.elementCast!, detail: '' };
        const released = run.board!.tiles.map(({ vined: _v, bloom: _b, ...tile }) => tile);
        const final = finishElementCast(cast, released);
        expect(final.headline).toBe('Grove: cast blocked');
        expect(final.contacts.filter(c => c.attempt === 'entangled').every(c => c.outcome === 'blocked' && c.reason)).toBe(true);
    });
    it('a prior Frostbloom charge does not hide a successful freeze in the receipt', () => {
        const room = TEST_HALL_ROOMS.find(r => r.id === 'realm-wildfire')!;
        const first = playTestHallStep(room.build(), { do: 'match', pairKey: 'a' })!;
        const next = playTestHallStep(first, { do: 'match', pairKey: 'h' })!;
        const frozen = next.board!.tiles.filter(t => t.frost).length;
        expect(frozen).toBe(4);
        expect(next.board!.elementCast!.headline).toBe(`Frost: ${frozen} frozen`);
    });
});
