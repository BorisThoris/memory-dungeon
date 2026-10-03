import { describe, expect, it } from 'vitest';
import { createNewRun, advanceToNextLevel } from './game-core';
import { finalizeLevel } from './floor-clear-transition';
import { applyForgedCast, essenceOf, floorElementalDrops } from './elemental-loot-rules';
import { buyStoreItem, storeOffer } from './run-store-rules';
import { makeTile, playPair } from './test/game-fixtures';
import { testHallRoom } from './test-hall-rooms';
import { TILE_SUITS } from './tile-suit-rules';
import type { RunState } from './contracts';

const rich = (): RunState => ({ ...createNewRun(0, { runSeed: 17 }), gold: 100,
    elementalEssence: { ember: 8, tide: 8, moss: 8, bone: 8 } });

describe('elemental finds and forging', () => {
    it('rewards the arena, varies the find by seed, and pays one extra find for reactions', () => {
        const variants = new Set<string>();
        for (let seed = 0; seed < 120; seed += 1) {
            const run = { ...rich(), runSeed: seed, realmId: 'grove' as const };
            const drop = floorElementalDrops(run, 3);
            expect(drop).toEqual(floorElementalDrops(run, 3));
            expect(essenceOf(drop, 'moss')).toBeGreaterThanOrEqual(1);
            expect(Object.values(drop).reduce((a, b) => a + b, 0)).toBe(2);
            const reacted = floorElementalDrops({ ...run, elementReactionsThisFloor: 1 }, 3);
            expect(Object.values(reacted).reduce((a, b) => a + b, 0)).toBe(3);
            variants.add(JSON.stringify(drop));
        }
        expect(variants.size).toBe(4);
        expect(floorElementalDrops({ ...rich(), runRulesVersion: 54 }, 3)).toEqual({});
    });

    it('grants finds once, stocks the forge, and carries the pouch and forged build to the next floor', () => {
        const run = rich();
        const board = { ...run.board!, level: 3, matchedPairs: run.board!.pairCount,
            tiles: run.board!.tiles.map(tile => ({ ...tile, state: 'matched' as const })) };
        const cleared = finalizeLevel({ ...run, board }, board);
        expect(cleared.lastLevelResult?.elementalDrops).toBeDefined();
        for (const suit of TILE_SUITS) expect(essenceOf(cleared.elementalEssence, suit)).toBe(8 + essenceOf(cleared.lastLevelResult!.elementalDrops, suit));
        expect(finalizeLevel(cleared, board)).toBe(cleared);
        expect(cleared.storeStock).toHaveLength(8);
        expect(storeOffer(cleared).every(row => row.kind === 'focus' || row.kind === 'prime')).toBe(true);
        const forged = buyStoreItem(cleared, 'focus_tide')!;
        const bottled = buyStoreItem(forged, 'prime_ember')!;
        const next = advanceToNextLevel(bottled);
        expect(next.elementalEssence).toEqual(bottled.elementalEssence);
        expect(next.elementalFocus).toEqual({ tide: 1 });
        expect(next.elementStreak).toEqual({ suit: 'ember', links: 2 });
    });

    it('spends exact gold and essence, escalates forging, and never sells a missing resource', () => {
        const run = rich();
        const forged = buyStoreItem(run, 'focus_tide')!;
        expect(forged.gold).toBe(94);
        expect(forged.elementalEssence?.tide).toBe(6);
        expect(forged.elementalFocus?.tide).toBe(1);
        expect(storeOffer(forged).find(row => row.id === 'focus_tide')?.price).toBe(9);
        expect(buyStoreItem({ ...run, elementalEssence: { tide: 1 } }, 'focus_tide')).toBeNull();
        expect(buyStoreItem({ ...run, gold: 5 }, 'focus_tide')).toBeNull();
        expect(buyStoreItem(run, 'bomb')).toBeNull();
        expect(run.elementalEssence?.tide).toBe(8);
    });

    it('allows one prepared reaction per stop and actually reacts on the next different match', () => {
        const base = testHallRoom('element-steam').build();
        const run = { ...base, gold: 30, elementalEssence: { tide: 2 }, elementStreak: null };
        const bottled = buyStoreItem(run, 'prime_tide')!;
        expect(bottled.elementalEssence?.tide).toBe(1);
        expect(bottled.gold).toBe(27);
        expect(buyStoreItem(bottled, 'prime_tide')).toBeNull();
        expect(buyStoreItem({ ...bottled, elementalEssence: { ember: 1 } }, 'prime_ember')).toBeNull();
        const after = playPair(bottled, 'a-1', 'a-2');
        expect(after.elementReactionsThisFloor).toBe(1);
        expect(after.lastRealmEvent?.kind).toBe('steam');
    });

    it('changes the board, not just a shop stat: fire charges, water reveals, and grove ripens', () => {
        const fire = [makeTile('a', 'a', 'A', { suit: 'moss', fuse: 3, empowered: true }), makeTile('b', 'b', 'B', { fuse: 3 })];
        expect(applyForgedCast(fire, ['a', 'b'], 'ember', 1).charged).toEqual(['a']);
        expect(fire[0]!.fuse).toBeUndefined();
        expect(fire[0]!.empowered).toBe(2);
        expect(fire[1]!.fuse).toBe(3);
        expect(applyForgedCast(fire, ['a', 'b'], 'tide', 1).lit).toEqual(['a']);
        const grove = [makeTile('a', 'a', 'A', { seeded: 1 }), makeTile('b', 'b', 'B', { seeded: 1 })];
        expect(applyForgedCast(grove, ['a', 'b'], 'moss', 1).bloomed).toEqual(['a']);
        expect(grove.map(tile => tile.seeded)).toEqual([2, 1]);
    });

    it('runs forged effects through actual match resolution and keeps them across serialization', () => {
        const base = testHallRoom('element-steam').build();
        const fire = playPair({ ...base, elementalFocus: { ember: 2 } }, 'a-1', 'a-2');
        expect(fire.board?.elementCast?.detail).toContain('fires converted to charge');
        expect(fire.board?.elementCast?.contacts.some(contact => contact.outcome === 'charged')).toBe(true);
        const water = playPair({ ...base, elementStreak: null, elementalFocus: { tide: 2 } }, 'b-1', 'b-2');
        expect(water.realmLitTileIds?.length).toBeGreaterThan(0);
        expect(water.board?.elementCast?.detail).toContain('faces revealed by the current');
        const coated = { ...base, elementalFocus: { bone: 2 }, board: { ...base.board!,
            tiles: base.board!.tiles.map(tile => tile.id.startsWith('a-') ? { ...tile, rime: true as const } : tile) } };
        const frost = playPair(coated, 'a-1', 'a-2');
        expect(frost.realmStillTurns).toBe(3);
        expect(JSON.parse(JSON.stringify(frost)).elementalFocus).toEqual({ bone: 2 });
    });
});
