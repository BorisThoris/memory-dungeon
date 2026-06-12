import { describe, expect, it } from 'vitest';
import type { RunShopOfferState, RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import {
    createDeadInterludeGameOverRun,
    createSideRoomActionSurfaceResult,
    createSideRoomResultSurfacePatch,
    shouldContinueAfterSideRoomResult
} from './sideRoomSurfaceState';

const offer = (): RunShopOfferState => ({
    baseCost: 1,
    category: 'consumable',
    compatible: true,
    compatibleWhen: 'owned',
    cost: 1,
    description: 'Test offer',
    id: 'test-offer',
    itemId: 'heal_life',
    label: 'Heal',
    maxStock: 1,
    purchased: false,
    stackLimit: null,
    stock: 1,
    unavailableReason: null
});

describe('sideRoomSurfaceState', () => {
    it('returns to playing when a side-room result has no shop offers', () => {
        const run = { ...createNewRun(0), shopOffers: [] };
        const patch = createSideRoomResultSurfacePatch(run);

        expect(patch).toEqual({ run, view: 'playing' });
        expect(shouldContinueAfterSideRoomResult(patch)).toBe(true);
    });

    it('routes to the summary shop and clears armed board surface state when offers are present', () => {
        const run: RunState = { ...createNewRun(0), shopOffers: [offer()] };
        const patch = createSideRoomResultSurfacePatch(run);

        expect(patch).toMatchObject({
            boardPinMode: false,
            destroyPairArmed: false,
            matchScorePop: null,
            mismatchScorePop: null,
            peekModeArmed: false,
            run,
            shopReturnMode: 'summary',
            view: 'shop'
        });
        expect(shouldContinueAfterSideRoomResult(patch)).toBe(false);
    });

    it('ignores side-room actions outside the side-room view', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;

        expect(createSideRoomActionSurfaceResult('playing', run, () => run)).toEqual({ kind: 'ignored' });
    });

    it('routes missing side-room run state back to menu', () => {
        expect(createSideRoomActionSurfaceResult('sideRoom', null, (run) => run)).toEqual({
            kind: 'menu',
            patch: { view: 'menu' }
        });
    });

    it('routes invalid side-room run state back to playing', () => {
        const run = createNewRun(0);

        expect(createSideRoomActionSurfaceResult('sideRoom', run, () => run)).toEqual({
            kind: 'playing',
            patch: { view: 'playing' }
        });
    });

    it('creates a normalized game-over run for dead side-room interludes', () => {
        const run = {
            ...createPlayablePathFixture('sideRoomPrimary').run!,
            lives: 0
        };

        expect(createDeadInterludeGameOverRun(run)).toMatchObject({
            lives: 0,
            pendingRouteCardPlan: null,
            relicOffer: null,
            shopOffers: [],
            sideRoom: null,
            status: 'gameOver'
        });
        expect(createSideRoomActionSurfaceResult('sideRoom', run, () => run)).toMatchObject({
            kind: 'gameOver',
            run: {
                sideRoom: null,
                status: 'gameOver'
            }
        });
    });

    it('returns an applied patch and continuation flag for successful side-room actions', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;
        const nextRun = { ...run, sideRoom: null, shopOffers: [] };
        const result = createSideRoomActionSurfaceResult('sideRoom', run, () => nextRun);

        expect(result).toEqual({
            continueAfterPatch: true,
            kind: 'applied',
            patch: {
                run: nextRun,
                view: 'playing'
            }
        });
    });

    it('returns an applied patch without continuation when a side-room result opens the summary shop', () => {
        const run = createPlayablePathFixture('sideRoomThenShop').run!;
        const nextRun = { ...run, sideRoom: null };
        const result = createSideRoomActionSurfaceResult('sideRoom', run, () => nextRun);

        expect(result).toMatchObject({
            continueAfterPatch: false,
            kind: 'applied',
            patch: {
                shopReturnMode: 'summary',
                view: 'shop'
            }
        });
    });
});
