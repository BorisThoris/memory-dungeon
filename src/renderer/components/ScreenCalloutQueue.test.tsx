import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenCallout } from './screenCallouts';
import { SCREEN_CALLOUT_MAJOR_MS, SCREEN_CALLOUT_MINOR_MS, ScreenCalloutQueue } from './ScreenCalloutQueue';

const rank: ScreenCallout = { key: 'rank:1', kind: 'rank', size: 'major', tone: 'blazing', title: 'BLAZING!', sub: 'Combo ×10' };
const banked: ScreenCallout = { key: 'banked:1', kind: 'banked', size: 'minor', tone: 'gold', title: 'MISS BANKED', sub: '+1 · five in a row' };

describe('the screen stamp queue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('stays quiet about the moments the screen opened on, then plays new ones in order, one at a time', () => {
        const { rerender } = render(<ScreenCalloutQueue callouts={[rank]} reduceMotion={false} />);
        expect(screen.queryByTestId('screen-callout')).toBeNull();
        rerender(<ScreenCalloutQueue callouts={[{ ...rank, key: 'rank:2' }, { ...banked, key: 'banked:2' }]} reduceMotion={false} />);
        const first = screen.getByTestId('screen-callout');
        expect(first).toHaveAttribute('data-callout-kind', 'rank');
        expect(first).toHaveAttribute('data-callout-size', 'major');
        expect(first).toHaveAttribute('data-callout-tone', 'blazing');
        expect(screen.getByTestId('screen-callout-stamp')).toHaveTextContent('BLAZING!');
        expect(screen.getByTestId('screen-callout-sub')).toHaveTextContent('Combo ×10');
        act(() => {
            vi.advanceTimersByTime(SCREEN_CALLOUT_MAJOR_MS + 70);
        });
        expect(screen.getByTestId('screen-callout')).toHaveAttribute('data-callout-kind', 'banked');
        act(() => {
            vi.advanceTimersByTime(SCREEN_CALLOUT_MINOR_MS + 70);
        });
        expect(screen.queryByTestId('screen-callout')).toBeNull();
        // The same keys again are the same moments: nothing replays.
        rerender(<ScreenCalloutQueue callouts={[{ ...rank, key: 'rank:2' }, { ...banked, key: 'banked:2' }]} reduceMotion={false} />);
        expect(screen.queryByTestId('screen-callout')).toBeNull();
    });

    it('carries the reduced-motion flag onto the stamp', () => {
        const { rerender } = render(<ScreenCalloutQueue callouts={[]} reduceMotion />);
        rerender(<ScreenCalloutQueue callouts={[rank]} reduceMotion />);
        expect(screen.getByTestId('screen-callout')).toHaveAttribute('data-reduce-motion', 'true');
    });
});
