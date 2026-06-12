import { describe, expect, it, vi } from 'vitest';
import { createNewRun } from '../../shared/run-creation-rules';
import {
    applyPlayingTilePressSurfaceResult,
    type PlayingTilePressResultApplierDeps
} from './playingTilePressResultApplier';
import type { PlayingTilePressSurfaceResult } from './tilePressController';

const createDeps = (): PlayingTilePressResultApplierDeps => ({
    applyImmediateGameOverFromTilePress: vi.fn(),
    applyResolvedRun: vi.fn(),
    clearAllTimers: vi.fn(),
    freezeRunSnapshotForPlayingMetaOverlay: vi.fn((run) => ({ ...run, status: 'paused' })),
    playTilePressAudioCues: vi.fn(),
    scheduleResolveTimer: vi.fn(),
    setState: vi.fn()
});

describe('applyPlayingTilePressSurfaceResult', () => {
    it('plays audio but otherwise ignores ignored results', () => {
        const deps = createDeps();
        const result: PlayingTilePressSurfaceResult = {
            audio: [{ kind: 'flip' }],
            kind: 'ignored'
        };

        applyPlayingTilePressSurfaceResult(result, deps);

        expect(deps.playTilePressAudioCues).toHaveBeenCalledWith(result.audio);
        expect(deps.setState).not.toHaveBeenCalled();
        expect(deps.applyResolvedRun).not.toHaveBeenCalled();
    });

    it('applies optional patch before resolved run routing', () => {
        const deps = createDeps();
        const run = createNewRun(0, { echoFeedbackEnabled: false });
        const result: PlayingTilePressSurfaceResult = {
            audio: [],
            kind: 'applyResolvedRun',
            patch: { peekModeArmed: false },
            run
        };

        applyPlayingTilePressSurfaceResult(result, deps);

        expect(deps.setState).toHaveBeenCalledWith({ peekModeArmed: false });
        expect(deps.applyResolvedRun).toHaveBeenCalledWith(run);
    });

    it('freezes shop patches and clears timers', () => {
        const deps = createDeps();
        const run = createNewRun(0, { echoFeedbackEnabled: false });
        const result: PlayingTilePressSurfaceResult = {
            audio: [],
            kind: 'patch',
            patch: { run, view: 'shop' },
            resolveDelayMs: null
        };

        applyPlayingTilePressSurfaceResult(result, deps);

        expect(deps.freezeRunSnapshotForPlayingMetaOverlay).toHaveBeenCalledWith(run);
        expect(deps.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(deps.setState).toHaveBeenCalledWith({ run: { ...run, status: 'paused' }, view: 'shop' });
    });

    it('schedules resolve timer for patch results with a delay', () => {
        const deps = createDeps();
        const result: PlayingTilePressSurfaceResult = {
            audio: [],
            kind: 'patch',
            patch: { peekModeArmed: false },
            resolveDelayMs: 350
        };

        applyPlayingTilePressSurfaceResult(result, deps);

        expect(deps.setState).toHaveBeenCalledWith({ peekModeArmed: false });
        expect(deps.scheduleResolveTimer).toHaveBeenCalledWith(350);
    });
});
