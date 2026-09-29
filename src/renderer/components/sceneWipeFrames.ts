import { createMulberry32, hashStringToSeed } from '../../shared/rng';

/**
 * The wipe between rooms, as drawn frames.
 *
 * Going into the shop and coming out of it is a cut, and a cut wants a transition; the arcade
 * cabinets do a curtain, the phones an ink splash. This is a flipbook of a few frames - ink blots
 * growing across the screen from its edges until they cover it, then the same frames backwards
 * - held on `steps()` so it reads as drawn rather than tweened. Each frame is a set of seeded
 * blob paths in the plate's space; the frames are built once per key and the animation is CSS.
 */
export interface WipeBlob {
    /** Path data for one blob, closed. */
    d: string;
}

export const WIPE_FRAMES = 6;
export const WIPE_VIEWBOX = { width: 1000, height: 600 } as const;

const blob = (rng: () => number, cx: number, cy: number, radius: number): string => {
    const points = 16;
    const parts: string[] = [];
    for (let index = 0; index < points; index += 1) {
        const angle = (index / points) * Math.PI * 2;
        const r = radius * (0.72 + rng() * 0.5);
        parts.push(`${index === 0 ? 'M' : 'L'}${(cx + Math.cos(angle) * r).toFixed(1)} ${(cy + Math.sin(angle) * r).toFixed(1)}`);
    }
    return `${parts.join(' ')} Z`;
};

/** The blobs of frame `frame` (0 = a few small ones at the edges, WIPE_FRAMES - 1 = the screen covered). */
export const buildWipeFrame = (seed: string, frame: number): WipeBlob[] => {
    const rng = createMulberry32(hashStringToSeed(`scene-wipe:${seed}`));
    const { width, height } = WIPE_VIEWBOX;
    const t = Math.max(0, Math.min(1, frame / (WIPE_FRAMES - 1)));
    const seeds: { x: number; y: number; grow: number }[] = [];
    // Ten sources on the frame's edges, each with its own rate, decided once for the whole book.
    for (let index = 0; index < 7; index += 1) {
        const edge = index % 4;
        const along = rng();
        seeds.push({
            x: edge === 0 ? along * width : edge === 1 ? width : edge === 2 ? along * width : 0,
            y: edge === 0 ? 0 : edge === 1 ? along * height : edge === 2 ? height : along * height,
            grow: 0.7 + rng() * 0.6
        });
    }
    const blobs: WipeBlob[] = [];
    for (const source of seeds) {
        // Slow at first, fast at the end: the ink creeps, then floods.
        const radius = Math.pow(t, 1.6) * source.grow * Math.max(width, height) * 0.62;
        if (radius < 4) continue;
        blobs.push({ d: blob(rng, source.x, source.y, radius) });
    }
    // The last frame is a full cover whatever the blobs did.
    if (frame >= WIPE_FRAMES - 1) blobs.push({ d: `M-10 -10 L${width + 10} -10 L${width + 10} ${height + 10} L-10 ${height + 10} Z` });
    return blobs;
};

export const buildWipeBook = (seed: string): WipeBlob[][] => Array.from({ length: WIPE_FRAMES }, (_, frame) => buildWipeFrame(seed, frame));
