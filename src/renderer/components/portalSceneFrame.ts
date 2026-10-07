import type { SceneEffectTier } from '../../shared/graphicsQuality';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { portalMotes } from './portalSceneMotes';
import { ambientSprite, driftDraws, fogDraw, glintDraws, moteDraws, sceneKeyframes } from './sceneAmbient';
import { sceneBreath, sceneHash, sceneOccurrence, sceneSmoothstep, type SceneClock } from './sceneClock';
import type { SceneDraw } from './scenePaint';

/**
 * One frame of the portal clearing (`PortalScene`): the Classic poster behind Choose Your Path.
 *
 * What the painter painted: the dark base, the cyan of the arch's runes and the glowing plants,
 * the moon and its halo, the stars, and the vortex cut out of the arch as one feathered disc.
 *
 * What moves in it, all of it baked art placed by this function:
 *
 *   - the runes breathe, the moon pulses on a slower clock, and the stars twinkle (two copies of
 *     the star layer on curves that never agree, and single stars that catch for a moment);
 *   - the vortex turns, a fainter copy turning the other way behind it, and sparks spiral into it;
 *   - mist lies over the clearing's floor and slides;
 *   - motes rise through the trees, fireflies wander among the glowing plants and blink, and a
 *     leaf lets go of the canopy every so often and comes down turning;
 *   - once in a while a star falls across the sky.
 *
 * `full` and `lean` draw the same clearing; `lean` with fewer specks. `still` is the painting lit.
 */
export interface PortalFrameInput {
    tier: SceneEffectTier;
    base: number;
    light: number;
}

/** Stars that catch the light on their own, fractions of the plate. */
const STAR_GLINTS: ReadonlyArray<readonly [number, number]> = [
    [0.145, 0.07],
    [0.22, 0.035],
    [0.265, 0.17],
    [0.355, 0.045],
    [0.4, 0.13],
    [0.58, 0.06],
    [0.615, 0.17],
    [0.745, 0.05],
    [0.79, 0.16],
    [0.83, 0.03]
];

/** Runes round the arch and down its pillars. */
const RUNE_GLINTS: ReadonlyArray<readonly [number, number]> = [
    [0.4, 0.3],
    [0.425, 0.19],
    [0.465, 0.125],
    [0.503, 0.105],
    [0.54, 0.125],
    [0.578, 0.19],
    [0.603, 0.3],
    [0.418, 0.5],
    [0.587, 0.5]
];

/** The glowing plants either side of the path. */
const PLANT_POOLS: ReadonlyArray<readonly [number, number]> = [
    [0.345, 0.83],
    [0.655, 0.81],
    [0.09, 0.9]
];

export const PORTAL_STAR_EVERY_MS = 29_000;
export const PORTAL_STAR_LASTS_MS = 950;
export const PORTAL_LEAVES = 5;
export const PORTAL_FIREFLIES = 9;
export const PORTAL_VORTEX_SPARKS = 12;

const set = SCENE_SPRITES.portalVortex;
const PORTAL_MOTES = portalMotes();

/** A value wandering through 0.2..0.75 on three sines: a star's brightness, never stepping. */
const twinkle = (t: number, a: number, b: number, c: number, phase: number): number => {
    const s = t / 1000;
    return 0.475 + 0.14 * Math.sin(s * a + phase) + 0.09 * Math.sin(s * b + phase * 2.3) + 0.05 * Math.sin(s * c + phase * 0.7);
};

