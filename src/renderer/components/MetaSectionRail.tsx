import type { MouseEvent, RefObject } from 'react';
import metaStyles from './MetaScreen.module.css';
import { handleMetaBodyTocLinkClick } from './metaScreenTocNav';

export interface MetaSectionRailItem {
    compactLabel?: string;
    href: string;
    label: string;
}

interface MetaSectionRailProps {
    ariaLabel: string;
    bodyScrollRef: RefObject<HTMLElement | null>;
    className?: string;
    compact?: boolean;
    dataTestId?: string;
    items: readonly MetaSectionRailItem[];
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

const MetaSectionRail = ({
    ariaLabel,
    bodyScrollRef,
    className,
    compact = false,
    dataTestId,
    items,
    onNavigate
}: MetaSectionRailProps) => (
    <nav
        aria-label={ariaLabel}
        className={[metaStyles.inPageToc, compact && metaStyles.compactRail, className].filter(Boolean).join(' ')}
        data-testid={dataTestId}
    >
        {items.map((item) => (
            <a
                aria-label={compact && item.compactLabel ? item.label : undefined}
                data-compact-label={item.compactLabel}
                href={item.href}
                key={item.href}
                onClick={(event) => {
                    onNavigate?.(event);
                    handleMetaBodyTocLinkClick(bodyScrollRef, event);
                }}
            >
                <span>{item.label}</span>
            </a>
        ))}
    </nav>
);

export default MetaSectionRail;
