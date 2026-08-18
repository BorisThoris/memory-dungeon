import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './classNames';
import styles from './StatTile.module.css';

export type StatTileDensity = 'default' | 'compact' | 'dense' | 'modalChild' | 'minimal';

interface StatTileProps extends HTMLAttributes<HTMLElement> {
    label: string;
    value: ReactNode;
    density?: StatTileDensity;
    valueAccent?: boolean;
    valueLg?: boolean;
    /** Puts the numeric/title line above the caption (modal stat grids). */
    valueFirst?: boolean;
}

const StatTile = ({
    label,
    value,
    density = 'default',
    valueAccent = false,
    valueLg = false,
    valueFirst = false,
    className = '',
    ...rest
}: StatTileProps) => (
    <article
        className={cx(
            styles.root,
            density === 'compact' && styles.compact,
            density === 'dense' && styles.dense,
            density === 'modalChild' && styles.modalChild,
            density === 'minimal' && styles.minimal,
            valueFirst && styles.valueFirst,
            className
        )}
        {...rest}
    >
        <span className={styles.label}>{label}</span>
        <strong className={cx(styles.value, valueAccent && styles.valueAccent, valueLg && styles.valueLg)}>
            {value}
        </strong>
    </article>
);

export default StatTile;
