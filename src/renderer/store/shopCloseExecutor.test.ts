import { describe, expect, it, vi } from 'vitest';
import { createNewRun } from '../../shared/run-creation-rules';
import {
    executeContinueFromShop,
    executeShopCloseToFloorSummary,
    type ShopCloseExecutorDeps,
    type ShopCloseExecutorState
} from './shopCloseExecutor';

const createState = (overrides: Partial<ShopCloseExecutorState> = {}): ShopCloseExecutorState => ({
    run: createNewRun(0, { echoFeedbackEnabled: false }),
    settingsReturnView: 'menu',
    shopReturnMode: 'summary',
    subscreenReturnView: 'menu',
    view: 'shop',
    ...overrides
});

const createDeps = (state: ShopCloseExecutorState): ShopCloseExecutorDeps<ShopCloseExecutorState> => ({
    applyResolvedRun: vi.fn(),
    continueToNextLevel: vi.fn(),
    getState: vi.fn(() => state),
    resumeRunWithTimers: vi.fn((run) => ({ ...run, status: 'playing' })),
    setState: vi.fn()
});

describe('executeShopCloseToFloorSummary', () => {
    it('closes the shop to the floor summary without resuming summary-return runs', () => {
        const state = createState();
        const deps = createDeps(state);

        executeShopCloseToFloorSummary(deps);

        expect(deps.resumeRunWithTimers).not.toHaveBeenCalled();
        expect(deps.setState).toHaveBeenCalledWith({
            run: state.run,
            shopReturnMode: null,
            view: 'playing'
        });
    });

    it('resumes floor-return runs before closing', () => {
        const run = {
            ...createNewRun(0, { echoFeedbackEnabled: false }),
            status: 'paused' as const,
            timerState: {
                debugRevealRemainingMs: null,
                memorizeRemainingMs: null,
                pausedFromStatus: 'playing' as const,
                resolveRemainingMs: null
            }
        };
        const state = createState({ run, shopReturnMode: 'floor' });
        const deps = createDeps(state);

        executeShopCloseToFloorSummary(deps);

        expect(deps.resumeRunWithTimers).toHaveBeenCalledWith(run);
        expect(deps.setState).toHaveBeenCalledWith({
            run: { ...run, status: 'playing' },
            shopReturnMode: null,
            view: 'playing'
        });
    });

    it('routes resumed game-over runs through resolved-run handling', () => {
        const run = createNewRun(0, { echoFeedbackEnabled: false });
        const gameOverRun = { ...run, status: 'gameOver' as const, lives: 0 };
        const state = createState({ run, shopReturnMode: 'floor' });
        const deps = {
            ...createDeps(state),
            resumeRunWithTimers: vi.fn(() => gameOverRun)
        };

        executeShopCloseToFloorSummary(deps);

        expect(deps.applyResolvedRun).toHaveBeenCalledWith(gameOverRun);
        expect(deps.setState).toHaveBeenCalledWith({ shopReturnMode: null });
    });
});

describe('executeContinueFromShop', () => {
    it('closes floor-return shops through the shop close path', () => {
        const run = {
            ...createNewRun(0, { echoFeedbackEnabled: false }),
            status: 'paused' as const,
            timerState: {
                debugRevealRemainingMs: null,
                memorizeRemainingMs: null,
                pausedFromStatus: 'playing' as const,
                resolveRemainingMs: null
            }
        };
        const deps = createDeps(createState({ run, shopReturnMode: 'floor' }));

        executeContinueFromShop(deps as ShopCloseExecutorDeps<ShopCloseExecutorState> & { continueToNextLevel: () => void });

        expect(deps.resumeRunWithTimers).toHaveBeenCalledWith(run);
        expect(deps.setState).toHaveBeenCalledWith({
            run: { ...run, status: 'playing' },
            shopReturnMode: null,
            view: 'playing'
        });
        expect(deps.continueToNextLevel).not.toHaveBeenCalled();
    });

    it('falls back to closing the shop when there is no level-complete run', () => {
        const state = createState({ run: null });
        const deps = createDeps(state);

        executeContinueFromShop(deps as ShopCloseExecutorDeps<ShopCloseExecutorState> & { continueToNextLevel: () => void });

        expect(deps.setState).toHaveBeenCalledWith({
            run: null,
            shopReturnMode: null,
            view: 'menu'
        });
        expect(deps.continueToNextLevel).not.toHaveBeenCalled();
    });

    it('resets shop return mode and continues level-complete runs', () => {
        const deps = createDeps(createState({
            run: {
                ...createNewRun(0, { echoFeedbackEnabled: false }),
                status: 'levelComplete'
            }
        }));

        executeContinueFromShop(deps as ShopCloseExecutorDeps<ShopCloseExecutorState> & { continueToNextLevel: () => void });

        expect(deps.setState).toHaveBeenCalledWith({ shopReturnMode: null });
        expect(deps.continueToNextLevel).toHaveBeenCalledTimes(1);
    });
});
