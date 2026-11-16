import { useEffect } from 'react';
import type { ViewState } from '../../shared/contracts';

/**
 * The Android back button, and a browser's (docs/MARKET_FLOW_REVIEW_WIDER.md, P1).
 *
 * The game is one page, so back used to leave it: mid-run on the Play app, back closed the app.
 * Away from the menu the page keeps one history entry of its own; back spends it and the game
 * answers as it answers Escape, which is what the pad's B already does (`controller-back-contract.ts`):
 * in a run Escape pauses and the pause menu takes it again to resume, an open dialog closes, a meta
 * screen leaves to the menu. On the menu there is no entry, so back leaves the game as a player
 * expects. The desktop build has no back button and never registers this.
 */
const GUARD_STATE = { memoryDungeonBackGuard: true } as const;

export const viewKeepsBackGuard = (view: ViewState): boolean => view !== 'menu' && view !== 'boot';

/**
 * Only where back is a device button that would close the game: the Android app (opened from Play,
 * so its referrer is `android-app://`) and an installed web app (standalone display). In a browser
 * tab, back leaving the page is what a player expects, and the page's history stays untouched.
 * `?backGuard=1` turns it on for one session, for the e2e test.
 */
export const hardwareBackApplies = (
    env: { referrer: string; standalone: boolean; search: string } = {
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        standalone:
            typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
        search: typeof location !== 'undefined' ? location.search : ''
    }
): boolean => env.referrer.startsWith('android-app://') || env.standalone || new URLSearchParams(env.search).get('backGuard') === '1';

const hasGuard = (state: unknown): boolean =>
    typeof state === 'object' && state !== null && (state as Record<string, unknown>).memoryDungeonBackGuard === true;

/*
 * `history.back()` is asynchronous: the pop the menu asks for (to drop the entry the last screen
 * left) can arrive after the player has already opened the next screen, which would read it as a
 * back press and close that screen at once. Pops the game asked for itself are counted and skipped.
 */
let selfPops = 0;
/*
 * Whether this page load pushed the entry. A reload keeps `history.state`, so the menu can boot
 * standing on an entry an earlier load made; going back from it would load the page again rather
 * than pop, so such an entry is cleared in place instead.
 */
let pushedThisLoad = false;

const pushGuard = (): void => {
    window.history.pushState(GUARD_STATE, '');
    pushedThisLoad = true;
};

export const useHardwareBack = (view: ViewState, enabled: boolean): void => {
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const onPopState = (): void => {
            if (selfPops > 0) {
                selfPops -= 1;
                if (viewKeepsBackGuard(view) && !hasGuard(window.history.state)) {
                    pushGuard();
                }
                return;
            }
            if (!viewKeepsBackGuard(view)) {
                return;
            }
            // Answer as Escape would, from wherever focus is, then take the entry back while this
            // screen still wants one (the effect re-runs and re-arms if the view changed).
            const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
            target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
            pushGuard();
        };
        window.addEventListener('popstate', onPopState);
        if (viewKeepsBackGuard(view)) {
            // An entry inherited from before a reload is this load's starting point, not a guard of its own.
            if ((!hasGuard(window.history.state) || !pushedThisLoad) && selfPops === 0) {
                pushGuard();
            }
        } else if (view === 'menu' && hasGuard(window.history.state)) {
            // Back on the menu must leave the game: drop the entry the last screen left behind.
            if (pushedThisLoad) {
                selfPops += 1;
                window.history.back();
            } else {
                window.history.replaceState(null, '');
            }
        }
        return () => {
            window.removeEventListener('popstate', onPopState);
        };
    }, [enabled, view]);
};
