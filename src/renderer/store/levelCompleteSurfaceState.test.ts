import { describe, expect, it } from 'vitest';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import { openRelicOffer } from '../../shared/game-core';
import {
    createLevelCompleteContinuationSurfaceResult,
    shouldPrepareMemorizeTimerForContinuation
} from './levelCompleteSurfaceState';

describe('levelCompleteSurfaceState', () => {
    it('routes side-room runs to the side-room view and clears board interaction surface', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;
        const result = createLevelCompleteContinuationSurfaceResult(run, { includeSummaryShop: false });

        expect(result.kind).toBe('sideRoom');
        expect(result).toMatchObject({
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                matchScorePop: null,
                mismatchScorePop: null,
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run,
                view: 'sideRoom'
            }
        });
        expect(shouldPrepareMemorizeTimerForContinuation(result)).toBe(false);
    });

    it('routes summary-shop runs to the shop only when requested', () => {
        const run = createPlayablePathFixture('sideRoomThenShop').run!;
        const result = createLevelCompleteContinuationSurfaceResult(
            { ...run, sideRoom: null },
            { includeSummaryShop: true }
        );

        expect(result.kind).toBe('shop');
        expect(result).toMatchObject({
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                matchScorePop: null,
                mismatchScorePop: null,
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: { shopOffers: run.shopOffers },
                shopReturnMode: 'summary',
                view: 'shop'
            }
        });
    });

    it('opens a pending relic offer before advancing to the next floor', () => {
        const run = {
            ...createPlayablePathFixture('relicDraft').run!,
            relicOffer: null,
            relicFavorProgress: 0
        };
        const result = createLevelCompleteContinuationSurfaceResult(run, { includeSummaryShop: false });

        expect(result.kind).toBe('relicOffer');
        expect(result).toMatchObject({
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                matchScorePop: null,
                mismatchScorePop: null,
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                view: 'playing'
            }
        });
        if (result.kind === 'relicOffer') {
            expect(result.patch.run.relicOffer).not.toBeNull();
        }
    });

    it('keeps an existing relic offer as a run-only patch', () => {
        const run = openRelicOffer(createPlayablePathFixture('relicDraft').run!);
        const result = createLevelCompleteContinuationSurfaceResult(run, { includeSummaryShop: false });

        expect(result).toEqual({
            kind: 'runOnly',
            patch: { run }
        });
    });

    it('advances normal completed floors to the next level and requests memorize timer setup', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const result = createLevelCompleteContinuationSurfaceResult(run, { includeSummaryShop: false });

        expect(result.kind).toBe('nextLevel');
        expect(shouldPrepareMemorizeTimerForContinuation(result)).toBe(true);
        if (result.kind === 'nextLevel') {
            expect(result.patch).toMatchObject({
                boardPinMode: false,
                destroyPairArmed: false,
                matchScorePop: null,
                mismatchScorePop: null,
                newlyUnlockedAchievements: [],
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: result.run,
                view: 'playing'
            });
            expect(result.run.status).toBe('memorize');
        }
    });
});
