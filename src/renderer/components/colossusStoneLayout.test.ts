import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { colossusFitLift, colossusReservedRows, colossusStoneLayout } from './colossusStoneLayout';
import { CARD_PLANE_HEIGHT, TILE_SPACING } from './tileShatter';

const fixed = { colossus: { form: 'fixed' } } as unknown as BoardState;
const turning = { colossus: { cycle: ['ember', 'tide'] } } as unknown as BoardState;

describe('colossus stone layout', () => {
    it('keeps two rows above the grid for a fixed Colossus only, and lowers the fit by half of them', () => {
        expect(colossusReservedRows(fixed)).toBe(2);
        expect(colossusReservedRows(turning)).toBe(0);
        expect(colossusReservedRows({} as BoardState)).toBe(0);
        expect(colossusFitLift(fixed)).toBeCloseTo(TILE_SPACING);
    });

    it('stands two cells by two, its foot clear of the top row', () => {
        const layout = colossusStoneLayout({ rows: 4 } as BoardState, false);
        const topRowCardTop = 1.5 * TILE_SPACING + CARD_PLANE_HEIGHT / 2;
        expect(layout.height).toBeCloseTo(TILE_SPACING + CARD_PLANE_HEIGHT);
        expect(layout.y - layout.height / 2).toBeGreaterThan(topRowCardTop);
    });
});
