import { describe, expect, it, vi } from 'vitest';
import {
    FATAL_STARTUP_MESSAGE,
    FATAL_STARTUP_TITLE,
    handleFatalStartupFailure,
    runMainProcessAction
} from './fatal-startup';

describe('fatal startup handling', () => {
    it('logs the original failure but shows fixed native copy before quitting', () => {
        const error = new Error('/private/path/service failed');
        const operations = {
            quit: vi.fn(),
            reportError: vi.fn(),
            showError: vi.fn()
        };

        handleFatalStartupFailure(error, operations);

        expect(operations.reportError).toHaveBeenCalledWith(error);
        expect(operations.showError).toHaveBeenCalledWith(FATAL_STARTUP_TITLE, FATAL_STARTUP_MESSAGE);
        expect(FATAL_STARTUP_MESSAGE).not.toContain(error.message);
        expect(operations.quit).toHaveBeenCalledTimes(1);
    });

    it('reports synchronous lifecycle failures and returns false', () => {
        const error = new Error('window construction failed');
        const onFailure = vi.fn();

        expect(
            runMainProcessAction(() => {
                throw error;
            }, onFailure)
        ).toBe(false);
        expect(onFailure).toHaveBeenCalledWith(error);
    });

    it('continues fatal cleanup without throwing when diagnostics or native UI fail', () => {
        const quit = vi.fn();

        expect(() =>
            handleFatalStartupFailure(new Error('startup failed'), {
                reportError: () => {
                    throw new Error('logger failed');
                },
                showError: () => {
                    throw new Error('dialog failed');
                },
                quit
            })
        ).not.toThrow();
        expect(quit).toHaveBeenCalledTimes(1);
    });

    it('returns true without invoking failure handling after a successful action', () => {
        const action = vi.fn();
        const onFailure = vi.fn();

        expect(runMainProcessAction(action, onFailure)).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
        expect(onFailure).not.toHaveBeenCalled();
    });
});
