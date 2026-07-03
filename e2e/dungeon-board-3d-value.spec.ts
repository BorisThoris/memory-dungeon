import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import {
    expectAppScrollportHasNoVerticalOverflow,
    expectLocatorFullyInWindowViewport,
    expectNoHorizontalOverflow
} from './visualScreenHelpers';
import { expectGameplayReady, openPlayablePathFixture } from './playablePathHelpers';
import { waitForBoardPlayPhase } from './tileBoardGameFlow';

const BOARD_3D_VALUE_VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900, minStagePixels: 260_000 },
    { name: 'mobile', width: 390, height: 844, minStagePixels: 90_000 }
] as const;

test.describe('Dungeon board 3D value', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of BOARD_3D_VALUE_VIEWPORTS) {
        test(`${viewport.name} renders a nonblank bounded dungeon board stage`, async ({ page }, testInfo) => {
            test.setTimeout(150_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'activeRunWithHazards');
            await expectGameplayReady(page);
            await waitForBoardPlayPhase(page);

            const frame = page.getByTestId('tile-board-frame');
            const stage = page.getByTestId('tile-board-stage-shell');
            const canvas = page.getByTestId('tile-board-stage').locator('canvas');

            await expect(frame).toHaveAttribute(
                'data-card-feedback-marker-contract',
                /enemy-occupied boss-marked trap-armed trap-resolved relic objective exit lock lever shop trait chain-ready chain-setup trait-combo trait-route-target/
            );
            const markerStates = await readMarkerStates(page);
            expect(markerStates.get('objective') ?? 0, `${viewport.name} objective markers`).toBeGreaterThan(0);
            expect(
                (markerStates.get('exit') ?? 0) +
                    (markerStates.get('lock') ?? 0) +
                    (markerStates.get('lever') ?? 0) +
                    (markerStates.get('shop') ?? 0) +
                    (markerStates.get('trait') ?? 0),
                `${viewport.name} utility or trait markers`
            ).toBeGreaterThan(0);
            await expectLocatorFullyInWindowViewport(page, frame, 8);
            await expectLocatorFullyInWindowViewport(page, stage, 8);
            await expect(canvas).toBeVisible();
            await expect
                .poll(
                    async () =>
                        canvas.evaluate((node) => {
                            const el = node as HTMLCanvasElement;
                            return { height: el.height, width: el.width };
                        }),
                    { timeout: 30_000 }
                )
                .toEqual(expect.objectContaining({ height: expect.any(Number), width: expect.any(Number) }));

            const metrics = await readBoardStageMetrics(page);
            expect(metrics.stageArea, `${viewport.name} stage area`).toBeGreaterThanOrEqual(viewport.minStagePixels);
            expect(metrics.canvasWidth, `${viewport.name} canvas backing width`).toBeGreaterThan(2);
            expect(metrics.canvasHeight, `${viewport.name} canvas backing height`).toBeGreaterThan(2);
            expect(metrics.stageRight).toBeLessThanOrEqual(viewport.width + 8);
            expect(metrics.stageBottom).toBeLessThanOrEqual(viewport.height + 8);

            const shot = await screenshotStageShellPng(page, stage);
            await testInfo.attach(`${viewport.name}-dungeon-board-stage.png`, { body: shot, contentType: 'image/png' });
            const sample = samplePngVariance(shot);
            expect(sample.nonTransparentPixels, `${viewport.name} stage should not be transparent`).toBeGreaterThan(
                sample.totalPixels * 0.35
            );
            expect(sample.distinctColorBuckets, `${viewport.name} stage should have meaningful rendered detail`).toBeGreaterThan(24);

            await expectNoHorizontalOverflow(page);
            await expectAppScrollportHasNoVerticalOverflow(page, 18);
        });
    }
});

async function readBoardStageMetrics(page: Page): Promise<{
    canvasHeight: number;
    canvasWidth: number;
    stageArea: number;
    stageBottom: number;
    stageRight: number;
}> {
    return page.evaluate(() => {
        const stage = document.querySelector('[data-testid="tile-board-stage-shell"]');
        const canvas = document.querySelector('[data-testid="tile-board-stage"] canvas') as HTMLCanvasElement | null;
        if (!stage || !canvas) {
            throw new Error('Missing tile board stage or canvas.');
        }
        const r = stage.getBoundingClientRect();
        return {
            canvasHeight: canvas.height,
            canvasWidth: canvas.width,
            stageArea: r.width * r.height,
            stageBottom: r.bottom,
            stageRight: r.right
        };
    });
}

async function screenshotStageShellPng(page: Page, stageLocator: ReturnType<Page['getByTestId']>): Promise<Buffer> {
    const clip = await stageLocator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { height: r.height, width: r.width, x: r.x, y: r.y };
    });
    expect(clip.width, 'stage shell has layout width').toBeGreaterThan(2);
    expect(clip.height, 'stage shell has layout height').toBeGreaterThan(2);
    const viewport = page.viewportSize();
    if (!viewport) {
        throw new Error('Viewport size missing.');
    }
    const x = Math.max(0, Math.floor(clip.x));
    const y = Math.max(0, Math.floor(clip.y));
    const width = Math.min(Math.ceil(clip.width), viewport.width - x);
    const height = Math.min(Math.ceil(clip.height), viewport.height - y);
    return page.screenshot({
        animations: 'disabled',
        clip: { height, width, x, y },
        type: 'png'
    });
}

async function readMarkerStates(page: Page): Promise<Map<string, number>> {
    const raw = (await page.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')) ?? '';
    const states = new Map<string, number>();
    for (const entry of raw.split(';').filter(Boolean)) {
        const [key, count] = entry.split(':');
        if (key) {
            states.set(key, Number.parseInt(count ?? '0', 10));
        }
    }
    return states;
}

function samplePngVariance(buffer: Buffer): {
    distinctColorBuckets: number;
    nonTransparentPixels: number;
    totalPixels: number;
} {
    const png = PNG.sync.read(buffer);
    const buckets = new Set<string>();
    let nonTransparentPixels = 0;
    for (let index = 0; index < png.data.length; index += 4) {
        const alpha = png.data[index + 3] ?? 0;
        if (alpha < 12) {
            continue;
        }
        nonTransparentPixels += 1;
        const r = (png.data[index] ?? 0) >> 4;
        const g = (png.data[index + 1] ?? 0) >> 4;
        const b = (png.data[index + 2] ?? 0) >> 4;
        buckets.add(`${r}:${g}:${b}`);
    }
    return {
        distinctColorBuckets: buckets.size,
        nonTransparentPixels,
        totalPixels: png.width * png.height
    };
}
