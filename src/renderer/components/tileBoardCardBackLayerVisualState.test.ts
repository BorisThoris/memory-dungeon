import { describe, expect, it } from 'vitest';
import {
    CARD_BACK_LAYER_BASE_OPACITY,
    computeCardBackLayerPhase,
    computeCardBackLayerVisualState
} from './tileBoardCardBackLayerVisualState';

describe('tile board card back layer visual state', () => {
    it('keeps layers static when reduced motion is enabled', () => {
        expect(
            computeCardBackLayerVisualState({
                index: 3,
                layerName: 'back-corner-scrolls',
                reduceMotion: true,
                seed: 123,
                time: 8
            })
        ).toEqual({
            emissiveIntensity: 0,
            opacity: CARD_BACK_LAYER_BASE_OPACITY['back-corner-scrolls'],
            rotationZ: 0,
            scale: 1,
            x: 0,
            y: 0,
            z: 3 * 0.000035
        });
    });

    it('animates rim layers with vertical drift and opacity shimmer', () => {
        const seed = 42;
        const index = 1;
        const time = 2.5;
        const wave = Math.sin(time * 0.72 + computeCardBackLayerPhase(seed) + index * 0.61);

        expect(
            computeCardBackLayerVisualState({
                index,
                layerName: 'back-rims',
                reduceMotion: false,
                seed,
                time
            })
        ).toEqual({
            emissiveIntensity: 0,
            opacity: CARD_BACK_LAYER_BASE_OPACITY['back-rims'] + wave * 0.035,
            rotationZ: 0,
            scale: 1,
            x: 0,
            y: wave * 0.0012,
            z: index * 0.000035
        });
    });

    it('animates corner layers with two-axis drift', () => {
        const seed = 91;
        const index = 2;
        const time = 4;
        const phase = computeCardBackLayerPhase(seed);
        const wave = Math.sin(time * 0.72 + phase + index * 0.61);

        expect(
            computeCardBackLayerVisualState({
                index,
                layerName: 'back-corners',
                reduceMotion: false,
                seed,
                time
            })
        ).toEqual({
            emissiveIntensity: 0,
            opacity: CARD_BACK_LAYER_BASE_OPACITY['back-corners'] + wave * 0.028,
            rotationZ: 0,
            scale: 1,
            x: Math.sin(time * 0.62 + phase + index) * 0.0013,
            y: Math.cos(time * 0.58 + phase + index) * 0.0013,
            z: index * 0.000035
        });
    });

    it('rotates ring layers and shimmers opacity', () => {
        const seed = 0;
        const index = 5;
        const time = 1.7453292519943295;
        const phase = computeCardBackLayerPhase(seed);
        const wave = Math.sin(time * 0.72 + phase + index * 0.61);

        expect(
            computeCardBackLayerVisualState({
                index,
                layerName: 'back-rings',
                reduceMotion: false,
                seed,
                time
            })
        ).toMatchObject({
            emissiveIntensity: 0,
            opacity: CARD_BACK_LAYER_BASE_OPACITY['back-rings'] + wave * 0.045,
            rotationZ: time * 0.038 + phase * 0.08,
            scale: 1,
            x: 0,
            z: index * 0.000035
        });
    });

    it('pulses the gem scale and emissive intensity', () => {
        const seed = 11;
        const index = 6;
        const time = 3.25;
        const wave = Math.sin(time * 0.72 + computeCardBackLayerPhase(seed) + index * 0.61);

        expect(
            computeCardBackLayerVisualState({
                index,
                layerName: 'back-gem',
                reduceMotion: false,
                seed,
                time
            })
        ).toEqual({
            emissiveIntensity: 0.08 + (0.5 + 0.5 * wave) * 0.12,
            opacity: CARD_BACK_LAYER_BASE_OPACITY['back-gem'],
            rotationZ: 0,
            scale: 1 + wave * 0.012,
            x: 0,
            y: 0,
            z: index * 0.000035
        });
    });
});
