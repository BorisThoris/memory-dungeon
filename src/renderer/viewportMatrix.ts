import {
    isNarrowShortLandscapeForMenuStack,
    isShortLandscapeViewport,
    VIEWPORT_MOBILE_MAX,
    VIEWPORT_TABLET_MAX
} from './breakpoints';

type ResponsiveViewportKind = 'phone_portrait' | 'phone_landscape' | 'tablet' | 'short_desktop' | 'desktop';
type ResponsiveSmokeScreen =
    | 'main_menu'
    | 'choose_path'
    | 'collection'
    | 'inventory'
    | 'codex'
    | 'settings'
    | 'gameplay'
    | 'pause_overlay'
    | 'floor_clear_overlay'
    | 'run_settings_modal'
    | 'game_over';

interface ResponsiveViewportCase {
    id: string;
    width: number;
    height: number;
    kind: ResponsiveViewportKind;
    mustShowPrimaryAction: true;
    primaryAssertions: string[];
}

interface ResponsiveScreenRoute {
    screen: ResponsiveSmokeScreen;
    requiredViewportIds: string[];
    primaryActionSelector: string;
    rationale: string;
    maxContentColumns: number;
    mustAvoidHorizontalScroll: true;
}

interface FinalDeviceGridSummary {
    screenCount: number;
    viewportCount: number;
    hasPhoneCoverage?: boolean;
    hasDesktopCoverage?: boolean;
    allScreensHavePrimarySelectors?: boolean;
    phoneCriticalScreens: ResponsiveSmokeScreen[];
    shortViewportIds: string[];
    everyRouteHasPhoneCoverage: boolean;
    everyRouteAvoidsHorizontalScroll: boolean;
}

export const HIGH_TRAFFIC_VIEWPORT_MATRIX: readonly ResponsiveViewportCase[] = [
    {
        id: 'phone_360x740',
        width: 360,
        height: 740,
        kind: 'phone_portrait',
        mustShowPrimaryAction: true,
        primaryAssertions: ['Play or current run action visible', 'no horizontal scroll', 'safe-area padding honored']
    },
    {
        id: 'phone_390x844',
        width: 390,
        height: 844,
        kind: 'phone_portrait',
        mustShowPrimaryAction: true,
        primaryAssertions: ['primary action above fold', 'modal footer reachable', 'board remains primary']
    },
    {
        id: 'phone_430x932',
        width: 430,
        height: 932,
        kind: 'phone_portrait',
        mustShowPrimaryAction: true,
        primaryAssertions: ['primary action above fold', 'secondary routes do not compete', 'touch targets readable']
    },
    {
        id: 'phone_landscape_844x390',
        width: 844,
        height: 390,
        kind: 'phone_landscape',
        mustShowPrimaryAction: true,
        primaryAssertions: ['compact landscape shell', 'primary action visible', 'footer/action rail not cropped']
    },
    {
        id: 'tablet_768x1024',
        width: 768,
        height: 1024,
        kind: 'tablet',
        mustShowPrimaryAction: true,
        primaryAssertions: ['tablet density uses non-phone layout where possible', 'meta actions reachable']
    },
    {
        id: 'short_desktop_1024x768',
        width: 1024,
        height: 768,
        kind: 'tablet',
        mustShowPrimaryAction: true,
        primaryAssertions: ['landscape tablet keeps board/menu action hierarchy', 'no modal footer clipping']
    },
    {
        id: 'short_wide_1366x640',
        width: 1366,
        height: 640,
        kind: 'short_desktop',
        mustShowPrimaryAction: true,
        primaryAssertions: ['short desktop density active', 'main actions reachable', 'desktop stage not sparse']
    },
    {
        id: 'desktop_1440x900',
        width: 1440,
        height: 900,
        kind: 'desktop',
        mustShowPrimaryAction: true,
        primaryAssertions: ['roomy desktop baseline', 'no compact-only overflow rules']
    }
] as const;

