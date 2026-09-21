import { describe, expect, it } from 'vitest';
import {
    getNavigationRouteContract,
    getNavigationShellChromeContract,
    getNavigationShellChromeRows,
    isInRunMetaView,
    isMenuDestinationView,
    isRunStatusResumableAfterMetaOverlay,
    NAVIGATION_ROUTE_CONTRACTS,
    resolveNavigationTransition,
    resolveSettingsCloseTarget,
    resolveSubscreenCloseTarget
} from './navigationModel';

describe('navigationModel', () => {
    it('documents bounded page and in-run route contracts', () => {
        expect(getNavigationRouteContract('menu', 'modeSelect', 'open')).toMatchObject({
            presentation: 'page',
            timerPolicy: 'none'
        });
        expect(getNavigationRouteContract('playing', 'inventory', 'open')).toMatchObject({
            presentation: 'in-run-overlay',
            preservesRun: true,
            timerPolicy: 'freeze-on-open'
        });
        expect(getNavigationRouteContract('settings', 'playing', 'back')).toMatchObject({
            timerPolicy: 'resume-on-close'
        });
        expect(NAVIGATION_ROUTE_CONTRACTS.some((route) => route.from === 'gameOver' && route.to === 'menu')).toBe(true);
    });

    it('normalizes impossible playing returns to menu', () => {
        expect(resolveSubscreenCloseTarget({ currentView: 'inventory', returnView: 'playing', runPresent: false })).toBe('menu');
        expect(resolveSettingsCloseTarget({ currentView: 'settings', returnView: 'playing', runPresent: false })).toBe('menu');
    });


    it('opens profile from menu with menu return pointer', () => {
        expect(
            resolveNavigationTransition(
                {
                    run: null,
                    settingsReturnView: 'menu',
                    subscreenReturnView: 'menu',
                    view: 'menu'
                },
                'openProfile'
            )
        ).toMatchObject({
            kind: 'setView',
            view: 'profile',
            subscreenReturnView: 'menu'
        });
    });

    it('keeps settings return targets explicit for mode select and collection', () => {
        expect(
            resolveNavigationTransition(
                {
                    run: null,
                    settingsReturnView: 'menu',
                    subscreenReturnView: 'menu',
                    view: 'modeSelect'
                },
                'openSettings',
                'modeSelect'
            )
        ).toMatchObject({
            settingsReturnView: 'modeSelect',
            view: 'settings'
        });
        expect(
            resolveNavigationTransition(
                {
                    run: null,
                    settingsReturnView: 'modeSelect',
                    subscreenReturnView: 'menu',
                    view: 'settings'
                },
                'closeSettings'
            )
        ).toMatchObject({
            kind: 'setView',
            view: 'modeSelect'
        });
    });

    it('REG-099 documents global shell chrome and backstack invariants', () => {
        const rows = getNavigationShellChromeRows();
        expect(rows.map((row) => row.id)).toEqual(['page_back', 'in_run_meta', 'null_run_recovery', 'game_over_return']);
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.find((row) => row.id === 'null_run_recovery')?.chrome).toMatch(/menu/i);
        expect(rows.find((row) => row.id === 'in_run_meta')?.chrome).toMatch(/Gameplay remains mounted/i);
    });

    /**
     * The route table against the resolver that actually runs.
     *
     * These are two layers of the same module written in different vocabularies - the table is
     * keyed (from, to, action) on a navigation surface, the resolver switches on a store action
     * like `openInventoryFromPlaying` - and until Gen 247 nothing connected them. The table was a
     * description, this test asserted the description was self-consistent, and the app was free to
     * disagree with it. Gen 245 proved that is not hypothetical: a set in this same module already
     * contradicted the branch that decides the same thing.
     *
     * So the table is now checked against behaviour rather than against itself. Every store action
     * names its route; the row must exist, the resolver must land on the view the row promises,
     * and `timerPolicy: 'freeze-on-open'` must mean the transition actually freezes the run. A row
     * with no action, or an action whose resolver disagrees, fails here.
     */
    it('resolves every store action onto the route its contract promises', () => {
        const runningState = {
            run: {},
            settingsReturnView: 'menu' as const,
            subscreenReturnView: 'menu' as const,
            view: 'playing' as const
        };
        const menuState = {
            run: null,
            settingsReturnView: 'menu' as const,
            subscreenReturnView: 'menu' as const,
            view: 'menu' as const
        };

        const routes = [
            { action: 'openModeSelect', from: 'menu', to: 'modeSelect', state: menuState },
            { action: 'openCollection', from: 'menu', to: 'collection', state: menuState },
            { action: 'openProfile', from: 'menu', to: 'profile', state: menuState },
            { action: 'openInventoryFromMenu', from: 'menu', to: 'inventory', state: menuState },
            { action: 'openCodexFromMenu', from: 'menu', to: 'codex', state: menuState },
            { action: 'openInventoryFromPlaying', from: 'playing', to: 'inventory', state: runningState },
            { action: 'openCodexFromPlaying', from: 'playing', to: 'codex', state: runningState }
        ] as const;

        for (const route of routes) {
            const contract = getNavigationRouteContract(route.from, route.to, 'open');
            expect(contract, `${route.from} -> ${route.to} has no route contract`).not.toBeNull();

            const transition = resolveNavigationTransition(route.state, route.action);
            expect(transition.view, `${route.action} does not land on ${route.to}`).toBe(route.to);
            expect(
                transition.freezeRun === true,
                `${route.action}: the contract says timerPolicy ${contract?.timerPolicy}, the resolver ${
                    transition.freezeRun === true ? 'freezes' : 'does not freeze'
                }`
            ).toBe(contract?.timerPolicy === 'freeze-on-open');
        }
    });

    /**
     * The shell-chrome rows against the contract that actually decides the shell.
     *
     * The rows are mostly prose - `route` and `chrome` are sentences - but `preservesRun` is a
     * claim the code can be asked about: "the run survives this move" is the same statement as
     * `boardMounted`, which is what keeps gameplay alive under the overlay. Until Gen 248 the rows
     * had no reader at all, so those claims sat beside an if-chain that could contradict them
     * without anything noticing - which is exactly what a set in this module had already done
     * (Gen 245).
     *
     * Each row now names the case it describes and is checked against
     * `getNavigationShellChromeContract`. A row whose `preservesRun` stops matching the shell it
     * describes fails here.
     */
    it('keeps every shell-chrome row true of the contract that decides the shell', () => {
        const caseForRow: Record<string, Parameters<typeof getNavigationShellChromeContract>[0]> = {
            page_back: { runPresent: false, settingsReturnView: 'menu', subscreenReturnView: 'menu', view: 'collection' },
            in_run_meta: { runPresent: true, settingsReturnView: 'menu', subscreenReturnView: 'playing', view: 'inventory' },
            null_run_recovery: { runPresent: false, settingsReturnView: 'menu', subscreenReturnView: 'playing', view: 'inventory' },
            game_over_return: { runPresent: false, settingsReturnView: 'menu', subscreenReturnView: 'menu', view: 'gameOver' }
        };

        const rows = getNavigationShellChromeRows();
        expect(rows.length, 'every row must name the case it describes').toBe(Object.keys(caseForRow).length);

        for (const row of rows) {
            const shellCase = caseForRow[row.id];
            expect(shellCase, `row ${row.id} describes no case this test knows how to build`).toBeDefined();
            const contract = getNavigationShellChromeContract(shellCase!);
            expect(
                contract.boardMounted,
                `row ${row.id} says preservesRun=${row.preservesRun}, but the shell ${
                    contract.boardMounted ? 'keeps' : 'drops'
                } the board (${contract.shellChrome})`
            ).toBe(row.preservesRun);
            // The app ships no router: a row claiming otherwise would be describing a different app.
            expect(row.localOnly, `row ${row.id} claims a non-local route`).toBe(true);
        }
    });

    it('classifies menu and in-run destinations for shell chrome decisions', () => {
        expect(isMenuDestinationView('collection')).toBe(true);
        expect(isMenuDestinationView('playing')).toBe(false);
        expect(isInRunMetaView('codex')).toBe(true);
        expect(isInRunMetaView('gameOver')).toBe(false);
        // Settings is NOT one: run settings has its own shell branch above the in-run meta one,
        // and this set is now what that branch reads, so the two cannot disagree again.
        expect(isInRunMetaView('settings')).toBe(false);
        expect(isRunStatusResumableAfterMetaOverlay('memorize')).toBe(true);
        expect(isRunStatusResumableAfterMetaOverlay('levelComplete')).toBe(false);
    });
});
