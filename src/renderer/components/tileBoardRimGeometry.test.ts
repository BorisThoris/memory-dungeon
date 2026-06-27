import { describe, expect, it } from 'vitest';
import { RingGeometry } from 'three';
import {
    getSharedFindableCornerHaloGeometry,
    getSharedFindableCornerRingGeometry,
    getSharedFindableScoreGlyphGeometry,
    getSharedFindableShardGlyphGeometry
} from './tileBoardRimGeometry';

describe('tileBoardRimGeometry findable singletons', () => {
    it('reuses shared geometries for findable corner and glyph accents', () => {
        expect(getSharedFindableCornerHaloGeometry()).toBe(getSharedFindableCornerHaloGeometry());
        expect(getSharedFindableCornerRingGeometry()).toBe(getSharedFindableCornerRingGeometry());
        expect(getSharedFindableShardGlyphGeometry()).toBe(getSharedFindableShardGlyphGeometry());
        expect(getSharedFindableScoreGlyphGeometry()).toBe(getSharedFindableScoreGlyphGeometry());
        expect(getSharedFindableCornerHaloGeometry()).toBeInstanceOf(RingGeometry);
        expect(getSharedFindableShardGlyphGeometry().parameters.thetaSegments).toBe(4);
        expect(getSharedFindableScoreGlyphGeometry().parameters.thetaSegments).toBeGreaterThan(4);
    });
});
