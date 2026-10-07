import { describe, expect, it } from 'vitest';
import { AMBIENT_SPRITES, SCENE_SPRITES, type AmbientCellName } from '../assets/ui/sprites';
import { ambientSprite, crossingDraws, dripDraws, driftDraws, flameDraws, flameEmberDraws, fogDraw, glintDraws, moteDraws, SCENE_PLATE_ASPECT, sceneKeyframes } from './sceneAmbient';
import { sceneOccurrence } from './sceneClock';
import { ringMotes } from './sceneSpriteClocks';

const flames = SCENE_SPRITES.gameplayFlames.sprites;

describe('the baked ambient atlas', () => {
    it('ships the atlas, the fog tile, and a cell for everything the scenes draw', () => {
        expect(AMBIENT_SPRITES.atlas).toContain('ambient-v1');
        expect(AMBIENT_SPRITES.fog).toContain('ambient-fog-v1');
        const needed: AmbientCellName[] = [
            'dotWhite', 'dotTeal', 'dotViolet', 'dotCyan', 'dotEmber', 'dotCinder', 'dotSpore', 'dotFirefly', 'dotGold',
            'bubble', 'glint', 'dust', 'drop', 'ripple', 'smoke', 'leaf', 'leafCurled', 'bat', 'moth', 'streak', 'spider', 'haloWarm', 'haloCool', 'shafts', 'coin'
        ];
        for (const name of needed) {
            const cell = AMBIENT_SPRITES.cells[name];
            expect(cell, name).toBeDefined();
            expect(cell.w).toBeGreaterThan(0);
            expect(cell.h).toBeGreaterThan(0);
            // Every frame of every cell is inside the atlas.
            expect(cell.x + cell.w * cell.frames).toBeLessThanOrEqual(AMBIENT_SPRITES.size[0]!);
            expect(cell.y + cell.h).toBeLessThanOrEqual(AMBIENT_SPRITES.size[1]!);
        }
        expect(AMBIENT_SPRITES.cells.bat.frames).toBeGreaterThanOrEqual(4);
        expect(AMBIENT_SPRITES.cells.moth.frames).toBe(2);
    });

    it('never lets two cells share pixels', () => {
        const cells = Object.entries(AMBIENT_SPRITES.cells);
        for (let a = 0; a < cells.length; a += 1) {
            for (let b = a + 1; b < cells.length; b += 1) {
                const [nameA, ca] = cells[a]!;
                const [nameB, cb] = cells[b]!;
                const apart = ca.x + ca.w * ca.frames <= cb.x || cb.x + cb.w * cb.frames <= ca.x || ca.y + ca.h <= cb.y || cb.y + cb.h <= ca.y;
                expect(apart, `${nameA} overlaps ${nameB}`).toBe(true);
            }
        }
    });
});

describe('ambientSprite', () => {
    it('centres a cell at a point of the plate, as tall as asked and as wide as its shape on screen', () => {
        const dot = ambientSprite({ id: 'd', cell: 'dotTeal', x: 0.5, y: 0.25, size: 0.1, alpha: 0.5 });
        expect(dot.rect!.y + dot.rect!.h / 2).toBeCloseTo(0.25, 9);
        expect(dot.rect!.x + dot.rect!.w / 2).toBeCloseTo(0.5, 9);
        expect(dot.rect!.h).toBe(0.1);
        // A square cell is square on screen: narrower as a fraction of the wider plate.
        expect(dot.rect!.w).toBeCloseTo(0.1 / SCENE_PLATE_ASPECT, 9);
        expect(dot.blend).toBe('lighter');
        const streak = ambientSprite({ id: 's', cell: 'streak', x: 0.5, y: 0.5, size: 0.02, alpha: 1 });
        expect(streak.rect!.w / streak.rect!.h).toBeCloseTo(4 / SCENE_PLATE_ASPECT, 6);
    });

    it('picks a flipbook frame out of its cell', () => {
        const bat = ambientSprite({ id: 'b', cell: 'bat', x: 0.5, y: 0.5, size: 0.04, alpha: 1, frame: 3 });
        const cell = AMBIENT_SPRITES.cells.bat;
        expect(bat.crop).toEqual({ x: cell.x, y: cell.y, w: cell.w * cell.frames, h: cell.h });
        expect(bat.frame).toEqual({ index: 3, count: cell.frames });
    });
});

