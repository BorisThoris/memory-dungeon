import type { ReactNode } from 'react';
import UiButton, { type UiButtonSize, type UiButtonVariant } from './UiButton';
import styles from './OverlayActionDock.module.css';

export type OverlayActionPlacement = 'rail' | 'dock';

export interface OverlayAction {
    label: string;
    description?: string;
    ariaLabel?: string;
    onClick: () => void;
    variant?: Extract<UiButtonVariant, 'primary' | 'secondary' | 'danger'>;
    disabled?: boolean;
}

interface OverlayActionDockProps {
    actions: readonly OverlayAction[];
    placement: OverlayActionPlacement;
    size?: UiButtonSize;
    className?: string;
    actionClassName?: string;
    testId?: string;
    leading?: ReactNode;
    /** Open the dialog on the first primary action even when the body has controls before it. */
    focusPrimaryFirst?: boolean;
}

const isPrimaryAction = (action: OverlayAction): boolean => (action.variant ?? 'primary') === 'primary';

const OverlayActionDock = ({
    actions,
    placement,
    size = 'md',
    className = '',
    actionClassName = '',
    testId = 'overlay-action-dock',
    leading,
    focusPrimaryFirst = false
}: OverlayActionDockProps) => {
    const secondaryActions = actions.filter((action) => !isPrimaryAction(action));
    const primaryActions = actions.filter(isPrimaryAction);

    const renderAction = (action: OverlayAction, index: number) => (
        <UiButton
            aria-label={action.ariaLabel}
            className={`${styles.actionButton} ${actionClassName}`.trim()}
            data-modal-initial-focus={focusPrimaryFirst && isPrimaryAction(action) && index === 0 ? '' : undefined}
            data-variant={action.variant ?? 'primary'}
            disabled={action.disabled}
            key={`${action.label}:${index}`}
            onClick={action.onClick}
            size={size}
            variant={action.variant ?? 'primary'}
        >
            {action.description ? (
                <span className={styles.actionContent}>
                    <span>{action.label}</span>
                    <small>{action.description}</small>
                </span>
            ) : (
                action.label
            )}
        </UiButton>
    );

    if (placement === 'rail') {
        return (
            <div
                className={`${styles.root} ${styles.rail} ${className}`.trim()}
                data-action-placement={placement}
                data-testid={testId}
            >
                {actions.map(renderAction)}
            </div>
        );
    }

    return (
        <div
            className={`${styles.root} ${styles[placement]} ${className}`.trim()}
            data-action-placement={placement}
            data-testid={testId}
        >
            {leading ? <div className={styles.leading}>{leading}</div> : null}
            {/* The primary action is first in the DOM: the focus trap lands on the first tabbable
                control, and Tab from there walks the secondaries. On a wide dock the grid areas
                still draw it at the right; on a narrow one the stack reads in this order, which is
                the order it used to fake with CSS `order` while focus opened on the wrong button. */}
            <div className={styles.primaryGroup}>{primaryActions.map(renderAction)}</div>
            <div className={styles.secondaryGroup}>{secondaryActions.map(renderAction)}</div>
        </div>
    );
};

export default OverlayActionDock;
