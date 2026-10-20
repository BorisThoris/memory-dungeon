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

/** Four corners closing on a frame: the camera control, bringing the whole board back on screen. */
export function GameplayFitIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" />
            <rect height="6" rx="1" width="8" x="8" y="9" />
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

/** A doorway with a step out of it: the floor exit, once the card has popped off the board. */
export function GameplayExitIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M14 4H6v16h8" />
            <path d="M11 12h9" />
            <path d="m17 9 3 3-3 3" />
        </svg>
    );
}

/** The Zone's flame: a tongue of fire with an inner tongue, the dock's Ignite. */
export function GameplayIgniteIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 8 11.5c0-1.5.6-2.6 1.4-3.5.2 1.3.9 2 1.6 2.3C11.5 8 11 5.5 12 3Z" />
            <path d="M9 17.5c0 2 1.3 3.5 3 3.5s3-1.5 3-3.5c0-1.3-.8-2.2-1.5-3-.2 1-.7 1.5-1.5 1.7-.6-.4-.9-1.1-.8-2-.9.7-2.2 1.8-2.2 3.3Z" />
        </svg>
    );
}

/** The Hold (`hold-rules.ts`): a spark kept between two cupped hands. */
export function GameplayHoldIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M4 11c0 5 3.5 8 8 8s8-3 8-8" />
            <path d="M4 11l2.5 1.5M20 11l-2.5 1.5" />
            <path d="M12 5.5l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4Z" />
        </svg>
    );
}

export function GameplayBombIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <circle cx="11" cy="14" r="6.5" />
            <path d="M15.5 9.5 18 7" />
            <path d="M18.5 4.5v1.5M21 7h-1.5M20.3 5.2l-1 1" />
        </svg>
    );
}

/** The Crucible: a melting pot over a flame, the dock's curio that recasts an element. */
export function GameplayCrucibleIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M5 7h14l-1.6 7.5a5.5 5.5 0 0 1-10.8 0Z" fill="none" />
            <path d="M8.5 10.5c1.2.8 2.3.8 3.5 0s2.3-.8 3.5 0" />
            <path d="M12 4.5v-1.5M9 5l-.6-1.3M15 5l.6-1.3" />
        </svg>
    );
}

/** The Storm Glass: an hourglass-shaped vial with a bolt inside, the dock's curio that calls the weather. */
export function GameplayStormGlassIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M7 3h10M7 21h10" />
            <path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" fill="none" />
            <path d="m12.6 8.5-1.6 3h2l-1.6 3" />
        </svg>
    );
}

/** The Still Bell: a hand bell with its clapper. */
export function GameplayBellIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M12 4.5c-3.6 0-5.5 2.8-5.5 6.2v3.4L4.8 17h14.4l-1.7-2.9v-3.4c0-3.4-1.9-6.2-5.5-6.2Z" fill="none" />
            <path d="M10.2 19.5a1.9 1.9 0 0 0 3.6 0M12 2.5v2" />
        </svg>
    );
}

/** The Miser's Purse: a drawstring purse with a coin at its mouth. */
export function GameplayPurseIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M8.5 8.5c-3 2.2-4 5.4-3 8.2C6.4 19.3 9 20.5 12 20.5s5.6-1.2 6.5-3.8c1-2.8 0-6-3-8.2" fill="none" />
            <path d="M8.5 8.5h7M9.5 8.5 8 5.5h8l-1.5 3" fill="none" />
            <circle cx="12" cy="14.5" r="2" />
        </svg>
    );
}

/** The satchel a phone's dock folds its tools into. */
export function GameplayItemsIcon({ className, ...rest }: GameplayIconProps) {
    return (
        <svg {...base} className={className} {...rest}>
            <path d="M9 7V5.5a3 3 0 0 1 6 0V7" fill="none" />
            <path d="M5 8h14l-1.2 11H6.2Z" fill="none" />
            <path d="M9.5 12h5" />
        </svg>
    );
}
