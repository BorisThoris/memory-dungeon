import { describe, expect, it } from 'vitest';
import type { BoardState, RunState } from '../../shared/contracts';
import { EXIT_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { createPlayingTilePressSurfaceResult } from './tilePressController';


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
                state: 'removed',
                dungeonCardState: 'revealed'
            });
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
            expect(result.patch.run?.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.pin_toggle', targetTileId: tile.id })
            ]);
            expect(result.patch.run?.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.pin_changed', targetTileId: tile.id, pinned: true }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.pin.toggled' })
            ]));
            expect(result.audio).toEqual([]);
        }
    });

    it('consumes typed Peek feedback from the gameplay core as the audio cue source', () => {
        const run = playingRun({ peekCharges: 1 });
        const tile = run.board!.tiles[0]!;

        const result = createPlayingTilePressSurfaceResult({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: true,
            run,
            tileId: tile.id
        });

        expect(result.kind).toBe('patch');
        if (result.kind === 'patch') {
            expect(result.patch.run?.peekCharges).toBe(0);
            expect(result.patch.run?.peekRevealedTileIds).toContain(tile.id);
            expect(result.audio).toEqual([{ kind: 'peekPower' }]);
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
            expect(swapped.patch.run?.gameplayCommandJournal).toEqual([
                expect.objectContaining({
                    type: 'board.tile_swap',
                    firstTileId: first.id,
                    secondTileId: second.id
                })
            ]);
            expect(swapped.patch.run?.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.tiles_swapped' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.tile_swap.used' })
            ]));
        }
    });

});
