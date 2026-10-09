import { describe, expect, it } from 'vitest';
import { cardShardPieces, shardFlight, shardPose } from './cardShards';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

const area = (outline: ReadonlyArray<readonly [number, number]>): number => {
    let sum = 0;
    for (let index = 0; index < outline.length; index += 1) {
        const [ax, ay] = outline[index]!;
        const [bx, by] = outline[(index + 1) % outline.length]!;
        sum += ax * by - bx * ay;
    }
    return Math.abs(sum) / 2;
};

describe('a card breaking', () => {
    it('cuts the whole card into pieces, none a sliver, the same way every time for the same card', () => {
        const pieces = cardShardPieces(42, 9);
        expect(pieces).toHaveLength(9);
        const total = pieces.reduce((sum, piece) => sum + area(piece.outline), 0);
        expect(total).toBeCloseTo(CARD_PLANE_WIDTH * CARD_PLANE_HEIGHT, 6);
        for (const piece of pieces) {
            expect(area(piece.outline)).toBeGreaterThan((CARD_PLANE_WIDTH * CARD_PLANE_HEIGHT) / 40);
            expect(Math.abs(piece.cx)).toBeLessThanOrEqual(CARD_PLANE_WIDTH / 2);
            expect(Math.abs(piece.cy)).toBeLessThanOrEqual(CARD_PLANE_HEIGHT / 2);
        }
        expect(cardShardPieces(42, 9)).toEqual(pieces);
        expect(cardShardPieces(43, 9)).not.toEqual(pieces);
    });

    it('throws each piece out, drops it under gravity onto the floor, bounces it lower each time and lets it rest', () => {
        const pieces = cardShardPieces(7, 9);
        const floor = -3;
        for (const [index, piece] of pieces.entries()) {
            const flight = shardFlight(piece, 7, index, 2);
            // Thrown away from the card's centre, toward the camera.
            expect(Math.sign(flight.vx)).toBe(Math.sign(piece.cx) || Math.sign(flight.vx));
            expect(flight.vz).toBeGreaterThan(0);
            let lowest = Infinity;
            let landedAt = -1;
            const peaks: number[] = [];
            let last = -Infinity;
            let rising = false;
            for (let t = 0; t <= 3; t += 1 / 240) {
                const pose = shardPose(flight, t, piece.cx, piece.cy, 0, floor);
                lowest = Math.min(lowest, pose.y);
                if (pose.landed && landedAt < 0) landedAt = t;
                if (landedAt >= 0) {
                    if (pose.y > last + 1e-6) rising = true;
                    else if (rising && pose.y < last - 1e-6) {
                        peaks.push(last);
                        rising = false;
                    }
                }
                last = pose.y;
            }
            // Never through the floor; it gets there; each bounce lower than the last; and it comes to rest.
            expect(lowest).toBeGreaterThanOrEqual(floor - 1e-9);
            expect(landedAt).toBeGreaterThan(0);
            for (let k = 1; k < peaks.length; k += 1) expect(peaks[k]!).toBeLessThan(peaks[k - 1]!);
            expect(shardPose(flight, 3, piece.cx, piece.cy, 0, floor).resting).toBe(true);
        }
    });
});
