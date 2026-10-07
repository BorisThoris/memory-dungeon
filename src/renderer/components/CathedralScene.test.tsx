import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { CathedralScene } from './CathedralScene';
import {
    CATHEDRAL_DRAUGHT_EVERY_MS,
    CATHEDRAL_DRAUGHT_LASTS_MS,
    CATHEDRAL_GUTTER_EVERY_MS,
    CATHEDRAL_GUTTER_LASTS_MS,
    composeCathedralScene,
    type CathedralFrameInput
} from './cathedralSceneFrame';
import { fixedSceneClock, sceneOccurrence } from './sceneClock';
import { findSceneDraw, sceneDrawIds, type SceneImageDraw } from './scenePaint';
import { CATHEDRAL_MOTE_COUNT, cathedralMotes, sceneSpriteClocks, sceneSpriteEmbers } from './sceneSpriteClocks';

const candles = SCENE_SPRITES.cathedralCandles;
const menu: CathedralFrameInput = { mood: 'menu', heat: null, tier: 'full', base: 0.34, light: 0.6 };
const frame = (over: Partial<CathedralFrameInput> = {}, t = 1000) => composeCathedralScene({ ...menu, ...over }, fixedSceneClock(t, { still: over.tier === 'still' }));
const flamesOf = (draws: ReturnType<typeof frame>) => draws.filter((draw): draw is SceneImageDraw => draw.kind === 'image' && draw.id.startsWith('candle-'));

/** The first moment at or after `from` when the event is this far through. */
const momentOf = (every: number, lasts: number, seed: number, progress: number, from = 0): number => {
    for (let t = from; t < from + every * 3; t += 20) {
        const occurrence = sceneOccurrence(t, every, lasts, seed);
        if (occurrence && occurrence.progress >= progress) {
            return t;
        }
    }
    throw new Error('the event never came');
};

describe('CathedralScene', () => {
    it('is decoration: one canvas in a plate the shape of the painting, the nave as data on the root', () => {
        render(<CathedralScene quality="high" reduceMotion={false} />);
        const scene = screen.getByTestId('cathedral-scene');
        expect(scene).toHaveAttribute('aria-hidden', 'true');
        expect(scene).toHaveAttribute('data-alive', 'true');
        expect(scene).toHaveAttribute('data-mood', 'menu');
        expect(scene.style.getPropertyValue('--scene-plate-aspect')).toBe(`${candles.plate[0]} / ${candles.plate[1]}`);
        const plate = screen.getByTestId('cathedral-scene-plate');
        // The whole scene is one surface: nothing else in the plate for a compositor to blend.
        expect(plate.children).toHaveLength(1);
        const canvas = screen.getByTestId('cathedral-scene-canvas') as HTMLCanvasElement;
        expect(canvas.tagName).toBe('CANVAS');
        // The canvas is the size the art was painted at, whatever the screen is.
        expect([canvas.width, canvas.height]).toEqual([...candles.plate]);
    });

    it('says how the run ended and how hot it got, and whether the player is about to go in', () => {
        const { rerender } = render(<CathedralScene heat={0.5} mood="ended" quality="high" reduceMotion={false} />);
        const scene = screen.getByTestId('cathedral-scene');
        expect(scene).toHaveAttribute('data-mood', 'ended');
        expect(scene).toHaveAttribute('data-scene-heat', '0.50');
        rerender(<CathedralScene quality="high" reduceMotion={false} stirred />);
        expect(scene).toHaveAttribute('data-scene-heat', 'none');
        expect(scene).toHaveAttribute('data-stirred', 'true');
    });

    it('holds still under reduce motion and holds the plate still on low quality', () => {
        const { rerender } = render(<CathedralScene quality="high" reduceMotion />);
        const scene = screen.getByTestId('cathedral-scene');
        expect(scene).toHaveAttribute('data-still', 'true');
        expect(scene).toHaveAttribute('data-alive', 'false');
        expect(scene).toHaveAttribute('data-scene-effect-tier', 'still');
        rerender(<CathedralScene quality="low" reduceMotion={false} />);
        expect(scene).toHaveAttribute('data-still', 'false');
        expect(scene).toHaveAttribute('data-alive', 'false');
        expect(scene).toHaveAttribute('data-scene-effect-tier', 'lean');
    });
});

