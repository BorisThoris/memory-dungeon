import { describe, expect, it } from 'vitest';
import { RENDERER_THEME } from '../styles/theme';
import { gameplayRenderQualityProfile } from './gameplayRenderProfile';
import { getTileBoardSceneLightProps } from './tileBoardSceneLighting';

describe('tileBoardSceneLighting', () => {
    it('keeps roomy board lights at render-profile intensity', () => {
        const renderQuality = gameplayRenderQualityProfile('medium');
        const lights = getTileBoardSceneLightProps({
            colors: RENDERER_THEME.colors,
            compact: false,
            renderQuality
        });

        expect(lights.ambient).toEqual({ color: RENDERER_THEME.colors.text, intensity: 0.62 });
        expect(lights.hemisphere).toEqual({
            color: RENDERER_THEME.colors.text,
            groundColor: RENDERER_THEME.colors.smokeDeep,
            intensity: 0.3
        });
        expect(lights.goldKey.intensity).toBe(renderQuality.goldKeyLight);
        expect(lights.cyanKey.intensity).toBe(renderQuality.cyanKeyLight);
        expect(lights.stagePoint.intensity).toBe(renderQuality.stagePointLight);
    });

    it('scales key lights down in compact board layout', () => {
        const renderQuality = gameplayRenderQualityProfile('high');
        const lights = getTileBoardSceneLightProps({
            colors: RENDERER_THEME.colors,
            compact: true,
            renderQuality
        });

        expect(lights.ambient.intensity).toBe(0.54);
        expect(lights.fill.intensity).toBe(0.18);
        expect(lights.goldKey.intensity).toBeCloseTo(renderQuality.goldKeyLight * 0.86, 8);
        expect(lights.cyanKey.intensity).toBeCloseTo(renderQuality.cyanKeyLight * 0.82, 8);
        expect(lights.stagePoint.intensity).toBeCloseTo(renderQuality.stagePointLight * 0.82, 8);
    });
});
