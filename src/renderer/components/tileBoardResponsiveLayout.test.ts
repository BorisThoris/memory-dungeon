import { describe, expect, it } from 'vitest';
import { boardFitFrame, boardGridWorldSize, responsiveBoardColumns } from './tileBoardResponsiveLayout';
import { getBoardFitZoom, createFittedBoardViewport, isBoardViewportAtRest, carryBoardViewportForward } from './tileBoardViewport';

describe('responsive board layout', () => {
    it('reserves the desktop rail without reserving the mobile combo twice', () => {
        const stage = { top: 0, bottom: 800, height: 800, left: 0, right: 1280, width: 1280 };
        const frame = boardFitFrame(stage, 60, 710, { left: 20, right: 240, bottom: 580, width: 220 });
        expect(frame.widthFraction * 1280).toBeCloseTo(1028);
        expect(frame.centerXFraction * 1280).toBeCloseTo(126);
        const mobile = boardFitFrame(stage, 80, 710, { left: 20, right: 240, bottom: 70, width: 220 });
        expect(mobile.widthFraction).toBe(1);
    });
    it('turns a wide deal into a tall deal on a portrait phone', () => {
        const portrait = responsiveBoardColumns(24, 390, 710, true);
        const landscape = responsiveBoardColumns(24, 844, 240, true);
        expect(portrait).toBeLessThan(landscape);
        expect(Math.ceil(24 / portrait)).toBeGreaterThan(portrait);
        expect(Math.ceil(24 / landscape)).toBeLessThan(landscape);
    });

    it('maximizes card scale over every valid grid for small and large decks across screen shapes', () => {
        for (const count of [1, 8, 17, 24, 48, 256, 4096, 8192]) {
            for (const [width, height] of [[320, 430], [390, 700], [568, 210], [1280, 660], [3440, 1300]]) {
                const compact = width < 900;
                const columns = responsiveBoardColumns(count, width, height, compact);
                const size = boardGridWorldSize(columns, Math.ceil(count / columns), compact);
                const scale = Math.min(width / size.width, height / size.height);
                expect(size.width * scale).toBeLessThanOrEqual(width + 1e-6);
                expect(size.height * scale).toBeLessThanOrEqual(height + 1e-6);
                for (let alternative = 1; alternative <= count; alternative++) {
                    const other = boardGridWorldSize(alternative, Math.ceil(count / alternative), compact);
                    expect(scale + 1e-6).toBeGreaterThanOrEqual(Math.min(width / other.width, height / other.height));
                }
            }
        }
    });

    it('uses all the space between unequal chrome bars and centers the fitted board inside it', () => {
        const frame = boardFitFrame({ top: 0, bottom: 800, height: 800, left: 0, right: 390, width: 390 }, 80, 650);
        expect(frame.heightFraction).toBeCloseTo(570 / 800);
        const fitPanY = frame.centerYFraction * 800;
        const zoom = getBoardFitZoom({ boardWidth: 200, boardHeight: 500, viewportWidth: 390, viewportHeight: 800 * frame.heightFraction, margin: 1 });
        const view = createFittedBoardViewport(zoom, fitPanY);
        expect(400 - view.panY - 250 * zoom).toBeCloseTo(80);
        expect(400 - view.panY + 250 * zoom).toBeCloseTo(650);
        expect(isBoardViewportAtRest(view, fitPanY)).toBe(true);
        const carried = carryBoardViewportForward({ previousViewport: view,
            previousMetrics: { boardWidth: 200, boardHeight: 500, viewportWidth: 390, viewportHeight: 800, fitZoom: zoom, fitPanY },
            nextMetrics: { boardWidth: 200, boardHeight: 500, viewportWidth: 390, viewportHeight: 800, fitZoom: 1, fitPanY: -20 } });
        expect(carried).toEqual(createFittedBoardViewport(1, -20));
    });
});
