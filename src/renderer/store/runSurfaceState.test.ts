import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import { BOARD_FLOATER_POP_CLEAR } from './matchScorePop';
import type { BoardState, RunState, Tile } from '../../shared/contracts';
import {
    canPauseRunSurface,
    clearRunSurfaceArmedModes,
    createArmedBoardPowerPressResult,
    createBoardPinModeToggleResult,
    createFlashPairSurfaceResult,
    createGambitThirdPickPressResult,
    createOrdinaryTileFlipResult,
    createPausedRunSurfacePatch,
    createPeekModeToggleResult,
    createRegionShuffleArmToggleSurfaceResult,
    createRegionShuffleSurfaceResult,
    createRunSurfaceReset,
    createShuffleBoardSurfaceResult,
    createTileSwapToggleResult,
    createUndoResolvingSurfaceResult,
    createRunWithArmedModesClearedPatch,
    createRunWithBoardInteractionClearedPatch,
    createRunWithBoardPowersDisarmedPatch,
    createRunWithPeekDisarmedPatch
} from './runSurfaceState';

const run = { id: 'test-run' } as unknown as RunState;

const board = (overrides: Partial<BoardState> = {}): BoardState =>
    ({
        flippedTileIds: [],
        tiles: [
            { id: 'a1', pairKey: 'a', label: 'A', state: 'hidden', symbol: 'A' },
            { id: 'a2', pairKey: 'a', label: 'A', state: 'hidden', symbol: 'A' }
        ],
        ...overrides
    }) as BoardState;

const playingRun = (overrides: Partial<RunState> = {}): RunState =>
    ({
        id: 'run-1',
        activeContract: null,
        board: board(),
        peekCharges: 1,
        status: 'playing',
        ...overrides
    }) as RunState;

const pairGroups = (tiles: readonly Tile[]): Tile[][] => {
    const groups = new Map<string, Tile[]>();
    for (const tile of tiles) {
        const group = groups.get(tile.pairKey) ?? [];
        group.push(tile);
        groups.set(tile.pairKey, group);
    }
    return [...groups.values()].filter((group) => group.length === 2);
};

