import { describe, expect, it } from 'vitest';
import type { TileSuit } from '../../shared/contracts';
import { emitRoomSpill, ROOM_SPILL_SECONDS, roomSpillDraws, subscribeRoomSpill } from './roomSpill';
import type { SceneImageDraw, SceneLineDraw } from './scenePaint';

const band = { far: 0.66, near: 0.97, horizon: 0.45, focal: 2.75 };
const yOf = (draw: SceneImageDraw | SceneLineDraw): number =>
    draw.kind === 'line' ? Math.max(draw.points[0]![1], draw.points[1]![1]) : draw.rect!.y + draw.rect!.h / 2;

describe('what a breaking card spills into the room', () => {
    it('lets leaves flatten and turn into rest without snapping at contact', () => {
        let previous = new Map<string, SceneImageDraw>();
        for (let frame = 1; frame <= 960; frame++) {
            const draws = roomSpillDraws({ key: 'settling', suit: 'moss', x: .5, y: .45, seconds: frame / 240 }, band, false, false) as SceneImageDraw[];
            for (const draw of draws) {
                const old = previous.get(draw.id!);
                if (!old) continue;
                expect(Math.abs((draw.rotate ?? 0) - (old.rotate ?? 0))).toBeLessThan(.1);
                expect(Math.abs((draw.scaleY ?? 1) - (old.scaleY ?? 1))).toBeLessThan(.02);
            }
            previous = new Map(draws.map(draw => [draw.id!, draw]));
        }
        expect([...previous.values()].every(draw => draw.scaleY === .55)).toBe(true);
    });

    it('brings resting ice glints in and out continuously', () => {
        let previous = new Map<string, number>();
        let peak = 0;
        for (let frame = 1; frame <= 1200; frame++) {
            const draws = roomSpillDraws({ key: 'glinting', suit: 'bone', x: .5, y: .45, seconds: frame / 240 }, band, false, false);
            const glints = new Map(draws.filter(draw => draw.id?.endsWith('-glint')).map(draw => [draw.id!, draw.alpha]));
            for (const [id, alpha] of glints) {
                expect(Math.abs(alpha - (previous.get(id) ?? 0))).toBeLessThan(.035);
                peak = Math.max(peak, alpha);
            }
            previous = glints;
        }
        expect(peak).toBeGreaterThan(.2);
    });

    it('throws each element\'s material out to land on the floor, and lets it go', () => {
        for (const suit of ['ember', 'tide', 'bone', 'moss', null] as Array<TileSuit | null>) {
            const spill = (seconds: number) => roomSpillDraws({ key: `k-${suit}`, suit, x: 0.5, y: 0.45, seconds }, band, false, false);
            // In the air early, below where it started.
            const early = spill(0.25).filter((draw) => draw.kind === 'image' || draw.kind === 'line') as Array<SceneImageDraw | SceneLineDraw>;
            expect(early.length, String(suit)).toBeGreaterThan(3);
            // Later everything is on the floor band (never below its near edge).
            const later = spill(3).filter((draw) => (draw.kind === 'image' || draw.kind === 'line') && draw.alpha > 0.02) as Array<SceneImageDraw | SceneLineDraw>;
            for (const draw of later) {
                expect(yOf(draw), `${suit} ${draw.id}`).toBeLessThanOrEqual(band.near + 0.03);
                expect(yOf(draw), `${suit} ${draw.id}`).toBeGreaterThan(0.45);
            }
            // And it is gone when its time is up.
            expect(spill(ROOM_SPILL_SECONDS + 0.1)).toHaveLength(0);
            // A phone gets half the pieces.
            const lean = roomSpillDraws({ key: `k-${suit}`, suit, x: 0.5, y: 0.45, seconds: 0.25 }, band, false, true).length;
            expect(lean, String(suit)).toBeLessThan(early.length);
        }
    });

    it('carries a break from the board to the room', () => {
        const heard: string[] = [];
        const stop = subscribeRoomSpill((event) => heard.push(event.key));
        emitRoomSpill({ key: 'card-1', suit: 'ember', screenX: 10, screenY: 20, delayMs: 0 });
        stop();
        emitRoomSpill({ key: 'card-2', suit: 'ember', screenX: 10, screenY: 20, delayMs: 0 });
        expect(heard).toEqual(['card-1']);
    });
});
