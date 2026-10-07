import { AMBIENT_SPRITES, type AmbientCellName, type SceneSpriteDef } from '../assets/ui/sprites';
import { sceneHash, sceneOccurrence, sceneSmoothstep } from './sceneClock';
import type { SceneBlend, SceneDraw, SceneFogDraw, SceneFogMask, SceneImageDraw } from './scenePaint';
import { sceneSpriteClocks, sceneSpriteEmbers, type SceneMote } from './sceneSpriteClocks';

/**
 * The small things that move in a painted scene, drawn from the baked ambient atlas
 * (`scripts/scene-pipeline/bake_ambient.py`): motes, sparks, fog, and the things that happen now
 * and then — a bat crossing the vault, a candle guttering, a star falling. Each helper turns a
 * moment into draws for `paintScene`; none of them remembers anything.
 */

/** Every scene's painting is this shape, so a height on the plate converts to a width on it. */
export const SCENE_PLATE_ASPECT = 1376 / 768;

/** The plate's height in the pixels the motes' drift and rise were authored in. */
const AUTHORED_PLATE_HEIGHT = 768;
const AUTHORED_PLATE_WIDTH = 1376;

interface AmbientSpriteOptions {
    id: string;
    cell: AmbientCellName;
    /** Centre, fractions of the plate. */
    x: number;
    y: number;
    /** Height as a fraction of the plate's height; the width follows the cell's shape. */
    size: number;
    alpha: number;
    blend?: SceneBlend;
    rotate?: number;
    frame?: number;
    scaleX?: number;
    scaleY?: number;
    depth?: number;
}

/** One cell of the ambient atlas, centred at a point of the plate. */
export const ambientSprite = (options: AmbientSpriteOptions): SceneImageDraw => {
    const cell = AMBIENT_SPRITES.cells[options.cell];
    const h = options.size;
    const w = (h * (cell.w / cell.h)) / SCENE_PLATE_ASPECT;
    return {
        kind: 'image',
        id: options.id,
        src: AMBIENT_SPRITES.atlas,
        alpha: options.alpha,
        blend: options.blend ?? 'lighter',
        rect: { x: options.x - w / 2, y: options.y - h / 2, w, h },
        crop: { x: cell.x, y: cell.y, w: cell.w * cell.frames, h: cell.h },
        frame: { index: options.frame ?? 0, count: cell.frames },
        rotate: options.rotate,
        scaleX: options.scaleX,
        scaleY: options.scaleY,
        depth: options.depth ?? 1
    };
};

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

/** Piecewise-linear through `[at, value]` points; `at` ascending in 0..1. */
export const sceneKeyframes = (progress: number, points: ReadonlyArray<readonly [number, number]>): number => {
    if (points.length === 0) {
        return 0;
    }
    if (progress <= points[0]![0]) {
        return points[0]![1];
    }
    for (let index = 1; index < points.length; index += 1) {
        const [at, value] = points[index]!;
        if (progress <= at) {
            const [previousAt, previousValue] = points[index - 1]!;
            return lerp(previousValue, value, (progress - previousAt) / (at - previousAt || 1));
        }
    }
    return points[points.length - 1]![1];
};

const loopProgress = (t: number, durationMs: number, delayMs: number): number => {
    const duration = Math.max(1, durationMs);
    const p = ((t - delayMs) % duration) / duration;
    return p < 0 ? p + 1 : p;
};

/**
 * Points of light rising and wandering from where they start (`SceneMote`): the cathedral's
 * spirit-light, the ring's sparks, the clearing's motes. One baked dot each, on its own loop.
 */
