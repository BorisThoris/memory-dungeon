import type { RunState } from '../../shared/contracts';
import type {
    PlayingTilePressSurfaceResult,
    TilePressAudioCue
} from './tilePressController';

type ApplyResolvedRunPatch = NonNullable<
    Extract<PlayingTilePressSurfaceResult, { kind: 'applyResolvedRun' }>['patch']
>;
type TilePressPatch = Extract<PlayingTilePressSurfaceResult, { kind: 'patch' }>['patch'];
type TilePressStorePatch = ApplyResolvedRunPatch | TilePressPatch;

export interface PlayingTilePressResultApplierDeps {
    applyImmediateGameOverFromTilePress: (run: RunState) => void;
    applyResolvedRun: (run: RunState) => void;
    clearAllTimers: () => void;
    freezeRunSnapshotForPlayingMetaOverlay: (run: RunState) => RunState;
    playTilePressAudioCues: (audio: readonly TilePressAudioCue[]) => void;
    scheduleResolveTimer: (durationMs: number) => void;
    setState: (patch: TilePressStorePatch) => void;
}

export const applyPlayingTilePressSurfaceResult = (
    result: PlayingTilePressSurfaceResult,
    deps: PlayingTilePressResultApplierDeps
): void => {
    deps.playTilePressAudioCues(result.audio);

    if (result.kind === 'ignored') {
        return;
    }

    if (result.kind === 'applyImmediateGameOver') {
        deps.applyImmediateGameOverFromTilePress(result.run);
        return;
    }

    if (result.kind === 'applyResolvedRun') {
        if (result.patch) {
            deps.setState(result.patch);
        }
        deps.applyResolvedRun(result.run);
        return;
    }

    const patch =
        result.patch.view === 'shop' && result.patch.run
            ? {
                  ...result.patch,
                  run: deps.freezeRunSnapshotForPlayingMetaOverlay(result.patch.run)
              }
            : result.patch;

    if (patch.view === 'shop') {
        deps.clearAllTimers();
    }
    deps.setState(patch);

    if (result.resolveDelayMs !== null) {
        deps.scheduleResolveTimer(result.resolveDelayMs);
    }
};
