import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useModalFocusTrap } from './useModalFocusTrap';

const FocusTrapHarness = ({
    onActivate,
    onDocumentKeyDown
}: {
    onActivate?: () => (() => void) | void;
    onDocumentKeyDown?: (event: KeyboardEvent) => boolean | void;
}) => {
    const containerRef = useRef<HTMLElement | null>(null);
    useModalFocusTrap({ containerRef, onActivate, onDocumentKeyDown });

    return (
        <section aria-label="modal" ref={containerRef} tabIndex={-1}>
            <button type="button">First</button>
            <button type="button">Second</button>
        </section>
    );
};

describe('useModalFocusTrap', () => {
    it('focuses the first tabbable element on mount and restores the opener on unmount', async () => {
        render(<button type="button">Opener</button>);
        const opener = screen.getByRole('button', { name: 'Opener' });
        opener.focus();

        const { unmount } = render(<FocusTrapHarness />);

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
        });

        unmount();

        expect(document.activeElement).toBe(opener);
    });

    it('traps Tab when focus starts outside the modal', async () => {
        render(<button type="button">Outside</button>);
        const outside = screen.getByRole('button', { name: 'Outside' });
        render(<FocusTrapHarness />);

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
        });

        outside.focus();
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' });
        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    });

    it('skips the default Tab trap when the document key callback handles the event', async () => {
        render(<button type="button">Outside</button>);
        const outside = screen.getByRole('button', { name: 'Outside' });
        const onDocumentKeyDown = vi.fn((event: KeyboardEvent) => event.key === 'Tab');
        render(<FocusTrapHarness onDocumentKeyDown={onDocumentKeyDown} />);

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
        });

        outside.focus();
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' });
        document.dispatchEvent(event);

        expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(outside);
    });

    it('runs activation cleanup on unmount', () => {
        const cleanup = vi.fn();
        const onActivate = vi.fn(() => cleanup);
        const { unmount } = render(<FocusTrapHarness onActivate={onActivate} />);

        expect(onActivate).toHaveBeenCalledTimes(1);

        unmount();

        expect(cleanup).toHaveBeenCalledTimes(1);
    });
});
