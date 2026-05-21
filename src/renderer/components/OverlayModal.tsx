import { useEffect, useId, useRef, type ReactNode } from 'react';
import { focusFirstTabbableOrContainer, handleTabFocusTrapEvent } from '../a11y/focusables';
import { popModalFocusSnapshot, pushModalFocusSnapshot } from '../a11y/modalFocusReturnStack';
import { popVerticalToolbarRovingPause, pushVerticalToolbarRovingPause } from '../a11y/toolbarRoving';
import { getOverlayDecisionPolicyRow } from '../../shared/overlay-decision-policy';
import { MetaFrame, OverlayActionDock, ScreenTitle } from '../ui';
import type { OverlayActionPlacement } from '../ui';
import styles from './OverlayModal.module.css';

interface ModalAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
}

type OverlayModalActionPlacement = OverlayActionPlacement | 'auto';

/** META-009: pause=blue-neutral, floor=gold+success well, relic=violet — only when `ornamentalHeaderPlate`. */
type OverlayModalHeaderPlateTone = 'neutral' | 'success' | 'pause' | 'relic' | 'danger';

interface OverlayModalProps {
    title: string;
    subtitle?: string;
    children?: ReactNode;
    actions: ModalAction[];
    /** Optional stable hook for e2e (applied to the dialog surface). */
    testId?: string;
    /**
     * OVR-002: forged-gold header band using {@link MetaFrame} (META-003). Static only — pairs with global
     * `data-reduce-motion` (drops cornice glow, no motion hooks here). OVR-003: dialog surface enter animation is
     * CSS-only under `[data-reduce-motion='false']` (see MOTION_AND_STATE_SPEC).
     */
    ornamentalHeaderPlate?: boolean;
    /**
     * DS-010: with `ornamentalHeaderPlate`, use a flat title band (no MetaFrame cornice) for routine summaries
     * (e.g. floor cleared). Relic / pause keep the forged header unless this is set.
     */
    quietHeaderPlate?: boolean;
    /** When `ornamentalHeaderPlate` is set: chrome wash + MetaFrame glow (see {@link OverlayModalHeaderPlateTone}). */
    headerPlateTone?: OverlayModalHeaderPlateTone;
    /** Hybrid parity: compact decisions use a rail; body-heavy overlays use a bottom dock. */
    actionPlacement?: OverlayModalActionPlacement;
    /** Optional keyboard back path for overlays with an existing safe cancel/resume action. */
    onEscape?: () => void;
}

const modalKindFor = (actions: readonly ModalAction[], hasChildren: boolean): 'alert' | 'decision' | 'sheet' => {
    if (actions.length === 0) {
        return 'sheet';
    }
    if (actions.length <= 1 && !hasChildren) {
        return 'alert';
    }
    return 'decision';
};

const headerPlateToneClass = (tone: OverlayModalHeaderPlateTone): string => {
    if (tone === 'success') {
        return styles.headerPlateFrameSuccess;
    }

    if (tone === 'pause') {
        return styles.headerPlateFramePause;
    }

    if (tone === 'relic') {
        return styles.headerPlateFrameRelic;
    }

    if (tone === 'danger') {
        return styles.headerPlateFrameDanger;
    }

    return '';
};

const quietHeaderToneClass = (tone: OverlayModalHeaderPlateTone): string => {
    if (tone === 'success') {
        return styles.headerQuietToneSuccess;
    }
    if (tone === 'pause') {
        return styles.headerQuietTonePause;
    }
    if (tone === 'relic') {
        return styles.headerQuietToneRelic;
    }
    if (tone === 'danger') {
        return styles.headerQuietToneDanger;
    }
    return styles.headerQuietToneNeutral;
};

const overlayToneClass = (tone: OverlayModalHeaderPlateTone): string => {
    if (tone === 'success') {
        return styles.modalToneSuccess;
    }

    if (tone === 'pause') {
        return styles.modalTonePause;
    }

    if (tone === 'relic') {
        return styles.modalToneRelic;
    }

    if (tone === 'danger') {
        return styles.modalToneDanger;
    }

    return styles.modalToneNeutral;
};

const resolveActionPlacement = (
    requested: OverlayModalActionPlacement,
    actions: readonly ModalAction[],
    hasChildren: boolean
): OverlayActionPlacement => {
    if (requested !== 'auto') {
        return requested;
    }
    if (actions.length === 0) {
        return 'dock';
    }
    return hasChildren ? 'dock' : 'rail';
};

const targetAllowsOverlayEscape = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
        return true;
    }

    if (target.isContentEditable || target.closest('textarea, select')) {
        return false;
    }

    const input = target.closest('input');
    if (!input) {
        return true;
    }

    return ['button', 'checkbox', 'radio', 'reset', 'submit'].includes(input.type);
};

