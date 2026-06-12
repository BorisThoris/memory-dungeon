import { describe, expect, it } from 'vitest';
import {
    applyTileBoardFrameVisualState,
    computeTileBoardFrameVisualState
} from './tileBoardFrameVisualState';

const visualState = (overrides: Partial<Parameters<typeof computeTileBoardFrameVisualState>[0]> = {}) =>
    computeTileBoardFrameVisualState({
        faceUp: false,
        graphicsQuality: 'medium',
        hoverDomParity: false,
        hoverFaceUpPickable: false,
        isPinned: false,
        keyboardFocused: false,
        matchedVictoryBurst: 0,
        pickable: true,
        reduceMotion: false,
        resolvingSelection: null,
        tileState: 'hidden',
        time: 2,
        ...overrides
    });

describe('tileBoardFrameVisualState', () => {
    it('composes hidden-card hover gold into back glow state', () => {
        const state = visualState({ hoverDomParity: true });

        expect(state.hoverGoldState.hoverRimOpacity).toBeGreaterThan(0);
        expect(state.hoverGoldState.hoverEmissiveIntensity).toBeGreaterThan(0);
        expect(state.cardGlowStates.hoverBack.intensity).toBeGreaterThan(0);
        expect(state.cardGlowStates.hoverFront.intensity).toBe(0);
        expect(state.renderQuality.cardGlowIntensity).toBeGreaterThan(0);
    });

    it('composes face-up resolving state without enabling matched flame', () => {
        const state = visualState({
            faceUp: true,
            matchedVictoryBurst: 0.4,
            resolvingSelection: 'mismatch',
            tileState: 'flipped'
        });

        expect(state.resolvingRimState.resolvingActive).toBe(true);
        expect(state.resolvingRimState.colorRole).toBe('danger');
        expect(state.cardGlowStates.resolving.intensity).toBeGreaterThan(0);
        expect(state.flameState.visible).toBe(false);
    });

    it('composes matched persistent flame for medium and high quality cards', () => {
        const state = visualState({
            faceUp: true,
            graphicsQuality: 'high',
            matchedVictoryBurst: 0.6,
            tileState: 'matched'
        });

        expect(state.resolvingRimState.matchedVictoryPersistent).toBe(true);
        expect(state.flameState.visible).toBe(true);
        expect(state.flameState.intensity).toBeGreaterThan(0);
    });

    it('computes focus rim opacity only for keyboard-focused pickable non-matched cards', () => {
        expect(visualState({ keyboardFocused: true }).focusRimOpacity).toBeGreaterThan(0);
        expect(visualState({ keyboardFocused: true, pickable: false }).focusRimOpacity).toBe(0);
        expect(visualState({ keyboardFocused: true, tileState: 'matched' }).focusRimOpacity).toBe(0);
    });

    it('applies composed rim visual state to frame targets', () => {
        const state = visualState({
            faceUp: true,
            hoverFaceUpPickable: true,
            keyboardFocused: true,
            resolvingSelection: 'mismatch',
            tileState: 'flipped'
        });
        const hoverBackRim = { opacity: 0 };
        const hoverFrontRim = { opacity: 0 };
        const focusRim = { opacity: 0 };
        let resolvingColor = '';
        const resolvingRim = {
            color: {
                set(color: string): void {
                    resolvingColor = color;
                }
            },
            opacity: 0
        };

        applyTileBoardFrameVisualState({
            elapsedTime: 5,
            matchedVictoryBurst: 0,
            reduceMotion: false,
            state,
            targets: {
                focusGlow: { mat: null, mesh: null },
                focusRimMaterial: focusRim,
                hoverBackGlow: { mat: null, mesh: null },
                hoverBackRimMaterials: [hoverBackRim],
                hoverFrontGlow: { mat: null, mesh: null },
                hoverFrontRimMaterials: [hoverFrontRim],
                matchedVictoryFlame: { mat: null, mesh: null },
                resolvingGlow: { mat: null, mesh: null },
                resolvingRimMaterial: resolvingRim
            }
        });

        expect(hoverBackRim.opacity).toBe(0);
        expect(hoverFrontRim.opacity).toBeGreaterThan(0);
        expect(focusRim.opacity).toBeGreaterThan(0);
        expect(resolvingRim.opacity).toBeGreaterThan(0);
        expect(resolvingColor).not.toBe('');
    });
});
