import type { Page } from '@playwright/test';

/**
 * Controls a click cannot reach.
 *
 * The fit contract asked four questions — too small, cut off, scrolling, past the bottom edge —
 * and a control covered by something else passes all four. On a 1280x800 panel every mode in the
 * browse grid was on screen, highlighted on hover, and did nothing when pressed, because a click
 * at its centre landed on the pager painted over it. This is the question that finds that.
 *
 * It lives on its own so the slow fit sweep and the fast gate ask it the same way.
 */

const CONTROL_SELECTOR =
    'button, a[href], input, select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';

/** One reading. A relayout in flight can look like an overlap, so callers take two. */
export const readUnreachableControls = async (page: Page): Promise<string[]> =>
    page.evaluate((selector) => {
        const shown = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return (
                r.width > 1 &&
                r.height > 1 &&
                cs.visibility !== 'hidden' &&
                cs.display !== 'none' &&
                cs.opacity !== '0' &&
                cs.clipPath === 'none' &&
                cs.clip === 'auto'
            );
        };
        const name = (el: Element): string => {
            const testId = el.getAttribute('data-testid');
            const label = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 32);
            return testId ? `[${testId}] ${label}` : `${el.tagName.toLowerCase()} ${label}`;
        };

        // A modal covers what is behind it on purpose, so only what is inside it is meant to answer.
        const modals = Array.from(document.querySelectorAll('[aria-modal="true"]')).filter(shown);
        const openModal = modals[modals.length - 1] ?? null;

        return Array.from(document.querySelectorAll(selector))
            .filter((el) => shown(el) && !(el as HTMLElement).hasAttribute('disabled'))
            // `inert` means the app has already said this subtree is out of reach on purpose.
            .filter((el) => !el.closest('[inert]'))
            .filter((el) => openModal === null || openModal.contains(el))
            .filter((el) => {
                const r = el.getBoundingClientRect();
                const x = Math.round(r.left + r.width / 2);
                const y = Math.round(r.top + r.height / 2);
                if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
                    return true;
                }
                const top = document.elementFromPoint(x, y);
                /*
                 * The control itself, or something inside it — a label, an icon — since a press
                 * there bubbles to the control. An ANCESTOR on top is not the same thing and used
                 * to pass here: that is precisely what a control overflowing its clipped parent
                 * looks like, the centre landing outside the clip on the wrapper. It hid a browse
                 * card on a 390px phone that rendered, hit-tested, and did nothing when pressed.
                 */
                return !top || !(el === top || el.contains(top));
            })
            .map(name);
    }, CONTROL_SELECTOR);

/**
 * What is still unreachable after the layout settles. Two readings, intersected: after a resize
 * the fitted grids re-measure through a ResizeObserver and a render, and a card read in that gap
 * sits briefly under the pager. A real overlap is there both times.
 */
export const findUnreachableControls = async (page: Page): Promise<string[]> => {
    const first = await readUnreachableControls(page);
    if (first.length === 0) {
        return first;
    }
    await page.waitForTimeout(600);
    const second = await readUnreachableControls(page);
    return second.filter((row) => first.includes(row));
};
