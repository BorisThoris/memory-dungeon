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

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const anyFine = window.matchMedia('(any-pointer: fine)').matches;
    const canHover = window.matchMedia('(hover: hover)').matches;
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

        const coarseMq = window.matchMedia('(pointer: coarse)');
        const fineMq = window.matchMedia('(any-pointer: fine)');
        const hoverMq = window.matchMedia('(hover: hover)');

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
