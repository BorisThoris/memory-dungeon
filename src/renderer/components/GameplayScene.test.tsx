import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameplayScene, type GameplaySceneProps } from './GameplayScene';
import { sceneRingLevels } from './gameplaySceneLevels';

const base: GameplaySceneProps = {
    fill: 0,
    memorize: false,
    pulse: 'none',
    pulseKey: null,
    quality: 'high',
    reduceMotion: false,
    tier: 'none'
};

const layerCount = () => screen.getByTestId('gameplay-scene').children.length;

describe('GameplayScene', () => {
    it('is decoration: hidden from assistive tech, the room as data attributes', () => {
        render(<GameplayScene {...base} tier="sharp" memorize />);
        const scene = screen.getByTestId('gameplay-scene');
        expect(scene).toHaveAttribute('aria-hidden', 'true');
        expect(scene).toHaveAttribute('data-scene-tier', 'sharp');
        expect(scene).toHaveAttribute('data-memorize', 'true');
        expect(scene).toHaveAttribute('data-still', 'false');
    });

    it('warms the ring with the chain, continuously: every step of fill lifts light, glow, hue and flash', () => {
        let last = sceneRingLevels(0);
        expect(last).toEqual({ light: 0.5, glow: 0.68, hueDeg: 0, saturate: 1, pulsePeak: 0.35 });
        for (let step = 1; step <= 20; step += 1) {
            const next = sceneRingLevels(step / 20);
            expect(next.light).toBeGreaterThan(last.light);
            expect(next.glow).toBeGreaterThan(last.glow);
            expect(next.hueDeg).toBeLessThanOrEqual(last.hueDeg);
            expect(next.pulsePeak).toBeGreaterThan(last.pulsePeak);
            last = next;
        }
        expect(last).toEqual({ light: 1.3, glow: 1.4, hueDeg: -40, saturate: 1.4, pulsePeak: 1.25 });
        // Out-of-range input is clamped, never NaN in a CSS variable.
        expect(sceneRingLevels(Number.NaN)).toEqual(sceneRingLevels(0));
        expect(sceneRingLevels(4)).toEqual(sceneRingLevels(1));
        render(<GameplayScene {...base} fill={0.5} tier="clean" />);
        const scene = screen.getByTestId('gameplay-scene');
        const style = scene.getAttribute('style') ?? '';
        expect(scene).toHaveAttribute('data-scene-fill', '0.50');
        expect(style).toContain(`--scene-ring-light: ${sceneRingLevels(0.5).light}`);
        expect(style).toContain(`--scene-ring-hue: ${sceneRingLevels(0.5).hueDeg}deg`);
        expect(style).toContain(`--scene-pulse-peak: ${sceneRingLevels(0.5).pulsePeak}`);
    });

    it('keeps the torches burning whatever the chain does', () => {
        const torchesAt = (fill: number) => {
            const { unmount } = render(<GameplayScene {...base} fill={fill} />);
            const scene = screen.getByTestId('gameplay-scene');
            const torches = [...scene.children].filter((el) => /torch/i.test(el.className)).map((el) => el.getAttribute('style'));
            unmount();
            return torches;
        };
        expect(torchesAt(0)).toHaveLength(3);
        expect(torchesAt(0)).toEqual(torchesAt(1));
    });

    it('flashes the floor on a break and restarts for a second break of the same tier', () => {
        const { rerender } = render(<GameplayScene {...base} pulse="none" />);
        expect(screen.queryByTestId('gameplay-scene-pulse')).toBeNull();
        rerender(<GameplayScene {...base} pulse="clean" pulseKey="turn-1" />);
        const first = screen.getByTestId('gameplay-scene-pulse');
        rerender(<GameplayScene {...base} pulse="clean" pulseKey="turn-2" />);
        const second = screen.getByTestId('gameplay-scene-pulse');
        expect(second).not.toBe(first);
        expect(screen.getByTestId('gameplay-scene')).toHaveAttribute('data-scene-pulse', 'clean');
    });

    it('drops the rendered light passes on low quality and keeps the glows', () => {
        const { unmount } = render(<GameplayScene {...base} quality="high" pulse="pop" pulseKey="t" />);
        const full = layerCount();
        unmount();
        render(<GameplayScene {...base} quality="low" pulse="pop" pulseKey="t" />);
        // base + three glows; the three light passes and the pulse are gone.
        expect(layerCount()).toBe(4);
        expect(full).toBe(8);
        expect(screen.queryByTestId('gameplay-scene-pulse')).toBeNull();
    });

    it('holds still under reduce motion', () => {
        render(<GameplayScene {...base} reduceMotion />);
        expect(screen.getByTestId('gameplay-scene')).toHaveAttribute('data-still', 'true');
    });
});
