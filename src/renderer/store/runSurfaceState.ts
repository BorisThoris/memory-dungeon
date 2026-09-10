import type { RunState, Tile, ViewState } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import {
    createGameplayFlashPairCommand,
    createGameplayGambitCommitCommand,
    createGameplayGreetCurioCommand,
    createGameplayPeekCommand,
    createGameplayRegionShuffleCommand,
    createGameplayShuffleCommand,
    createGameplayTileSwapCommand,
    createGameplayUndoResolveCommand,
} from '../../shared/gameplay-core-contracts';
import { canGreetFloorCurio } from '../../shared/floor-curio-greeting-rules';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import {
    canRegionShuffle,
} from '../../shared/board-powers';
import { flipTile } from '../../shared/turn-resolution';
import { isResumableLifecycleState, lifecycleStateFromRun } from '../../shared/run-lifecycle-machine';
import {
    BOARD_FLOATER_POP_CLEAR,
    type MatchScorePop,
    type MismatchScorePop
} from './matchScorePop';

export interface RunSurfaceState {
    boardPinMode: boolean;
    peekModeArmed: boolean;
    regionShuffleArmed: boolean;
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    matchScorePop: MatchScorePop | null;
    mismatchScorePop: MismatchScorePop | null;
}

type RunSurfaceToggleResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          patch: Pick<
        RunSurfaceState,
        | 'boardPinMode'
        | 'peekModeArmed'
        | 'regionShuffleArmed'
        | 'tileSwapArmed'
        | 'tileSwapFirstTileId'
    > & {
              run?: RunState;
          };
          playArmSfx: boolean;
      };

type RunSurfaceRunPatchResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          patch: { run: RunState } | ReturnType<typeof createRunWithArmedModesClearedPatch>;
          playArmSfx: boolean;
          events?: GameplayEvent[];
      };

type ArmedBoardPowerPressResult =
    | { kind: 'notArmed' }
    | { kind: 'handled' }
    | { kind: 'peekApplied'; run: RunState; events: GameplayEvent[] }
    | { kind: 'tileSwapFirstSelected'; tileId: string }
    | { kind: 'tileSwapFirstCleared' }
    | { kind: 'tileSwapApplied'; run: RunState; events: GameplayEvent[] }
    | { kind: 'regionShuffleApplied'; run: RunState; events: GameplayEvent[] }

type OrdinaryTileFlipResult =
    | { kind: 'unchanged'; run: RunState }
    | {
          kind: 'flipped';
          run: RunState;
          playFlipSfx: boolean;
          gameOver: boolean;
          resolveDelayMs: number | null;
      };

type GambitThirdPickPressResult =
    | { kind: 'unchanged' }
    | {
          kind: 'flipGameOver';
          run: RunState;
          playFlipSfx: boolean;
          events: GameplayEvent[];
      }
    | {
          kind: 'flipped';
          run: RunState;
          playFlipSfx: boolean;
          events: GameplayEvent[];
          resolveDelayMs: number | null;
      };

export const createRunSurfaceReset = (): RunSurfaceState => ({
    boardPinMode: false,
    peekModeArmed: false,
    regionShuffleArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null,
    ...BOARD_FLOATER_POP_CLEAR
});

export const canPauseRunSurface = (run: RunState | null): run is RunState =>
    run !== null && isResumableLifecycleState(lifecycleStateFromRun(run));

export const createBoardPinModeToggleResult = ({
    boardPinMode,
    run,
    view
}: {
    boardPinMode: boolean;
    run: RunState | null;
    view: ViewState;
}): RunSurfaceToggleResult => {
    const next = !boardPinMode;

    if (next && (!run || view !== 'playing' || run.status !== 'playing')) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            boardPinMode: next,
                    peekModeArmed: false,
                    regionShuffleArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        },
        playArmSfx: next
    };
};

export const createPeekModeToggleResult = ({
    boardPinMode,
    peekModeArmed,
    tileSwapArmed = false,
    run,
    view
}: {
    boardPinMode: boolean;
    peekModeArmed: boolean;
    tileSwapArmed?: boolean;
    run: RunState | null;
    view: ViewState;
}): RunSurfaceToggleResult => {
    if (
        !run ||
        view !== 'playing' ||
        run.status !== 'playing' ||
        run.peekCharges < 1 ||
        boardPinMode ||
        tileSwapArmed
    ) {
        return { kind: 'ignored' };
    }

    const next = !peekModeArmed;
    const nextRun = run;

    return {
        kind: 'applied',
        patch: {
            boardPinMode: false,
                    peekModeArmed: next,
                    regionShuffleArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            run: nextRun
        },
        playArmSfx: next
    };
};