describe('composeCathedralScene', () => {
    it('paints the nave as a base, its two lights and every candle flame, sunk as far as the page asks', () => {
        const draws = frame();
        expect(sceneDrawIds(draws).slice(0, 3)).toEqual(['base', 'candleGlow', 'wisps']);
        expect(findSceneDraw(draws, 'base')).toMatchObject({ alpha: 0.34 });
        // The lights add; the stone covers.
        expect(findSceneDraw(draws, 'base')!.blend).toBeUndefined();
        expect(findSceneDraw(draws, 'candleGlow')!.blend).toBe('lighter');
        expect(findSceneDraw(draws, 'wisps')!.blend).toBe('lighter');
        // The lights read the light level, not the base's: candles burn brighter than the nave they light.
        expect(findSceneDraw(draws, 'candleGlow')!.alpha).toBeGreaterThan(0.5);
        expect(findSceneDraw(draws, 'candleGlow')!.alpha).toBeLessThan(0.7);
        const flames = flamesOf(draws);
        expect(flames).toHaveLength(candles.sprites.length);
        expect(flames.length).toBeGreaterThanOrEqual(20);
        for (const flame of flames) {
            // Paint over the plate, not light added to a wall the painter already lit.
            expect(flame.blend).toBe('source-over');
            expect(flame.rect!.x).toBeGreaterThanOrEqual(0);
            expect(flame.rect!.x + flame.rect!.w).toBeLessThanOrEqual(1);
        }
    });

    it('never moves the candlelight in steps: a frame apart is a hair apart', () => {
        let largest = 0;
        let lowest = 1;
        let highest = 0;
        for (let t = 0; t < 30_000; t += 33) {
            const now = findSceneDraw(frame({}, t), 'candleGlow')!.alpha;
            const next = findSceneDraw(frame({}, t + 33), 'candleGlow')!.alpha;
            largest = Math.max(largest, Math.abs(next - now));
            lowest = Math.min(lowest, now);
            highest = Math.max(highest, now);
        }
        // It does waver...
        expect(highest - lowest).toBeGreaterThan(0.02);
        // ...but never by more than one part in a hundred of the layer between two frames. The
        // stepped flicker this replaced moved a tenth of the layer in one frame, across the whole wall.
        expect(largest).toBeLessThan(0.006);
    });

    it('mourns at the run end: the candlelight sinks to half and the spirit-light takes the nave', () => {
        const menuFrame = frame();
        const ended = frame({ mood: 'ended' });
        expect(findSceneDraw(ended, 'candleGlow')!.alpha).toBeLessThan(findSceneDraw(menuFrame, 'candleGlow')!.alpha * 0.6);
        expect(findSceneDraw(ended, 'wisps')!.alpha).toBeGreaterThan(findSceneDraw(menuFrame, 'wisps')!.alpha);
        expect(flamesOf(ended)[0]!.alpha).toBeLessThan(flamesOf(menuFrame)[0]!.alpha);
        expect(flamesOf(ended)).toHaveLength(candles.sprites.length);
    });

    it('lights the nave a run ends in by how hot that run got', () => {
        // A quiet moment: no draught passing, so the lift is the run's alone.
        const quiet = momentOf(CATHEDRAL_DRAUGHT_EVERY_MS, CATHEDRAL_DRAUGHT_LASTS_MS, 11, 0.99) + 400;
        const lift = (heat: number | null) => flamesOf(frame({ mood: 'ended', heat }, quiet))[0]!.scaleY!;
        expect(lift(1)).toBeGreaterThan(lift(0));
        // No run behind the screen: the candles are the ones painted.
        expect(lift(null)).toBe(1);
        expect(flamesOf(frame({ heat: null }, quiet))[0]!.scaleY).toBe(1);
    });

    it('burns up while the player is about to go in', () => {
        const quiet = momentOf(CATHEDRAL_DRAUGHT_EVERY_MS, CATHEDRAL_DRAUGHT_LASTS_MS, 11, 0.99) + 400;
        const calm = frame({}, quiet);
        const stirred = frame({ stirred: true }, quiet);
        expect(findSceneDraw(stirred, 'candleGlow')!.alpha).toBeGreaterThan(findSceneDraw(calm, 'candleGlow')!.alpha);
        expect(flamesOf(stirred)[0]!.scaleY!).toBeGreaterThan(flamesOf(calm)[0]!.scaleY!);
    });

    it('sends a draught through now and then: the flames it reaches lean and duck, the rest burn on', () => {
        const mid = momentOf(CATHEDRAL_DRAUGHT_EVERY_MS, CATHEDRAL_DRAUGHT_LASTS_MS, 11, 0.5);
        const flames = flamesOf(frame({}, mid));
        const leaning = flames.filter((flame) => Math.abs(flame.rotate ?? 0) > 0.05);
        const upright = flames.filter((flame) => Math.abs(flame.rotate ?? 0) < 0.01);
        // The front is somewhere in the nave: some candles caught in it, some not yet or no longer.
        expect(leaning.length).toBeGreaterThan(0);
        expect(upright.length).toBeGreaterThan(0);
        for (const flame of leaning) {
            expect(flame.scaleY!).toBeLessThan(1);
            // A flame bends and dims in a draught; it does not go out.
            expect(flame.alpha).toBeGreaterThan(0.3);
        }
        // They all lean the same way: it is one wind.
        expect(new Set(leaning.map((flame) => Math.sign(flame.rotate!))).size).toBe(1);
    });

    it('lets one candle gutter, smoke, and catch again', () => {
        const dark = momentOf(CATHEDRAL_GUTTER_EVERY_MS, CATHEDRAL_GUTTER_LASTS_MS, 31, 0.3);
        const during = frame({}, dark);
        const out = flamesOf(during).filter((flame) => flame.alpha < 0.01);
        expect(out).toHaveLength(1);
        expect(findSceneDraw(during, 'gutter-smoke')).toBeDefined();
        expect(findSceneDraw(during, 'gutter-smoke')!.blend).toBe('source-over');
        const after = frame({}, momentOf(CATHEDRAL_GUTTER_EVERY_MS, CATHEDRAL_GUTTER_LASTS_MS, 31, 0.9, dark));
        expect(flamesOf(after).filter((flame) => flame.alpha < 0.01)).toHaveLength(0);
        expect(findSceneDraw(after, 'gutter-smoke')).toBeUndefined();
    });

    it('has the room lived in: moonlight and dust, mist on the floor, motes, moths', () => {
        const ids = sceneDrawIds(frame());
        for (const id of ['wispsEcho', 'shafts-left', 'shafts-right', 'mist', 'moth-0', 'moth-1']) {
            expect(ids).toContain(id);
        }
        expect(ids.filter((id) => id.startsWith('dust-')).length).toBeGreaterThan(10);
        expect(ids.filter((id) => id.startsWith('pool-'))).toHaveLength(6);
        // The mist is fog behind a mask, not a layer of its own over the whole nave.
        expect(findSceneDraw(frame(), 'mist', 'fog')!.mask.kind).toBe('band');
    });

    it('holds still under reduce motion: the painting lit, every flame on its first frame, nothing adrift', () => {
        const draws = frame({ tier: 'still' });
        const ids = sceneDrawIds(draws);
        expect(ids).toEqual(expect.arrayContaining(['base', 'candleGlow', 'wisps']));
        for (const moving of ['wispsEcho', 'shafts-left', 'mist', 'moth-0', 'bat', 'gutter-smoke']) {
            expect(ids).not.toContain(moving);
        }
        expect(ids.some((id) => id.startsWith('mote-') || id.startsWith('dust-'))).toBe(false);
        for (const flame of flamesOf(draws)) {
            expect(flame.frame!.index).toBe(0);
            expect(flame.scaleY).toBe(1);
            expect(flame.rotate).toBe(0);
        }
        // And it is the same frame whenever it is drawn.
        expect(composeCathedralScene({ ...menu, tier: 'still' }, fixedSceneClock(99_000, { still: true }))).toEqual(draws);
    });

    it('draws the same room on a phone with about half the specks', () => {
        const count = (tier: 'full' | 'lean', prefix: string) => sceneDrawIds(frame({ tier })).filter((id) => id.startsWith(prefix)).length;
        expect(count('lean', 'dust-')).toBeLessThan(count('full', 'dust-'));
        expect(count('lean', 'dust-')).toBeGreaterThan(0);
        const lean = sceneDrawIds(frame({ tier: 'lean' }));
        expect(lean).toEqual(expect.arrayContaining(['base', 'candleGlow', 'wisps', 'wispsEcho', 'mist', 'shafts-left']));
        expect(flamesOf(frame({ tier: 'lean' }))).toHaveLength(candles.sprites.length);
    });

    it('gives every sprite its own period near the sheet\'s own and a start somewhere inside its loop', () => {
        const clocks = candles.sprites.map((sprite, index) => sceneSpriteClocks(sprite, index));
        expect(new Set(clocks.map((clock) => clock.durationMs)).size).toBeGreaterThan(clocks.length * 0.8);
        candles.sprites.forEach((sprite, index) => {
            const loopMs = (1000 / sprite.fps) * sprite.frames;
            expect(clocks[index]!.durationMs).toBeGreaterThanOrEqual(Math.floor(loopMs * 0.9));
            expect(clocks[index]!.durationMs).toBeLessThanOrEqual(Math.ceil(loopMs * 1.1));
            expect(clocks[index]!.delayMs).toBeLessThanOrEqual(0);
            expect(clocks[index]!.delayMs).toBeGreaterThanOrEqual(-clocks[index]!.durationMs);
        });
        // So at any one moment the candles are not all on the same frame.
        expect(new Set(flamesOf(frame({}, 5000)).map((flame) => flame.frame!.index)).size).toBeGreaterThan(3);
    });

    it('throws more sparks from a big flame than a far one', () => {
        expect(sceneSpriteEmbers({ h: 0.15 }, 0)).toHaveLength(4);
        expect(sceneSpriteEmbers({ h: 0.1 }, 0)).toHaveLength(3);
        expect(sceneSpriteEmbers({ h: 0.05 }, 0)).toHaveLength(2);
    });

    it('keeps the spirit-light\'s motes on the two streams painted up the arch', () => {
        const motes = cathedralMotes();
        expect(motes).toHaveLength(CATHEDRAL_MOTE_COUNT);
        for (const mote of motes) {
            expect(Math.min(Math.abs(mote.x - 37), Math.abs(mote.x - 69))).toBeLessThanOrEqual(4);
        }
    });
});
