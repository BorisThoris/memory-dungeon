import { describe, expect, it } from 'vitest';
import type { BoardState, RunShopOfferState, RunState } from '../../shared/contracts';
import { buildBoard } from '../../shared/board-generation';
import { EXIT_PAIR_KEY, SHOP_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { createPlayingTilePressSurfaceResult } from './tilePressController';

const offer = (): RunShopOfferState => ({
    id: 'offer-heal',
    itemId: 'heal_life',
    category: 'consumable',
    label: 'Heal',
    description: 'Restore a life.',
    cost: 2,
    baseCost: 2,
    stock: 1,
    maxStock: 1,
    stackLimit: null,
    compatibleWhen: 'owned',
    compatible: true,
    unavailableReason: null,
    purchased: false
});

const playingRun = (overrides: Partial<RunState> = {}): RunState => ({
    ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 57 })),
    status: 'playing',
    ...overrides
});

describe('tile press controller', () => {
    it('creates a patch and flip audio cue for ordinary tile flips', () => {
        const run = playingRun();
        const tile = run.board!.tiles[0]!;

        const result = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileId: tile.id
        });

        expect(result.kind).toBe('patch');
        if (result.kind === 'patch') {
            expect(result.patch.run?.board?.flippedTileIds).toEqual([tile.id]);
            expect(result.patch.boardPinMode).toBe(false);
            expect(result.audio).toEqual([{ kind: 'flip' }]);
            expect(result.resolveDelayMs).toBeNull();
        }
    });

    it('routes dungeon exits to an exit prompt patch', () => {
        const run = playingRun();
        const exitTile = run.board!.tiles[0]!;
        const board: BoardState = {
            ...run.board!,
            tiles: run.board!.tiles.map((tile) =>
                tile.id === exitTile.id ? { ...tile, pairKey: EXIT_PAIR_KEY, dungeonCardState: 'hidden' } : tile
            )
        };

        const result = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run: { ...run, board },
            tileId: exitTile.id
        });

        expect(result.kind).toBe('patch');
        if (result.kind === 'patch') {
            expect(result.patch.dungeonExitPromptOpen).toBe(true);
            expect(result.patch.run?.board?.tiles.find((tile) => tile.id === exitTile.id)).toMatchObject({
                state: 'flipped',
                dungeonCardState: 'revealed'
            });
            expect(result.audio).toEqual([{ kind: 'flip' }]);
        }
    });

    it('routes dungeon shops to the shop surface patch', () => {
        const runSeed = 58;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'shop',
            gameMode: 'endless'
        });
        const shopTile = board.tiles.find((tile) => tile.pairKey === SHOP_PAIR_KEY)!;
        const run = playingRun({ board, runSeed, shopOffers: [offer()] });

        const result = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileId: shopTile.id
        });

        expect(result.kind).toBe('patch');
        if (result.kind === 'patch') {
            expect(result.patch.view).toBe('shop');
            expect(result.patch.shopReturnMode).toBe('floor');
            expect(result.patch.run?.board?.dungeonShopVisited).toBe(true);
            expect(result.audio).toEqual([{ kind: 'flip' }]);
        }
    });

    it('uses board pin mode before ordinary flips', () => {
        const run = playingRun();
        const tile = run.board!.tiles[0]!;

        const result = createPlayingTilePressSurfaceResult({
            boardPinMode: true,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileId: tile.id
        });

        expect(result.kind).toBe('patch');
        if (result.kind === 'patch') {
            expect(result.patch.run?.pinnedTileIds).toEqual([tile.id]);
            expect(result.patch.run?.board?.flippedTileIds).toEqual([]);
            expect(result.audio).toEqual([]);
        }
    });

    it('selects then swaps hidden tiles while tile swap is armed', () => {
        const run = playingRun({ regionShuffleCharges: 1 });
        const first = run.board!.tiles[0]!;
        const second = run.board!.tiles[3]!;

        const selected = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileSwapArmed: true,
            tileSwapFirstTileId: null,
            tileId: first.id
        });
        expect(selected).toMatchObject({
            kind: 'patch',
            patch: { tileSwapFirstTileId: first.id },
            audio: []
        });

        const deselected = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileSwapArmed: true,
            tileSwapFirstTileId: first.id,
            tileId: first.id
        });
        expect(deselected).toMatchObject({
            kind: 'patch',
            patch: { tileSwapFirstTileId: null },
            audio: []
        });

        const swapped = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileSwapArmed: true,
            tileSwapFirstTileId: first.id,
            tileId: second.id
        });
        expect(swapped.kind).toBe('patch');
        if (swapped.kind === 'patch') {
            expect(swapped.patch.run?.regionShuffleCharges).toBe(0);
            expect(swapped.patch.run?.board?.tiles[0]?.id).toBe(second.id);
            expect(swapped.patch.run?.board?.tiles[3]?.id).toBe(first.id);
            expect(swapped.patch.tileSwapArmed).toBe(false);
            expect(swapped.patch.tileSwapFirstTileId).toBeNull();
            expect(swapped.audio).toEqual([]);
        }
    });

    it('preserves enemy contact when tile swap selects or fails after contact', () => {
        const runSeed = 8;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(7, {
            gameMode: 'endless',
            runRulesVersion: baseRun.runRulesVersion,
            runSeed
        });
        const hazard = board.enemyHazards![0]!;
        const run = playingRun({
            board,
            lives: 3,
            regionShuffleCharges: 1,
            runSeed,
            stats: { ...baseRun.stats, guardTokens: 0 }
        });

        const selected = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileSwapArmed: true,
            tileSwapFirstTileId: null,
            tileId: hazard.currentTileId
        });
        expect(selected.kind).toBe('patch');
        if (selected.kind === 'patch') {
            expect(selected.patch.tileSwapFirstTileId).toBe(hazard.currentTileId);
            expect(selected.patch.run?.lives).toBe(run.lives - hazard.damage);
            expect(selected.patch.run?.enemyHazardHitsThisFloor).toBe(1);
        }

        const failed = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            run,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'missing-tile',
            tileId: hazard.currentTileId
        });
        expect(failed.kind).toBe('patch');
        if (failed.kind === 'patch') {
            expect(failed.patch.run?.lives).toBe(run.lives - hazard.damage);
            expect(failed.patch.run?.enemyHazardHitsThisFloor).toBe(1);
            expect(failed.patch.tileSwapArmed).toBeUndefined();
            expect(failed.patch.tileSwapFirstTileId).toBeUndefined();
        }
    });
});