export const RESPONSIVE_VIEWPORT_MATRIX: readonly ResponsiveViewportCase[] = [...HIGH_TRAFFIC_VIEWPORT_MATRIX];

export const RESPONSIVE_SCREEN_ROUTES: readonly ResponsiveScreenRoute[] = [
    {
        screen: 'main_menu',
        requiredViewportIds: ['phone_360x740', 'phone_landscape_844x390', 'short_desktop_1024x768', 'desktop_1440x900'],
        primaryActionSelector: 'button[aria-label="Play"]',
        rationale: 'Hub entry must keep Play dominant before meta links.',
        maxContentColumns: 2,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'choose_path',
        requiredViewportIds: ['phone_390x844', 'phone_landscape_844x390', 'desktop_1440x900'],
        primaryActionSelector: '[data-testid="choose-path-launcher"] button, [data-gauntlet-presets] button, button[aria-label^="Play"]',
        rationale: 'Mode selection must keep at least one selectable/locked-path control visible.',
        maxContentColumns: 3,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'collection',
        requiredViewportIds: ['phone_390x844', 'tablet_768x1024', 'desktop_1440x900'],
        primaryActionSelector: '[data-testid="collection-entries"]',
        rationale: 'Reward gallery and meta rows must collapse cleanly from desktop grids to phone stacks.',
        maxContentColumns: 3,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'inventory',
        requiredViewportIds: ['phone_390x844', 'phone_landscape_844x390', 'desktop_1440x900'],
        primaryActionSelector: '[data-testid="inventory-prep-strip"]',
        rationale: 'Run prep/loadout/economy rows must remain reachable in menu and in-run shells.',
        maxContentColumns: 3,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'codex',
        requiredViewportIds: ['phone_390x844', 'tablet_768x1024', 'desktop_1440x900'],
        primaryActionSelector: '[data-testid="codex-knowledge-base-summary"]',
        rationale: 'Knowledge base filters, tabs, and TOC must stay usable without wide text overflow.',
        maxContentColumns: 3,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'settings',
        requiredViewportIds: ['phone_360x740', 'phone_landscape_844x390', 'short_wide_1366x640', 'desktop_1440x900'],
        primaryActionSelector: '[data-testid="settings-shell-footer"] button',
        rationale: 'Control-center rows, category chips, and sticky Back/Save must stay reachable.',
        maxContentColumns: 3,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'gameplay',
        requiredViewportIds: ['phone_360x740', 'phone_390x844', 'short_wide_1366x640', 'desktop_1440x900'],
        primaryActionSelector: '[data-testid="board-stage"]',
        rationale: 'Board-first gameplay is the most frequent viewport regression.',
        maxContentColumns: 2,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'pause_overlay',
        requiredViewportIds: ['phone_390x844', 'phone_landscape_844x390', 'short_wide_1366x640'],
        primaryActionSelector: '[data-testid="game-pause-overlay"] button',
        rationale: 'Pause decisions must not hide resume/exit actions.',
        maxContentColumns: 2,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'floor_clear_overlay',
        requiredViewportIds: ['phone_390x844', 'phone_landscape_844x390', 'short_wide_1366x640'],
        primaryActionSelector: '[role="dialog"] button',
        rationale: 'Continue and route/shop decisions must be reachable.',
        maxContentColumns: 2,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'run_settings_modal',
        requiredViewportIds: ['phone_360x740', 'phone_landscape_844x390', 'short_wide_1366x640'],
        primaryActionSelector: '[data-testid="settings-shell-footer"] button',
        rationale: 'Back/Save must remain in a sticky reachable footer.',
        maxContentColumns: 3,
        mustAvoidHorizontalScroll: true
    },
    {
        screen: 'game_over',
        requiredViewportIds: ['phone_360x740', 'phone_390x844', 'desktop_1440x900'],
        primaryActionSelector: '[data-testid="game-over-above-fold-summary"] button',
        rationale: 'Retry/menu loop must be above the fold on phones.',
        maxContentColumns: 2,
        mustAvoidHorizontalScroll: true
    }
] as const;

