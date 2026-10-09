import type { TileSuit } from '../../shared/contracts';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * A card that leaves the board breaks (2026-10-09), each element its own way, the way each burned
 * away its own way before (`cardDissolveMaterial.ts`), now with the pieces moving as matter does:
 *
 * - **fire**: the pieces lift on their own heat, char from their edges with an ember rim, drift
 *   down slowly and crumble to ash before they have settled;
 * - **water**: the pieces drop and do not bounce, losing their shape into translucent water that
 *   drains away from the bottom;
 * - **ice**: glassy shards thrown out hard, frosted, bright at the break, that bounce lively and
 *   skid before they melt;
 * - **growth**: the pieces are let down by the air like leaves, swaying, the green creeping in from
 *   their edges until they crumble;
 * - **no element**: stone chips that fall heavily and crumble to dust.
 *
 * Never in the way: few pieces, thrown back, behind the board's plane, so the cards still on the
 * board hide them rather than the other way about, and gone in a couple of seconds.
 *
 * This file is the pure part: the cut, each style's numbers and each piece's flight, worked out
 * once at the break (a small step at 240 Hz, kept at 60 Hz). `cardShardSystem.ts` draws them.
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
    const columns = count <= 4 ? 2 : 3;
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

export type ShardStyle = 'fire' | 'water' | 'ice' | 'growth' | 'stone';

export const shardStyleOf = (suit: TileSuit | undefined | null): ShardStyle =>
    suit === 'ember' ? 'fire' : suit === 'tide' ? 'water' : suit === 'bone' ? 'ice' : suit === 'moss' ? 'growth' : 'stone';

export interface ShardStyleSpec {
    /** Pieces at full quality (a phone takes fewer). */
    count: number;
    /** How hard the pieces are thrown, board units a second. */
    force: number;
    /** An upward push at the break (fire's heat). */
    lift: number;
    /** Gravity, board units a second squared. */
    gravity: number;
    /** Air: how fast speed bleeds away, per second (a leaf is all air). */
    drag: number;
    /** Speed kept off the floor, and across it. */
    restitution: number;
    friction: number;
    /** Tumble, radians a second. */
    spin: number;
    /** A leaf's sway across as it falls: amplitude (board units) and rate (radians a second). */
    flutter: number;
    flutterRate: number;
    /** Seconds the pieces last, and when they start going (charring, draining, melting, crumbling). */
    life: number;
    goFrom: number;
    /** The shader's look (`cardShardSystem.ts`). */
    look: number;
}

export const SHARD_STYLES: Readonly<Record<ShardStyle, ShardStyleSpec>> = {
    fire: { count: 6, force: 0.9, lift: 1.8, gravity: 5, drag: 1.4, restitution: 0.15, friction: 0.4, spin: 4, flutter: 0.06, flutterRate: 3, life: 2.0, goFrom: 0.5, look: 1 },
    water: { count: 6, force: 0.6, lift: 0, gravity: 10, drag: 0.6, restitution: 0, friction: 0.2, spin: 2, flutter: 0, flutterRate: 0, life: 1.5, goFrom: 0.35, look: 2 },
    ice: { count: 8, force: 1.2, lift: 0.5, gravity: 10, drag: 0.2, restitution: 0.42, friction: 0.7, spin: 11, flutter: 0, flutterRate: 0, life: 2.2, goFrom: 1.1, look: 3 },
    growth: { count: 6, force: 0.7, lift: 0.9, gravity: 3.2, drag: 2.6, restitution: 0.05, friction: 0.3, spin: 3, flutter: 0.22, flutterRate: 4.2, life: 2.8, goFrom: 1.7, look: 4 },
    stone: { count: 6, force: 1.1, lift: 0.5, gravity: 12, drag: 0.25, restitution: 0.25, friction: 0.5, spin: 7, flutter: 0, flutterRate: 0, life: 2.0, goFrom: 1.2, look: 0 }
};

export interface ShardFlight {
    /** Velocity at the break: across, up, and back into the board (negative z: behind the cards). */
    vx: number;
    vy: number;
    vz: number;
    /** Tumble: an axis and a rate (radians a second). */
    axis: readonly [number, number, number];
    spin: number;
    /** Where in its sway a fluttering piece starts. */
    swayPhase: number;
}

