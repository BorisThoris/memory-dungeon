import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import { createNewRun } from './game';
import { DREAD_BUYS_FROM, DREAD_EXTRA_CAP, dreadBudget, dreadPurchase, NO_DREAD_PURCHASE } from './dread-composition-rules';
import { dreadAt } from './dread-rules';

const all = { sleeper: 2, mask: 2, wanderer: 3 };

describe('the Dread spends (DGE-003/009)', () => {
    it('buys nothing before Awake, and six points a doubling after', () => {
        expect(dreadBudget(DREAD_BUYS_FROM - 1)).toBe(0);
        expect(dreadBudget(DREAD_BUYS_FROM)).toBe(6);
        expect(dreadBudget(DREAD_BUYS_FROM * 4)).toBe(18);
        expect(dreadPurchase(DREAD_BUYS_FROM - 1, all)).toEqual(NO_DREAD_PURCHASE);
    });

    it('buys only families the floor already deals, never past the cap', () => {
        expect(dreadPurchase(640, { sleeper: 0, mask: 0, wanderer: 2 })).toEqual({ sleeper: 0, mask: 0, wanderer: 2 });
        expect(dreadPurchase(640, NO_DREAD_PURCHASE)).toEqual(NO_DREAD_PURCHASE);
        for (const dread of [160, 640, 3000, 1e6]) {
            const bought = dreadPurchase(dread, all);
            expect(Math.max(bought.sleeper, bought.mask, bought.wanderer)).toBeLessThanOrEqual(DREAD_EXTRA_CAP);
        }
    });

    it('composes a deep floor differently: the dear families take over and the cheap one is skipped', () => {
        const awake = dreadPurchase(DREAD_BUYS_FROM, all);
        const deep = dreadPurchase(dreadAt(60, 20, 20), all);
        expect(awake.sleeper).toBe(0);
        expect(deep.sleeper).toBe(DREAD_EXTRA_CAP);
        expect(deep.wanderer).toBe(0);
    });

    it('the same run at the same floor buys the same, and it is told', () => {
        const run = createNewRun(0, { runSeed: 4242, gameMode: 'endless' });
        expect(run.runRulesVersion).toBe(GAME_RULES_VERSION);
        expect(dreadPurchase(dreadAt(45, 8, 8), all)).toEqual(dreadPurchase(dreadAt(45, 8, 8), all));
    });
});
