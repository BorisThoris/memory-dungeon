import type { ReactNode } from 'react';
import Eyebrow from './Eyebrow';
import ScreenTitle from './ScreenTitle';
import UiButton from './UiButton';
import styles from './MetaShell.module.css';

/**
 * The frame every meta screen sits in: one header line, an optional toolbar, and a content
 * area that fits the viewport. Nothing here scrolls — content that does not fit is paged by
 * `FittedGrid` or collapsed into the toolbar, so the screen never grows a scrollbar.
 */

export interface MetaShellProps {
    /** Region label and the name announced to assistive tech. */
    label: string;
    eyebrow: string;
    title: string;
    /** One line under the title. Keep it to one. */
    subtitle?: ReactNode;
    /** Section rail, filter, tabs — whatever selects what the content area shows. */
    toolbar?: ReactNode;
    children: ReactNode;
    onBack: () => void;
    backLabel?: string;
    /** When true the title is an `h2` so GameScreen's level heading stays the only `h1`. */
    stackedOnGameplay?: boolean;
    testId?: string;
    className?: string;
    /** Extra attributes the screen wants on the region (data-* for e2e). */
    regionProps?: Record<string, string>;
}

const MetaShell = ({
    backLabel = 'Back',
    children,
    className,
    eyebrow,
    label,
    onBack,
    regionProps,
    stackedOnGameplay = false,
    subtitle,
    testId,
    title,
    toolbar
}: MetaShellProps) => (
    <section
        aria-label={label}
        className={[styles.shell, className].filter(Boolean).join(' ')}
        data-testid={testId}
        role="region"
        {...regionProps}
    >
        <header className={styles.header}>
            <div className={styles.headerText}>
                <Eyebrow tone="menu">{eyebrow}</Eyebrow>
                <ScreenTitle as={stackedOnGameplay ? 'h2' : 'h1'} className={styles.title} role="display">
                    {title}
                </ScreenTitle>
                {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
            <UiButton onClick={onBack} size="md" type="button" variant="secondary">
                {backLabel}
            </UiButton>
        </header>

        {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}

        <div className={styles.content}>{children}</div>
    </section>
);

export default MetaShell;