describe('run surface state helpers', () => {
    it('resets board interaction modes, shop return, and floaters', () => {
        expect(createRunSurfaceReset()).toEqual({
            boardPinMode: false,
            peekModeArmed: false,
            regionShuffleArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            ...BOARD_FLOATER_POP_CLEAR
        });
    });

    it('allows pause only for resumable run statuses', () => {
        expect(canPauseRunSurface(playingRun({ status: 'memorize' }))).toBe(true);
        expect(canPauseRunSurface(playingRun({ status: 'playing' }))).toBe(true);
        expect(canPauseRunSurface(playingRun({ status: 'resolving' }))).toBe(true);
        expect(canPauseRunSurface(playingRun({ status: 'paused' }))).toBe(false);
        expect(canPauseRunSurface(playingRun({ status: 'levelComplete' }))).toBe(false);
        expect(canPauseRunSurface(playingRun({ status: 'gameOver' }))).toBe(false);
        expect(canPauseRunSurface(null)).toBe(false);
    });

    it('clears only mutually exclusive board armed modes', () => {
        expect(clearRunSurfaceArmedModes()).toEqual({
            boardPinMode: false,
            peekModeArmed: false,
            regionShuffleArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        });
    });

    it('creates a run patch that only disarms peek mode', () => {
        expect(createRunWithPeekDisarmedPatch(run)).toEqual({
            run,
            peekModeArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        });
    });

    it('creates a run patch that disarms board powers without changing board pin mode', () => {
        expect(createRunWithBoardPowersDisarmedPatch(run)).toEqual({
            run,
            peekModeArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        });
    });

    it('creates a run patch that clears board armed modes', () => {
        expect(createRunWithArmedModesClearedPatch(run)).toEqual({
            run,
            boardPinMode: false,
            peekModeArmed: false,
            regionShuffleArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        });
    });

    it('creates a run patch that clears board armed modes and board floaters', () => {
        expect(createRunWithBoardInteractionClearedPatch(run)).toEqual({
            run,
            boardPinMode: false,
            peekModeArmed: false,
            regionShuffleArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            ...BOARD_FLOATER_POP_CLEAR
        });
    });

    it('creates a pause patch from the supplied run freezer and clears board floaters', () => {
        const pausedRun = { ...run, status: 'paused' } as unknown as RunState;
        expect(createPausedRunSurfacePatch(run, () => pausedRun)).toEqual({
            run: pausedRun,
            ...BOARD_FLOATER_POP_CLEAR
        });
    });

    it('arms and disarms board pin mode while clearing other armed modes', () => {
        expect(
            createBoardPinModeToggleResult({
                boardPinMode: false,
                run: playingRun(),
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: true,
                peekModeArmed: false,
                regionShuffleArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null
            },
            playArmSfx: true
        });

        expect(
            createBoardPinModeToggleResult({
                boardPinMode: true,
                run: null,
                view: 'menu'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                peekModeArmed: false,
                regionShuffleArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null
            },
            playArmSfx: false
        });
    });

    it('ignores attempts to arm board pin mode outside an active playing run', () => {
        expect(
            createBoardPinModeToggleResult({
                boardPinMode: false,
                run: null,
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createBoardPinModeToggleResult({
                boardPinMode: false,
                run: playingRun({ status: 'memorize' }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
    });



    it('arms and disarms peek mode while keeping other armed modes clear', () => {
        const activeRun = playingRun();
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                peekModeArmed: false,
                run: activeRun,
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                peekModeArmed: true,
                regionShuffleArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: activeRun
            },
            playArmSfx: true
        });

        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                peekModeArmed: true,
                run: activeRun,
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                peekModeArmed: false,
                regionShuffleArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: activeRun
            },
            playArmSfx: false
        });
    });


    it('ignores peek toggles outside its active surface conditions', () => {
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                peekModeArmed: false,
                run: null,
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                peekModeArmed: false,
                run: playingRun({ status: 'memorize' }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                peekModeArmed: false,
                run: playingRun({ peekCharges: 0 }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createPeekModeToggleResult({
                boardPinMode: true,
                peekModeArmed: true,
                run: playingRun(),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        /*
         * Gen 200 dropped a sixth case here. It armed Destroy and asserted the peek toggle stayed
         * ignored - the exclusion was the whole claim, and with Destroy gone there is nothing to
         * exclude. Disarming an armed peek is an applied toggle, so keeping the case with the flag
         * stripped would have asserted the opposite of the rule.
         */
    });



    it('creates full-board shuffle patches for active playable runs', () => {
        const activeRun = { ...createNewRun(0), status: 'playing' as const };
        const result = createShuffleBoardSurfaceResult({ run: activeRun, view: 'playing' });

        expect(result.kind).toBe('applied');
        if (result.kind === 'applied') {
            expect(result.patch.run.shuffleNonce).toBe(activeRun.shuffleNonce + 1);
            expect(result.playArmSfx).toBe(false);
            expect(result.patch.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.shuffle' })
            ]);
            expect(result.events).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.shuffled' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.shuffle.used' })
            ]));
        }
    });

    it('ignores shuffle when run surface conditions block it', () => {
        expect(createShuffleBoardSurfaceResult({ run: null, view: 'playing' })).toEqual({ kind: 'ignored' });
        expect(
            createShuffleBoardSurfaceResult({ run: { ...createNewRun(0), status: 'playing' }, view: 'menu' })
        ).toEqual({ kind: 'ignored' });
    });

    it('arms and applies region shuffle with board modes cleared', () => {
        const activeRun = { ...createNewRun(0), regionShuffleCharges: 1, status: 'playing' as const };
        // Arming takes no row: the board is the row picker, so the mode stays live until a press.
        const armed = createRegionShuffleArmToggleSurfaceResult({ armed: false, run: activeRun, view: 'playing' });
        expect(armed).toMatchObject({
            kind: 'applied',
            patch: { boardPinMode: false, peekModeArmed: false, regionShuffleArmed: true }
        });
        expect(
            createRegionShuffleArmToggleSurfaceResult({ armed: true, run: activeRun, view: 'playing' })
        ).toMatchObject({ kind: 'applied', patch: { regionShuffleArmed: false } });

        const shuffled = createRegionShuffleSurfaceResult({ row: 0, run: activeRun, view: 'playing' });
        expect(shuffled.kind).toBe('applied');
        if (shuffled.kind === 'applied') {
            expect(shuffled.patch.run.shuffleNonce).toBe(activeRun.shuffleNonce + 1);
            expect(shuffled.patch.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.region_shuffle', rowIndex: 0 })
            ]);
            expect(shuffled.events).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.region_shuffled', rowIndex: 0 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.region_shuffle.used' })
            ]));
        }
    });

    it('arms tile swap only when row-shuffle resources and hidden tiles are available', () => {
        const activeRun = {
            ...createNewRun(0),
            regionShuffleCharges: 1,
            status: 'playing' as const
        };

        expect(
            createTileSwapToggleResult({
                peekModeArmed: false,
                run: activeRun,
                tileSwapArmed: false,
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                peekModeArmed: false,
                regionShuffleArmed: false,
                tileSwapArmed: true,
                tileSwapFirstTileId: null
            },
            playArmSfx: true
        });

        expect(
            createTileSwapToggleResult({
                peekModeArmed: false,
                run: { ...activeRun, regionShuffleCharges: 0 },
                tileSwapArmed: false,
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
    });

    it('creates flash-pair patches only for practice or wild runs', () => {
        expect(
            createFlashPairSurfaceResult({ run: { ...createNewRun(0), status: 'playing' }, view: 'playing' })
        ).toEqual({
            kind: 'ignored'
        });

        const practiceRun = {
            ...createNewRun(0, { practiceMode: true }),
            flashPairCharges: 1,
            status: 'playing' as const
        };
        const result = createFlashPairSurfaceResult({ run: practiceRun, view: 'playing' });
        expect(result.kind).toBe('applied');
        if (result.kind === 'applied') {
            expect(result.patch.run.flashPairCharges).toBe(practiceRun.flashPairCharges - 1);
            expect(result.playArmSfx).toBe(true);
            expect(result.patch.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.flash_pair' })
            ]);
            expect(result.events).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.flash_pair_revealed' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.flash_pair.used' })
            ]));
        }
    });

    it('journals a successful resolving Undo and leaves illegal attempts untouched', () => {
        const resolving = playingRun({
            runSeed: 42,
            runRulesVersion: 1,
            status: 'resolving',
            undoUsesThisFloor: 1,
            recallFocus: 2,
            forgottenTileIdsThisFloor: [],
            board: board({
                flippedTileIds: ['a1', 'a2'],
                tiles: [
                    { id: 'a1', pairKey: 'a', label: 'A', state: 'flipped', symbol: 'A' },
                    { id: 'a2', pairKey: 'a', label: 'A', state: 'flipped', symbol: 'A' }
                ]
            })
        });
        const result = createUndoResolvingSurfaceResult({ run: resolving, view: 'playing' });
        expect(result.kind).toBe('applied');
        if (result.kind === 'applied') {
            expect(result.patch.run).toMatchObject({ status: 'playing', undoUsesThisFloor: 0, recallFocus: 1 });
            expect(result.patch.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.undo_resolve' })
            ]);
            expect(result.events).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.resolve_undone', restoredTileIds: ['a1', 'a2'] }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.undo_resolve.used' })
            ]));
        }
        expect(createUndoResolvingSurfaceResult({
            run: { ...resolving, undoUsesThisFloor: 0 },
            view: 'playing'
        })).toEqual({ kind: 'ignored' });
    });




    it('applies peek presses and treats blocked peek presses as handled', () => {
        const activeRun = { ...createNewRun(0), peekCharges: 1, status: 'playing' as const };
        const tileId = activeRun.board!.tiles[0]!.id;
        const applied = createArmedBoardPowerPressResult({
            peekModeArmed: true,
            run: activeRun,
            tileId
        });

        expect(applied.kind).toBe('peekApplied');
        if (applied.kind === 'peekApplied') {
            expect(applied.run.peekCharges).toBe(activeRun.peekCharges - 1);
            expect(applied.run.peekRevealedTileIds).toContain(tileId);
            expect(applied.events).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'board.peeked', targetTileId: tileId }),
                    expect.objectContaining({ type: 'feedback.requested', cue: 'power.peek.used' })
                ])
            );
        }

        const blockedRun = {
            ...createNewRun(0),
            peekCharges: 1,
            status: 'playing' as const
        };
        const blockedTileId = blockedRun.board!.tiles[0]!.id;
        expect(
            createArmedBoardPowerPressResult({
                peekModeArmed: true,
                run: blockedRun,
                tileId: 'missing-tile'
            })
        ).toEqual({ kind: 'handled' });

        expect(
            createArmedBoardPowerPressResult({
                peekModeArmed: true,
                run: {
                    ...blockedRun,
                    board: { ...blockedRun.board!, flippedTileIds: [blockedRun.board!.tiles[1]!.id] }
                },
                tileId: blockedTileId
            })
        ).toEqual({ kind: 'notArmed' });
    });


    it('reports unchanged ordinary flips', () => {
        const activeRun = { ...createNewRun(0), status: 'playing' as const };

        expect(
            createOrdinaryTileFlipResult({
                flippedBefore: 0,
                pressedTileBefore: null,
                run: activeRun,
                tileId: 'missing-tile'
            })
        ).toEqual({ kind: 'unchanged', run: activeRun });
    });

    it('reports first ordinary flips and mismatch resolve scheduling', () => {
        const activeRun = { ...createNewRun(0), status: 'playing' as const };
        const groups = pairGroups(activeRun.board!.tiles);
        const firstTile = groups[0]![0]!;
        const mismatchTile = groups[1]![0]!;

        const firstFlip = createOrdinaryTileFlipResult({
            flippedBefore: 0,
            pressedTileBefore: firstTile,
            run: activeRun,
            tileId: firstTile.id
        });

        expect(firstFlip.kind).toBe('flipped');
        if (firstFlip.kind === 'flipped') {
            expect(firstFlip.playFlipSfx).toBe(true);
            expect(firstFlip.gameOver).toBe(false);
            expect(firstFlip.resolveDelayMs).toBeNull();

            const secondFlip = createOrdinaryTileFlipResult({
                    flippedBefore: firstFlip.run.board!.flippedTileIds.length,
                pressedTileBefore: mismatchTile,
                run: firstFlip.run,
                tileId: mismatchTile.id
            });

            expect(secondFlip.kind).toBe('flipped');
            if (secondFlip.kind === 'flipped') {
                expect(secondFlip.playFlipSfx).toBe(true);
                expect(secondFlip.run.status).toBe('resolving');
                expect(secondFlip.resolveDelayMs).toBe(secondFlip.run.timerState.resolveRemainingMs);
            }
        }
    });


    it('reports gambit third-pick commits and resolve scheduling', () => {
        const activeRun = { ...createNewRun(0), status: 'playing' as const };
        const groups = pairGroups(activeRun.board!.tiles);
        const first = groups[0]![0]!;
        const second = groups[1]![0]!;
        const third = groups[0]![1]!;
        const resolving = createOrdinaryTileFlipResult({
            flippedBefore: 0,
            pressedTileBefore: first,
            run: activeRun,
            tileId: first.id
        });
        expect(resolving.kind).toBe('flipped');
        if (resolving.kind !== 'flipped') {
            return;
        }
        const mismatch = createOrdinaryTileFlipResult({
            flippedBefore: resolving.run.board!.flippedTileIds.length,
            pressedTileBefore: second,
            run: resolving.run,
            tileId: second.id
        });
        expect(mismatch.kind).toBe('flipped');
        if (mismatch.kind !== 'flipped') {
            return;
        }

        const result = createGambitThirdPickPressResult(
            {
                ...mismatch.run,
                gambitAvailableThisFloor: true,
                gambitThirdFlipUsed: false
            },
            third.id
        );

        expect(result.kind).toBe('flipped');
        if (result.kind === 'flipped') {
            expect(result.playFlipSfx).toBe(true);
            expect(result.events).toEqual([
                expect.objectContaining({ type: 'board.gambit_commit.requested' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.gambit.committed' })
            ]);
            expect(result.run.board!.flippedTileIds).toHaveLength(3);
            expect(result.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.gambit_commit', targetTileId: third.id })
            ]);
            expect(result.resolveDelayMs).toBe(result.run.timerState.resolveRemainingMs);
        }
    });


    it('reports no-op gambit third picks as unchanged', () => {
        const activeRun = { ...createNewRun(0), status: 'resolving' as const };

        expect(createGambitThirdPickPressResult(activeRun, 'missing-tile')).toEqual({ kind: 'unchanged' });
    });

});