const OverlayModal = ({
    title,
    subtitle,
    children,
    actions,
    testId,
    ornamentalHeaderPlate = false,
    quietHeaderPlate = false,
    headerPlateTone = 'neutral',
    actionPlacement = 'auto',
    onEscape
}: OverlayModalProps) => {
    const modalRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const subtitleId = useId();
    const bodyId = useId();
    const describedBy = [subtitle ? subtitleId : null, children ? bodyId : null].filter(Boolean).join(' ') || undefined;
    const modalKind = modalKindFor(actions, Boolean(children));
    const decisionPolicy = getOverlayDecisionPolicyRow(modalKind);
    const resolvedActionPlacement = resolveActionPlacement(actionPlacement, actions, Boolean(children));

    /* OVR-010: initial focus + restore — same lifecycle pattern as Settings modal (`presentation="modal"`). */
    useEffect(() => {
        pushModalFocusSnapshot();
        pushVerticalToolbarRovingPause();

        const focusInitialElement = window.requestAnimationFrame(() => {
            focusFirstTabbableOrContainer(modalRef.current);
        });

        return () => {
            window.cancelAnimationFrame(focusInitialElement);
            popVerticalToolbarRovingPause();
            popModalFocusSnapshot();
        };
    }, []);

    useEffect(() => {
        const onDocumentKeyDown = (event: KeyboardEvent): void => {
            handleTabFocusTrapEvent(event, modalRef.current);

            if (
                onEscape &&
                event.key === 'Escape' &&
                !event.defaultPrevented &&
                !event.repeat &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                targetAllowsOverlayEscape(event.target)
            ) {
                event.preventDefault();
                onEscape();
            }
        };

        document.addEventListener('keydown', onDocumentKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onDocumentKeyDown, true);
        };
    }, [onEscape]);

    useEffect(() => {
        document.body.dataset.overlayModalOpen = 'true';
        return () => {
            delete document.body.dataset.overlayModalOpen;
        };
    }, []);

    return (
        <div
            className={`${styles.backdrop} ${overlayToneClass(headerPlateTone)}`.trim()}
            onWheel={(event) => {
                if (event.target === event.currentTarget) {
                    event.preventDefault();
                }
            }}
        >
            <section
                aria-describedby={describedBy}
                aria-labelledby={titleId}
                aria-modal="true"
                className={`${styles.modal} ${overlayToneClass(headerPlateTone)} ${
                    actions.length === 0 ? styles.modalNoActions : ''
                }`.trim()}
                data-action-placement={resolvedActionPlacement}
                data-modal-kind={modalKind}
                data-overlay-size={modalKind}
                data-keyboard-contract={decisionPolicy.keyboardPath}
                data-stack-contract={decisionPolicy.backBehavior}
                data-one-hand-placement={decisionPolicy.oneHandPlacement}
                data-testid={testId}
                ref={modalRef}
                role="dialog"
                tabIndex={-1}
            >
                <div className={styles.mainColumn}>
                    {ornamentalHeaderPlate && quietHeaderPlate ? (
                        <div
                            className={`${styles.headerQuietBand} ${quietHeaderToneClass(headerPlateTone)}`.trim()}
                            data-testid="overlay-modal-quiet-header"
                        >
                            <ScreenTitle as="h3" className={styles.title} id={titleId} role="modal">
                                {title}
                            </ScreenTitle>
                        </div>
                    ) : ornamentalHeaderPlate ? (
                        <MetaFrame
                            className={`${styles.headerPlateFrame} ${headerPlateToneClass(headerPlateTone)}`.trim()}
                        >
                            <div className={styles.headerPlateWell}>
                                <ScreenTitle as="h3" className={styles.title} id={titleId} role="modal">
                                    {title}
                                </ScreenTitle>
                            </div>
                        </MetaFrame>
                    ) : (
                        <ScreenTitle as="h3" className={styles.title} id={titleId} role="modal">
                            {title}
                        </ScreenTitle>
                    )}
                    {subtitle && (
                        <p className={styles.subtitle} id={subtitleId}>
                            {subtitle}
                        </p>
                    )}
                    {children && (
                        <div className={styles.body} data-testid="overlay-modal-body" id={bodyId}>
                            {children}
                        </div>
                    )}
                </div>

                {actions.length > 0 ? (
                    <OverlayActionDock
                        actionClassName={styles.modalAction}
                        actions={actions}
                        className={styles.actions}
                        placement={resolvedActionPlacement}
                        testId="overlay-modal-actions"
                    />
                ) : null}
            </section>
        </div>
    );
};

export default OverlayModal;
