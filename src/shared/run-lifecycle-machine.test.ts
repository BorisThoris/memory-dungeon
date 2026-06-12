import { createActor } from 'xstate';
import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import {
    isResumableLifecycleState,
    lifecycleStateFromRun,
    lifecycleStateFromRunStatus,
    lifecycleStateFromSurface,
    runLifecycleMachine,
    type RunLifecycleEvent
} from './run-lifecycle-machine';

const actorValueAfter = (events: RunLifecycleEvent[]) => {
    const actor = createActor(runLifecycleMachine).start();
    for (const event of events) {
        actor.send(event);
    }
    return actor.getSnapshot().value;
};

describe('run lifecycle machine', () => {
    it('models the happy path through run start and next floor', () => {
        expect(actorValueAfter([
            { type: 'START_RUN' },
            { type: 'MEMORIZE_DONE' },
            { type: 'FLIP_PAIR' },
            { type: 'RESOLVE_MATCH' },
            { type: 'CLEAR_LEVEL' },
            { type: 'NEXT_LEVEL' }
        ])).toBe('memorize');
    });

    it('rejects impossible gameplay transitions by staying in the current state', () => {
        expect(actorValueAfter([{ type: 'FLIP_PAIR' }])).toBe('menu');
        expect(actorValueAfter([{ type: 'START_RUN' }, { type: 'OPEN_SHOP' }])).toBe('memorize');
    });

    it('keeps terminal game-over from resuming directly into gameplay', () => {
        expect(actorValueAfter([
            { type: 'START_RUN' },
            { type: 'GAME_OVER' },
            { type: 'RESUME' }
        ])).toBe('gameOver');
    });

    it('maps existing run statuses to lifecycle states', () => {
        expect(lifecycleStateFromRunStatus(null)).toBe('menu');
        expect(lifecycleStateFromRunStatus('playing')).toBe('playing');
        expect(lifecycleStateFromRunStatus('levelComplete')).toBe('levelComplete');
    });

    it('identifies lifecycle states that can pause into meta overlays', () => {
        expect(isResumableLifecycleState('memorize')).toBe(true);
        expect(isResumableLifecycleState('playing')).toBe(true);
        expect(isResumableLifecycleState('resolving')).toBe(true);
        expect(isResumableLifecycleState('paused')).toBe(false);
        expect(isResumableLifecycleState('levelComplete')).toBe(false);
        expect(isResumableLifecycleState('shop')).toBe(false);
        expect(isResumableLifecycleState('gameOver')).toBe(false);
    });

    it('derives lifecycle state from current run and app surface', () => {
        const run = createNewRun(0, { echoFeedbackEnabled: false });
        expect(lifecycleStateFromRun(null)).toBe('menu');
        expect(lifecycleStateFromRun({ ...run, status: 'paused' })).toBe('paused');
        expect(lifecycleStateFromRun({
            ...run,
            status: 'levelComplete',
            sideRoom: {
                body: 'Rest',
                floor: 1,
                id: 'rest',
                kind: 'rest_shrine',
                nodeKind: 'rest',
                primaryDetail: 'Heal',
                primaryLabel: 'Rest',
                routeType: 'safe',
                skipLabel: 'Skip',
                title: 'Room',
                payload: { kind: 'rest_heal', serviceId: 'rest_heal' }
            }
        })).toBe('sideRoom');
        expect(lifecycleStateFromSurface({ run, view: 'shop' })).toBe('shop');
        expect(lifecycleStateFromSurface({ run, view: 'menu' })).toBe('menu');
    });
});
