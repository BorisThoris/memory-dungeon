import type { RunState, Tile, ViewState } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import {
    createGameplayGambitCommitCommand,
    createGameplayPeekCommand,
    createGameplayRegionShuffleCommand,
    createGameplayShuffleCommand,
    createGameplayStrayRemoveCommand,
    createGameplayTileSwapCommand
} from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import {
    applyDestroyPair,
    applyFlashPair,
    armRegionShuffleRow,
    collectDestroyEligibleTileIds,
    toggleStrayRemoveArmed
} from '../../shared/board-powers';
import {
    applyEnemyHazardClick,
    flipTile
} from '../../shared/turn-resolution';
import { isResumableLifecycleState, lifecycleStateFromRun } from '../../shared/run-lifecycle-machine';
import {
    BOARD_FLOATER_POP_CLEAR,
    type MatchScorePop,
    type MismatchScorePop
} from './matchScorePop';

export interface RunSurfaceState {
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    peekModeArmed: boolean;
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    dungeonExitPromptOpen: boolean;
    shopReturnMode: 'floor' | 'summary' | null;
    matchScorePop: MatchScorePop | null;
    mismatchScorePop: MismatchScorePop | null;
}

type RunSurfaceToggleResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          patch: Pick<RunSurfaceState, 'boardPinMode' | 'destroyPairArmed' | 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & {
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
    | { kind: 'persistEnemyContact'; run: RunState }
    | { kind: 'strayApplied'; run: RunState }
    | { kind: 'peekApplied'; run: RunState; events: GameplayEvent[] }
    | { kind: 'tileSwapFirstSelected'; tileId: string }
    | { kind: 'tileSwapFirstCleared' }
    | { kind: 'tileSwapApplied'; run: RunState; events: GameplayEvent[] }
    | { kind: 'destroyApplied'; run: RunState; resolvesRun: boolean };

type OrdinaryTileFlipResult =
    | { kind: 'unchanged'; clearBoardInteraction: boolean; run: RunState }
    | {
          kind: 'flipped';
          run: RunState;
          playFlipSfx: boolean;
          playTrapSfx: boolean;
          gameOver: boolean;
          resolveDelayMs: number | null;
      };

interface EnemyHazardContactResult {
    fromRun: RunState;
    toRun: RunState;
}

type GambitThirdPickPressResult =
    | { kind: 'unchanged'; hazardContact: EnemyHazardContactResult | null }
    | {
          kind: 'hazardGameOver';
          run: RunState;
          hazardContact: EnemyHazardContactResult;
      }
    | {
          kind: 'flipGameOver';
          run: RunState;
          hazardContact: EnemyHazardContactResult | null;
          playFlipSfx: boolean;
          events: GameplayEvent[];
      }
    | {
          kind: 'flipped';
          run: RunState;
          hazardContact: EnemyHazardContactResult | null;
          playFlipSfx: boolean;
          events: GameplayEvent[];
          resolveDelayMs: number | null;
      };

export const createRunSurfaceReset = (): RunSurfaceState => ({
    boardPinMode: false,
    destroyPairArmed: false,
    peekModeArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null,
    dungeonExitPromptOpen: false,
    shopReturnMode: null,
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
            destroyPairArmed: false,
            peekModeArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        },
        playArmSfx: next
    };
};

export const createDestroyPairArmedToggleResult = ({
    destroyPairArmed,
    run,
    view
}: {
    destroyPairArmed: boolean;
    run: RunState | null;
    view: ViewState;
}): RunSurfaceToggleResult => {
    const next = !destroyPairArmed;

    if (
        next &&
        (!run ||
            view !== 'playing' ||
            run.status !== 'playing' ||
            run.activeContract?.noDestroy ||
            run.destroyPairCharges <= 0 ||
            !run.board ||
            run.board.flippedTileIds.length > 0 ||
            collectDestroyEligibleTileIds(run.board).size === 0)
    ) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            boardPinMode: false,
            destroyPairArmed: next,
            peekModeArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
        },
        playArmSfx: next
    };
};

export const createPeekModeToggleResult = ({
    boardPinMode,
    destroyPairArmed,
    peekModeArmed,
    tileSwapArmed = false,
    run,
    view
}: {
    boardPinMode: boolean;
    destroyPairArmed: boolean;
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
        destroyPairArmed ||
        tileSwapArmed
    ) {
        return { kind: 'ignored' };
    }

    const next = !peekModeArmed;
    const nextRun = run.strayRemoveArmed ? { ...run, strayRemoveArmed: false } : run;

    return {
        kind: 'applied',
        patch: {
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: next,
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            run: nextRun
        },
        playArmSfx: next
    };
};

