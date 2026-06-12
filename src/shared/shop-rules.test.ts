import { describe, expect, it } from 'vitest';
import { MAX_LIVES } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
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
            itemIds: ['heal_life', 'peek_charge', 'destroy_charge', 'iron_key']
        });
        expect(
            getRunShopStockPlan({
                ...run,
                board: run.board ? { ...run.board, level: 5, dungeonShopTileId: 'shop' } : run.board
            }).itemIds
        ).toContain('master_key');
    });

    it('builds read models from current compatibility and wallet state', () => {
        const fullLifeRun = { ...makePlayingRun(), lives: MAX_LIVES, shopGold: 10 };
        const run = { ...fullLifeRun, shopOffers: createRunShopOffers(fullLifeRun) };
        const readModel = getRunShopReadModel(run);

        expect(readModel.offerCount).toBe(run.shopOffers.length);
        expect(readModel.availableOfferCount).toBe(
            run.shopOffers.filter((offer) => offer.itemId !== 'heal_life' && run.shopGold >= offer.cost).length
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

        expect(purchaseShopOffer(run, heal.id)).toBe(run);
        expect(purchaseShopOffer({ ...run, shopGold: 0 }, peek.id)).toEqual({ ...run, shopGold: 0 });

        const purchased = purchaseShopOffer(run, peek.id);
        expect(purchased.shopGold).toBe(run.shopGold - peek.cost);
        expect(purchased.peekCharges).toBe(run.peekCharges + 1);
        expect(purchaseShopOffer(purchased, peek.id)).toBe(purchased);

        const rerolled = rerollShopOffers({ ...run, shopGold: 10 });
        expect(rerolled.shopRerolls).toBe(1);
        expect(rerolled.shopGold).toBe(9);
        expect(canRerollShopOffers(rerolled)).toBe(false);
        expect(rerollShopOffers(rerolled)).toBe(rerolled);
    });

    it('rechecks compatibility when run state changes after offers were created', () => {
        const damaged = { ...makePlayingRun(), lives: MAX_LIVES - 1, shopGold: 10 };
        const heal = createRunShopOffers(damaged).find((offer) => offer.itemId === 'heal_life')!;
        const staleFullLifeRun = { ...damaged, lives: MAX_LIVES, shopOffers: [heal] };

        expect(heal.compatible).toBe(true);
        expect(purchaseShopOffer(staleFullLifeRun, heal.id)).toBe(staleFullLifeRun);
    });
});
