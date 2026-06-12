import type { RENDERER_THEME } from '../styles/theme';
import type { GameplayRenderQualityProfile } from './gameplayRenderProfile';

type RendererThemeColors = typeof RENDERER_THEME.colors;

export interface TileBoardSceneLightProps {
    ambient: {
        color: string;
        intensity: number;
    };
    cyanKey: {
        color: string;
        intensity: number;
        position: [number, number, number];
    };
    fill: {
        castShadow: false;
        color: string;
        intensity: number;
        position: [number, number, number];
    };
    goldKey: {
        castShadow: false;
        color: string;
        intensity: number;
        position: [number, number, number];
    };
    hemisphere: {
        color: string;
        groundColor: string;
        intensity: number;
    };
    stagePoint: {
        color: string;
        intensity: number;
        position: [number, number, number];
    };
}

export const getTileBoardSceneLightProps = ({
    colors,
    compact,
    renderQuality
}: {
    colors: RendererThemeColors;
    compact: boolean;
    renderQuality: GameplayRenderQualityProfile;
}): TileBoardSceneLightProps => ({
    ambient: {
        color: colors.text,
        intensity: compact ? 0.54 : 0.62
    },
    cyanKey: {
        color: colors.cyanBright,
        intensity: compact ? renderQuality.cyanKeyLight * 0.82 : renderQuality.cyanKeyLight,
        position: [-5.8, 2.2, 6.8]
    },
    fill: {
        castShadow: false,
        color: colors.text,
        intensity: compact ? 0.18 : 0.24,
        position: [0, 2.2, 12]
    },
    goldKey: {
        castShadow: false,
        color: colors.goldBright,
        intensity: compact ? renderQuality.goldKeyLight * 0.86 : renderQuality.goldKeyLight,
        position: [5.4, 7.2, 8.5]
    },
    hemisphere: {
        color: colors.text,
        groundColor: colors.smokeDeep,
        intensity: compact ? 0.24 : 0.3
    },
    stagePoint: {
        color: colors.gold,
        intensity: compact ? renderQuality.stagePointLight * 0.82 : renderQuality.stagePointLight,
        position: [0, -2.2, 5.4]
    }
});
