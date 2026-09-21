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
    /** Tracked preload steps settled so far; omitted by callers that do not report progress. */
    loadedSteps?: number;
    renderMode: 'three' | 'fallback';
    skipPending: boolean;
    /** Copy for the step that most recently landed. */
    stepLabel?: string | null;
    totalSteps?: number;
}

interface StartupIntroOverlayContract {
    assetState: StartupIntroAssetState;
    loadingLabel: string | null;
    /** 0–1, for the loading rail's width. Always 1 once assets are ready. */
    progress: number;
    /** Whole percent, for `aria-valuenow` and the readout. */
    progressPercent: number;
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

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export const resolveStartupIntroOverlayContract = ({
    assetsReady,
    loadedSteps = 0,
    renderMode,
    skipPending,
    stepLabel = null,
    totalSteps = 0
}: StartupIntroOverlayContractInput): StartupIntroOverlayContract => {
    const assetState: StartupIntroAssetState = assetsReady ? (renderMode === 'fallback' ? 'fallback' : 'ready') : 'loading';
    const skipState: StartupIntroSkipState = skipPending ? 'requested' : 'idle';
    // Skip copy outranks step copy: once a skip is pending, what the rail is waiting for stops
    // being interesting and the player needs to know their input was taken.
    const loadingLabel = assetsReady
        ? null
        : skipPending
          ? 'Skip requested — preparing a safe intro fallback…'
          : (stepLabel ?? 'Preparing intro assets…');
    const progress = assetsReady ? 1 : totalSteps > 0 ? clamp01(loadedSteps / totalSteps) : 0;

    return {
        assetState,
        loadingLabel,
        progress,
        progressPercent: Math.round(progress * 100),
        skipState
    };
};

export const STARTUP_INTRO_ASSET_FAILSAFE_MS = 3500;
