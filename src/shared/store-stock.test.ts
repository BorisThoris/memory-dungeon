import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase } from './game-core';
import { finalizeLevel } from './floor-clear-transition';
import { buyStoreItem, isStocked, rollStoreStock, storeOffer, STORE_ITEMS, STORE_STOP_EVERY_FLOORS } from './run-store-rules';

describe('what a stop has on its shelves', () => {
    it('always sells a miss, always a bomb at the first stop, and the same shelves for the same seed and floor', () => {
        for (let seed = 1; seed <= 200; seed += 1) {
            const first = rollStoreStock(seed, STORE_STOP_EVERY_FLOORS, []);
            expect(first).toContain('miss');
            expect(first).toContain('bomb');
            expect(first).toEqual(rollStoreStock(seed, STORE_STOP_EVERY_FLOORS, []));
            expect(new Set(first).size).toBe(first.length);
            // Two relics, never one already owned.
            expect(first.filter((id) => !['miss', 'peek', 'shuffle', 'bomb'].includes(id))).toHaveLength(2);
            const later = rollStoreStock(seed, STORE_STOP_EVERY_FLOORS * 2, ['deep_pockets', 'gilded_chain']);
            expect(later).not.toContain('deep_pockets');
            expect(later).not.toContain('gilded_chain');
            expect(later.filter((id) => ['long_look', 'tallow_candle'].includes(id))).toHaveLength(2);
        }
    });

    it('varies from stop to stop: not every consumable, not the same relics', () => {
        const stocks = Array.from({ length: 300 }, (_, seed) => rollStoreStock(seed, STORE_STOP_EVERY_FLOORS * 2, []));
        const withPeek = stocks.filter((stock) => stock.includes('peek')).length / stocks.length;
        expect(withPeek).toBeGreaterThan(0.5);
        expect(withPeek).toBeLessThan(0.85);
        const relicPairs = new Set(stocks.map((stock) => stock.filter((id) => !['miss', 'peek', 'shuffle', 'bomb'].includes(id)).join('+')));
        expect(relicPairs.size).toBeGreaterThan(3);
    });

    it('reads a run stocked before stops were rolled as selling everything', () => {
        expect(isStocked({}, 'tallow_candle')).toBe(true);
        expect(isStocked({ storeStock: ['miss'] }, 'tallow_candle')).toBe(false);
        expect(storeOffer({ ...createNewRun(0), storeStock: undefined }).map((row) => row.id)).toEqual(STORE_ITEMS.map((item) => item.id));
    });

    it('stocks the shelves as the stop opens, and sells only what is on them', () => {
        const run = finishMemorizePhase(createNewRun(0, { runSeed: 77 }));
        const board = { ...run.board!, level: STORE_STOP_EVERY_FLOORS, matchedPairs: run.board!.pairCount, tiles: run.board!.tiles.map((tile) => ({ ...tile, state: 'matched' as const })) };
        const cleared = finalizeLevel({ ...run, board }, board);
        expect(cleared.storeStock).toEqual(rollStoreStock(77, STORE_STOP_EVERY_FLOORS, []));
        const offered = storeOffer({ ...cleared, gold: 100 }).map((row) => row.id);
        expect(offered).toEqual(cleared.storeStock);
        const missing = STORE_ITEMS.map((item) => item.id).find((id) => !cleared.storeStock!.includes(id));
        if (missing) expect(buyStoreItem({ ...cleared, gold: 100 }, missing)).toBeNull();
        // A floor that is not a stop stocks nothing new.
        const plain = { ...board, level: STORE_STOP_EVERY_FLOORS + 1 };
        expect(finalizeLevel({ ...run, board: plain }, plain).storeStock).toBeUndefined();
    });
});