export const classifyResponsiveViewport = (width: number, height: number): ResponsiveViewportKind => {
    if (width <= VIEWPORT_MOBILE_MAX && height >= width) {
        return 'phone_portrait';
    }
    if (isNarrowShortLandscapeForMenuStack(width, height)) {
        return 'phone_landscape';
    }
    if (width <= VIEWPORT_TABLET_MAX) {
        return 'tablet';
    }
    if (isShortLandscapeViewport(width, height)) {
        return 'short_desktop';
    }
    return 'desktop';
};

export const responsiveViewportIdsForScreen = (screen: ResponsiveSmokeScreen): string[] =>
    [...(RESPONSIVE_SCREEN_ROUTES.find((route) => route.screen === screen)?.requiredViewportIds ?? [])];

export const getFinalDeviceGridSummary = (): FinalDeviceGridSummary => {
    const phoneIds = new Set(
        HIGH_TRAFFIC_VIEWPORT_MATRIX.filter((viewport) => viewport.kind === 'phone_portrait' || viewport.kind === 'phone_landscape').map(
            (viewport) => viewport.id
        )
    );
    const everyRouteHasPhoneCoverage = RESPONSIVE_SCREEN_ROUTES.every((route) =>
        route.requiredViewportIds.some((id) => phoneIds.has(id))
    );
    const hasDesktopCoverage = RESPONSIVE_SCREEN_ROUTES.some((route) =>
        route.requiredViewportIds.includes('desktop_1440x900')
    );
    return {
        screenCount: RESPONSIVE_SCREEN_ROUTES.length,
        viewportCount: HIGH_TRAFFIC_VIEWPORT_MATRIX.length,
        hasPhoneCoverage: everyRouteHasPhoneCoverage,
        hasDesktopCoverage,
        allScreensHavePrimarySelectors: RESPONSIVE_SCREEN_ROUTES.every((route) => route.primaryActionSelector.length > 0),
        phoneCriticalScreens: RESPONSIVE_SCREEN_ROUTES.filter((route) =>
            route.requiredViewportIds.some((id) => phoneIds.has(id))
        ).map((route) => route.screen),
        shortViewportIds: HIGH_TRAFFIC_VIEWPORT_MATRIX.filter((viewport) => viewport.height <= 768).map((viewport) => viewport.id),
        everyRouteHasPhoneCoverage,
        everyRouteAvoidsHorizontalScroll: RESPONSIVE_SCREEN_ROUTES.every((route) => route.mustAvoidHorizontalScroll)
    };
};

export const responsiveMatrixFinalDeviceGridSummary = (): FinalDeviceGridSummary => getFinalDeviceGridSummary();

export const getViewportRegressionExpectations = (
    id: string
): {
    compactDensity: boolean;
    menuStacks: boolean;
    settingsLayout: 'stacked' | 'short-stacked' | 'wide-short' | 'desktop';
} => {
    const viewport = HIGH_TRAFFIC_VIEWPORT_MATRIX.find((entry) => entry.id === id);
    if (!viewport) {
        throw new Error(`Unknown viewport id: ${id}`);
    }
    const compactDensity =
        viewport.width <= VIEWPORT_MOBILE_MAX ||
        isShortLandscapeViewport(viewport.width, viewport.height) ||
        (viewport.height <= VIEWPORT_MOBILE_MAX && viewport.width <= VIEWPORT_TABLET_MAX);
    const menuStacks = viewport.width <= VIEWPORT_MOBILE_MAX || isNarrowShortLandscapeForMenuStack(viewport.width, viewport.height);
    const shortLandscape = isShortLandscapeViewport(viewport.width, viewport.height);
    const settingsLayout =
        shortLandscape && menuStacks
            ? 'short-stacked'
            : shortLandscape
              ? 'wide-short'
              : viewport.width <= VIEWPORT_MOBILE_MAX
                ? 'stacked'
                : 'desktop';
    return { compactDensity, menuStacks, settingsLayout };
};
