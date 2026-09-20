import { classifyResponsiveViewport } from './viewportMatrix';

/**
 * The four shapes the in-run shell is drawn for. One name per shape, published on the game
 * shell as `data-shell-layout`, so the CSS and the overlays that position themselves in TS
 * agree on which shape they are in instead of each re-deriving it from a different threshold.
 *
 * - `phone-portrait`: a phone held upright; the board fills the width and the thumb covers the
 *   bottom third.
 * - `phone-landscape`: a phone held sideways; height is the scarce axis, the HUD and dock are
 *   already most of it.
 * - `tablet`: wider than a phone, narrower than a desktop window; either orientation.
 * - `desktop`: a roomy window, including short HD (1280×720) which keeps desktop framing.
 */
export type GameShellLayout = 'phone-portrait' | 'phone-landscape' | 'tablet' | 'desktop';

/** How the player reaches the board: a finger that hides what it touches, or a pointer that does not. */
export type GameShellInputMode = 'touch' | 'pointer';

export type GameShellOrientation = 'portrait' | 'landscape';

export interface GameShellProfile {
    layout: GameShellLayout;
    input: GameShellInputMode;
    orientation: GameShellOrientation;
}

export const resolveGameShellLayout = (width: number, height: number): GameShellLayout => {
    switch (classifyResponsiveViewport(width, height)) {
        case 'phone_portrait':
            return 'phone-portrait';
        case 'phone_landscape':
            return 'phone-landscape';
        case 'tablet':
            return 'tablet';
        default:
            return 'desktop';
    }
};

export const resolveGameShellOrientation = (width: number, height: number): GameShellOrientation =>
    width > height ? 'landscape' : 'portrait';

export const resolveGameShellProfile = (width: number, height: number, coarsePointer: boolean): GameShellProfile => ({
    layout: resolveGameShellLayout(width, height),
    input: coarsePointer ? 'touch' : 'pointer',
    orientation: resolveGameShellOrientation(width, height)
});
