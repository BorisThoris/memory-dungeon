import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * WAI-ARIA toolbar pattern: one tab stop per toolbar; arrow keys/Home/End move focus.
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
 */

const FOCUSABLE = 'button:not([disabled]):not([data-toolbar-popover])';

interface PausedToolbarState {
    preferredButton: HTMLButtonElement | null;
}

/** While >0, toolbars are removed from the tab order (e.g. modal focus trap). */
let toolbarRovingPauseDepth = 0;
let pausedToolbarStates: Map<HTMLElement, PausedToolbarState> | null = null;

export const getToolbarButtons = (root: HTMLElement): HTMLButtonElement[] =>
    Array.from(root.querySelectorAll<HTMLButtonElement>(FOCUSABLE));

const resolvePreferredButton = (
    buttons: HTMLButtonElement[],
    active?: HTMLElement | null
): HTMLButtonElement | undefined =>
    active && buttons.includes(active as HTMLButtonElement) ? (active as HTMLButtonElement) : buttons[0];

const applyToolbarTabIndices = (buttons: HTMLButtonElement[], active?: HTMLElement | null): void => {
    const preferred = resolvePreferredButton(buttons, active);
    buttons.forEach((button) => {
        button.tabIndex = button === preferred ? 0 : -1;
    });
};

/** Set tabindex so only `active` (or first) is in tab order. */
export const syncToolbarTabIndices = (root: HTMLElement | null, active?: HTMLElement | null): void => {
    if (!root) {
        return;
    }
    const buttons = getToolbarButtons(root);
    if (toolbarRovingPauseDepth > 0) {
        pausedToolbarStates ??= new Map();
        const priorPreferredButton = pausedToolbarStates.get(root)?.preferredButton;
        pausedToolbarStates.set(root, {
            preferredButton: resolvePreferredButton(
                buttons,
                active === undefined ? priorPreferredButton : active
            ) ?? null
        });
        buttons.forEach((button) => {
            button.tabIndex = -1;
        });
        return;
    }
    applyToolbarTabIndices(buttons, active);
};

export const syncVerticalToolbarTabIndices = (root: HTMLElement | null, active?: HTMLElement | null): void => {
    syncToolbarTabIndices(root, active);
};

/**
 * Pause WAI-ARIA toolbar roving for every `[role="toolbar"]` in the document so Tab does not reach
 * toolbar buttons behind a modal. The returned release function is idempotent for nested teardown.
 */
export const acquireToolbarRovingPause = (): (() => void) => {
    if (toolbarRovingPauseDepth === 0) {
        const toolbars = Array.from(document.querySelectorAll<HTMLElement>('[role="toolbar"]'));
        pausedToolbarStates = new Map();
        for (const root of toolbars) {
            const buttons = getToolbarButtons(root);
            pausedToolbarStates.set(root, {
                preferredButton: buttons.find((button) => button.tabIndex === 0) ?? buttons[0] ?? null
            });
            buttons.forEach((button) => {
                button.tabIndex = -1;
            });
        }
    }
    toolbarRovingPauseDepth += 1;
    let released = false;

    return () => {
        if (released) {
            return;
        }
        released = true;
        toolbarRovingPauseDepth = Math.max(0, toolbarRovingPauseDepth - 1);
        if (toolbarRovingPauseDepth !== 0 || !pausedToolbarStates) {
            return;
        }

        const states = pausedToolbarStates;
        pausedToolbarStates = null;
        for (const [root, { preferredButton }] of states) {
            applyToolbarTabIndices(getToolbarButtons(root), preferredButton);
        }
    };
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
