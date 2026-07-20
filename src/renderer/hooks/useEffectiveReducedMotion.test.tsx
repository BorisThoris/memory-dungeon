import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffectiveReducedMotion } from './useEffectiveReducedMotion';

describe('useEffectiveReducedMotion', () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it('treats the saved setting and OS preference as independent suppressive overrides', () => {
        let osReduced = false;
        const listeners = new Set<() => void>();
        window.matchMedia = vi.fn(() => ({
            matches: osReduced,
            media: '(prefers-reduced-motion: reduce)',
            addEventListener: (_event: string, listener: EventListenerOrEventListenerObject) =>
                listeners.add(listener as () => void),
            removeEventListener: (_event: string, listener: EventListenerOrEventListenerObject) =>
                listeners.delete(listener as () => void),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
            onchange: null
        })) as typeof window.matchMedia;
        const { result, rerender } = renderHook(
            ({ savedReduceMotion }) => useEffectiveReducedMotion(savedReduceMotion),
            { initialProps: { savedReduceMotion: false } }
        );

        expect(result.current).toBe(false);

        osReduced = true;
        act(() => listeners.forEach((listener) => listener()));
        expect(result.current).toBe(true);

        osReduced = false;
        rerender({ savedReduceMotion: true });
        act(() => listeners.forEach((listener) => listener()));
        expect(result.current).toBe(true);
    });

    it('supports legacy media query listener APIs', () => {
        let osReduced = false;
        const listeners = new Set<() => void>();
        const addListener = vi.fn((listener: () => void) => listeners.add(listener));
        const removeListener = vi.fn((listener: () => void) => listeners.delete(listener));
        window.matchMedia = vi.fn(() => ({
            matches: osReduced,
            media: '(prefers-reduced-motion: reduce)',
            addListener,
            removeListener,
            dispatchEvent: vi.fn(),
            onchange: null
        })) as unknown as typeof window.matchMedia;
        const { result, unmount } = renderHook(() => useEffectiveReducedMotion(false));

        expect(result.current).toBe(false);
        expect(addListener).toHaveBeenCalledWith(expect.any(Function));

        osReduced = true;
        act(() => listeners.forEach((listener) => listener()));
        expect(result.current).toBe(true);

        unmount();
        expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[0]?.[0]);
        expect(listeners).toHaveLength(0);
    });

    it('fails closed when matchMedia throws', () => {
        window.matchMedia = vi.fn(() => {
            throw new Error('media query unavailable');
        }) as typeof window.matchMedia;

        const { result } = renderHook(() => useEffectiveReducedMotion(false));
        expect(result.current).toBe(false);
    });
});
