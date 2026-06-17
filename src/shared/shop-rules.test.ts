import { describe, expect, it } from 'vitest';
import { MAX_LIVES } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import { buildBoard } from './board-build-rules';
import {
    canRerollShopOffers,
    createRunShopOffers,
    getRunShopReadModel,
    getRunShopStockPlan,
    getShopGoldRewardForFloor,
    getShopRerollCostForFloor,
    getShopWalletPacing,
    purchaseShopOffer,
    rerollShopOffers,
    SHOP_ITEM_CATALOG
} from './shop-rules';

const makePlayingRun = () => finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 4242 }));

describe('shop rules', () => {
    it('defines deterministic floor rewards, reroll cost, and stock plans', () => {
        expect(getShopGoldRewardForFloor(1)).toBe(2);
        expect(getShopGoldRewardForFloor(99)).toBe(8);
        expect(getShopRerollCostForFloor(1)).toBe(1);
        expect(getShopRerollCostForFloor(7)).toBe(3);
        expect(SHOP_ITEM_CATALOG.heal_life.stackLimit).toBe(MAX_LIVES);

        const run = makePlayingRun();
        expect(getRunShopStockPlan(run)).toMatchObject({
            source: 'floor_clear_shop',
            itemIds: ['heal_life', 'peek_charge', 'region_shuffle_charge', 'destroy_charge', 'iron_key']
        });
        expect(
            getRunShopStockPlan({
                ...run,
                board: run.board ? { ...run.board, level: 5, dungeonShopTileId: 'shop' } : run.board
            }).itemIds
        ).toContain('master_key');
    });

    it('biases shop stock by route pressure and reroll round while preserving lock keys', () => {
        const run = makePlayingRun();
        const greedRun = {
            ...run,
            pendingRouteCardPlan: { choiceId: 'greed', routeType: 'greed' as const, sourceLevel: 1, targetLevel: 2 }
        };
        const mysteryRun = {
            ...run,
            pendingRouteCardPlan: { choiceId: 'mystery', routeType: 'mystery' as const, sourceLevel: 1, targetLevel: 2 }
        };
        const lockedBoardRun = {
            ...run,
            board: run.board ? { ...run.board, dungeonExitLockKind: 'iron' as const } : run.board
        };

        expect(getRunShopStockPlan(greedRun).itemIds.slice(0, 3)).toEqual([
            'iron_key',
            'region_shuffle_charge',
            'destroy_charge'
        ]);
        expect(getRunShopStockPlan(mysteryRun).itemIds.slice(0, 3)).toEqual([
            'peek_charge',
            'trait_cleanse',
            'region_shuffle_charge'
        ]);
        expect(getRunShopStockPlan({ ...greedRun, shopRerolls: 1 }).itemIds.slice(0, 3)).toEqual([
            'destroy_charge',
            'iron_key',
            'master_key'
        ]);
        expect(getRunShopStockPlan(lockedBoardRun).itemIds[0]).toBe('iron_key');
    });

    it('biases boss-floor shop stock toward the boss counterplay item', () => {
        const run = makePlayingRun();
        const bossRun = {
            ...run,
            board: run.board
                ? { ...run.board, floorTag: 'boss' as const, dungeonBossId: 'rush_sentinel' as const }
                : run.board
        };

        expect(getRunShopStockPlan(bossRun).itemIds[0]).toBe('region_shuffle_charge');
    });

    it('builds read models from current compatibility and wallet state', () => {
        const fullLifeRun = { ...makePlayingRun(), lives: MAX_LIVES, shopGold: 10 };
        const run = { ...fullLifeRun, shopOffers: createRunShopOffers(fullLifeRun) };
        const readModel = getRunShopReadModel(run);

        expect(readModel.offerCount).toBe(run.shopOffers.length);
        expect(readModel.availableOfferCount).toBe(
            run.shopOffers.filter((offer) => offer.itemId !== 'heal_life' && offer.compatible && run.shopGold >= offer.cost).length
        );
        expect(readModel.canReroll).toBe(true);
        expect(getShopWalletPacing(run)).toMatchObject({
            totalWallet: run.shopGold,
            conversionAtRunEnd: 'unspent_shop_gold_expires'
        });
    });

    it('prevents incompatible, unaffordable, duplicate, and second-reroll purchases', () => {
        const fullLifeRun = { ...makePlayingRun(), lives: MAX_LIVES, shopGold: 10 };
        const run = { ...fullLifeRun, shopOffers: createRunShopOffers(fullLifeRun) };
        const heal = run.shopOffers.find((offer) => offer.itemId === 'heal_life')!;
        const peek = run.shopOffers.find((offer) => offer.itemId === 'peek_charge')!;
        const swap = run.shopOffers.find((offer) => offer.itemId === 'region_shuffle_charge')!;

        expect(purchaseShopOffer(run, heal.id)).toBe(run);
        expect(purchaseShopOffer({ ...run, shopGold: 0 }, peek.id)).toEqual({ ...run, shopGold: 0 });

        const purchased = purchaseShopOffer(run, peek.id);
        expect(purchased.shopGold).toBe(run.shopGold - peek.cost);
        expect(purchased.peekCharges).toBe(run.peekCharges + 1);
        expect(purchaseShopOffer(purchased, peek.id)).toBe(purchased);
        expect(purchaseShopOffer(run, swap.id).regionShuffleCharges).toBe(run.regionShuffleCharges + 1);
        expect(
            purchaseShopOffer(
                { ...run, activeContract: { noShuffle: true, noDestroy: false, maxMismatches: null } },
                swap.id
            )
        ).toMatchObject({ regionShuffleCharges: run.regionShuffleCharges });

        const rerolled = rerollShopOffers({ ...run, shopGold: 10 });
        expect(rerolled.shopRerolls).toBe(1);
        expect(rerolled.shopGold).toBe(9);
        expect(canRerollShopOffers(rerolled)).toBe(false);
        expect(rerollShopOffers(rerolled)).toBe(rerolled);
    });

    it('cleanses one hidden dangerous trait pair immediately from shop stock', () => {
        const board = buildBoard(4, { runSeed: 4242, runRulesVersion: makePlayingRun().runRulesVersion });
        const dangerousBoard = {
            ...board,
            tiles: board.tiles.map((tile, index) =>
                index < 2 ? { ...tile, pairKey: 'danger', tileTraitKind: 'cursed' as const } : tile
            )
        };
        const run = {
            ...makePlayingRun(),
            board: dangerousBoard,
            shopGold: 10
        };
        const withShop = { ...run, shopOffers: createRunShopOffers(run) };
        const cleanse = withShop.shopOffers.find((offer) => offer.itemId === 'trait_cleanse')!;
        const cleaned = purchaseShopOffer(withShop, cleanse.id);

        expect(cleanse.compatible).toBe(true);
        expect(cleaned.shopGold).toBe(withShop.shopGold - cleanse.cost);
        expect(cleaned.board?.tiles.filter((tile) => tile.pairKey === 'danger').map((tile) => tile.tileTraitKind)).toEqual([
            'stasis',
            'stasis'
        ]);
        expect(purchaseShopOffer({ ...withShop, board }, cleanse.id)).toMatchObject({ board });
    });

    it('rechecks compatibility when run state changes after offers were created', () => {
        const damaged = { ...makePlayingRun(), lives: MAX_LIVES - 1, shopGold: 10 };
        const heal = createRunShopOffers(damaged).find((offer) => offer.itemId === 'heal_life')!;
        const staleFullLifeRun = { ...damaged, lives: MAX_LIVES, shopOffers: [heal] };

        expect(heal.compatible).toBe(true);
        expect(purchaseShopOffer(staleFullLifeRun, heal.id)).toBe(staleFullLifeRun);
    });
});
