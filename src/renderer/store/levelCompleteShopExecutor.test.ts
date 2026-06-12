import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import {
    executeOpenShopFromLevelComplete,
    type LevelCompleteShopExecutorDeps,
    type LevelCompleteShopExecutorState
} from './levelCompleteShopExecutor';

const createState = (overrides: Partial<LevelCompleteShopExecutorState> = {}): LevelCompleteShopExecutorState => ({
    run: null,
    settingsReturnView: 'menu',
    subscreenReturnView: 'menu',
    view: 'playing',
    ...overrides
});

const createDeps = (
    state: LevelCompleteShopExecutorState
): LevelCompleteShopExecutorDeps<LevelCompleteShopExecutorState> => ({
    applyResolvedRun: vi.fn(),
    getState: vi.fn(() => state),
    setState: vi.fn()
});

describe('executeOpenShopFromLevelComplete', () => {
    it('routes dead level-complete interludes to game over resolution', () => {
        const run = {
            ...createPlayablePathFixture('sideRoomThenShop').run!,
            lives: 0,
            status: 'levelComplete' as const
        };
        const deps = createDeps(createState({ run }));

        executeOpenShopFromLevelComplete(deps);

        expect(deps.applyResolvedRun).toHaveBeenCalledWith(expect.objectContaining({
            lives: 0,
            relicOffer: null,
            shopOffers: [],
            sideRoom: null,
            status: 'gameOver'
        }));
        expect(deps.setState).not.toHaveBeenCalled();
    });

    it('ignores states that cannot open a level-complete shop', () => {
        const run = {
            ...createPlayablePathFixture('sideRoomThenShop').run!,
            status: 'playing' as const
        } as RunState;
        const deps = createDeps(createState({ run }));

        executeOpenShopFromLevelComplete(deps);

        expect(deps.applyResolvedRun).not.toHaveBeenCalled();
        expect(deps.setState).not.toHaveBeenCalled();
    });

    it('opens eligible level-complete shop runs', () => {
        const source = createPlayablePathFixture('sideRoomThenShop').run!;
        const run = { ...source, sideRoom: null };
        const deps = createDeps(createState({ run }));

        executeOpenShopFromLevelComplete(deps);

        expect(deps.setState).toHaveBeenCalledWith({
            shopReturnMode: 'summary',
            view: 'shop'
        });
    });
});
