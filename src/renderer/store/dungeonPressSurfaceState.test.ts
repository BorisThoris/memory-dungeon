import { describe, expect, it } from 'vitest';
import type { BoardState, RunShopOfferState, RunState } from '../../shared/contracts';
import { buildBoard } from '../../shared/board-generation';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { createDungeonTilePressSurfaceResult } from './dungeonPressSurfaceState';

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
    ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 48 })),
    status: 'playing',
    ...overrides
});

describe('dungeon press surface state helpers', () => {
    it('ignores ordinary tile pair keys', () => {
        const run = playingRun();

        expect(createDungeonTilePressSurfaceResult({ pairKey: 'memory-a', run, tileId: 'tile-a' })).toEqual({
            kind: 'notDungeonTile'
        });
        expect(createDungeonTilePressSurfaceResult({ pairKey: null, run, tileId: 'tile-a' })).toEqual({
            kind: 'notDungeonTile'
        });
    });

    it('creates an exit prompt result and reveals the exit card', () => {
        const run = playingRun();
        const exitTile = run.board!.tiles[0]!;
        const board: BoardState = {
            ...run.board!,
            tiles: run.board!.tiles.map((tile) =>
                tile.id === exitTile.id ? { ...tile, pairKey: EXIT_PAIR_KEY, dungeonCardState: 'hidden' } : tile
            )
        };
        const result = createDungeonTilePressSurfaceResult({
            pairKey: EXIT_PAIR_KEY,
            run: { ...run, board },
            tileId: exitTile.id
        });

        expect(result.kind).toBe('exitPrompt');
        if (result.kind === 'exitPrompt') {
            expect(result.playFlipSfx).toBe(true);
            expect(result.run.board!.tiles.find((tile) => tile.id === exitTile.id)).toMatchObject({
                state: 'flipped',
                dungeonCardState: 'revealed'
            });
        }
    });

    it('creates a shop result when the dungeon shop tile is usable', () => {
        const runSeed = 48;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'shop',
            gameMode: 'endless'
        });
        const shopTile = board.tiles.find((tile) => tile.pairKey === SHOP_PAIR_KEY)!;
        const run = playingRun({ board, runSeed, shopOffers: [offer()] });
        const result = createDungeonTilePressSurfaceResult({
            pairKey: shopTile.pairKey,
            run,
            tileId: shopTile.id
        });

        expect(result.kind).toBe('shop');
        if (result.kind === 'shop') {
            expect(result.playFlipSfx).toBe(true);
            expect(result.run.board!.dungeonShopVisited).toBe(true);
            expect(result.run.shopOffers).toHaveLength(1);
        }
    });

    it('creates a room result when the dungeon room tile resolves', () => {
        const runSeed = 49;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'rest',
            gameMode: 'endless'
        });
        const roomTile = board.tiles.find((tile) => tile.pairKey === ROOM_PAIR_KEY)!;
        const run = playingRun({ board, runSeed });
        const result = createDungeonTilePressSurfaceResult({
            pairKey: roomTile.pairKey,
            run,
            tileId: roomTile.id
        });

        expect(result.kind).toBe('room');
        if (result.kind === 'room') {
            expect(result.playFlipSfx).toBe(true);
            expect(result.run.board!.tiles.find((tile) => tile.id === roomTile.id)).toMatchObject({
                dungeonRoomUsed: true,
                dungeonCardState: 'resolved'
            });
        }
    });
});
