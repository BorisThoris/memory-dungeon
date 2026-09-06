import type { SVGProps } from 'react';

/** Shared props for in-game toolbar / flyout vector icons (TASK icon family). */
export type GameplayIconProps = SVGProps<SVGSVGElement>;

const base = {
    'aria-hidden': true as const,
    viewBox: '0 0 24 24' as const
};

export function GameplayPauseIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M8 5.5v13" />
            <path d="M16 5.5v13" />
        </svg>
    );
}

export function GameplayPlayIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M9 7.25 17 12l-8 4.75V7.25Z" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function GameplaySettingsIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <circle cx="12" cy="12" r="3.25" />
            <circle cx="12" cy="12" r="6.4" />
            <path d="M12 2.75v2.2" />
            <path d="M12 19.05v2.2" />
            <path d="m4.93 4.93 1.56 1.56" />
            <path d="m17.51 17.51 1.56 1.56" />
            <path d="M2.75 12h2.2" />
            <path d="M19.05 12h2.2" />
            <path d="m4.93 19.07 1.56-1.56" />
            <path d="m17.51 6.49 1.56-1.56" />
        </svg>
    );
}

export function GameplayMenuIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M5 7.5h14" />
            <path d="M5 12h14" />
            <path d="M5 16.5h14" />
        </svg>
    );
}

export function GameplayFitBoardIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M5 9V5h4" />
            <path d="M15 5h4v4" />
            <path d="M19 15v4h-4" />
            <path d="M9 19H5v-4" />
        </svg>
    );
}

export function GameplayShuffleIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M4 8h4l2-3h6" />
            <path d="M4 16h4l2 3h6" />
            <path d="M17 5l3 3-3 3" />
            <path d="M17 19l3-3-3-3" />
        </svg>
    );
}

export function GameplayPinIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M12 3v8" />
            <path d="M8 11h8l-2 10H10L8 11Z" />
        </svg>
    );
}

export function GameplayDestroyIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
            <rect height="14" rx="1.5" width="10" x="7" y="5" />
        </svg>
    );
}

export function GameplayPeekIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <ellipse cx="12" cy="12" rx="9" ry="5.5" />
            <circle cx="12" cy="12" r="2.75" />
        </svg>
    );
}

export function GameplayUndoIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M9 14 4 9l5-5" fill="none" />
            <path d="M5 9h11a4 4 0 0 1 4 4v0" fill="none" />
        </svg>
    );
}

/** A speech bubble: the dock's one control that talks to something rather than moving tiles. */
export function GameplayGreetIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M4 6h16v10H10l-4 4v-4H4z" />
            <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
        </svg>
    );
}

export function GameplayStrayIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M7 7h10v10H7z" />
            <path d="M10 10h4v4h-4z" fill="currentColor" opacity="0.35" />
        </svg>
    );
}
