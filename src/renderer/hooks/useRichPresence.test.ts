import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRichPresence } from './useRichPresence';
import { desktopClient } from '../desktop-client';

/**
 * The hook's whole reason to exist is not sending the same presence twice: a run re-renders
 * constantly and each push is a call into the Steam client. That contract had no test.
 */

describe('useRichPresence', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('pushes once, and not again while nothing about the run has changed', () => {
        const setRichPresence = vi.spyOn(desktopClient, 'setRichPresence').mockResolvedValue(undefined);
        const { rerender } = renderHook((props: { floor: number | null }) =>
            useRichPresence({ floor: props.floor, gameMode: 'endless', inRun: true })
        , { initialProps: { floor: 3 } });

        expect(setRichPresence).toHaveBeenCalledTimes(1);

        // A caller passing a fresh object literal every render must not count as a change.
        rerender({ floor: 3 });
        rerender({ floor: 3 });
        expect(setRichPresence).toHaveBeenCalledTimes(1);
    });

    it('pushes again when the run actually moves', () => {
        const setRichPresence = vi.spyOn(desktopClient, 'setRichPresence').mockResolvedValue(undefined);
        const { rerender } = renderHook((props: { floor: number | null }) =>
            useRichPresence({ floor: props.floor, gameMode: 'endless', inRun: true })
        , { initialProps: { floor: 3 } });

        rerender({ floor: 4 });

        expect(setRichPresence).toHaveBeenCalledTimes(2);
    });

    it('does not let a rejected push reach the run', () => {
        vi.spyOn(desktopClient, 'setRichPresence').mockRejectedValue(new Error('steam is not running'));

        expect(() =>
            renderHook(() => useRichPresence({ floor: 1, gameMode: 'endless', inRun: true }))
        ).not.toThrow();
    });
});
