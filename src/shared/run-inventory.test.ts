import { describe, expect, it } from 'vitest';
import { createNewRun } from './game-core';
import { createRunShopOffers, purchaseShopOffer } from './shop-rules';
import {
    buildRunInventory,
    gainRunInventoryItem,
    getRunConsumableRows,
    getRunInventoryGainFeedback,
    getRunInventoryLoadoutRows,
    previewRunInventoryItemGain,
    RUN_LOADOUT_SLOT_LIMIT,
    useRunInventoryItem
} from './run-inventory';
import { MAX_GUARD_TOKENS, type RunState } from './contracts';

describe('REG-079 run inventory, consumables, and loadout model', () => {
    it('derives run-scoped consumables from current charges and stack limits', () => {
        const run = createNewRun(0);
        const inventory = buildRunInventory(run);

        expect(inventory.offlineOnly).toBe(true);
        expect(inventory.consumables.map((row) => row.id)).toEqual([
            'shuffle_charge',
            'region_shuffle_charge',
            'destroy_charge',
            'peek_charge',
            'stray_remove_charge',
            'flash_pair_charge',
            'undo_charge',
            'gambit_token',
            'wild_match_token',
            'iron_key',
            'master_key'
        ]);
        expect(inventory.consumables.find((row) => row.id === 'destroy_charge')?.stackLimit).toBeNull();
        expect(inventory.consumables.find((row) => row.id === 'destroy_charge')?.source).toBe(
            'Relics, room rewards, shop services, events, and explicit pickups.'
        );
        expect(inventory.consumables.find((row) => row.id === 'region_shuffle_charge')).toMatchObject({
            label: 'Row/swap charge',
            useRule: 'Spend during play to reshuffle one row or swap two hidden tiles; disabled by no-shuffle contracts.'
        });
        expect(getRunConsumableRows({ ...run, shuffleCharges: 99 }).find((row) => row.id === 'shuffle_charge')?.quantity).toBe(99);
        expect(getRunConsumableRows({ ...run, destroyPairCharges: 7 }).find((row) => row.id === 'destroy_charge')?.quantityLabel).toBe('7');
    });

    it('grants uncapped destroy charges through the shared pickup path', () => {
        const run = { ...createNewRun(0), destroyPairCharges: 2 };
        const charged = gainRunInventoryItem(run, 'destroy_charge', 3);

        expect(charged.destroyPairCharges).toBe(5);
        expect(buildRunInventory(charged).consumables.find((row) => row.id === 'destroy_charge')).toMatchObject({
            quantity: 5,
            quantityLabel: '5',
            stackLimit: null
        });
    });

    it('re-arms a spent gambit token when a pickup grants one later in the floor', () => {
        const spent = {
            ...createNewRun(0),
            gambitAvailableThisFloor: false,
            gambitThirdFlipUsed: true
        };
        const preview = previewRunInventoryItemGain(spent, 'gambit_token');
        const gained = gainRunInventoryItem(spent, 'gambit_token');

        expect(preview).toMatchObject({
            requested: 1,
            accepted: 1,
            capped: false,
            quantity: 0,
            nextQuantity: 1
        });
        expect(gained.gambitAvailableThisFloor).toBe(true);
        expect(gained.gambitThirdFlipUsed).toBe(false);
        expect(buildRunInventory(gained).consumables.find((row) => row.id === 'gambit_token')).toMatchObject({
            quantity: 1,
            quantityLabel: '1/1',
            atStackLimit: true
        });
    });

    it('previews capped pickup capacity before applying full inventory rewards', () => {
        const run = {
            ...createNewRun(0),
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            stats: { ...createNewRun(0).stats, guardTokens: MAX_GUARD_TOKENS }
        };

        expect(previewRunInventoryItemGain(run, 'guard_token', 2)).toMatchObject({
            requested: 2,
            accepted: 0,
            capped: true,
            remainingCapacity: 0
        });
        expect(previewRunInventoryItemGain(run, 'gambit_token')).toMatchObject({
            requested: 1,
            accepted: 0,
            capped: true,
            quantity: 1
        });

        const inventory = buildRunInventory(run);
        expect(inventory.consumables.find((row) => row.id === 'gambit_token')).toMatchObject({
            quantityLabel: '1/1',
            atStackLimit: true,
            fullReason: 'Gambit token is at its run limit.'
        });
    });

    it('formats pickup feedback for accepted, partial, and invalid gains', () => {
        const run = {
            ...createNewRun(0),
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            stats: { ...createNewRun(0).stats, guardTokens: MAX_GUARD_TOKENS - 1 }
        };

        expect(getRunInventoryGainFeedback(run, 'peek_charge', 2)).toMatchObject({
            accepted: 2,
            capped: false,
            gainedLabel: '+2 peek charges',
            cappedLabel: null
        });
        expect(getRunInventoryGainFeedback(run, 'wild_match_token', 2)).toMatchObject({
            accepted: 2,
            capped: false,
            gainedLabel: '+2 wild matches',
            cappedLabel: null
        });
        expect(getRunInventoryGainFeedback(run, 'region_shuffle_charge', 1)).toMatchObject({
            accepted: 1,
            capped: false,
            gainedLabel: '+1 row/swap charge',
            cappedLabel: null
        });
        expect(getRunInventoryGainFeedback(run, 'gambit_token', 1)).toMatchObject({
            accepted: 0,
            capped: true,
            gainedLabel: null,
            cappedLabel: 'Gambit token already full'
        });
        expect(getRunInventoryGainFeedback(run, 'guard_token', 2)).toMatchObject({
            accepted: 1,
            capped: true,
            gainedLabel: '+1 guard token',
            cappedLabel: 'Guard tokens already full'
        });
        expect(getRunInventoryGainFeedback(run, 'relic_loadout', 1)).toMatchObject({
            accepted: 0,
            gainedLabel: null,
            cappedLabel: null,
            noPickupLabel: 'No inventory pickup available'
        });
    });

    it('normalizes impossible negative counters before inventory previews and gains', () => {
        const run = {
            ...createNewRun(0),
            shuffleCharges: -2,
            peekCharges: -1,
            dungeonKeys: { iron: -1, treasure: 1 },
            dungeonMasterKeys: -4,
            stats: { ...createNewRun(0).stats, guardTokens: -1 }
        };

        const rows = getRunConsumableRows(run);
        expect(rows.find((row) => row.id === 'shuffle_charge')?.quantity).toBe(0);
        expect(rows.find((row) => row.id === 'peek_charge')?.quantity).toBe(0);
        expect(rows.find((row) => row.id === 'iron_key')?.quantity).toBe(1);
        expect(rows.find((row) => row.id === 'master_key')?.quantity).toBe(0);
        expect(previewRunInventoryItemGain(run, 'guard_token', 1)).toMatchObject({
            quantity: 0,
            accepted: 1,
            nextQuantity: 1
        });
        expect(gainRunInventoryItem(run, 'peek_charge').peekCharges).toBe(1);
        expect(gainRunInventoryItem(run, 'guard_token').stats.guardTokens).toBe(1);
    });

    it('normalizes malformed stat blocks before gaining stat inventory items', () => {
        const run = {
            ...createNewRun(0),
            stats: Number.NaN as unknown as RunState['stats']
        };

        const consumables = getRunConsumableRows(run);
        expect(consumables.find((row) => row.id === 'guard_token')?.quantity).toBe(0);
        expect(consumables.find((row) => row.id === 'combo_shard')?.quantity).toBe(0);
        expect(previewRunInventoryItemGain(run, 'guard_token', 1)).toMatchObject({
            quantity: 0,
            accepted: 1,
            nextQuantity: 1
        });
        expect(gainRunInventoryItem(run, 'guard_token').stats.guardTokens).toBe(1);
        expect(gainRunInventoryItem(run, 'combo_shard').stats.comboShards).toBe(1);
    });

    it('shows typed dungeon key breakdowns on the shared key row', () => {
        const run = {
            ...createNewRun(0),
            dungeonKeys: { iron: 1, treasure: 2, boss: 1 }
        };

        expect(buildRunInventory(run).consumables.find((row) => row.id === 'iron_key')).toMatchObject({
            quantity: 4,
            quantityLabel: '4 (iron 1, treasure 2, boss 1)'
        });
        expect(
            buildRunInventory({ ...run, dungeonKeys: { treasure: 1 } }).consumables.find((row) => row.id === 'iron_key')
        ).toMatchObject({
            quantity: 1,
            quantityLabel: '1 (treasure 1)'
        });
    });

    it('ignores malformed reward amounts before they can poison inventory counters', () => {
        const run = { ...createNewRun(0), peekCharges: 2 };

        expect(previewRunInventoryItemGain(run, 'peek_charge', Number.NaN)).toMatchObject({
            requested: 0,
            accepted: 0,
            quantity: 2,
            nextQuantity: 2
        });
        expect(previewRunInventoryItemGain(run, 'peek_charge', Number.POSITIVE_INFINITY)).toMatchObject({
            requested: 0,
            accepted: 0,
            quantity: 2,
            nextQuantity: 2
        });
        expect(gainRunInventoryItem(run, 'peek_charge', Number.NaN)).toBe(run);
        expect(gainRunInventoryItem(run, 'peek_charge', Number.POSITIVE_INFINITY)).toBe(run);
    });

    it('normalizes malformed inventory arrays and key records before projecting rows', () => {
        const run = {
            ...createNewRun(0),
            activeMutators: Number.NaN as unknown as [],
            dungeonKeys: Number.NaN as unknown as RunState['dungeonKeys'],
            relicIds: Number.NaN as unknown as []
        };
        const inventory = buildRunInventory(run);

        expect(inventory.consumables.find((row) => row.id === 'iron_key')).toMatchObject({
            quantity: 0,
            quantityLabel: '0'
        });
        expect(inventory.loadout).toHaveLength(0);
        expect(getRunInventoryLoadoutRows(run)).toEqual([]);
    });

    it('treats invalid runtime inventory reward ids as rejected rewards', () => {
        const run = createNewRun(0);
        const invalidItemId = 'missing_reward' as never;

        expect(previewRunInventoryItemGain(run, invalidItemId, 1)).toMatchObject({
            requested: 1,
            accepted: 0,
            capped: true,
            quantity: 0,
            nextQuantity: 0,
            remainingCapacity: null
        });
        expect(gainRunInventoryItem(run, invalidItemId, 1)).toBe(run);
    });

    it('connects shop and treasure key rewards to the same run-only inventory rows', () => {
        const shopRun = createNewRun(0, { runSeed: 52_001 });
        const withShop = { ...shopRun, shopGold: 5, shopOffers: createRunShopOffers(shopRun) };
        const keyOffer = withShop.shopOffers.find((offer) => offer.itemId === 'iron_key')!;
        const purchased = purchaseShopOffer(withShop, keyOffer.id);
        const treasureRewarded = gainRunInventoryItem(purchased, 'master_key');
        const inventory = buildRunInventory(treasureRewarded);

        expect(inventory.consumables.find((row) => row.id === 'iron_key')?.quantity).toBe(1);
        expect(inventory.consumables.find((row) => row.id === 'master_key')?.quantity).toBe(1);
        expect(inventory.consumables.find((row) => row.id === 'iron_key')?.source).toContain('treasure rooms');
    });

    it('uses deterministic run consumables without touching meta inventory', () => {
        const run = gainRunInventoryItem(
            gainRunInventoryItem(
                { ...createNewRun(0), shuffleCharges: 0, dungeonKeys: { treasure: 1 }, dungeonMasterKeys: 1 },
                'peek_charge'
            ),
            'iron_key'
        );
        const peeked = useRunInventoryItem(run, 'peek_charge');
        const keyed = useRunInventoryItem(peeked.run, 'iron_key');
        const mastered = useRunInventoryItem(keyed.run, 'master_key');

        expect(peeked.applied).toBe(true);
        expect(peeked.run.peekCharges).toBe(run.peekCharges - 1);
        expect(keyed.applied).toBe(true);
        expect(keyed.run.dungeonKeys.iron).toBe(0);
        expect(keyed.run.dungeonKeys.treasure).toBe(1);
        expect(mastered.applied).toBe(true);
        expect(mastered.run.dungeonMasterKeys).toBe(0);
        expect(useRunInventoryItem({ ...run, activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null } }, 'shuffle_charge')).toMatchObject({
            applied: false,
            reason: 'unavailable'
        });
    });

    it('normalizes fractional spend counters before using run consumables', () => {
        const run = {
            ...createNewRun(0),
            peekCharges: 2.8,
            dungeonKeys: { iron: 1.8, treasure: 0 },
            dungeonMasterKeys: 1.9,
            wildMatchesRemaining: 1.9
        };

        const peeked = useRunInventoryItem(run, 'peek_charge');
        const keyed = useRunInventoryItem(peeked.run, 'iron_key');
        const mastered = useRunInventoryItem(keyed.run, 'master_key');
        const wilded = useRunInventoryItem(mastered.run, 'wild_match_token');

        expect(peeked.applied).toBe(true);
        expect(peeked.run.peekCharges).toBe(1);
        expect(keyed.applied).toBe(true);
        expect(keyed.run.dungeonKeys.iron).toBe(0);
        expect(mastered.applied).toBe(true);
        expect(mastered.run.dungeonMasterKeys).toBe(0);
        expect(wilded.applied).toBe(true);
        expect(wilded.run.wildMatchesRemaining).toBe(0);
    });

    it('normalizes malformed key records before gaining or spending run inventory keys', () => {
        const malformed = {
            ...createNewRun(0),
            dungeonKeys: Number.NaN as unknown as RunState['dungeonKeys']
        };
        const gained = gainRunInventoryItem(malformed, 'iron_key');
        const spent = useRunInventoryItem({ ...gained, dungeonKeys: { iron: 1.8 } }, 'iron_key');

        expect(gained.dungeonKeys.iron).toBe(1);
        expect(spent.applied).toBe(true);
        expect(spent.run.dungeonKeys.iron).toBe(0);
    });

    it('separates mutable mid-run consumables from fixed loadout slots', () => {
        const run = createNewRun(0, {
            initialRelicIds: ['chapter_compass', 'wager_surety'],
            activeMutators: ['short_memorize', 'wide_recall']
        });
        const loadout = getRunInventoryLoadoutRows(run);

        expect(loadout).toHaveLength(RUN_LOADOUT_SLOT_LIMIT);
        expect(loadout.filter((slot) => slot.mutableDuringRun)).toHaveLength(0);
        expect(loadout.map((slot) => slot.source)).toEqual(['relic', 'relic', 'mutator', 'mutator']);
        expect(loadout[0]?.changeWindow).toContain('Relic draft');
    });
});
