import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/run-creation-rules';
import {
    executeMetaOverlayClose,
    executeMetaOverlayOpen,
    type MetaOverlayExecutorDeps,
    type MetaOverlayExecutorState
} from './metaOverlayExecutor';

const createPlayingRun = (): RunState => ({
    ...createNewRun(0, { echoFeedbackEnabled: false }),
    status: 'playing'
});

const createPausedRun = (): RunState => ({
    ...createPlayingRun(),
    status: 'paused',
    timerState: {
        debugRevealRemainingMs: null,
        memorizeRemainingMs: null,
        pausedFromStatus: 'playing',
        resolveRemainingMs: null
    }
});

const createState = (overrides: Partial<MetaOverlayExecutorState> = {}): MetaOverlayExecutorState => ({
    run: createPlayingRun(),
    settingsReturnView: 'menu',
    subscreenReturnView: 'menu',
    view: 'playing',
    ...overrides
});

const createDeps = (state: MetaOverlayExecutorState): MetaOverlayExecutorDeps<MetaOverlayExecutorState> => ({
    applyResolvedRun: vi.fn(),
    clearAllTimers: vi.fn(),
    freezeRunSnapshotForPlayingMetaOverlay: vi.fn((run) => ({ ...run, status: 'paused' })),
    getState: vi.fn(() => state),
    resumeRunWithTimers: vi.fn((run) => ({ ...run, status: 'playing' })),
    setState: vi.fn()
});

describe('meta overlay executors', () => {
    it('freezes the run and clears timers for in-run overlay opens', () => {
        const run = createPlayingRun();
        const deps = createDeps(createState({ run }));

        executeMetaOverlayOpen('subscreenReturnView', 'openInventoryFromPlaying', deps);

        expect(deps.freezeRunSnapshotForPlayingMetaOverlay).toHaveBeenCalledWith(run);
        expect(deps.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(deps.setState).toHaveBeenCalledWith({
            run: { ...run, status: 'paused' },
            subscreenReturnView: 'playing',
            view: 'inventory'
        });
    });

    it('keeps impossible in-run overlay opens as no-op navigation patches without freezing timers', () => {
        const deps = createDeps(createState({ run: null }));

        executeMetaOverlayOpen('subscreenReturnView', 'openInventoryFromPlaying', deps);

        expect(deps.clearAllTimers).not.toHaveBeenCalled();
        expect(deps.setState).toHaveBeenCalledWith({
            subscreenReturnView: 'playing',
            view: 'playing'
        });
    });

    it('resumes paused runs when closing back to playing', () => {
        const run = createPausedRun();
        const deps = createDeps(createState({
            run,
            subscreenReturnView: 'playing',
            view: 'inventory'
        }));

        executeMetaOverlayClose('subscreenReturnView', 'closeSubscreen', deps);

        expect(deps.resumeRunWithTimers).toHaveBeenCalledWith(run);
        expect(deps.setState).toHaveBeenCalledWith({
            run: { ...run, status: 'playing' },
            subscreenReturnView: 'playing',
            view: 'playing'
        });
    });

    it('routes resumed game-over runs through resolved-run handling', () => {
        const run = createPausedRun();
        const gameOverRun = { ...run, status: 'gameOver' as const, lives: 0 };
        const deps = {
            ...createDeps(createState({
                run,
                settingsReturnView: 'playing',
                view: 'settings'
            })),
            resumeRunWithTimers: vi.fn(() => gameOverRun)
        };

        executeMetaOverlayClose('settingsReturnView', 'closeSettings', deps);

        expect(deps.applyResolvedRun).toHaveBeenCalledWith(gameOverRun);
        expect(deps.setState).toHaveBeenCalledWith({ settingsReturnView: 'menu' });
    });
});
