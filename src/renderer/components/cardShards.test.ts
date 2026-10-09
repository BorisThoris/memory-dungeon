import { describe, expect, it } from 'vitest';
import { cardShardPieces, SHARD_STYLES, shardFlight, shardPath, shardPose, shardStyleOf, type ShardStyle } from './cardShards';
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

const flights = (style: ShardStyle, floor = -3) => {
    const spec = SHARD_STYLES[style];
    return cardShardPieces(11, spec.count).map((piece, index) => {
        const flight = shardFlight(piece, 11, index, spec);
        return { piece, flight, path: shardPath(flight, spec, piece.cx, piece.cy, 0, floor) };
    });
};

describe('a card breaking, its element\'s way', () => {
    it('cuts the whole card into pieces, none a sliver, the same way every time for the same card', () => {
        for (const count of [4, 6, 8, 9]) {
            const pieces = cardShardPieces(42, count);
            expect(pieces).toHaveLength(count);
            expect(pieces.reduce((sum, piece) => sum + area(piece.outline), 0)).toBeCloseTo(CARD_PLANE_WIDTH * CARD_PLANE_HEIGHT, 6);
            for (const piece of pieces) expect(area(piece.outline)).toBeGreaterThan((CARD_PLANE_WIDTH * CARD_PLANE_HEIGHT) / (count * 6));
        }
        expect(cardShardPieces(42, 6)).toEqual(cardShardPieces(42, 6));
        expect(cardShardPieces(43, 6)).not.toEqual(cardShardPieces(42, 6));
    });

    it('gives each element its own break', () => {
        expect(shardStyleOf('ember')).toBe('fire');
        expect(shardStyleOf('tide')).toBe('water');
        expect(shardStyleOf('bone')).toBe('ice');
        expect(shardStyleOf('moss')).toBe('growth');
        expect(shardStyleOf(undefined)).toBe('stone');
        expect(new Set(Object.values(SHARD_STYLES).map((style) => style.look)).size).toBe(5);
    });

    it('keeps out of the way: few pieces, thrown back behind the board, gone within three seconds', () => {
        for (const style of Object.keys(SHARD_STYLES) as ShardStyle[]) {
            expect(SHARD_STYLES[style].count).toBeLessThanOrEqual(8);
            expect(SHARD_STYLES[style].life).toBeLessThanOrEqual(3);
            for (const { flight, path } of flights(style)) {
                expect(flight.vz).toBeLessThan(0);
                expect(shardPose(path, 0.5).z).toBeLessThan(0);
            }
        }
    });

    it('moves each element as its matter does: ice bounces, water does not, fire lifts, a leaf falls slowest', () => {
        const bounces = (style: ShardStyle) => flights(style).some(({ path }) => {
            let wasDown = false;
            for (let t = 0; t < SHARD_STYLES[style].life; t += 1 / 120) {
                const pose = shardPose(path, t);
                if (pose.landed && pose.y > -3 + 0.02) return true;
                wasDown = wasDown || pose.landed;
            }
            return false;
        });
        expect(bounces('ice')).toBe(true);
        expect(bounces('water')).toBe(false);
        // Fire's pieces rise on their heat before they fall.
        expect(flights('fire').every(({ piece, path }) => Math.max(...[0.1, 0.2, 0.3].map((t) => shardPose(path, t).y)) > piece.cy)).toBe(true);
        // The same drop takes a leaf far longer than a stone.
        const reach = (style: ShardStyle, depth: number) => {
            const spec = SHARD_STYLES[style];
            const piece = cardShardPieces(3, spec.count)[0]!;
            const path = shardPath({ ...shardFlight(piece, 3, 0, spec), vx: 0, vy: 0 }, spec, 0, 0, 0, -depth);
            return path.landS;
        };
        expect(reach('growth', 1.5)).toBeGreaterThan(reach('stone', 1.5) * 1.5);
        // Never through the floor.
        for (const style of Object.keys(SHARD_STYLES) as ShardStyle[]) {
            for (const { path } of flights(style)) {
                for (let t = 0; t < SHARD_STYLES[style].life; t += 1 / 60) expect(shardPose(path, t).y).toBeGreaterThanOrEqual(-3 - 1e-6);
            }
        }
    });
});
