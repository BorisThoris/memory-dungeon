import { MODAL_PROGRAMMATIC_FOCUS_OPTIONS } from './focusables';

interface ModalFocusSnapshot {
    restoreTargets: HTMLElement[];
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
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const snapshot: ModalFocusSnapshot = {
        restoreTargets: activeElement ? [activeElement] : []
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

        if (!wasTopSnapshot) {
            // Preserve the lower modal's opener chain for whichever modal still owns focus above it.
            const snapshotAbove = stack[index];
            for (const restoreTarget of snapshot.restoreTargets) {
                if (snapshotAbove && !snapshotAbove.restoreTargets.includes(restoreTarget)) {
                    snapshotAbove.restoreTargets.push(restoreTarget);
                }
            }
            return;
        }

        const restoreTarget = snapshot.restoreTargets.find(isSafeRestoreTarget);
        if (restoreTarget) {
            restoreTarget.focus(MODAL_PROGRAMMATIC_FOCUS_OPTIONS);
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
