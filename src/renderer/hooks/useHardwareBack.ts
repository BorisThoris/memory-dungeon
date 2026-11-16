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

export const useHardwareBack = (view: ViewState, enabled: boolean): void => {
    useEffect(() => {
        if (!enabled || !viewKeepsBackGuard(view)) {
            return;
        }
        if (!hasGuard(window.history.state)) {
            window.history.pushState(GUARD_STATE, '');
        }
        const onPopState = (): void => {
            // Answer as Escape would, from wherever focus is, then take the entry back while this
            // screen still wants one (the effect re-runs and re-arms if the view changed).
            const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
            target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
            window.history.pushState(GUARD_STATE, '');
        };
        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
        };
    }, [enabled, view]);

    // Back on the menu must leave the game: drop the entry the last screen left behind.
    useEffect(() => {
        if (enabled && view === 'menu' && hasGuard(window.history.state)) {
            window.history.back();
        }
    }, [enabled, view]);
};
