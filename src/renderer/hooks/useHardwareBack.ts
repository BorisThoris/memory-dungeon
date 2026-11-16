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

const hasGuard = (state: unknown): boolean =>
    typeof state === 'object' && state !== null && (state as Record<string, unknown>).memoryDungeonBackGuard === true;

/*
 * `history.back()` is asynchronous: the pop the menu asks for (to drop the entry the last screen
 * left) can arrive after the player has already opened the next screen, which would read it as a
 * back press and close that screen at once. Pops the game asked for itself are counted and skipped.
 */
let selfPops = 0;

export const useHardwareBack = (view: ViewState, enabled: boolean): void => {
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const onPopState = (): void => {
            if (selfPops > 0) {
                selfPops -= 1;
                if (viewKeepsBackGuard(view) && !hasGuard(window.history.state)) {
                    window.history.pushState(GUARD_STATE, '');
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
            window.history.pushState(GUARD_STATE, '');
        };
        window.addEventListener('popstate', onPopState);
        if (viewKeepsBackGuard(view)) {
            if (!hasGuard(window.history.state) && selfPops === 0) {
                window.history.pushState(GUARD_STATE, '');
            }
        } else if (view === 'menu' && hasGuard(window.history.state)) {
            // Back on the menu must leave the game: drop the entry the last screen left behind.
            selfPops += 1;
            window.history.back();
        }
        return () => {
            window.removeEventListener('popstate', onPopState);
        };
    }, [enabled, view]);
};
