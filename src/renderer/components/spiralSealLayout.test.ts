import { describe, expect, it } from 'vitest';
import { makeBoard, makeTile } from '../../shared/test/game-fixtures';
import { heldSeedCells, holdSeedGlow, SEAL_SETTLE_SECONDS, sealSettleScale, sealedSlabCells } from './spiralSealLayout';

describe('the Spiral seals on the board (DGE-030)', () => {
    it('a slab on every sealed cell and nowhere else', () => {
        const board = makeBoard(
            [makeTile('A1', 'A', 'A', { state: 'matched', sealed: true }), makeTile('B1', 'B', 'B'), makeTile('A2', 'A', 'A', { state: 'matched', sealed: true }), makeTile('B2', 'B', 'B')],
            { columns: 2, rows: 2, level: 44 }
        );
        expect(sealedSlabCells(board, false, false).map((cell) => cell.index)).toEqual([0, 2]);
    });

    it('a slab settles from a little larger into place, and is simply there with reduced motion', () => {
        expect(sealSettleScale(0, false)).toBeGreaterThan(1);
        expect(sealSettleScale(SEAL_SETTLE_SECONDS / 2, false)).toBeLessThan(sealSettleScale(0, false));
        expect(sealSettleScale(SEAL_SETTLE_SECONDS, false)).toBe(1);
        expect(sealSettleScale(0, true)).toBe(1);
    });
});

describe('the Hold seeds on the board (DGE-030)', () => {
    it('a seed on every held card and nowhere else', () => {
        const board = makeBoard(
            [makeTile('A1', 'A', 'A', { state: 'matched' }), makeTile('B1', 'B', 'B'), makeTile('A2', 'A', 'A', { state: 'matched' }), makeTile('B2', 'B', 'B')],
            { columns: 2, rows: 2, level: 14 }
        );
        expect(heldSeedCells(board, ['A1', 'A2'], false, false).map((cell) => cell.index)).toEqual([0, 2]);
        expect(heldSeedCells(board, [], false, false)).toEqual([]);
    });

    it('burns brighter with every pair held, never past full, and holds still with reduced motion', () => {
        const still = (pairs: number) => holdSeedGlow(0, pairs, true);
        expect(still(2)).toBeGreaterThan(still(1));
        expect(still(64)).toBeGreaterThan(still(12));
        expect(still(4096)).toBeLessThan(1);
        expect(holdSeedGlow(1, 4, true)).toBe(holdSeedGlow(2, 4, true));
        expect(holdSeedGlow(0.6, 4, false)).not.toBe(holdSeedGlow(1.9, 4, false));
    });
});
