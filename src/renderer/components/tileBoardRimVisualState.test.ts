import { describe, expect, it } from 'vitest';
import { Color, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { RENDERER_THEME } from '../styles/theme';
import { createMatchedCardRimFireMaterial } from './matchedCardRimFireMaterial';
import {
    applyFocusRimOpacity,
    applyMatchedVictoryFlameVisualState,
    applyResolvingRimVisualState,
    computeMatchedVictoryFlameVisualState,
    computeFocusRimOpacity,
    computeResolvingRimVisualState,
    getResolvingRimColorRole
} from './tileBoardRimVisualState';

const createFlameTarget = () => {
    const material = createMatchedCardRimFireMaterial(11);
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

describe('tileBoardRimVisualState', () => {
    it('maps resolving selections to renderer theme color roles', () => {
        expect(getResolvingRimColorRole('match')).toBe('emeraldBright');
        expect(getResolvingRimColorRole('mismatch')).toBe('danger');
        expect(getResolvingRimColorRole('gambitNeutral')).toBe('cyanBright');
    });

    it('keeps matched persistent rims visible only for the low-quality fallback', () => {
        const input = {
            faceUp: true,
            graphicsQuality: 'low',
            isPinned: false,
            matchedVictoryBurst: 0.5,
            reduceMotion: false,
            resolvingSelection: null,
            time: 0,
            tileState: 'matched'
        } as const;
        const low = computeResolvingRimVisualState(input);
        const high = computeResolvingRimVisualState({
            ...input,
            graphicsQuality: 'high'
        });

        expect(low).toMatchObject({
            colorRole: 'emeraldBright',
            matchedVictoryPersistent: true,
            resolvingActive: false
        });
        expect(low.opacity).toBe(
            GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.low.rimOpacity +
                GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.low.burstBoost * 0.5
        );
        expect(high.opacity).toBe(0);
    });

    it('keeps cashout stacks visibly hot on matched cards in high quality', () => {
        const state = computeResolvingRimVisualState({
            faceUp: true,
            graphicsQuality: 'high',
            isPinned: false,
            matchedVictoryBurst: 0.5,
            reduceMotion: false,
            resolvingSelection: null,
            routeReadabilityIntensity: 'stack',
            time: 0,
            tileState: 'matched'
        });

        expect(state.opacity).toBeGreaterThan(0);
        expect(state.matchedVictoryPersistent).toBe(true);
    });

    it('scales active resolving opacity down when shader glow is enabled', () => {
        const input = {
            faceUp: true,
            graphicsQuality: 'low',
            isPinned: false,
            matchedVictoryBurst: 0,
            reduceMotion: true,
            resolvingSelection: 'mismatch',
            time: 0,
            tileState: 'flipped'
        } as const;
        const low = computeResolvingRimVisualState(input);
        const medium = computeResolvingRimVisualState({
            ...input,
            graphicsQuality: 'medium'
        });

        expect(low).toMatchObject({
            colorRole: 'danger',
            crispOpacity: 0.62,
            opacity: 0.62,
            resolvingActive: true
        });
        expect(medium.opacity).toBeCloseTo(0.62 * 0.18);
    });

    it('boosts resolving crisp opacity for pinned face cards', () => {
        const input = {
            faceUp: true,
            graphicsQuality: 'low',
            isPinned: false,
            matchedVictoryBurst: 0,
            reduceMotion: true,
            resolvingSelection: 'match',
            time: 0,
            tileState: 'flipped'
        } as const;
        const plain = computeResolvingRimVisualState(input);
        const pinned = computeResolvingRimVisualState({
            ...input,
            isPinned: true
        });

        expect(pinned.crispOpacity).toBeGreaterThan(plain.crispOpacity);
        expect(pinned.crispOpacity).toBeLessThanOrEqual(1);
    });

    it('computes focus rim opacity for keyboard focus states', () => {
        expect(
            computeFocusRimOpacity({
                keyboardFocused: false,
                pickable: true,
                reduceMotion: false,
                tileState: 'hidden',
                time: 0
            })
        ).toBe(0);
        expect(
            computeFocusRimOpacity({
                keyboardFocused: true,
                pickable: true,
                reduceMotion: true,
                tileState: 'hidden',
                time: 0
            })
        ).toBe(0.68);
        expect(
            computeFocusRimOpacity({
                keyboardFocused: true,
                pickable: true,
                reduceMotion: false,
                tileState: 'matched',
                time: 0
            })
        ).toBe(0);
    });

    it('applies resolving rim color and opacity to a basic material', () => {
        const material = new MeshBasicMaterial({ color: '#ffffff', opacity: 0 });

        applyResolvingRimVisualState({
            material,
            state: {
                colorRole: 'danger',
                crispOpacity: 0.4,
                matchedVictoryPersistent: false,
                opacity: 0.42,
                resolvingActive: true
            }
        });

        expect(material.color.r).toBeCloseTo(new Color(RENDERER_THEME.colors.danger).r);
        expect(material.opacity).toBe(0.42);

        material.dispose();
    });

    it('preserves resolving rim color when no color role is active', () => {
        const material = new MeshBasicMaterial({ color: '#123456', opacity: 0.8 });
        const initialHex = material.color.getHexString();

        applyResolvingRimVisualState({
            material,
            state: {
                colorRole: null,
                crispOpacity: 0,
                matchedVictoryPersistent: false,
                opacity: 0,
                resolvingActive: false
            }
        });

        expect(material.color.getHexString()).toBe(initialHex);
        expect(material.opacity).toBe(0);

        material.dispose();
    });

    it('applies focus rim opacity and tolerates missing focus material', () => {
        const material = { opacity: 0 };

        applyFocusRimOpacity({ material, opacity: 0.68 });
        applyFocusRimOpacity({ material: null, opacity: 1 });

        expect(material.opacity).toBe(0.68);
    });

    it('tolerates missing resolving rim material', () => {
        expect(() =>
            applyResolvingRimVisualState({
                material: null,
                state: {
                    colorRole: 'emeraldBright',
                    crispOpacity: 0.5,
                    matchedVictoryPersistent: true,
                    opacity: 0.5,
                    resolvingActive: false
                }
            })
        ).not.toThrow();
    });

    it('builds matched victory flame state for shader-backed matched cards', () => {
        const state = computeMatchedVictoryFlameVisualState({
            graphicsQuality: 'high',
            matchedVictoryBurst: 0.5,
            matchedVictoryPersistent: true,
            reduceMotion: false
        });
        const tier = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers.high;

        expect(state).toEqual({
            emberStrength: tier.emberStrength,
            innerWidth: GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.band.innerWidth * tier.innerWidthMul,
            intensity: tier.baseIntensity + tier.burstIntensity * 0.5,
            motion: tier.motion,
            outerWidth: GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.band.outerWidth * tier.outerWidthMul,
            softness: GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.band.softness,
            visible: true
        });
    });

    it('uses the reduce-motion flame tier before quality tiers', () => {
        const state = computeMatchedVictoryFlameVisualState({
            graphicsQuality: 'high',
            matchedVictoryBurst: 0,
            matchedVictoryPersistent: true,
            reduceMotion: true
        });
        const tier = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers.reduceMotion;

        expect(state.motion).toBe(tier.motion);
        expect(state.intensity).toBe(tier.baseIntensity);
        expect(state.visible).toBe(true);
    });

    it('hides matched victory flame when low quality or not persistently matched', () => {
        expect(
            computeMatchedVictoryFlameVisualState({
                graphicsQuality: 'low',
                matchedVictoryBurst: 1,
                matchedVictoryPersistent: true,
                reduceMotion: false
            }).visible
        ).toBe(false);
        expect(
            computeMatchedVictoryFlameVisualState({
                graphicsQuality: 'medium',
                matchedVictoryBurst: 1,
                matchedVictoryPersistent: false,
                reduceMotion: false
            }).visible
        ).toBe(false);
    });

    it('applies matched victory flame state to shader uniforms', () => {
        const target = createFlameTarget();
        const state = {
            emberStrength: 1.4,
            innerWidth: 0.12,
            intensity: 2.2,
            motion: 0.7,
            outerWidth: 0.34,
            softness: 0.18,
            visible: true
        };

        applyMatchedVictoryFlameVisualState({
            elapsedTime: 4.5,
            mat: target.material,
            mesh: target.mesh,
            matchedVictoryBurst: 0.8,
            state
        });

        const uniforms = target.material.uniforms;
        expect(target.mesh.visible).toBe(true);
        expect(uniforms.uTime.value).toBe(4.5);
        expect(uniforms.uBurst.value).toBe(0.8);
        expect(uniforms.uMotion.value).toBe(0.7);
        expect(uniforms.uSoftness.value).toBe(0.18);
        expect(uniforms.uInnerWidth.value).toBe(0.12);
        expect(uniforms.uOuterWidth.value).toBe(0.34);
        expect(uniforms.uEmberStrength.value).toBe(1.4);
        expect(uniforms.uIntensity.value).toBe(2.2);

        target.dispose();
    });

    it('hides matched victory flame without mutating hidden-state driver uniforms', () => {
        const target = createFlameTarget();
        target.material.uniforms.uIntensity.value = 0.5;

        applyMatchedVictoryFlameVisualState({
            elapsedTime: 4.5,
            mat: target.material,
            mesh: target.mesh,
            matchedVictoryBurst: 0.8,
            state: {
                emberStrength: 0,
                innerWidth: 0,
                intensity: 2.2,
                motion: 0,
                outerWidth: 0,
                softness: 0.18,
                visible: false
            }
        });

        expect(target.mesh.visible).toBe(false);
        expect(target.material.uniforms.uIntensity.value).toBe(0.5);

        target.dispose();
    });

    it('clamps matched victory flame driver uniforms while applying state', () => {
        const target = createFlameTarget();

        applyMatchedVictoryFlameVisualState({
            elapsedTime: 4.5,
            mat: target.material,
            mesh: target.mesh,
            matchedVictoryBurst: 5,
            state: {
                emberStrength: 1,
                innerWidth: 0.12,
                intensity: 9,
                motion: 0.7,
                outerWidth: 0.34,
                softness: 0.18,
                visible: true
            }
        });

        expect(target.material.uniforms.uIntensity.value).toBe(4);
        expect(target.material.uniforms.uBurst.value).toBe(2);

        target.dispose();
    });
});
