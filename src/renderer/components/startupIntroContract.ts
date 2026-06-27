import type { IntroPlaybackState } from './startupIntroConfig';

type StartupIntroAssetState = 'loading' | 'ready' | 'fallback';
type StartupIntroSkipState = 'idle' | 'requested';
type StartupIntroHydrationState = 'hydrating' | 'menu-ready' | 'non-menu-view';

interface StartupIntroAppContractInput {
    hydrated: boolean;
    introPlayback: Exclude<IntroPlaybackState, 'playing'>;
    view: string;
}

interface StartupIntroAppContract {
    hydrationState: StartupIntroHydrationState;
    menuAriaHidden: boolean;
    menuPointerState: 'blocked' | 'interactive';
    overlayVisible: boolean;
    renderMenuShell: boolean;
    returnFocusTestId: 'main-menu-focus-root';
}

interface StartupIntroOverlayContractInput {
    assetsReady: boolean;
    renderMode: 'three' | 'fallback';
    skipPending: boolean;
}

interface StartupIntroOverlayContract {
    assetState: StartupIntroAssetState;
    loadingLabel: string | null;
    skipState: StartupIntroSkipState;
}

/**
 * REG-034: one narrow contract for the fragile boot boundary. App owns hydration/menu pointer
 * blocking; StartupIntro owns asset readiness and skip-pending copy. Keeping this pure lets
 * component/e2e tests assert behavior without depending on animation timing.
 */
export const resolveStartupIntroAppContract = ({
    hydrated,
    introPlayback,
    view
}: StartupIntroAppContractInput): StartupIntroAppContract => {
    const hydrationState: StartupIntroHydrationState = !hydrated
        ? 'hydrating'
        : view === 'menu'
          ? 'menu-ready'
          : 'non-menu-view';
    const overlayVisible = introPlayback === 'pending' && (!hydrated || view === 'menu');
    const renderMenuShell = (hydrated && view === 'menu') || (!hydrated && introPlayback === 'pending');
    const menuPointerState = overlayVisible ? 'blocked' : 'interactive';

    return {
        hydrationState,
        menuAriaHidden: overlayVisible,
        menuPointerState,
        overlayVisible,
        renderMenuShell,
        returnFocusTestId: 'main-menu-focus-root'
    };
};

export const resolveStartupIntroOverlayContract = ({
    assetsReady,
    renderMode,
    skipPending
}: StartupIntroOverlayContractInput): StartupIntroOverlayContract => {
    const assetState: StartupIntroAssetState = assetsReady ? (renderMode === 'fallback' ? 'fallback' : 'ready') : 'loading';
    const skipState: StartupIntroSkipState = skipPending ? 'requested' : 'idle';
    const loadingLabel = assetsReady
        ? null
        : skipPending
          ? 'Skip requested — preparing a safe intro fallback…'
          : 'Preparing intro assets…';

    return {
        assetState,
        loadingLabel,
        skipState
    };
};

export const STARTUP_INTRO_ASSET_FAILSAFE_MS = 3500;