describe('what drifts', () => {
    it('follows keyframes between their points and holds at the ends', () => {
        const points = [[0, 0], [0.25, 1], [1, 0.5]] as const;
        expect(sceneKeyframes(-1, points)).toBe(0);
        expect(sceneKeyframes(0.125, points)).toBeCloseTo(0.5, 9);
        expect(sceneKeyframes(0.25, points)).toBe(1);
        expect(sceneKeyframes(2, points)).toBe(0.5);
        expect(sceneKeyframes(0.5, [])).toBe(0);
    });

    it('lifts each mote from where it starts and fades it in and out, so none pops', () => {
        const motes = ringMotes();
        for (const mote of motes) {
            const start = moteDraws([mote], 'dotViolet', mote.delayMs + mote.durationMs * 3, 1, 'm')[0]!;
            const middle = moteDraws([mote], 'dotViolet', mote.delayMs + mote.durationMs * 3.5, 1, 'm')[0]!;
            const end = moteDraws([mote], 'dotViolet', mote.delayMs + mote.durationMs * 3.999, 1, 'm')[0]!;
            expect(start.alpha).toBeLessThan(0.02);
            expect(end.alpha).toBeLessThan(0.02);
            expect(middle.alpha).toBeGreaterThan(0.4);
            expect(middle.rect!.y).toBeLessThan(start.rect!.y);
            expect(end.rect!.y).toBeLessThan(middle.rect!.y);
        }
        // The scene's level scales the whole drift.
        expect(moteDraws(motes, 'dotViolet', 4321, 0, 'm').every((draw) => draw.alpha === 0)).toBe(true);
    });

    it('keeps drifting specks inside their box and never lets one appear at full strength', () => {
        const spec = { idPrefix: 'dust', cell: 'dust' as const, count: 12, x: 0.1, y: 0.2, w: 0.3, h: 0.4, fall: 0.02, slide: 0.01, size: 0.014, alpha: 0.6, seed: 5 };
        let largestJump = 0;
        let previous = driftDraws(spec, 0);
        for (let t = 33; t < 60_000; t += 33) {
            const now = driftDraws(spec, t);
            now.forEach((speck, index) => {
                const cx = speck.rect!.x + speck.rect!.w / 2;
                const cy = speck.rect!.y + speck.rect!.h / 2;
                expect(cx).toBeGreaterThan(0.1 - 0.03);
                expect(cx).toBeLessThan(0.4 + 0.03);
                expect(cy).toBeGreaterThanOrEqual(0.2);
                expect(cy).toBeLessThanOrEqual(0.6);
                expect(speck.alpha).toBeLessThanOrEqual(0.6);
                // Where a speck wraps round its box it is invisible, so the jump is never seen.
                const moved = Math.abs(cy - (previous[index]!.rect!.y + previous[index]!.rect!.h / 2));
                if (moved > 0.1) {
                    expect(speck.alpha).toBeLessThan(0.05);
                } else {
                    largestJump = Math.max(largestJump, Math.abs(speck.alpha - previous[index]!.alpha));
                }
            });
            previous = now;
        }
        expect(largestJump).toBeLessThan(0.08);
    });

    it('slides two banks of fog past each other behind its mask', () => {
        const mask = { kind: 'band' as const, top: 0.5, solidFrom: 0.7, solidTo: 0.9, bottom: 1 };
        const early = fogDraw({ id: 'mist', t: 0, alpha: 0.5, mask });
        const later = fogDraw({ id: 'mist', t: 20_000, alpha: 0.5, mask });
        expect(early.src).toBe(AMBIENT_SPRITES.fog);
        expect(early.banks).toHaveLength(2);
        expect(early.mask).toBe(mask);
        expect(later.banks[0]!.offsetX).toBeGreaterThan(early.banks[0]!.offsetX);
        expect(later.banks[1]!.offsetX).toBeLessThan(early.banks[1]!.offsetX);
        // Different sizes, so the two never line up into the same picture twice.
        expect(early.banks[0]!.tileW).not.toBe(early.banks[1]!.tileW);
    });
});

describe('flames', () => {
    it('steps each flame through its own flipbook, grows it from its foot, and freezes on the painted frame', () => {
        const burning = flameDraws(flames, { burnedMs: 5000, lift: 1.1, alpha: 1, still: false });
        expect(burning).toHaveLength(flames.length);
        expect(new Set(burning.map((flame) => flame.frame!.index)).size).toBeGreaterThan(2);
        for (const flame of burning) {
            expect(flame.scaleY).toBe(1.1);
            expect(flame.originY).toBe(1);
            expect(flame.frame!.index).toBeGreaterThanOrEqual(0);
            expect(flame.frame!.index).toBeLessThan(flame.frame!.count);
        }
        const still = flameDraws(flames, { burnedMs: 5000, lift: 1.4, alpha: 1, still: true });
        expect(still.every((flame) => flame.frame!.index === 0 && flame.scaleY === 1 && flame.rotate === 0)).toBe(true);
    });

    it('lets a scene bend single flames: a draught, a gutter', () => {
        const bent = flameDraws(flames, { burnedMs: 0, lift: 1, alpha: 0.8, still: false, each: (_sprite, index) => (index === 2 ? { alpha: 0.5, lift: 0.7, lean: 0.3 } : undefined) });
        expect(bent[2]).toMatchObject({ alpha: 0.4, scaleY: 0.7, rotate: 0.3 });
        expect(bent[1]).toMatchObject({ alpha: 0.8, scaleY: 1, rotate: 0 });
    });

    it('throws sparks up from above each flame, shrinking and dying as they rise', () => {
        const sparks = flameEmberDraws(flames, 1234, 1);
        expect(sparks.length).toBeGreaterThanOrEqual(flames.length * 2);
        for (const spark of sparks) {
            expect(spark.alpha).toBeGreaterThanOrEqual(0);
            expect(spark.alpha).toBeLessThanOrEqual(0.9);
            expect(spark.blend).toBe('lighter');
        }
        expect(flameEmberDraws(flames, 1234, 0).every((spark) => spark.alpha === 0)).toBe(true);
    });
});

