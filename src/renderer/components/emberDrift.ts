import { createMulberry32 } from '../../shared/rng';

/**
 * Embers and ash drifting up through the room on an ember run (`sceneMood.ts`, `--scene-ash`):
 * the ember temper's weather, the way snow is frost's and rain is the storm's. Seeded per run and
 * built once; CSS moves them. Each mote rises from the floor band, sways, and dies out somewhere
 * under the vault; a few are hot sparks, the rest grey ash.
 */
export interface EmberMote {
    /** Start, in the plate's space. */
    x: number;
    y: number;
    /** Radius. */
    r: number;
    /** How far it rises and sways, in the plate's space. */
    rise: number;
    sway: number;
    /** Seconds per rise, and the phase it starts at (0..1 of that). */
    duration: number;
    phase: number;
    /** A hot spark (orange, glowing) or a cinder (red, unlit). */
    spark: boolean;
}

/** The plate's aspect, the same space the storm's bolts use. */
export const EMBER_VIEWBOX = { width: 1376, height: 768 } as const;

/** Motes at the calmest; the heat and the surge add more (`emberMoteCount`). */
export const EMBER_MOTES_BASE = 44;
export const EMBER_MOTES_MAX = 90;

export const emberMoteCount = (surge: number): number =>
    Math.min(EMBER_MOTES_MAX, EMBER_MOTES_BASE + Math.round(Math.max(0, surge) * 8));

export const buildEmberDrift = (seed: number, count = EMBER_MOTES_BASE): EmberMote[] => {
    const rng = createMulberry32((Math.floor(seed) ^ 0x5eed_a5) >>> 0);
    const { width, height } = EMBER_VIEWBOX;
    const motes: EmberMote[] = [];
    for (let index = 0; index < count; index += 1) {
        const spark = rng() < 0.6;
        // The floor band, weighted to the torches at the sides where the fire is.
        const side = rng();
        const x = side < 0.3 ? width * (0.04 + rng() * 0.22) : side > 0.7 ? width * (0.74 + rng() * 0.22) : width * (0.2 + rng() * 0.6);
        motes.push({
            x,
            y: height * (0.72 + rng() * 0.3),
            r: spark ? 5 + rng() * 6 : 4 + rng() * 5,
            rise: height * (0.35 + rng() * 0.55),
            sway: width * (0.01 + rng() * 0.035) * (rng() < 0.5 ? -1 : 1),
            duration: 7 + rng() * 9,
            phase: rng(),
            spark
        });
    }
    return motes;
};
