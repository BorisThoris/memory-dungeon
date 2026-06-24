import { useEffect, type RefObject } from 'react';
import { focusFirstTabbableOrContainer, handleTabFocusTrapEvent } from '../a11y/focusables';
import { popModalFocusSnapshot, pushModalFocusSnapshot } from '../a11y/modalFocusReturnStack';
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

    useEffect(() => {
        if (!active) {
            return;
        }

        pushModalFocusSnapshot();
        const cleanupActivation = onActivateRef.current?.();
        const frame = window.requestAnimationFrame(() => {
            focusFirstTabbableOrContainer(containerRef.current);
        });

        return () => {
            window.cancelAnimationFrame(frame);
            cleanupActivation?.();
            popModalFocusSnapshot();
        };
    }, [active, containerRef, onActivateRef]);

    useEffect(() => {
        if (!active) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent): void => {
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
