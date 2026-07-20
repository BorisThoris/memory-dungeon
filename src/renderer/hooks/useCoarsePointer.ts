import { useEffect, useState } from 'react';

/**
 * Touch-first vs fine-pointer layout density.
 * Hybrid laptops: `(pointer: coarse)` is true for touchscreen, but `(any-pointer: fine)` + `(hover: hover)`
 * means a mouse/trackpad is usually present — prefer **fine** hit metrics to avoid oversized chrome.
 */
const readCoarsePointer = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    let coarse = false;
    let anyFine = false;
    let canHover = false;
    try {
        coarse = window.matchMedia('(pointer: coarse)').matches;
        anyFine = window.matchMedia('(any-pointer: fine)').matches;
        canHover = window.matchMedia('(hover: hover)').matches;
    } catch {
        return false;
    }

    const hybridTouchLaptop = coarse && anyFine && canHover;

    return coarse && !hybridTouchLaptop;
};

type PointerMediaQueryList = MediaQueryList & {
    addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

const addMediaQueryChangeListener = (
    mediaQuery: PointerMediaQueryList,
    listener: (event: MediaQueryListEvent) => void
): void => {
    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', listener);
        return;
    }
    mediaQuery.addListener?.(listener);
};

const removeMediaQueryChangeListener = (
    mediaQuery: PointerMediaQueryList,
    listener: (event: MediaQueryListEvent) => void
): void => {
    if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', listener);
        return;
    }
    mediaQuery.removeListener?.(listener);
};

export const useCoarsePointer = (): boolean => {
    const [coarsePointer, setCoarsePointer] = useState(readCoarsePointer);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        let coarseMq: PointerMediaQueryList;
        let fineMq: PointerMediaQueryList;
        let hoverMq: PointerMediaQueryList;
        try {
            coarseMq = window.matchMedia('(pointer: coarse)');
            fineMq = window.matchMedia('(any-pointer: fine)');
            hoverMq = window.matchMedia('(hover: hover)');
        } catch {
            return;
        }

        const sync = (): void => {
            setCoarsePointer(readCoarsePointer());
        };

        sync();
        addMediaQueryChangeListener(coarseMq, sync);
        addMediaQueryChangeListener(fineMq, sync);
        addMediaQueryChangeListener(hoverMq, sync);

        return () => {
            removeMediaQueryChangeListener(coarseMq, sync);
            removeMediaQueryChangeListener(fineMq, sync);
            removeMediaQueryChangeListener(hoverMq, sync);
        };
    }, []);

    return coarsePointer;
};
