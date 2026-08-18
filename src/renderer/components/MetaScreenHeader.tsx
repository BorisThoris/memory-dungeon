import type { ReactNode } from 'react';
import { Eyebrow, ScreenTitle, type ScreenTitleRole, type ScreenTitleTag } from '../ui';
import metaStyles from './MetaScreen.module.css';

interface MetaScreenHeaderProps {
    action?: ReactNode;
    eyebrow: string;
    eyebrowTone?: 'default' | 'tight' | 'menu';
    className?: string;
    compact?: boolean;
    pretitle?: ReactNode;
    subtitle: ReactNode;
    subtitleClassName?: string;
    textClassName?: string;
    title: ReactNode;
    titleAs?: ScreenTitleTag;
    titleClassName?: string;
    titleRole: ScreenTitleRole;
}

const MetaScreenHeader = ({
    action,
    eyebrow,
    eyebrowTone = 'menu',
    className,
    compact = false,
    pretitle,
    subtitle,
    subtitleClassName,
    textClassName,
    title,
    titleAs,
    titleClassName,
    titleRole
}: MetaScreenHeaderProps) => (
    <header className={[metaStyles.header, compact && metaStyles.compactHeader, className].filter(Boolean).join(' ')}>
        <div className={[metaStyles.headerText, compact && metaStyles.compactHeaderText, textClassName].filter(Boolean).join(' ')}>
            {pretitle}
            <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>
            <ScreenTitle as={titleAs} className={titleClassName} role={titleRole}>
                {title}
            </ScreenTitle>
            <p className={[metaStyles.subtitle, subtitleClassName].filter(Boolean).join(' ')}>{subtitle}</p>
        </div>
        {action}
    </header>
);

export default MetaScreenHeader;
