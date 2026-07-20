import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCoarsePointer } from './useCoarsePointer';

const makeMq = (matches: boolean) => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
});

const makeLegacyMq = (matches: boolean) => ({
    matches,
    addListener: vi.fn(),
    removeListener: vi.fn()
});

describe('useCoarsePointer', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('treats hybrid touch + fine pointer + hover as fine (laptop)', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn((query: string) => {
                if (query === '(pointer: coarse)') {
                    return makeMq(true);
                }
                if (query === '(any-pointer: fine)') {
                    return makeMq(true);
                }
                if (query === '(hover: hover)') {
                    return makeMq(true);
                }
                return makeMq(false);
            })
        );

        const { result } = renderHook(() => useCoarsePointer());
        expect(result.current).toBe(false);
    });

    it('is coarse for touch-primary tablets (no fine pointer)', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn((query: string) => {
                if (query === '(pointer: coarse)') {
                    return makeMq(true);
                }
                if (query === '(any-pointer: fine)') {
                    return makeMq(false);
                }
                if (query === '(hover: hover)') {
                    return makeMq(false);
                }
                return makeMq(false);
            })
        );

        const { result } = renderHook(() => useCoarsePointer());
        expect(result.current).toBe(true);
    });

    it('removes listeners from each subscribed media query on unmount', () => {
        const queries: ReturnType<typeof makeMq>[] = [];
        vi.stubGlobal(
            'matchMedia',
            vi.fn((query: string) => {
                const mq = makeMq(query === '(pointer: coarse)');
                queries.push(mq);
                return mq;
            })
        );

        const { unmount } = renderHook(() => useCoarsePointer());
        unmount();

        const subscribedQueries = queries.filter((mq) => mq.addEventListener.mock.calls.length > 0);
        expect(subscribedQueries).toHaveLength(3);
        for (const mq of subscribedQueries) {
            const listener = mq.addEventListener.mock.calls[0]?.[1];
            expect(listener).toEqual(expect.any(Function));
            expect(mq.removeEventListener).toHaveBeenCalledWith('change', listener);
        }
    });

    it('supports legacy media query listener APIs', () => {
        const queries: ReturnType<typeof makeLegacyMq>[] = [];
        vi.stubGlobal(
            'matchMedia',
            vi.fn((query: string) => {
                const mq = makeLegacyMq(query === '(pointer: coarse)');
                queries.push(mq);
                return mq;
            })
        );

        const { result, unmount } = renderHook(() => useCoarsePointer());
        expect(result.current).toBe(true);
        unmount();

        const subscribedQueries = queries.filter((mq) => mq.addListener.mock.calls.length > 0);
        expect(subscribedQueries).toHaveLength(3);
        for (const mq of subscribedQueries) {
            const listener = mq.addListener.mock.calls[0]?.[0];
            expect(listener).toEqual(expect.any(Function));
            expect(mq.removeListener).toHaveBeenCalledWith(listener);
        }
    });

    it('fails closed when matchMedia throws', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => {
                throw new Error('media query unavailable');
            })
        );

        const { result } = renderHook(() => useCoarsePointer());
        expect(result.current).toBe(false);
    });
});
