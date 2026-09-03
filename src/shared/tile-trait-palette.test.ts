import { describe, expect, it } from 'vitest';
import { COLOR_VISION_KINDS, colorDistance, findConfusablePairs, hexToRgb } from './color-vision';
import { tileTraitColor, tileTraitPalette } from './tile-trait-rules';
import { TILE_TRAIT_COPY } from './tile-trait-rules';
import type { TileTraitKind } from './contracts';

/**
 * The board says which trait a tile carries by tinting a marker, so two traits that look the same
 * are two rules the player cannot tell apart. This is the gate that would have caught the palette
 * as it shipped: Sealed and Stasis sat dE 2.1 apart under deuteranopia — under the just-noticeable
 * step, so for those players they were one colour.
 */
const MIN_TRAIT_COLOR_DISTANCE = 25;

/** The board ground. A marker also has to be visible against what is behind it. */
const BOARD_GROUND = '#090d18';
const MIN_GROUND_CONTRAST = 45;

describe('tile trait palette', () => {
    const palette = tileTraitPalette();

    it('covers every trait exactly once', () => {
        expect(Object.keys(palette).sort()).toEqual((Object.keys(TILE_TRAIT_COPY) as TileTraitKind[]).sort());
        for (const kind of Object.keys(palette) as TileTraitKind[]) {
            expect(tileTraitColor(kind)).toBe(palette[kind]);
        }
    });

    it('keeps every pair of traits apart for every kind of colour vision', () => {
        const confusable = findConfusablePairs(palette, MIN_TRAIT_COLOR_DISTANCE);
        // Name what collided before asserting, so a failure says which two rules merged and for whom.
        for (const pair of confusable) {
            console.log(`TRAIT PALETTE ${pair.vision}: ${pair.left} vs ${pair.right} = dE ${pair.distance.toFixed(1)}`);
        }
        expect(confusable).toEqual([]);
    });

    it('keeps every marker readable against the board it sits on', () => {
        const ground = hexToRgb(BOARD_GROUND);
        const faint = (Object.entries(palette) as [TileTraitKind, string][])
            .map(([kind, hex]) => ({ distance: colorDistance(hexToRgb(hex), ground), kind }))
            .filter((row) => row.distance < MIN_GROUND_CONTRAST);
        expect(faint).toEqual([]);
    });

    it('is measured against all four visions, so adding one to the list cannot silently skip the gate', () => {
        expect([...COLOR_VISION_KINDS]).toEqual(['normal', 'protanopia', 'deuteranopia', 'tritanopia']);
    });
});
