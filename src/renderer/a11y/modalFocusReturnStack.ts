import { MODAL_PROGRAMMATIC_FOCUS_OPTIONS } from './focusables';

interface ModalFocusSnapshot {
    restoreTarget: HTMLElement | null;
}

const stack: ModalFocusSnapshot[] = [];

/**
 * Capture focus when a modal opens. The returned release function owns this exact snapshot, so
 * an out-of-order or repeated teardown cannot consume another modal's restore target.
 */
export const acquireModalFocusSnapshot = (): (() => void) => {
    const snapshot: ModalFocusSnapshot = {
        restoreTarget: document.activeElement instanceof HTMLElement ? document.activeElement : null
    };
    stack.push(snapshot);
    let released = false;

    return () => {
        if (released) {
            return;
        }
        released = true;

        const index = stack.indexOf(snapshot);
        if (index < 0) {
            return;
        }
        const wasTopSnapshot = index === stack.length - 1;
        stack.splice(index, 1);

        if (wasTopSnapshot && isSafeRestoreTarget(snapshot.restoreTarget)) {
            snapshot.restoreTarget.focus(MODAL_PROGRAMMATIC_FOCUS_OPTIONS);
        }
    };
};

const isSafeRestoreTarget = (el: HTMLElement | null): el is HTMLElement => {
    if (!el) {
        return false;
    }
    if (el === document.body) {
        return false;
    }
    return document.contains(el);
};