/** How a piece is thrown when its card breaks: out from the card's centre, its style's way, and back behind the board. */
export const shardFlight = (piece: ShardPiece, seed: number, index: number, style: ShardStyleSpec, energy = 0): ShardFlight => {
    const out = Math.hypot(piece.cx, piece.cy) || 1;
    const force = style.force * (1 + 0.5 * energy) * (0.75 + 0.5 * hash(index, seed + 7));
    const ax = hash(index, seed + 8) - 0.5;
    const ay = hash(index, seed + 9) - 0.5;
    const az = 0.3 + hash(index, seed + 10);
    const norm = Math.hypot(ax, ay, az) || 1;
    return {
        vx: (piece.cx / out) * force + (hash(index, seed + 11) - 0.5) * 0.3,
        vy: (piece.cy / out) * force * 0.5 + style.lift * (0.6 + 0.4 * hash(index, seed + 12)),
        vz: -(0.5 + 0.8 * hash(index, seed + 13)),
        axis: [ax / norm, ay / norm, az / norm],
        spin: (hash(index, seed + 14) > 0.5 ? 1 : -1) * style.spin * (0.6 + 0.8 * hash(index, seed + 15)),
        swayPhase: hash(index, seed + 16) * Math.PI * 2
    };
};

export interface ShardPath {
    /** Samples at 60 Hz: x, y, z, angle, landed (0 or 1). */
    samples: Float32Array;
    /** Seconds to the first strike on the floor (Infinity if it never gets there), and to lying still. */
    landS: number;
    restS: number;
}

const SIM_HZ = 240;
const SAMPLE_HZ = 60;

/** A piece's whole flight from (x0, y0, z0) with a floor at `floorY`, worked out once. */
export const shardPath = (flight: ShardFlight, style: ShardStyleSpec, x0: number, y0: number, z0: number, floorY: number): ShardPath => {
    let x = x0;
    let y = y0;
    let z = z0;
    let vx = flight.vx;
    let vy = flight.vy;
    let vz = flight.vz;
    let spin = flight.spin;
    let angle = 0;
    let landS = Number.POSITIVE_INFINITY;
    let restS = Number.POSITIVE_INFINITY;
    let landed = 0;
    const dt = 1 / SIM_HZ;
    const steps = Math.ceil(style.life * SIM_HZ);
    const every = SIM_HZ / SAMPLE_HZ;
    const samples: number[] = [];
    for (let step = 0; step <= steps; step += 1) {
        const time = step * dt;
        if (step % every === 0) samples.push(x, y, z, angle, landed);
        if (restS < Number.POSITIVE_INFINITY) continue;
        const air = Math.exp(-style.drag * dt);
        vx *= air;
        vz *= air;
        vy = vy * air - style.gravity * dt;
        // A leaf sways across as it comes down, the more so the slower it falls.
        const sway = style.flutter > 0 && landed === 0 ? style.flutter * style.flutterRate * Math.cos(time * style.flutterRate + flight.swayPhase) : 0;
        x += (vx + sway) * dt;
        y += vy * dt;
        z += vz * dt;
        angle += spin * dt;
        if (y <= floorY && vy < 0) {
            y = floorY;
            if (landS === Number.POSITIVE_INFINITY) landS = time;
            landed = 1;
            vy = -vy * style.restitution;
            vx *= style.friction;
            vz *= style.friction;
            spin *= 0.45;
            if (vy < 0.3) {
                vy = 0;
                // Skidding to rest on the floor.
                restS = time + 0.25;
                const slide = 0.25;
                x += vx * slide;
                z += vz * slide;
                angle += spin * slide;
            }
        }
    }
    return { samples: Float32Array.from(samples), landS, restS };
};

export interface ShardPose {
    x: number;
    y: number;
    z: number;
    angle: number;
    landed: boolean;
}

/** Where a piece is `t` seconds after its card broke. */
export const shardPose = (path: ShardPath, t: number): ShardPose => {
    const count = path.samples.length / 5;
    const at = Math.max(0, t) * SAMPLE_HZ;
    const i = Math.min(count - 1, Math.floor(at));
    const j = Math.min(count - 1, i + 1);
    const f = Math.min(1, at - i);
    const s = path.samples;
    const lerp = (k: number): number => s[i * 5 + k]! + (s[j * 5 + k]! - s[i * 5 + k]!) * f;
    return { x: lerp(0), y: lerp(1), z: lerp(2), angle: lerp(3), landed: s[i * 5 + 4]! > 0.5 };
};