export const moteDraws = (
    motes: readonly SceneMote[],
    cell: AmbientCellName,
    t: number,
    alpha: number,
    idPrefix: string
): SceneImageDraw[] =>
    motes.map((mote) => {
        const p = loopProgress(t, mote.durationMs, mote.delayMs);
        const dx = sceneKeyframes(p, [
            [0, 0],
            [0.52, mote.driftPx],
            [1, mote.driftPx * 0.35]
        ]);
        const dy = sceneKeyframes(p, [
            [0, 0],
            [0.52, -0.52 * mote.risePx],
            [1, -mote.risePx]
        ]);
        const fade = sceneKeyframes(p, [
            [0, 0],
            [0.16, 0.85],
            [0.52, 0.5],
            [0.84, 0.65],
            [1, 0]
        ]);
        return ambientSprite({
            id: `${idPrefix}-${mote.id}`,
            cell,
            x: mote.x / 100 + dx / AUTHORED_PLATE_WIDTH,
            y: mote.y / 100 + dy / AUTHORED_PLATE_HEIGHT,
            size: (mote.size * 7.5) / AUTHORED_PLATE_HEIGHT,
            alpha: alpha * fade
        });
    });

interface FlameOptions {
    /** Milliseconds the flames have burned, already scaled by how fast they burn (`SceneClock.phase`). */
    burnedMs: number;
    /** Vertical scale about each flame's foot. */
    lift: number;
    alpha: number;
    /** Every flame on its first frame: the painting's own. */
    still: boolean;
    /** Per-flame adjustments on top: a draught, a gutter. */
    each?: (sprite: SceneSpriteDef, index: number) => { alpha?: number; lift?: number; lean?: number } | undefined;
}

/**
 * The flames cut out of a painting, each stepping through its flipbook on its own clock
 * (`sceneSpriteClocks`), drawn over the plate where the pipeline dimmed the painted flame.
 */
export const flameDraws = (sprites: readonly SceneSpriteDef[], options: FlameOptions): SceneImageDraw[] =>
    sprites.map((sprite, index) => {
        const clock = sceneSpriteClocks(sprite, index);
        const frames = Math.max(1, sprite.frames);
        const frame = options.still ? 0 : Math.floor(loopProgress(options.burnedMs, clock.durationMs, clock.delayMs) * frames) % frames;
        const adjust = options.each?.(sprite, index);
        return {
            kind: 'image',
            id: sprite.id,
            src: sprite.sheet,
            alpha: options.alpha * (adjust?.alpha ?? 1),
            blend: 'source-over',
            rect: { x: sprite.x, y: sprite.y, w: sprite.w, h: sprite.h },
            frame: { index: frame, count: frames },
            scaleX: 1,
            scaleY: options.still ? 1 : options.lift * (adjust?.lift ?? 1),
            rotate: options.still ? 0 : (adjust?.lean ?? 0),
            originX: 0.5,
            originY: 1,
            depth: 1
        };
    });

/** The sparks that come off each flame (`sceneSpriteEmbers`), rising through a box above it. */
export const flameEmberDraws = (
    sprites: readonly SceneSpriteDef[],
    risenMs: number,
    alpha: number,
    cell: AmbientCellName = 'dotEmber'
): SceneImageDraw[] =>
    sprites.flatMap((sprite, index) => {
        const boxX = sprite.x + sprite.w * 0.25;
        const boxY = sprite.y - sprite.h * 0.35;
        const boxW = sprite.w * 0.5;
        const boxH = sprite.h * 0.75;
        return sceneSpriteEmbers(sprite, index).map((ember) => {
            const p = loopProgress(risenMs, ember.durationMs, ember.delayMs);
            const fade = sceneKeyframes(p, [
                [0, 0],
                [0.12, 0.9],
                [0.55, 0.6],
                [1, 0]
            ]);
            return ambientSprite({
                id: `ember-${sprite.id}-${ember.id}`,
                cell,
                x: boxX + (boxW * ember.x) / 100 + (ember.driftPx * p) / AUTHORED_PLATE_WIDTH,
                y: boxY + boxH * (1 - p),
                size: ((ember.size * 6) / AUTHORED_PLATE_HEIGHT) * lerp(1, 0.5, p),
                alpha: alpha * fade
            });
        });
    });

interface FogOptions {
    id: string;
    t: number;
    alpha: number;
    mask: SceneFogMask;
    /** Plate-widths a second the near bank slides; the far bank goes the other way, slower. */
    speed?: number;
    /** How wide one tile of fog is on the plate. */
    tileW?: number;
    seed?: number;
}

