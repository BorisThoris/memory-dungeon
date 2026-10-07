import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { GameplayScene, type GameplaySceneProps } from './GameplayScene';
import { sceneFlameLevels, sceneRingLevels, sceneTorchFlarePeak } from './gameplaySceneLevels';
import sharedPlate from './scenePlate.module.css';
import sceneStyles from './GameplayScene.module.css';

const base: GameplaySceneProps = {
    fill: 0,
    memorize: false,
    pulse: 'none',
    pulseKey: null,
    quality: 'high',
    reduceMotion: false,
    tier: 'none'
};

/**
 * The component: the plate, the one canvas, and the room's state on the root. What is painted in
 * the canvas for a given state is `composeGameplayScene`'s, tested in `gameplaySceneFrame.test.ts`.
 */
describe('GameplayScene', () => {
    it('is one canvas in the shared plate, the size the room was painted at', () => {
        render(<GameplayScene {...base} />);
        const plate = screen.getByTestId('gameplay-scene-plate');
        expect(plate).toHaveClass(sharedPlate.plate, sceneStyles.plate);
        const canvas = screen.getByTestId('gameplay-scene-canvas') as HTMLCanvasElement;
        expect(canvas.parentElement).toBe(plate);
        expect(canvas).toHaveClass(sharedPlate.canvas);
        expect([canvas.width, canvas.height]).toEqual([...SCENE_SPRITES.gameplayFlames.plate]);
        // At rest nothing else is in the plate: no element per light for a compositor to blend.
        expect(plate.children).toHaveLength(1);
        expect(plate.querySelectorAll('img')).toHaveLength(0);
    });

    it('is decoration: hidden from assistive tech, the room as data attributes', () => {
        render(<GameplayScene {...base} tier="sharp" memorize />);
        const scene = screen.getByTestId('gameplay-scene');
        expect(scene).toHaveAttribute('aria-hidden', 'true');
        expect(scene).toHaveAttribute('data-scene-tier', 'sharp');
        expect(scene).toHaveAttribute('data-memorize', 'true');
        expect(scene).toHaveAttribute('data-still', 'false');
    });

    it('puts the ring\'s answer to the chain on the root, every step of the way', () => {
        let last = sceneRingLevels(0);
        expect(last).toEqual({ light: 0.5, glow: 0.68, hueDeg: 0, saturate: 1, pulsePeak: 0.35, motes: 0 });
        for (let step = 1; step <= 20; step += 1) {
            const next = sceneRingLevels(step / 20);
            expect(next.light).toBeGreaterThan(last.light);
            expect(next.glow).toBeGreaterThan(last.glow);
            expect(next.hueDeg).toBeLessThanOrEqual(last.hueDeg);
            expect(next.pulsePeak).toBeGreaterThan(last.pulsePeak);
            expect(next.motes).toBeGreaterThan(last.motes);
            last = next;
        }
        expect(last).toEqual({ light: 1.3, glow: 1.4, hueDeg: -40, saturate: 1.4, pulsePeak: 1.25, motes: 1 });
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
        expect(style).toContain(`--scene-motes-opacity: ${sceneRingLevels(0.5).motes}`);
    });

    it('puts the fire\'s answer on the root too, and says when it is drawing breath', () => {
        const read = (fill: number, imminent = false) => {
            const { unmount } = render(<GameplayScene {...base} fill={fill} imminent={imminent} />);
            const scene = screen.getByTestId('gameplay-scene');
            const out = {
                rate: Number(scene.style.getPropertyValue('--flame-rate')),
                lift: Number(scene.style.getPropertyValue('--flame-lift')),
                embers: Number(scene.style.getPropertyValue('--flame-embers')),
                drawing: scene.getAttribute('data-scene-drawing')
            };
            unmount();
            return out;
        };
        expect(read(0)).toMatchObject({ ...pick(sceneFlameLevels(0)), drawing: 'false' });
        expect(read(1).rate).toBeGreaterThan(read(0).rate);
        expect(read(1).lift).toBeGreaterThan(read(0).lift);
        expect(read(0.6, true).drawing).toBe('true');
        expect(read(0.6, true).lift).toBeLessThan(read(0.6).lift);
    });

    it('carries a break on the root: the tier that broke and how hard the torches flare for it', () => {
        const { rerender } = render(<GameplayScene {...base} pulse="none" />);
        const scene = screen.getByTestId('gameplay-scene');
        expect(scene).toHaveAttribute('data-scene-pulse', 'none');
        expect(scene.style.getPropertyValue('--scene-flare-peak')).toBe('0');
        let last = 0;
        for (const pulse of ['pop', 'clean', 'sharp', 'fever'] as const) {
            rerender(<GameplayScene {...base} pulse={pulse} pulseKey={`turn-${pulse}`} />);
            expect(scene).toHaveAttribute('data-scene-pulse', pulse);
            const peak = Number(scene.style.getPropertyValue('--scene-flare-peak'));
            expect(peak).toBe(sceneTorchFlarePeak(pulse));
            expect(peak).toBeGreaterThan(last);
            last = peak;
        }
    });

    it('keeps the storm and the payout in the canvas too: on the root as data, not as elements over the room', () => {
        render(<GameplayScene {...base} />);
        const scene = screen.getByTestId('gameplay-scene');
        expect(scene).toHaveAttribute('data-scene-storm-bolts', '0');
        expect(scene).toHaveAttribute('data-scene-gold-rain', 'none');
        expect(scene.querySelectorAll('svg')).toHaveLength(0);
    });

    it('says when the floor is cleared', () => {
        const { rerender } = render(<GameplayScene {...base} />);
        expect(screen.getByTestId('gameplay-scene')).toHaveAttribute('data-cleared', 'false');
        rerender(<GameplayScene {...base} cleared />);
        expect(screen.getByTestId('gameplay-scene')).toHaveAttribute('data-cleared', 'true');
    });

    it('holds still under reduce motion and holds the plate still on a phone or at low quality', () => {
        const { rerender } = render(<GameplayScene {...base} reduceMotion />);
        const scene = screen.getByTestId('gameplay-scene');
        expect(scene).toHaveAttribute('data-still', 'true');
        expect(scene).toHaveAttribute('data-alive', 'false');
        expect(scene).toHaveAttribute('data-scene-effect-tier', 'still');
        rerender(<GameplayScene {...base} quality="low" />);
        expect(scene).toHaveAttribute('data-still', 'false');
        expect(scene).toHaveAttribute('data-alive', 'false');
        expect(scene).toHaveAttribute('data-scene-effect-tier', 'lean');
        rerender(<GameplayScene {...base} quality="high" />);
        expect(scene).toHaveAttribute('data-alive', 'true');
        expect(scene).toHaveAttribute('data-scene-effect-tier', 'full');
    });

    it('goes lean on a phone whatever the preset', () => {
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            matches: query.includes('coarse'),
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false
        })) as typeof window.matchMedia;
        try {
            render(<GameplayScene {...base} quality="high" />);
            const scene = screen.getByTestId('gameplay-scene');
            expect(scene).toHaveAttribute('data-scene-effect-tier', 'lean');
            expect(scene).toHaveAttribute('data-alive', 'false');
            // The same single canvas: a phone gets the room, not a cut-down stack of it.
            expect(screen.getByTestId('gameplay-scene-plate').children).toHaveLength(1);
        } finally {
            window.matchMedia = original;
        }
    });
});

const pick = (levels: ReturnType<typeof sceneFlameLevels>) => ({ rate: levels.rate, lift: levels.lift, embers: levels.embers });
