import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Presence } from './Presence';

const dialog = <div role="dialog" aria-label="Run paused" data-testid="sheet" />;

describe('Presence', () => {
    it('keeps a closed overlay for its exit, drawn but hidden from assistive tech, then removes it', () => {
        vi.useFakeTimers();
        try {
            const { rerender } = render(<Presence exitMs={160} show>{dialog}</Presence>);
            expect(screen.getByRole('dialog', { name: 'Run paused' })).toBeInTheDocument();

            rerender(<Presence exitMs={160} show={false}>{dialog}</Presence>);
            // Still drawn for the fade, but no longer a dialog anyone can reach.
            expect(screen.getByTestId('sheet')).toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.getByTestId('sheet').closest('[data-presence-leaving="true"]')).not.toBeNull();

            act(() => {
                vi.advanceTimersByTime(170);
            });
            expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('cuts at once under reduced motion', () => {
        const { rerender } = render(<Presence exitMs={160} reduceMotion show>{dialog}</Presence>);
        rerender(<Presence exitMs={160} reduceMotion show={false}>{dialog}</Presence>);
        expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
    });

    it('shows nothing until it is first shown', () => {
        render(<Presence exitMs={160} show={false}>{dialog}</Presence>);
        expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
    });
});
