import type { RunStatus, SubscreenReturnView, ViewState } from '../../shared/contracts';
import { isResumableLifecycleState, lifecycleStateFromRunStatus } from '../../shared/run-lifecycle-machine';

type NavigationSurface =
    | 'boot'
    | 'menu'
    | 'modeSelect'
    | 'collection'
    | 'profile'
    | 'inventory'
    | 'shop'
    | 'sideRoom'
    | 'codex'
    | 'settings'
    | 'playing'
    | 'gameOver';

type NavigationAction =
    | 'back'
    | 'close'
    | 'escape'
    | 'open'
    | 'pause-toggle'
    | 'return';

type NavigationPresentation = 'page' | 'in-run-overlay' | 'status-overlay';

interface NavigationShellChromeContract {
    visualView: ViewState;
    shellChrome: 'menu_hub' | 'meta_page' | 'gameplay' | 'gameplay_modal' | 'post_run' | 'boot';
    boardMounted: boolean;
    fallbackView: ViewState;
    reason: string;
}

interface NavigationRouteContract {
    action: NavigationAction;
    from: NavigationSurface;
    preservesRun: boolean;
    presentation: NavigationPresentation;
    timerPolicy: 'none' | 'freeze-on-open' | 'resume-on-close' | 'no-resume';
    to: NavigationSurface;
}

interface NavigationShellChromeRow {
    id: 'page_back' | 'in_run_meta' | 'null_run_recovery' | 'game_over_return';
    label: string;
    route: string;
    chrome: string;
    preservesRun: boolean;
    localOnly: true;
}

interface ResolveCloseInput {
    currentView: ViewState;
    returnView: SubscreenReturnView;
    runPresent: boolean;
}

type RequestedSettingsReturnView = SubscreenReturnView | 'settings';

const MENU_RETURN_VIEWS = new Set<ViewState>(['modeSelect', 'collection', 'profile', 'inventory', 'codex', 'settings']);
const IN_RUN_META_VIEWS = new Set<ViewState>(['inventory', 'codex', 'settings']);
const IN_RUN_OVERLAY_VIEWS = new Set<ViewState>(['inventory', 'codex', 'settings', 'shop', 'sideRoom']);

