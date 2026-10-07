import { describe, expect, it } from 'vitest';
import { findSceneDraw, paintScene, sceneDrawIds, SCENE_DEPTH_SHIFT_X, type SceneDraw, type ScenePaintContext, type ScenePaintEnv } from './scenePaint';

/** A context that writes down what it was asked to do. */
const recorder = () => {
    const calls: Array<{ op: string; args: unknown[]; alpha: number; blend: string }> = [];
    const gradient = { addColorStop: () => undefined };
    const state = { globalAlpha: 1, globalCompositeOperation: 'source-over' as GlobalCompositeOperation, fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 1, lineJoin: 'miter' as CanvasLineJoin, lineCap: 'butt' as CanvasLineCap };
    const record =
        (op: string) =>
        (...args: unknown[]) => {
            calls.push({ op, args, alpha: state.globalAlpha, blend: state.globalCompositeOperation });
            return gradient;
        };
    const context = Object.assign(state, {
        clearRect: record('clearRect'),
        drawImage: record('drawImage'),
        setTransform: record('setTransform'),
        fillRect: record('fillRect'),
        createRadialGradient: record('createRadialGradient'),
        createLinearGradient: record('createLinearGradient'),
        beginPath: record('beginPath'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        stroke: record('stroke'),
        rect: record('rect'),
        clip: record('clip'),
        save: record('save'),
        restore: record('restore')
    }) as unknown as ScenePaintContext;
    return { context, calls, draws: () => calls.filter((call) => call.op === 'drawImage') };
};

const image = { image: {} as CanvasImageSource, width: 200, height: 100 };
const env = (over: Partial<ScenePaintEnv> = {}): ScenePaintEnv => ({ width: 1000, height: 500, image: () => image, lookX: 0, lookY: 0, ...over });

describe('paintScene', () => {
    it('paints a layer over the whole canvas at its strength, adding light and covering with paint', () => {
        const { context, draws } = recorder();
        const made = paintScene(
            context,
            [
                { kind: 'image', id: 'base', src: 'base', alpha: 0.4 },
                { kind: 'image', id: 'glow', src: 'glow', alpha: 0.75, blend: 'lighter' }
            ],
            env()
        );
        expect(made).toBe(2);
        expect(draws()).toHaveLength(2);
        expect(draws()[0]).toMatchObject({ alpha: 0.4, blend: 'source-over', args: [image.image, 0, 0, 200, 100, 0, 0, 1000, 500] });
        expect(draws()[1]).toMatchObject({ alpha: 0.75, blend: 'lighter' });
    });

    it('makes no draw for a layer nobody could see, and none for an image that has not loaded', () => {
        const { context, draws } = recorder();
        const list: SceneDraw[] = [
            { kind: 'image', id: 'dark', src: 'a', alpha: 0 },
            { kind: 'image', id: 'faint', src: 'a', alpha: 0.003 },
            { kind: 'image', id: 'nan', src: 'a', alpha: Number.NaN },
            { kind: 'image', id: 'missing', src: 'missing', alpha: 1 },
            { kind: 'image', id: 'there', src: 'a', alpha: 1 }
        ];
        const made = paintScene(context, list, env({ image: (src) => (src === 'missing' ? null : image) }));
        expect(made).toBe(1);
        expect(draws()).toHaveLength(1);
        expect(sceneDrawIds(list)).toEqual(['missing', 'there']);
    });

    it('never asks the canvas for more than full strength or less than none', () => {
        const { context, draws } = recorder();
        paintScene(context, [{ kind: 'image', id: 'hot', src: 'a', alpha: 1.6, blend: 'lighter' }], env());
        expect(draws()[0]!.alpha).toBe(1);
    });

    it('steps a flipbook by cropping one frame out of the strip', () => {
        const { context, draws } = recorder();
        paintScene(
            context,
            [
                { kind: 'image', id: 'f', src: 'a', alpha: 1, rect: { x: 0.1, y: 0.2, w: 0.05, h: 0.1 }, frame: { index: 3, count: 4 } },
                { kind: 'image', id: 'wrap', src: 'a', alpha: 1, frame: { index: 5, count: 4 } }
            ],
            env()
        );
        // Four frames across a 200px strip: frame 3 starts at 150 and is 50 wide.
        expect(draws()[0]!.args).toEqual([image.image, 150, 0, 50, 100, 100, 100, 50, 50]);
        // An index past the end wraps instead of sampling outside the sheet.
        expect(draws()[1]!.args.slice(1, 5)).toEqual([50, 0, 50, 100]);
    });

    it('scales a flame about its foot and puts the transform back afterwards', () => {
        const { context, calls } = recorder();
        paintScene(context, [{ kind: 'image', id: 'flame', src: 'a', alpha: 1, rect: { x: 0.5, y: 0.5, w: 0.1, h: 0.2 }, scaleY: 1.5, originX: 0.5, originY: 1 }], env());
        const transforms = calls.filter((call) => call.op === 'setTransform').map((call) => call.args);
        // The origin is the middle of the box's bottom edge: (500 + 50, 250 + 100).
        expect(transforms).toContainEqual([1, 0, -0, 1.5, 550, 350]);
        expect(transforms[transforms.length - 1]).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it('turns the things in the room further than the walls when the player looks', () => {
        const { context, draws } = recorder();
        paintScene(
            context,
            [
                { kind: 'image', id: 'wall', src: 'a', alpha: 1 },
                { kind: 'image', id: 'thing', src: 'a', alpha: 1, depth: 1 }
            ],
            env({ lookX: 1 })
        );
        expect(draws()[0]!.args[5]).toBe(0);
        expect(draws()[1]!.args[5]).toBeCloseTo(-SCENE_DEPTH_SHIFT_X * 1000, 6);
    });

    it('clips to the part of the plate the screen shows, and only when part of it is hidden', () => {
        const whole = recorder();
        paintScene(whole.context, [{ kind: 'image', id: 'a', src: 'a', alpha: 1 }], env({ visible: { x: 0, y: 0, w: 1, h: 1 } }));
        expect(whole.calls.some((call) => call.op === 'clip')).toBe(false);

        const phone = recorder();
        paintScene(phone.context, [{ kind: 'image', id: 'a', src: 'a', alpha: 1 }], env({ visible: { x: 0.3, y: 0, w: 0.4, h: 1 } }));
        expect(phone.calls.find((call) => call.op === 'rect')!.args).toEqual([300, 0, 400, 500]);
        expect(phone.calls.map((call) => call.op)).toEqual(expect.arrayContaining(['save', 'clip', 'restore']));
    });

    it('builds fog in the spare canvas, masks it there, and adds the result to the room once', () => {
        const main = recorder();
        const spare = recorder();
        const made = paintScene(
            main.context,
            [
                {
                    kind: 'fog',
                    id: 'mist',
                    src: 'fog',
                    alpha: 0.5,
                    banks: [
                        { offsetX: 0.25, offsetY: 0, tileW: 1, tileH: 1, alpha: 0.6 },
                        { offsetX: -0.4, offsetY: 0.5, tileW: 1.5, tileH: 1.2, alpha: 0.4 }
                    ],
                    mask: { kind: 'band', top: 0.5, solidFrom: 0.7, solidTo: 0.9, bottom: 1 }
                }
            ],
            env({ scratch: () => ({ canvas: {} as CanvasImageSource, context: spare.context, width: 250, height: 125 }) })
        );
        expect(made).toBe(1);
        // Tiles enough to cover the spare canvas from a slid start, all of them added together.
        expect(spare.draws().length).toBeGreaterThanOrEqual(3);
        expect(spare.draws().every((call) => call.blend === 'lighter')).toBe(true);
        // The mask keeps only what is inside it.
        expect(spare.calls.find((call) => call.op === 'fillRect')!.blend).toBe('destination-in');
        // One draw onto the room, at the fog's strength, as light.
        expect(main.draws()).toHaveLength(1);
        expect(main.draws()[0]).toMatchObject({ alpha: 0.5, blend: 'lighter' });
    });

    it('skips fog when there is nowhere to build it rather than drawing it unmasked', () => {
        const { context, draws } = recorder();
        const made = paintScene(
            context,
            [{ kind: 'fog', id: 'mist', src: 'fog', alpha: 0.5, banks: [], mask: { kind: 'ellipse', cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.3, solid: 0.3 } }],
            env()
        );
        expect(made).toBe(0);
        expect(draws()).toHaveLength(0);
    });

    it('leaves the canvas as it found it: full strength, covering', () => {
        const { context } = recorder();
        paintScene(context, [{ kind: 'glow', id: 'g', alpha: 0.5, blend: 'screen', cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5, stops: [[0, '#fff'], [1, 'transparent']] }], env());
        expect(context.globalAlpha).toBe(1);
        expect(context.globalCompositeOperation).toBe('source-over');
    });

    it('strokes a line through its points, rounded, and none through fewer than two', () => {
        const { context, calls } = recorder();
        const made = paintScene(
            context,
            [
                { kind: 'line', id: 'bolt', alpha: 0.8, blend: 'screen', points: [[0.1, 0.1], [0.2, 0.4], [0.15, 0.8]], color: '#fff', width: 0.004 },
                { kind: 'line', id: 'dot', alpha: 1, points: [[0.5, 0.5]], color: '#fff', width: 0.004 }
            ],
            env()
        );
        expect(made).toBe(1);
        expect(calls.filter((call) => call.op === 'moveTo').map((call) => call.args)).toEqual([[100, 50]]);
        expect(calls.filter((call) => call.op === 'lineTo').map((call) => call.args)).toEqual([[200, 200], [150, 400]]);
        expect(calls.find((call) => call.op === 'stroke')).toMatchObject({ alpha: 0.8, blend: 'screen' });
        expect(context.lineWidth).toBe(2);
        expect(context.lineJoin).toBe('round');
    });

    it('finds a draw by what it is', () => {
        const list: SceneDraw[] = [
            { kind: 'image', id: 'ringGlow', src: 'a', alpha: 0.5 },
            { kind: 'glow', id: 'peril', alpha: 1, cx: 0, cy: 0, rx: 1, ry: 1, stops: [] }
        ];
        expect(findSceneDraw(list, 'ringGlow')?.alpha).toBe(0.5);
        expect(findSceneDraw(list, 'peril', 'glow')?.kind).toBe('glow');
        expect(findSceneDraw(list, 'nothing')).toBeUndefined();
    });
});
