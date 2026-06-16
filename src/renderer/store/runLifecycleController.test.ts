import { describe, expect, it, vi } from 'vitest';
import type { RunState, SaveData, Settings, ViewState } from '../../shared/contracts';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { createRunLifecycleController } from './runLifecycleController';

interface TestState {
    newlyUnlockedAchievements: string[];
    run: RunState | null;
    runStartSaveData: SaveData | null;
    saveData: SaveData;
    settings: Settings;
    settingsReturnView: ViewState;
    subscreenReturnView: ViewState;
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    view: ViewState;
}

const createHarness = (initialState?: Partial<TestState>) => {
    let state: TestState = {
        newlyUnlockedAchievements: ['ACH_FIRST_CLEAR'],
        run: null,
        runStartSaveData: null,
        saveData: createDefaultSaveData(),
        settings: createDefaultSaveData().settings,
        settingsReturnView: 'playing',
        subscreenReturnView: 'inventory',
        tileSwapArmed: true,
        tileSwapFirstTileId: 'stale-tile',
        view: 'playing',
        ...initialState
    };
    const clearAllTimers = vi.fn();
    const playRunStartSfx = vi.fn();
    const prepareMemorizeTimerForBoardReady = vi.fn();
    const scheduleDebugRevealTimer = vi.fn();
    const controller = createRunLifecycleController({
        clearAllTimers,
        getState: () => state,
        playRunStartSfx,
        prepareMemorizeTimerForBoardReady,
        scheduleDebugRevealTimer,
        setState: (patch) => {
            state = { ...state, ...patch };
        }
    });

    return {
        clearAllTimers,
        controller,
        getState: () => state,
        playRunStartSfx,
        prepareMemorizeTimerForBoardReady,
        scheduleDebugRevealTimer
    };
};

describe('runLifecycleController', () => {
    it('ends the run and normalizes transient navigation state', () => {
        const harness = createHarness({ run: createNewRun(0) });

        harness.controller.endRun();

        expect(harness.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(harness.getState()).toMatchObject({
            newlyUnlockedAchievements: [],
            run: null,
            runStartSaveData: null,
            settingsReturnView: 'menu',
            subscreenReturnView: 'menu',
            tileSwapArmed: false,
            tileSwapFirstTileId: null,
            view: 'menu'
        });
    });

    it('restarts from the previous run shape and prepares memorize timers', () => {
        const previousRun = createNewRun(99, { practiceMode: true });
        const harness = createHarness({ run: previousRun });

        harness.controller.restartRun();

        expect(harness.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(harness.playRunStartSfx).toHaveBeenCalledTimes(1);
        expect(harness.getState().run?.practiceMode).toBe(true);
        expect(harness.getState().runStartSaveData).toBe(harness.getState().saveData);
        expect(harness.prepareMemorizeTimerForBoardReady).toHaveBeenCalledWith(harness.getState().run);
    });

    it('ignores debug reveal unless a playing run and debug flag are active', () => {
        const harness = createHarness({ run: createNewRun(0) });

        harness.controller.triggerDebugReveal();

        expect(harness.scheduleDebugRevealTimer).not.toHaveBeenCalled();
    });

    it('enables debug reveal and schedules the debug timer for eligible runs', () => {
        const playingRun = finishMemorizePhase(createNewRun(0));
        const harness = createHarness({
            run: playingRun,
            settings: {
                ...createDefaultSaveData().settings,
                debugFlags: {
                    allowBoardReveal: true,
                    disableAchievementsOnDebug: true,
                    showDebugTools: true
                }
            }
        });

        harness.controller.triggerDebugReveal();

        expect(harness.getState().run?.debugPeekActive).toBe(true);
        expect(harness.getState().run?.achievementsEnabled).toBe(false);
        expect(harness.scheduleDebugRevealTimer).toHaveBeenCalledWith(expect.any(Number));
    });
});
