import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * A card that leaves the board breaks (2026-10-09, the owner: "cards break into pieces ... both").
 * Its face is cut into irregular pieces (a seeded Voronoi of the card's rectangle), each piece a
 * rigid polygon carrying its part of the card - the face and illustration on one side, the back on
 * the other - that is thrown off the card, tumbles, falls under gravity, strikes the floor under
 * the board, bounces lower each time and skids to rest, then burns away its element's way.
 *
 * This file is the pure part: the cut and each piece's flight. `CardShards.tsx` draws them.
 */

export interface ShardPiece {
    /** The piece's outline around its own centre, card-plane units, counter-clockwise. */
    outline: ReadonlyArray<readonly [number, number]>;
    /** Where its centre sits on the card, card-plane units from the card's centre. */
    cx: number;
    cy: number;
}

const hash = (n: number, salt: number): number => {
    const v = Math.sin(n * 127.1 + salt * 311.7 + 74.7) * 43758.5453;
    return v - Math.floor(v);
};

/** Clip a convex polygon to the half-plane where (p - m) . n <= 0. */
const clip = (poly: Array<[number, number]>, mx: number, my: number, nx: number, ny: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let index = 0; index < poly.length; index += 1) {
        const a = poly[index]!;
        const b = poly[(index + 1) % poly.length]!;
        const da = (a[0] - mx) * nx + (a[1] - my) * ny;
        const db = (b[0] - mx) * nx + (b[1] - my) * ny;
        if (da <= 0) out.push(a);
        if (da * db < 0) {
            const t = da / (da - db);
            out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
    }
    return out;
};

/** The card cut into `count` pieces, the cut seeded: the same card always breaks the same way. */
export const cardShardPieces = (seed: number, count = 9): ShardPiece[] => {
    const w = CARD_PLANE_WIDTH;
    const h = CARD_PLANE_HEIGHT;
    // Sites on a jittered grid, so the pieces are irregular but none is a sliver.
    const columns = 3;
    const rows = Math.ceil(count / columns);
    const sites: Array<[number, number]> = [];
    for (let index = 0; index < count; index += 1) {
        const col = index % columns;
        const row = Math.floor(index / columns);
        sites.push([
            -w / 2 + ((col + 0.2 + 0.6 * hash(index, seed)) / columns) * w,
            -h / 2 + ((row + 0.2 + 0.6 * hash(index, seed + 1)) / rows) * h
        ]);
    }
    return sites.map(([sx, sy], index) => {
        let poly: Array<[number, number]> = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
        sites.forEach(([ox, oy], other) => {
            if (other === index) return;
            poly = clip(poly, (sx + ox) / 2, (sy + oy) / 2, ox - sx, oy - sy);
        });
        const cx = poly.reduce((sum, [x]) => sum + x, 0) / poly.length;
        const cy = poly.reduce((sum, [, y]) => sum + y, 0) / poly.length;
        return { outline: poly.map(([x, y]) => [x - cx, y - cy] as const), cx, cy };
    });
};

/** Gravity on the board, in board units a second squared (a card is 1.08 tall). */
export const SHARD_GRAVITY = 9;
const RESTITUTION = 0.32;
const FRICTION = 0.55;

export interface ShardFlight {
    /** Velocity at the break: across, up, toward the camera. */
    vx: number;
    vy: number;
    vz: number;
    /** Tumble: an axis and a rate (radians a second). */
    axis: readonly [number, number, number];
    spin: number;
}

/** How a piece is thrown when its card breaks: out from the card's centre, up a little, toward the camera. */
export const shardFlight = (piece: ShardPiece, seed: number, index: number, force: number): ShardFlight => {
    const out = Math.hypot(piece.cx, piece.cy) || 1;
    const speed = force * (0.9 + 0.8 * hash(index, seed + 7));
    const ax = hash(index, seed + 8) - 0.5;
    const ay = hash(index, seed + 9) - 0.5;
    const az = 0.3 + hash(index, seed + 10);
    const norm = Math.hypot(ax, ay, az) || 1;
    return {
        vx: (piece.cx / out) * speed * 0.9 + (hash(index, seed + 11) - 0.5) * 0.6,
        vy: (piece.cy / out) * speed * 0.6 + 1.6 * force * (0.4 + 0.6 * hash(index, seed + 12)),
        vz: 0.8 + 1.4 * hash(index, seed + 13),
        axis: [ax / norm, ay / norm, az / norm],
        spin: (hash(index, seed + 14) > 0.5 ? 1 : -1) * (5 + 9 * hash(index, seed + 15))
    };
};

export interface ShardPose {
    x: number;
    y: number;
    z: number;
    /** Radians turned about the flight's axis. */
    angle: number;
    /** It has struck the floor at least once. */
    landed: boolean;
    /** It lies still. */
    resting: boolean;
}

/**
 * Where a piece is `t` seconds after its card broke, from `(x0, y0, z0)`, with a floor at `floorY`:
 * a ballistic arc, then bounces each lower by the restitution, each costing it speed across, until
 * a bounce is too small to leave the floor and it skids to rest. Worked out in closed form, bounce
 * by bounce, so any moment is a few steps of arithmetic.
 */
export const shardPose = (flight: ShardFlight, t: number, x0: number, y0: number, z0: number, floorY: number): ShardPose => {
    let x = x0;
    let y = y0;
    let z = z0;
    let vx = flight.vx;
    let vy = flight.vy;
    let vz = flight.vz;
    let spin = flight.spin;
    let angle = 0;
    let left = t;
    let landed = false;
    for (let bounce = 0; bounce < 6; bounce += 1) {
        // Time to reach the floor from y with vy: y + vy s - g s^2 / 2 = floorY.
        const a = 0.5 * SHARD_GRAVITY;
        const disc = vy * vy + 4 * a * (y - floorY);
        const hit = disc < 0 ? 0 : (vy + Math.sqrt(disc)) / (2 * a);
        if (left <= hit) {
            return { x: x + vx * left, y: y + vy * left - a * left * left, z: z + vz * left, angle: angle + spin * left, landed, resting: false };
        }
        x += vx * hit;
        z += vz * hit;
        angle += spin * hit;
        left -= hit;
        y = floorY;
        landed = true;
        const impact = vy - SHARD_GRAVITY * hit;
        vy = -impact * RESTITUTION;
        vx *= FRICTION;
        vz *= FRICTION;
        spin *= 0.5;
        if (vy < 0.35) break;
    }
    // Skidding to rest: the speed across bleeds away.
    const skid = 0.25;
    const slid = skid * (1 - Math.exp(-left / skid));
    return { x: x + vx * slid, y: floorY, z: z + vz * slid, angle: angle + spin * slid, landed: true, resting: left > skid };
};
