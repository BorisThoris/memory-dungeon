import { resolveUiBackgroundUrl } from '../assets/ui/modeArt';
import { ELEMENT_SCENE_KINDS, type ElementSceneKind } from './elementScene';

export const ELEMENT_SCENE_ART = Object.fromEntries(ELEMENT_SCENE_KINDS.map(kind => [kind, {
    desktop: resolveUiBackgroundUrl(`bg-gameplay-element-${kind}-v1.webp`, ''),
    mobile: resolveUiBackgroundUrl(`bg-gameplay-element-${kind}-v1-mobile.webp`, '')
}])) as Record<ElementSceneKind, { desktop: string; mobile: string }>;
