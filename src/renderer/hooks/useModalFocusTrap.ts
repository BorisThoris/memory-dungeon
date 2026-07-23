import { useEffect, useRef, type RefObject } from 'react';
import { focusFirstTabbableOrContainer, handleTabFocusTrapEvent } from '../a11y/focusables';
import { acquireModalFocusSnapshot } from '../a11y/modalFocusReturnStack';
import { useLatestRef } from './useLatestRef';

interface ModalFocusTrapOptions {
    active?: boolean;
    containerRef: RefObject<HTMLElement | null>;
    onActivate?: () => (() => void) | void;
    onDocumentKeyDown?: (event: KeyboardEvent) => boolean | void;
}

export const useModalFocusTrap = ({
    active = true,
    containerRef,
    onActivate,
    onDocumentKeyDown
}: ModalFocusTrapOptions): void => {
    const onActivateRef = useLatestRef(onActivate);
    const onDocumentKeyDownRef = useLatestRef(onDocumentKeyDown);
    const focusSnapshotRef = useRef<ReturnType<typeof acquireModalFocusSnapshot> | null>(null);

    useEffect(() => {
        if (!active) {
            return;
        }

        const focusSnapshot = acquireModalFocusSnapshot();
        focusSnapshotRef.current = focusSnapshot;
        const releaseFocusSnapshot = (): void => {
            if (focusSnapshotRef.current === focusSnapshot) {
                focusSnapshotRef.current = null;
            }
            focusSnapshot.release();
        };
        let cleanupActivation: (() => void) | void = undefined;
        let frame: number;

        try {
            cleanupActivation = onActivateRef.current?.();
            frame = window.requestAnimationFrame(() => {
                if (focusSnapshot.isTop()) {
                    focusFirstTabbableOrContainer(containerRef.current);
                }
            });
        } catch (error) {
            try {
                cleanupActivation?.();
            } finally {
                releaseFocusSnapshot();
            }
            throw error;
        }

        return () => {
            try {
                window.cancelAnimationFrame(frame);
            } finally {
                try {
                    cleanupActivation?.();
                } finally {
                    releaseFocusSnapshot();
                }
            }
        };
    }, [active, containerRef, onActivateRef]);

    useEffect(() => {
        if (!active) {
            return;
        }
        const focusSnapshot = focusSnapshotRef.current;
        if (!focusSnapshot) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent): void => {
            if (!focusSnapshot.isTop()) {
                return;
            }
            const handled = onDocumentKeyDownRef.current?.(event) === true;

            if (handled) {
                return;
            }

            handleTabFocusTrapEvent(event, containerRef.current);
        };

        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [active, containerRef, onDocumentKeyDownRef]);
};
