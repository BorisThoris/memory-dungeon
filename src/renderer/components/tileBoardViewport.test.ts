import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DESKTOP_STAGE_FIT_MARGIN,
    clampBoardZoom,
    clampBoardViewport,
    createPinchBoardGestureSnapshot,
    createRafCoalescedViewportNotifier,
    getBoardFitZoom,
    getGestureCentroid,
    getGestureDistance,
    MOBILE_CAMERA_FIT_MARGIN,
    resolveAnchoredBoardViewport,
    resolveDraggedBoardViewport,
    resolvePinchBoardViewport,
    resolveWheelBoardViewport,
    safelyReleasePointerCapture,
    safelySetPointerCapture,
    screenPointToWorld,
    type TileBoardScreenPoint,
    getCameraFitMargin,
    PORTRAIT_CAMERA_FIT_MARGIN
} from './tileBoardViewport';

afterEach(() => {
    vi.unstubAllGlobals();
});

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
    });

    it('coalesces and cancels a pending animation frame whose id is zero', () => {
        const rafQueue: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
            rafQueue.push(callback);
            return 0;
        });
        const cancelAnimationFrame = vi.fn();
        vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
        const onFlush = vi.fn();
        const notifier = createRafCoalescedViewportNotifier(onFlush);

        notifier.schedule(100, 50);
        notifier.schedule(200, 60);

        expect(rafQueue).toHaveLength(1);

        notifier.cancel();

        expect(cancelAnimationFrame).toHaveBeenCalledWith(0);
        rafQueue[0]!(0);
        expect(onFlush).not.toHaveBeenCalled();
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

    it('clamps raw zoom values and anchored zoom resolutions', () => {
        expect(clampBoardZoom(-1)).toBeGreaterThan(0);
        expect(clampBoardZoom(99)).toBeLessThan(3);

        const next = resolveAnchoredBoardViewport({
            boardHeight: 400,
            boardWidth: 400,
            currentViewport: { fitZoom: 1, panX: 0, panY: 0, zoom: 1 },
            nextZoom: 99,
            pointerWorld: { panX: 50, panY: -25 },
            viewportHeight: 300,
            viewportWidth: 300
        });

        expect(next.zoom).toBe(clampBoardZoom(99));
        expect(next.panX).toBeLessThanOrEqual(400 * next.zoom);
        expect(next.panY).toBeGreaterThanOrEqual(-400 * next.zoom);
    });

    it('creates pinch snapshots around the board-space anchor under the gesture centroid', () => {
        const first = { clientX: 80, clientY: 100 };
        const second = { clientX: 120, clientY: 100 };
        const centroid = getGestureCentroid(first, second);

        const snapshot = createPinchBoardGestureSnapshot({
            centroidWorld: { panX: 20, panY: -10 },
            firstPointerId: 7,
            firstTouch: first,
            secondPointerId: 9,
            secondTouch: second,
            viewport: { fitZoom: 2, panX: 10, panY: -20, zoom: 1.25 }
        });

        expect(centroid).toEqual({ clientX: 100, clientY: 100 });
        expect(snapshot.pointerIds).toEqual([7, 9]);
        expect(snapshot.startDistance).toBe(40);
        expect(snapshot.anchorBoardX).toBeCloseTo(4, 5);
        expect(snapshot.anchorBoardY).toBeCloseTo(4, 5);
    });

    it('resolves pinch zoom while keeping the starting board anchor under the moving centroid', () => {
        const snapshot = createPinchBoardGestureSnapshot({
            centroidWorld: { panX: 0, panY: 0 },
            firstPointerId: 1,
            firstTouch: { clientX: 90, clientY: 100 },
            secondPointerId: 2,
            secondTouch: { clientX: 110, clientY: 100 },
            viewport: { fitZoom: 1, panX: 0, panY: 0, zoom: 1 }
        });

        const next = resolvePinchBoardViewport({
            boardHeight: 400,
            boardWidth: 400,
            centroidWorld: { panX: 25, panY: -10 },
            firstTouch: { clientX: 80, clientY: 100 },
            fitZoom: 1,
            secondTouch: { clientX: 120, clientY: 100 },
            snapshot,
            viewportHeight: 300,
            viewportWidth: 300
        });

        expect(getGestureDistance({ clientX: 80, clientY: 100 }, { clientX: 120, clientY: 100 })).toBe(40);
        expect(next.zoom).toBe(2);
        expect(next.panX).toBe(25);
        expect(next.panY).toBe(-10);
    });

    it('resolves wheel zoom around the pointer world anchor', () => {
        const next = resolveWheelBoardViewport({
            boardHeight: 400,
            boardWidth: 400,
            currentViewport: { fitZoom: 1, panX: 0, panY: 0, zoom: 1 },
            deltaY: -200,
            pointerWorld: { panX: 50, panY: -25 },
            viewportHeight: 300,
            viewportWidth: 300
        });

        expect(next.zoom).toBeGreaterThan(1);
        expect(next.panX).toBeLessThan(0);
        expect(next.panY).toBeGreaterThan(0);
    });

    it('resolves drag pan from the initial world-space grab point', () => {
        const next = resolveDraggedBoardViewport({
            boardHeight: 400,
            boardWidth: 400,
            currentWorld: { panX: 55, panY: 15 },
            currentZoom: 1.5,
            fitZoom: 1,
            snapshot: {
                startPanX: 10,
                startPanY: -20,
                startWorldX: 40,
                startWorldY: 25
            },
            viewportHeight: 300,
            viewportWidth: 300
        });

        expect(next.panX).toBe(25);
        expect(next.panY).toBe(-30);
        expect(next.zoom).toBe(1.5);
    });

    it('contains unavailable pointer capture APIs so board gesture cleanup can continue', () => {
        const setPointerCapture = vi.fn(() => {
            throw new Error('pointer capture unavailable');
        });
        const releasePointerCapture = vi.fn(() => {
            throw new Error('pointer release unavailable');
        });
        const hasPointerCapture = vi.fn(() => true);

        expect(safelySetPointerCapture({ setPointerCapture }, 7)).toBe(false);
        expect(() => safelyReleasePointerCapture({ hasPointerCapture, releasePointerCapture }, 7)).not.toThrow();
        expect(hasPointerCapture).toHaveBeenCalledWith(7);
        expect(releasePointerCapture).toHaveBeenCalledWith(7);
    });

    it('reports successful pointer capture and skips release when not captured', () => {
        const setPointerCapture = vi.fn();
        const releasePointerCapture = vi.fn();
        const hasPointerCapture = vi.fn(() => false);

        expect(safelySetPointerCapture({ setPointerCapture }, 9)).toBe(true);
        safelyReleasePointerCapture({ hasPointerCapture, releasePointerCapture }, 9);

        expect(setPointerCapture).toHaveBeenCalledWith(9);
        expect(hasPointerCapture).toHaveBeenCalledWith(9);
        expect(releasePointerCapture).not.toHaveBeenCalled();
    });
});

