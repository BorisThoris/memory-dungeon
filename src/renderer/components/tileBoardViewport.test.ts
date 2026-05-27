import { describe, expect, it, vi } from 'vitest';
import {
    DESKTOP_STAGE_FIT_MARGIN,
    clampBoardViewport,
    createRafCoalescedViewportNotifier,
    getBoardFitZoom,
    MOBILE_CAMERA_FIT_MARGIN,
    screenPointToWorld,
    type TileBoardScreenPoint
} from './tileBoardViewport';

describe('tileBoardViewport', () => {
    it('screenPointToWorld scales linearly with viewport dimensions (stable normalized ray)', () => {
        const point: TileBoardScreenPoint = { clientX: 110, clientY: 90 };
        const rect = { left: 10, top: 20, width: 200, height: 100 };

        const a = screenPointToWorld(point, rect, 400, 300);
        const b = screenPointToWorld(point, rect, 800, 600);

        expect(a.panX / 400).toBeCloseTo(b.panX / 800, 8);
        expect(a.panY / 300).toBeCloseTo(b.panY / 600, 8);
    });

    it('createRafCoalescedViewportNotifier coalesces bursts to one flush per animation frame', () => {
        const rafQueue: FrameRequestCallback[] = [];
        let nextRafId = 1;
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
            rafQueue.push(cb);
            return nextRafId++;
        });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        const flushed: Array<{ w: number; h: number }> = [];
        const n = createRafCoalescedViewportNotifier((w, h) => {
            flushed.push({ w, h });
        });

        n.schedule(100, 50);
        n.schedule(200, 60);
        n.schedule(300, 70);

        expect(flushed).toHaveLength(0);
        expect(rafQueue).toHaveLength(1);

        rafQueue[0]!(0);

        expect(flushed).toEqual([{ w: 300, h: 70 }]);

        vi.unstubAllGlobals();
    });

    it('REG-001 keeps mobile camera fit board-first on phone portrait', () => {
        const zoom = getBoardFitZoom({
            boardHeight: 640,
            boardWidth: 360,
            margin: MOBILE_CAMERA_FIT_MARGIN,
            viewportHeight: 740,
            viewportWidth: 360
        });

        expect(MOBILE_CAMERA_FIT_MARGIN).toBeLessThan(1);
        expect(zoom).toBeCloseTo((360 * MOBILE_CAMERA_FIT_MARGIN) / 360, 5);
    });

    it('REG-002 keeps desktop stage dense without using the mobile bleed margin', () => {
        const zoom = getBoardFitZoom({
            boardHeight: 640,
            boardWidth: 640,
            margin: DESKTOP_STAGE_FIT_MARGIN,
            viewportHeight: 768,
            viewportWidth: 900
        });

        expect(DESKTOP_STAGE_FIT_MARGIN).toBeGreaterThan(0.9);
        expect(DESKTOP_STAGE_FIT_MARGIN).toBeGreaterThan(MOBILE_CAMERA_FIT_MARGIN);
        expect(zoom).toBeCloseTo((768 * DESKTOP_STAGE_FIT_MARGIN) / 640, 5);
    });

    it('clamps pan so a board that fits cannot be dragged outside the viewport', () => {
        const viewport = clampBoardViewport({
            boardHeight: 400,
            boardWidth: 400,
            fitZoom: 1,
            panX: 999,
            panY: -999,
            viewportHeight: 600,
            viewportWidth: 800,
            zoom: 1
        });

        expect(viewport.panX).toBe(200);
        expect(viewport.panY).toBe(-100);
    });

    it('clamps zoomed pan so the camera remains inside the board', () => {
        const viewport = clampBoardViewport({
            boardHeight: 400,
            boardWidth: 400,
            fitZoom: 1,
            panX: 999,
            panY: 999,
            viewportHeight: 300,
            viewportWidth: 300,
            zoom: 2
        });

        expect(viewport.panX).toBe(250);
        expect(viewport.panY).toBe(250);
    });
});
