import type { CDPSession, Page } from '@playwright/test';

export interface TouchDispatchPoint {
    id: number;
    x: number;
    y: number;
}

export interface TouchDispatchStep {
    points: TouchDispatchPoint[];
    type: 'touchEnd' | 'touchMove' | 'touchStart';
    waitMs?: number;
}

const toTouchPoint = (point: TouchDispatchPoint) => ({
    force: 1,
    id: point.id,
    radiusX: 8,
    radiusY: 8,
    x: Math.round(point.x),
    y: Math.round(point.y)
});

const dispatchTouchStep = async (client: CDPSession, step: TouchDispatchStep): Promise<void> => {
    await client.send('Input.dispatchTouchEvent', {
        type: step.type,
        touchPoints: step.type === 'touchEnd' ? [] : step.points.map(toTouchPoint)
    });
};

export async function dispatchTouchSequence(page: Page, steps: readonly TouchDispatchStep[]): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const client = await page.context().newCDPSession(page);

            try {
                for (const step of steps) {
                    await dispatchTouchStep(client, step);

                    if (step.waitMs) {
                        await page.waitForTimeout(step.waitMs);
                    }
                }
            } finally {
                await client.detach().catch(() => undefined);
            }
            return;
        } catch (error) {
            if (attempt === maxAttempts - 1) {
                throw error;
            }
            await page.waitForTimeout(200);
        }
    }
}

export async function forceCoarsePointerMedia(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const originalMatchMedia = window.matchMedia.bind(window);

        window.matchMedia = ((query: string) => {
            if (query.includes('(pointer: coarse)')) {
                return {
                    matches: true,
                    media: query,
                    addEventListener: () => undefined,
                    removeEventListener: () => undefined,
                    addListener: () => undefined,
                    removeListener: () => undefined,
                    dispatchEvent: () => false,
                    onchange: null
                } as MediaQueryList;
            }

            /*
             * A phone has no fine pointer and cannot hover. Headless Chromium says it has both, and
             * `useCoarsePointer` reads that pairing as a touch laptop with a mouse, i.e. not touch.
             */
            if (query.includes('(pointer: fine)') || query.includes('(any-pointer: fine)') || query.includes('(hover: hover)')) {
                return {
                    matches: false,
                    media: query,
                    addEventListener: () => undefined,
                    removeEventListener: () => undefined,
                    addListener: () => undefined,
                    removeListener: () => undefined,
                    dispatchEvent: () => false,
                    onchange: null
                } as MediaQueryList;
            }

            return originalMatchMedia(query);
        }) as typeof window.matchMedia;
    });
}
