import { describe, expect, it } from 'vitest';
import { TILE_TRAIT_COPY } from './tile-trait-rules';
import {
    TILE_TRAIT_MARKS,
    describeTraitMark,
    tileTraitMark,
    traitMarkOffsets
} from './tile-trait-marks';
import type { TileTraitKind } from './contracts';

describe('trait marks', () => {
    it('gives every trait a mark', () => {
        expect(Object.keys(TILE_TRAIT_MARKS).sort()).toEqual((Object.keys(TILE_TRAIT_COPY) as TileTraitKind[]).sort());
    });

    it('gives every trait a different one, which is the whole point', () => {
        const signatures = Object.values(TILE_TRAIT_MARKS).map((mark) => `${mark.shape}:${mark.count}`);
        expect(new Set(signatures).size).toBe(signatures.length);
    });

    it('uses three shapes across three counts, so no mark needs more than three parts', () => {
        const counts = Object.values(TILE_TRAIT_MARKS).map((mark) => mark.count);
        expect(new Set(counts)).toEqual(new Set([1, 2, 3]));
        // Four pips in a row on a rail this size would not be countable at a glance.
        expect(Math.max(...counts)).toBe(3);
        expect(new Set(Object.values(TILE_TRAIT_MARKS).map((mark) => mark.shape)).size).toBe(3);
    });

    it('describes a mark the way a player would say it', () => {
        expect(describeTraitMark(tileTraitMark('conduit'))).toBe('1 dot');
        expect(describeTraitMark(tileTraitMark('echo'))).toBe('2 dots');
        expect(describeTraitMark(tileTraitMark('heavy'))).toBe('3 bars');
        expect(describeTraitMark(tileTraitMark('mirror'))).toBe('1 diamond');
    });
});

describe('traitMarkOffsets', () => {
    it('centres one mark', () => {
        expect(traitMarkOffsets(1, 0.09)).toEqual([0]);
    });

    it('centres a group evenly around the middle', () => {
        expect(traitMarkOffsets(2, 0.09)).toEqual([-0.045, 0.045]);
        const three = traitMarkOffsets(3, 0.09);
        expect(three[1]).toBeCloseTo(0, 10);
        expect(three[0]).toBeCloseTo(-0.09, 10);
        expect(three[2]).toBeCloseTo(0.09, 10);
    });

    it('keeps the widest group inside the rail it sits on', () => {
        // The rail is 0.26 wide; three marks at 0.09 spacing span 0.18 plus mark width.
        const widest = traitMarkOffsets(3, 0.09);
        expect(Math.max(...widest.map(Math.abs)) * 2).toBeLessThan(0.26);
    });
});