/** Two banks of the baked fog tile sliding past each other behind a mask: mist that never repeats on a beat. */
export const fogDraw = ({ id, t, alpha, mask, speed = 0.006, tileW = 0.85, seed = 0 }: FogOptions): SceneFogDraw => {
    const s = t / 1000;
    const swell = 0.5 + 0.5 * Math.sin(s * 0.19 + seed);
    return {
        kind: 'fog',
        id,
        src: AMBIENT_SPRITES.fog,
        alpha,
        blend: 'lighter',
        banks: [
            { offsetX: s * speed + seed * 0.37, offsetY: 0.12 * Math.sin(s * 0.07 + seed), tileW, tileH: tileW * 0.9, alpha: 0.5 + 0.3 * swell },
            {
                offsetX: -s * speed * 0.62 + 0.41 + seed * 0.11,
                offsetY: 0.5 + 0.1 * Math.sin(s * 0.05 + 1.7 + seed),
                tileW: tileW * 1.45,
                tileH: tileW * 1.2,
                alpha: 0.65 - 0.25 * swell
            }
        ],
        mask
    };
};

interface DriftSpec {
    idPrefix: string;
    cell: AmbientCellName;
    count: number;
    /** The box the specks live in, fractions of the plate. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Plate-heights a second, positive is downward; and plate-widths a second sideways. */
    fall: number;
    slide: number;
    size: number;
    alpha: number;
    seed: number;
    blend?: SceneBlend;
}

/**
 * Specks adrift in a box: dust in a shaft of light, spores under the trees. Each wraps round the
 * box on its own slow path, fading at the edges so none pops in, and twinkles as it turns.
 */
export const driftDraws = (spec: DriftSpec, t: number): SceneImageDraw[] => {
    const s = t / 1000;
    const out: SceneImageDraw[] = [];
    for (let index = 0; index < spec.count; index += 1) {
        const a = sceneHash(index, spec.seed);
        const b = sceneHash(index, spec.seed + 1);
        const c = sceneHash(index, spec.seed + 2);
        const u = (((a + s * spec.slide * (0.6 + 0.8 * c)) % 1) + 1) % 1;
        const v = (((b + s * spec.fall * (0.6 + 0.8 * a)) % 1) + 1) % 1;
        const wander = 0.02 * Math.sin(s * (0.3 + 0.4 * c) + a * 6.28);
        const edge = Math.min(sceneSmoothstep(0, 0.15, u), sceneSmoothstep(1, 0.85, u), sceneSmoothstep(0, 0.15, v), sceneSmoothstep(1, 0.85, v));
        const twinkle = 0.55 + 0.45 * Math.sin(s * (0.7 + 1.1 * b) + c * 6.28);
        out.push(
            ambientSprite({
                id: `${spec.idPrefix}-${index}`,
                cell: spec.cell,
                x: spec.x + spec.w * u + wander,
                y: spec.y + spec.h * v,
                size: spec.size * (0.6 + 0.8 * c),
                alpha: spec.alpha * edge * twinkle,
                blend: spec.blend
            })
        );
    }
    return out;
};

interface CrossingSpec {
    id: string;
    cell: AmbientCellName;
    t: number;
    everyMs: number;
    lastsMs: number;
    seed: number;
    /** The band it crosses, fractions of the plate: start and end x, and the y range it picks a height from. */
    fromX: number;
    toX: number;
    yMin: number;
    yMax: number;
    size: number;
    alpha: number;
    /** Flipbook frames a second. */
    fps?: number;
    /** How far it bobs, as a fraction of the plate's height. */
    bob?: number;
    blend?: SceneBlend;
}

/**
 * Something that crosses the scene now and then: a bat through the vault. It picks a side and a
 * height each time, flaps on its own flipbook, and fades in and out at the ends of its path so it
 * is never seen arriving.
 */
