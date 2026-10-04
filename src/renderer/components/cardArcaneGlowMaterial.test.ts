import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import {
    clampCardArcaneGlowDriverUniforms,
    createCardArcaneGlowMaterial
} from './cardArcaneGlowMaterial';
import {
    clampBoardRuneFieldDriverUniforms,
    createBoardRuneFieldMaterial,
    setBoardRuneFieldPalette
} from './boardRuneFieldMaterial';

describe('card arcane glow shader material', () => {
    it('creates the uniforms needed by card hover, focus, and resolve glow', () => {
        const material = createCardArcaneGlowMaterial(42);

        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(false);
        expect(material.uniforms.uTime.value).toBe(0);
        expect(material.uniforms.uIntensity.value).toBe(0);
        expect(material.uniforms.uMode.value).toBe(0);
        expect(material.fragmentShader).toContain('axisRune');

        material.dispose();
    });

    it('clamps driver uniforms before values reach the shader', () => {
        const material = createCardArcaneGlowMaterial(7);
        const u = material.uniforms;

        u.uIntensity.value = 12;
        u.uPulse.value = -4;
        u.uMotion.value = 5;
        clampCardArcaneGlowDriverUniforms({
            uIntensity: u.uIntensity,
            uPulse: u.uPulse,
            uMotion: u.uMotion
        });

        expect(u.uIntensity.value).toBe(3);
        expect(u.uPulse.value).toBe(0);
        expect(u.uMotion.value).toBe(1.5);

        material.dispose();
    });
});

describe('board rune field shader material', () => {
    it('updates the realm palette in linear color space without replacing uniforms', () => {
        const material = createBoardRuneFieldMaterial();
        const primary = material.uniforms.uGoldColor.value;
        const secondary = material.uniforms.uCyanColor.value;
        setBoardRuneFieldPalette(material, '#80c0ff', '#a0ffee');
        expect(material.uniforms.uGoldColor.value).toBe(primary);
        expect(material.uniforms.uCyanColor.value).toBe(secondary);
        const expected = new Color('#80c0ff');
        expect(primary.x).toBeCloseTo(expected.r);
        expect(primary.y).toBeCloseTo(expected.g);
        expect(primary.z).toBeCloseTo(expected.b);
        material.dispose();
    });
    it('creates a low-alpha additive rune field with clamped motion uniforms', () => {
        const material = createBoardRuneFieldMaterial();
        const u = material.uniforms;

        u.uIntensity.value = 9;
        u.uMotion.value = -1;
        clampBoardRuneFieldDriverUniforms({
            uIntensity: u.uIntensity,
            uMotion: u.uMotion
        });

        expect(material.transparent).toBe(true);
        expect(material.depthTest).toBe(false);
        expect(material.fragmentShader).toContain('fwidth(distance)');
        expect(u.uIntensity.value).toBe(1.4);
        expect(u.uMotion.value).toBe(0);

        material.dispose();
    });
});
