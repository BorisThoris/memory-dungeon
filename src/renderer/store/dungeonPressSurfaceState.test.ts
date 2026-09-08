import { describe, expect, it } from 'vitest';
import type { BoardState, RunState } from '../../shared/contracts';
import { EXIT_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { createDungeonTilePressSurfaceResult } from './dungeonPressSurfaceState';


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
                state: 'removed',
                dungeonCardState: 'revealed'
            });
            expect(result.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.tile_flip', targetTileId: exitTile.id })
            ]);
            expect(result.run.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.tile_flipped', outcome: 'exit_revealed' })
            ]));
        }
    });


});
