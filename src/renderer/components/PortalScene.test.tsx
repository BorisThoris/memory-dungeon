import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { PortalScene } from './PortalScene';
import { composePortalScene, PORTAL_FIREFLIES, PORTAL_LEAVES, PORTAL_STAR_EVERY_MS, PORTAL_STAR_LASTS_MS, PORTAL_VORTEX_SPARKS, type PortalFrameInput } from './portalSceneFrame';
import { PORTAL_MOTE_COUNT, portalMotes } from './portalSceneMotes';
import { fixedSceneClock, sceneOccurrence } from './sceneClock';
import { findSceneDraw, sceneDrawIds, type SceneImageDraw } from './scenePaint';

const full: PortalFrameInput = { tier: 'full', base: 0.3, light: 0.55 };
const frame = (over: Partial<PortalFrameInput> = {}, t = 2000) => composePortalScene({ ...full, ...over }, fixedSceneClock(t, { still: over.tier === 'still' }));
const withPrefix = (draws: ReturnType<typeof frame>, prefix: string) =>
    draws.filter((draw): draw is SceneImageDraw => draw.kind === 'image' && draw.id.startsWith(prefix) && draw.alpha > 0.004);

describe('PortalScene', () => {
    it('is decoration: one canvas in a plate the shape of the painting', () => {
        render(<PortalScene quality="high" reduceMotion={false} />);
        const scene = screen.getByTestId('portal-scene');
        expect(scene).toHaveAttribute('aria-hidden', 'true');
        expect(scene).toHaveAttribute('data-alive', 'true');
        const plate = screen.getByTestId('portal-scene-plate');
        expect(plate.children).toHaveLength(1);
        const canvas = screen.getByTestId('portal-scene-canvas') as HTMLCanvasElement;
        expect([canvas.width, canvas.height]).toEqual([...SCENE_SPRITES.portalVortex.plate]);
    });

    it('holds still under reduce motion and holds the plate still on low quality', () => {
        const { rerender } = render(<PortalScene quality="high" reduceMotion />);
        const scene = screen.getByTestId('portal-scene');
        expect(scene).toHaveAttribute('data-still', 'true');
        expect(scene).toHaveAttribute('data-scene-effect-tier', 'still');
        rerender(<PortalScene quality="low" reduceMotion={false} />);
        expect(scene).toHaveAttribute('data-still', 'false');
        expect(scene).toHaveAttribute('data-alive', 'false');
        expect(scene).toHaveAttribute('data-scene-effect-tier', 'lean');
    });
});

