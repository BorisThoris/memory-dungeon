import { describe, expect, it } from 'vitest';
import { MAX_GUARD_TOKENS, MAX_LIVES, type RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import { createRestShrineServices, getRestShrineReadModel, purchaseRestShrineService } from './rest-shrine';

describe('REG-073 rest shrine services', () => {
    it('exposes safe heal and risk bargain services with clear failure paths', () => {
        const run = { ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })), shopGold: 5, lives: MAX_LIVES };
        const servicesAtFull = createRestShrineServices(run);
        const healFull = servicesAtFull.find((service) => service.serviceId === 'rest_heal')!;
        expect(healFull.available).toBe(false);
        expect(healFull.unavailableReason).toBe('Life already full.');

        const damaged = { ...run, lives: 3 };
        const services = createRestShrineServices(damaged);
        const heal = services.find((service) => service.serviceId === 'rest_heal')!;
        const guard = services.find((service) => service.serviceId === 'guard_focus')!;
        const bargain = services.find((service) => service.serviceId === 'shrine_bargain')!;
        const ward = services.find((service) => service.serviceId === 'boss_ward')!;

        expect(getRestShrineReadModel(damaged, services)).toMatchObject({
            serviceCount: 4,
            availableCount: 4,
            affordableCount: 4,
            purchasedCount: 0
        });

        const healed = purchaseRestShrineService(damaged, services, heal.id);
        expect(healed.lives).toBe(4);
        expect(healed.shopGold).toBe(damaged.shopGold - heal.cost);
        expect(healed.services.find((service) => service.id === heal.id)?.purchased).toBe(true);

        const guarded = purchaseRestShrineService(damaged, services, guard.id);
        expect(guarded.run.stats.guardTokens).toBe(damaged.stats.guardTokens + 1);
        expect(guarded.shopGold).toBe(damaged.shopGold - guard.cost);

        const favored = purchaseRestShrineService(damaged, services, bargain.id);
        expect(favored.relicFavorProgress).toBe(damaged.relicFavorProgress + 1);
        expect(favored.shopGold).toBe(damaged.shopGold - bargain.cost);

        const warded = purchaseRestShrineService(damaged, services, ward.id);
        expect(warded.run.dungeonMasterKeys).toBe(damaged.dungeonMasterKeys + 1);
        expect(warded.shopGold).toBe(damaged.shopGold - ward.cost);

        const brokeRun = { ...damaged, shopGold: 0 };
        const broke = purchaseRestShrineService(brokeRun, services, bargain.id);
        expect(broke.run).toBe(brokeRun);
    });

    it('bounds capped services and one-shot purchases per service list', () => {
        const capped = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            shopGold: 10,
            lives: MAX_LIVES,
            dungeonMasterKeys: 1
        };
        const cappedRun = { ...capped, stats: { ...capped.stats, guardTokens: MAX_GUARD_TOKENS } };
        const services = createRestShrineServices(cappedRun);

        expect(services.find((service) => service.serviceId === 'rest_heal')).toMatchObject({
            available: false,
            unavailableReason: 'Life already full.'
        });
        expect(services.find((service) => service.serviceId === 'guard_focus')).toMatchObject({
            available: false,
            unavailableReason: 'Guard bank full.'
        });
        expect(services.find((service) => service.serviceId === 'boss_ward')).toMatchObject({
            available: false,
            unavailableReason: 'Master key already held.'
        });

        const bargain = services.find((service) => service.serviceId === 'shrine_bargain')!;
        const bought = purchaseRestShrineService(cappedRun, services, bargain.id);
        const duplicate = purchaseRestShrineService(bought.run, bought.services, bargain.id);
        expect(duplicate.purchased).toBe(false);
        expect(duplicate.reason).toBe('sold_out');
        expect(duplicate.run.shopGold).toBe(bought.run.shopGold);
    });

    it('normalizes malformed shrine wallets and reward counters before purchase', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            shopGold: 3.9,
            lives: 3.8,
            relicFavorProgress: Number.POSITIVE_INFINITY,
            bonusRelicPicksNextOffer: Number.NaN,
            favorBonusRelicPicksNextOffer: -2,
            stats: {
                ...createNewRun(0).stats,
                guardTokens: Number.POSITIVE_INFINITY
            }
        };
        const services = createRestShrineServices(run);
        const heal = services.find((service) => service.serviceId === 'rest_heal')!;
        const guard = services.find((service) => service.serviceId === 'guard_focus')!;
        const bargain = services.find((service) => service.serviceId === 'shrine_bargain')!;

        expect(getRestShrineReadModel({ ...run, shopGold: Number.NaN }, services).previewCopy).toContain('0 shop gold');

        const healed = purchaseRestShrineService(run, services, heal.id);
        expect(healed.run.shopGold).toBe(1);
        expect(healed.run.lives).toBe(4);

        const guarded = purchaseRestShrineService(run, services, guard.id);
        expect(guarded.run.shopGold).toBe(2);
        expect(guarded.run.stats.guardTokens).toBe(1);

        const favored = purchaseRestShrineService(run, services, bargain.id);
        expect(favored.run.shopGold).toBe(0);
        expect(favored.run.relicFavorProgress).toBe(1);
        expect(favored.run.bonusRelicPicksNextOffer).toBe(0);
        expect(favored.run.favorBonusRelicPicksNextOffer).toBe(0);
    });

    it('normalizes malformed stat records before service availability and ids', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            board: null,
            stats: Number.NaN as unknown as RunState['stats']
        };
        const services = createRestShrineServices(run);

        expect(services.find((service) => service.serviceId === 'guard_focus')).toMatchObject({
            available: true,
            unavailableReason: null
        });
        expect(services[0]?.id).toContain(':1:rest:0');
    });
});
