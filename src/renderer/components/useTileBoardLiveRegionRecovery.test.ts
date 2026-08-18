import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTileBoardLiveRegionRecovery } from './useTileBoardLiveRegionRecovery';

describe('useTileBoardLiveRegionRecovery', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('publishes manual live-region updates and WebGL recovery announcements', () => {
        vi.useFakeTimers();
        const canvas = document.createElement('canvas');
        const { result } = renderHook(() => useTileBoardLiveRegionRecovery());

        act(() => {
            result.current.announceBoardLiveMessage('Focus: Rune tile');
        });
        expect(result.current.boardLiveMessage).toBe('Focus: Rune tile');

        act(() => {
            result.current.handleCanvasCreated(canvas);
        });

        act(() => {
            canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        });
        expect(result.current.gpuSurfaceLost).toBe(true);

        act(() => {
            canvas.dispatchEvent(new Event('webglcontextrestored'));
        });
        expect(result.current.gpuSurfaceLost).toBe(false);
        expect(result.current.webglCanvasRemountKey).toBe(1);
        expect(result.current.boardLiveMessage).toBe('Graphics context restored. Board rebuilt.');

        act(() => {
            vi.advanceTimersByTime(3200);
        });
        expect(result.current.boardLiveMessage).toBe('');
    });
});
