import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createRunShopOffers } from '../../shared/shop-rules';
import type { StoreNavigationTransition } from './navigationModel';
import {
    canOpenLevelCompleteShopSurface,
    canUseShopSurface,
    createShopCloseSurfaceResult,
    createLevelCompleteShopOpenSurfacePatch,
    createShopCloseSurfacePatch,
    createShopPurchaseSurfaceResult,
    createShopRerollSurfaceResult,
    createShopReturnModeResetPatch,
    shouldResumeShopRunOnClose
} from './shopSurfaceState';

const run = {
    id: 'run-1',
    lives: 1,
    status: 'levelComplete',
    relicOffer: null,
    shopOffers: [{ id: 'offer-1' }],
    sideRoom: null,
    timerState: {
        pausedFromStatus: null
    }
} as unknown as RunState;
const pausedFloorRun = {
    ...run,
    status: 'paused',
    timerState: {
        pausedFromStatus: 'playing'
    }
} as unknown as RunState;
const transition: StoreNavigationTransition = {
    kind: 'setView',
    view: 'playing'
};

const actionableShopRun = (): RunState => {
    const base = {
        ...createNewRun(0, { echoFeedbackEnabled: false, runSeed: 70_001 }),
        lives: 3,
        shopGold: 10,
        status: 'levelComplete' as const
    };
    return {
        ...base,
        shopOffers: createRunShopOffers(base)
    };
};

