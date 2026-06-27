import type { GraphicsQualityPreset } from '../../shared/contracts';

export type GameplayRenderQualityProfile = {
    bloomIntensity: number;
    bloomThreshold: number;
    cardGlowIntensity: number;
    cardGlowMotion: number;
    cardDisplacementScale: number;
    cardMetalness: number;
    cardNormalScale: [number, number];
    cardRoughness: number;
    cyanKeyLight: number;
    goldKeyLight: number;
    hoverEmissive: number;
    hoverRimOpacity: number;
    matchBurstIntensity: number;
    matchOuterWidth: number;
    resolveGlowIntensity: number;
    stageRuneFieldIntensity: number;
    stageRuneFieldMotion: number;
    stagePointLight: number;
};

type GameplayRenderProfile = {
    id: 'arcane-workshop-v2';
    description: string;
    cacheSalt: string;
    quality: Record<GraphicsQualityPreset, GameplayRenderQualityProfile>;
};

export const GAMEPLAY_RENDER_PROFILE: GameplayRenderProfile = {
    id: 'arcane-workshop-v2',
    description: 'High-spectacle arcane table renderer: deeper card relief, brighter rune light, and stronger match bloom.',
    cacheSalt: 'arcane-workshop-v2',
    quality: {
        high: {
            bloomIntensity: 0.58,
            bloomThreshold: 0.68,
            cardGlowIntensity: 1.18,
            cardGlowMotion: 1,
            cardDisplacementScale: 0.0118,
            cardMetalness: 0.07,
            cardNormalScale: [0.22, 0.22],
            cardRoughness: 0.66,
            cyanKeyLight: 0.34,
            goldKeyLight: 1.22,
            hoverEmissive: 0.36,
            hoverRimOpacity: 0.92,
            matchBurstIntensity: 0.48,
            matchOuterWidth: 1.26,
            resolveGlowIntensity: 1.22,
            stageRuneFieldIntensity: 0.72,
            stageRuneFieldMotion: 1,
            stagePointLight: 0.34
        },
        medium: {
            bloomIntensity: 0.46,
            bloomThreshold: 0.72,
            cardGlowIntensity: 0.82,
            cardGlowMotion: 0.72,
            cardDisplacementScale: 0.0096,
            cardMetalness: 0.045,
            cardNormalScale: [0.18, 0.18],
            cardRoughness: 0.74,
            cyanKeyLight: 0.24,
            goldKeyLight: 1.08,
            hoverEmissive: 0.24,
            hoverRimOpacity: 0.72,
            matchBurstIntensity: 0.32,
            matchOuterWidth: 1.04,
            resolveGlowIntensity: 0.88,
            stageRuneFieldIntensity: 0.46,
            stageRuneFieldMotion: 0.68,
            stagePointLight: 0.24
        },
        low: {
            bloomIntensity: 0.34,
            bloomThreshold: 0.78,
            cardGlowIntensity: 0,
            cardGlowMotion: 0,
            cardDisplacementScale: 0.0064,
            cardMetalness: 0.02,
            cardNormalScale: [0.12, 0.12],
            cardRoughness: 0.82,
            cyanKeyLight: 0.14,
            goldKeyLight: 0.86,
            hoverEmissive: 0.13,
            hoverRimOpacity: 0.48,
            matchBurstIntensity: 0.18,
            matchOuterWidth: 0.82,
            resolveGlowIntensity: 0,
            stageRuneFieldIntensity: 0,
            stageRuneFieldMotion: 0,
            stagePointLight: 0.14
        }
    }
} as const;

export const gameplayRenderQualityProfile = (
    quality: GraphicsQualityPreset | undefined
): GameplayRenderQualityProfile => GAMEPLAY_RENDER_PROFILE.quality[quality ?? 'medium'];
