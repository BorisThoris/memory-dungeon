import type { TileSuit } from '../../shared/contracts';
import { ambientSprite } from './sceneAmbient';
import { sceneHash } from './sceneClock';
import type { SceneDraw } from './scenePaint';
import type { GoldFloorBand } from './goldRain';

/**
 * What a breaking card spills into the room (2026-10-09, the owner: "both" - the card breaks into
 * pieces, and its material lands on the room's floor). The board is drawn in WebGL over the
 * room's painted canvas; when a card breaks there, its place on the screen and its element come
 * across this little bus to the room (`GameplayScene`), which turns the screen point into the
 * painting's and throws the card's material out from it to fall and land on the floor as the
 * painting has it: fire's embers arc down and cool to cinders where they land, water's drops fall
 * and splash, ice's shards tumble, bounce and lie glinting until they melt, growth's leaves
 * flutter down and lie, and a card with no element throws stone chips that bounce and lie.
 */
export interface RoomSpillEvent {
    key: string;
    suit: TileSuit | null;
    /** Where the card was, in CSS pixels on the screen. */
    screenX: number;
    screenY: number;
    /** Milliseconds after now that it breaks. */
    delayMs: number;
}

type Listener = (event: RoomSpillEvent) => void;
const listeners = new Set<Listener>();

export const emitRoomSpill = (event: RoomSpillEvent): void => {
    for (const listener of listeners) listener(event);
};

export const subscribeRoomSpill = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** A spill in the room: its material, where it starts on the painting, and seconds since it broke. */
export interface RoomSpill {
    key: string;
    suit: TileSuit | null;
    x: number;
    y: number;
    seconds: number;
}

/** How long a spill lasts in the room, from the break to the last piece gone. */
export const ROOM_SPILL_SECONDS = 5;
const GRAVITY = 2.6;
const PLATE_ASPECT = 1376 / 768;

const PIECES: Readonly<Record<TileSuit | 'none', number>> = { ember: 8, tide: 7, bone: 6, moss: 6, none: 6 };

interface Fall {
    x: number;
    y: number;
    landed: boolean;
    since: number;
    bounce: number;
}

/** A piece thrown from (x0, y0) with (vx, vy) under gravity onto the floor at `land`, bouncing `bounces` times. */
const fall = (x0: number, y0: number, vx: number, vy: number, land: number, seconds: number, restitution: number, bounces: number): Fall => {
    let x = x0;
    let y = y0;
    let dy = vy;
    let dx = vx;
    let left = seconds;
    for (let bounce = 0; bounce <= bounces; bounce += 1) {
        const a = 0.5 * GRAVITY;
        // y + dy s + a s^2 = land (y grows downward on the plate).
        const disc = dy * dy + 4 * a * (land - y);
        const hit = disc < 0 ? 0 : (-dy + Math.sqrt(disc)) / (2 * a);
        if (left <= hit) return { x: x + dx * left, y: y + dy * left + a * left * left, landed: bounce > 0, since: bounce > 0 ? seconds - left : -1, bounce };
        x += dx * hit;
        left -= hit;
        y = land;
        dy = -(dy + GRAVITY * hit) * restitution;
        dx *= 0.5;
        if (bounce === bounces || -dy < 0.05) break;
    }
    return { x, y: land, landed: true, since: seconds - left, bounce: bounces };
};

