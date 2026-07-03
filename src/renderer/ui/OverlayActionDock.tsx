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
}

const isPrimaryAction = (action: OverlayAction): boolean => (action.variant ?? 'primary') === 'primary';

const OverlayActionDock = ({
    actions,
    placement,
    size = 'md',
    className = '',
    actionClassName = '',
    testId = 'overlay-action-dock',
    leading
}: OverlayActionDockProps) => {
    const secondaryActions = actions.filter((action) => !isPrimaryAction(action));
    const primaryActions = actions.filter(isPrimaryAction);

    const renderAction = (action: OverlayAction, index: number) => (
        <UiButton
            aria-label={action.ariaLabel}
            className={`${styles.actionButton} ${actionClassName}`.trim()}
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
            <div className={styles.secondaryGroup}>{secondaryActions.map(renderAction)}</div>
            <div className={styles.primaryGroup}>{primaryActions.map(renderAction)}</div>
        </div>
    );
};

export default OverlayActionDock;
