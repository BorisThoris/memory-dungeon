import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Component, useRef, type ReactNode } from 'react';
import { useModalFocusTrap } from './useModalFocusTrap';

class TestErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    render(): ReactNode {
        return this.state.failed ? <div role="alert">Modal failed</div> : this.props.children;
    }
}

const FocusTrapHarness = ({
    label = 'modal',
    firstLabel = 'First',
    secondLabel = 'Second',
    onActivate,
    onDocumentKeyDown
}: {
    label?: string;
    firstLabel?: string;
    secondLabel?: string;
    onActivate?: () => (() => void) | void;
    onDocumentKeyDown?: (event: KeyboardEvent) => boolean | void;
}) => {
    const containerRef = useRef<HTMLElement | null>(null);
    useModalFocusTrap({ containerRef, onActivate, onDocumentKeyDown });

    return (
        <section aria-label={label} ref={containerRef} tabIndex={-1}>
            <button type="button">{firstLabel}</button>
            <button type="button">{secondLabel}</button>
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

    it('gives only the top nested trap document keyboard ownership', async () => {
        const outerKeyDown = vi.fn();
        const innerKeyDown = vi.fn();
        render(
            <>
                <button type="button">Outside</button>
                <FocusTrapHarness
                    firstLabel="Outer first"
                    label="outer modal"
                    onDocumentKeyDown={outerKeyDown}
                    secondLabel="Outer second"
                />
                <FocusTrapHarness
                    firstLabel="Inner first"
                    label="inner modal"
                    onDocumentKeyDown={innerKeyDown}
                    secondLabel="Inner second"
                />
            </>
        );

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inner first' }));
        });

        screen.getByRole('button', { name: 'Outside' }).focus();
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' });
        document.dispatchEvent(event);

        expect(outerKeyDown).not.toHaveBeenCalled();
        expect(innerKeyDown).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inner first' }));
    });

    it('ignores delayed initial focus work after a newer trap becomes topmost', () => {
        const frames: FrameRequestCallback[] = [];
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.push(callback);
            return frames.length;
        });
        render(
            <>
                <FocusTrapHarness firstLabel="Outer first" label="outer modal" secondLabel="Outer second" />
                <FocusTrapHarness firstLabel="Inner first" label="inner modal" secondLabel="Inner second" />
            </>
        );
        expect(frames).toHaveLength(2);

        frames[1]!(0);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inner first' }));

        frames[0]!(0);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inner first' }));
    });

    it('runs activation cleanup on unmount', () => {
        const cleanup = vi.fn();
        const onActivate = vi.fn(() => cleanup);
        const { unmount } = render(<FocusTrapHarness onActivate={onActivate} />);

        expect(onActivate).toHaveBeenCalledTimes(1);

        unmount();

        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('restores focus when activation setup throws', () => {
        render(
            <>
                <button type="button">Opener</button>
                <button type="button">Activation target</button>
            </>
        );
        const opener = screen.getByRole('button', { name: 'Opener' });
        const activationTarget = screen.getByRole('button', { name: 'Activation target' });
        opener.focus();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            render(
                <TestErrorBoundary>
                    <FocusTrapHarness
                        onActivate={() => {
                            activationTarget.focus();
                            throw new Error('activation failed');
                        }}
                    />
                </TestErrorBoundary>
            );
        } finally {
            consoleError.mockRestore();
        }

        expect(screen.getByRole('alert')).toHaveTextContent('Modal failed');
        expect(document.activeElement).toBe(opener);
    });

    it('rolls back activation when initial focus scheduling throws', () => {
        render(
            <>
                <button type="button">Opener</button>
                <button type="button">Scheduling target</button>
            </>
        );
        const opener = screen.getByRole('button', { name: 'Opener' });
        const schedulingTarget = screen.getByRole('button', { name: 'Scheduling target' });
        const cleanupActivation = vi.fn();
        opener.focus();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
            schedulingTarget.focus();
            throw new Error('focus scheduling failed');
        });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            render(
                <TestErrorBoundary>
                    <FocusTrapHarness onActivate={() => cleanupActivation} />
                </TestErrorBoundary>
            );
        } finally {
            consoleError.mockRestore();
        }

        expect(screen.getByRole('alert')).toHaveTextContent('Modal failed');
        expect(cleanupActivation).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
    });

    it('restores focus when activation cleanup throws', async () => {
        render(
            <>
                <button type="button">Opener</button>
                <button type="button">Cleanup target</button>
            </>
        );
        const opener = screen.getByRole('button', { name: 'Opener' });
        const cleanupTarget = screen.getByRole('button', { name: 'Cleanup target' });
        opener.focus();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const modal = (
            <TestErrorBoundary>
                <FocusTrapHarness
                    onActivate={() => () => {
                        cleanupTarget.focus();
                        throw new Error('activation cleanup failed');
                    }}
                />
            </TestErrorBoundary>
        );
        const { rerender } = render(modal);

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
        });

        try {
            rerender(<TestErrorBoundary>Modal closed</TestErrorBoundary>);
        } finally {
            consoleError.mockRestore();
        }

        expect(screen.getByRole('alert')).toHaveTextContent('Modal failed');
        expect(document.activeElement).toBe(opener);
    });
});
