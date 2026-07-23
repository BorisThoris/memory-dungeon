import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

type ReducedMotionMediaQueryList = MediaQueryList & {
    addListener?: (listener: () => void) => void;
    removeListener?: (listener: () => void) => void;
};

const addReducedMotionListener = (mediaQuery: ReducedMotionMediaQueryList, listener: () => void): void => {
    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', listener);
        return;
    }
    mediaQuery.addListener?.(listener);
};

const removeReducedMotionListener = (mediaQuery: ReducedMotionMediaQueryList, listener: () => void): void => {
    if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', listener);
        return;
    }
    mediaQuery.removeListener?.(listener);
};

const subscribe = (onStoreChange: () => void): (() => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined;
    }
    let mediaQuery: ReducedMotionMediaQueryList;
    try {
        mediaQuery = window.matchMedia(QUERY);
    } catch {
        return () => undefined;
    }
    addReducedMotionListener(mediaQuery, onStoreChange);
    return () => removeReducedMotionListener(mediaQuery, onStoreChange);
};

const getSnapshot = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    try {
        return window.matchMedia(QUERY).matches;
    } catch {
        return false;
    }
};

const getServerSnapshot = (): boolean => false;

export const useEffectiveReducedMotion = (savedReduceMotion: boolean): boolean => {
    const osPrefersReducedMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return savedReduceMotion || osPrefersReducedMotion;
};
