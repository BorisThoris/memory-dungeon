import type { SceneEffectTier } from '../../shared/graphicsQuality';
import { UI_ART } from '../assets/ui';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { sceneFlameLevels } from './gameplaySceneLevels';
import { ambientSprite, crossingDraws, driftDraws, flameDraws, fogDraw, glintDraws, moteDraws } from './sceneAmbient';
import { sceneBreath, sceneFlicker, sceneHash, sceneOccurrence, sceneSmoothstep, type SceneClock } from './sceneClock';
import type { SceneDraw } from './scenePaint';
import { cathedralMotes } from './sceneSpriteClocks';

/**
 * One frame of the cathedral (`CathedralScene`): the nave behind the main menu and the run's end.
 *
 * What the painter painted: the dark base, the candlelight pooled on the pillars and the floor,
 * the teal spirit-light climbing the far arch, and twenty-nine candle flames cut out as flipbooks.
 *
 * What moves in it now, all of it baked art (`bake_ambient.py`) placed by this function:
 *
 *   - the candlelight wavers, continuously (it used to jump in steps, which on a big screen was
 *     the whole wall flashing); the spirit-light breathes and a blurred echo of it drifts upward;
 *   - every candle burns on its own clock; now and then a draught crosses the nave and the flames
 *     lean and duck as it passes each stand, and now and then one candle gutters, smokes, and
 *     catches again;
 *   - moonlight falls in shafts from the clerestory on both sides, dust turning in it;
 *   - a low mist lies along the floor of the far nave;
 *   - motes of the spirit-light climb the arch and points of it glint along the two streams;
 *   - a moth circles each of the near stands, and once in a long while a bat crosses the vault.
 *
 * `full` and `lean` draw the same room; `lean` (a phone, or low quality) with fewer motes and
 * specks. `still` (reduce motion) is the painting with its lights on and nothing moving.
 */
export interface CathedralFrameInput {
    mood: 'menu' | 'ended';
    /** How hot the run behind the screen got, 0..1, or null with no run behind it (`CathedralScene`). */
    heat: number | null;
    /** Play has the pointer or the focus: the candles burn up (`CathedralSceneProps.stirred`). */
    stirred?: boolean;
    tier: SceneEffectTier;
    /** How far the parent sinks the stone and the lights (`--scene-base-opacity`, `--scene-light-opacity`). */
    base: number;
    light: number;
}

/** The candle stands, near to far on each side: where the moths circle and the light pools. */
const CATHEDRAL_STANDS: ReadonlyArray<readonly [number, number]> = [
    [0.104, 0.56],
    [0.275, 0.67],
    [0.351, 0.715],
    [0.719, 0.705],
    [0.763, 0.68],
    [0.953, 0.51]
];

/** Points along the two streams of spirit-light, where it catches for a moment. */
const WISP_GLINTS: ReadonlyArray<readonly [number, number]> = [
    [0.345, 0.22],
    [0.372, 0.36],
    [0.356, 0.52],
    [0.388, 0.67],
    [0.662, 0.2],
    [0.69, 0.34],
    [0.705, 0.5],
    [0.676, 0.66]
];

export const CATHEDRAL_DRAUGHT_EVERY_MS = 31_000;
export const CATHEDRAL_DRAUGHT_LASTS_MS = 2_800;
export const CATHEDRAL_GUTTER_EVERY_MS = 23_000;
export const CATHEDRAL_GUTTER_LASTS_MS = 5_200;
const CATHEDRAL_BAT_EVERY_MS = 47_000;

const candles = SCENE_SPRITES.cathedralCandles;
const CATHEDRAL_MOTES = cathedralMotes();