export const NAVIGATION_ROUTE_CONTRACTS: ReadonlyArray<NavigationRouteContract> = [
    { action: 'open', from: 'menu', to: 'modeSelect', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'back', from: 'modeSelect', to: 'menu', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'open', from: 'menu', to: 'collection', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'back', from: 'collection', to: 'menu', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'open', from: 'menu', to: 'profile', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'back', from: 'profile', to: 'menu', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'open', from: 'menu', to: 'inventory', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'back', from: 'inventory', to: 'menu', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'open', from: 'menu', to: 'codex', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'back', from: 'codex', to: 'menu', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'open', from: 'menu', to: 'settings', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'back', from: 'settings', to: 'menu', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'open', from: 'modeSelect', to: 'settings', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    { action: 'back', from: 'settings', to: 'modeSelect', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    {
        action: 'open',
        from: 'collection',
        to: 'settings',
        presentation: 'page',
        preservesRun: false,
        timerPolicy: 'none'
    },
    { action: 'back', from: 'settings', to: 'collection', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    {
        action: 'open',
        from: 'profile',
        to: 'settings',
        presentation: 'page',
        preservesRun: false,
        timerPolicy: 'none'
    },
    { action: 'back', from: 'settings', to: 'profile', presentation: 'page', preservesRun: false, timerPolicy: 'none' },
    {
        action: 'open',
        from: 'playing',
        to: 'inventory',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'freeze-on-open'
    },
    {
        action: 'back',
        from: 'inventory',
        to: 'playing',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'resume-on-close'
    },
    {
        action: 'open',
        from: 'playing',
        to: 'codex',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'freeze-on-open'
    },
    {
        action: 'back',
        from: 'codex',
        to: 'playing',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'resume-on-close'
    },
    {
        action: 'open',
        from: 'playing',
        to: 'settings',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'freeze-on-open'
    },
    {
        action: 'back',
        from: 'settings',
        to: 'playing',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'resume-on-close'
    },
    {
        action: 'open',
        from: 'playing',
        to: 'shop',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'no-resume'
    },
    {
        action: 'open',
        from: 'playing',
        to: 'sideRoom',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'no-resume'
    },
    {
        action: 'back',
        from: 'sideRoom',
        to: 'playing',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'no-resume'
    },
    {
        action: 'back',
        from: 'shop',
        to: 'playing',
        presentation: 'in-run-overlay',
        preservesRun: true,
        timerPolicy: 'no-resume'
    },
    {
        action: 'pause-toggle',
        from: 'playing',
        to: 'playing',
        presentation: 'status-overlay',
        preservesRun: true,
        timerPolicy: 'freeze-on-open'
    },
    {
        action: 'return',
        from: 'playing',
        to: 'gameOver',
        presentation: 'page',
        preservesRun: true,
        timerPolicy: 'no-resume'
    },
    { action: 'back', from: 'gameOver', to: 'menu', presentation: 'page', preservesRun: false, timerPolicy: 'none' }
];

export const getNavigationRouteContract = (
    from: NavigationSurface,
    to: NavigationSurface,
    action: NavigationAction
): NavigationRouteContract | null =>
    NAVIGATION_ROUTE_CONTRACTS.find((route) => route.from === from && route.to === to && route.action === action) ?? null;

export const getNavigationShellChromeRows = (): NavigationShellChromeRow[] => [
    {
        id: 'page_back',
        label: 'Page Back',
        route: 'modeSelect/collection/profile/inventory/codex/settings → menu',
        chrome: 'Full meta destination with visible Back button.',
        preservesRun: false,
        localOnly: true
    },
    {
        id: 'in_run_meta',
        label: 'In-run meta overlay',
        route: 'playing → inventory/codex/settings → playing',
        chrome: 'Gameplay remains mounted underneath desk/modal chrome; run timers freeze and resume.',
        preservesRun: true,
        localOnly: true
    },
    {
        id: 'null_run_recovery',
        label: 'Null-run recovery',
        route: 'inventory/codex/settings with missing run → menu',
        chrome: 'Return pointers normalize to menu so no blank playing shell appears.',
        preservesRun: false,
        localOnly: true
    },
    {
        id: 'game_over_return',
        label: 'Game-over return',
        route: 'gameOver → menu or restart',
        chrome: 'Post-run page owns its action dock; no browser history or online route required.',
        preservesRun: false,
        localOnly: true
    }
];

export const isRunStatusResumableAfterMetaOverlay = (status: RunStatus): boolean =>
    isResumableLifecycleState(lifecycleStateFromRunStatus(status));

export const resolveSubscreenCloseTarget = ({
    currentView,
    returnView,
    runPresent
}: ResolveCloseInput): SubscreenReturnView => {
    if (returnView === 'playing') {
        return runPresent && (currentView === 'inventory' || currentView === 'codex') ? 'playing' : 'menu';
    }

    return returnView;
};

export const resolveSettingsCloseTarget = ({
    currentView,
    returnView,
    runPresent
}: ResolveCloseInput): SubscreenReturnView => {
    if (returnView === 'playing') {
        return runPresent && currentView === 'settings' ? 'playing' : 'menu';
    }

    return returnView;
};

export const isMenuDestinationView = (view: ViewState): boolean => MENU_RETURN_VIEWS.has(view);

export const isInRunMetaView = (view: ViewState): boolean => IN_RUN_META_VIEWS.has(view);

export const isInRunOverlayView = (view: ViewState): boolean => IN_RUN_OVERLAY_VIEWS.has(view);

export const getNavigationShellChromeContract = ({
    runPresent,
    settingsReturnView,
    subscreenReturnView,
    view
}: {
    runPresent: boolean;
    settingsReturnView: SubscreenReturnView;
    subscreenReturnView: SubscreenReturnView;
    view: ViewState;
}): NavigationShellChromeContract => {
    if (view === 'boot') {
        return { visualView: 'boot', shellChrome: 'boot', boardMounted: false, fallbackView: 'menu', reason: 'Hydration/intro shell.' };
    }
    if (view === 'gameOver') {
        return { visualView: 'gameOver', shellChrome: 'post_run', boardMounted: false, fallbackView: 'menu', reason: 'Post-run shell owns next actions.' };
    }
    if (view === 'playing') {
        return { visualView: runPresent ? 'playing' : 'menu', shellChrome: runPresent ? 'gameplay' : 'menu_hub', boardMounted: runPresent, fallbackView: 'menu', reason: runPresent ? 'Active gameplay shell.' : 'No run; fall back to menu.' };
    }
    if (view === 'settings' && settingsReturnView === 'playing') {
        return { visualView: runPresent ? 'playing' : 'menu', shellChrome: runPresent ? 'gameplay_modal' : 'menu_hub', boardMounted: runPresent, fallbackView: 'menu', reason: 'Run settings overlays gameplay and freezes timers.' };
    }
    if ((view === 'inventory' || view === 'codex') && subscreenReturnView === 'playing') {
        return { visualView: runPresent ? 'playing' : 'menu', shellChrome: runPresent ? 'gameplay_modal' : 'menu_hub', boardMounted: runPresent, fallbackView: 'menu', reason: 'In-run meta overlays keep gameplay mounted.' };
    }
    if (view === 'shop' || view === 'sideRoom') {
        return { visualView: runPresent ? 'playing' : 'menu', shellChrome: runPresent ? 'gameplay_modal' : 'menu_hub', boardMounted: runPresent, fallbackView: 'menu', reason: 'In-run interlude destination over gameplay.' };
    }
    return { visualView: view, shellChrome: view === 'menu' ? 'menu_hub' : 'meta_page', boardMounted: false, fallbackView: 'menu', reason: 'Full-page menu/meta destination.' };
};

export type StoreNavigationAction =
    | 'closeSettings'
    | 'closeSubscreen'
    | 'openCodexFromMenu'
    | 'openCodexFromPlaying'
    | 'openCollection'
    | 'openProfile'
    | 'openInventoryFromMenu'
    | 'openInventoryFromPlaying'
    | 'openModeSelect'
    | 'openShopFromLevelComplete'
    | 'closeShopToFloorSummary'
    | 'openSettings';

export type StoreNavigationTransition =
    {
        kind: 'setView';
        freezeRun?: boolean;
        resumeRun?: boolean;
        settingsReturnView?: SubscreenReturnView;
        subscreenReturnView?: SubscreenReturnView;
        view: ViewState;
    };

interface StoreNavigationState {
    run: unknown | null;
    settingsReturnView: SubscreenReturnView;
    subscreenReturnView: SubscreenReturnView;
    view: ViewState;
}

export const resolveNavigationTransition = (
    state: StoreNavigationState,
    action: StoreNavigationAction,
    requestedReturnView: RequestedSettingsReturnView = 'menu'
): StoreNavigationTransition => {
    const safeRequestedReturnView = requestedReturnView === 'settings' ? 'menu' : requestedReturnView;

    switch (action) {
        case 'openModeSelect':
            return { kind: 'setView', view: 'modeSelect', subscreenReturnView: 'menu' };
        case 'openCollection':
            return { kind: 'setView', view: 'collection', subscreenReturnView: 'menu' };
        case 'openProfile':
            return { kind: 'setView', view: 'profile', subscreenReturnView: 'menu' };
        case 'openInventoryFromMenu':
            return { kind: 'setView', view: 'inventory', subscreenReturnView: 'menu' };
        case 'openCodexFromMenu':
            return { kind: 'setView', view: 'codex', subscreenReturnView: 'menu' };
        case 'openInventoryFromPlaying':
            return state.run && state.view === 'playing'
                ? { kind: 'setView', view: 'inventory', subscreenReturnView: 'playing', freezeRun: true }
                : { kind: 'setView', view: state.view };
        case 'openCodexFromPlaying':
            return state.run && state.view === 'playing'
                ? { kind: 'setView', view: 'codex', subscreenReturnView: 'playing', freezeRun: true }
                : { kind: 'setView', view: state.view };
        case 'openShopFromLevelComplete':
            return state.run && state.view === 'playing'
                ? { kind: 'setView', view: 'shop' }
                : { kind: 'setView', view: state.view };
        case 'closeShopToFloorSummary':
            return state.run ? { kind: 'setView', view: 'playing' } : { kind: 'setView', view: 'menu' };
        case 'closeSubscreen': {
            const target = resolveSubscreenCloseTarget({
                currentView: state.view,
                returnView: state.subscreenReturnView,
                runPresent: Boolean(state.run)
            });
            if (target === 'menu') {
                return { kind: 'setView', view: 'menu', subscreenReturnView: 'menu' };
            }
            return {
                kind: 'setView',
                view: target,
                resumeRun: target === 'playing'
            };
        }
        case 'openSettings':
            return {
                kind: 'setView',
                view: 'settings',
                settingsReturnView: safeRequestedReturnView,
                freezeRun: safeRequestedReturnView === 'playing' && Boolean(state.run)
            };
        case 'closeSettings': {
            const target = resolveSettingsCloseTarget({
                currentView: state.view,
                returnView: state.settingsReturnView,
                runPresent: Boolean(state.run)
            });
            if (target === 'menu') {
                return { kind: 'setView', view: 'menu', settingsReturnView: 'menu' };
            }
            return {
                kind: 'setView',
                view: target,
                resumeRun: target === 'playing'
            };
        }
        default:
            return { kind: 'setView', view: state.view };
    }
};
