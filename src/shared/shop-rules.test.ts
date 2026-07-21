import { describe, expect, it } from 'vitest';
import { MAX_LIVES, type BoardState, type RunState, type Tile } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import { buildBoard } from './board-build-rules';
import { EXIT_PAIR_KEY } from './tile-identity';
import {
    canRerollShopOffers,
    createRunShopOffers,
    getRunShopReadModel,
    getRunShopWalletPacing,
    getRunShopStockPlan,
    getShopGoldRewardForFloor,
    getShopRerollCostForFloor,
    getShopWalletPacing,
    purchaseShopOffer,
    rerollShopOffers,
    SHOP_ITEM_CATALOG
} from './shop-rules';

const makePlayingRun = () => finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 4242 }));

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state
});

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
            board: run.board
                ? {
                      ...run.board,
                      dungeonExitLockKind: 'iron' as const,
                      tiles: run.board.tiles.map((candidate) =>
                          candidate.pairKey === EXIT_PAIR_KEY
                              ? { ...candidate, dungeonExitLockKind: 'iron' as const }
                              : candidate
                      )
                  }
                : run.board
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

    it('does not prioritize key insurance for a terminal key lock fallback', () => {
        const run = makePlayingRun();
        const terminalBoard: BoardState = {
            ...run.board!,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            matchedPairs: 1,
            pairCount: 1,
            tiles: [
                tile('a1', 'a', 'matched'),
                tile('a2', 'a', 'matched'),
                {
                    ...tile('exit', EXIT_PAIR_KEY, 'flipped'),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }
            ]
        };
        const activeLockBoard: BoardState = {
            ...terminalBoard,
            matchedPairs: 0,
            tiles: [
                tile('a1', 'a'),
                tile('a2', 'a'),
                terminalBoard.tiles[2]!
            ]
        };

        expect(getRunShopStockPlan({ ...run, board: terminalBoard }).itemIds[0]).not.toBe('iron_key');
        expect(getRunShopStockPlan({ ...run, board: activeLockBoard }).itemIds[0]).toBe('iron_key');
    });

    it('does not force key insurance ahead of stock when the key route already exists', () => {
        const run = makePlayingRun();
        const lockedBoard: BoardState = {
            ...run.board!,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            tiles: [
                tile('a1', 'a'),
                tile('a2', 'a'),
                {
                    ...tile('exit', EXIT_PAIR_KEY, 'flipped'),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'iron'
                }
            ]
        };
        const boardWithKeyPair: BoardState = {
            ...lockedBoard,
            tiles: [
                {
                    ...tile('key-a', 'key'),
                    dungeonCardKind: 'key',
                    dungeonKeyKind: 'iron'
                },
                {
                    ...tile('key-b', 'key'),
                    dungeonCardKind: 'key',
                    dungeonKeyKind: 'iron'
                },
                lockedBoard.tiles[2]!
            ]
        };

        expect(getRunShopStockPlan({ ...run, board: lockedBoard, dungeonKeys: { iron: 1 } }).itemIds[0]).not.toBe(
            'iron_key'
        );
        expect(
            getRunShopStockPlan({
                ...run,
                board: lockedBoard,
                dungeonKeys: { iron: Number.POSITIVE_INFINITY },
                dungeonMasterKeys: Number.NaN
            }).itemIds[0]
        ).toBe('iron_key');
        expect(getRunShopStockPlan({ ...run, board: boardWithKeyPair }).itemIds[0]).not.toBe('iron_key');
        expect(getRunShopStockPlan({ ...run, board: lockedBoard }).itemIds[0]).toBe('iron_key');
    });

    it('stocks typed key insurance for typed locked exits', () => {
        const run = makePlayingRun();
        const treasureLockedBoard: BoardState = {
            ...run.board!,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'treasure',
            tiles: [
                tile('a1', 'a'),
                tile('a2', 'a'),
                {
                    ...tile('exit', EXIT_PAIR_KEY, 'flipped'),
                    dungeonCardKind: 'exit',
                    dungeonExitLockKind: 'treasure'
                }
            ]
        };

        expect(getRunShopStockPlan({ ...run, board: treasureLockedBoard }).itemIds[0]).toBe('treasure_key');
        expect(
            getRunShopStockPlan({ ...run, board: treasureLockedBoard, dungeonKeys: { treasure: 1 } }).itemIds[0]
        ).not.toBe('treasure_key');

        const withOffers = {
            ...run,
            board: treasureLockedBoard,
            shopOffers: createRunShopOffers({ ...run, board: treasureLockedBoard })
        };

        expect(withOffers.shopOffers[0]).toMatchObject({
            itemId: 'treasure_key',
            label: 'Treasure key',
            compatible: true
        });
        expect(getRunShopReadModel(withOffers)).toMatchObject({
            offerCount: withOffers.shopOffers.length,
            availableOfferCount: expect.any(Number)
        });
    });

    it('biases shop stock by starting loadout without overriding locked-exit insurance', () => {
        const run = makePlayingRun();

        expect(getRunShopStockPlan({ ...run, startingLoadoutId: 'memory_scout' }).itemIds[0]).toBe('peek_charge');
        expect(getRunShopStockPlan({ ...run, startingLoadoutId: 'route_tactician' }).itemIds[0]).toBe('region_shuffle_charge');
        expect(getRunShopStockPlan({ ...run, startingLoadoutId: 'cursebreaker' }).itemIds.slice(0, 2)).toEqual([
            'destroy_charge',
            'trait_cleanse'
        ]);
        expect(getRunShopStockPlan({ ...run, startingLoadoutId: 'vaultbreaker' }).itemIds[0]).toBe('iron_key');
        expect(
            getRunShopStockPlan({
                ...run,
                startingLoadoutId: 'route_tactician',
                board: run.board
                    ? {
                          ...run.board,
                          dungeonExitLockKind: 'iron' as const,
                          tiles: run.board.tiles.map((candidate) =>
                              candidate.pairKey === EXIT_PAIR_KEY
                                  ? { ...candidate, dungeonExitLockKind: 'iron' as const }
                                  : candidate
                          )
                      }
                    : run.board
            }).itemIds[0]
        ).toBe('iron_key');
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

    it('keeps locked-exit and boss counterplay ahead of optional trait services', () => {
        const run = makePlayingRun();
        const board = buildBoard(6, { runSeed: 4242, runRulesVersion: run.runRulesVersion });
        const pressuredBoard = {
            ...board,
            columns: 2,
            floorTag: 'boss' as const,
            dungeonBossId: 'rush_sentinel' as const,
            dungeonExitLockKind: 'iron' as const,
            tiles: board.tiles.map((tile, index) =>
                index === 0
                    ? { ...tile, pairKey: 'echo', tileTraitKind: 'echo' as const }
                    : index === 1
                      ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                      : index === 2
                        ? { ...tile, pairKey: 'danger', tileTraitKind: 'cursed' as const }
                        : index === 3
                          ? { ...tile, pairKey: 'danger', tileTraitKind: 'cursed' as const }
                          : tile
            )
        };

        expect(getRunShopStockPlan({ ...run, board: pressuredBoard }).itemIds.slice(0, 4)).toEqual([
            'iron_key',
            'region_shuffle_charge',
            'trait_cleanse',
            'trait_routing_kit'
        ]);
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

    it('normalizes malformed shop offers for reads, rerolls, pacing, and purchases', () => {
        const run = {
            ...makePlayingRun(),
            shopGold: 10,
            shopOffers: Number.NaN as unknown as RunState['shopOffers']
        };

        expect(canRerollShopOffers(run)).toBe(false);
        expect(rerollShopOffers(run)).toBe(run);
        expect(purchaseShopOffer(run, 'missing')).toBe(run);
        expect(getRunShopReadModel(run)).toMatchObject({
            offerCount: 0,
            availableOfferCount: 0,
            purchasedOfferCount: 0,
            canReroll: false
        });
        expect(getShopWalletPacing(run).sinkCostTotal).toBe(0);
        expect(getRunShopWalletPacing(run).sinkCostTotal).toBe(0);
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

    it('normalizes malformed shop wallets before read models, rerolls, and purchases', () => {
        const fullLifeRun = { ...makePlayingRun(), lives: MAX_LIVES, shopGold: Number.NaN };
        const run = { ...fullLifeRun, shopOffers: createRunShopOffers(fullLifeRun) };
        const peek = run.shopOffers.find((offer) => offer.itemId === 'peek_charge')!;

        expect(getRunShopReadModel(run)).toMatchObject({
            availableOfferCount: 0,
            wallet: 0,
            canReroll: false
        });
        expect(getShopWalletPacing(run).totalWallet).toBe(0);
        expect(purchaseShopOffer(run, peek.id)).toBe(run);

        const funded = { ...run, shopGold: 10.9, shopRerolls: Number.NaN };
        const purchased = purchaseShopOffer(funded, peek.id);
        expect(purchased.shopGold).toBe(10 - peek.cost);
        expect(purchased.peekCharges).toBe(funded.peekCharges + 1);

        const rerolled = rerollShopOffers(funded);
        expect(rerolled.shopGold).toBe(10 - getShopRerollCostForFloor(funded.board!.level));
        expect(rerolled.shopRerolls).toBe(1);
    });

    it('normalizes malformed stat records before boardless shop level fallbacks', () => {
        const run = {
            ...makePlayingRun(),
            board: null,
            stats: Number.NaN as unknown as RunState['stats']
        };

        expect(getRunShopStockPlan(run)).toMatchObject({
            level: 1,
            rerollCost: getShopRerollCostForFloor(1)
        });
        expect(getShopWalletPacing(run).earnedThisFloor).toBe(getShopGoldRewardForFloor(1));
        expect(getRunShopWalletPacing(run).earnedThisFloor).toBe(getShopGoldRewardForFloor(1));
    });

    it('purchases typed key offers into matching run key inventory', () => {
        const run = { ...makePlayingRun(), shopGold: 10 };
        const offer = {
            ...SHOP_ITEM_CATALOG.treasure_key,
            id: 'typed-key-offer',
            purchased: false,
            compatible: true,
            unavailableReason: null
        };
        const purchased = purchaseShopOffer({ ...run, shopOffers: [offer] }, offer.id);

        expect(purchased.shopGold).toBe(run.shopGold - offer.cost);
        expect(purchased.dungeonKeys).toMatchObject({ treasure: 1 });
        expect(purchased.dungeonKeys.iron ?? 0).toBe(0);
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
        const safeBoard = {
            ...board,
            tiles: board.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
        };
        expect(purchaseShopOffer({ ...withShop, board: safeBoard }, cleanse.id)).toMatchObject({ board: safeBoard });
    });

    it('sells a trait routing kit only when trait adjacency can be exploited', () => {
        const board = buildBoard(4, { runSeed: 4242, runRulesVersion: makePlayingRun().runRulesVersion });
        const comboBoard = {
            ...board,
            columns: 2,
            tiles: board.tiles.map((tile, index) =>
                index === 0
                    ? { ...tile, pairKey: 'echo', tileTraitKind: 'echo' as const }
                    : index === 1
                      ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                      : tile
            )
        };
        const run = {
            ...makePlayingRun(),
            board: comboBoard,
            peekCharges: 0,
            regionShuffleCharges: 0,
            shopGold: 10
        };
        const withShop = { ...run, shopOffers: createRunShopOffers(run) };
        const kit = withShop.shopOffers.find((offer) => offer.itemId === 'trait_routing_kit')!;
        const routed = purchaseShopOffer(withShop, kit.id);

        expect(kit.compatible).toBe(true);
        expect(getRunShopStockPlan(run).previewCopy).toContain('Sealed Catalyst');
        expect(routed.shopGold).toBe(withShop.shopGold - kit.cost);
        expect(routed.peekCharges).toBe(1);
        expect(routed.regionShuffleCharges).toBe(1);

        const traitlessBoard = {
            ...board,
            tiles: board.tiles.map((tile) => ({ ...tile, tileTraitKind: undefined }))
        };
        const staleKit = withShop.shopOffers.find((offer) => offer.itemId === 'trait_routing_kit')!;
        const plainRun = { ...run, board: traitlessBoard, shopOffers: [staleKit] };
        const plainKit = plainRun.shopOffers[0]!;
        expect(plainKit.compatible).toBe(true);
        expect(purchaseShopOffer(plainRun, plainKit.id)).toBe(plainRun);
    });

    it('sells a trait routing kit when a tile swap would create a trait route', () => {
        const board = buildBoard(4, { runSeed: 4242, runRulesVersion: makePlayingRun().runRulesVersion });
        const swapSetupBoard = {
            ...board,
            level: 4,
            columns: 2,
            tiles: board.tiles.map((tile, index) =>
                index === 0
                    ? { ...tile, pairKey: 'sealed', tileTraitKind: 'sealed' as const }
                    : index === 1
                      ? { ...tile, pairKey: 'plain-a', tileTraitKind: undefined }
                      : index === 2
                        ? { ...tile, pairKey: 'plain-b', tileTraitKind: undefined }
                        : index === 3
                          ? { ...tile, pairKey: 'heavy', tileTraitKind: 'heavy' as const }
                          : { ...tile, tileTraitKind: undefined }
            )
        };
        const run = {
            ...makePlayingRun(),
            board: swapSetupBoard,
            peekCharges: 0,
            regionShuffleCharges: 0,
            shopGold: 10
        };
        const withShop = { ...run, shopOffers: createRunShopOffers(run) };
        const kit = withShop.shopOffers.find((offer) => offer.itemId === 'trait_routing_kit')!;
        const routed = purchaseShopOffer(withShop, kit.id);

        expect(kit.compatible).toBe(true);
        expect(getRunShopStockPlan(run).previewCopy).toContain('Trait routing: swap setup available');
        expect(routed.peekCharges).toBe(1);
        expect(routed.regionShuffleCharges).toBe(1);
    });

    it('rechecks compatibility when run state changes after offers were created', () => {
        const damaged = { ...makePlayingRun(), lives: MAX_LIVES - 1, shopGold: 10 };
        const heal = createRunShopOffers(damaged).find((offer) => offer.itemId === 'heal_life')!;
        const staleFullLifeRun = { ...damaged, lives: MAX_LIVES, shopOffers: [heal] };

        expect(heal.compatible).toBe(true);
        expect(purchaseShopOffer(staleFullLifeRun, heal.id)).toBe(staleFullLifeRun);
    });
});
