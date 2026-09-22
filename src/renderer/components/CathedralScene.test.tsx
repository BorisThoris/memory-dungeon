import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { CathedralScene } from './CathedralScene';
import { sceneSpriteClocks, sceneSpriteEmbers } from './sceneSpriteClocks';

describe('CathedralScene', () => {
    it('is decoration: the nave as a base, two lights and every candle flame cut out as a sprite', () => {
        render(<CathedralScene quality="high" reduceMotion={false} />);
        const scene = screen.getByTestId('cathedral-scene');
        expect(scene).toHaveAttribute('aria-hidden', 'true');
        expect(scene).toHaveAttribute('data-alive', 'true');
        const plate = screen.getByTestId('cathedral-scene-plate');
        expect([...plate.children].filter((el) => /base|layer/i.test(el.className))).toHaveLength(4);
        const sprites = screen.getByTestId('scene-sprites');
        expect(sprites).toHaveAttribute('data-sprite-kind', 'candle');
        const flames = sprites.querySelectorAll('[data-sprite-id]');
        expect(flames.length).toBe(SCENE_SPRITES.cathedralCandles.sprites.length);
        expect(flames.length).toBeGreaterThanOrEqual(24);
        for (const flame of flames) {
            const style = (flame as HTMLElement).style;
            // Every candle stands on the nave floor's half of the plate, inside it.
            expect(parseFloat(style.top)).toBeGreaterThan(40);
            expect(parseFloat(style.top) + parseFloat(style.height)).toBeLessThanOrEqual(100);
            expect(parseFloat(style.left) + parseFloat(style.width)).toBeLessThanOrEqual(100);
        }
        // Candles do not throw sparks; the spirit-light climbs the arch as motes.
        expect(screen.queryAllByTestId('scene-embers')).toHaveLength(0);
        const motes = [...screen.getByTestId('cathedral-scene-motes').children] as HTMLElement[];
        expect(motes).toHaveLength(10);
        for (const mote of motes) {
            const x = parseFloat(mote.style.left);
            expect(x > 30 && x < 44 ? true : x > 62 && x < 76).toBe(true);
        }
    });

    it('mourns at the run end: the mood is on the scene for the stylesheet to sink the candlelight', () => {
        const { unmount } = render(<CathedralScene quality="high" reduceMotion={false} />);
        expect(screen.getByTestId('cathedral-scene')).toHaveAttribute('data-mood', 'menu');
        unmount();
        render(<CathedralScene mood="ended" quality="high" reduceMotion={false} />);
        expect(screen.getByTestId('cathedral-scene')).toHaveAttribute('data-mood', 'ended');
        // The candles still burn: the end of a run is quiet, not dark.
        expect(screen.getByTestId('scene-sprites').querySelectorAll('[data-sprite-id]').length).toBeGreaterThan(20);
    });

    it('lights the nave a run ends in by how hot that run got', () => {
        const navesAt = (heat: number | null) => {
            const { unmount } = render(
                <CathedralScene heat={heat} mood="ended" quality="high" reduceMotion={false} />
            );
            const scene = screen.getByTestId('cathedral-scene');
            const rate = Number(screen.getByTestId('scene-sprites').style.getPropertyValue('--flame-rate'));
            const marker = scene.getAttribute('data-scene-heat');
            unmount();
            return { rate, marker };
        };
        const cold = navesAt(0);
        const hot = navesAt(1);
        // A run that never chained ends on guttering candles; one that hit Fever ends alight.
        expect(hot.rate).toBeGreaterThan(cold.rate);
        expect(cold.marker).toBe('0.00');
        expect(hot.marker).toBe('1.00');
    });

    it('leaves the menu nave alone: no run behind it, so the candles are the ones painted', () => {
        render(<CathedralScene quality="high" reduceMotion={false} />);
        // Not "cold" — absent. A menu that declared a resting heat would quietly dim itself, and a
        // player who has never pressed Play has no run for the room to be reporting on.
        expect(screen.getByTestId('cathedral-scene')).toHaveAttribute('data-scene-heat', 'none');
        expect(screen.getByTestId('scene-sprites').style.getPropertyValue('--flame-rate')).toBe('');
    });

    it('holds still under reduce motion and drops the drift on low quality', () => {
        const { unmount } = render(<CathedralScene quality="high" reduceMotion />);
        expect(screen.getByTestId('cathedral-scene')).toHaveAttribute('data-still', 'true');
        expect(screen.getByTestId('scene-sprites')).toHaveAttribute('data-still', 'true');
        unmount();
        render(<CathedralScene quality="low" reduceMotion={false} />);
        expect(screen.getByTestId('cathedral-scene')).toHaveAttribute('data-alive', 'false');
        expect(screen.getByTestId('cathedral-scene')).toHaveAttribute('data-scene-effect-tier', 'lean');
        expect(screen.queryByTestId('cathedral-scene-motes')).toBeNull();
        expect(screen.getByTestId('scene-sprites')).toHaveAttribute('data-still', 'false');
    });
});

describe('sceneSpriteClocks', () => {
    it('gives every sprite its own period near the sheet\'s own and a start somewhere inside its loop', () => {
        const sprite = { frames: 16, fps: 14 };
        const loop = (1000 / 14) * 16;
        const clocks = Array.from({ length: 12 }, (_, i) => sceneSpriteClocks(sprite, i));
        expect(new Set(clocks.map((c) => c.durationMs)).size).toBe(12);
        for (const clock of clocks) {
            expect(clock.durationMs).toBeGreaterThanOrEqual(loop * 0.9 - 1);
            expect(clock.durationMs).toBeLessThanOrEqual(loop * 1.1 + 1);
            expect(clock.delayMs).toBeLessThanOrEqual(0);
            expect(-clock.delayMs).toBeLessThan(clock.durationMs);
        }
        // Deterministic: the same index is the same clock on every render.
        expect(sceneSpriteClocks(sprite, 3)).toEqual(sceneSpriteClocks(sprite, 3));
    });

    it('throws more sparks from a big flame than a far one', () => {
        expect(sceneSpriteEmbers({ h: 0.16 }, 0)).toHaveLength(4);
        expect(sceneSpriteEmbers({ h: 0.1 }, 1)).toHaveLength(3);
        expect(sceneSpriteEmbers({ h: 0.05 }, 2)).toHaveLength(2);
        for (const ember of sceneSpriteEmbers({ h: 0.16 }, 5)) {
            expect(ember.x).toBeGreaterThanOrEqual(20);
            expect(ember.x).toBeLessThanOrEqual(80);
            expect(Math.abs(ember.driftPx)).toBeLessThanOrEqual(12);
            expect(-ember.delayMs).toBeLessThan(ember.durationMs);
        }
    });
});
