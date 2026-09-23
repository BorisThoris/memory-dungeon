import { describe, expect, it } from 'vitest';

import { createNewRun, finalizeLevel, finishMemorizePhase } from './game';
import { MISS_BANK_CAP, missesLeft } from './miss-bank';
import {
    buyStoreItem,
    floorClearGold,
    GOLD_FLOOR_CLEAR_BASE,
    runGold,
    STORE_ITEMS,
    storeOffer,
    storePrice
} from './run-store-rules';
import type { BoardState, RunState } from './contracts';

describe('gold at the floor clear', () => {
    it('pays a base, the rung the floor cleared at, and the turns under par up to a cap', () => {
        expect(floorClearGold({ tier: 'none', turnsUnderPar: 0 })).toBe(GOLD_FLOOR_CLEAR_BASE);
        expect(floorClearGold({ tier: 'clean', turnsUnderPar: 0 })).toBe(GOLD_FLOOR_CLEAR_BASE + 1);
        expect(floorClearGold({ tier: 'fever', turnsUnderPar: 2 })).toBe(GOLD_FLOOR_CLEAR_BASE + 3 + 2);
        expect(floorClearGold({ tier: 'fever', turnsUnderPar: 9 })).toBe(GOLD_FLOOR_CLEAR_BASE + 3 + 3);
    });

    it('lands in the purse when a real floor clears, and is written on the level result', () => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 4242 }));
        const board: BoardState = {
            ...base.board!,
            matchedPairs: base.board!.pairCount,
            tiles: base.board!.tiles.map((tile) => ({ ...tile, state: 'matched' as const }))
        };
        const run: RunState = { ...base, board, gold: 5, turnsThisFloor: 1 };
        const cleared = finalizeLevel(run, board);
        expect(cleared.lastLevelResult?.goldEarned).toBeGreaterThanOrEqual(GOLD_FLOOR_CLEAR_BASE);
        expect(runGold(cleared)).toBe(5 + (cleared.lastLevelResult?.goldEarned ?? 0));
        expect(runGold(createNewRun(0))).toBe(0);
    });
});

describe('the store', () => {
    const run = (overrides: Partial<RunState> = {}): RunState => ({
        ...createNewRun(0, { runSeed: 7, gameMode: 'endless' }),
        gold: 10,
        missBank: [{ floor: 1, misses: 2 }],
        ...overrides
    });

    it('prices every item, and raises the price with each purchase of the same thing', () => {
        for (const item of STORE_ITEMS) {
            expect(storePrice(run(), item.id)).toBe(item.basePrice);
        }
        const bought = buyStoreItem(run(), 'miss')!;
        expect(storePrice(bought, 'miss')).toBe(STORE_ITEMS[0]!.basePrice + STORE_ITEMS[0]!.priceStep);
        expect(storePrice(bought, 'peek')).toBe(STORE_ITEMS[1]!.basePrice);
    });

    it('sells a miss into the bank and stops at the cap', () => {
        const bought = buyStoreItem(run(), 'miss')!;
        expect(missesLeft(bought)).toBe(3);
        expect(runGold(bought)).toBe(10 - storePrice(run(), 'miss'));
        const full = run({ missBank: [{ floor: 1, misses: MISS_BANK_CAP }] });
        expect(storeOffer(full).find((row) => row.id === 'miss')?.blocked).toBe('full');
        expect(buyStoreItem(full, 'miss')).toBeNull();
        // A run with no bank has nothing to put a miss into.
        expect(storeOffer(run({ missBank: undefined })).find((row) => row.id === 'miss')?.blocked).toBe('no_bank');
    });

    it('sells charges the dock already spends', () => {
        const peek = buyStoreItem(run({ peekCharges: 1 }), 'peek')!;
        expect(peek.peekCharges).toBe(2);
        const shuffle = buyStoreItem(run({ shuffleCharges: 0 }), 'shuffle')!;
        expect(shuffle.shuffleCharges).toBe(1);
    });

    it('refuses what the purse cannot pay for, and says so on the sheet', () => {
        const poor = run({ gold: 2 });
        expect(storeOffer(poor).every((row) => row.blocked === 'gold')).toBe(true);
        expect(buyStoreItem(poor, 'peek')).toBeNull();
        expect(runGold(poor)).toBe(2);
    });
});
