import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * WAI-ARIA toolbar pattern: one tab stop per toolbar; arrow keys/Home/End move focus.
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
 */

const FOCUSABLE = 'button:not([disabled]):not([data-toolbar-popover])';

export const getToolbarButtons = (root: HTMLElement): HTMLButtonElement[] =>
    Array.from(root.querySelectorAll<HTMLButtonElement>(FOCUSABLE));

/** Set tabindex so only `active` (or first) is in tab order. */
export const syncToolbarTabIndices = (root: HTMLElement | null, active?: HTMLElement | null): void => {
    if (!root) {
        return;
    }
    const buttons = getToolbarButtons(root);
    if (buttons.length === 0) {
        return;
    }
    const preferred =
        active && buttons.includes(active as HTMLButtonElement) ? (active as HTMLButtonElement) : buttons[0];
    buttons.forEach((b) => {
        b.tabIndex = b === preferred ? 0 : -1;
    });
};

export const syncVerticalToolbarTabIndices = (root: HTMLElement | null, active?: HTMLElement | null): void => {
    syncToolbarTabIndices(root, active);
};

/** While >0, vertical toolbars are removed from the tab order (e.g. modal focus trap). */
let verticalToolbarRovingPauseDepth = 0;
let pausedToolbarSnapshots: Map<HTMLElement, { buttons: HTMLButtonElement[]; tabIndices: number[] }> | null =
    null;

/**
 * Pause WAI-ARIA toolbar roving for every `[role="toolbar"]` in the document so Tab does not reach
 * toolbar buttons behind a modal. Call {@link popVerticalToolbarRovingPause} on modal unmount.
 * Nested modals: push/pop must balance.
 */
export const pushVerticalToolbarRovingPause = (): void => {
    if (verticalToolbarRovingPauseDepth === 0) {
        const toolbars = Array.from(document.querySelectorAll<HTMLElement>('[role="toolbar"]'));
        pausedToolbarSnapshots = new Map();
        for (const root of toolbars) {
            const buttons = getToolbarButtons(root);
            pausedToolbarSnapshots.set(root, {
                buttons,
                tabIndices: buttons.map((b) => b.tabIndex)
            });
            buttons.forEach((b) => {
                b.tabIndex = -1;
            });
        }
    }
    verticalToolbarRovingPauseDepth += 1;
};

export const popVerticalToolbarRovingPause = (): void => {
    verticalToolbarRovingPauseDepth = Math.max(0, verticalToolbarRovingPauseDepth - 1);
    if (verticalToolbarRovingPauseDepth !== 0 || !pausedToolbarSnapshots) {
        return;
    }
    for (const [root, { buttons, tabIndices }] of pausedToolbarSnapshots) {
        buttons.forEach((b, i) => {
            b.tabIndex = tabIndices[i] ?? -1;
        });
        if (root.isConnected) {
            syncToolbarTabIndices(root);
        }
    }
    pausedToolbarSnapshots = null;
};

export const handleVerticalToolbarKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const root = event.currentTarget;
    const buttons = getToolbarButtons(root);
    if (buttons.length === 0) {
        return;
    }
    const key = event.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') {
        return;
    }
    const current = document.activeElement;
    const idx = current instanceof HTMLButtonElement ? buttons.indexOf(current) : -1;
    let next = idx;
    if (key === 'Home') {
        next = 0;
    } else if (key === 'End') {
        next = buttons.length - 1;
    } else if (key === 'ArrowDown') {
        next = idx < 0 ? 0 : Math.min(buttons.length - 1, idx + 1);
    } else {
        next = idx < 0 ? buttons.length - 1 : Math.max(0, idx - 1);
    }
    if (next === idx && idx >= 0) {
        return;
    }
    event.preventDefault();
    const target = buttons[next];
    target?.focus();
    syncVerticalToolbarTabIndices(root, target);
};

export const handleHorizontalToolbarKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const root = event.currentTarget;
    const buttons = getToolbarButtons(root);
    if (buttons.length === 0) {
        return;
    }
    const key = event.key;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') {
        return;
    }
    const current = document.activeElement;
    const idx = current instanceof HTMLButtonElement ? buttons.indexOf(current) : -1;
    let next = idx;
    if (key === 'Home') {
        next = 0;
    } else if (key === 'End') {
        next = buttons.length - 1;
    } else if (key === 'ArrowRight') {
        next = idx < 0 ? 0 : Math.min(buttons.length - 1, idx + 1);
    } else {
        next = idx < 0 ? buttons.length - 1 : Math.max(0, idx - 1);
    }
    if (next === idx && idx >= 0) {
        return;
    }
    event.preventDefault();
    const target = buttons[next];
    target?.focus();
    syncToolbarTabIndices(root, target);
};
