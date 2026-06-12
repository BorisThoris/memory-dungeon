import { describe, expect, it } from 'vitest';
import {
    FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD,
    FUSE_CACHE_FRESH_SHOP_GOLD_REWARD,
    TOLL_CACHE_SHOP_GOLD_REWARD
} from './contracts';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchEconomy } from './turn-match-economy-rules';

describe('resolveTurnMatchEconomy', () => {
    it('adds route, dungeon, toll, and fresh fuse shop gold', () => {
        const run = { ...createNewRun(0), shopGold: 5 };

        const result = resolveTurnMatchEconomy({
            run,
            routeCardShopGold: 2,
            dungeonShopGold: 3,
            tollCacheClaimed: true,
            fuseCacheClaimed: true,
            fuseCacheFresh: true,
            matchedDungeonKind: null,
            matchedDungeonKeyKind: 'iron'
        });

        expect(result.shopGold).toBe(5 + 2 + 3 + TOLL_CACHE_SHOP_GOLD_REWARD + FUSE_CACHE_FRESH_SHOP_GOLD_REWARD);
        expect(result.dungeonKeys).toBe(run.dungeonKeys);
    });

    it('uses expired fuse gold when the fuse cache is no longer fresh', () => {
        const run = { ...createNewRun(0), shopGold: 5 };

        const result = resolveTurnMatchEconomy({
            run,
            routeCardShopGold: 0,
            dungeonShopGold: 0,
            tollCacheClaimed: false,
            fuseCacheClaimed: true,
            fuseCacheFresh: false,
            matchedDungeonKind: null,
            matchedDungeonKeyKind: 'iron'
        });

        expect(result.shopGold).toBe(5 + FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD);
    });

    it('adds a dungeon key only when a key card was matched', () => {
        const run = { ...createNewRun(0), dungeonKeys: { treasure: 1 } };

        const keyResult = resolveTurnMatchEconomy({
            run,
            routeCardShopGold: 0,
            dungeonShopGold: 0,
            tollCacheClaimed: false,
            fuseCacheClaimed: false,
            fuseCacheFresh: false,
            matchedDungeonKind: 'key',
            matchedDungeonKeyKind: 'treasure'
        });
        const trapResult = resolveTurnMatchEconomy({
            run,
            routeCardShopGold: 0,
            dungeonShopGold: 0,
            tollCacheClaimed: false,
            fuseCacheClaimed: false,
            fuseCacheFresh: false,
            matchedDungeonKind: 'trap',
            matchedDungeonKeyKind: 'treasure'
        });

        expect(keyResult.dungeonKeys).toEqual({ treasure: 2 });
        expect(trapResult.dungeonKeys).toBe(run.dungeonKeys);
    });
});
