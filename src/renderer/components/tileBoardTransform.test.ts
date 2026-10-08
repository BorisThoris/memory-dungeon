import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import {
    BOARD_LAYOUT_ROW_STAGGER_X,
    CARD_PLANE_HEIGHT,
    CARD_PLANE_WIDTH,
    getTileColumnSpacing,
    TILE_SPACING
} from './tileShatter';
import { getTileTransform, hashTileLayoutSeed, layoutNormFromSeed } from './tileBoardTransform';
import { boardGridWorldSize } from './tileBoardResponsiveLayout';

const tile = (id: string): Tile => ({
    id,
    symbol: id,
    label: id,
    pairKey: id,
    state: 'hidden'
});

describe('tile board transform', () => {
    it('hashes tile ids deterministically for layout imperfections', () => {
        expect(hashTileLayoutSeed('a1')).toBe(hashTileLayoutSeed('a1'));
        expect(hashTileLayoutSeed('a1')).not.toBe(hashTileLayoutSeed('b1'));
    });

    it('gives the two halves of a pair unrelated seeds, so neither motion nor tilt pairs them', () => {
        // The halves of a pair are `${pairKey}-A` and `-B`: ids one character apart.
        let sameJitter = 0;
        let samePhase = 0;
        const pairs = 200;
        for (let n = 0; n < pairs; n += 1) {
            const a = getTileTransform(tile(`5-${n}-A`), 0, 4, 4, false, false, false);
            const b = getTileTransform(tile(`5-${n}-B`), 0, 4, 4, false, false, false);
            if (Math.abs(a.layoutJitterX - b.layoutJitterX) < 0.002 && Math.abs(a.layoutJitterY - b.layoutJitterY) < 0.002) sameJitter += 1;
            // The idle sway's phase (`tileBoardFrameAdvance.ts`).
            const phase = (seed: number) => (seed % 997) * 0.0063;
            if (Math.abs(phase(a.seed) - phase(b.seed)) < 0.2) samePhase += 1;
        }
        // Chance alone would put a few pairs close; the old hash put every pair there.
        expect(sameJitter).toBeLessThan(pairs * 0.05);
        expect(samePhase).toBeLessThan(pairs * 0.1);
    });

    it('maps seed bits into the expected jitter range', () => {
        expect(layoutNormFromSeed(0, 0)).toBeCloseTo(-1);
        expect(layoutNormFromSeed(1000, 0)).toBeCloseTo(1);
    });

    it('places tiles by grid position and flips hidden cards', () => {
        const transform = getTileTransform(tile('a1'), 0, 2, 2, false, false, true);
        expect(transform.baseX).toBeCloseTo(-getTileColumnSpacing(false) / 2);
        expect(transform.baseY).toBeCloseTo(TILE_SPACING / 2);
        expect(transform.flipRotationY).toBe(Math.PI);
        expect(transform.layoutJitterX).toBe(0);
        expect(transform.layoutYaw).toBe(0);
    });

    it('balances the stagger around the center of the deal', () => {
        const withoutMotion = getTileTransform(tile('a1'), 2, 2, 2, false, true, true);
        const withMotion = getTileTransform(tile('a1'), 2, 2, 2, false, true, false);
        expect(withMotion.baseX - withoutMotion.baseX).toBeCloseTo(BOARD_LAYOUT_ROW_STAGGER_X / 2);
        const topRow = getTileTransform(tile('b1'), 0, 2, 2, false, true, false);
        expect(topRow.baseX + withMotion.baseX).toBeCloseTo(-getTileColumnSpacing(false));
        expect(withMotion.flipRotationY).toBe(0);
    });

    it('keeps dense card faces separated and inside the fitted bounds', () => {
        for (const compact of [false, true]) {
            const bounds = boardGridWorldSize(6, 8, compact);
            const rects = Array.from({ length: 48 }, (_, index) => {
                const t = getTileTransform(tile(`floor-60-card-${index}`), index, 6, 8, compact, false, false);
                // Include the bezel and the rotated plane, not just each card's center.
                const angle = Math.abs(t.imperfectionRotationZ);
                const halfWidth = (CARD_PLANE_WIDTH * Math.cos(angle) + CARD_PLANE_HEIGHT * Math.sin(angle)) * t.baseScale * t.bezelScale / 2;
                const halfHeight = (CARD_PLANE_HEIGHT * Math.cos(angle) + CARD_PLANE_WIDTH * Math.sin(angle)) * t.baseScale * t.bezelScale / 2;
                const x = t.baseX + t.imperfectionX + t.layoutJitterX;
                const y = t.baseY + t.imperfectionY + t.layoutJitterY;
                return { left: x - halfWidth, right: x + halfWidth, bottom: y - halfHeight, top: y + halfHeight };
            });
            for (const [index, rect] of rects.entries()) {
                expect(rect.left).toBeGreaterThan(-bounds.width / 2);
                expect(rect.right).toBeLessThan(bounds.width / 2);
                expect(rect.bottom).toBeGreaterThan(-bounds.height / 2);
                expect(rect.top).toBeLessThan(bounds.height / 2);
                for (const other of rects.slice(index + 1)) {
                    expect(rect.right < other.left || other.right < rect.left || rect.top < other.bottom || other.top < rect.bottom).toBe(true);
                }
            }
        }
    });
});
