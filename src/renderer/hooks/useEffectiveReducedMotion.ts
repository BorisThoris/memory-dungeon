import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onStoreChange: () => void): (() => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined;
    }
    const mediaQuery = window.matchMedia(QUERY);
    mediaQuery.addEventListener('change', onStoreChange);
    return () => mediaQuery.removeEventListener('change', onStoreChange);
};

const getSnapshot = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(QUERY).matches;

const getServerSnapshot = (): boolean => false;

export const useEffectiveReducedMotion = (savedReduceMotion: boolean): boolean => {
    const osPrefersReducedMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return savedReduceMotion || osPrefersReducedMotion;
};
