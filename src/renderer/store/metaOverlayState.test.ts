import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import type { StoreNavigationTransition } from './navigationModel';
import {
    createFrozenMetaOverlayPatch,
    createMetaOverlayCloseSurfaceResult,
    createMetaOverlayClosePatch,
    createMetaOverlayNavigationPatch,
    createMetaOverlayOpenSurfaceResult,
    createMetaOverlayPointerResetPatch
} from './metaOverlayState';

const run = { id: 'run-1' } as unknown as RunState;

describe('metaOverlayState', () => {
    it('builds frozen run patches for in-run subscreens', () => {
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            view: 'inventory',
            subscreenReturnView: 'playing',
            freezeRun: true
        };

        expect(createFrozenMetaOverlayPatch(transition, 'subscreenReturnView', run)).toEqual({
            view: 'inventory',
            subscreenReturnView: 'playing',
            run
        });
    });

    it('builds frozen run patches for settings overlays', () => {
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            view: 'settings',
            settingsReturnView: 'playing',
            freezeRun: true
        };

        expect(createFrozenMetaOverlayPatch(transition, 'settingsReturnView', run)).toEqual({
            view: 'settings',
            settingsReturnView: 'playing',
            run
        });
    });

    it('uses the close destination when a resume transition omits an explicit return pointer', () => {
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            view: 'playing',
            resumeRun: true
        };

        expect(createMetaOverlayClosePatch(transition, 'subscreenReturnView', run)).toEqual({
            view: 'playing',
            subscreenReturnView: 'playing',
            run
        });
        expect(createMetaOverlayClosePatch(transition, 'settingsReturnView', run)).toEqual({
            view: 'playing',
            settingsReturnView: 'playing',
            run
        });
    });

    it('normalizes nullish close runs and invalid fallback destinations', () => {
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            view: 'settings'
        };

        expect(createMetaOverlayClosePatch(transition, 'settingsReturnView', undefined)).toEqual({
            view: 'settings',
            settingsReturnView: 'menu',
            run: null
        });
    });

    it('builds navigation-only patches with the selected return pointer', () => {
        const subscreenTransition: StoreNavigationTransition = {
            kind: 'setView',
            view: 'codex',
            subscreenReturnView: 'playing'
        };
        const settingsTransition: StoreNavigationTransition = {
            kind: 'setView',
            view: 'settings',
            settingsReturnView: 'collection'
        };

        expect(createMetaOverlayNavigationPatch(subscreenTransition, 'subscreenReturnView')).toEqual({
            view: 'codex',
            subscreenReturnView: 'playing'
        });
        expect(createMetaOverlayNavigationPatch(settingsTransition, 'settingsReturnView')).toEqual({
            view: 'settings',
            settingsReturnView: 'collection'
        });
    });

    it('resets the selected return pointer after game over resolution', () => {
        expect(createMetaOverlayPointerResetPatch('subscreenReturnView')).toEqual({
            subscreenReturnView: 'menu'
        });
        expect(createMetaOverlayPointerResetPatch('settingsReturnView')).toEqual({
            settingsReturnView: 'menu'
        });
    });

    it('routes close transitions with resumed game-over runs to pointer reset', () => {
        const gameOverRun = { ...run, status: 'gameOver' } as unknown as RunState;
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            resumeRun: true,
            view: 'playing'
        };

        expect(
            createMetaOverlayCloseSurfaceResult({
                pointer: 'subscreenReturnView',
                run: gameOverRun,
                transition
            })
        ).toEqual({
            kind: 'gameOver',
            patch: { subscreenReturnView: 'menu' },
            run: gameOverRun
        });
    });

    it('routes close transitions with live runs to close patches', () => {
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            resumeRun: true,
            view: 'playing'
        };

        expect(
            createMetaOverlayCloseSurfaceResult({
                pointer: 'settingsReturnView',
                run,
                transition
            })
        ).toEqual({
            kind: 'close',
            patch: {
                settingsReturnView: 'playing',
                run,
                view: 'playing'
            }
        });
    });

    it('routes non-resume close transitions to navigation patches', () => {
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            subscreenReturnView: 'menu',
            view: 'menu'
        };

        expect(
            createMetaOverlayCloseSurfaceResult({
                pointer: 'subscreenReturnView',
                run,
                transition
            })
        ).toEqual({
            kind: 'navigate',
            patch: {
                subscreenReturnView: 'menu',
                view: 'menu'
            }
        });
    });

    it('routes freeze-on-open transitions through frozen patches', () => {
        const transition: StoreNavigationTransition = {
            freezeRun: true,
            kind: 'setView',
            subscreenReturnView: 'playing',
            view: 'inventory'
        };
        const frozenRun = { id: 'frozen-run' } as unknown as RunState;

        expect(
            createMetaOverlayOpenSurfaceResult({
                freezeRun: () => frozenRun,
                pointer: 'subscreenReturnView',
                run,
                transition
            })
        ).toEqual({
            kind: 'freeze',
            patch: {
                run: frozenRun,
                subscreenReturnView: 'playing',
                view: 'inventory'
            }
        });
    });

    it('ignores impossible freeze-on-open transitions without a run', () => {
        const transition: StoreNavigationTransition = {
            freezeRun: true,
            kind: 'setView',
            settingsReturnView: 'playing',
            view: 'settings'
        };

        expect(
            createMetaOverlayOpenSurfaceResult({
                freezeRun: (candidate) => candidate,
                pointer: 'settingsReturnView',
                run: null,
                transition
            })
        ).toEqual({ kind: 'ignored' });
    });

    it('routes non-freezing open transitions to navigation patches', () => {
        const transition: StoreNavigationTransition = {
            kind: 'setView',
            settingsReturnView: 'collection',
            view: 'settings'
        };

        expect(
            createMetaOverlayOpenSurfaceResult({
                freezeRun: (candidate) => candidate,
                pointer: 'settingsReturnView',
                run,
                transition
            })
        ).toEqual({
            kind: 'navigate',
            patch: {
                settingsReturnView: 'collection',
                view: 'settings'
            }
        });
    });
});
