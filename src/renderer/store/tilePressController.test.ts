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
});
