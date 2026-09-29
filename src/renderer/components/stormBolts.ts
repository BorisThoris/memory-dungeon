import { createMulberry32 } from '../../shared/rng';

/**
 * Lightning through the arches, for a storm run (`sceneMood.ts`): the geometry of a few bolts
 * that come down from the vault, as SVG path data in the plate's own space, so they land on the
 * painting's arches whatever the viewport. Seeded per run and built once; the flash that shows
 * them is CSS on the storm beat.
 */
export interface StormBolt {
    d: string;
    length: number;
}

/** The plate's aspect, so a bolt at 30% is on the same stone at every viewport. */
export const STORM_VIEWBOX = { width: 1376, height: 768 } as const;

export const buildStormBolts = (seed: number, count = 3): StormBolt[] => {
    const rng = createMulberry32(seed);
    const { width, height } = STORM_VIEWBOX;
    // Where the vault's openings are in the dungeon plate: the arches left and right of centre and
    // the corridor at the back. Bolts start in one and run down toward the floor's far edge.
    const mouths = [0.34, 0.5, 0.66, 0.24, 0.76];
    const bolts: StormBolt[] = [];
    for (let index = 0; index < count; index += 1) {
        let x = width * mouths[Math.floor(rng() * mouths.length)]! + (rng() - 0.5) * width * 0.04;
        let y = height * (0.02 + rng() * 0.08);
        const targetX = x + (rng() - 0.5) * width * 0.16;
        const targetY = height * (0.42 + rng() * 0.16);
        const steps = 7 + Math.floor(rng() * 5);
        const points: [number, number][] = [[x, y]];
        let length = 0;
        for (let step = 1; step <= steps; step += 1) {
            const t = step / steps;
            const nx = x + (targetX - x) * (1 / (steps - step + 1)) + (rng() - 0.5) * width * 0.05 * (1 - t * 0.5);
            const ny = y + (targetY - y) * (1 / (steps - step + 1)) + rng() * height * 0.01;
            length += Math.hypot(nx - x, ny - y);
            x = nx;
            y = ny;
            points.push([x, y]);
        }
        bolts.push({ d: points.map(([px, py], pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' '), length });
    }
    return bolts;
};
