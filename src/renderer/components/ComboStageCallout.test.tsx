import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBO_STAGE_CALLOUT_MS, ComboStageCallout } from './ComboStageCallout';

describe('the combo rank-up stamp', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('stamps the stage a turn reached, with the combo under it, and retires when its animation ends', () => {
        render(<ComboStageCallout calloutKey="turn-7" combo={10} reduceMotion={false} stage="blazing" />);
        const callout = screen.getByTestId('combo-stage-callout');
        expect(callout).toHaveAttribute('data-combo-stage', 'blazing');
        expect(screen.getByTestId('combo-stage-callout-stamp')).toHaveTextContent('BLAZING!');
        expect(callout).toHaveTextContent('Combo ×10');
        fireEvent.animationEnd(callout);
        expect(screen.queryByTestId('combo-stage-callout')).toBeNull();
    });

    it('shows nothing without a turn behind it, and restarts on the next one', () => {
        const { rerender } = render(<ComboStageCallout calloutKey={null} combo={12} reduceMotion={false} stage="inferno" />);
        expect(screen.queryByTestId('combo-stage-callout')).toBeNull();
        rerender(<ComboStageCallout calloutKey="turn-1" combo={6} reduceMotion={false} stage="hot" />);
        fireEvent.animationEnd(screen.getByTestId('combo-stage-callout'));
        expect(screen.queryByTestId('combo-stage-callout')).toBeNull();
        rerender(<ComboStageCallout calloutKey="turn-2" combo={16} reduceMotion={false} stage="inferno" />);
        expect(screen.getByTestId('combo-stage-callout-stamp')).toHaveTextContent('INFERNO!');
    });

    it('still leaves on a clock when no animation ever ends, as under reduced motion', () => {
        render(<ComboStageCallout calloutKey="turn-3" combo={25} reduceMotion stage="legendary" />);
        expect(screen.getByTestId('combo-stage-callout')).toHaveAttribute('data-reduce-motion', 'true');
        act(() => {
            vi.advanceTimersByTime(COMBO_STAGE_CALLOUT_MS + 100);
        });
        expect(screen.queryByTestId('combo-stage-callout')).toBeNull();
    });
});