describe('the portrait fit margin', () => {
    it('fits a phone held upright tighter than one held sideways', () => {
        expect(getCameraFitMargin({ viewportWidth: 390, viewportHeight: 600 })).toBe(PORTRAIT_CAMERA_FIT_MARGIN);
        expect(getCameraFitMargin({ viewportWidth: 812, viewportHeight: 300 })).toBe(MOBILE_CAMERA_FIT_MARGIN);
        expect(PORTRAIT_CAMERA_FIT_MARGIN).toBeGreaterThan(MOBILE_CAMERA_FIT_MARGIN);
        expect(PORTRAIT_CAMERA_FIT_MARGIN).toBeLessThan(1);
        // A 6×4 board on a 390×600 stage: width-limited, and the tiles grow by the margin's ratio.
        const before = getBoardFitZoom({ boardWidth: 6, boardHeight: 4, viewportWidth: 390, viewportHeight: 600, margin: MOBILE_CAMERA_FIT_MARGIN });
        const after = getBoardFitZoom({ boardWidth: 6, boardHeight: 4, viewportWidth: 390, viewportHeight: 600, margin: PORTRAIT_CAMERA_FIT_MARGIN });
        expect(after / before).toBeCloseTo(PORTRAIT_CAMERA_FIT_MARGIN / MOBILE_CAMERA_FIT_MARGIN, 5);
    });
});