describe('what happens now and then', () => {
    const occurring = (every: number, lasts: number, seed: number, from = 0): number => {
        for (let t = from; t < from + every * 3; t += 20) {
            if (sceneOccurrence(t, every, lasts, seed)) {
                return t;
            }
        }
        throw new Error('never');
    };

    it('sends a bat across, fading in and out at the ends of its path and flapping on the way', () => {
        const spec = { id: 'bat', cell: 'bat' as const, everyMs: 30_000, lastsMs: 4000, seed: 9, fromX: 0.2, toX: 0.8, yMin: 0.1, yMax: 0.3, size: 0.04, alpha: 0.8 };
        const start = occurring(spec.everyMs, spec.lastsMs, spec.seed);
        expect(crossingDraws({ ...spec, t: start - 40 })).toEqual([]);
        const first = crossingDraws({ ...spec, t: start })[0]!;
        const middle = crossingDraws({ ...spec, t: start + 2000 })[0]!;
        const last = crossingDraws({ ...spec, t: start + 3960 })[0]!;
        expect(first.alpha).toBeLessThan(0.05);
        expect(last.alpha).toBeLessThan(0.05);
        expect(middle.alpha).toBeGreaterThan(0.7);
        expect(Math.abs(last.rect!.x - first.rect!.x)).toBeGreaterThan(0.5);
        expect(middle.rect!.y).toBeGreaterThan(0.05);
        expect(middle.rect!.y).toBeLessThan(0.35);
        const frames = new Set<number>();
        for (let t = start; t < start + 1000; t += 40) {
            frames.add(crossingDraws({ ...spec, t })[0]!.frame!.index);
        }
        expect(frames.size).toBeGreaterThan(3);
        // It faces the way it flies.
        expect(Math.sign(middle.scaleX!)).toBe(Math.sign(last.rect!.x - first.rect!.x));
    });

    it('lets points glint for a moment each, not all together', () => {
        const points = Array.from({ length: 10 }, (_, index) => [0.1 + index * 0.08, 0.1] as const);
        let most = 0;
        let seen = 0;
        for (let t = 0; t < 60_000; t += 200) {
            const lit = glintDraws({ idPrefix: 'g', points, t, everyMs: 8000, lastsMs: 1400, size: 0.04, alpha: 0.9, seed: 3 });
            most = Math.max(most, lit.length);
            seen += lit.length;
            for (const glint of lit) {
                expect(glint.alpha).toBeLessThanOrEqual(0.9);
            }
        }
        expect(seen).toBeGreaterThan(20);
        expect(most).toBeLessThan(points.length);
    });

    it('drops water from the vault to the floor and spreads a ring where it lands', () => {
        const spots = [[0.4, 0.2, 0.7]] as const;
        const spec = { idPrefix: 'drip', everyMs: 9000, seed: 4, spots, alpha: 0.8 };
        const drops: number[] = [];
        const rings: number[] = [];
        for (let t = 0; t < 40_000; t += 20) {
            for (const draw of dripDraws({ ...spec, t })) {
                if (draw.kind !== 'image') {
                    continue;
                }
                const cy = draw.rect!.y + draw.rect!.h / 2;
                if (draw.id.includes('drop')) {
                    drops.push(cy);
                    expect(cy).toBeGreaterThanOrEqual(0.2 - 0.001);
                    expect(cy).toBeLessThanOrEqual(0.7);
                } else {
                    rings.push(draw.rect!.h);
                    expect(cy).toBeCloseTo(0.7, 6);
                    // Seen edge-on: wide and flat.
                    expect(draw.scaleX).toBeGreaterThan(2);
                }
            }
        }
        expect(drops.length).toBeGreaterThan(20);
        expect(rings.length).toBeGreaterThan(20);
        expect(Math.max(...rings)).toBeGreaterThan(Math.min(...rings) * 2);
    });
});
