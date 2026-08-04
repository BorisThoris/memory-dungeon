import type { RunState, Tile, ViewState } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import {
    createGameplayEnemyHazardContactCommand,
    createGameplayDungeonExitActivateCommand,
    createGameplayFlashPairCommand,
    createGameplayGambitCommitCommand,
    createGameplayPeekCommand,
    createGameplayRegionShuffleCommand,
    createGameplayShuffleCommand,
    createGameplayStrayRemoveCommand,
    createGameplayTileSwapCommand,
    createGameplayUndoResolveCommand
} from '../../shared/gameplay-core-contracts';
import {
    applyDestroyPairThroughGameplayCore,
    applyTileFlipThroughGameplayCore,
    executeGameplayCommandThroughGameplayCore
} from '../../shared/gameplay-core-adapters';
import {
    chooseDungeonExitActivationSpend,
    type DungeonExitActivationSpend
} from '../../shared/dungeon-exit-rules';
import { getDungeonExitStatus } from '../../shared/dungeon-board-status';
import { collectDestroyEligibleTileIds } from '../../shared/board-powers';
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
    strayRemoveArmed: boolean;
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
          patch: Pick<RunSurfaceState, 'boardPinMode' | 'destroyPairArmed' | 'peekModeArmed' | 'strayRemoveArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & {
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
    | { kind: 'destroyApplied'; run: RunState; resolvesRun: boolean; events: GameplayEvent[] };

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

export const applyEnemyHazardContactThroughGameplayCore = (
    run: RunState,
    tileId: string,
    advanceHazards: boolean
): { run: RunState; contacted: boolean; events: GameplayEvent[] } => {
    const command = createGameplayEnemyHazardContactCommand(
        `enemy-contact:${run.runSeed}:${run.board?.level ?? 0}:${run.enemyHazardHitsThisFloor ?? 0}:${advanceHazards ? 'advance' : 'hold'}:${tileId}`,
        tileId,
        advanceHazards
    );
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    return result.accepted
        ? {
              run: result.run,
              contacted: true,
              events: result.events
          }
        : { run, contacted: false, events: [] };
};

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
          playTrapSfx: boolean;
          events: GameplayEvent[];
      }
    | {
          kind: 'flipped';
          run: RunState;
          hazardContact: EnemyHazardContactResult | null;
          playFlipSfx: boolean;
          playTrapSfx: boolean;
          events: GameplayEvent[];
          resolveDelayMs: number | null;
      };

export const createRunSurfaceReset = (): RunSurfaceState => ({
    boardPinMode: false,
    destroyPairArmed: false,
    peekModeArmed: false,
    strayRemoveArmed: false,
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
            strayRemoveArmed: false,
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
            strayRemoveArmed: false,
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

    return {
        kind: 'applied',
        patch: {
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: next,
            strayRemoveArmed: false,
            tileSwapArmed: false,
            tileSwapFirstTileId: null
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
            strayRemoveArmed: false,
            tileSwapArmed: next,
            tileSwapFirstTileId: null
        },
        playArmSfx: next
    };
};

export const createStrayArmToggleResult = ({
    strayRemoveArmed = false,
    run,
    view
}: {
    strayRemoveArmed?: boolean;
    run: RunState | null;
    view: ViewState;
}): RunSurfaceToggleResult => {
    if (!run || view !== 'playing' || run.status !== 'playing' || run.strayRemoveCharges < 1) {
        return { kind: 'ignored' };
    }

    const next = !strayRemoveArmed;

    return {
        kind: 'applied',
        patch: {
            ...clearRunSurfaceArmedModes(),
            strayRemoveArmed: next
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
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: result.run },
              playArmSfx: false,
              events: result.events
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
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: createRunWithArmedModesClearedPatch(result.run),
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
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: result.run },
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
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: result.run },
              playArmSfx: false,
              events: result.events
          };
};

