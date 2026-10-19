import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import { claimCurio, curioItemFor, curioItemsForRules } from './curio-rules';
import { MISS_BANK_CAP, missBankCap, missesLeft } from './miss-bank';
import { misersPurseGold } from './run-relic-rules';
import { rollStoreStock, STORE_ITEMS } from './run-store-rules';
import { canTakeMisersPurse, takeMisersPurse } from './misers-purse-rules';
import { reduceGameplayCommand } from './gameplay-core';
import { createGameplayTakeRelicCommand } from './gameplay-core-contracts';

const run = (): RunState => finishMemorizePhase(createNewRun(0, { runSeed: 4242, realm: null }));

/** The first claim index whose seeded draw is the purse, under rules 68. */
const purseDraw = (base: RunState): RunState => {
    for (let claimed = 0; claimed < 200; claimed += 1) {
        const candidate = { ...base, runRulesVersion: 68, curiosClaimedThisRun: claimed };
        if (curioItemFor(candidate, 4) === 'misers_purse') return candidate;
    }
    throw new Error('no purse in 200 draws');
};

describe("the Miser's Purse", () => {
    it('doubles what a clear pays, and takes one slot from the miss bank', () => {
        const base = run();
        const withPurse: RunState = { ...base, relics: ['misers_purse'] };
        expect(misersPurseGold(base, 5)).toBe(5);
        expect(misersPurseGold(withPurse, 5)).toBe(10);
        expect(missBankCap(base)).toBe(MISS_BANK_CAP);
        expect(missBankCap(withPurse)).toBe(MISS_BANK_CAP - 1);
    });

    it('is offered by a Curio from rules 68, not forced, and only once a run', () => {
        expect(curioItemsForRules(67)).not.toContain('misers_purse');
        expect(curioItemsForRules(68)).toContain('misers_purse');
        const claimed = claimCurio(purseDraw(run()), 4, 'p');
        expect(claimed.lastCurioDrop?.item).toBe('misers_purse');
        expect(claimed.misersPurseOffers).toBe(1);
        expect(claimed.relics ?? []).toEqual([]);
        expect(missBankCap(claimed)).toBe(MISS_BANK_CAP);
        // On offer or carried, a Curio never holds it again.
        for (let next = 0; next < 60; next += 1) {
            expect(curioItemFor({ ...claimed, curiosClaimedThisRun: next }, 4)).not.toBe('misers_purse');
            expect(curioItemFor({ ...claimed, misersPurseOffers: 0, relics: ['misers_purse'], curiosClaimedThisRun: next }, 4)).not.toBe('misers_purse');
        }
    });

    it('is taken up by the player: the relic for the run, and a full bank gives up its soonest miss', () => {
        const offered: RunState = { ...run(), misersPurseOffers: 1, missBank: [{ floor: 1, misses: 2 }, { floor: 3, misses: 2 }] };
        expect(canTakeMisersPurse(offered)).toBe(true);
        const taken = takeMisersPurse(offered)!;
        expect(taken.relics).toEqual(['misers_purse']);
        expect(taken.misersPurseOffers).toBe(0);
        expect(missesLeft(taken)).toBe(MISS_BANK_CAP - 1);
        expect(taken.missBank).toEqual([{ floor: 1, misses: 1 }, { floor: 3, misses: 2 }]);
        expect(canTakeMisersPurse(taken)).toBe(false);
        expect(takeMisersPurse(run())).toBeNull();
        const result = reduceGameplayCommand(offered, createGameplayTakeRelicCommand('take:test'));
        expect(result.accepted).toBe(true);
        expect(result.events.find((event) => event.type === 'run.relic_taken')).toMatchObject({ relicId: 'misers_purse', missesBefore: 4, missesAfter: 3 });
    });

    it('is never sold: no store row, and no historical stock roll ever shows it', () => {
        expect(STORE_ITEMS.some((item) => item.id === 'misers_purse')).toBe(false);
        for (let seed = 1; seed <= 200; seed += 1) {
            expect(rollStoreStock(seed, 3, [], 54)).not.toContain('misers_purse');
        }
    });
});
