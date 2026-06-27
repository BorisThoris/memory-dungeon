import { describe, expect, it } from 'vitest';
import {
    getNavigationRouteContract,
    getNavigationShellChromeRows,
    isInRunMetaView,
    isInRunOverlayView,
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
        expect(getNavigationRouteContract('playing', 'shop', 'open')).toMatchObject({
            presentation: 'in-run-overlay',
            preservesRun: true,
            timerPolicy: 'no-resume'
        });
        expect(NAVIGATION_ROUTE_CONTRACTS.some((route) => route.from === 'gameOver' && route.to === 'menu')).toBe(true);
    });

    it('normalizes impossible playing returns to menu', () => {
        expect(resolveSubscreenCloseTarget({ currentView: 'inventory', returnView: 'playing', runPresent: false })).toBe('menu');
        expect(resolveSettingsCloseTarget({ currentView: 'settings', returnView: 'playing', runPresent: false })).toBe('menu');
    });

    it('routes the dedicated shop over a completed floor without timer resume semantics', () => {
        expect(
            resolveNavigationTransition(
                {
                    run: {},
                    settingsReturnView: 'menu',
                    subscreenReturnView: 'menu',
                    view: 'playing'
                },
                'openShopFromLevelComplete'
            )
        ).toMatchObject({
            view: 'shop'
        });

        expect(
            resolveNavigationTransition(
                {
                    run: {},
                    settingsReturnView: 'menu',
                    subscreenReturnView: 'menu',
                    view: 'shop'
                },
                'closeShopToFloorSummary'
            )
        ).toMatchObject({
            view: 'playing'
        });
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

    it('classifies menu and in-run destinations for shell chrome decisions', () => {
        expect(isMenuDestinationView('collection')).toBe(true);
        expect(isMenuDestinationView('playing')).toBe(false);
        expect(isInRunMetaView('codex')).toBe(true);
        expect(isInRunMetaView('shop')).toBe(false);
        expect(isInRunOverlayView('shop')).toBe(true);
        expect(isInRunOverlayView('gameOver')).toBe(false);
        expect(isRunStatusResumableAfterMetaOverlay('memorize')).toBe(true);
        expect(isRunStatusResumableAfterMetaOverlay('levelComplete')).toBe(false);
    });
});