export const createTileSwapToggleResult = ({
    peekModeArmed,
    run,
    tileSwapArmed = false,
    view
}: {
    peekModeArmed: boolean;
    run: RunState | null;
    tileSwapArmed?: boolean;
    view: ViewState;
}): RunSurfaceToggleResult => {
    const next = !tileSwapArmed;
    if (
        next &&
        (!run ||
            view !== 'playing' ||
            run.status !== 'playing' ||
            run.activeContract?.noShuffle ||
            run.board?.flippedTileIds.length !== 0 ||
            run.regionShuffleCharges <= 0 ||
            !run.board ||
            run.board.tiles.filter((tile) => tile.state === 'hidden').length < 2 ||
                peekModeArmed)
    ) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            boardPinMode: false,
                    peekModeArmed: false,
                    regionShuffleArmed: false,
            tileSwapArmed: next,
            tileSwapFirstTileId: null
        },
        playArmSfx: next
    };
};

export const createShuffleBoardSurfaceResult = ({
    run,
    view
}: {
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'playing') {
        return { kind: 'ignored' };
    }

    const command = createGameplayShuffleCommand(
        `shuffle:${run.runSeed}:${run.board?.level ?? 0}:${run.shuffleNonce}`
    );
    const result = reduceGameplayCommand(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: appendGameplayJournal(result.run, [command], result.events) },
              playArmSfx: false,
              events: result.events
          };
};

/**
 * Arms row shuffle, or disarms it if it was already armed. There is no row to choose here: the
 * board is the row picker, so the power stays armed until the player presses a tile (or arms
 * something else). The previous shape stored a row up front, which left no way to enter the mode
 * at all — the toolbar that once chose the row was removed in the run-shell rebuild.
 */
export const createRegionShuffleArmToggleSurfaceResult = ({
    armed,
    run,
    view
}: {
    armed: boolean;
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'playing') {
        return { kind: 'ignored' };
    }
    // Arming is refused when the rules would refuse the shuffle anyway — a scholar contract, no
    // charges, a flip in progress. Disarming is always allowed, so a contract picked up mid-floor
    // cannot strand the player in a mode they can no longer leave.
    if (!armed && !canRegionShuffle(run)) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: { ...createRunWithArmedModesClearedPatch(run), regionShuffleArmed: !armed },
        playArmSfx: !armed
    };
};

/**
 * The row a tile sits in, or null when the board cannot say. Rows are the unit row shuffle works
 * in, and the board is what the player presses, so this is the whole translation between them.
 */
export const regionShuffleRowForTile = (run: RunState, tileId: string): number | null => {
    const columns = run.board?.columns ?? 0;
    const index = run.board?.tiles.findIndex((candidate) => candidate.id === tileId) ?? -1;
    return columns > 0 && index >= 0 ? Math.floor(index / columns) : null;
};

/** Shared so the two entry points cannot drift on the id the replay journal is keyed by. */
const regionShuffleCommandForRow = (run: RunState, row: number) =>
    createGameplayRegionShuffleCommand(
        `region-shuffle:${run.runSeed}:${run.board?.level ?? 0}:${run.shuffleNonce}:${row}`,
        row
    );

export const createRegionShuffleSurfaceResult = ({
    row,
    run,
    view
}: {
    row: number;
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'playing') {
        return { kind: 'ignored' };
    }

    const command = regionShuffleCommandForRow(run, row);
    const result = reduceGameplayCommand(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: createRunWithArmedModesClearedPatch(
                  appendGameplayJournal(result.run, [command], result.events)
              ),
              playArmSfx: false,
              events: result.events
          };
};

export const createFlashPairSurfaceResult = ({
    run,
    view
}: {
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'playing' || (!run.practiceMode && !run.wildMenuRun)) {
        return { kind: 'ignored' };
    }

    const command = createGameplayFlashPairCommand(
        `flash-pair:${run.runSeed}:${run.board?.level ?? 0}:${run.shuffleNonce}:${run.flashPairCharges}`
    );
    const result = reduceGameplayCommand(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: appendGameplayJournal(result.run, [command], result.events) },
              playArmSfx: true,
              events: result.events
          };
};

/**
 * Greeting the floor's resident. Free, once per floor, and never a mistake — so the only reasons
 * it can be refused are structural: not on the board, not this floor's turn to talk, already said
 * hello. The rules module owns all three; this only builds the command.
 */
