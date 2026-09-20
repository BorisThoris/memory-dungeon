import { VIEWPORT_MOBILE_MAX, VIEWPORT_TABLET_MAX } from './breakpoints';

/**
 * How far the UI scale may actually be turned up, and which screen decides it.
 *
 * These were three literals inside `App.tsx` behind a variable called `safeUiScale`, with a
 * one-line comment and nothing that ever checked the word "safe". Gen 222 checked it by running
 * the fit contract's own report at a scale other than 1 for the first time
 * (`e2e/ui-scale-ceiling.spec.ts`; every check the contract makes pins `uiScale: 1`), and wrote
 * down 1.05 with the main menu named as the blocker: its container-query ladder ended at
 * `max-height: 760px` with no rung below it.
 *
 * **Gen 227 re-measured, and the recorded reason was wrong twice over.** Gen 223 had already
 * refuted the ladder story - the `@container` rungs were never winning the cascade, so widening
 * them changed no output at any scale - and the menu has since been rebuilt as a fluid title page
 * with no ladder at all. Measured again with both caps lifted, on the two windows a launch
 * checklist names, at 1.1 / 1.4 / 1.6 / 1.8 / 2:
 *
 *   screen      holds to   first failure and what it is
 *   main menu   1.6        1.8: entry notes hit their ellipsis, title and numeral overlap at 1280
 *   settings    1.4        1.6: the layout-style row starts scrolling on the Deck panel
 *   profile     1.1        1.4: objective cards clip their progress line, the pager overlaps
 *
 * So the main menu is now the MOST scalable of the three, and the screen that actually sets the
 * cap is **Profile** - the one nothing had ever named. The numbers are the largest *probed* scale
 * that holds, not a bisection: settings' true ceiling is somewhere in [1.4, 1.6) and Profile's in
 * [1.1, 1.4), and recording the probe step rather than a figure nothing measured is the point.
 *
 * The cap is the smallest of them, so it is derived rather than restated: a screen that gets its
 * layout fixed raises the cap by moving its own row, and one that regresses lowers it in the same
 * place. `ui-scale-ceiling.spec.ts` holds both directions - every screen fits at its own ceiling,
 * and every screen FAILS at the next step above it, because a ceiling nothing has been measured to
 * break through is a ceiling nobody has checked and may simply be too low.
 *
 * It is still not a judgement about how much scaling players need: Xbox's guidelines ask for 200%
 * (`docs/RESEARCH_NOTES.md` §3) and this is nowhere near it. It is the most this build can render
 * without losing a control.
 */
export const SCREEN_SCALE_CEILINGS = {
    'main menu': 1.6,
    profile: 1.1,
    settings: 1.4
} as const satisfies Record<string, number>;

/** The cap: the smallest screen ceiling, because the scale is one setting for the whole app. */
export const UI_SCALE_MAX: number = Math.min(...Object.values(SCREEN_SCALE_CEILINGS));

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
