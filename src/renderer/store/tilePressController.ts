import type { RunState, ViewState } from '../../shared/contracts';
import { createGameplayPinToggleCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import {
    BOARD_FLOATER_POP_CLEAR,
    type MatchScorePop,
    type MismatchScorePop
} from './matchScorePop';
import { createDungeonTilePressSurfaceResult } from './dungeonPressSurfaceState';
import { projectGameplayFeedback } from './gameplayFeedbackAdapter';
import {
    clearRunSurfaceArmedModes,
    applyEnemyHazardContactThroughGameplayCore,
    createArmedBoardPowerPressResult,
    createBoardPowerContactPolicy,
    createOrdinaryTileFlipResult,
    createRunWithArmedModesClearedPatch,
    createRunWithBoardInteractionClearedPatch,
    createRunWithBoardPowersDisarmedPatch,
    createRunWithPeekDisarmedPatch
} from './runSurfaceState';

export type TilePressAudioCue =
    | { kind: 'destroyPair' }
    | { kind: 'flip' }
    | { kind: 'peekPower' }
    | { kind: 'resolveContact'; fromRun: RunState; toRun: RunState }
    | { kind: 'strayPower' }
    | { kind: 'trap' };

type TilePressPatch = Partial<{
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    dungeonExitPromptOpen: boolean;
    matchScorePop: MatchScorePop | null;
    mismatchScorePop: MismatchScorePop | null;
    peekModeArmed: boolean;
    run: RunState;
    shopReturnMode: 'floor' | 'summary' | null;
    strayRemoveArmed: boolean;
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    view: ViewState;
}>;

export type PlayingTilePressSurfaceResult =
    | { kind: 'ignored'; audio: TilePressAudioCue[] }
    | { kind: 'applyImmediateGameOver'; run: RunState; audio: TilePressAudioCue[] }
    | { kind: 'applyResolvedRun'; run: RunState; audio: TilePressAudioCue[]; patch?: TilePressPatch }
    | { kind: 'patch'; patch: TilePressPatch; audio: TilePressAudioCue[]; resolveDelayMs: number | null };

export const createPlayingTilePressSurfaceResult = ({
    boardPinMode,
    destroyPairArmed,
    peekModeArmed,
    run,
    strayRemoveArmed = false,
    tileSwapArmed = false,
    tileSwapFirstTileId = null,
    tileId
}: {
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    peekModeArmed: boolean;
    run: RunState;
    strayRemoveArmed?: boolean;
    tileSwapArmed?: boolean;
    tileSwapFirstTileId?: string | null;
    tileId: string;
}): PlayingTilePressSurfaceResult => {
    const audio: TilePressAudioCue[] = [];
    const { canContinueSinglePowerAfterContact } = createBoardPowerContactPolicy({
        boardPinMode,
        destroyPairArmed,
        peekModeArmed,
        tileSwapArmed,
        strayRemoveArmed
    });
    let actionRun = run;
    let pressedTile = actionRun.board?.tiles.find((tile) => tile.id === tileId) ?? null;
    const flippedBefore = actionRun.board?.flippedTileIds.length ?? 0;
    const contact = applyEnemyHazardContactThroughGameplayCore(actionRun, tileId, flippedBefore === 0);
    const hazardRun = contact.run;
    const enemyContacted = contact.contacted;

    if (enemyContacted) {
        audio.push({ kind: 'resolveContact', fromRun: run, toRun: hazardRun });
        if (hazardRun.status === 'gameOver') {
            return {
                kind: 'applyResolvedRun',
                run: hazardRun,
                audio,
                patch: {
                    ...clearRunSurfaceArmedModes(),
                    ...BOARD_FLOATER_POP_CLEAR
                }
            };
        }
        actionRun = hazardRun;
        pressedTile = actionRun.board?.tiles.find((tile) => tile.id === tileId) ?? pressedTile;
    }

    const dungeonTileResult = createDungeonTilePressSurfaceResult({
        pairKey: pressedTile?.pairKey,
        run: actionRun,
        tileId
    });
    if (dungeonTileResult.kind !== 'notDungeonTile') {
        if (dungeonTileResult.kind === 'ignored') {
            return { kind: 'ignored', audio };
        }
        if (dungeonTileResult.playFlipSfx) {
            audio.push({ kind: 'flip' });
        }
        if (dungeonTileResult.kind === 'exitPrompt') {
            return {
                kind: 'patch',
                patch: {
                    ...createRunWithArmedModesClearedPatch(dungeonTileResult.run),
                    dungeonExitPromptOpen: true
                },
                audio,
                resolveDelayMs: null
            };
        }
        if (dungeonTileResult.kind === 'shop') {
            return {
                kind: 'patch',
                patch: {
                    ...createRunWithBoardInteractionClearedPatch(dungeonTileResult.run),
                    view: 'shop',
                    shopReturnMode: 'floor'
                },
                audio,
                resolveDelayMs: null
            };
        }
        return {
            kind: 'patch',
            patch: createRunWithArmedModesClearedPatch(dungeonTileResult.run),
            audio,
            resolveDelayMs: null
        };
    }

    if (!enemyContacted && boardPinMode) {
        const command = createGameplayPinToggleCommand(
            `pin-toggle:${actionRun.runSeed}:${actionRun.board?.level ?? 0}:${Array.isArray(actionRun.pinnedTileIds) ? actionRun.pinnedTileIds.length : 0}:${tileId}`,
            tileId
        );
        const result = reduceGameplayCommand(actionRun, command);
        return !result.accepted
            ? { kind: 'ignored', audio }
            : {
                  kind: 'patch',
                  patch: { run: appendGameplayJournal(result.run, [command], result.events) },
                  audio,
                  resolveDelayMs: null
              };
    }

    const armedPowerPressResult = createArmedBoardPowerPressResult({
        canContinueSinglePowerAfterContact,
        destroyPairArmed,
        enemyContacted,
        peekModeArmed,
        run: actionRun,
        strayRemoveArmed,
        tileSwapArmed,
        tileSwapFirstTileId,
        tileId
    });
    if (armedPowerPressResult.kind !== 'notArmed') {
        if (armedPowerPressResult.kind === 'handled') {
            if (enemyContacted) {
                return { kind: 'patch', patch: { run: actionRun }, audio, resolveDelayMs: null };
            }
            return { kind: 'ignored', audio };
        }
        if (armedPowerPressResult.kind === 'persistEnemyContact') {
            return { kind: 'patch', patch: { run: armedPowerPressResult.run }, audio, resolveDelayMs: null };
        }
        if (armedPowerPressResult.kind === 'strayApplied') {
            audio.push({ kind: 'strayPower' });
            return {
                kind: 'patch',
                patch: { run: armedPowerPressResult.run, strayRemoveArmed: false },
                audio,
                resolveDelayMs: null
            };
        }
        if (armedPowerPressResult.kind === 'peekApplied') {
            if (projectGameplayFeedback(armedPowerPressResult.events).some((feedback) => feedback.audioCategory === 'peek')) {
                audio.push({ kind: 'peekPower' });
            }
            return {
                kind: 'patch',
                patch: createRunWithPeekDisarmedPatch(armedPowerPressResult.run),
                audio,
                resolveDelayMs: null
            };
        }
        if (armedPowerPressResult.kind === 'tileSwapFirstSelected') {
            return {
                kind: 'patch',
                patch: {
                    ...(enemyContacted ? { run: actionRun } : {}),
                    tileSwapFirstTileId: armedPowerPressResult.tileId
                },
                audio,
                resolveDelayMs: null
            };
        }
        if (armedPowerPressResult.kind === 'tileSwapFirstCleared') {
            return {
                kind: 'patch',
                patch: {
                    ...(enemyContacted ? { run: actionRun } : {}),
                    tileSwapFirstTileId: null
                },
                audio,
                resolveDelayMs: null
            };
        }
        if (armedPowerPressResult.kind === 'tileSwapApplied') {
            return {
                kind: 'patch',
                patch: createRunWithBoardPowersDisarmedPatch(armedPowerPressResult.run),
                audio,
                resolveDelayMs: null
            };
        }

        if (projectGameplayFeedback(armedPowerPressResult.events).some((feedback) => feedback.audioCategory === 'destroy-pair')) {
            audio.push({ kind: 'destroyPair' });
        }
        return {
            kind: armedPowerPressResult.resolvesRun ? 'applyResolvedRun' : 'patch',
            run: armedPowerPressResult.run,
            patch: createRunWithBoardPowersDisarmedPatch(armedPowerPressResult.run),
            audio,
            resolveDelayMs: null
        } as PlayingTilePressSurfaceResult;
    }

    const ordinaryFlipResult = createOrdinaryTileFlipResult({
        enemyContacted,
        flippedBefore,
        pressedTileBefore: pressedTile,
        run: actionRun,
        tileId
    });
    if (ordinaryFlipResult.kind === 'unchanged') {
        return ordinaryFlipResult.clearBoardInteraction
            ? {
                  kind: 'patch',
                  patch: createRunWithBoardInteractionClearedPatch(actionRun),
                  audio,
                  resolveDelayMs: null
              }
            : { kind: 'ignored', audio };
    }

    if (ordinaryFlipResult.playFlipSfx) {
        audio.push({ kind: 'flip' });
    }
    if (ordinaryFlipResult.playTrapSfx) {
        audio.push({ kind: 'trap' });
    }
    if (ordinaryFlipResult.gameOver) {
        return { kind: 'applyImmediateGameOver', run: ordinaryFlipResult.run, audio };
    }

    return {
        kind: 'patch',
        patch: createRunWithArmedModesClearedPatch(ordinaryFlipResult.run),
        audio,
        resolveDelayMs: ordinaryFlipResult.resolveDelayMs
    };
};
