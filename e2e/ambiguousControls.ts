import type { Page } from '@playwright/test';
import { CONTROL_LABEL_SYNONYMS } from '../src/shared/control-label-ambiguity';

/**
 * Two controls in one place that a player cannot tell apart.
 *
 * The vendor shipped "Back to board" and "Return to board" side by side, one styled as the
 * secondary and one as the primary, and both ran the same store action: `continueFromShop` returns
 * early into the function the back button calls whenever the shop was opened from the board. The
 * screen's own test asserted both buttons were present, so the duplicate had coverage.
 *
 * Handlers are inline closures, so there is nothing to compare statically. What a player actually
 * experiences is two buttons that read the same, which is measurable on the rendered page: map the
 * words that mean the same thing to one token and see whether two labels in the same container
 * collapse onto each other. That catches a real duplicate whether or not the code behind them
 * converges — and a pair that reads identically is a defect either way.
 */

/*
 * The rule itself lives in `shared/control-label-ambiguity`, where it is unit-tested against the
 * pair that actually shipped. This file only walks the page and applies it — a check whose logic
 * cannot be tested apart from a browser is a check nobody can prove.
 */

export interface AmbiguousControlPair {
    /** The dialog, dock or form both controls sit in. */
    readonly container: string;
    readonly labels: readonly [string, string];
}

export const findAmbiguousControls = async (page: Page): Promise<AmbiguousControlPair[]> =>
    page.evaluate((synonyms: Record<string, string>) => {
        const shown = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
        };
        const label = (el: Element): string =>
            (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/gu, ' ').trim();
        const normalize = (text: string): string =>
            text
                .toLowerCase()
                .replace(/[^a-z0-9 ]/gu, ' ')
                .split(/\s+/u)
                .filter((word) => word.length > 0)
                .map((word) => synonyms[word] ?? word)
                .join(' ');

        /** The nearest thing a player reads as one group of choices. */
        const groupOf = (el: Element): Element | null =>
            el.closest('[role="dialog"], [aria-modal="true"], footer, [data-testid$="-dock"], form') ??
            el.parentElement;

        const groups = new Map<Element, HTMLButtonElement[]>();
        for (const button of Array.from(document.querySelectorAll('button'))) {
            if (!shown(button) || button.hasAttribute('disabled') || label(button).length === 0) {
                continue;
            }
            const group = groupOf(button);
            if (!group) {
                continue;
            }
            groups.set(group, [...(groups.get(group) ?? []), button]);
        }

        const found: { container: string; labels: [string, string] }[] = [];
        for (const [group, buttons] of groups) {
            const seen = new Map<string, string>();
            for (const button of buttons) {
                const text = label(button);
                const key = normalize(text);
                const previous = seen.get(key);
                if (previous !== undefined && previous !== text) {
                    found.push({
                        container:
                            group.getAttribute('data-testid') ??
                            group.getAttribute('aria-label') ??
                            group.tagName.toLowerCase(),
                        labels: [previous, text]
                    });
                    continue;
                }
                seen.set(key, text);
            }
        }
        return found;
    }, CONTROL_LABEL_SYNONYMS);
