import type { GraphicsQualityPreset } from '../../shared/contracts';
import { getSceneEffectTier, type SceneEffectTier } from '../../shared/graphicsQuality';
import { useCoarsePointer } from './useCoarsePointer';
import { useViewportSize } from './useViewportSize';

/** The scene effect tier for this device: the shared rule fed the pointer kind and the viewport. */
export const useSceneEffectTier = (quality: GraphicsQualityPreset, reduceMotion: boolean): SceneEffectTier => {
    const coarsePointer = useCoarsePointer();
    const { width } = useViewportSize();
    return getSceneEffectTier({ quality, reduceMotion, coarsePointer, viewportWidth: width });
};
