import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useParallaxMotionSuppressed } from './useParallaxMotionSuppressed';

describe('useParallaxMotionSuppressed', () => {
    let prefersReduced = false;
    const changeListeners = new Set<() => void>();
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        prefersReduced = false;
        changeListeners.clear();
        window.matchMedia = vi.fn((query: string) => {
            const list = {
                get matches(): boolean {
                    return query.includes('prefers-reduced-motion') ? prefersReduced : false;
                },
                media: query,
                addEventListener: (_type: string, listener: EventListener): void => {
                    changeListeners.add(listener as () => void);
                },
                removeEventListener: (_type: string, listener: EventListener): void => {
                    changeListeners.delete(listener as () => void);
                },
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
                onchange: null
            };

            return list as unknown as MediaQueryList;
        }) as typeof window.matchMedia;
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it('is true when app reduce motion is on', () => {
        const { result } = renderHook(() => useParallaxMotionSuppressed(true));

        expect(result.current).toBe(true);
    });

    it('follows prefers-reduced-motion after the media query changes', () => {
        const { result } = renderHook(() => useParallaxMotionSuppressed(false));

        expect(result.current).toBe(false);

        prefersReduced = true;
        act(() => {
            changeListeners.forEach((notify) => notify());
        });

        expect(result.current).toBe(true);

        prefersReduced = false;
        act(() => {
            changeListeners.forEach((notify) => notify());
        });

        expect(result.current).toBe(false);
    });

    it('removes its media-query subscription on unmount', () => {
        const { unmount } = renderHook(() => useParallaxMotionSuppressed(false));

        expect(changeListeners).toHaveLength(1);

        unmount();

        expect(changeListeners).toHaveLength(0);
    });
});