export const createGreetCurioSurfaceResult = ({
    run,
    view
}: {
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || !canGreetFloorCurio(run)) {
        return { kind: 'ignored' };
    }

    const command = createGameplayGreetCurioCommand(
        `curio-greet:${run.runSeed}:${run.board?.level ?? 0}:${run.floorCurioId ?? 'nobody'}`
    );
    const result = reduceGameplayCommand(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: appendGameplayJournal(result.run, [command], result.events) },
              playArmSfx: true,
              events: result.events
          };
};

export const createUndoResolvingSurfaceResult = ({
    run,
    view
}: {
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'resolving') {
        return { kind: 'ignored' };
    }

    const command = createGameplayUndoResolveCommand(
        `undo-resolve:${run.runSeed}:${run.board?.level ?? 0}:${run.board?.flippedTileIds.join('+') ?? 'none'}:${run.undoUsesThisFloor}`
    );
    const result = reduceGameplayCommand(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: appendGameplayJournal(result.run, [command], result.events) },
              playArmSfx: false,
              events: result.events
          };
};

export const createArmedBoardPowerPressResult = ({
    peekModeArmed,
    regionShuffleArmed = false,
    run,
    tileSwapArmed = false,
    tileSwapFirstTileId = null,
    tileId
}: {
    peekModeArmed: boolean;
    regionShuffleArmed?: boolean;
    run: RunState;
    tileSwapArmed?: boolean;
    tileSwapFirstTileId?: string | null;
    tileId: string;
}): ArmedBoardPowerPressResult => {
    if (regionShuffleArmed) {
        // The row is chosen by pressing any tile in it, so the power needs no separate row picker:
        // the board itself is the picker, the way tile swap uses presses to choose its two tiles.
        const row = regionShuffleRowForTile(run, tileId);
        if (row === null) {
            return { kind: 'handled' };
        }
        const command = regionShuffleCommandForRow(run, row);
        const result = reduceGameplayCommand(run, command);
        return !result.accepted
            ? { kind: 'handled' }
            : {
                  kind: 'regionShuffleApplied',
                  run: appendGameplayJournal(result.run, [command], result.events),
                  events: result.events
              };
    }

    if (tileSwapArmed) {
        const tile = run.board?.tiles.find((candidate) => candidate.id === tileId);
        if (!tile || tile.state !== 'hidden') {
            return { kind: 'handled' };
        }
        if (tileSwapFirstTileId === null) {
            return { kind: 'tileSwapFirstSelected', tileId };
        }
        if (tileSwapFirstTileId === tileId) {
            return { kind: 'tileSwapFirstCleared' };
        }
        const command = createGameplayTileSwapCommand(
            `tile-swap:${run.runSeed}:${run.board?.level ?? 0}:${run.shuffleNonce}:${tileSwapFirstTileId}:${tileId}`,
            tileSwapFirstTileId,
            tileId
        );
        const result = reduceGameplayCommand(run, command);
        return !result.accepted
            ? { kind: 'handled' }
            : {
                  kind: 'tileSwapApplied',
                  run: appendGameplayJournal(result.run, [command], result.events),
                  events: result.events
              };
    }

    if (peekModeArmed && run.peekCharges > 0 && run.board && run.board.flippedTileIds.length === 0) {
        const command = createGameplayPeekCommand(
            `peek:${run.runSeed}:${run.board.level}:${run.peekCharges}:${tileId}`,
            tileId
        );
        const result = reduceGameplayCommand(run, command);
        return result.accepted
            ? {
                  kind: 'peekApplied',
                  run: appendGameplayJournal(result.run, [command], result.events),
                  events: result.events
              }
            : { kind: 'handled' };
    }

    return { kind: 'notArmed' };
};

export const createOrdinaryTileFlipResult = ({
    flippedBefore,
    pressedTileBefore,
    run,
    tileId
}: {
    flippedBefore: number;
    pressedTileBefore: Tile | null;
    run: RunState;
    tileId: string;
}): OrdinaryTileFlipResult => {
    const nextRun = flipTile(run, tileId);

    if (nextRun === run) {
        return { kind: 'unchanged', run };
    }

    const flippedAfter = nextRun.board?.flippedTileIds.length ?? 0;
    const pressedTileAfter = nextRun.board?.tiles.find((tile) => tile.id === tileId) ?? null;
    const pressedTileBecameFaceUp = pressedTileBefore?.state === 'hidden' && pressedTileAfter?.state === 'flipped';

    return {
        kind: 'flipped',
        run: nextRun,
        playFlipSfx: flippedAfter > flippedBefore || pressedTileBecameFaceUp,
        gameOver: nextRun.status === 'gameOver',
        resolveDelayMs:
            nextRun.status === 'resolving' && nextRun.timerState.resolveRemainingMs !== null
                ? nextRun.timerState.resolveRemainingMs
                : null
    };
};

