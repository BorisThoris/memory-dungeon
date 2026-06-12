import { describe, expect, it } from 'vitest';
import { Color, Mesh, PlaneGeometry } from 'three';
import { createCardArcaneGlowMaterial } from './cardArcaneGlowMaterial';
import { RENDERER_THEME } from '../styles/theme';
import {
    applyCardGlowVisualState,
    computeCardGlowVisualStates
} from './tileBoardGlowVisualState';

const baseInput = {
    cardGlowIntensity: 2,
    focusActive: false,
    hoverDomParity: false,
    hoverFaceUpPickable: false,
    hoverFrontRimOpacityTarget: 0.3,
    hoverRimOpacity: 0.5,
    reduceMotion: false,
    resolveGlowIntensity: 4,
    resolvingCrispOpacity: 0.3,
    resolvingSelection: null,
    time: 0
} as const;

const createGlowTarget = () => {
    const material = createCardArcaneGlowMaterial(7);
    const geometry = new PlaneGeometry(1, 1);
    const mesh = new Mesh(geometry, material);

    return {
        geometry,
        material,
        mesh,
        dispose(): void {
            geometry.dispose();
            material.dispose();
        }
    };
};

describe('tileBoardGlowVisualState', () => {
    it('builds hidden-back hover glow from DOM parity state', () => {
        const state = computeCardGlowVisualStates({
            ...baseInput,
            hoverDomParity: true
        });

        expect(state.hoverBack).toMatchObject({
            accent: 'emberSoft',
            intensity: 1,
            mode: 0,
            primary: 'goldBright',
            secondary: 'cyanBright'
        });
        expect(state.hoverBack.pulse).toBeCloseTo(0.42);
        expect(state.hoverFront.intensity).toBe(0);
    });

    it('builds face-up hover glow from front rim opacity', () => {
        const state = computeCardGlowVisualStates({
            ...baseInput,
            hoverFaceUpPickable: true
        });

        expect(state.hoverFront).toMatchObject({
            accent: 'emberSoft',
            intensity: 0.6,
            mode: 0.35,
            primary: 'goldBright',
            secondary: 'cyanBright'
        });
        expect(state.hoverFront.pulse).toBeCloseTo(0.272);
        expect(state.hoverBack.intensity).toBe(0);
    });

    it('builds mismatch resolving glow with danger primary and stronger mode', () => {
        const state = computeCardGlowVisualStates({
            ...baseInput,
            resolvingCrispOpacity: 0.75,
            resolvingSelection: 'mismatch'
        });

        expect(state.resolving).toEqual({
            accent: 'emberSoft',
            intensity: 3,
            mode: 1.3,
            primary: 'danger',
            pulse: 0.84,
            secondary: 'goldBright'
        });
    });

    it('uses fallback resolving intensity floor for non-mismatch resolving glow', () => {
        const state = computeCardGlowVisualStates({
            ...baseInput,
            resolvingCrispOpacity: 0.1,
            resolvingSelection: 'gambitNeutral'
        });

        expect(state.resolving).toMatchObject({
            accent: 'cyanBright',
            intensity: 1.68,
            mode: 0.8,
            primary: 'cyanBright',
            pulse: 0.62
        });
    });

    it('computes focus pulse with reduced-motion fallback', () => {
        const reduced = computeCardGlowVisualStates({
            ...baseInput,
            focusActive: true,
            reduceMotion: true
        });
        const animated = computeCardGlowVisualStates({
            ...baseInput,
            focusActive: true,
            reduceMotion: false,
            time: Math.PI / 4
        });

        expect(reduced.focus).toMatchObject({
            accent: 'text',
            intensity: 1.36,
            mode: 0.55,
            primary: 'goldBright',
            pulse: 0.18,
            secondary: 'cyanBright'
        });
        expect(animated.focus.pulse).not.toBe(0.18);
    });

    it('applies card glow state to shader uniforms and mesh visibility', () => {
        const target = createGlowTarget();

        applyCardGlowVisualState({
            elapsedTime: 3.25,
            glow: {
                accent: 'emberSoft',
                intensity: 1.25,
                mode: 0.35,
                primary: 'goldBright',
                pulse: 0.5,
                secondary: 'cyanBright'
            },
            mat: target.material,
            mesh: target.mesh,
            reduceMotion: false,
            renderQuality: { cardGlowMotion: 0.9 },
            shaderGlowEnabled: true
        });

        const uniforms = target.material.uniforms;
        expect(target.mesh.visible).toBe(true);
        expect(uniforms.uTime.value).toBe(3.25);
        expect(uniforms.uIntensity.value).toBe(1.25);
        expect(uniforms.uPulse.value).toBe(0.5);
        expect(uniforms.uMotion.value).toBe(0.9);
        expect(uniforms.uMode.value).toBe(0.35);

        const gold = new Color(RENDERER_THEME.colors.goldBright);
        expect(uniforms.uPrimaryColor.value.x).toBeCloseTo(gold.r);
        expect(uniforms.uPrimaryColor.value.y).toBeCloseTo(gold.g);
        expect(uniforms.uPrimaryColor.value.z).toBeCloseTo(gold.b);

        target.dispose();
    });

    it('hides glow and zeros intensity when shader glow is disabled', () => {
        const target = createGlowTarget();

        applyCardGlowVisualState({
            elapsedTime: 1,
            glow: {
                accent: 'text',
                intensity: 1,
                mode: 0.55,
                primary: 'goldBright',
                pulse: 0.2,
                secondary: 'cyanBright'
            },
            mat: target.material,
            mesh: target.mesh,
            reduceMotion: false,
            renderQuality: { cardGlowMotion: 0.7 },
            shaderGlowEnabled: false
        });

        expect(target.mesh.visible).toBe(false);
        expect(target.material.uniforms.uIntensity.value).toBe(0);
        expect(target.material.uniforms.uPulse.value).toBe(0.2);

        target.dispose();
    });

    it('caps reduced-motion glow motion and clamps driver uniforms', () => {
        const target = createGlowTarget();

        applyCardGlowVisualState({
            elapsedTime: 1,
            glow: {
                accent: 'emberSoft',
                intensity: 9,
                mode: 1.3,
                primary: 'danger',
                pulse: 5,
                secondary: 'goldBright'
            },
            mat: target.material,
            mesh: target.mesh,
            reduceMotion: true,
            renderQuality: { cardGlowMotion: 1.2 },
            shaderGlowEnabled: true
        });

        expect(target.material.uniforms.uIntensity.value).toBe(3);
        expect(target.material.uniforms.uPulse.value).toBe(2);
        expect(target.material.uniforms.uMotion.value).toBe(0.08);

        target.dispose();
    });
});
