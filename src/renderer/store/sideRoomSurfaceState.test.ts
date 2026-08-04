import { describe, expect, it } from 'vitest';
import type { RunShopOfferState, RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import {
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
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            run,
            shopReturnMode: 'summary',
            view: 'shop'
        });
        expect(shouldContinueAfterSideRoomResult(patch)).toBe(false);
    });

    it('ignores side-room actions outside the side-room view', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;

        expect(createSideRoomActionSurfaceResult('playing', run, 'skip')).toEqual({ kind: 'ignored' });
    });

    it('routes missing side-room run state back to menu', () => {
        expect(createSideRoomActionSurfaceResult('sideRoom', null, 'skip')).toEqual({
            kind: 'menu',
            patch: { view: 'menu' }
        });
    });

    it('routes invalid side-room run state back to playing', () => {
        const run = createNewRun(0);

        expect(createSideRoomActionSurfaceResult('sideRoom', run, 'skip')).toEqual({
            kind: 'playing',
            patch: { view: 'playing' }
        });
    });

    it('creates a normalized game-over run for dead side-room interludes', () => {
        const run = {
            ...createPlayablePathFixture('sideRoomPrimary').run!,
            lives: 0
        };

        expect(createSideRoomActionSurfaceResult('sideRoom', run, 'skip')).toMatchObject({
            kind: 'gameOver',
            run: {
                gameplayCommandJournal: expect.arrayContaining([
                    expect.objectContaining({ type: 'run.interlude_terminal_resolve' })
                ]),
                gameplayEventJournal: expect.arrayContaining([
                    expect.objectContaining({ type: 'run.interlude_terminal_resolved' }),
                    expect.objectContaining({ type: 'feedback.requested', cue: 'run.interlude.terminal' })
                ]),
                lives: 0,
                pendingRouteCardPlan: null,
                relicOffer: null,
                shopOffers: [],
                sideRoom: null,
                status: 'gameOver'
            }
        });
    });

    it('returns an applied patch and continuation flag for successful side-room actions', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;
        const result = createSideRoomActionSurfaceResult('sideRoom', run, 'claim');

        expect(result).toMatchObject({
            continueAfterPatch: true,
            feedback: { audioCategory: 'side-room', cue: 'side_room.rest_healed' },
            kind: 'applied',
            patch: {
                run: {
                    sideRoom: null,
                    gameplayCommandJournal: expect.arrayContaining([
                        expect.objectContaining({ type: 'side_room.resolve', action: 'claim' })
                    ]),
                    gameplayEventJournal: expect.arrayContaining([
                        expect.objectContaining({ type: 'side_room.resolved', outcome: 'rest_healed' })
                    ])
                },
                view: 'playing'
            }
        });
    });

    it('returns an applied patch without continuation when a side-room result opens the summary shop', () => {
        const run = createPlayablePathFixture('sideRoomThenShop').run!;
        const result = createSideRoomActionSurfaceResult('sideRoom', run, 'skip');

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
