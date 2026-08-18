import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from './classNames';
import styles from './Panel.module.css';

export type PanelVariant = 'default' | 'strong' | 'muted' | 'accent';
export type PanelPadding = 'none' | 'md' | 'lg' | 'section';

export type PanelTag = 'div' | 'section';

interface PanelProps extends HTMLAttributes<HTMLElement> {
    children: ReactNode;
    as?: PanelTag;
    variant?: PanelVariant;
    padding?: PanelPadding;
    maxViewportHeight?: boolean;
    scrollable?: boolean;
}

const paddingClass: Record<PanelPadding, string> = {
    none: '',
    md: styles.paddingMd,
    lg: styles.paddingLg,
    section: styles.paddingSection
};

const Panel = ({
    as: Tag = 'div',
    children,
    variant = 'default',
    padding = 'md',
    maxViewportHeight = false,
    scrollable = false,
    className = '',
    ...rest
}: PanelProps) =>
    createElement(
        Tag,
        {
            className: cx(
                styles.root,
                styles[variant],
                paddingClass[padding],
                maxViewportHeight && styles.maxHeightViewport,
                scrollable && styles.overflowAuto,
                className
            ),
            ...rest
        },
        children
    );

export default Panel;