/** The spill's pieces at its moment, on a floor band. */
export const roomSpillDraws = (spill: RoomSpill, band: GoldFloorBand, water: boolean, lean: boolean): SceneDraw[] => {
    if (spill.seconds < 0 || spill.seconds > ROOM_SPILL_SECONDS) return [];
    const suit = spill.suit ?? 'none';
    const count = lean ? Math.ceil(PIECES[suit] / 2) : PIECES[suit];
    const seed = Math.abs([...spill.key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
    const out: SceneDraw[] = [];
    const s = spill.seconds;
    const fade = s > ROOM_SPILL_SECONDS - 1.2 ? (ROOM_SPILL_SECONDS - s) / 1.2 : 1;
    for (let index = 0; index < count; index += 1) {
        const h1 = sceneHash(index, seed);
        const h2 = sceneHash(index, seed + 1);
        const h3 = sceneHash(index, seed + 2);
        // Where it comes down: on the floor, below where it started, nearer or farther.
        const land = Math.max(spill.y + 0.04, band.far + (band.near - band.far) * (0.15 + 0.8 * h1));
        const scale = Math.max(0.3, (land - (band.horizon ?? 0.5)) / Math.max(0.05, band.near - (band.horizon ?? 0.5)));
        const vx = ((h2 - 0.5) * 0.5) / PLATE_ASPECT;
        const vy = -(0.25 + 0.45 * h3);
        const id = `spill-${spill.key}-${index}`;
        if (suit === 'moss') {
            // A leaf: it does not fall, it is let down by the air, swaying, and lies where it settles.
            const drift = 0.18 + 0.1 * h3;
            const t = Math.min(s, (land - spill.y) / drift);
            const y = spill.y + drift * t;
            const x = spill.x + vx * 0.6 * t + 0.03 * scale * Math.sin(t * 3.1 + index);
            const lying = s * drift >= land - spill.y;
            out.push(ambientSprite({ id, cell: h2 > 0.5 ? 'leaf' : 'leafCurled', x, y: y - 0.01 * scale, size: 0.03 * scale, alpha: 0.9 * fade, blend: 'source-over', rotate: lying ? h1 * 6 : t * 2.2 + index, scaleY: lying ? 0.55 : undefined }));
            continue;
        }
        if (suit === 'tide') {
            const f = fall(spill.x, spill.y, vx * 0.5, vy * 0.4, land, s, 0, 0);
            if (!f.landed && f.y < land - 1e-4) {
                out.push(ambientSprite({ id, cell: 'drop', x: f.x, y: f.y, size: 0.03 * scale, alpha: 0.85 * fade }));
            } else {
                const since = s - (f.since < 0 ? s : f.since);
                const q = Math.min(1, Math.max(0, since) / 0.6);
                out.push(ambientSprite({ id, cell: 'ripple', x: f.x, y: land, size: (0.01 + 0.05 * q) * scale, alpha: 0.75 * (1 - q) ** 1.5 * fade, scaleX: 2.6 }));
                if (!lean && q < 0.5) {
                    const jump = q / 0.5;
                    out.push(ambientSprite({ id: `${id}-spray`, cell: 'drop', x: f.x + 0.01 * scale * (h2 - 0.5), y: land - 0.03 * scale * 4 * jump * (1 - jump), size: 0.012 * scale, alpha: 0.7 * (1 - jump) * fade }));
                }
            }
            continue;
        }
        if (suit === 'ember') {
            // An ember arcs down, sticks where it lands and cools from flame to cinder.
            const f = fall(spill.x, spill.y, vx, vy, land, s, 0, 0);
            const cooled = f.landed || f.y >= land - 1e-4 ? Math.min(1, Math.max(0, s - (f.since < 0 ? s : f.since)) / 1.6) : 0;
            out.push(ambientSprite({ id, cell: cooled > 0.6 ? 'dotCinder' : 'dotEmber', x: f.x, y: f.y, size: (0.016 - 0.006 * cooled) * scale, alpha: (1 - 0.35 * cooled) * fade, blend: cooled > 0.6 ? 'source-over' : 'lighter' }));
            continue;
        }
        // Ice shards and stone chips: rigid, they bounce and lie. Ice glints as it lies and melts away.
        const ice = suit === 'bone';
        const f = fall(spill.x, spill.y, vx, vy, land, s, water && ice ? 0 : 0.35, water && ice ? 0 : 2);
        const length = (ice ? 0.022 : 0.012) * scale * (0.7 + 0.6 * h2);
        const angle = f.landed ? h1 * Math.PI : (s * (5 + 6 * h3) + index) * (h2 > 0.5 ? 1 : -1);
        const dx = (Math.cos(angle) * length) / 2 / PLATE_ASPECT;
        const dy = (Math.sin(angle) * length) / 2 * (f.landed ? 0.35 : 1);
        const melt = ice && f.landed ? Math.min(1, Math.max(0, s - f.since - 1.2) / 2) : 0;
        out.push({
            kind: 'line',
            id,
            alpha: (ice ? 0.85 : 0.95) * (1 - melt) * fade,
            blend: ice ? 'screen' : 'source-over',
            color: ice ? 'rgb(214, 238, 255)' : 'rgb(74, 66, 60)',
            width: (ice ? 0.006 : 0.008) * scale,
            points: [[f.x - dx, f.y - dy], [f.x + dx, f.y + dy]]
        });
        if (ice && f.landed && (Math.floor(s * 2 + index) % 5 === 0)) {
            out.push(ambientSprite({ id: `${id}-glint`, cell: 'glint', x: f.x, y: f.y - 0.004, size: 0.03 * scale, alpha: 0.7 * (1 - melt) * fade }));
        }
    }
    return out;
};
