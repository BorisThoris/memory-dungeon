import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import { METEOR_IMPACT_DELAY_SECONDS } from './itemEffects';
import { createHitStopClock, ITEM_HIT_STOP_SECONDS, meteorDepartureDelaySec, meteorThrowDirection, putMeteorThrow, takeBackMeteorThrow } from './meteorImpactMotion';
import { getBreakWaveDelaySec } from './tileBoardBreakWave';

const tile = (id: string, struck?: number): Tile => ({ id, pairKey: id.slice(0, 1), symbol: id, label: id, state: struck != null ? 'removed' : 'hidden', meteorStruck: struck }) as Tile;
// A 3x3 board, the rock landing in the middle (cell 4), cards 0, 4 and 8 taken.
const board = {
    columns: 3,
    tiles: [tile('a0', 1), tile('b1'), tile('c2'), tile('d3'), tile('e4', 1), tile('f5'), tile('g6'), tile('h7'), tile('i8', 1)],
    meteorImpact: { key: 1, cell: 4, radius: 1.6, cards: 3 }
} as unknown as BoardState;

describe('meteor impact motion', () => {
    it('holds struck cards until the rock lands, then ripples them out from the crater', () => {
        const centre = meteorDepartureDelaySec(board, board.tiles[4]!)!;
        const corner = meteorDepartureDelaySec(board, board.tiles[0]!)!;
        expect(centre).toBe(METEOR_IMPACT_DELAY_SECONDS);
        expect(corner).toBeGreaterThan(centre);
        expect(getBreakWaveDelaySec(board, board.tiles[8]!)).toBeCloseTo(corner);
        expect(meteorDepartureDelaySec(board, board.tiles[1]!)).toBeNull();
        // An old impact's cards do not wait on a newer one.
        expect(meteorDepartureDelaySec({ ...board, meteorImpact: { ...board.meteorImpact!, key: 2 } }, board.tiles[0]!)).toBeNull();
    });

    it('throws struck cards away from the crater, and takes the throw back each frame', () => {
        const out = meteorThrowDirection(board, board.tiles[0]!)!;
        expect(out.x).toBeCloseTo(-Math.SQRT1_2);
        expect(out.y).toBeCloseTo(Math.SQRT1_2);
        expect(meteorThrowDirection(board, board.tiles[4]!)).toEqual({ x: 0, y: 0 });
        const card = { position: { x: 1, y: 2 } };
        putMeteorThrow(card, { x: 1, y: 0 }, 0.5);
        expect(card.position.x).toBeGreaterThan(1);
        takeBackMeteorThrow(card);
        expect(card.position.x).toBeCloseTo(1);
        expect(card.position.y).toBe(2);
    });

    it('stops the visual clock at a hit for its hold, the meteor twice the bomb', () => {
        expect(ITEM_HIT_STOP_SECONDS.meteor).toBeCloseTo(ITEM_HIT_STOP_SECONDS.bomb! * 2);
        const clock = createHitStopClock();
        clock.hold(1, 0.12);
        let visual = clock.advance(0.95, 0.1);
        expect(visual).toBeCloseTo(1);
        expect(clock.holding).toBe(true);
        visual = clock.advance(visual, 0.05);
        expect(visual).toBeCloseTo(1);
        visual = clock.advance(visual, 0.05);
        expect(visual).toBeCloseTo(1.03);
        expect(clock.holding).toBe(false);
        expect(clock.advance(visual, 0.1)).toBeCloseTo(1.13);
    });
});
