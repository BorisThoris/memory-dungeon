import type { RENDERER_THEME } from '../styles/theme';
import type { GameplayRenderQualityProfile } from './gameplayRenderProfile';
import { getTileBoardSceneLightProps } from './tileBoardSceneLighting';

type RendererThemeColors = typeof RENDERER_THEME.colors;

interface TileBoardSceneLightsProps {
    colors: RendererThemeColors;
    compact: boolean;
    renderQuality: GameplayRenderQualityProfile;
}

export function TileBoardSceneLights({
    colors,
    compact,
    renderQuality
}: TileBoardSceneLightsProps) {
    const lights = getTileBoardSceneLightProps({ colors, compact, renderQuality });

    return (
        <>
            <ambientLight color={lights.ambient.color} intensity={lights.ambient.intensity} />
            <hemisphereLight
                color={lights.hemisphere.color}
                groundColor={lights.hemisphere.groundColor}
                intensity={lights.hemisphere.intensity}
            />
            <directionalLight
                castShadow={lights.fill.castShadow}
                color={lights.fill.color}
                intensity={lights.fill.intensity}
                position={lights.fill.position}
            />
            <directionalLight
                castShadow={lights.goldKey.castShadow}
                color={lights.goldKey.color}
                intensity={lights.goldKey.intensity}
                position={lights.goldKey.position}
            />
            <directionalLight
                color={lights.cyanKey.color}
                intensity={lights.cyanKey.intensity}
                position={lights.cyanKey.position}
            />
            <pointLight
                color={lights.stagePoint.color}
                intensity={lights.stagePoint.intensity}
                position={lights.stagePoint.position}
            />
        </>
    );
}
