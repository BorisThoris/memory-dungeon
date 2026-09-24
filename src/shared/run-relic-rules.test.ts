import { describe, expect, it } from 'vitest';

import type { RunState } from './contracts';
import { createNewRun, flipTile, resolveBoardTurn } from './game';
import { MISS_BANK_CAP, MISS_BANK_COMBO_RUNG, missBankCap, missesLeft } from './miss-bank';
import { DEEP_POCKETS_CAP, GILDED_CHAIN_GOLD, LONG_LOOK_MS, RELICS } from './run-relic-rules';
import { buyStoreItem, runGold, storeOffer } from './run-store-rules';
import { getMemorizeDurationForRun } from './scoring-rules';
import { makeRun, makeTile } from './test/game-fixtures';

/*
 * Relics (`run-relic-rules.ts`): bought once in the store, kept to the end of the run, each acting
 * on a clock the player winds. These drive the real store purchase and the real turn path.
 */
const rich = (overrides: Partial<RunState> = {}): RunState => ({
    ...createNewRun(0, { runSeed: 7, gameMode: 'endless' }),
    gold: 40,
    ...overrides
});

describe('relics in the store', () => {
    it('sells each relic once, and marks it owned after', () => {
        let run = rich();
        for (const relic of RELICS) {
            const bought = buyStoreItem(run, relic.id);
            expect(bought, relic.id).not.toBeNull();
            run = bought!;
            expect(run.relics).toContain(relic.id);
            expect(storeOffer(run).find((row) => row.id === relic.id)?.blocked).toBe('owned');
            expect(buyStoreItem(run, relic.id)).toBeNull();
        }
        expect(runGold(run)).toBe(40 - RELICS.reduce((sum, relic) => sum + relic.price, 0));
    });

    it('refuses a relic the purse cannot pay for', () => {
        expect(storeOffer(rich({ gold: 1 })).find((row) => row.id === 'long_look')?.blocked).toBe('gold');
        expect(buyStoreItem(rich({ gold: 1 }), 'long_look')).toBeNull();
    });
});

describe('what each relic does', () => {
    it('Deep Pockets: the bank holds five, and the store sells a miss up to it', () => {
        const run = rich({ missBank: [{ floor: 1, misses: MISS_BANK_CAP }] });
        expect(missBankCap(run)).toBe(MISS_BANK_CAP);
        expect(storeOffer(run).find((row) => row.id === 'miss')?.blocked).toBe('full');
        const pockets = buyStoreItem(run, 'deep_pockets')!;
        expect(missBankCap(pockets)).toBe(DEEP_POCKETS_CAP);
        const topped = buyStoreItem(pockets, 'miss')!;
        expect(missesLeft(topped)).toBe(DEEP_POCKETS_CAP);
    });

    it('Gilded Chain: the fifth match in a row pays gold beside the miss it earns', () => {
        const pairs = ['a', 'b', 'c', 'd', 'e', 'f'];
        const tiles = pairs.flatMap((key) => [makeTile(`${key}-1`, key, key.toUpperCase()), makeTile(`${key}-2`, key, key.toUpperCase())]);
        const playRun = (relics: RunState['relics']): RunState => {
            let run: RunState = makeRun(tiles, { missBank: [{ floor: 1, misses: 1 }], gold: 0, relics });
            for (const key of pairs.slice(0, MISS_BANK_COMBO_RUNG)) {
                run = resolveBoardTurn(flipTile(flipTile(run, `${key}-1`), `${key}-2`));
            }
            return run;
        };
        const plain = playRun([]);
        const gilded = playRun(['gilded_chain']);
        expect(plain.stats.currentStreak).toBe(MISS_BANK_COMBO_RUNG);
        // Both earned the miss the rung pays; only the relic paid gold for it.
        expect(missesLeft(gilded)).toBe(missesLeft(plain));
        expect(runGold(plain)).toBe(0);
        expect(runGold(gilded)).toBe(GILDED_CHAIN_GOLD);
    });

    it('Long Look: a second more to study, on every floor', () => {
        const run = createNewRun(0, { runSeed: 7, gameMode: 'endless' });
        for (const level of [1, 8, 30]) {
            expect(getMemorizeDurationForRun({ ...run, relics: ['long_look'] }, level)).toBe(
                getMemorizeDurationForRun(run, level) + LONG_LOOK_MS
            );
        }
    });
});
