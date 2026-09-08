import { describe, expect, it } from 'vitest';
import {
    createPlayablePathFixture,
    PLAYABLE_PATH_FIXTURE_IDS,
    type PlayablePathFixtureId
} from './playable-path-fixtures';
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

    it('creates floor-clear, shop, relic, and post-run scenario invariants', () => {
        // The floor-clear fixture kept its id but no longer offers routes: a cleared floor has one
        // way forward now (Gen 173).
        const routeFixture = createPlayablePathFixture('floorClearWithRouteChoices');
        expect(routeFixture.run?.status).toBe('levelComplete');
        expect(routeFixture.run?.lastLevelResult?.routeChoices).toBeUndefined();
        expect(routeFixture.run?.sideRoom).toBeNull();

        const shopFixture = createPlayablePathFixture('floorClearWithShop');
        expect(shopFixture.run?.shopGold).toBeGreaterThan(0);
        expect(shopFixture.run?.shopOffers.length).toBeGreaterThan(0);
        expect(shopFixture.run?.shopOffers.some((offer) => offer.compatible)).toBe(true);

        const lowGoldShopFixture = createPlayablePathFixture('floorClearWithShopLowGold');
        expect(lowGoldShopFixture.run?.shopGold).toBe(0);
        expect(lowGoldShopFixture.run?.shopOffers.some((offer) => offer.compatible && offer.cost > 0)).toBe(true);

        const relicFixture = createPlayablePathFixture('relicDraft');
        expect(relicFixture.run?.relicOffer?.options.length).toBeGreaterThan(0);

        const gameOverFixture = createPlayablePathFixture('gameOver');
        expect(gameOverFixture.run?.lastRunSummary).not.toBeNull();

        const pickupFixture = createPlayablePathFixture('activeRunWithPickupCashout');
        expect(pickupFixture.run?.findablesTotalThisFloor).toBe(1);
        expect(pickupFixture.run?.board?.tiles.filter((tile) => tile.findableKind === 'shard_spark')).toHaveLength(2);
        expect(pickupFixture.run?.stats.currentStreak).toBe(0);
        expect(pickupFixture.run?.stats.comboShards).toBeGreaterThan(0);
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
