import { Color, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { applyTileBoardFrameMaterialState } from './tileBoardFrameMaterialState';

const tile = (overrides: Partial<Tile> = {}): Tile =>
    ({
        id: 'tile-a',
        label: 'A',
        pairKey: 'pair-a',
        state: 'hidden',
        ...overrides
    }) as Tile;

const state = (overrides: Partial<Parameters<typeof applyTileBoardFrameMaterialState>[0]['state']> = {}) => ({
    cardTint: {
        enemyOccupiedBack: false,
        faceUp: false,
        graphicsQuality: 'medium' as const,
        hazardBackAccent: null,
        hoverDomParity: false,
        hoverFaceUpPickable: false,
        isPinned: false,
        nonPickableBack: false,
        objectiveBackAccent: false,
        presentationNBackAnchor: false,
        presentationSilhouette: false,
        presentationWideRecall: false,
        resolvingSelection: null,
        routeBackAccent: false,
        tile: tile()
    },
    currentFocusDimBlend: 0,
    delta: 1 / 60,
    faceUp: false,
    focusDimmed: false,
    graphicsQuality: 'medium' as const,
    hoverEmissiveIntensity: 0,
    reduceMotion: false,
    resolvingSelection: null,
    tileState: 'hidden' as const,
    time: 1,
    ...overrides
});

describe('tileBoardFrameMaterialState', () => {
    it('applies card tint, focus dim blend, and material opacity/color in one frame pass', () => {
        const front = new MeshStandardMaterial();
        const back = new MeshStandardMaterial();
        const tint = new Color();

        const result = applyTileBoardFrameMaterialState({
            backMaterial: back,
            frontMaterial: front,
            scratchColor: new Color(),
            state: state({
                cardTint: {
                    ...state().cardTint,
                    isPinned: true
                },
                focusDimmed: true
            }),
            tint
        });

        expect(result.focusDimBlend).toBeGreaterThan(0);
        expect(tint.r).toBeLessThan(1);
        expect(front.color.r).toBeCloseTo(tint.r);
        expect(back.color.r).toBeCloseTo(tint.r);
        expect(front.opacity).toBeLessThan(1);
        expect(back.opacity).toBeLessThan(1);

        front.dispose();
        back.dispose();
    });

    it('passes hover emissive intensity through to material visual state', () => {
        const front = new MeshStandardMaterial();
        const back = new MeshStandardMaterial();

        applyTileBoardFrameMaterialState({
            backMaterial: back,
            frontMaterial: front,
            scratchColor: new Color(),
            state: state({ hoverEmissiveIntensity: 0.42 }),
            tint: new Color()
        });

        expect(front.emissiveIntensity).toBe(0.42);
        expect(back.emissiveIntensity).toBe(0.42);

        front.dispose();
        back.dispose();
    });
});
