import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './classNames';
import styles from './Eyebrow.module.css';

type EyebrowTone = 'default' | 'tight' | 'menu';

interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
    children: ReactNode;
    tone?: EyebrowTone;
}

const Eyebrow = ({ children, tone = 'default', className = '', ...rest }: EyebrowProps) => (
    <p
        className={cx(styles.root, tone === 'tight' && styles.tight, tone === 'menu' && styles.menu, className)}
        {...rest}
    >
        {children}
    </p>
);

export default Eyebrow;
