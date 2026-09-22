import { describe, expect, it } from 'vitest';
import { CARD_FRONT_SVG_LAYER_NAMES, type CardFrontSvgLayerName } from './cardSvgPlaneGeometry';
import {
    CARD_FRONT_LAYER_BASE_OPACITY,
    CARD_FRONT_UNDER_ART_LAYERS,
    computeCardFrontLayerPhase,
    computeCardFrontLayerVisualState
} from './tileBoardCardFrontLayerVisualState';

const stateFor = (layerName: CardFrontSvgLayerName, time: number, seed = 41, reduceMotion = false) =>
    computeCardFrontLayerVisualState({
        index: CARD_FRONT_SVG_LAYER_NAMES.indexOf(layerName),
        layerName,
        reduceMotion,
        seed,
        time
    });

describe('computeCardFrontLayerVisualState', () => {
    it('gives every authored layer a base opacity and a stacking sliver', () => {
        for (const name of CARD_FRONT_SVG_LAYER_NAMES) {
            expect(CARD_FRONT_LAYER_BASE_OPACITY[name]).toBeGreaterThan(0);
            const state = stateFor(name, 0);
            expect(state.z).toBeGreaterThanOrEqual(0);
            expect(state.opacity).toBeGreaterThan(0);
        }
        // The art must show through the panel and the well, and only those.
        expect([...CARD_FRONT_UNDER_ART_LAYERS]).toEqual(['front-panel', 'front-well']);
    });

    it('holds the face still under reduce motion, at each layer base level', () => {
        for (const name of CARD_FRONT_SVG_LAYER_NAMES) {
            const a = stateFor(name, 0, 41, true);
            const b = stateFor(name, 7.3, 41, true);
            expect(a).toEqual(b);
            expect(a.rotationZ).toBe(0);
            expect(a.scale).toBe(1);
            expect(a.emissiveIntensity).toBe(0);
            expect(a.opacity).toBeCloseTo(CARD_FRONT_LAYER_BASE_OPACITY[name], 5);
        }
    });

    it('turns the rune ring one way, slowly, and never moves the panel', () => {
        const ringA = stateFor('front-rune-ring', 0);
        const ringB = stateFor('front-rune-ring', 10);
        expect(ringB.rotationZ).toBeGreaterThan(ringA.rotationZ);
        // A degree or two a second: a full turn takes about two minutes.
        expect(ringB.rotationZ - ringA.rotationZ).toBeLessThan(Math.PI / 4);
        for (const time of [0, 3.1, 9.7]) {
            const panel = stateFor('front-panel', time);
            expect(panel).toMatchObject({ rotationZ: 0, scale: 1, x: 0, y: 0 });
            expect(panel.opacity).toBe(1);
        }
    });

    it('keeps the motion small: nothing shifts the art or reads as a flicker', () => {
        for (const name of CARD_FRONT_SVG_LAYER_NAMES) {
            for (let step = 0; step <= 40; step += 1) {
                const state = stateFor(name, step * 0.37, step * 7 + 3);
                expect(Math.abs(state.x)).toBeLessThan(0.003);
                expect(Math.abs(state.y)).toBeLessThan(0.003);
                expect(Math.abs(state.scale - 1)).toBeLessThan(0.02);
                expect(state.opacity).toBeGreaterThanOrEqual(0.2);
                expect(state.opacity).toBeLessThanOrEqual(1);
                expect(state.emissiveIntensity).toBeGreaterThanOrEqual(0);
                expect(state.emissiveIntensity).toBeLessThanOrEqual(1);
            }
        }
    });

    it('spreads two cards apart by seed, and repeats for the same one', () => {
        expect(computeCardFrontLayerPhase(0)).toBe(0);
        const phases = new Set([0, 11, 97, 613].map((seed) => computeCardFrontLayerPhase(seed)));
        expect(phases.size).toBe(4);
        expect(stateFor('front-frame', 4.2, 11)).not.toEqual(stateFor('front-frame', 4.2, 97));
        expect(stateFor('front-frame', 4.2, 11)).toEqual(stateFor('front-frame', 4.2, 11));
    });
});
