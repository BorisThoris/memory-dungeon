import { useEffectiveReducedMotion } from '../hooks/useEffectiveReducedMotion';

/**
 * True when parallax-style device motion should be suppressed: the in-app setting **or**
 * the OS / browser `prefers-reduced-motion: reduce` preference.
 */
export function useParallaxMotionSuppressed(reduceMotionFromSettings: boolean): boolean {
    return useEffectiveReducedMotion(reduceMotionFromSettings);
}
