/** Match renderer CSS `@media` thresholds (mobile / tablet / tight phone). */

export const VIEWPORT_MOBILE_MAX = 760;
export const VIEWPORT_TABLET_MAX = 1220;

/**
 * Landscape viewports with limited height (phones, 1280×720, short laptops).
 * Align shell `@media (max-height: 860px)` rules with this value.
 */
export const VIEWPORT_SHORT_LANDSCAPE_MAX_HEIGHT = 860;

export const isShortLandscapeViewport = (width: number, height: number): boolean =>
    width > height && height > 0 && height <= VIEWPORT_SHORT_LANDSCAPE_MAX_HEIGHT;

/**
 * Max width (CSS px) at which short landscape still stacks main-menu hero + support to one column.
 * Wider short HD (e.g. 1280×720, 1920×720) keeps two columns; narrow cases (844×390, 900×700) stack.
 */
export const VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH = 960;

export const isNarrowShortLandscapeForMenuStack = (width: number, height: number): boolean =>
    isShortLandscapeViewport(width, height) && width <= VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH;

/*
 * `safeSubscribeWindowResize` and `readWindowInnerSizeFallback` were here, reached by nothing but
 * their own test, and they were strictly weaker than the path the app actually uses.
 *
 * `src/renderer/hooks/useViewportSize.ts` prefers `window.visualViewport` over `innerWidth`, coalesces updates
 * through `requestAnimationFrame`, and listens for `orientationchange` and the visual viewport's own
 * resize as well as the window's. The two helpers here read `innerWidth` and listened to `resize`
 * alone. On a Deck or a phone the visual viewport is the one that moves - the layout viewport does
 * not shrink for an on-screen keyboard - and reading the wrong one is the same mistake this session
 * found three times in painted-versus-layout px. A helper whose comment says to prefer it over the
 * thing it is worse than is worth deleting rather than keeping (Gen 258).
 *
 * Their SSR default, 1280x800, did match `useViewportSize`'s; that part of the comment was true.
 */
