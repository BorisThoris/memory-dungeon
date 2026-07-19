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
});
