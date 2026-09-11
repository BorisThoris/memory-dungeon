import { VIEWPORT_MOBILE_MAX, VIEWPORT_TABLET_MAX } from './breakpoints';

/**
 * How far the UI scale may actually be turned up, and why those numbers and not others.
 *
 * These were three literals inside `App.tsx` behind a variable called `safeUiScale`, with a
 * one-line comment and nothing that ever checked the word "safe". Gen 222 checked it, by running
 * the fit contract's own report at a scale other than 1 for the first time
 * (`e2e/ui-scale-ceiling.spec.ts`; every check the contract makes pins `uiScale: 1`). Measured, on
 * the two windows a launch checklist names:
 *
 *   scale   Settings          main menu         Profile
 *   1.00    fits              fits              fits
 *   1.05    fits              fits              fits
 *   1.10    fits (see below)  Deck fits, desktop loses its meta frame
 *   1.15    fits (see below)  both lose the meta frame
 *   2.00    -                 -                 fits
 *
 * Two separate defects behind that, one fixed here and one not:
 *
 * - **Settings could not be saved or left.** Its shell was `100dvh` tall inside a `zoom`, and a
 *   viewport unit does not zoom - so the shell ran past the bottom edge by exactly the scale, and
 *   Back and Save went with it, identically at 1280x800 and 1440x900 because the surplus follows
 *   the scale rather than the window. `--ui-zoomed-dvh` in `App.module.css` is the fix, and the
 *   screen now fits at every scale the app will apply.
 * - **The main menu has no layout below about 700px of container height.** Its container-query
 *   ladder ends at `max-height: 760px`, which is why the Deck's shorter panel FITS at 1.1 where the
 *   taller desktop does not: at 1280x800 the zoomed container falls under 760 and picks the compact
 *   arrangement, and at 1440x900 it does not. That is a missing rung, not a unit bug, and it is a
 *   layout job with its own task rather than something to guess at here.
 *
 * So the cap is the largest scale at which every screen still holds: **1.05**. That is small, and
 * saying why is better than leaving a number that looks considered. It is not a judgement about how
 * much scaling players need - Xbox's guidelines ask for 200% and this is nowhere near it
 * (`docs/RESEARCH_NOTES.md` §3) - it is the most this build can render without losing a control.
 * The cap rises when the main menu gets its missing rung, and `uiScaleLimits.test.ts` fails if this
 * constant moves without the spec that measured it moving too.
 */
export const UI_SCALE_MAX = 1.05;

/**
 * Compact windows - phones, and short landscape that is not a wide desktop - lay out at 1 and do
 * not scale at all. They already choose their stacked arrangement, which is the one that measured
 * as fitting at every scale up to 2; the reason they stay at 1 is that their text is already sized
 * for a small screen held close, not that they would break.
 */
export const UI_SCALE_COMPACT = 1;

export interface UiScaleViewport {
    height: number;
    width: number;
}

/** Wide short landscape (1280x720 and the like): roomy density and the outer scale, not phone rules. */
export const isShortLandscapeDesktop = ({ height, width }: UiScaleViewport): boolean =>
    width > VIEWPORT_TABLET_MAX && width > height && height > 0 && height <= VIEWPORT_MOBILE_MAX;

export const isCompactUiViewport = (viewport: UiScaleViewport): boolean =>
    viewport.width <= VIEWPORT_MOBILE_MAX ||
    (viewport.height <= VIEWPORT_MOBILE_MAX && !isShortLandscapeDesktop(viewport));

/** The scale the app applies: what the player asked for, held to what this build can render. */
export const safeUiScaleFor = (requested: number, viewport: UiScaleViewport): number => {
    const asked = Number.isFinite(requested) ? requested : UI_SCALE_COMPACT;
    if (isCompactUiViewport(viewport)) {
        return UI_SCALE_COMPACT;
    }
    return Math.min(asked, UI_SCALE_MAX);
};