export const createTileSwapToggleResult = ({
    destroyPairArmed,
    peekModeArmed,
    run,
    tileSwapArmed = false,
    view
}: {
    destroyPairArmed: boolean;
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
            (run.regionShuffleCharges <= 0 &&
                !(run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))) ||
            !run.board ||
            run.board.tiles.filter((tile) => tile.state === 'hidden').length < 2 ||
            destroyPairArmed ||
            peekModeArmed)
    ) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            tileSwapArmed: next,
            tileSwapFirstTileId: null
        },
        playArmSfx: next
    };
};

export const createStrayArmToggleResult = ({
    run,
    view
}: {
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'playing') {
        return { kind: 'ignored' };
    }

    const wasArmed = run.strayRemoveArmed;
    const nextRun = toggleStrayRemoveArmed(run);
    if (nextRun === run) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: createRunWithArmedModesClearedPatch(nextRun),
        playArmSfx: nextRun.strayRemoveArmed && !wasArmed
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

export const createRegionShuffleArmSurfaceResult = ({
    row,
    run,
    view
}: {
    row: number | null;
    run: RunState | null;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'playing') {
        return { kind: 'ignored' };
    }

    const nextRun = armRegionShuffleRow(run, row);
    return nextRun === run
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: createRunWithArmedModesClearedPatch(nextRun),
              playArmSfx: false
          };
};

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

    const command = createGameplayRegionShuffleCommand(
        `region-shuffle:${run.runSeed}:${run.board?.level ?? 0}:${run.shuffleNonce}:${row}`,
        row
    );
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

    const nextRun = applyFlashPair(run);
    return nextRun === run
        ? { kind: 'ignored' }
        : { kind: 'applied', patch: { run: nextRun }, playArmSfx: true };
};

export const createBoardPowerContactPolicy = ({
    boardPinMode,
    destroyPairArmed,
    peekModeArmed,
    tileSwapArmed,
    strayRemoveArmed
}: {
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    peekModeArmed: boolean;
    tileSwapArmed?: boolean;
    strayRemoveArmed: boolean;
}): {
    armedPowerCount: number;
    canContinueSinglePowerAfterContact: boolean;
} => {
    const armedPowerCount = [strayRemoveArmed, peekModeArmed, destroyPairArmed, tileSwapArmed].filter(Boolean).length;

    return {
        armedPowerCount,
        canContinueSinglePowerAfterContact: !boardPinMode && armedPowerCount === 1
    };
};

