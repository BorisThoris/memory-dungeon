import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SceneCanvas } from './SceneCanvas';
import { SCENE_CANVAS_MAX_SCALE, SCENE_FPS_FULL, SCENE_FPS_LEAN, sceneCanvasScale, visiblePlateRect } from './sceneCanvasLayout';
import plate from './scenePlate.module.css';

describe('SceneCanvas', () => {
    it('is one canvas the size of the art, whatever the screen', () => {
        render(<SceneCanvas compose={() => []} plate={[1376, 768]} still={false} testId="c" />);
        const canvas = screen.getByTestId('c') as HTMLCanvasElement;
        expect(canvas.tagName).toBe('CANVAS');
        expect(canvas.width).toBe(1376);
        expect(canvas.height).toBe(768);
        expect(canvas).toHaveClass(plate.canvas);
    });

    it('mounts and unmounts cleanly where there is no canvas to draw on', () => {
        // The test DOM has no 2D context. A device that refuses one must get a page, not an error.
        const { unmount, rerender } = render(<SceneCanvas compose={() => []} plate={[1376, 768]} still />);
        rerender(<SceneCanvas compose={() => []} fps={SCENE_FPS_LEAN} plate={[1376, 768]} still={false} />);
        expect(() => unmount()).not.toThrow();
    });

    it('paints a painting at a painting\'s pace', () => {
        expect(SCENE_FPS_FULL).toBeLessThanOrEqual(30);
        expect(SCENE_FPS_LEAN).toBeLessThan(SCENE_FPS_FULL);
        expect(SCENE_FPS_LEAN).toBeGreaterThanOrEqual(20);
    });
});

describe('visiblePlateRect', () => {
    it('is the whole plate when the plate just covers the screen', () => {
        const rect = visiblePlateRect({ left: 0, top: 0, width: 1920, height: 1072 }, { left: 0, top: 0, width: 1920, height: 1072 });
        expect(rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    });

    it('is the middle strip on a phone held upright, with a margin for the drift', () => {
        // A 412x915 screen: the plate covers by height, 1639px wide, centred.
        const plateWidth = 915 * (1376 / 768);
        const rect = visiblePlateRect({ left: 0, top: 0, width: 412, height: 915 }, { left: (412 - plateWidth) / 2, top: 0, width: plateWidth, height: 915 });
        expect(rect.y).toBe(0);
        expect(rect.h).toBe(1);
        // About a quarter of the plate is on screen; with the margin, under two fifths is painted.
        expect(rect.w).toBeGreaterThan(412 / plateWidth);
        expect(rect.w).toBeLessThan(0.4);
        expect(rect.x + rect.w / 2).toBeCloseTo(0.5, 6);
    });

    it('paints everything rather than nothing when it cannot measure', () => {
        const all = { x: 0, y: 0, w: 1, h: 1 };
        expect(visiblePlateRect({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 100, height: 100 })).toEqual(all);
        expect(visiblePlateRect({ left: 0, top: 0, width: 100, height: 100 }, { left: 0, top: 0, width: 0, height: 0 })).toEqual(all);
        // A scene scrolled wholly off the plate.
        expect(visiblePlateRect({ left: 5000, top: 0, width: 100, height: 100 }, { left: 0, top: 0, width: 100, height: 100 })).toEqual(all);
    });
});

describe('sceneCanvasScale', () => {
    it('gives the canvas as many pixels as the screen shows of the plate, between the painting and the cap', () => {
        // A phone or a small window: the painting's own pixels.
        expect(sceneCanvasScale(412, 1, 1376, SCENE_CANVAS_MAX_SCALE)).toBe(1);
        // 1080p: the plate is shown 1935 wide, so 1.4 canvas pixels to each of the painting's.
        expect(sceneCanvasScale(1935, 1, 1376, SCENE_CANVAS_MAX_SCALE)).toBe(1.4);
        // 1440p, 4K and a HiDPI laptop all stop at the cap: the masters have nothing more to show.
        expect(sceneCanvasScale(2580, 1, 1376, SCENE_CANVAS_MAX_SCALE)).toBe(SCENE_CANVAS_MAX_SCALE);
        expect(sceneCanvasScale(1450, 2, 1376, SCENE_CANVAS_MAX_SCALE)).toBe(SCENE_CANVAS_MAX_SCALE);
        // The lean tier asks for none, and nothing measured is no reason to grow.
        expect(sceneCanvasScale(2580, 2, 1376, 1)).toBe(1);
        expect(sceneCanvasScale(0, 2, 1376, SCENE_CANVAS_MAX_SCALE)).toBe(1);
        // The drift's few percent does not resize the surface.
        expect(sceneCanvasScale(1935 * 1.03, 1, 1376, SCENE_CANVAS_MAX_SCALE)).toBe(1.4);
    });
});
