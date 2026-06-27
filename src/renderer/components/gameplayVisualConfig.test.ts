import { describe, expect, it } from 'vitest';
import { CARD_INTERACTION_FEEDBACK, GAMEPLAY_BOARD_VISUALS, GAMEPLAY_CARD_VISUALS } from './gameplayVisualConfig';
import { GAMEPLAY_RENDER_PROFILE, gameplayRenderQualityProfile } from './gameplayRenderProfile';

describe('REG-012 card materials and interaction FX tokens', () => {
    it('keeps match, mismatch, invalid, and combo feedback distinct and reduced-motion safe', () => {
        expect(GAMEPLAY_BOARD_VISUALS.interactionFeedback.match.material).toContain('victory');
        expect(GAMEPLAY_BOARD_VISUALS.interactionFeedback.mismatch.material).toContain('danger');
        expect(GAMEPLAY_BOARD_VISUALS.interactionFeedback.invalid.material).toContain('blocked');
        expect(GAMEPLAY_BOARD_VISUALS.interactionFeedback.combo.material).toContain('gold');
        expect(
            new Set(Object.values(GAMEPLAY_BOARD_VISUALS.interactionFeedback).map((entry) => entry.material)).size
        ).toBe(4);
        expect(Object.values(GAMEPLAY_BOARD_VISUALS.interactionFeedback).every((entry) => entry.reducedMotion.length > 0)).toBe(true);
    });

    it('keeps card interaction feedback tokens complete for visual and audio QA', () => {
        expect(Object.keys(CARD_INTERACTION_FEEDBACK)).toEqual([
            'hidden',
            'hover',
            'flip',
            'match',
            'mismatch',
            'combo',
            'invalid',
            'disabled'
        ]);
        expect(CARD_INTERACTION_FEEDBACK.flip.audioCue).toBe('flip');
        expect(CARD_INTERACTION_FEEDBACK.match.visualCue).toContain('score floater');
        expect(Object.values(CARD_INTERACTION_FEEDBACK).every((entry) => entry.reducedMotionCue.length > 0)).toBe(true);
    });
});

describe('gameplay renderer profile', () => {
    it('drives spectacle values from one arcane workshop profile', () => {
        expect(GAMEPLAY_RENDER_PROFILE.id).toBe('arcane-workshop-v2');
        expect(GAMEPLAY_CARD_VISUALS.renderProfile).toBe(GAMEPLAY_RENDER_PROFILE.id);
        expect(GAMEPLAY_CARD_VISUALS.textureVersion).toBeGreaterThanOrEqual(49);
        expect(GAMEPLAY_CARD_VISUALS.surfaceMapVersion).toBeGreaterThanOrEqual(5);
        expect(gameplayRenderQualityProfile('high').bloomIntensity).toBeGreaterThan(
            gameplayRenderQualityProfile('medium').bloomIntensity
        );
        expect(gameplayRenderQualityProfile('high').cardDisplacementScale).toBeGreaterThan(
            gameplayRenderQualityProfile('low').cardDisplacementScale
        );
        expect(gameplayRenderQualityProfile('high').cardGlowIntensity).toBeGreaterThan(
            gameplayRenderQualityProfile('medium').cardGlowIntensity
        );
        expect(gameplayRenderQualityProfile('medium').stageRuneFieldIntensity).toBeGreaterThan(0);
        expect(gameplayRenderQualityProfile('low').cardGlowIntensity).toBe(0);
        expect(gameplayRenderQualityProfile('low').stageRuneFieldIntensity).toBe(0);
        expect(GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales.high.emissiveIntensity).toBe(
            GAMEPLAY_RENDER_PROFILE.quality.high.hoverEmissive
        );
        expect(GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers.high.outerWidthMul).toBe(
            GAMEPLAY_RENDER_PROFILE.quality.high.matchOuterWidth
        );
    });
});
