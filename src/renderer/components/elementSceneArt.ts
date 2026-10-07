import { resolveUiBackgroundUrl } from '../assets/ui/modeArt';
import { ELEMENT_SCENE_KINDS, type ElementSceneKind } from './elementScene';

export const ELEMENT_SCENE_ART = Object.fromEntries(ELEMENT_SCENE_KINDS.map(kind => [kind, {
    desktop: resolveUiBackgroundUrl(`bg-gameplay-element-${kind}-v1.webp`, ''),
    mobile: resolveUiBackgroundUrl(`bg-gameplay-element-${kind}-v1-mobile.webp`, '')
}])) as Record<ElementSceneKind, { desktop: string; mobile: string }>;

/**
 * A phone draws the smaller painting. Decided by the device (a coarse pointer or a narrow window),
 * not by the quality preset, so the run's loading screen can fetch the one the room will draw
 * before either of them knows what the player chose.
 */
export const prefersCompactSceneArt = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }
    if (window.innerWidth > 0 && window.innerWidth < 900) {
        return true;
    }
    try {
        return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
    } catch {
        return false;
    }
};

/** The chemistry paintings a device will draw, for the run preloader. */
export const getElementSceneArtUrls = (compact = prefersCompactSceneArt()): string[] =>
    ELEMENT_SCENE_KINDS.map((kind) => (compact ? ELEMENT_SCENE_ART[kind].mobile || ELEMENT_SCENE_ART[kind].desktop : ELEMENT_SCENE_ART[kind].desktop)).filter(Boolean);
