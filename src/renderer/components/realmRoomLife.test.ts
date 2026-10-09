import { describe, expect, it } from 'vitest';
import type { SceneDraw, SceneImageDraw, SceneLineDraw } from './scenePaint';
import { lightningPath, rainDraws, REALM_FLOORS, realmRoomLifeDraws, stormStrikeChannels, stormStrikeDraws } from './realmRoomLife';

const over = (from: number, to: number, step: number, draw: (t: number) => SceneDraw[]): SceneDraw[][] => {
    const frames: SceneDraw[][] = [];
    for (let t = from; t < to; t += step) frames.push(draw(t));
    return frames;
};

describe('realm room life', () => {
    it('brings lightning down out of the sky onto the rods and the horizon, branching, and lights the sky and the ground', () => {
        const frames = over(0, 60_000, 40, (t) => stormStrikeDraws(t, 0, 1));
        const struck = frames.filter((draws) => draws.some((draw) => draw.id === 'storm-bolt-0'));
        expect(struck.length).toBeGreaterThan(20);
        for (const draws of struck) {
            const bolt = draws.find((draw): draw is SceneLineDraw => draw.id === 'storm-bolt-0')!;
            // From above the top of the plate down to the platform's horizon at most.
            expect(bolt.points[0]![1]).toBeLessThan(0);
            expect(bolt.points[bolt.points.length - 1]![1]).toBeGreaterThan(0.1);
            expect(bolt.points[bolt.points.length - 1]![1]).toBeLessThan(0.5);
            expect(bolt.points.length).toBeGreaterThan(30);
            expect(draws.some((draw) => draw.id === 'storm-bolt-0-branch-0')).toBe(true);
            expect(draws.some((draw) => draw.id === 'storm-bolt-0-sky')).toBe(true);
            expect(draws.some((draw) => draw.id === 'storm-bolt-0-ground')).toBe(true);
        }
        // Different strikes are different bolts.
        const ends = new Set(struck.map((draws) => (draws.find((draw): draw is SceneLineDraw => draw.id === 'storm-bolt-0')!.points.at(-1)![0]).toFixed(3)));
        expect(ends.size).toBeGreaterThan(3);
    });

    it('strikes more often and on more channels the deeper the chain, without end', () => {
        const strikes = (depth: number) => over(0, 60_000, 40, (t) => stormStrikeDraws(t, depth, 1)).filter((draws) => draws.some((draw) => /^storm-bolt-\d+$/.test(draw.id))).length;
        expect(strikes(4)).toBeGreaterThan(strikes(0));
        expect(stormStrikeChannels(0)).toBe(1);
        expect(stormStrikeChannels(8)).toBeGreaterThan(stormStrikeChannels(2));
        expect(stormStrikeChannels(1000)).toBe(3);
    });

    it('draws a jagged bolt from its start to its end, the same bolt for the same seed', () => {
        const path = lightningPath(7, [0.5, -0.02], [0.4, 0.24], 5);
        expect(path[0]).toEqual([0.5, -0.02]);
        expect(path.at(-1)).toEqual([0.4, 0.24]);
        expect(path).toHaveLength(33);
        expect(lightningPath(7, [0.5, -0.02], [0.4, 0.24], 5)).toEqual(path);
        expect(lightningPath(8, [0.5, -0.02], [0.4, 0.24], 5)).not.toEqual(path);
    });

    it('rains straight down with the wind onto the floor, where it splashes, and lays leaves on their room\'s floor', () => {
        const floor = REALM_FLOORS.storm.band;
        const frames = over(0, 8000, 50, (t) => rainDraws({ idPrefix: 'rain', count: 40, t, floor, alpha: 1, seed: 1, pace: 1, crowns: true }));
        const drops = frames.flat().filter((draw): draw is SceneLineDraw => draw.kind === 'line' && /^rain-\d+$/.test(draw.id) && draw.alpha > 0);
        expect(drops.length).toBeGreaterThan(500);
        for (const drop of drops) {
            const [[x0, y0], [x1, y1]] = drop.points as [[number, number], [number, number]];
            // Falling: the head is below the tail, and it leans no more than the wind, a few degrees off vertical.
            expect(y1).toBeGreaterThan(y0);
            const leanDeg = (Math.atan2((x1 - x0) * (1376 / 768), y1 - y0) * 180) / Math.PI;
            expect(Math.abs(leanDeg)).toBeLessThan(6);
            // And never through the floor.
            expect(y1).toBeLessThanOrEqual(floor.near + 1e-6);
        }
        // Each drop strikes the floor where the painting's floor is, and splashes there.
        const splashes = frames.flat().filter((draw): draw is SceneImageDraw => draw.id.startsWith('splash-rain-'));
        expect(splashes.length).toBeGreaterThan(100);
        for (const splash of splashes) {
            const y = splash.rect!.y + splash.rect!.h / 2;
            expect(y).toBeGreaterThanOrEqual(floor.far - 1e-6);
            expect(y).toBeLessThanOrEqual(floor.near + 1e-6);
        }
        // The crown's droplets go up from the strike and never below the floor.
        const crowns = frames.flat().filter((draw): draw is SceneLineDraw => draw.id.startsWith('crown-rain-'));
        expect(crowns.length).toBeGreaterThan(100);
        for (const bead of crowns) expect(bead.points[1]![1]).toBeLessThanOrEqual(floor.near + 1e-6);
        // Every drop is one draw always, falling or spent: a count is a count.
        for (const draws of frames) expect(draws.filter((draw) => /^rain-\d+$/.test(draw.id))).toHaveLength(40);
        // Leaves lie on the grove's floor a while after they land.
        const grove = over(0, 20_000, 100, (t) => realmRoomLifeDraws({ realm: 'grove', t, depth: 0, lean: false, alpha: 1 })).flat();
        const lying = grove.filter((draw): draw is SceneImageDraw => draw.kind === 'image' && /^grove-leaf-\d+$/.test(draw.id) && draw.scaleY !== undefined && draw.alpha > 0.05);
        expect(lying.length).toBeGreaterThan(10);
        for (const leaf of lying) {
            const bottom = leaf.rect!.y + leaf.rect!.h / 2 + (leaf.rect!.h * leaf.scaleY!) / 2;
            expect(bottom).toBeGreaterThanOrEqual(REALM_FLOORS.grove.band.far - 1e-6);
        }
    });

    it('gives every room its own life, and nothing while its room is not showing', () => {
        for (const realm of ['frost', 'ember', 'tide', 'storm', 'grove'] as const) {
            expect(realmRoomLifeDraws({ realm, t: 5000, depth: 1, lean: false, alpha: 1 }).length).toBeGreaterThan(20);
            expect(realmRoomLifeDraws({ realm, t: 5000, depth: 1, lean: false, alpha: 0 })).toHaveLength(0);
        }
    });
});
