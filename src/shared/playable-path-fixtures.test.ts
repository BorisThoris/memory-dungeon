import { describe, expect, it } from 'vitest';
import {
    createFinalizedGameOverPlayablePathRun,
    createPlayablePathFixture,
    PLAYABLE_PATH_FIXTURE_IDS,
    type PlayablePathFixtureId
} from './playable-path-fixtures';
import { createNewRun, finishMemorizePhase } from './game-core';
import {
    applyRouteChoiceOutcome,
    openRouteSideRoom
} from './route-rules';
import {
    purchaseShopOffer,
    rerollShopOffers
} from './game';

describe('playable path fixtures', () => {
    it('builds every fixture deterministically', () => {
        const firstPass = PLAYABLE_PATH_FIXTURE_IDS.map((id) => createPlayablePathFixture(id));
        const secondPass = PLAYABLE_PATH_FIXTURE_IDS.map((id) => createPlayablePathFixture(id));

        expect(firstPass).toEqual(secondPass);
    });

    it.each([
        ['freshProfile', 'menu', null],
        ['activeRunWithHazards', 'playing', 'playing'],
        ['activeRunWithPickupCashout', 'playing', 'playing'],
        ['activeRunWithTraitRouteSetup', 'playing', 'playing'],
        ['floorClearWithRouteChoices', 'playing', 'levelComplete'],
        ['floorClearWithShop', 'playing', 'levelComplete'],
        ['floorClearWithShopLowGold', 'playing', 'levelComplete'],
        ['sideRoomPrimary', 'sideRoom', 'levelComplete'],
        ['sideRoomChoice', 'sideRoom', 'levelComplete'],
        ['sideRoomSkip', 'sideRoom', 'levelComplete'],
        ['sideRoomThenShop', 'sideRoom', 'levelComplete'],
        ['relicDraft', 'playing', 'levelComplete'],
        ['gameOver', 'gameOver', 'gameOver']
    ] satisfies [PlayablePathFixtureId, string, string | null][])(
        '%s exposes the expected view/run status',
        (id, view, status) => {
            const fixture = createPlayablePathFixture(id);

            expect(fixture.view).toBe(view);
            expect(fixture.run?.status ?? null).toBe(status);
            expect(fixture.saveData.schemaVersion).toBeGreaterThan(0);
        }
    );

    it('creates route, shop, side-room, relic, and post-run scenario invariants', () => {
        const routeFixture = createPlayablePathFixture('floorClearWithRouteChoices');
        expect(routeFixture.run?.lastLevelResult?.routeChoices?.map((choice) => choice.routeType)).toEqual([
            'safe',
            'greed',
            'mystery'
        ]);

        const shopFixture = createPlayablePathFixture('floorClearWithShop');
        expect(shopFixture.run?.shopGold).toBeGreaterThan(0);
        expect(shopFixture.run?.shopOffers.length).toBeGreaterThan(0);
        expect(shopFixture.run?.shopOffers.some((offer) => offer.compatible)).toBe(true);

        const lowGoldShopFixture = createPlayablePathFixture('floorClearWithShopLowGold');
        expect(lowGoldShopFixture.run?.shopGold).toBe(0);
        expect(lowGoldShopFixture.run?.shopOffers.some((offer) => offer.compatible && offer.cost > 0)).toBe(true);

        expect(createPlayablePathFixture('sideRoomPrimary').run?.sideRoom?.kind).toBe('rest_shrine');
        expect(createPlayablePathFixture('sideRoomChoice').run?.sideRoom?.kind).toBe('run_event');
        expect(createPlayablePathFixture('sideRoomSkip').run?.sideRoom?.kind).toBe('bonus_reward');

        const sideRoomThenShop = createPlayablePathFixture('sideRoomThenShop');
        expect(sideRoomThenShop.run?.sideRoom).not.toBeNull();
        expect(sideRoomThenShop.run?.shopOffers.length).toBeGreaterThan(0);

        const relicFixture = createPlayablePathFixture('relicDraft');
        expect(relicFixture.run?.relicOffer?.options.length).toBeGreaterThan(0);

        const gameOverFixture = createPlayablePathFixture('gameOver');
        expect(gameOverFixture.run?.lastRunSummary).not.toBeNull();
        expect(gameOverFixture.run?.gameplayCommandJournal?.at(-1)?.type).toBe('run.finalize');
        expect(gameOverFixture.run?.gameplayEventJournal?.at(-1)?.type).toBe('run.finalized');
        expect(gameOverFixture.run?.lastRunSummary?.gameplayCommandJournal).toEqual(
            gameOverFixture.run?.gameplayCommandJournal
        );
        expect(gameOverFixture.run?.lastRunSummary?.gameplayEventJournal).toEqual(
            gameOverFixture.run?.gameplayEventJournal
        );

        const pickupFixture = createPlayablePathFixture('activeRunWithPickupCashout');
        expect(pickupFixture.run?.findablesTotalThisFloor).toBe(1);
        expect(pickupFixture.run?.board?.tiles.filter((tile) => tile.findableKind === 'shard_spark')).toHaveLength(2);
        expect(pickupFixture.run?.stats.currentStreak).toBe(0);
        expect(pickupFixture.run?.stats.comboShards).toBeGreaterThan(0);
    });

    it('finalizes a forced post-run fixture deterministically without mutating its live input', () => {
        const liveRun = finishMemorizePhase(createNewRun(0, { runSeed: 712_004 }));
        const startingLives = liveRun.lives;

        const first = createFinalizedGameOverPlayablePathRun(liveRun);
        const second = createFinalizedGameOverPlayablePathRun(liveRun);

        expect(first).toEqual(second);
        expect(liveRun).toMatchObject({ lives: startingLives, status: 'playing', lastRunSummary: null });
        expect(first).toMatchObject({ lives: 0, status: 'gameOver' });
        expect(first.gameplayCommandJournal?.at(-1)).toMatchObject({
            type: 'run.finalize',
            unlockedAchievements: []
        });
        expect(first.gameplayEventJournal?.at(-1)).toMatchObject({
            type: 'run.finalized',
            summaryValidated: true,
            unlockedAchievements: []
        });
        expect(first.lastRunSummary?.gameplayCommandJournal).toEqual(first.gameplayCommandJournal);
        expect(first.lastRunSummary?.gameplayEventJournal).toEqual(first.gameplayEventJournal);
    });

    it.each([
        ['safe', 'bonus_reward', 'rest'],
        ['greed', 'bonus_reward', 'treasure'],
        ['mystery', 'run_event', 'event']
    ] as const)('locks %s route into a deterministic stamped side room', (routeType, kind, nodeKind) => {
        const fixture = createPlayablePathFixture('floorClearWithRouteChoices');
        const choice = fixture.run?.lastLevelResult?.routeChoices?.find((item) => item.routeType === routeType);
        expect(choice).toBeDefined();

        const chosen = applyRouteChoiceOutcome(fixture.run!, choice!.id);
        expect(chosen.applied).toBe(true);
        expect(chosen.run.pendingRouteCardPlan?.routeType).toBe(routeType);

        const opened = openRouteSideRoom(chosen.run);
        expect(opened.sideRoom).toMatchObject({
            routeType,
            kind,
            nodeKind
        });
    });

    it('covers deterministic shop purchase, blocked buy, reroll, and continue preconditions', () => {
        const shopFixture = createPlayablePathFixture('floorClearWithShop');
        const availableOffer = shopFixture.run!.shopOffers.find(
            (offer) => offer.compatible && !offer.purchased && offer.cost <= shopFixture.run!.shopGold
        );
        expect(availableOffer).toBeDefined();

        const purchased = purchaseShopOffer(shopFixture.run!, availableOffer!.id);
        expect(purchased.shopGold).toBe(shopFixture.run!.shopGold - availableOffer!.cost);
        expect(purchased.shopOffers.find((offer) => offer.id === availableOffer!.id)?.purchased).toBe(true);

        const lowGoldFixture = createPlayablePathFixture('floorClearWithShopLowGold');
        const blockedOffer = lowGoldFixture.run!.shopOffers.find((offer) => offer.compatible && offer.cost > 0);
        expect(blockedOffer).toBeDefined();
        const blocked = purchaseShopOffer(lowGoldFixture.run!, blockedOffer!.id);
        expect(blocked.shopGold).toBe(0);
        expect(blocked.shopOffers.find((offer) => offer.id === blockedOffer!.id)?.purchased).toBe(false);

        const rerolled = rerollShopOffers(shopFixture.run!);
        expect(rerolled.shopRerolls).toBe(1);
        expect(rerolled.shopOffers.map((offer) => offer.id)).not.toEqual(
            shopFixture.run!.shopOffers.map((offer) => offer.id)
        );
        expect(rerolled.status).toBe('levelComplete');
    });
});
