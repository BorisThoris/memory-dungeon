import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewportSize } from './useViewportSize';

describe('useViewportSize', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = window.visualViewport;

    const setWindowSize = (width: number, height: number): void => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: width
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: height
        });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        setWindowSize(1280, 800);
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: undefined
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        setWindowSize(originalInnerWidth, originalInnerHeight);
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: originalVisualViewport
        });
    });

    it('coalesces resize bursts into one viewport state update per animation frame', async () => {
        const { result } = renderHook(() => useViewportSize());

        expect(result.current).toEqual({ width: 1280, height: 800 });

        act(() => {
            setWindowSize(1000, 700);
            window.dispatchEvent(new Event('resize'));
            setWindowSize(900, 600);
            window.dispatchEvent(new Event('resize'));
            setWindowSize(820, 540);
            window.dispatchEvent(new Event('orientationchange'));
        });

        expect(result.current).toEqual({ width: 1280, height: 800 });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(16);
        });

        expect(result.current).toEqual({ width: 820, height: 540 });
    });
});
