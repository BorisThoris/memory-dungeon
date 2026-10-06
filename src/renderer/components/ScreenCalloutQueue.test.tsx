import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenCallout } from './screenCallouts';
import { SCREEN_CALLOUT_MAJOR_MS, SCREEN_CALLOUT_MINOR_MS, ScreenCalloutQueue } from './ScreenCalloutQueue';

const rank: ScreenCallout = { key: 'rank:1', kind: 'rank', size: 'major', tone: 'blazing', title: 'BLAZING!', sub: 'Combo ×10' };
const banked: ScreenCallout = { key: 'banked:1', kind: 'banked', size: 'minor', tone: 'gold', title: 'MISS BANKED', sub: '+1 · five in a row' };

describe('the screen stamp queue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('stays quiet on mount and consumes simultaneous receipts without a backlog', () => {
        const { rerender } = render(<ScreenCalloutQueue callouts={[rank]} reduceMotion={false} />);
        expect(screen.queryByTestId('screen-callout')).toBeNull();
        rerender(<ScreenCalloutQueue callouts={[{ ...rank, key: 'rank:2' }, { ...banked, key: 'banked:2' }]} reduceMotion={false} />);
        const first = screen.getByTestId('screen-callout');
        expect(first).toHaveAttribute('data-callout-kind', 'rank');
        expect(first).toHaveAttribute('data-callout-size', 'major');
        expect(first).toHaveAttribute('data-callout-tone', 'blazing');
        expect(screen.getByTestId('screen-callout-stamp')).toHaveTextContent('BLAZING!');
        expect(screen.queryByTestId('screen-callout-sub')).toBeNull();
        act(() => {
            vi.advanceTimersByTime(SCREEN_CALLOUT_MAJOR_MS + 70);
        });
        expect(screen.queryByTestId('screen-callout')).toBeNull();
        // The same keys again are the same moments: nothing replays.
        rerender(<ScreenCalloutQueue callouts={[{ ...rank, key: 'rank:2' }, { ...banked, key: 'banked:2' }]} reduceMotion={false} />);
        expect(screen.queryByTestId('screen-callout')).toBeNull();
    });

    it('replaces an active stamp immediately and gives the replacement its full lifetime', () => {
        const { rerender } = render(<ScreenCalloutQueue callouts={[]} reduceMotion={false} />);
        rerender(<ScreenCalloutQueue callouts={[rank, banked]} reduceMotion={false} />);
        act(() => vi.advanceTimersByTime(900));
        const broken: ScreenCallout = { ...rank, key: 'broken:2', kind: 'broken', title: 'COMBO BROKEN' };
        rerender(<ScreenCalloutQueue callouts={[broken]} reduceMotion={false} />);
        expect(screen.getByTestId('screen-callout-stamp')).toHaveTextContent('COMBO BROKEN');
        act(() => vi.advanceTimersByTime(400));
        expect(screen.getByTestId('screen-callout-stamp')).toHaveTextContent('COMBO BROKEN');
        act(() => vi.advanceTimersByTime(SCREEN_CALLOUT_MAJOR_MS));
        expect(screen.queryByTestId('screen-callout')).toBeNull();
        act(() => vi.advanceTimersByTime(60_000));
        expect(screen.queryByTestId('screen-callout')).toBeNull();
    });

    it('keeps up with rapid events and does not restart on equivalent rerenders', () => {
        const { rerender, unmount } = render(<ScreenCalloutQueue callouts={[]} reduceMotion />);
        for (let event = 0; event < 100; event += 1) {
            rerender(<ScreenCalloutQueue callouts={[{ ...banked, key: `banked:${event}`, title: `Event ${event}` }]} reduceMotion />);
        }
        expect(screen.getByTestId('screen-callout-stamp')).toHaveTextContent('Event 99');
        act(() => vi.advanceTimersByTime(600));
        rerender(<ScreenCalloutQueue callouts={[{ ...banked, key: 'banked:99', title: 'Event 99' }]} reduceMotion />);
        act(() => vi.advanceTimersByTime(SCREEN_CALLOUT_MINOR_MS - 500));
        expect(screen.queryByTestId('screen-callout')).toBeNull();
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('carries the reduced-motion flag onto the stamp', () => {
        const { rerender } = render(<ScreenCalloutQueue callouts={[]} reduceMotion />);
        rerender(<ScreenCalloutQueue callouts={[rank]} reduceMotion />);
        expect(screen.getByTestId('screen-callout')).toHaveAttribute('data-reduce-motion', 'true');
    });
});
