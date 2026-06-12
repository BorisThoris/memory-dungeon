import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { applyTileBoardCardTint, type TileBoardCardTintInput } from './tileBoardCardTint';

const tile = (overrides: Partial<Tile> = {}): Tile =>
    ({
        id: 'tile-a',
        pairKey: 'pair-a',
        label: 'A',
        state: 'hidden',
        ...overrides
    }) as Tile;

const input = (overrides: Partial<TileBoardCardTintInput> = {}): TileBoardCardTintInput => ({
    enemyOccupiedBack: false,
    faceUp: false,
    graphicsQuality: 'medium',
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
    tile: tile(),
    ...overrides
});

const tintHex = (state: TileBoardCardTintInput): string => {
    const target = new Color();
    applyTileBoardCardTint(state, target, new Color());
    return `#${target.getHexString()}`;
};

describe('tileBoardCardTint', () => {
    it('applies direct state tints for pinned backs and mismatch faces', () => {
        expect(tintHex(input({ isPinned: true }))).toBe('#d4b870');
        expect(tintHex(input({ faceUp: true, resolvingSelection: 'mismatch' }))).toBe('#ffb4a6');
        expect(tintHex(input({ faceUp: true, resolvingSelection: 'gambitNeutral' }))).toBe('#cfe8f2');
    });

    it('keeps matched faces neutral except for the low-quality static glow fallback', () => {
        expect(tintHex(input({ faceUp: true, tile: tile({ state: 'matched' }) }))).toBe('#ffffff');
        expect(tintHex(input({ faceUp: true, graphicsQuality: 'low', tile: tile({ state: 'matched' }) }))).not.toBe(
            '#ffffff'
        );
    });

    it('blends hidden readability and hover accents without reallocating the target color', () => {
        const target = new Color();
        const result = applyTileBoardCardTint(
            input({
                hazardBackAccent: 'cascade_cache',
                hoverDomParity: true
            }),
            target,
            new Color()
        );

        expect(result).toBe(target);
        expect(target.r).toBeLessThan(1);
        expect(target.g).toBeLessThan(1);
        expect(target.b).toBeLessThan(1);
    });

    it('applies presentation tints and silhouette darkening in order', () => {
        const base = new Color(tintHex(input({ presentationNBackAnchor: true, presentationWideRecall: true })));
        const silhouette = new Color(
            tintHex(
                input({
                    presentationNBackAnchor: true,
                    presentationSilhouette: true,
                    presentationWideRecall: true
                })
            )
        );

        expect(silhouette.r).toBeLessThan(base.r);
        expect(silhouette.g).toBeLessThan(base.g);
        expect(silhouette.b).toBeLessThan(base.b);
    });
});
