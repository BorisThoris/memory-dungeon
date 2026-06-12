import { describe, expect, it } from 'vitest';
import { Color, MeshStandardMaterial } from 'three';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { RENDERER_THEME } from '../styles/theme';
import {
    applyCardMaterialEmissive,
    applyCardMaterialVisualState,
    computeCardFocusDimBlend,
    computeCardMaterialVisualState
} from './tileBoardMaterialVisualState';

describe('tileBoardMaterialVisualState', () => {
    it('damps focus dim blend toward active only for hidden face-down dimmed cards', () => {
        const hiddenBlend = computeCardFocusDimBlend({
            current: 0,
            delta: 1 / 60,
            faceUp: false,
            focusDimmed: true,
            reduceMotion: false,
            tileState: 'hidden'
        });
        const faceUpBlend = computeCardFocusDimBlend({
            current: 0.6,
            delta: 1 / 60,
            faceUp: true,
            focusDimmed: true,
            reduceMotion: false,
            tileState: 'flipped'
        });

        expect(hiddenBlend).toBeGreaterThan(0);
        expect(hiddenBlend).toBeLessThan(1);
        expect(faceUpBlend).toBeLessThan(0.6);
        expect(faceUpBlend).toBeGreaterThan(0);
    });

    it('uses faster focus dim damping under reduced motion', () => {
        const normal = computeCardFocusDimBlend({
            current: 0,
            delta: 1 / 60,
            faceUp: false,
            focusDimmed: true,
            reduceMotion: false,
            tileState: 'hidden'
        });
        const reduced = computeCardFocusDimBlend({
            current: 0,
            delta: 1 / 60,
            faceUp: false,
            focusDimmed: true,
            reduceMotion: true,
            tileState: 'hidden'
        });

        expect(reduced).toBeGreaterThan(normal);
        expect(reduced).toBeLessThanOrEqual(1);
    });

    it('interpolates focus-dim brightness and opacity', () => {
        const state = computeCardMaterialVisualState({
            faceUp: false,
            focusDimBlend: 0.5,
            graphicsQuality: 'medium',
            hoverEmissiveIntensity: 0.25,
            reduceMotion: false,
            resolvingSelection: null,
            tileState: 'hidden',
            time: 0
        });

        expect(state.dimBrightness).toBeCloseTo(0.76);
        expect(state.dimOpacity).toBeCloseTo(0.94);
    });

    it('uses low-quality matched emissive fallbacks for both card faces', () => {
        const state = computeCardMaterialVisualState({
            faceUp: true,
            focusDimBlend: 0,
            graphicsQuality: 'low',
            hoverEmissiveIntensity: 0.2,
            reduceMotion: true,
            resolvingSelection: null,
            tileState: 'matched',
            time: 3
        });

        expect(state.frontEmissive).toEqual({
            role: 'matchVictory',
            intensity: GAMEPLAY_BOARD_VISUALS.lowQualityMatchedFrontEmissive.base
        });
        expect(state.backEmissive).toEqual({
            role: 'matchVictory',
            intensity: GAMEPLAY_BOARD_VISUALS.lowQualityMatchedBackEmissive.base
        });
    });

    it('turns off standard material emissive for matched cards when shader glow handles the effect', () => {
        const state = computeCardMaterialVisualState({
            faceUp: true,
            focusDimBlend: 0,
            graphicsQuality: 'high',
            hoverEmissiveIntensity: 0.2,
            reduceMotion: false,
            resolvingSelection: null,
            tileState: 'matched',
            time: 0
        });

        expect(state.frontEmissive).toEqual({ role: 'none', intensity: 0 });
        expect(state.backEmissive).toEqual({ role: 'none', intensity: 0 });
    });

    it('uses mismatch emissive only for the front material on face-up mismatches', () => {
        const state = computeCardMaterialVisualState({
            faceUp: true,
            focusDimBlend: 0,
            graphicsQuality: 'medium',
            hoverEmissiveIntensity: 0.2,
            reduceMotion: true,
            resolvingSelection: 'mismatch',
            tileState: 'flipped',
            time: 0
        });

        expect(state.frontEmissive).toEqual({
            role: 'mismatch',
            intensity: GAMEPLAY_BOARD_VISUALS.mismatchEmissive.base
        });
        expect(state.backEmissive).toEqual({ role: 'hoverGold', intensity: 0.2 });
    });

    it('falls back to hover emissive for non-matched non-mismatch states', () => {
        const state = computeCardMaterialVisualState({
            faceUp: false,
            focusDimBlend: 0,
            graphicsQuality: 'medium',
            hoverEmissiveIntensity: 0.37,
            reduceMotion: false,
            resolvingSelection: null,
            tileState: 'hidden',
            time: 0
        });

        expect(state.frontEmissive).toEqual({ role: 'hoverGold', intensity: 0.37 });
        expect(state.backEmissive).toEqual({ role: 'hoverGold', intensity: 0.37 });
    });

    it('applies emissive roles to standard card materials', () => {
        const material = new MeshStandardMaterial();

        applyCardMaterialEmissive(material, { role: 'mismatch', intensity: 0.7 });
        expect(material.emissive.r).toBeCloseTo(new Color(RENDERER_THEME.colors.emberSoft).r);
        expect(material.emissiveIntensity).toBe(0.7);

        applyCardMaterialEmissive(material, { role: 'matchVictory', intensity: 0.8 });
        expect(material.emissive.r).toBeCloseTo(new Color('#4fdc78').r);
        expect(material.emissiveIntensity).toBe(0.8);

        applyCardMaterialEmissive(material, { role: 'hoverGold', intensity: 0.9 });
        expect(material.emissive.r).toBeCloseTo(new Color('#f2d39d').r);
        expect(material.emissiveIntensity).toBe(0.9);

        applyCardMaterialEmissive(material, { role: 'none', intensity: 0 });
        expect(material.emissive.r).toBe(0);
        expect(material.emissive.g).toBe(0);
        expect(material.emissive.b).toBe(0);
        expect(material.emissiveIntensity).toBe(0);

        material.dispose();
    });

    it('applies dimmed tint, opacity, and side-specific emissive state to card materials', () => {
        const front = new MeshStandardMaterial();
        const back = new MeshStandardMaterial();
        const tint = new Color('#ffffff');

        applyCardMaterialVisualState({
            backMaterial: back,
            frontMaterial: front,
            state: {
                backEmissive: { role: 'hoverGold', intensity: 0.2 },
                dimBrightness: 0.5,
                dimOpacity: 0.88,
                frontEmissive: { role: 'mismatch', intensity: 0.4 }
            },
            tint
        });

        expect(tint.r).toBeCloseTo(0.5);
        expect(front.color.r).toBeCloseTo(0.5);
        expect(back.color.r).toBeCloseTo(0.5);
        expect(front.opacity).toBe(0.88);
        expect(back.opacity).toBe(0.88);
        expect(front.emissive.r).toBeCloseTo(new Color(RENDERER_THEME.colors.emberSoft).r);
        expect(front.emissiveIntensity).toBe(0.4);
        expect(back.emissive.r).toBeCloseTo(new Color('#f2d39d').r);
        expect(back.emissiveIntensity).toBe(0.2);

        front.dispose();
        back.dispose();
    });

    it('allows one side of card material application to be absent', () => {
        const front = new MeshStandardMaterial();

        applyCardMaterialVisualState({
            backMaterial: null,
            frontMaterial: front,
            state: {
                backEmissive: { role: 'hoverGold', intensity: 0.2 },
                dimBrightness: 0.75,
                dimOpacity: 0.9,
                frontEmissive: { role: 'none', intensity: 0 }
            },
            tint: new Color('#ffffff')
        });

        expect(front.color.r).toBeCloseTo(0.75);
        expect(front.opacity).toBe(0.9);
        expect(front.emissiveIntensity).toBe(0);

        front.dispose();
    });
});
