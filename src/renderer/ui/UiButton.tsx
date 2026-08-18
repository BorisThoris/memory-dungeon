import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './classNames';
import styles from './UiButton.module.css';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'debug';
export type UiButtonSize = 'sm' | 'md' | 'lg';

export interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: UiButtonVariant;
    size?: UiButtonSize;
    fullWidth?: boolean;
    children: ReactNode;
}

const UiButton = ({
    variant = 'secondary',
    size = 'md',
    fullWidth = false,
    className = '',
    type = 'button',
    children,
    ...rest
}: UiButtonProps) => (
    <button
        className={cx(styles.root, styles[size], styles[variant], fullWidth && styles.fullWidth, className)}
        data-ui-size={size}
        data-ui-variant={variant}
        type={type}
        {...rest}
    >
        {children}
    </button>
);

export default UiButton;
