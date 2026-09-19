import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameplayScene, type GameplaySceneProps } from './GameplayScene';
import { SCENE_RING_LEVELS } from './gameplaySceneLevels';

const base: GameplaySceneProps = {
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

    it('sets the ring to the tier: each tier lifts both the floor light and the glow', () => {
        const tiers = ['none', 'clean', 'sharp', 'fever'] as const;
        let lastLight = -1;
        let lastGlow = -1;
        for (const tier of tiers) {
            const [light, glow] = SCENE_RING_LEVELS[tier];
            expect(light).toBeGreaterThan(lastLight);
            expect(glow).toBeGreaterThan(lastGlow);
            lastLight = light;
            lastGlow = glow;
        }
        render(<GameplayScene {...base} tier="fever" />);
        const style = screen.getByTestId('gameplay-scene').getAttribute('style') ?? '';
        expect(style).toContain(`--scene-ring-light: ${SCENE_RING_LEVELS.fever[0]}`);
        expect(style).toContain(`--scene-ring-glow: ${SCENE_RING_LEVELS.fever[1]}`);
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
