import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from './classNames';
import styles from './ScreenTitle.module.css';

/**
 * Heading outline (A11Y-007):
 * - One document-level `h1` per active route stack. Full meta routes use `role="display"` as `h1`; gameplay
 *   uses an `h1` for the current level (see `GameScreen`).
 * - Meta shells opened on top of gameplay (inventory/codex modal) demote the shell title to `h2` via props
 *   on those screens so the level `h1` stays canonical.
 * - `OverlayModal` uses `role="modal"` → default `h3` under the active route heading.
 * - Settings: full page uses `h1` shell + `h2` pane title; in-run modal uses `h2` + `h3` under the level `h1`.
 */

export type ScreenTitleRole = 'display' | 'screen' | 'screenMd' | 'screenLg' | 'modal' | 'section';

export type ScreenTitleTag = 'h1' | 'h2' | 'h3';

interface ScreenTitleProps extends HTMLAttributes<HTMLHeadingElement> {
    children: ReactNode;
    role: ScreenTitleRole;
    as?: ScreenTitleTag;
}

const roleClass: Record<ScreenTitleRole, string> = {
    display: styles.display,
    screen: styles.screen,
    screenMd: styles.screenMd,
    screenLg: styles.screenLg,
    modal: styles.modal,
    section: styles.section
};

const defaultTag: Record<ScreenTitleRole, ScreenTitleTag> = {
    display: 'h1',
    screen: 'h1',
    screenMd: 'h2',
    screenLg: 'h1',
    modal: 'h3',
    section: 'h2'
};

const ScreenTitle = ({ children, role, as, className = '', ...rest }: ScreenTitleProps) => {
    const Tag = as ?? defaultTag[role];

    return createElement(
        Tag,
        {
            className: cx(styles.root, roleClass[role], className),
            ...rest
        },
        children
    );
};

export default ScreenTitle;
