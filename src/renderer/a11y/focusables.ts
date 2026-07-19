/**
 * Shared focus trap helpers (OverlayModal, StartupIntro, Settings modal).
 *
 * OVR-010 / A11Y-004 — parity contract: mount captures prior `document.activeElement`, moves initial focus to the
 * first tabbable inside the dialog surface on the next animation frame, registers `handleTabFocusTrapEvent` on
 * `document` in capture phase for Tab / Shift+Tab, and restores the prior element on unmount via
 * `modalFocusReturnStack` (entry-owned restoration for nested modals). Call sites differ only in container ref
 * (`OverlayModal` dialog node vs `SettingsScreen` modal shell).
 */

export type TabTrapKeyboardEvent = Pick<KeyboardEvent, 'key' | 'shiftKey'> & { preventDefault(): void };

/** Programmatic focus moves inside modal shells — matches {@link StartupIntro} (no scroll chaining into the underlay). */
export const MODAL_PROGRAMMATIC_FOCUS_OPTIONS: FocusOptions = {
    preventScroll: true
};

export const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');

export const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
        if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        if (element instanceof HTMLInputElement && element.type === 'hidden') {
            return false;
        }

        if (element.matches('[contenteditable]') && !element.isContentEditable) {
            return false;
        }

        /*
         * Ancestor `aria-hidden` removes the subtree from the accessibility tree; exclude so Tab trap
         * order matches sequential focus navigation (pairs with `inert` + backdrop patterns).
         */
        if (element.closest('[aria-hidden="true"]')) {
            return false;
        }

        /*
         * A11Y-006: `inert` removes descendants from the sequential focus navigation order in supporting
         * browsers; we still exclude them here so programmatic focus lists match real Tab behavior.
         * Older engines without `inert` may still expose these nodes — pair `inert` with `aria-hidden`
         * on the same subtree where practical (see GameScreen gameplay wrapper).
         */
        if (element.closest('[inert]')) {
            return false;
        }

        return true;
    });
};

/**
 * Initial modal focus: first tabbable in DOM order, else the dialog container (`tabIndex={-1}`).
 * Use on rAF after open — same contract as `SettingsScreen` modal shell and `OverlayModal`.
 */
export const focusFirstTabbableOrContainer = (
    container: HTMLElement | null,
    focusOptions: FocusOptions = MODAL_PROGRAMMATIC_FOCUS_OPTIONS
): void => {
    const list = getFocusableElements(container);
    const target = list[0] ?? container;
    target?.focus(focusOptions);
};

/**
 * Keeps Tab / Shift+Tab within `container`, including when focus has moved outside
 * (e.g. under a portaled overlay). Use on the dialog surface and/or `document` capture.
 */
export const handleTabFocusTrapEvent = (event: TabTrapKeyboardEvent, container: HTMLElement | null): void => {
    if (event.key !== 'Tab' || !container?.isConnected) {
        return;
    }

    const active = document.activeElement;

    if (!active || !container.contains(active)) {
        event.preventDefault();
        const list = getFocusableElements(container);

        if (event.shiftKey) {
            list[list.length - 1]?.focus(MODAL_PROGRAMMATIC_FOCUS_OPTIONS);
        } else {
            (list[0] ?? container).focus(MODAL_PROGRAMMATIC_FOCUS_OPTIONS);
        }

        return;
    }

    const focusable = getFocusableElements(container);

    if (focusable.length === 0) {
        event.preventDefault();
        container.focus(MODAL_PROGRAMMATIC_FOCUS_OPTIONS);
        return;
    }

    const currentIndex = focusable.indexOf(active as HTMLElement);
    const lastIndex = focusable.length - 1;

    if (event.shiftKey) {
        if (currentIndex <= 0) {
            event.preventDefault();
            focusable[lastIndex]?.focus(MODAL_PROGRAMMATIC_FOCUS_OPTIONS);
        }

        return;
    }

    if (currentIndex === -1 || currentIndex === lastIndex) {
        event.preventDefault();
        focusable[0]?.focus(MODAL_PROGRAMMATIC_FOCUS_OPTIONS);
    }
};
