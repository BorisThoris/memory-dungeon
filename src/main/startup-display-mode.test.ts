import { describe, expect, it, vi } from 'vitest';
import { resolveStartupDisplayMode } from './startup-display-mode';

describe('resolveStartupDisplayMode', () => {
    it('uses the persisted display mode when the startup read succeeds', () => {
        expect(resolveStartupDisplayMode({ getSettings: () => ({ displayMode: 'fullscreen' }) })).toBe('fullscreen');
    });

    it('opens a windowed recovery shell when the startup save read fails', () => {
        const error = new Error('future save schema');
        const reportError = vi.fn();

        expect(
            resolveStartupDisplayMode(
                {
                    getSettings: () => {
                        throw error;
                    }
                },
                reportError
            )
        ).toBe('windowed');
        expect(reportError).toHaveBeenCalledWith(error);
    });
});

