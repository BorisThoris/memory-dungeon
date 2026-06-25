import { describe, expect, it } from 'vitest';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import { openRelicOffer } from '../../shared/game-core';
import { isSingletonUtilityPairKey } from '../../shared/tile-identity';
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

    it('repairs stale boss hazards before returning a relic-offer continuation patch', () => {
        const baseRun = createPlayablePathFixture('relicDraft').run!;
        const pairKey = baseRun.board!.tiles.find((tile) => !isSingletonUtilityPairKey(tile.pairKey))!.pairKey;
        const pairTiles = baseRun.board!.tiles.filter((tile) => tile.pairKey === pairKey).slice(0, 2);
        const staleBossBoard = {
            ...baseRun.board!,
            dungeonBossId: 'trap_warden' as const,
            enemyHazards: [
                {
                    bossId: 'trap_warden' as const,
                    currentTileId: pairTiles[0]!.id,
                    damage: 1,
                    hp: 1,
                    id: 'stale-warden',
                    kind: 'warden' as const,
                    label: 'Stale Warden',
                    maxHp: 1,
                    nextTileId: pairTiles[1]!.id,
                    pattern: 'guard' as const,
                    state: 'revealed' as const
                }
            ],
            tiles: baseRun.board!.tiles.map((tile) =>
                isSingletonUtilityPairKey(tile.pairKey) ? tile : { ...tile, state: 'matched' as const }
            )
        };
        const result = createLevelCompleteContinuationSurfaceResult(
            {
                ...baseRun,
                board: staleBossBoard,
                dungeonEnemiesDefeated: 0,
                dungeonEnemiesDefeatedThisFloor: 0,
                enemyHazardsDefeatedThisFloor: 0,
                relicFavorProgress: 0,
                relicOffer: null
            },
            { includeSummaryShop: false }
        );

        expect(result.kind).toBe('relicOffer');
        if (result.kind === 'relicOffer') {
            expect(result.patch.run.board?.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
            expect(result.patch.run.dungeonEnemiesDefeated).toBe(1);
            expect(result.patch.run.enemyHazardsDefeatedThisFloor).toBe(1);
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
