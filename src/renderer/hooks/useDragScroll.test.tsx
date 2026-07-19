import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDragScroll } from './useDragScroll';

const DragScrollHarness = ({
    onCardClick = () => undefined,
    onOutsideClick = () => undefined
}: {
    onCardClick?: () => void;
    onOutsideClick?: () => void;
}) => {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const { onKeyDownCapture, onPointerDownCapture, tabIndex } = useDragScroll(scrollerRef);

    return (
        <>
            <div
                data-testid="scroller"
                onKeyDownCapture={onKeyDownCapture}
                onPointerDownCapture={onPointerDownCapture}
                ref={scrollerRef}
                tabIndex={tabIndex}
            >
                <div data-library-card-cell>
                    <button onClick={onCardClick} type="button">
                        Library mode
                    </button>
                </div>
            </div>
            <button onClick={onOutsideClick} type="button">
                Outside command
            </button>
        </>
    );
};

const installPointerCaptureSpies = (scroller: HTMLElement) => {
    const releasePointerCapture = vi.fn();
    const setPointerCapture = vi.fn();
    scroller.releasePointerCapture = releasePointerCapture;
    scroller.setPointerCapture = setPointerCapture;
    return { releasePointerCapture, setPointerCapture };
};

const beginLibraryCardDrag = (pointerId = 7): HTMLElement => {
    const scroller = screen.getByTestId('scroller');
    const card = screen.getByRole('button', { name: 'Library mode' });
    fireEvent.pointerDown(card, { button: 0, clientX: 100, pointerId });
    fireEvent.pointerMove(window, { clientX: 80, pointerId });
    return scroller;
};

afterEach(() => {
    vi.useRealTimers();
});

describe('useDragScroll', () => {
    it('does not suppress an unrelated click after pointer cancellation', () => {
        const onOutsideClick = vi.fn();
        render(<DragScrollHarness onOutsideClick={onOutsideClick} />);
        const scroller = screen.getByTestId('scroller');
        installPointerCaptureSpies(scroller);

        beginLibraryCardDrag();
        fireEvent.pointerCancel(scroller, { pointerId: 7 });
        fireEvent.click(screen.getByRole('button', { name: 'Outside command' }));

        expect(onOutsideClick).toHaveBeenCalledTimes(1);
    });

    it('removes a pending pre-slop drag session when the hook unmounts', () => {
        const { unmount } = render(<DragScrollHarness />);
        const scroller = screen.getByTestId('scroller');
        const { setPointerCapture } = installPointerCaptureSpies(scroller);
        const card = screen.getByRole('button', { name: 'Library mode' });
        fireEvent.pointerDown(card, { button: 0, clientX: 100, pointerId: 11 });

        unmount();
        fireEvent.pointerMove(window, { clientX: 80, pointerId: 11 });
        const captureCallsAfterUnmount = setPointerCapture.mock.calls.length;
        fireEvent.pointerCancel(scroller, { pointerId: 11 });

        expect(captureCallsAfterUnmount).toBe(0);
    });

    it('releases an active surface drag when the hook unmounts', () => {
        const { unmount } = render(<DragScrollHarness />);
        const scroller = screen.getByTestId('scroller');
        const { releasePointerCapture, setPointerCapture } = installPointerCaptureSpies(scroller);

        fireEvent.pointerDown(scroller, { button: 0, clientX: 100, pointerId: 13 });
        expect(setPointerCapture).toHaveBeenCalledWith(13);

        unmount();

        expect(releasePointerCapture).toHaveBeenCalledWith(13);
    });

    it('suppresses only the generated in-scroller click after pointer release', () => {
        const onCardClick = vi.fn();
        const onOutsideClick = vi.fn();
        render(<DragScrollHarness onCardClick={onCardClick} onOutsideClick={onOutsideClick} />);
        const scroller = screen.getByTestId('scroller');
        installPointerCaptureSpies(scroller);

        beginLibraryCardDrag();
        fireEvent.pointerUp(scroller, { pointerId: 7 });
        fireEvent.click(screen.getByRole('button', { name: 'Outside command' }));
        fireEvent.click(screen.getByRole('button', { name: 'Library mode' }));

        expect(onOutsideClick).toHaveBeenCalledTimes(1);
        expect(onCardClick).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Library mode' }));
        expect(onCardClick).toHaveBeenCalledTimes(1);
    });

    it('expires click suppression when no generated click arrives', () => {
        vi.useFakeTimers();
        const onCardClick = vi.fn();
        render(<DragScrollHarness onCardClick={onCardClick} />);
        const scroller = screen.getByTestId('scroller');
        installPointerCaptureSpies(scroller);

        beginLibraryCardDrag();
        fireEvent.pointerUp(scroller, { pointerId: 7 });
        vi.advanceTimersByTime(1_000);
        fireEvent.click(screen.getByRole('button', { name: 'Library mode' }));

        expect(onCardClick).toHaveBeenCalledTimes(1);
    });
});
