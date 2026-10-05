import { describe, expect, it } from 'vitest';
import { createNewRun, advanceToNextLevel } from './game-core';
import { finalizeLevel } from './floor-clear-transition';
import { buyStoreItem, storeOffer, rollStoreStock } from './run-store-rules';
import { CAMP_UPGRADE_IDS, relicRank } from './run-relic-rules';
import { getMemorizeDurationForRun } from './scoring-rules';
import { applyMissBudget, missBankCap, missesLeft } from './miss-bank';
import { floorElementalDrops } from './elemental-loot-rules';
import { chooseRealmDoor } from './realm-rules';
import type { RunState } from './contracts';

const camp = (seed = 17): RunState => {
    const run = createNewRun(0, { runSeed: seed, gameMode: 'endless', runRulesVersionOverride: 60 });
    const board = { ...run.board!, level: 3, matchedPairs: run.board!.pairCount,
        tiles: run.board!.tiles.map(tile => ({ ...tile, state: 'matched' as const })) };
    return { ...finalizeLevel({ ...run, board }, board), gold: 200, missBank: [{ floor: 3, misses: 4 }] };
};

describe('camp economy and automatic next floor', () => {
    it('offers three upgrades and three supplies, with no elemental purchases or drops', () => {
        const run = camp();
        expect(run.runRulesVersion).toBeGreaterThanOrEqual(58);
        expect(storeOffer(run).map(row => row.id)).toEqual(['long_look', 'deep_pockets', 'gilded_chain', 'miss', 'peek', 'bomb']);
        expect(rollStoreStock(17, 6, [], run.runRulesVersion)).toEqual(run.storeStock);
        expect(floorElementalDrops(run, 3)).toEqual({});
        expect(run.lastLevelResult?.elementalDrops).toBeUndefined();
        expect(buyStoreItem({ ...run, elementalEssence: { tide: 100 } }, 'focus_tide')).toBeNull();
    });
    it('selects a varied, reproducible destination at clear, with no choices, and enters it', () => {
        const destinations = new Set<string>();
        for (let seed = 0; seed < 30; seed++) {
            const run = camp(seed);
            expect(run.realmDoors).toBeNull();
            expect(run.nextRealm).toEqual(camp(seed).nextRealm);
            expect(chooseRealmDoor(run, 2)).toBe(run);
            expect(finalizeLevel(run, run.board!)).toBe(run);
            const next = advanceToNextLevel(run);
            expect(next.board?.level).toBe(4);
            expect(next.realmId).toBe(run.nextRealm?.realmId);
            expect(next.realmSeverity).toBe(run.nextRealm?.severity);
            destinations.add(run.nextRealm!.realmId);
        }
        expect(destinations.size).toBe(5);
    });
    it('prices each rank, caps at three, spends exact gold and never duplicates relics', () => {
        for (const id of CAMP_UPGRADE_IDS) {
            let run = camp();
            const prices = id === 'gilded_chain' ? [6, 11, 16] : [8, 14, 20];
            for (const [index, price] of prices.entries()) {
                const before = run;
                run = buyStoreItem(run, id)!;
                expect(before.gold! - run.gold!).toBe(price);
                expect(relicRank(run, id)).toBe(index + 1);
                expect(run.relics?.filter(owned => owned === id)).toHaveLength(1);
            }
            expect(storeOffer(run).find(row => row.id === id)?.blocked).toBe('max_rank');
            expect(buyStoreItem(run, id)).toBeNull();
        }
        expect(buyStoreItem({ ...camp(), gold: 7 }, 'long_look')).toBeNull();
    });
    it('adds study time and miss capacity at every rank, and restores a miss immediately', () => {
        let look = camp();
        let pockets = camp();
        const base = getMemorizeDurationForRun(look, 4);
        for (let rank = 1; rank <= 3; rank++) {
            look = buyStoreItem(look, 'long_look')!;
            pockets = buyStoreItem(pockets, 'deep_pockets')!;
            expect(getMemorizeDurationForRun(look, 4)).toBe(base + rank * 1000);
            expect(missBankCap(pockets)).toBe(4 + rank);
            expect(missesLeft(pockets)).toBe(4 + rank);
        }
        const next = advanceToNextLevel(look);
        expect(relicRank(next, 'long_look')).toBe(3);
        expect(next.gold).toBe(look.gold);
        expect(createNewRun(0).relics ?? []).toEqual([]);
    });
    it('pays upgraded combo gold on every fifth match, even with a full miss bank', () => {
        let run = camp();
        for (let rank = 1; rank <= 3; rank++) {
            run = buyStoreItem(run, 'gilded_chain')!;
            const before = { ...run, stats: { ...run.stats, currentStreak: 4 } };
            const after = applyMissBudget(before, { ...before, stats: { ...before.stats, currentStreak: 5 } });
            expect(after.gold! - before.gold!).toBe(rank + 1);
            expect(missesLeft(after)).toBe(4);
            expect(applyMissBudget(after, { ...after, stats: { ...after.stats, currentStreak: 6 } }).gold).toBe(after.gold);
        }
    });
    it('keeps supplies repeatable, prices them progressively, and rejects a full miss bank', () => {
        const run = camp();
        expect(buyStoreItem(run, 'miss')).toBeNull();
        expect(buyStoreItem({ ...run, missBank: undefined }, 'deep_pockets')).toBeNull();
        const bought = buyStoreItem(run, 'peek')!;
        const twice = buyStoreItem(bought, 'peek')!;
        expect(run.gold! - twice.gold!).toBe(7);
        expect(twice.peekCharges - run.peekCharges).toBe(2);
        expect(storeOffer({ ...run, gold: 2 }).find(row => row.id === 'long_look')?.goldShortfall).toBe(6);
    });
});
