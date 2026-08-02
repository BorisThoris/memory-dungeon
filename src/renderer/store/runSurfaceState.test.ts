import { describe, expect, it } from 'vitest';
import { BOARD_FLOATER_POP_CLEAR } from './matchScorePop';
import type { BoardState, RunState, Tile } from '../../shared/contracts';
import { buildBoard, countFindablePairs } from '../../shared/board-generation';
import { createNewRun } from '../../shared/game-core';
import { createGameplayGambitCommitCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { EXIT_PAIR_KEY, WILD_PAIR_KEY } from '../../shared/tile-identity';
import {
    canPauseRunSurface,
    clearRunSurfaceArmedModes,
    createArmedBoardPowerPressResult,
    createBoardPinModeToggleResult,
    createDestroyPairArmedToggleResult,
    createDungeonExitActivationSurfaceResult,
    createFlashPairSurfaceResult,
    createGambitThirdPickPressResult,
    createOrdinaryTileFlipResult,
    createPausedRunSurfacePatch,
    createPeekModeToggleResult,
    createRegionShuffleArmSurfaceResult,
    createRegionShuffleSurfaceResult,
    createRunSurfaceReset,
    createShuffleBoardSurfaceResult,
    createStrayArmToggleResult,
    createTileSwapToggleResult,
    createUndoResolvingSurfaceResult,
    createBoardPowerContactPolicy,
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
        destroyPairCharges: 1,
        peekCharges: 1,
        strayRemoveArmed: false,
        strayRemoveCharges: 1,
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
    it('resets board interaction modes, shop return, prompt, and floaters', () => {
        expect(createRunSurfaceReset()).toEqual({
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            dungeonExitPromptOpen: false,
            shopReturnMode: null,
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
            destroyPairArmed: false,
            peekModeArmed: false,
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
            destroyPairArmed: false,
            peekModeArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        });
    });

    it('creates a run patch that clears board armed modes', () => {
        expect(createRunWithArmedModesClearedPatch(run)).toEqual({
            run,
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        });
    });

    it('creates a run patch that clears board armed modes and board floaters', () => {
        expect(createRunWithBoardInteractionClearedPatch(run)).toEqual({
            run,
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
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
                destroyPairArmed: false,
                peekModeArmed: false,
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
                destroyPairArmed: false,
                peekModeArmed: false,
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

    it('arms and disarms destroy-pair mode while clearing other armed modes', () => {
        expect(
            createDestroyPairArmedToggleResult({
                destroyPairArmed: false,
                run: playingRun(),
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                destroyPairArmed: true,
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null
            },
            playArmSfx: true
        });

        expect(
            createDestroyPairArmedToggleResult({
                destroyPairArmed: true,
                run: null,
                view: 'menu'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null
            },
            playArmSfx: false
        });
    });

    it('ignores destroy-pair arming when charges, contracts, board state, or eligibility block it', () => {
        expect(
            createDestroyPairArmedToggleResult({
                destroyPairArmed: false,
                run: playingRun({ destroyPairCharges: 0 }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createDestroyPairArmedToggleResult({
                destroyPairArmed: false,
                run: playingRun({ activeContract: { noDestroy: true, noShuffle: false, maxMismatches: null } }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createDestroyPairArmedToggleResult({
                destroyPairArmed: false,
                run: playingRun({ board: board({ flippedTileIds: ['a1'] }) }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createDestroyPairArmedToggleResult({
                destroyPairArmed: false,
                run: playingRun({ board: board({ tiles: [] }) }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
    });

    it('arms and disarms peek mode while keeping other armed modes clear', () => {
        const activeRun = playingRun();
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                run: activeRun,
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: true,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: activeRun
            },
            playArmSfx: true
        });

        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: true,
                run: activeRun,
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: activeRun
            },
            playArmSfx: false
        });
    });

    it('clears stray-remove arming when peek mode toggles', () => {
        const activeRun = playingRun({ strayRemoveArmed: true });
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                run: activeRun,
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: true,
                tileSwapArmed: false,
                tileSwapFirstTileId: null,
                run: { ...activeRun, strayRemoveArmed: false }
            },
            playArmSfx: true
        });
    });

    it('ignores peek toggles outside its active surface conditions', () => {
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                run: null,
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                run: playingRun({ status: 'memorize' }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                run: playingRun({ peekCharges: 0 }),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createPeekModeToggleResult({
                boardPinMode: true,
                destroyPairArmed: false,
                peekModeArmed: true,
                run: playingRun(),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
        expect(
            createPeekModeToggleResult({
                boardPinMode: false,
                destroyPairArmed: true,
                peekModeArmed: true,
                run: playingRun(),
                view: 'playing'
            })
        ).toEqual({ kind: 'ignored' });
    });

    it('toggles stray arm and clears mutually exclusive board modes', () => {
        const activeRun = playingRun({ strayRemoveArmed: false, strayRemoveCharges: 1 });
        const result = createStrayArmToggleResult({ run: activeRun, view: 'playing' });

        expect(result).toMatchObject({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                run: { strayRemoveArmed: true }
            },
            playArmSfx: true
        });
    });

    it('ignores stray arm outside active playing conditions or without charges', () => {
        expect(createStrayArmToggleResult({ run: null, view: 'playing' })).toEqual({ kind: 'ignored' });
        expect(createStrayArmToggleResult({ run: playingRun({ status: 'memorize' }), view: 'playing' })).toEqual({
            kind: 'ignored'
        });
        expect(createStrayArmToggleResult({ run: playingRun({ strayRemoveCharges: 0 }), view: 'playing' })).toEqual({
            kind: 'ignored'
        });
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
        const armed = createRegionShuffleArmSurfaceResult({ row: 0, run: activeRun, view: 'playing' });
        expect(armed).toMatchObject({
            kind: 'applied',
            patch: { boardPinMode: false, destroyPairArmed: false, peekModeArmed: false }
        });

        const shuffled = createRegionShuffleSurfaceResult({ row: 0, run: activeRun, view: 'playing' });
        expect(shuffled.kind).toBe('applied');
        if (shuffled.kind === 'applied') {
            expect(shuffled.patch.run.regionShuffleRowArmed).toBeNull();
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
                destroyPairArmed: false,
                peekModeArmed: false,
                run: activeRun,
                tileSwapArmed: false,
                view: 'playing'
            })
        ).toEqual({
            kind: 'applied',
            patch: {
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                tileSwapArmed: true,
                tileSwapFirstTileId: null
            },
            playArmSfx: true
        });

        expect(
            createTileSwapToggleResult({
                destroyPairArmed: false,
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

    it('journals the exact Master Key spend when activating a locked exit', () => {
        const base = createNewRun(0, { runSeed: 51_001 });
        const lockedRun: RunState = {
            ...base,
            status: 'playing',
            dungeonKeys: { iron: 0 },
            dungeonMasterKeys: 1,
            dungeonGatewaysUsed: 0,
            board: {
                ...base.board!,
                pairCount: 1,
                matchedPairs: 0,
                flippedTileIds: ['exit'],
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron',
                tiles: [
                    {
                        id: 'exit',
                        pairKey: EXIT_PAIR_KEY,
                        label: 'Exit',
                        symbol: 'E',
                        state: 'flipped',
                        dungeonCardKind: 'exit',
                        dungeonCardState: 'revealed',
                        dungeonExitLockKind: 'iron'
                    },
                    { id: 'a1', pairKey: 'a', label: 'A', symbol: 'A', state: 'hidden' },
                    { id: 'a2', pairKey: 'a', label: 'A', symbol: 'A', state: 'hidden' }
                ]
            }
        };
        const result = createDungeonExitActivationSurfaceResult({
            run: lockedRun,
            spend: 'master_key',
            view: 'playing'
        });
        expect(result.kind).toBe('applied');
        if (result.kind === 'applied') {
            expect(result.patch.run).toMatchObject({ dungeonMasterKeys: 0, dungeonGatewaysUsed: 1 });
            expect(result.patch.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'dungeon.exit_activate', spend: 'master_key' })
            ]);
            expect(result.events).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'dungeon.exit_activated', spend: 'master_key' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'dungeon.exit.activated' })
            ]));
        }
    });

    it('creates the board-power contact policy for enemy-contact presses', () => {
        expect(
            createBoardPowerContactPolicy({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                strayRemoveArmed: false
            })
        ).toEqual({
            armedPowerCount: 0,
            canContinueSinglePowerAfterContact: false
        });

        expect(
            createBoardPowerContactPolicy({
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                strayRemoveArmed: true
            })
        ).toEqual({
            armedPowerCount: 1,
            canContinueSinglePowerAfterContact: true
        });

        expect(
            createBoardPowerContactPolicy({
                boardPinMode: true,
                destroyPairArmed: false,
                peekModeArmed: true,
                strayRemoveArmed: false
            })
        ).toEqual({
            armedPowerCount: 1,
            canContinueSinglePowerAfterContact: false
        });

        expect(
            createBoardPowerContactPolicy({
                boardPinMode: false,
                destroyPairArmed: true,
                peekModeArmed: true,
                strayRemoveArmed: false
            })
        ).toEqual({
            armedPowerCount: 2,
            canContinueSinglePowerAfterContact: false
        });
    });

    it('applies stray remove presses and preserves enemy contacts when a stray press fails', () => {
        const activeRun = playingRun({
            board: board({
                tiles: [
                    { id: 'wild', pairKey: WILD_PAIR_KEY, label: '*', state: 'hidden', symbol: '*' },
                    { id: 'a1', pairKey: 'a', label: 'A', state: 'hidden', symbol: 'A' },
                    { id: 'a2', pairKey: 'a', label: 'A', state: 'hidden', symbol: 'A' }
                ]
            }),
            strayRemoveArmed: true,
            strayRemoveCharges: 1
        });

        const applied = createArmedBoardPowerPressResult({
            canContinueSinglePowerAfterContact: false,
            destroyPairArmed: false,
            enemyContacted: false,
            peekModeArmed: false,
            run: activeRun,
            tileId: 'wild'
        });
        expect(applied.kind).toBe('strayApplied');
        if (applied.kind === 'strayApplied') {
            expect(applied.run.board!.tiles.find((tile) => tile.id === 'wild')!.state).toBe('removed');
            expect(applied.run.strayRemoveCharges).toBe(activeRun.strayRemoveCharges - 1);
            expect(applied.run.gameplayCommandJournal).toEqual([
                expect.objectContaining({ type: 'board.stray_remove', targetTileId: 'wild' })
            ]);
            expect(applied.run.gameplayEventJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'inventory.changed', itemId: 'stray_remove_charge', applied: -1 }),
                expect.objectContaining({ type: 'board.stray_removed', targetTileId: 'wild' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.stray_remove.used' })
            ]));
        }

        expect(
            createArmedBoardPowerPressResult({
                canContinueSinglePowerAfterContact: true,
                destroyPairArmed: false,
                enemyContacted: true,
                peekModeArmed: false,
                run: activeRun,
                tileId: 'a1'
            })
        ).toEqual({ kind: 'persistEnemyContact', run: activeRun });
    });

    it('applies peek presses and treats blocked peek presses as handled', () => {
        const activeRun = { ...createNewRun(0), peekCharges: 1, status: 'playing' as const };
        const tileId = activeRun.board!.tiles[0]!.id;
        const applied = createArmedBoardPowerPressResult({
            canContinueSinglePowerAfterContact: false,
            destroyPairArmed: false,
            enemyContacted: false,
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
                canContinueSinglePowerAfterContact: true,
                destroyPairArmed: false,
                enemyContacted: true,
                peekModeArmed: true,
                run: blockedRun,
                tileId: 'missing-tile'
            })
        ).toEqual({ kind: 'handled' });

        expect(
            createArmedBoardPowerPressResult({
                canContinueSinglePowerAfterContact: true,
                destroyPairArmed: false,
                enemyContacted: true,
                peekModeArmed: true,
                run: {
                    ...blockedRun,
                    board: { ...blockedRun.board!, flippedTileIds: [blockedRun.board!.tiles[1]!.id] }
                },
                tileId: blockedTileId
            })
        ).toEqual({ kind: 'notArmed' });
    });

    it('applies destroy-pair presses and reports whether the resulting run needs resolution routing', () => {
        const activeRun = { ...createNewRun(0), destroyPairCharges: 1, status: 'playing' as const };
        const tileId = activeRun.board!.tiles.find(
            (tile) =>
                tile.state === 'hidden' &&
                activeRun.board!.tiles.filter((candidate) => candidate.pairKey === tile.pairKey).length === 2
        )!.id;
        const applied = createArmedBoardPowerPressResult({
            canContinueSinglePowerAfterContact: false,
            destroyPairArmed: true,
            enemyContacted: false,
            peekModeArmed: false,
            run: activeRun,
            tileId
        });

        expect(applied.kind).toBe('destroyApplied');
        if (applied.kind === 'destroyApplied') {
            expect(applied.run.destroyPairCharges).toBe(activeRun.destroyPairCharges - 1);
            expect(applied.run.board!.tiles.filter((tile) => tile.state === 'matched')).toHaveLength(2);
            expect(applied.resolvesRun).toBe(false);
            expect(applied.events).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.pair_destroyed', targetTileId: tileId }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.destroy_pair.used' })
            ]));
            expect(applied.run.gameplayCommandJournal).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'board.destroy_pair', targetTileId: tileId })
            ]));
        }

        expect(
            createArmedBoardPowerPressResult({
                canContinueSinglePowerAfterContact: true,
                destroyPairArmed: true,
                enemyContacted: true,
                peekModeArmed: false,
                run: playingRun({ destroyPairCharges: 0 }),
                tileId: 'a1'
            })
        ).toMatchObject({ kind: 'persistEnemyContact' });
    });

    it('reports unchanged ordinary flips and whether board interaction should clear', () => {
        const activeRun = { ...createNewRun(0), status: 'playing' as const };

        expect(
            createOrdinaryTileFlipResult({
                enemyContacted: true,
                flippedBefore: 0,
                pressedTileBefore: null,
                run: activeRun,
                tileId: 'missing-tile'
            })
        ).toEqual({
            kind: 'unchanged',
            clearBoardInteraction: true,
            run: activeRun
        });
    });

    it('reports first ordinary flips and mismatch resolve scheduling', () => {
        const activeRun = { ...createNewRun(0), status: 'playing' as const };
        const groups = pairGroups(activeRun.board!.tiles);
        const firstTile = groups[0]![0]!;
        const mismatchTile = groups[1]![0]!;

        const firstFlip = createOrdinaryTileFlipResult({
            enemyContacted: false,
            flippedBefore: 0,
            pressedTileBefore: firstTile,
            run: activeRun,
            tileId: firstTile.id
        });

        expect(firstFlip.kind).toBe('flipped');
        if (firstFlip.kind === 'flipped') {
            expect(firstFlip.playFlipSfx).toBe(true);
            expect(firstFlip.playTrapSfx).toBe(false);
            expect(firstFlip.gameOver).toBe(false);
            expect(firstFlip.resolveDelayMs).toBeNull();

            const secondFlip = createOrdinaryTileFlipResult({
                enemyContacted: false,
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

    it('reports trap SFX when an ordinary flip springs a dungeon trap', () => {
        const runSeed = 51;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const trapBoard = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'trap',
            gameMode: 'endless'
        });
        const trapTile = trapBoard.tiles.find((tile) => tile.dungeonCardKind === 'trap')!;
        const activeRun = {
            ...baseRun,
            board: trapBoard,
            findablesTotalThisFloor: countFindablePairs(trapBoard.tiles),
            status: 'playing' as const
        };

        const result = createOrdinaryTileFlipResult({
            enemyContacted: false,
            flippedBefore: 0,
            pressedTileBefore: trapTile,
            run: activeRun,
            tileId: trapTile.id
        });

        expect(result.kind).toBe('flipped');
        if (result.kind === 'flipped') {
            expect(result.playFlipSfx).toBe(true);
            expect(result.playTrapSfx).toBe(true);
            expect(result.run.dungeonTrapsTriggered).toBe(activeRun.dungeonTrapsTriggered + 1);
        }
    });

    it('reports gambit third-pick commits and resolve scheduling', () => {
        const activeRun = { ...createNewRun(0), status: 'playing' as const };
        const groups = pairGroups(activeRun.board!.tiles);
        const first = groups[0]![0]!;
        const second = groups[1]![0]!;
        const third = groups[0]![1]!;
        const resolving = createOrdinaryTileFlipResult({
            enemyContacted: false,
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
            enemyContacted: false,
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

    it('persists a fatal third-pick trap without claiming a Gambit commitment', () => {
        const runSeed = 51;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const generated = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'trap',
            gameMode: 'endless'
        });
        const trapTile = generated.tiles.find((tile) => tile.dungeonCardKind === 'trap')!;
        const ordinary = generated.tiles.filter(
            (tile) => tile.pairKey !== trapTile.pairKey
        ).slice(0, 2);
        const flippedTileIds = ordinary.map((tile) => tile.id);
        const boardWithMismatch = {
            ...generated,
            flippedTileIds,
            tiles: generated.tiles.map((tile) =>
                tile.dungeonCardKind === 'trap'
                    ? { ...tile, dungeonCardEffectId: 'trap_spikes' as const }
                    : flippedTileIds.includes(tile.id)
                      ? { ...tile, state: 'flipped' as const }
                      : tile
            )
        };
        const run = {
            ...baseRun,
            board: boardWithMismatch,
            status: 'resolving' as const,
            lives: 1,
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            stats: { ...baseRun.stats, guardTokens: 0 }
        };

        const commandResult = reduceGameplayCommand(
            run,
            createGameplayGambitCommitCommand('fatal-trap-commit', trapTile.id)
        );
        expect(commandResult.accepted).toBe(true);

        const result = createGambitThirdPickPressResult(run, trapTile.id);

        expect(result.kind).toBe('flipGameOver');
        if (result.kind === 'flipGameOver') {
            expect(result.run.status).toBe('gameOver');
            expect(result.events).toEqual([]);
            expect(result.run.gameplayCommandJournal).toBeUndefined();
        }
    });

    it('reports no-op gambit third picks without persisting hazard-only changes', () => {
        const activeRun = { ...createNewRun(0), status: 'resolving' as const };

        expect(createGambitThirdPickPressResult(activeRun, 'missing-tile')).toEqual({
            kind: 'unchanged',
            hazardContact: null
        });
    });

    it('reports moving enemy contact before a gambit third pick', () => {
        const baseRun = { ...createNewRun(0), status: 'resolving' as const };
        const board = {
            ...baseRun.board!,
            flippedTileIds: ['a1', 'b1'],
            tiles: [
                { id: 'a1', pairKey: 'a', label: 'A', state: 'flipped' as const, symbol: 'A' },
                { id: 'a2', pairKey: 'a', label: 'A', state: 'hidden' as const, symbol: 'A' },
                { id: 'b1', pairKey: 'b', label: 'B', state: 'flipped' as const, symbol: 'B' },
                { id: 'b2', pairKey: 'b', label: 'B', state: 'hidden' as const, symbol: 'B' },
                { id: 'c1', pairKey: 'c', label: 'C', state: 'hidden' as const, symbol: 'C' },
                { id: 'c2', pairKey: 'c', label: 'C', state: 'hidden' as const, symbol: 'C' }
            ],
            enemyHazards: [
                {
                    id: 'gambit-contact',
                    kind: 'sentinel' as const,
                    label: 'Sentinel',
                    currentTileId: 'a2',
                    nextTileId: 'c1',
                    damage: 1,
                    state: 'hidden' as const,
                    pattern: 'patrol' as const,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        const run = {
            ...baseRun,
            board,
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            stats: { ...baseRun.stats, guardTokens: 0 }
        };

        const result = createGambitThirdPickPressResult(run, 'a2');

        expect(result.kind).toBe('flipped');
        expect(result.hazardContact).toMatchObject({
            fromRun: run,
            toRun: {
                lives: run.lives - 1,
                enemyHazardHitsThisFloor: run.enemyHazardHitsThisFloor + 1
            }
        });
        if (result.kind === 'flipped') {
            expect(result.run.board!.flippedTileIds).toEqual(['a1', 'b1', 'a2']);
            expect(result.events).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'feedback.requested', cue: 'power.gambit.committed' })
            ]));
        }
    });
});
