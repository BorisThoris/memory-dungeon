import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makePair, makeRun } from '../../shared/test/game-fixtures';
import { useFinalPairAutoMatch } from './useFinalPairAutoMatch';

const autoMatchFinalPair = vi.hoisted(() => vi.fn());
vi.mock('../store/useAppStore', () => ({ useAppStore: { getState: () => ({ autoMatchFinalPair }) } }));

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('final pair timing', () => {
    it('waits for the preceding match, cancels on pause, and resumes without duplicate calls', () => {
        vi.useFakeTimers();
        const run = makeRun(makePair('last', 'last'));
        const { rerender, unmount } = renderHook(({ current }) => useFinalPairAutoMatch(current), { initialProps: { current: run } });
        act(() => vi.advanceTimersByTime(200));
        expect(autoMatchFinalPair).not.toHaveBeenCalled();
        rerender({ current: { ...run, status: 'paused' } });
        act(() => vi.advanceTimersByTime(1000));
        expect(autoMatchFinalPair).not.toHaveBeenCalled();
        rerender({ current: run });
        rerender({ current: { ...run } });
        act(() => vi.advanceTimersByTime(300));
        expect(autoMatchFinalPair).toHaveBeenCalledTimes(1);
        unmount();
    });

    it('cancels when leaving the game and ignores boards with choices remaining', () => {
        vi.useFakeTimers();
        const run = makeRun(makePair('last', 'last'));
        const { rerender, unmount } = renderHook(({ current }) => useFinalPairAutoMatch(current), { initialProps: { current: run } });
        rerender({ current: makeRun([...makePair('a', 'a'), ...makePair('b', 'b')]) });
        act(() => vi.advanceTimersByTime(1000));
        expect(autoMatchFinalPair).not.toHaveBeenCalled();
        rerender({ current: run });
        unmount();
        act(() => vi.advanceTimersByTime(1000));
        expect(autoMatchFinalPair).not.toHaveBeenCalled();
    });
});
