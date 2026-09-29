import { createMulberry32 } from '../../shared/rng';

/**
 * The ice sheet: the geometry of the cracks in a slick pane of ice over the screen, as SVG path
 * data. Seeded, so a run's sheet always cracks the same way, and drawn once - what moves is the
 * CSS on top of it (`IceSheetOverlay`): how much of each crack has run (`--scene-ice-cracks`,
 * via stroke-dashoffset), how opaque the pane is, how hard the cracks glow.
 *
 * A crack starts at an edge or a corner, runs inward in short jagged segments that bend toward
 * the centre and away again, and throws a fork or two. The centre of the screen (the board) is
 * left mostly clear: cracks stop before it, so the ice reads at the edges where it cannot hide a
 * card.
 */
export interface IceCrack {
    d: string;
    /** Total length in viewBox units, for the dash that draws it in. */
    length: number;
    /** Main cracks are thicker; forks thinner. */
    fork: boolean;
}

export const ICE_SHEET_VIEWBOX = { width: 1000, height: 600 } as const;

const hypot = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(bx - ax, by - ay);

export const buildIceCracks = (seed: number, count = 9): IceCrack[] => {
    const rng = createMulberry32(seed);
    const { width, height } = ICE_SHEET_VIEWBOX;
    const cx = width / 2;
    const cy = height / 2;
    const cracks: IceCrack[] = [];
    const walk = (x: number, y: number, heading: number, steps: number, step: number, fork: boolean): void => {
        const points: [number, number][] = [[x, y]];
        let length = 0;
        let h = heading;
        for (let index = 0; index < steps; index += 1) {
            // Bend toward the centre a little, then jitter, so the run reads as stress rather than a line.
            const toward = Math.atan2(cy - y, cx - x);
            let delta = toward - h;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            h += delta * 0.18 + (rng() - 0.5) * 0.9;
            const nx = x + Math.cos(h) * step * (0.6 + rng() * 0.8);
            const ny = y + Math.sin(h) * step * (0.6 + rng() * 0.8);
            // Stop short of the board.
            if (Math.abs(nx - cx) < width * 0.22 && Math.abs(ny - cy) < height * 0.28) break;
            length += hypot(x, y, nx, ny);
            x = nx;
            y = ny;
            points.push([x, y]);
            if (!fork && index > 1 && rng() < 0.22) walk(x, y, h + (rng() > 0.5 ? 1 : -1) * (0.6 + rng() * 0.7), 2 + Math.floor(rng() * 4), step * 0.6, true);
        }
        if (points.length < 2) return;
        cracks.push({ d: points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' '), length, fork });
    };
    for (let index = 0; index < count; index += 1) {
        // Start on the frame: which edge, and where along it.
        const edge = Math.floor(rng() * 4);
        const t = rng();
        const start: [number, number] =
            edge === 0 ? [t * width, -4] : edge === 1 ? [width + 4, t * height] : edge === 2 ? [t * width, height + 4] : [-4, t * height];
        const heading = Math.atan2(cy - start[1], cx - start[0]) + (rng() - 0.5) * 0.8;
        walk(start[0], start[1], heading, 5 + Math.floor(rng() * 6), 34 + rng() * 26, false);
    }
    return cracks;
};
