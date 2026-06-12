import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import {
    executeRunStartRequest,
    type RunStartExecutorDeps
} from './runStartExecutor';

const createDeps = (): RunStartExecutorDeps => {
    const saveData = createDefaultSaveData();
    return {
        clearAllTimers: vi.fn(),
        getState: vi.fn(() => ({
            saveData,
            settings: saveData.settings
        })),
        playRunStartSfx: vi.fn(),
        prepareMemorizeTimerForBoardReady: vi.fn(),
        setState: vi.fn(),
        trackRunStart: vi.fn()
    };
};

describe('executeRunStartRequest', () => {
    it('executes the side effects for a valid run start plan', () => {
        const deps = createDeps();

        executeRunStartRequest({ kind: 'endless' }, deps);

        expect(deps.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(deps.trackRunStart).toHaveBeenCalledWith({
            mode: 'endless',
            practice: false
        });
        expect(deps.playRunStartSfx).toHaveBeenCalledTimes(1);
        expect(deps.setState).toHaveBeenCalledWith(expect.objectContaining({ view: 'playing' }));
        expect(deps.prepareMemorizeTimerForBoardReady).toHaveBeenCalledWith(
            expect.objectContaining({ gameMode: 'endless' })
        );
    });

    it('does nothing when the run start request cannot create a plan', () => {
        const deps = createDeps();

        executeRunStartRequest({ kind: 'puzzle', puzzleId: 'missing' }, deps);

        expect(deps.clearAllTimers).not.toHaveBeenCalled();
        expect(deps.trackRunStart).not.toHaveBeenCalled();
        expect(deps.playRunStartSfx).not.toHaveBeenCalled();
        expect(deps.setState).not.toHaveBeenCalled();
        expect(deps.prepareMemorizeTimerForBoardReady).not.toHaveBeenCalled();
    });
});