describe('shopSurfaceState', () => {
    it('only resumes floor-return shops with a run present', () => {
        expect(shouldResumeShopRunOnClose('floor', run)).toBe(true);
        expect(shouldResumeShopRunOnClose('summary', run)).toBe(false);
        expect(shouldResumeShopRunOnClose(null, run)).toBe(false);
        expect(shouldResumeShopRunOnClose('floor', null)).toBe(false);
    });

    it('allows opening level-complete shops only when the floor summary shop is ready', () => {
        expect(canOpenLevelCompleteShopSurface('playing', run)).toBe(true);
        expect(canOpenLevelCompleteShopSurface('shop', run)).toBe(false);
        expect(canOpenLevelCompleteShopSurface('playing', null)).toBe(false);
        expect(canOpenLevelCompleteShopSurface('playing', { ...run, status: 'playing' } as unknown as RunState)).toBe(
            false
        );
        expect(canOpenLevelCompleteShopSurface('playing', { ...run, lives: 0 } as unknown as RunState)).toBe(false);
        expect(
            canOpenLevelCompleteShopSurface('playing', { ...run, relicOffer: { id: 'offer' } } as unknown as RunState)
        ).toBe(false);
        expect(
            canOpenLevelCompleteShopSurface('playing', { ...run, sideRoom: { id: 'room' } } as unknown as RunState)
        ).toBe(false);
        expect(canOpenLevelCompleteShopSurface('playing', { ...run, shopOffers: [] } as unknown as RunState)).toBe(
            false
        );
    });

    it('allows shop actions for level-complete shops and paused floor-return shops', () => {
        expect(canUseShopSurface('shop', run, 'summary')).toBe(true);
        expect(canUseShopSurface('shop', pausedFloorRun, 'floor')).toBe(true);
    });

    it('blocks shop actions outside the usable shop surface', () => {
        expect(canUseShopSurface('playing', run, 'summary')).toBe(false);
        expect(canUseShopSurface('shop', null, 'summary')).toBe(false);
        expect(canUseShopSurface('shop', { ...run, lives: 0 } as unknown as RunState, 'summary')).toBe(false);
        expect(canUseShopSurface('shop', pausedFloorRun, 'summary')).toBe(false);
        expect(
            canUseShopSurface(
                'shop',
                {
                    ...pausedFloorRun,
                    timerState: {
                        pausedFromStatus: null
                    }
                } as unknown as RunState,
                'floor'
            )
        ).toBe(false);
    });

    it('builds a level-complete shop open patch in summary-return mode', () => {
        expect(createLevelCompleteShopOpenSurfacePatch({ kind: 'setView', view: 'shop' })).toEqual({
            view: 'shop',
            shopReturnMode: 'summary'
        });
    });

    it('builds a shop close patch that clears the return mode', () => {
        expect(createShopCloseSurfacePatch(transition, run)).toEqual({
            view: 'playing',
            run,
            shopReturnMode: null
        });
    });

    it('normalizes missing runs on close', () => {
        expect(createShopCloseSurfacePatch({ kind: 'setView', view: 'menu' }, undefined)).toEqual({
            view: 'menu',
            run: null,
            shopReturnMode: null
        });
    });

    it('builds a shop return-mode reset patch for game-over resolution', () => {
        expect(createShopReturnModeResetPatch()).toEqual({
            shopReturnMode: null
        });
    });

    it('routes shop close to game over when the resumed run has ended', () => {
        const gameOverRun = { ...run, status: 'gameOver' } as unknown as RunState;

        expect(createShopCloseSurfaceResult(transition, gameOverRun)).toEqual({
            kind: 'gameOver',
            patch: { shopReturnMode: null },
            run: gameOverRun
        });
    });

    it('routes shop close to the normal close patch otherwise', () => {
        expect(createShopCloseSurfaceResult(transition, run)).toEqual({
            kind: 'closed',
            patch: {
                view: 'playing',
                run,
                shopReturnMode: null
            }
        });
    });

    it('applies shop purchases only on a usable shop surface', () => {
        const shopRun = actionableShopRun();
        const offer = shopRun.shopOffers.find((item) => item.itemId === 'peek_charge')!;

        expect(createShopPurchaseSurfaceResult({
            offerId: offer.id,
            run: shopRun,
            shopReturnMode: 'summary',
            view: 'playing'
        })).toEqual({ kind: 'ignored' });

        const result = createShopPurchaseSurfaceResult({
            offerId: offer.id,
            run: shopRun,
            shopReturnMode: 'summary',
            view: 'shop'
        });

        expect(result.kind).toBe('applied');
        if (result.kind !== 'applied') {
            return;
        }
        expect(result.patch.run.peekCharges).toBe(shopRun.peekCharges + 1);
        expect(result.patch.run.shopGold).toBe(shopRun.shopGold - offer.cost);
        expect(result.patch.run.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'shop.purchase', offerId: offer.id })
        ]);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'shop.offer_purchased', offerId: offer.id }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'shop.offer.purchased' })
        ]));
        expect(createShopPurchaseSurfaceResult({
            offerId: 'missing-offer',
            run: shopRun,
            shopReturnMode: 'summary',
            view: 'shop'
        })).toEqual({ kind: 'ignored' });
    });

    it('applies shop rerolls only on a usable shop surface', () => {
        const shopRun = actionableShopRun();

        expect(createShopRerollSurfaceResult({
            run: null,
            shopReturnMode: 'summary',
            view: 'shop'
        })).toEqual({ kind: 'ignored' });

        const result = createShopRerollSurfaceResult({
            run: shopRun,
            shopReturnMode: 'summary',
            view: 'shop'
        });

        expect(result.kind).toBe('applied');
        if (result.kind !== 'applied') {
            return;
        }
        expect(result.patch.run.shopRerolls).toBe(shopRun.shopRerolls + 1);
        expect(result.patch.run.shopGold).toBeLessThan(shopRun.shopGold);
        expect(result.patch.run.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'shop.reroll' })
        ]);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'shop.stock_rerolled' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'shop.stock.rerolled' })
        ]);
        expect(result.feedback).toMatchObject({
            audioCategory: 'shop-reroll',
            cue: 'shop.stock.rerolled'
        });
        expect(createShopRerollSurfaceResult({
            run: result.patch.run,
            shopReturnMode: 'summary',
            view: 'shop'
        })).toEqual({ kind: 'ignored' });
    });
});