export const crossingDraws = (spec: CrossingSpec): SceneImageDraw[] => {
    const occurrence = sceneOccurrence(spec.t, spec.everyMs, spec.lastsMs, spec.seed);
    if (!occurrence) {
        return [];
    }
    const { index, progress } = occurrence;
    const reverse = sceneHash(index, spec.seed + 5) < 0.5;
    const from = reverse ? spec.toX : spec.fromX;
    const to = reverse ? spec.fromX : spec.toX;
    const y0 = lerp(spec.yMin, spec.yMax, sceneHash(index, spec.seed + 6));
    const y1 = lerp(spec.yMin, spec.yMax, sceneHash(index, spec.seed + 7));
    const bob = (spec.bob ?? 0.012) * Math.sin(progress * Math.PI * 7 + index);
    const fade = Math.min(sceneSmoothstep(0, 0.12, progress), sceneSmoothstep(1, 0.88, progress));
    const frames = AMBIENT_SPRITES.cells[spec.cell].frames;
    return [
        ambientSprite({
            id: spec.id,
            cell: spec.cell,
            x: lerp(from, to, progress),
            y: lerp(y0, y1, progress) + bob,
            size: spec.size,
            alpha: spec.alpha * fade,
            blend: spec.blend ?? 'source-over',
            frame: Math.floor(((progress * spec.lastsMs) / 1000) * (spec.fps ?? 12)) % frames,
            scaleX: to < from ? -1 : 1
        })
    ];
};

interface GlintSpec {
    idPrefix: string;
    /** Where glints may appear, fractions of the plate. */
    points: ReadonlyArray<readonly [number, number]>;
    t: number;
    /** Each point glints about this often, and for this long. */
    everyMs: number;
    lastsMs: number;
    size: number;
    alpha: number;
    seed: number;
    cell?: AmbientCellName;
}

/** Points that catch the light for a moment and let it go: stars, runes, wet stone. */
export const glintDraws = (spec: GlintSpec): SceneImageDraw[] =>
    spec.points.flatMap(([x, y], index) => {
        const occurrence = sceneOccurrence(spec.t + sceneHash(index, spec.seed) * spec.everyMs, spec.everyMs * (0.7 + 0.6 * sceneHash(index, spec.seed + 3)), spec.lastsMs, spec.seed + index);
        if (!occurrence) {
            return [];
        }
        const swell = Math.sin(occurrence.progress * Math.PI);
        return [
            ambientSprite({
                id: `${spec.idPrefix}-${index}`,
                cell: spec.cell ?? 'glint',
                x,
                y,
                size: spec.size * (0.6 + 0.4 * swell),
                alpha: spec.alpha * swell,
                rotate: (occurrence.index % 2 === 0 ? 1 : -1) * 0.4 * occurrence.progress
            })
        ];
    });

interface DripSpec {
    idPrefix: string;
    t: number;
    everyMs: number;
    seed: number;
    /** Where drops fall: x, the height they fall from, the floor they land on. */
    spots: ReadonlyArray<readonly [number, number, number]>;
    alpha: number;
}

/** Water off the vault: a drop falls, lands, and a ring spreads on the stone and is gone. */
export const dripDraws = (spec: DripSpec): SceneDraw[] =>
    spec.spots.flatMap(([x, top, floor], index) => {
        const lastsMs = 1500;
        const occurrence = sceneOccurrence(spec.t + sceneHash(index, spec.seed) * spec.everyMs, spec.everyMs * (0.8 + 0.5 * sceneHash(index, spec.seed + 2)), lastsMs, spec.seed + index * 3);
        if (!occurrence) {
            return [];
        }
        const fallShare = 0.36;
        if (occurrence.progress < fallShare) {
            const fall = occurrence.progress / fallShare;
            return [
                ambientSprite({
                    id: `${spec.idPrefix}-drop-${index}`,
                    cell: 'drop',
                    x,
                    // Falling: slow off the stone, fast at the floor.
                    y: lerp(top, floor - 0.02, fall * fall),
                    size: 0.045,
                    alpha: spec.alpha * sceneSmoothstep(0, 0.2, fall)
                })
            ];
        }
        const spread = (occurrence.progress - fallShare) / (1 - fallShare);
        return [
            ambientSprite({
                id: `${spec.idPrefix}-ripple-${index}`,
                cell: 'ripple',
                x,
                y: floor,
                size: 0.012 + 0.05 * spread,
                alpha: spec.alpha * 0.8 * (1 - spread) ** 1.5,
                // A ring on the floor is seen edge-on: wide and flat.
                scaleX: 2.6
            })
        ];
    });
