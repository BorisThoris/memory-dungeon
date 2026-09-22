import type { SceneSpriteDef } from '../assets/ui/sprites';
import type { SceneMote } from './SceneMotes';

/**
 * Per-sprite timing, deterministic from the sprite's index so a render is the same every time and
 * the tests can read it: no two flames share a period (a golden-ratio spread of ±10 %) and none
 * starts on the same frame (a negative delay into its own loop).
 */
export interface SceneSpriteClock {
    durationMs: number;
    delayMs: number;
}

const fract = (value: number): number => value - Math.floor(value);

export const sceneSpriteClocks = (sprite: Pick<SceneSpriteDef, 'frames' | 'fps'>, index: number): SceneSpriteClock => {
    const loopMs = (1000 / Math.max(1, sprite.fps)) * Math.max(1, sprite.frames);
    const durationMs = Math.round(loopMs * (0.9 + 0.2 * fract(index * 0.618034)));
    const delayMs = -Math.round(durationMs * fract(index * 0.381966 + 0.25));
    return { durationMs, delayMs };
};

export interface SceneEmber {
    id: string;
    /** Start column inside the ember box, percent. */
    x: number;
    /** Sideways drift over the rise, CSS pixels (signed). */
    driftPx: number;
    durationMs: number;
    delayMs: number;
    size: number;
}

/** A few sparks per flame, more from a big torch than a far one; each on its own loop. */
export const sceneSpriteEmbers = (sprite: Pick<SceneSpriteDef, 'h'>, index: number): SceneEmber[] => {
    const count = sprite.h > 0.13 ? 4 : sprite.h > 0.09 ? 3 : 2;
    return Array.from({ length: count }, (_, i) => {
        const seed = index * 7 + i;
        const durationMs = Math.round(2200 + 1400 * fract(seed * 0.618034));
        return {
            id: `${index}-${i}`,
            x: Math.round(20 + 60 * fract(seed * 0.381966 + 0.1)),
            driftPx: Math.round(-12 + 24 * fract(seed * 0.754878 + 0.3)),
            durationMs,
            delayMs: -Math.round(durationMs * fract(seed * 0.56984)),
            size: sprite.h > 0.13 ? 3 : 2
        };
    });
};

export type RingMote = SceneMote;

export const RING_MOTE_COUNT = 10;

/**
 * The motes the rune ring throws up as the chain climbs: spread round the ring's ellipse on the
 * floor (`scene.json`: centre 50 %, 72.9 %; radii 21.8 %, 10.4 % of the plate), each on its own
 * slow loop, deterministic so a render is the same every time. How strongly they show is the
 * scene's `--scene-motes-opacity`, not theirs.
 */
export const ringMotes = (): RingMote[] =>
    Array.from({ length: RING_MOTE_COUNT }, (_, i) => {
        const angle = 2 * Math.PI * fract(i * 0.618034 + 0.05);
        const radial = 0.55 + 0.45 * fract(i * 0.381966 + 0.3);
        const durationMs = Math.round(5200 + 3600 * fract(i * 0.754878));
        return {
            id: `ring-${i}`,
            x: Math.round((0.5 + 0.218 * radial * Math.cos(angle)) * 1000) / 10,
            y: Math.round((0.729 + 0.104 * radial * Math.sin(angle)) * 1000) / 10,
            durationMs,
            delayMs: -Math.round(durationMs * fract(i * 0.56984 + 0.2)),
            driftPx: Math.round(-10 + 20 * fract(i * 0.271828 + 0.4)),
            risePx: Math.round(70 + 60 * fract(i * 0.141421 + 0.6)),
            size: 3 + (i % 4 === 0 ? 1 : 0)
        };
    });

export const CATHEDRAL_MOTE_COUNT = 10;

/**
 * The cathedral's spirit-light as motes: ten points climbing the two streams painted up the far
 * arch (left stream near 37 % of the plate, right near 69 %), each on its own slow loop,
 * deterministic so a render is the same every time.
 */
export const cathedralMotes = (): SceneMote[] =>
    Array.from({ length: CATHEDRAL_MOTE_COUNT }, (_, i) => {
        const stream = i % 2 === 0 ? 37 : 69;
        const durationMs = Math.round(8000 + 6000 * fract(i * 0.618034 + 0.2));
        return {
            id: `wisp-${i}`,
            x: Math.round((stream - 4 + 8 * fract(i * 0.381966 + 0.1)) * 10) / 10,
            y: Math.round((28 + 52 * fract(i * 0.754878 + 0.3)) * 10) / 10,
            durationMs,
            delayMs: -Math.round(durationMs * fract(i * 0.56984 + 0.4)),
            driftPx: Math.round(-14 + 28 * fract(i * 0.271828 + 0.6)),
            risePx: Math.round(60 + 70 * fract(i * 0.141421 + 0.7)),
            size: 2 + (i % 3 === 0 ? 1 : 0)
        };
    });
