import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './FittedGrid.module.css';
import { computeGridFit, growRowHeight, type GridFit } from './fittedGridFit';

/**
 * A grid that never scrolls. It measures the space it was given, works out how many cards fit,
 * and pages the rest behind Previous / Next. Screens hand it every item; the viewport decides
 * how many are on screen.
 */

export interface FittedGridProps<T> {
    items: readonly T[];
    renderItem: (item: T, index: number) => ReactNode;
    keyForItem: (item: T, index: number) => string;
    /** Minimum card width; the grid fits as many columns as the width allows. */
    minColumnWidth?: number;
    /** Row height used for the fit calculation and enforced on each card. */
    rowHeight?: number;
    gap?: number;
    /** Announced on the pager, e.g. "relics". */
    itemNoun?: string;
    emptyState?: ReactNode;
    testId?: string;
    ariaLabel?: string;
    /** Resets to page 1 when this changes (a filter or section switch). */
    resetKey?: string;
}

const FALLBACK_PAGE_SIZE = 6;

const FittedGrid = <T,>({
    ariaLabel,
    emptyState,
    gap = 10,
    items,
    itemNoun = 'entries',
    keyForItem,
    minColumnWidth = 240,
    renderItem,
    resetKey = '',
    rowHeight = 132,
    testId
}: FittedGridProps<T>) => {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const [frameFit, setFrame] = useState<(GridFit & { height: number }) | null>(null);
    // The page is stored with the signature it belongs to, so a filter or section change shows
    // page one without an effect and without ever painting the previous page.
    const [pageState, setPageState] = useState({ page: 0, signature: '' });

    const measure = useCallback((): void => {
        const frame = frameRef.current;
        if (!frame) {
            return;
        }
        const { width, height } = frame.getBoundingClientRect();
        if (width <= 0 || height <= 0) {
            return;
        }
        setFrame({
            ...computeGridFit({ frameHeight: height, frameWidth: width, gap, minColumnWidth, rowHeight }),
            height
        });
    }, [gap, minColumnWidth, rowHeight]);

    useEffect(() => {
        measure();
        const frame = frameRef.current;
        if (!frame || typeof ResizeObserver === 'undefined') {
            return undefined;
        }
        const observer = new ResizeObserver(() => measure());
        observer.observe(frame);
        return () => observer.disconnect();
    }, [measure]);

    const resetSignature = `${resetKey}:${items.length}`;
    const page = pageState.signature === resetSignature ? pageState.page : 0;
    const goToPage = (next: number): void => setPageState({ page: next, signature: resetSignature });

    const pageSize = frameFit ? frameFit.columns * frameFit.rows : FALLBACK_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, pageCount - 1);
    const visible = useMemo(
        () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
        [items, pageSize, safePage]
    );

    if (items.length === 0 && emptyState) {
        // The empty state keeps the label and the test id: a screen that has nothing to page yet is
        // still the same region, and dropping them made it unfindable to anything looking for it.
        return (
            <div aria-label={ariaLabel} className={styles.empty} data-testid={testId}>
                {emptyState}
            </div>
        );
    }

    // Grow the rows to use the space a short page leaves behind; never past the frame.
    const renderedRowHeight = frameFit ? growRowHeight(frameFit, visible.length, gap, frameFit.height) : rowHeight;

    return (
        <div className={styles.root}>
            <div className={styles.frame} ref={frameRef}>
                <ul
                    aria-label={ariaLabel}
                    className={styles.grid}
                    data-testid={testId}
                    style={{
                        gap: `${gap}px`,
                        gridAutoRows: `${renderedRowHeight}px`,
                        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`
                    }}
                >
                    {visible.map((item, index) => (
                        <li className={styles.cell} key={keyForItem(item, safePage * pageSize + index)}>
                            {renderItem(item, safePage * pageSize + index)}
                        </li>
                    ))}
                </ul>
            </div>
            {pageCount > 1 ? (
                <div className={styles.pager} data-testid={testId ? `${testId}-pager` : undefined}>
                    <button
                        className={styles.pageButton}
                        disabled={safePage === 0}
                        onClick={() => goToPage(Math.max(0, safePage - 1))}
                        type="button"
                    >
                        Previous
                    </button>
                    <span aria-live="polite" className={styles.pageLabel}>
                        {safePage * pageSize + 1}–{Math.min(items.length, (safePage + 1) * pageSize)} of {items.length}{' '}
                        {itemNoun}
                    </span>
                    <button
                        className={styles.pageButton}
                        disabled={safePage >= pageCount - 1}
                        onClick={() => goToPage(Math.min(pageCount - 1, safePage + 1))}
                        type="button"
                    >
                        Next
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export default FittedGrid;