export const createDungeonExitActivationSurfaceResult = ({
    run,
    spend,
    view
}: {
    run: RunState | null;
    spend?: DungeonExitActivationSpend;
    view: ViewState;
}): RunSurfaceRunPatchResult => {
    if (!run || view !== 'playing' || run.status !== 'playing') {
        return { kind: 'ignored' };
    }
    const resolvedSpend = spend ?? chooseDungeonExitActivationSpend(getDungeonExitStatus(run));
    const command = createGameplayDungeonExitActivateCommand(
        `dungeon-exit:${run.runSeed}:${run.board?.level ?? 0}:${run.dungeonGatewaysUsed}:${resolvedSpend}`,
        resolvedSpend
    );
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: result.run },
              playArmSfx: false,
              events: result.events
          };
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
    strayRemoveArmed = false,
    tileSwapArmed = false,
    tileSwapFirstTileId = null,
    tileId
}: {
    canContinueSinglePowerAfterContact: boolean;
    destroyPairArmed: boolean;
    enemyContacted: boolean;
    peekModeArmed: boolean;
    run: RunState;
    strayRemoveArmed?: boolean;
    tileSwapArmed?: boolean;
    tileSwapFirstTileId?: string | null;
    tileId: string;
}): ArmedBoardPowerPressResult => {
    const canApplyAfterContact = !enemyContacted || canContinueSinglePowerAfterContact;

    if (canApplyAfterContact && strayRemoveArmed) {
        const command = createGameplayStrayRemoveCommand(
            `stray-remove:${run.runSeed}:${run.board?.level ?? 0}:${run.strayRemoveCharges}:${tileId}`,
            tileId
        );
        const result = executeGameplayCommandThroughGameplayCore(run, command);
        if (result.accepted) {
            return {
                kind: 'strayApplied',
                run: result.run
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
        const result = executeGameplayCommandThroughGameplayCore(run, command);
        return !result.accepted
            ? { kind: 'handled' }
            : {
                  kind: 'tileSwapApplied',
                  run: result.run,
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
        const result = executeGameplayCommandThroughGameplayCore(run, command);
        return result.accepted
            ? {
                  kind: 'peekApplied',
                  run: result.run,
                  events: result.events
              }
            : { kind: 'handled' };
    }

    if (canApplyAfterContact && destroyPairArmed) {
        const result = applyDestroyPairThroughGameplayCore(run, tileId);
        if (!result.accepted) {
            return enemyContacted ? { kind: 'persistEnemyContact', run } : { kind: 'handled' };
        }

        return {
            kind: 'destroyApplied',
            run: result.run,
            resolvesRun: result.run.status === 'levelComplete' || result.run.status === 'gameOver',
            events: result.events
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
    const transition = applyTileFlipThroughGameplayCore(run, tileId);
    const nextRun = transition.run;

    if (!transition.accepted) {
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
    const contact = applyEnemyHazardContactThroughGameplayCore(run, tileId, false);
    const hazardRun = contact.run;
    const hazardContact = contact.contacted ? { fromRun: run, toRun: hazardRun } : null;

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
    const commandResult = executeGameplayCommandThroughGameplayCore(actionRun, command);
    if (!commandResult.accepted) {
        return { kind: 'unchanged', hazardContact };
    }
    const intentRun = commandResult.run;
    const flippedBefore = actionRun.board?.flippedTileIds.length ?? 0;
    const flipTransition = applyTileFlipThroughGameplayCore(intentRun, tileId);
    const transitionedRun = flipTransition.run;

    const flippedAfter = transitionedRun.board?.flippedTileIds.length ?? 0;
    const pressedTileAfter = transitionedRun.board?.tiles.find((tile) => tile.id === tileId) ?? null;
    const pressedTileBecameFaceUp =
        actionRun.board?.tiles.find((tile) => tile.id === tileId)?.state === 'hidden' &&
        pressedTileAfter?.state === 'flipped';
    const playFlipSfx = flippedAfter > flippedBefore || pressedTileBecameFaceUp;
    const playTrapSfx = transitionedRun.dungeonTrapsTriggered > actionRun.dungeonTrapsTriggered;
    const committed =
        transitionedRun !== intentRun &&
        flippedAfter === 3 &&
        transitionedRun.board?.flippedTileIds.includes(tileId) === true;
    if (!committed && transitionedRun.status === 'gameOver') {
        return {
            kind: 'flipGameOver',
            run: transitionedRun,
            hazardContact,
            playFlipSfx,
            playTrapSfx,
            events: commandResult.events
        };
    }
    if (!committed) {
        return transitionedRun === intentRun
            ? { kind: 'unchanged', hazardContact }
            : {
                  kind: 'flipped',
                  run: transitionedRun,
                  hazardContact,
                  playFlipSfx,
                  playTrapSfx,
                  events: commandResult.events,
                  resolveDelayMs:
                      transitionedRun.status === 'resolving' && transitionedRun.timerState.resolveRemainingMs !== null
                          ? transitionedRun.timerState.resolveRemainingMs
                          : null
              };
    }

    const nextRun = transitionedRun;

    if (nextRun.status === 'gameOver') {
        return {
            kind: 'flipGameOver',
            run: nextRun,
            hazardContact,
            playFlipSfx,
            playTrapSfx,
            events: commandResult.events
        };
    }

    return {
        kind: 'flipped',
        run: nextRun,
        hazardContact,
        playFlipSfx,
        playTrapSfx,
        events: commandResult.events,
        resolveDelayMs:
            nextRun.status === 'resolving' && nextRun.timerState.resolveRemainingMs !== null
                ? nextRun.timerState.resolveRemainingMs
                : null
    };
};

export const clearRunSurfaceArmedModes = (): Pick<
    RunSurfaceState,
    'boardPinMode' | 'destroyPairArmed' | 'peekModeArmed' | 'strayRemoveArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'
> => ({
    boardPinMode: false,
    destroyPairArmed: false,
    peekModeArmed: false,
    strayRemoveArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithPeekDisarmedPatch = (
    run: RunState
): Pick<RunSurfaceState, 'peekModeArmed' | 'strayRemoveArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & { run: RunState } => ({
    run,
    peekModeArmed: false,
    strayRemoveArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithBoardPowersDisarmedPatch = (
    run: RunState
): Pick<RunSurfaceState, 'destroyPairArmed' | 'peekModeArmed' | 'strayRemoveArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & { run: RunState } => ({
    run,
    destroyPairArmed: false,
    peekModeArmed: false,
    strayRemoveArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
});

export const createRunWithArmedModesClearedPatch = (
    run: RunState
): Pick<RunSurfaceState, 'boardPinMode' | 'destroyPairArmed' | 'peekModeArmed' | 'strayRemoveArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'> & {
    run: RunState;
} => ({
    run,
    ...clearRunSurfaceArmedModes()
});

export const createRunWithBoardInteractionClearedPatch = (
    run: RunState
): Pick<
    RunSurfaceState,
    'boardPinMode' | 'destroyPairArmed' | 'matchScorePop' | 'mismatchScorePop' | 'peekModeArmed' | 'strayRemoveArmed' | 'tileSwapArmed' | 'tileSwapFirstTileId'
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
