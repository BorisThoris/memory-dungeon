import type { Page } from '@playwright/test';

/**
 * The fit report: what a screen is doing wrong inside the window it was given.
 *
 * Lifted out of `ui-fit-contract.spec.ts` at Gen 222 so a second spec could ask the same question
 * at a different UI scale. It was worth lifting rather than copying: the contract's judgement of
 * what counts as clipped, covered or overlapping is two hundred lines of decisions about
 * screen-reader text, clipping ancestors, dialog scrims and shared leading, and a second copy of
 * that would have drifted from the first within a generation.
 */
export interface FitReport {
    scrollers: string[];
    undersized: string[];
    clipped: string[];
    belowFold: string[];
    /** Visible text whose centre another element paints over: a line under a sticky actions bar. */
    covered: string[];
    /** Visible text leaves whose boxes intersect: two dock labels run together. */
    overlapping: string[];
}

export const describeFit = async (page: Page): Promise<FitReport> =>
    page.evaluate(() => {
        // Screen-reader-only text is clipped on purpose and parked outside the window; it is
        // not something a player can see, so it is not something that can fail to fit.
        const srOnly = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return (
                cs.clipPath !== 'none' ||
                cs.clip !== 'auto' ||
                r.width <= 1 ||
                r.height <= 1 ||
                r.bottom <= 0 ||
                r.right <= 0 ||
                r.left >= window.innerWidth
            );
        };
        const shown = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return (
                r.width > 0 &&
                r.height > 0 &&
                cs.visibility !== 'hidden' &&
                cs.display !== 'none' &&
                cs.opacity !== '0' &&
                !srOnly(el)
            );
        };
        const name = (el: Element): string => {
            const testId = el.getAttribute('data-testid');
            const text = (el.textContent ?? '').trim().slice(0, 32);
            return testId ? `[${testId}] ${text}` : `${el.tagName.toLowerCase()} ${text}`;
        };
        const all = Array.from(document.querySelectorAll('*'));
        const leaves = all.filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0 && shown(el));
        // What a leaf actually shows: its box cut down by every clipping ancestor. A card whose
        // meta line runs past its clipped cell is clipped, not overlapping the pager below it.
        const visibleRect = (el: Element): DOMRect => {
            let r = el.getBoundingClientRect();
            let node: Element | null = el.parentElement;
            while (node && node !== document.body) {
                const cs = getComputedStyle(node);
                if (/hidden|clip/.test(`${cs.overflowX}${cs.overflowY}`)) {
                    const c = node.getBoundingClientRect();
                    const left = Math.max(r.left, c.left);
                    const top = Math.max(r.top, c.top);
                    const right = Math.min(r.right, c.right);
                    const bottom = Math.min(r.bottom, c.bottom);
                    r = new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
                }
                node = node.parentElement;
            }
            return r;
        };

        const scrollers = all
            .filter((el) => {
                const cs = getComputedStyle(el);
                return (
                    (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) &&
                    /auto|scroll/.test(`${cs.overflowY}${cs.overflowX}`)
                );
            })
            .map(name);

        const undersized = leaves.filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 12).map(name);

        // Text the layout is hiding: clamped to fewer lines than it has, cut horizontally, or cut
        // by a clipping ancestor - a card's third line under its cell's edge on a phone sideways.
        const clipped = leaves
            .filter((el) => {
                const cs = getComputedStyle(el);
                const clampedLines = Number.parseInt(cs.webkitLineClamp, 10);
                const clampCuts = Number.isFinite(clampedLines) && el.scrollHeight > el.clientHeight + 2;
                const ellipsisCuts = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 2;
                const hiddenCuts = cs.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 4;
                if (el.closest('[aria-hidden="true"], [inert]')) return clampCuts || ellipsisCuts || hiddenCuts;
                const own = el.getBoundingClientRect();
                const seen = visibleRect(el);
                const ancestorCuts = own.height > 0 && seen.height < own.height - 4;
                return clampCuts || ellipsisCuts || hiddenCuts || ancestorCuts;
            })
            .map(name);

        // Anything laid out past the bottom edge with nothing to scroll it into view. Text
        // leaves count, not just panels: a stat tile with no test id is just as unreadable.
        const belowFold = [...new Set([...leaves, ...all.filter((el) => el.getAttribute('data-testid') && shown(el))])]
            .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.bottom > window.innerHeight + 8 && r.height < window.innerHeight;
            })
            .map(name);

        // Text another element paints over. The dialog actions are sticky and the third door's
        // risk line slid under them on a phone: inside the window, not clipped, unreadable.
        const covered = leaves
            .filter((el) => {
                const r = visibleRect(el);
                if (r.width <= 0 || r.height <= 0) return false;
                const x = r.left + r.width / 2;
                const y = r.top + r.height / 2;
                if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
                const top = document.elementFromPoint(x, y);
                if (!top) return false;
                if (top === el || el.contains(top) || top.contains(el)) return false;
                // A dialog over the screen is meant to cover it: the HUD under the pause menu's
                // scrim is not a defect, and the background is inert or aria-hidden while it shows.
                if (el.closest('[aria-hidden="true"], [inert]')) return false;
                if (top.closest('[role="dialog"]') || top.querySelector('[role="dialog"]')) return false;
                // Transparent overlays (hit layers, a card's full-face button with screen-reader
                // text, tooltips' invisible anchors) do not cover text: a cover paints a background
                // or shows text of its own.
                const cs = getComputedStyle(top);
                const showsText =
                    (top.children.length === 0 && (top.textContent ?? '').trim().length > 0 && shown(top)) ||
                    Array.from(top.querySelectorAll('*')).some(
                        (d) => d.children.length === 0 && (d.textContent ?? '').trim().length > 0 && shown(d)
                    );
                const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || showsText;
                if (!paints) return false;
                // A label and its number share a few pixels of leading by design; a cover is the
                // other element's box taking more than half the line's height.
                const t = top.getBoundingClientRect();
                const overlapY = Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top);
                return overlapY > r.height * 0.5;
            })
            .map(name);

        // Two text leaves sharing pixels: a row of labels with less width than the words. Only
        // within one layer: the HUD under a dialog's scrim is covered on purpose, not overlapped.
        const overlapping: string[] = [];
        const rects = leaves
            .filter((el) => !el.closest('[aria-hidden="true"], [inert]'))
            .map((el) => ({ el, r: visibleRect(el), layer: el.closest('[role="dialog"]') }))
            .filter(({ r }) => r.width > 0 && r.height > 0);
        for (let i = 0; i < rects.length; i += 1) {
            for (let j = i + 1; j < rects.length; j += 1) {
                const a = rects[i]!;
                const b = rects[j]!;
                if (a.layer !== b.layer) continue;
                if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
                const overlapX = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
                const overlapY = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
                // Words on one line running into each other: a real horizontal overlap across
                // most of the line's height. Stacked text sharing leading is not that.
                const minHeight = Math.min(a.r.height, b.r.height);
                if (overlapX > 4 && overlapY > minHeight * 0.5) {
                    overlapping.push(`${name(a.el)} × ${name(b.el)}`);
                }
            }
        }

        return { scrollers, undersized, clipped, belowFold, covered, overlapping };
    });

