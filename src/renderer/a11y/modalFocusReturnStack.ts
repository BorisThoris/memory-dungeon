import { MODAL_PROGRAMMATIC_FOCUS_OPTIONS } from './focusables';

interface ModalFocusSnapshot {
    restoreTarget: HTMLElement | null;
}

export interface ModalFocusSnapshotLease {
    isTop: () => boolean;
    release: () => void;
}

const stack: ModalFocusSnapshot[] = [];

/**
 * Capture focus when a modal opens. The returned lease owns this exact snapshot and reports whether
 * it is the top active modal, so delayed focus and keyboard work cannot escape a nested dialog.
 */
export const acquireModalFocusSnapshot = (): ModalFocusSnapshotLease => {
    const snapshot: ModalFocusSnapshot = {
        restoreTarget: document.activeElement instanceof HTMLElement ? document.activeElement : null
    };
    stack.push(snapshot);
    let released = false;

    const release = (): void => {
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

    return {
        isTop: () => !released && stack[stack.length - 1] === snapshot,
        release
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
