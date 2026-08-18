import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './classNames';
import styles from './AccentBanner.module.css';

interface AccentBannerProps extends HTMLAttributes<HTMLParagraphElement> {
    children: ReactNode;
    compact?: boolean;
}

const AccentBanner = ({ children, compact = false, className = '', ...rest }: AccentBannerProps) => (
    <p className={cx(styles.root, compact && styles.compact, className)} {...rest}>
        {children}
    </p>
);

export default AccentBanner;