export const createArmedBoardPowerPressResult = ({
    canContinueSinglePowerAfterContact,
    destroyPairArmed,
    enemyContacted,
    peekModeArmed,
    run,
    tileSwapArmed = false,
    tileSwapFirstTileId = null,
    tileId
}: {
    canContinueSinglePowerAfterContact: boolean;
    destroyPairArmed: boolean;
    enemyContacted: boolean;
    peekModeArmed: boolean;
    run: RunState;
    tileSwapArmed?: boolean;
    tileSwapFirstTileId?: string | null;
    tileId: string;
}): ArmedBoardPowerPressResult => {
    const canApplyAfterContact = !enemyContacted || canContinueSinglePowerAfterContact;

    if (canApplyAfterContact && run.strayRemoveArmed) {
        const command = createGameplayStrayRemoveCommand(
            `stray-remove:${run.runSeed}:${run.board?.level ?? 0}:${run.strayRemoveCharges}:${tileId}`,
            tileId
        );
        const result = reduceGameplayCommand(run, command);
        if (result.accepted) {
            return {
                kind: 'strayApplied',
                run: appendGameplayJournal(result.run, [command], result.events)
            };
        }
        return enemyContacted ? { kind: 'persistEnemyContact', run } : { kind: 'handled' };
    }

    if (canApplyAfterContact && tileSwapArmed) {
        const tile = run.board?.tiles.find((candidate) => candidate.id === tileId);
        if (!tile || tile.state !== 'hidden') {
            return enemyContacted ? { kind: 'persistEnemyContact', run } : { kind: 'handled' };
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

    if (
        canApplyAfterContact &&
        peekModeArmed &&
        run.peekCharges > 0 &&
        run.board &&
        run.board.flippedTileIds.length === 0
    ) {
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

    if (canApplyAfterContact && destroyPairArmed) {
        const nextRun = applyDestroyPair(run, tileId);
        if (nextRun === run) {
            return enemyContacted ? { kind: 'persistEnemyContact', run } : { kind: 'handled' };
        }

        return {
            kind: 'destroyApplied',
            run: nextRun,
            resolvesRun: nextRun.status === 'levelComplete' || nextRun.status === 'gameOver'
        };
    }

    return { kind: 'notArmed' };
};

export const createOrdinaryTileFlipResult = ({
    enemyContacted,
    flippedBefore,
    pressedTileBefore,
    run,
    tileId
}: {
    enemyContacted: boolean;
    flippedBefore: number;
    pressedTileBefore: Tile | null;
    run: RunState;
    tileId: string;
}): OrdinaryTileFlipResult => {
    const nextRun = flipTile(run, tileId);

    if (nextRun === run) {
        return {
            kind: 'unchanged',
            clearBoardInteraction: enemyContacted,
            run
        };
    }

    const flippedAfter = nextRun.board?.flippedTileIds.length ?? 0;
    const pressedTileAfter = nextRun.board?.tiles.find((tile) => tile.id === tileId) ?? null;
    const pressedTileBecameFaceUp =
        pressedTileBefore?.state === 'hidden' && pressedTileAfter?.state === 'flipped';

    return {
        kind: 'flipped',
        run: nextRun,
        playFlipSfx: flippedAfter > flippedBefore || pressedTileBecameFaceUp,
        playTrapSfx: nextRun.dungeonTrapsTriggered > run.dungeonTrapsTriggered,
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
    const hazardRun = applyEnemyHazardClick(run, tileId, { advanceHazards: false });
    const hazardContact = hazardRun !== run ? { fromRun: run, toRun: hazardRun } : null;

    if (hazardRun.status === 'gameOver') {
        return {
            kind: 'hazardGameOver',
            run: hazardRun,
            hazardContact: hazardContact ?? { fromRun: run, toRun: hazardRun }
        };
    }

    const actionRun = hazardRun;
    const command = createGameplayGambitCommitCommand(
        `gambit-commit:${actionRun.runSeed}:${actionRun.board?.level ?? 0}:${actionRun.board?.flippedTileIds.join('+') ?? 'none'}:${tileId}`,
        tileId
    );
    const commandResult = reduceGameplayCommand(actionRun, command);
    if (!commandResult.accepted) {
        return { kind: 'unchanged', hazardContact };
    }
    const flippedBefore = actionRun.board?.flippedTileIds.length ?? 0;
    const transitionedRun = flipTile(actionRun, tileId);

    const flippedAfter = transitionedRun.board?.flippedTileIds.length ?? 0;
    const committed =
        transitionedRun !== actionRun &&
        flippedAfter === 3 &&
        transitionedRun.board?.flippedTileIds.includes(tileId) === true;
    if (!committed && transitionedRun.status === 'gameOver') {
        return {
            kind: 'flipGameOver',
            run: transitionedRun,
            hazardContact,
            playFlipSfx: flippedAfter > flippedBefore,
            events: []
        };
    }
    if (!committed) {
        return { kind: 'unchanged', hazardContact };
    }

    const nextRun = appendGameplayJournal(transitionedRun, [command], commandResult.events);
    const playFlipSfx = flippedAfter > flippedBefore;

    if (nextRun.status === 'gameOver') {
        return {
            kind: 'flipGameOver',
            run: nextRun,
            hazardContact,
            playFlipSfx,
            events: commandResult.events
        };
    }

    return {
        kind: 'flipped',
        run: nextRun,
        hazardContact,
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
    'boardPinMode' | 'destroyPairArmed' | 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'
> => ({
    boardPinMode: false,
    destroyPairArmed: false,
    peekModeArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithPeekDisarmedPatch = (
    run: RunState
): Pick<RunSurfaceState, 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & { run: RunState } => ({
    run,
    peekModeArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithBoardPowersDisarmedPatch = (
    run: RunState
): Pick<RunSurfaceState, 'destroyPairArmed' | 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & { run: RunState } => ({
    run,
    destroyPairArmed: false,
    peekModeArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithArmedModesClearedPatch = (
    run: RunState
): Pick<RunSurfaceState, 'boardPinMode' | 'destroyPairArmed' | 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & {
    run: RunState;
} => ({
    run,
    ...clearRunSurfaceArmedModes()
});

export const createRunWithBoardInteractionClearedPatch = (
    run: RunState
): Pick<
    RunSurfaceState,
    'boardPinMode' | 'destroyPairArmed' | 'matchScorePop' | 'mismatchScorePop' | 'peekModeArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'
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