export const createGambitThirdPickPressResult = (
    run: RunState,
    tileId: string
): GambitThirdPickPressResult => {
    const command = createGameplayGambitCommitCommand(
        `gambit-commit:${run.runSeed}:${run.board?.level ?? 0}:${run.board?.flippedTileIds.join('+') ?? 'none'}:${tileId}`,
        tileId
    );
    const commandResult = reduceGameplayCommand(run, command);
    if (!commandResult.accepted) {
        return { kind: 'unchanged' };
    }
    const flippedBefore = run.board?.flippedTileIds.length ?? 0;
    const transitionedRun = flipTile(run, tileId);

    const flippedAfter = transitionedRun.board?.flippedTileIds.length ?? 0;
    const committed =
        transitionedRun !== run &&
        flippedAfter === 3 &&
        transitionedRun.board?.flippedTileIds.includes(tileId) === true;
    if (!committed && transitionedRun.status === 'gameOver') {
        return {
            kind: 'flipGameOver',
            run: transitionedRun,
            playFlipSfx: flippedAfter > flippedBefore,
            events: []
        };
    }
    if (!committed) {
        return { kind: 'unchanged' };
    }

    const nextRun = appendGameplayJournal(transitionedRun, [command], commandResult.events);
    const playFlipSfx = flippedAfter > flippedBefore;

    if (nextRun.status === 'gameOver') {
        return {
            kind: 'flipGameOver',
            run: nextRun,
            playFlipSfx,
            events: commandResult.events
        };
    }

    return {
        kind: 'flipped',
        run: nextRun,
        playFlipSfx,
        events: commandResult.events,
        resolveDelayMs:
            nextRun.status === 'resolving' && nextRun.timerState.resolveRemainingMs !== null
                ? nextRun.timerState.resolveRemainingMs
                : null
    };
};

export const clearRunSurfaceArmedModes = (): Pick<
    RunSurfaceState,
    | 'boardPinMode'
    | 'peekModeArmed'
    | 'regionShuffleArmed'
    | 'tileSwapArmed'
    | 'tileSwapFirstTileId'
> => ({
    boardPinMode: false,
    peekModeArmed: false,
    regionShuffleArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithPeekDisarmedPatch = (
    run: RunState
): Pick<RunSurfaceState, 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & {
    run: RunState;
} => ({
    run,
    peekModeArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithBoardPowersDisarmedPatch = (
    run: RunState
): Pick<
    RunSurfaceState,
    'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'
> & { run: RunState } => ({
    run,
    peekModeArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithArmedModesClearedPatch = (
    run: RunState
): Pick<
        RunSurfaceState,
        | 'boardPinMode'
        | 'peekModeArmed'
        | 'regionShuffleArmed'
        | 'tileSwapArmed'
        | 'tileSwapFirstTileId'
    > & {
    run: RunState;
} => ({
    run,
    ...clearRunSurfaceArmedModes()
});

/**
 * Also carries the per-floor disarm that used to live in floor-clear-transition.ts.
 * Arming is renderer surface state now, so the rules layer can no longer reset it;
 * this is the floor-advance path, so the reset belongs here.
 */
export const createRunWithBoardInteractionClearedPatch = (
    run: RunState
): Pick<
    RunSurfaceState,
    | 'boardPinMode'
    | 'matchScorePop'
    | 'mismatchScorePop'
    | 'peekModeArmed'
    | 'regionShuffleArmed'
    | 'tileSwapArmed'
    | 'tileSwapFirstTileId'
> & { run: RunState } => ({
    run,
    ...clearRunSurfaceArmedModes(),
    ...BOARD_FLOATER_POP_CLEAR
});

export const createPausedRunSurfacePatch = (
    run: RunState,
    freezeRun: (run: RunState) => RunState
): Pick<RunSurfaceState, 'matchScorePop' | 'mismatchScorePop'> & { run: RunState } => ({
    run: freezeRun(run),
    ...BOARD_FLOATER_POP_CLEAR
});
