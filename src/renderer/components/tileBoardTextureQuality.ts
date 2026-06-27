import type { GraphicsQualityPreset } from '../../shared/contracts';

interface TileBoardTextureQualitySyncInput {
    applyAnisotropy: (anisotropy: number) => void;
    getAnisotropyCap: (quality: GraphicsQualityPreset) => number;
    getMaxAnisotropy: () => number;
    graphicsQuality: GraphicsQualityPreset;
    preloadRankFont: (quality: GraphicsQualityPreset) => void;
    setSamplingQuality: (quality: GraphicsQualityPreset) => void;
}

interface TileBoardTextureQualitySyncResult {
    appliedAnisotropy: number;
    deviceAnisotropyCap: number;
    qualityAnisotropyCap: number;
}

export const computeTileBoardAppliedAnisotropy = ({
    deviceAnisotropyCap,
    qualityAnisotropyCap
}: {
    deviceAnisotropyCap: number;
    qualityAnisotropyCap: number;
}): number => Math.min(qualityAnisotropyCap, deviceAnisotropyCap);

export const syncTileBoardTextureQuality = ({
    applyAnisotropy,
    getAnisotropyCap,
    getMaxAnisotropy,
    graphicsQuality,
    preloadRankFont,
    setSamplingQuality
}: TileBoardTextureQualitySyncInput): TileBoardTextureQualitySyncResult => {
    setSamplingQuality(graphicsQuality);
    preloadRankFont(graphicsQuality);

    const qualityAnisotropyCap = getAnisotropyCap(graphicsQuality);
    const deviceAnisotropyCap = getMaxAnisotropy();
    const appliedAnisotropy = computeTileBoardAppliedAnisotropy({
        deviceAnisotropyCap,
        qualityAnisotropyCap
    });
    applyAnisotropy(appliedAnisotropy);

    return {
        appliedAnisotropy,
        deviceAnisotropyCap,
        qualityAnisotropyCap
    };
};
