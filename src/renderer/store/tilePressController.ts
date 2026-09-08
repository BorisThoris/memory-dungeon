import type { RunState, ViewState } from '../../shared/contracts';
import { createGameplayPinToggleCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import type { MatchScorePop, MismatchScorePop } from './matchScorePop';
import { projectGameplayFeedback } from './gameplayFeedbackAdapter';
import {
    createArmedBoardPowerPressResult,
    createOrdinaryTileFlipResult,
    createRunWithArmedModesClearedPatch,
    createRunWithBoardPowersDisarmedPatch,
    createRunWithPeekDisarmedPatch
} from './runSurfaceState';

export type TilePressAudioCue =
    | { kind: 'destroyPair' }
    | { kind: 'flip' }
    | { kind: 'peekPower' }
    | { kind: 'strayPower' };

type TilePressPatch = Partial<{
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    matchScorePop: MatchScorePop | null;
    mismatchScorePop: MismatchScorePop | null;
    peekModeArmed: boolean;
    run: RunState;
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
    regionShuffleArmed = false,
    run,
    strayRemoveArmed = false,
    tileSwapArmed = false,
    tileSwapFirstTileId = null,
    tileId
}: {
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    peekModeArmed: boolean;
    regionShuffleArmed?: boolean;
    run: RunState;
    strayRemoveArmed?: boolean;
    tileSwapArmed?: boolean;
    tileSwapFirstTileId?: string | null;
    tileId: string;
}): PlayingTilePressSurfaceResult => {
    const audio: TilePressAudioCue[] = [];
    const pressedTile = run.board?.tiles.find((tile) => tile.id === tileId) ?? null;
    const flippedBefore = run.board?.flippedTileIds.length ?? 0;

    if (boardPinMode) {
        const command = createGameplayPinToggleCommand(
            `pin-toggle:${run.runSeed}:${run.board?.level ?? 0}:${Array.isArray(run.pinnedTileIds) ? run.pinnedTileIds.length : 0}:${tileId}`,
            tileId
        );
        const result = reduceGameplayCommand(run, command);
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
        destroyPairArmed,
        peekModeArmed,
        regionShuffleArmed,
        run,
        strayRemoveArmed,
        tileSwapArmed,
        tileSwapFirstTileId,
        tileId
    });
    if (armedPowerPressResult.kind !== 'notArmed') {
        if (armedPowerPressResult.kind === 'handled') {
            return { kind: 'ignored', audio };
        }
        if (armedPowerPressResult.kind === 'strayApplied') {
            audio.push({ kind: 'strayPower' });
            // Stray remove is single-use, so it disarms once it fires. That used to happen
            // inside applyStrayRemove when the flag lived on RunState; arming is surface
            // state now, so the disarm belongs in the patch.
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
                patch: { tileSwapFirstTileId: armedPowerPressResult.tileId },
                audio,
                resolveDelayMs: null
            };
        }
        if (armedPowerPressResult.kind === 'tileSwapFirstCleared') {
            return {
                kind: 'patch',
                patch: { tileSwapFirstTileId: null },
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
        if (armedPowerPressResult.kind === 'regionShuffleApplied') {
            // Row shuffle spends its charge on the press, so it disarms the way tile swap does
            // rather than staying live for a second row.
            return {
                kind: 'patch',
                patch: createRunWithArmedModesClearedPatch(armedPowerPressResult.run),
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
        flippedBefore,
        pressedTileBefore: pressedTile,
        run,
        tileId
    });
    if (ordinaryFlipResult.kind === 'unchanged') {
        return { kind: 'ignored', audio };
    }

    if (ordinaryFlipResult.playFlipSfx) {
        audio.push({ kind: 'flip' });
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
