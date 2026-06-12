import { createMachine } from 'xstate';
import type { ResumableRunStatus, RunState, RunStatus, ViewState } from './contracts';

export type RunLifecycleState =
    | 'menu'
    | 'memorize'
    | 'playing'
    | 'resolving'
    | 'paused'
    | 'levelComplete'
    | 'shop'
    | 'sideRoom'
    | 'relicOffer'
    | 'gameOver';

export type RunLifecycleEvent =
    | { type: 'START_RUN' }
    | { type: 'MEMORIZE_DONE' }
    | { type: 'FLIP_PAIR' }
    | { type: 'RESOLVE_MATCH' }
    | { type: 'RESOLVE_MISMATCH' }
    | { type: 'CLEAR_LEVEL' }
    | { type: 'OPEN_SHOP' }
    | { type: 'CLOSE_SHOP' }
    | { type: 'OPEN_SIDE_ROOM' }
    | { type: 'CLOSE_SIDE_ROOM' }
    | { type: 'OPEN_RELIC_OFFER' }
    | { type: 'CLOSE_RELIC_OFFER' }
    | { type: 'NEXT_LEVEL' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'GAME_OVER' }
    | { type: 'END_RUN' };

const RESUMABLE_LIFECYCLE_STATES: ReadonlySet<RunLifecycleState> = new Set(['memorize', 'playing', 'resolving']);

export const isResumableLifecycleState = (state: RunLifecycleState): state is ResumableRunStatus =>
    RESUMABLE_LIFECYCLE_STATES.has(state);

export const runLifecycleMachine = createMachine({
    id: 'runLifecycle',
    initial: 'menu',
    types: {} as {
        events: RunLifecycleEvent;
    },
    states: {
        menu: {
            on: {
                START_RUN: 'memorize'
            }
        },
        memorize: {
            on: {
                MEMORIZE_DONE: 'playing',
                PAUSE: 'paused',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        playing: {
            on: {
                FLIP_PAIR: 'resolving',
                CLEAR_LEVEL: 'levelComplete',
                PAUSE: 'paused',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        resolving: {
            on: {
                RESOLVE_MATCH: 'playing',
                RESOLVE_MISMATCH: 'playing',
                CLEAR_LEVEL: 'levelComplete',
                PAUSE: 'paused',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        paused: {
            on: {
                RESUME: 'playing',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        levelComplete: {
            on: {
                OPEN_SHOP: 'shop',
                OPEN_SIDE_ROOM: 'sideRoom',
                OPEN_RELIC_OFFER: 'relicOffer',
                NEXT_LEVEL: 'memorize',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        shop: {
            on: {
                CLOSE_SHOP: 'levelComplete',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        sideRoom: {
            on: {
                CLOSE_SIDE_ROOM: 'levelComplete',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        relicOffer: {
            on: {
                CLOSE_RELIC_OFFER: 'levelComplete',
                GAME_OVER: 'gameOver',
                END_RUN: 'menu'
            }
        },
        gameOver: {
            on: {
                START_RUN: 'memorize',
                END_RUN: 'menu'
            }
        }
    }
});

export const lifecycleStateFromRunStatus = (status: RunStatus | null): RunLifecycleState =>
    status === null ? 'menu' : status;

export const lifecycleStateFromRun = (run: RunState | null): RunLifecycleState => {
    if (!run) {
        return 'menu';
    }
    if (run.relicOffer && run.status === 'levelComplete') {
        return 'relicOffer';
    }
    if (run.sideRoom && run.status === 'levelComplete') {
        return 'sideRoom';
    }
    return lifecycleStateFromRunStatus(run.status);
};

export const lifecycleStateFromSurface = ({
    run,
    view
}: {
    run: RunState | null;
    view: ViewState;
}): RunLifecycleState => {
    if (view === 'shop') {
        return 'shop';
    }
    if (view === 'menu' || view === 'boot') {
        return 'menu';
    }
    return lifecycleStateFromRun(run);
};