export const composeCathedralScene = (input: CathedralFrameInput, clock: SceneClock): SceneDraw[] => {
    const { t } = clock;
    const still = input.tier === 'still';
    const lean = input.tier === 'lean';
    const ended = input.mood === 'ended';
    const light = input.light;
    const draws: SceneDraw[] = [];

    draws.push({ kind: 'image', id: 'base', src: UI_ART.menuSceneBase, alpha: input.base });

    // A draught: a front crossing the nave, one way or the other.
    const draught = still ? null : sceneOccurrence(t, CATHEDRAL_DRAUGHT_EVERY_MS, CATHEDRAL_DRAUGHT_LASTS_MS, 11);
    const draughtDirection = draught && sceneHash(draught.index, 12) < 0.5 ? -1 : 1;
    const draughtFront = draught ? (draughtDirection > 0 ? -0.15 + 1.3 * draught.progress : 1.15 - 1.3 * draught.progress) : 0;
    const draughtAt = (x: number): number => (draught ? Math.exp(-(((x - draughtFront) / 0.1) ** 2)) : 0);

    // The run's end sinks the candlelight to half and lets the spirit-light take the nave.
    const candleLevel = clock.smooth('candleGlow', ended ? 0.5 : 1, 3000);
    const wispLevel = clock.smooth('wisps', ended ? 1.25 : 1, 3000);
    const stir = clock.smooth('stir', input.stirred ? 1 : 0, 700);
    const waver = still || ended ? 0 : 0.055 * sceneFlicker(t, 1);
    const draughtDip = draught ? 0.07 * Math.sin(draught.progress * Math.PI) : 0;
    draws.push({
        kind: 'image',
        id: 'candleGlow',
        src: UI_ART.menuSceneGlowCandles,
        alpha: light * candleLevel * (0.97 + waver - draughtDip + 0.22 * stir),
        blend: 'lighter'
    });
    draws.push({
        kind: 'image',
        id: 'wisps',
        src: UI_ART.menuSceneGlowWisps,
        alpha: light * wispLevel * (still || ended ? 1 : 0.8 + 0.2 * sceneBreath(t, 7500)),
        blend: 'lighter'
    });
    if (!still) {
        // A fainter, softer copy drifting upward out of phase: the light seems to move along the arch.
        const p = sceneBreath(t, 22_000, 0.36);
        draws.push({
            kind: 'image',
            id: 'wispsEcho',
            src: UI_ART.menuSceneGlowWisps,
            alpha: light * (0.12 + 0.28 * Math.sin(p * Math.PI)),
            blend: 'lighter',
            rect: { x: 0.003 * p, y: 0.008 - 0.02 * p, w: 1, h: 1 },
            filter: { blurPx: 2 }
        });

        // Moonlight from the clerestory, one sheet of shafts on each side leaning in toward the nave.
        const shaftAlpha = light * (ended ? 0.2 : 0.14);
        draws.push({ ...ambientSprite({ id: 'shafts-left', cell: 'shafts', x: 0, y: 0, size: 1, alpha: 0 }), rect: { x: 0.08, y: -0.02, w: 0.42, h: 0.78 }, alpha: shaftAlpha * (0.7 + 0.3 * sceneBreath(t, 19_000)), depth: 0.4 });
        draws.push({ ...ambientSprite({ id: 'shafts-right', cell: 'shafts', x: 0, y: 0, size: 1, alpha: 0 }), rect: { x: 0.5, y: -0.02, w: 0.42, h: 0.78 }, alpha: shaftAlpha * (0.7 + 0.3 * sceneBreath(t, 23_000, 0.4)), scaleX: -1, depth: 0.4 });
        draws.push(...driftDraws({ idPrefix: 'dust-left', cell: 'dust', count: lean ? 7 : 14, x: 0.14, y: 0.12, w: 0.3, h: 0.56, fall: 0.012, slide: 0.006, size: 0.014, alpha: light * 0.55, seed: 21 }, t));
        draws.push(...driftDraws({ idPrefix: 'dust-right', cell: 'dust', count: lean ? 7 : 14, x: 0.56, y: 0.12, w: 0.3, h: 0.56, fall: 0.011, slide: -0.006, size: 0.014, alpha: light * 0.55, seed: 27 }, t));

        // A low mist on the floor of the far nave.
        draws.push(fogDraw({ id: 'mist', t, alpha: light * 0.4, mask: { kind: 'band', top: 0.7, solidFrom: 0.84, solidTo: 0.94, bottom: 1 }, speed: 0.004, seed: 3 }));
    }

    // The pool of light at each stand, breathing with its candles.
    CATHEDRAL_STANDS.forEach(([x, y], index) => {
        const breathe = still ? 0.6 : 0.6 + 0.25 * sceneFlicker(t, 5 + index) - 0.35 * draughtAt(x);
        draws.push(
            ambientSprite({ id: `pool-${index}`, cell: 'haloWarm', x, y: y + 0.03, size: 0.24, alpha: light * candleLevel * 0.5 * (breathe + 0.5 * stir), depth: 0.6 })
        );
    });

    // The candles. A run's heat makes them burn faster and taller; with no run they are the painter's.
    const levels = input.heat === null ? null : sceneFlameLevels(input.heat, false);
    const gutter = still ? null : sceneOccurrence(t, CATHEDRAL_GUTTER_EVERY_MS, CATHEDRAL_GUTTER_LASTS_MS, 31);
    const guttered = gutter ? Math.floor(sceneHash(gutter.index, 32) * candles.sprites.length) : -1;
    // Out by a twelfth of the beat, dark until three fifths, alight again by two thirds.
    const gutterFlame = gutter ? Math.max(1 - sceneSmoothstep(0, 0.08, gutter.progress), sceneSmoothstep(0.6, 0.68, gutter.progress)) : 1;
    const thingsAlpha = light * (ended ? 0.7 : 1);
    draws.push(
        ...flameDraws(candles.sprites, {
            burnedMs: clock.phase('candles', (levels?.rate ?? 1) * (1 + 0.5 * stir)),
            lift: (levels?.lift ?? 1) * (1 + 0.14 * stir),
            alpha: thingsAlpha,
            still,
            each: (sprite, index) => {
                const gust = draughtAt(sprite.x + sprite.w / 2);
                return {
                    alpha: (1 - 0.3 * gust) * (index === guttered ? gutterFlame : 1),
                    lift: 1 - 0.3 * gust,
                    lean: draughtDirection * 0.38 * gust
                };
            }
        })
    );
    if (gutter && guttered >= 0) {
        const sprite = candles.sprites[guttered];
        if (sprite) {
            const x = sprite.x + sprite.w / 2;
            const smoke = sceneSmoothstep(0.06, 0.6, gutter.progress);
            if (gutter.progress > 0.06 && gutter.progress < 0.62) {
                draws.push(
                    ambientSprite({
                        id: 'gutter-smoke',
                        cell: 'smoke',
                        x: x + 0.006 * Math.sin(smoke * 5),
                        y: sprite.y - 0.07 * smoke,
                        size: 0.03 + 0.05 * smoke,
                        alpha: thingsAlpha * 0.4 * Math.sin(smoke * Math.PI),
                        blend: 'source-over'
                    })
                );
            }
            // Catching again: a small bloom of light where the flame comes back.
            const catching = 1 - Math.abs(gutter.progress - 0.66) / 0.08;
            if (catching > 0) {
                draws.push(ambientSprite({ id: 'gutter-catch', cell: 'haloWarm', x, y: sprite.y + sprite.h * 0.4, size: 0.09, alpha: thingsAlpha * 0.8 * catching }));
            }
        }
    }

    if (!still) {
        const motes = CATHEDRAL_MOTES;
        draws.push(...moteDraws(lean ? motes.filter((_, index) => index % 2 === 0) : motes, 'dotTeal', t, thingsAlpha, 'mote'));
        draws.push(...glintDraws({ idPrefix: 'wisp-glint', points: WISP_GLINTS, t, everyMs: 9000, lastsMs: 1600, size: 0.05, alpha: light * wispLevel * 0.7, seed: 41, cell: 'dotTeal' }));

        // A moth round each near stand: a slow figure of eight, wings flicking.
        ([0, 5] as const).forEach((stand, index) => {
            const [sx, sy] = CATHEDRAL_STANDS[stand]!;
            const s = t / 1000;
            const angle = s * (0.9 + 0.23 * index) + index * 2.1;
            const x = sx + 0.035 * Math.sin(angle) + 0.008 * Math.sin(angle * 3.1);
            const y = sy - 0.02 + 0.03 * Math.sin(angle * 2 + 0.6) * 0.7;
            draws.push(
                ambientSprite({
                    id: `moth-${index}`,
                    cell: 'moth',
                    x,
                    y,
                    size: 0.022,
                    alpha: thingsAlpha * 0.75,
                    blend: 'source-over',
                    frame: Math.floor(s * 11 + index) % 2,
                    rotate: 0.5 * Math.cos(angle),
                    scaleX: Math.cos(angle) < 0 ? -1 : 1
                })
            );
        });

        draws.push(
            ...crossingDraws({ id: 'bat', cell: 'bat', t, everyMs: CATHEDRAL_BAT_EVERY_MS, lastsMs: 5200, seed: 51, fromX: 0.2, toX: 0.8, yMin: 0.1, yMax: 0.3, size: 0.04, alpha: 0.8 })
        );
    }
    return draws;
};