export const composePortalScene = (input: PortalFrameInput, clock: SceneClock): SceneDraw[] => {
    const { t } = clock;
    const s = t / 1000;
    const still = input.tier === 'still';
    const lean = input.tier === 'lean';
    const light = input.light;
    const vortex = set.sprites[0] ?? null;
    const draws: SceneDraw[] = [];

    draws.push({ kind: 'image', id: 'base', src: UI_ART.portalSceneBase, alpha: input.base });
    draws.push({ kind: 'image', id: 'starsA', src: UI_ART.portalSceneStars, alpha: light * (still ? 0.6 : twinkle(t, 0.85, 1.93, 3.1, 0)), blend: 'lighter' });
    draws.push({ kind: 'image', id: 'starsB', src: UI_ART.portalSceneStars, alpha: light * (still ? 0.5 : twinkle(t, 0.59, 1.37, 2.7, 1.9) * 0.9), blend: 'lighter' });
    draws.push({ kind: 'image', id: 'moon', src: UI_ART.portalSceneGlowMoon, alpha: light * (still ? 1 : 0.86 + 0.14 * sceneBreath(t, 11_000, 0.27)), blend: 'lighter' });
    draws.push({ kind: 'image', id: 'runes', src: UI_ART.portalSceneGlowRunes, alpha: light * (still ? 1 : 0.78 + 0.22 * sceneBreath(t, 6500)), blend: 'lighter' });

    if (vortex) {
        const rect = { x: vortex.x, y: vortex.y, w: vortex.w, h: vortex.h };
        if (!still) {
            // A fainter copy turning the other way, a little larger: two currents in the one whirlpool.
            draws.push({ kind: 'image', id: 'vortex-echo', src: vortex.sheet, alpha: light * 0.22, blend: 'lighter', rect, rotate: (-2 * Math.PI * s) / 97, scaleX: 1.08, scaleY: 1.08, depth: 1 });
        }
        draws.push({ kind: 'image', id: 'vortex', src: vortex.sheet, alpha: light, rect, rotate: still ? 0 : (2 * Math.PI * s) / 64, scaleX: 1, scaleY: 1, depth: 1 });

        if (!still) {
            // Sparks drawn in: each starts at the rim of the opening and winds down to the eye.
            const cx = vortex.x + vortex.w / 2;
            const cy = vortex.y + vortex.h / 2;
            const count = lean ? PORTAL_VORTEX_SPARKS / 2 : PORTAL_VORTEX_SPARKS;
            for (let index = 0; index < count; index += 1) {
                const period = 5200 + 2600 * sceneHash(index, 61);
                const p = (((t + sceneHash(index, 62) * period) % period) + period) % period / period;
                const radius = (1 - p) ** 1.4;
                const angle = sceneHash(index, 63) * 6.283 + p * 7.5;
                draws.push(
                    ambientSprite({
                        id: `vortex-spark-${index}`,
                        cell: index % 3 === 0 ? 'dotViolet' : 'dotCyan',
                        x: cx + vortex.w * 0.52 * radius * Math.cos(angle),
                        y: cy + vortex.h * 0.52 * radius * Math.sin(angle),
                        size: 0.012 + 0.014 * radius,
                        alpha: light * 0.9 * sceneKeyframes(p, [[0, 0], [0.15, 1], [0.8, 0.8], [1, 0]])
                    })
                );
            }
        }
    }

    // The plants' own light, breathing with the runes they echo.
    PLANT_POOLS.forEach(([x, y], index) => {
        draws.push(ambientSprite({ id: `plant-${index}`, cell: 'haloCool', x, y, size: 0.2, alpha: light * 0.35 * (still ? 0.8 : 0.6 + 0.4 * sceneBreath(t, 6500 + index * 900, index * 0.3)), depth: 0.5 }));
    });

    if (still) {
        return draws;
    }

    draws.push(fogDraw({ id: 'mist', t, alpha: light * 0.5, mask: { kind: 'band', top: 0.52, solidFrom: 0.7, solidTo: 0.92, bottom: 1 }, speed: 0.005, seed: 7 }));

    const motes = PORTAL_MOTES;
    draws.push(...moteDraws(lean ? motes.filter((_, index) => index % 2 === 0) : motes, 'dotCyan', t, light, 'mote'));
    draws.push(...glintDraws({ idPrefix: 'star', points: STAR_GLINTS, t, everyMs: 7000, lastsMs: 1400, size: 0.045, alpha: light * 0.9, seed: 71 }));
    draws.push(...glintDraws({ idPrefix: 'rune-glint', points: RUNE_GLINTS, t, everyMs: 11_000, lastsMs: 1500, size: 0.04, alpha: light * 0.7, seed: 77, cell: 'dotCyan' }));
    draws.push(...driftDraws({ idPrefix: 'spore', cell: 'dust', count: lean ? 6 : 12, x: 0.02, y: 0.35, w: 0.96, h: 0.6, fall: -0.008, slide: 0.004, size: 0.012, alpha: light * 0.45, seed: 81 }, t));

    // Fireflies: each wanders a small loop of its own among the plants and blinks on a slow beat.
    const fireflies = lean ? Math.ceil(PORTAL_FIREFLIES / 2) : PORTAL_FIREFLIES;
    for (let index = 0; index < fireflies; index += 1) {
        const left = index % 2 === 0;
        const homeX = left ? 0.05 + 0.27 * sceneHash(index, 91) : 0.7 + 0.26 * sceneHash(index, 91);
        const homeY = 0.6 + 0.32 * sceneHash(index, 92);
        const speed = 0.25 + 0.2 * sceneHash(index, 93);
        const phase = sceneHash(index, 94) * 6.283;
        const blink = Math.max(0, Math.sin(s * (0.9 + 0.5 * sceneHash(index, 95)) + phase)) ** 2;
        draws.push(
            ambientSprite({
                id: `firefly-${index}`,
                cell: 'dotFirefly',
                x: homeX + 0.03 * Math.sin(s * speed + phase) + 0.012 * Math.sin(s * speed * 2.7 + phase),
                y: homeY + 0.025 * Math.sin(s * speed * 1.3 + phase * 1.7),
                size: 0.022,
                alpha: light * (0.15 + 0.85 * blink)
            })
        );
    }

    // Leaves off the canopy on either side: a slow fall, a sway, a turn.
    for (let index = 0; index < (lean ? 3 : PORTAL_LEAVES); index += 1) {
        const period = 15_000 + 9000 * sceneHash(index, 101);
        const cycle = Math.floor((t + sceneHash(index, 102) * period) / period);
        const p = (((t + sceneHash(index, 102) * period) % period) + period) % period / period;
        const left = sceneHash(index + cycle * 7, 103) < 0.5;
        const startX = left ? 0.02 + 0.24 * sceneHash(index + cycle, 104) : 0.76 + 0.22 * sceneHash(index + cycle, 104);
        const sway = 0.035 * Math.sin(p * 11 + index);
        draws.push(
            ambientSprite({
                id: `leaf-${index}`,
                cell: index % 2 === 0 ? 'leaf' : 'leafCurled',
                x: startX + sway + (left ? 0.05 : -0.05) * p,
                y: 0.12 + 0.86 * p,
                size: 0.03,
                alpha: 0.85 * Math.min(sceneSmoothstep(0, 0.08, p), sceneSmoothstep(1, 0.9, p)),
                blend: 'source-over',
                rotate: p * 9 + Math.sin(p * 11 + index) * 0.8,
                scaleX: Math.cos(p * 14 + index)
            })
        );
    }

    // A falling star: a streak across the upper sky, gone in under a second.
    const star = sceneOccurrence(t, PORTAL_STAR_EVERY_MS, PORTAL_STAR_LASTS_MS, 111);
    if (star) {
        const fromX = 0.12 + 0.3 * sceneHash(star.index, 112);
        const fromY = 0.02 + 0.06 * sceneHash(star.index, 113);
        const angle = 0.3 + 0.25 * sceneHash(star.index, 114);
        const travel = 0.22;
        draws.push(
            ambientSprite({
                id: 'falling-star',
                cell: 'streak',
                x: fromX + travel * star.progress * Math.cos(angle),
                y: fromY + travel * star.progress * Math.sin(angle) * 1.79,
                size: 0.028,
                alpha: light * Math.sin(star.progress * Math.PI),
                rotate: angle,
                depth: 0.3
            })
        );
    }
    return draws;
};
