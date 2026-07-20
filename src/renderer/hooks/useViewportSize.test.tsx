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

    it('coalesces and cancels a pending animation frame whose id is zero', () => {
        const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
        const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
        const { unmount } = renderHook(() => useViewportSize());

        act(() => {
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('orientationchange'));
        });

        expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

        unmount();

        expect(cancelAnimationFrame).toHaveBeenCalledWith(0);
    });

    it('removes the resize listener from the viewport object that owns it', () => {
        const subscribedViewport = {
            addEventListener: vi.fn(),
            height: 700,
            removeEventListener: vi.fn(),
            width: 1000
        };
        const replacementViewport = {
            addEventListener: vi.fn(),
            height: 600,
            removeEventListener: vi.fn(),
            width: 900
        };
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: subscribedViewport
        });
        const { unmount } = renderHook(() => useViewportSize());
        const resizeListener = subscribedViewport.addEventListener.mock.calls[0]?.[1];
        expect(resizeListener).toEqual(expect.any(Function));

        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: replacementViewport
        });
        unmount();

        expect(subscribedViewport.removeEventListener).toHaveBeenCalledWith('resize', resizeListener);
        expect(replacementViewport.removeEventListener).not.toHaveBeenCalled();
    });

    it('uses partial visualViewport dimensions without requiring listener methods', () => {
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: {
                height: 680,
                width: 960
            }
        });

        const { result } = renderHook(() => useViewportSize());

        expect(result.current).toEqual({ width: 960, height: 680 });
    });
});
