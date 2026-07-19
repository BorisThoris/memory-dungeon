import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTileBoardWebglContextRecovery } from './useTileBoardWebglContextRecovery';

describe('useTileBoardWebglContextRecovery', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('tracks context loss and remounts the canvas after restoration', () => {
        vi.useFakeTimers();
        const announce = vi.fn();
        const canvas = document.createElement('canvas');
        const { result } = renderHook(() => useTileBoardWebglContextRecovery({ announce }));

        act(() => result.current.handleCanvasCreated(canvas));
        const lost = new Event('webglcontextlost', { cancelable: true });
        act(() => canvas.dispatchEvent(lost));

        expect(lost.defaultPrevented).toBe(true);
        expect(result.current.gpuSurfaceLost).toBe(true);
        expect(result.current.webglCanvasRemountKey).toBe(0);

        act(() => canvas.dispatchEvent(new Event('webglcontextrestored')));

        expect(result.current.gpuSurfaceLost).toBe(false);
        expect(result.current.webglCanvasRemountKey).toBe(1);
        expect(announce).toHaveBeenCalledWith('Graphics context restored. Board rebuilt.');

        act(() => vi.advanceTimersByTime(3200));
        expect(announce).toHaveBeenLastCalledWith('');
    });

    it('detaches listeners from a replaced canvas', () => {
        const announce = vi.fn();
        const oldCanvas = document.createElement('canvas');
        const currentCanvas = document.createElement('canvas');
        const { result } = renderHook(() => useTileBoardWebglContextRecovery({ announce }));

        act(() => {
            result.current.handleCanvasCreated(oldCanvas);
            result.current.handleCanvasCreated(currentCanvas);
            oldCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        });
        expect(result.current.gpuSurfaceLost).toBe(false);

        act(() => currentCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
        expect(result.current.gpuSurfaceLost).toBe(true);
    });

    it('cancels pending announcements when the board unmounts', () => {
        vi.useFakeTimers();
        const announce = vi.fn();
        const canvas = document.createElement('canvas');
        const { result, unmount } = renderHook(() => useTileBoardWebglContextRecovery({ announce }));

        act(() => {
            result.current.handleCanvasCreated(canvas);
            canvas.dispatchEvent(new Event('webglcontextrestored'));
        });
        unmount();
        act(() => vi.advanceTimersByTime(3200));

        expect(announce).toHaveBeenCalledTimes(1);
    });
});
