import { expect, type Page } from '@playwright/test';

/**
 * The board's floating overlays are supposed to start where the chrome ends.
 *
 * Two generations of this project got that wrong in opposite directions. First the hook that
 * measures the chrome named CSS-module classes that had moved, published a clearance of zero, and
 * the overlays sat on the HUD. Then the stage itself was inset by those same clearances, and the
 * overlays — which add the clearance themselves — began offsetting twice: the HUD ended at 144, the
 * frame began at 144, and the pass banner sat at 296. Nothing failed either time. Both were only
 * visible by looking at the screen.
 *
 * So the check is the painted result rather than the stylesheet: an overlay that means to clear the
 * chrome has to begin after the chrome ends, and not far after it. A layout that changes how it
 * gets there is free to; one that lands the overlay in the middle of the board is not.
 */

/** How far past the chrome an overlay may still be said to be "just below" it. */
export const CHROME_CLEARANCE_SLACK_PX = 96;

export interface BoardOverlayPlacement {
    readonly testId: string;
    readonly top: number;
    readonly bottom: number;
}

interface BoardChrome {
    readonly hudBottom: number;
    readonly dockTop: number;
    readonly overlays: readonly BoardOverlayPlacement[];
}

const readBoardChrome = async (page: Page, testIds: readonly string[]): Promise<BoardChrome> =>
    page.evaluate((ids) => {
        const rectOf = (selector: string): DOMRect | null => {
            const el = document.querySelector(selector);
            if (!el) {
                return null;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 ? rect : null;
        };
        const hud = rectOf('[data-testid="game-hud"]');
        const dock = rectOf('[data-testid="game-action-dock"]');
        return {
            dockTop: dock ? Math.round(dock.top) : window.innerHeight,
            hudBottom: hud ? Math.round(hud.bottom) : 0,
            overlays: ids
                .map((testId) => {
                    const rect = rectOf(`[data-testid="${testId}"]`);
                    return rect ? { bottom: Math.round(rect.bottom), testId, top: Math.round(rect.top) } : null;
                })
                .filter((row): row is BoardOverlayPlacement => row !== null)
        };
    }, [...testIds]);

/**
 * Asserts that each named overlay, if it is on screen at all, begins below the HUD and above the
 * dock — and within `CHROME_CLEARANCE_SLACK_PX` of the chrome rather than an extra clearance away.
 * Overlays that are not currently shown are skipped: this says where they sit, not that they exist.
 */
export const expectBoardOverlaysClearChrome = async (
    page: Page,
    testIds: readonly string[],
    label: string
): Promise<readonly BoardOverlayPlacement[]> => {
    const chrome = await readBoardChrome(page, testIds);
    expect(chrome.hudBottom, `${label}: the HUD is on screen to clear`).toBeGreaterThan(0);
    for (const overlay of chrome.overlays) {
        expect(overlay.top, `${label}: ${overlay.testId} starts below the HUD`).toBeGreaterThanOrEqual(
            chrome.hudBottom
        );
        expect(
            overlay.top - chrome.hudBottom,
            `${label}: ${overlay.testId} clears the HUD once, not twice`
        ).toBeLessThanOrEqual(CHROME_CLEARANCE_SLACK_PX);
        expect(overlay.bottom, `${label}: ${overlay.testId} stays above the dock`).toBeLessThanOrEqual(
            chrome.dockTop
        );
    }
    return chrome.overlays;
};

/** Every board overlay that positions itself against the measured chrome. */
export const CHROME_ANCHORED_BOARD_OVERLAYS = ['board-pass-handoff', 'trap-resolution-feedback'] as const;