describe('composePortalScene', () => {
    it('paints the clearing as a base and its lights: two copies of the stars, the moon, the runes', () => {
        const draws = frame();
        expect(sceneDrawIds(draws).slice(0, 5)).toEqual(['base', 'starsA', 'starsB', 'moon', 'runes']);
        expect(findSceneDraw(draws, 'base')!.alpha).toBe(0.3);
        for (const id of ['starsA', 'starsB', 'moon', 'runes']) {
            expect(findSceneDraw(draws, id)!.blend).toBe('lighter');
            expect(findSceneDraw(draws, id)!.alpha).toBeLessThanOrEqual(0.55);
        }
    });

    it('twinkles the stars without stepping, the two copies never agreeing', () => {
        let largest = 0;
        let agree = 0;
        for (let t = 0; t < 40_000; t += 33) {
            const a = findSceneDraw(frame({}, t), 'starsA')!.alpha;
            const b = findSceneDraw(frame({}, t), 'starsB')!.alpha;
            largest = Math.max(largest, Math.abs(findSceneDraw(frame({}, t + 33), 'starsA')!.alpha - a));
            agree += Math.abs(a - b) < 0.002 ? 1 : 0;
        }
        expect(largest).toBeLessThan(0.01);
        // They cross now and then; they do not move together.
        expect(agree).toBeLessThan(200);
    });

    it('turns the vortex in the arch with a fainter copy turning the other way, and draws sparks into it', () => {
        const vortex = SCENE_SPRITES.portalVortex.sprites[0]!;
        const early = frame({}, 1000);
        const later = frame({}, 9000);
        const core = findSceneDraw(early, 'vortex')!;
        const echo = findSceneDraw(early, 'vortex-echo')!;
        expect(core.rect).toEqual({ x: vortex.x, y: vortex.y, w: vortex.w, h: vortex.h });
        expect(findSceneDraw(later, 'vortex')!.rotate!).toBeGreaterThan(core.rotate!);
        expect(findSceneDraw(later, 'vortex-echo')!.rotate!).toBeLessThan(echo.rotate!);
        expect(echo.alpha).toBeLessThan(core.alpha);
        expect(echo.blend).toBe('lighter');
        const sparks = early.filter((draw) => draw.id.startsWith('vortex-spark-'));
        expect(sparks).toHaveLength(PORTAL_VORTEX_SPARKS);
        // Every spark is inside the opening.
        for (const spark of sparks as SceneImageDraw[]) {
            const cx = spark.rect!.x + spark.rect!.w / 2;
            const cy = spark.rect!.y + spark.rect!.h / 2;
            expect(Math.abs(cx - (vortex.x + vortex.w / 2))).toBeLessThanOrEqual(vortex.w * 0.53);
            expect(Math.abs(cy - (vortex.y + vortex.h / 2))).toBeLessThanOrEqual(vortex.h * 0.53);
        }
    });

    it('has the clearing lived in: mist, motes, fireflies among the plants, leaves coming down', () => {
        const draws = frame();
        expect(findSceneDraw(draws, 'mist', 'fog')!.mask).toMatchObject({ kind: 'band' });
        expect(draws.filter((draw) => draw.id.startsWith('mote-'))).toHaveLength(PORTAL_MOTE_COUNT);
        expect(draws.filter((draw) => draw.id.startsWith('firefly-'))).toHaveLength(PORTAL_FIREFLIES);
        expect(draws.filter((draw) => draw.id.startsWith('leaf-'))).toHaveLength(PORTAL_LEAVES);
        expect(draws.filter((draw) => draw.id.startsWith('plant-'))).toHaveLength(3);
        // Fireflies keep to the ground on either side; the middle is the path and the page's copy.
        for (const firefly of draws.filter((draw): draw is SceneImageDraw => draw.id.startsWith('firefly-') && draw.kind === 'image')) {
            const cx = firefly.rect!.x + firefly.rect!.w / 2;
            expect(cx < 0.38 || cx > 0.64).toBe(true);
            expect(firefly.rect!.y).toBeGreaterThan(0.5);
        }
        // A leaf is paint, not light.
        expect(findSceneDraw(draws, 'leaf-0')!.blend).toBe('source-over');
    });

    it('lets a star fall across the upper sky once in a while, and not otherwise', () => {
        let seen = 0;
        let during = -1;
        for (let t = 0; t < PORTAL_STAR_EVERY_MS * 4; t += 100) {
            if (sceneOccurrence(t, PORTAL_STAR_EVERY_MS, PORTAL_STAR_LASTS_MS, 111)) {
                seen += 1;
                during = t;
            } else {
                expect(findSceneDraw(frame({}, t), 'falling-star')).toBeUndefined();
            }
        }
        // Under a second in every half minute.
        expect(seen).toBeGreaterThan(20);
        expect(seen).toBeLessThan(50);
        const star = findSceneDraw(frame({}, during), 'falling-star')!;
        expect(star.rect!.y).toBeLessThan(0.3);
        expect(star.blend).toBe('lighter');
    });

    it('holds still under reduce motion: the painting lit, the vortex where it was painted', () => {
        const draws = frame({ tier: 'still' });
        expect(sceneDrawIds(draws)).toEqual(['base', 'starsA', 'starsB', 'moon', 'runes', 'vortex', 'plant-0', 'plant-1', 'plant-2']);
        expect(findSceneDraw(draws, 'vortex')!.rotate).toBe(0);
        expect(composePortalScene({ ...full, tier: 'still' }, fixedSceneClock(50_000, { still: true }))).toEqual(draws);
    });

    it('draws the same clearing on a phone with fewer specks', () => {
        const lean = frame({ tier: 'lean' });
        expect(sceneDrawIds(lean)).toEqual(expect.arrayContaining(['base', 'moon', 'runes', 'vortex', 'vortex-echo', 'mist']));
        expect(withPrefix(lean, 'vortex-spark-').length).toBeLessThanOrEqual(PORTAL_VORTEX_SPARKS / 2);
        expect(lean.filter((draw) => draw.id.startsWith('mote-')).length).toBeLessThan(PORTAL_MOTE_COUNT);
        expect(lean.filter((draw) => draw.id.startsWith('firefly-')).length).toBeLessThan(PORTAL_FIREFLIES);
    });

    it('keeps the motes to the sides of the arch, each on its own loop', () => {
        const motes = portalMotes();
        expect(motes).toHaveLength(PORTAL_MOTE_COUNT);
        for (const mote of motes) {
            expect(mote.x < 36 || mote.x > 64).toBe(true);
        }
        expect(new Set(motes.map((mote) => mote.durationMs)).size).toBeGreaterThan(PORTAL_MOTE_COUNT - 3);
    });
});
