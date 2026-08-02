import { describe, expect, it, vi } from 'vitest';
import type { RunState, ViewState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import { createSideRoomActionController } from './sideRoomActionController';

interface TestState {
    run: RunState | null;
    view: ViewState;
}

const createHarness = (initialState: TestState) => {
    let state = initialState;
    const applyResolvedRun = vi.fn((run: RunState) => {
        state = { ...state, run };
    });
    const continueToNextLevel = vi.fn();
    const playRewardClaimFeedback = vi.fn();
    const patches: Partial<TestState>[] = [];
    const controller = createSideRoomActionController({
        applyResolvedRun,
        continueToNextLevel,
        getState: () => state,
        playRewardClaimFeedback,
        setState: (patch) => {
            patches.push(patch);
            state = { ...state, ...patch };
        }
    });

    return {
        applyResolvedRun,
        continueToNextLevel,
        controller,
        getState: () => state,
        playRewardClaimFeedback,
        patches
    };
};

describe('sideRoomActionController', () => {
    it('ignores actions outside the side-room view', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;
        const harness = createHarness({ run, view: 'playing' });

        harness.controller.applySideRoomAction(() => ({ ...run, sideRoom: null }));

        expect(harness.patches).toEqual([]);
        expect(harness.applyResolvedRun).not.toHaveBeenCalled();
        expect(harness.continueToNextLevel).not.toHaveBeenCalled();
    });

    it('applies successful side-room actions and continues when returning to play', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;
        const nextRun = { ...run, sideRoom: null, shopOffers: [] };
        const harness = createHarness({ run, view: 'sideRoom' });

        harness.controller.applySideRoomAction(() => nextRun);

        expect(harness.patches).toEqual([{ run: nextRun, view: 'playing' }]);
        expect(harness.continueToNextLevel).toHaveBeenCalledTimes(1);
        expect(harness.applyResolvedRun).not.toHaveBeenCalled();
        expect(harness.playRewardClaimFeedback).not.toHaveBeenCalled();
    });

    it('plays reward feedback only when a typed reward-claim event is appended', () => {
        const run = createPlayablePathFixture('sideRoomPrimary').run!;
        const nextRun = {
            ...run,
            sideRoom: null,
            shopOffers: [],
            gameplayEventJournal: [{
                schemaVersion: 1,
                commandId: 'claim-1',
                eventId: 'claim-1:0',
                sequence: 0,
                source: { kind: 'bonus_reward', id: 'hazard_ward' },
                type: 'feedback.requested',
                cue: 'build.hazard_ward.claimed',
                message: 'Hazard Ward claimed.',
                tone: 'reward'
            }]
        } as unknown as RunState;
        const harness = createHarness({ run, view: 'sideRoom' });

        harness.controller.applySideRoomAction(() => nextRun);

        expect(harness.playRewardClaimFeedback).toHaveBeenCalledTimes(1);
    });

    it('routes invalid missing run state through the surface patch', () => {
        const harness = createHarness({ run: null, view: 'sideRoom' });

        harness.controller.applySideRoomAction((run) => run);

        expect(harness.patches).toEqual([{ view: 'menu' }]);
        expect(harness.continueToNextLevel).not.toHaveBeenCalled();
    });

    it('delegates dead side-room interludes to run resolution', () => {
        const run = {
            ...createPlayablePathFixture('sideRoomPrimary').run!,
            lives: 0
        };
        const harness = createHarness({ run, view: 'sideRoom' });

        harness.controller.applySideRoomAction((sideRoomRun) => sideRoomRun);

        expect(harness.applyResolvedRun).toHaveBeenCalledWith(expect.objectContaining({ lives: 0, status: 'gameOver' }));
        expect(harness.patches).toEqual([]);
        expect(harness.continueToNextLevel).not.toHaveBeenCalled();
    });

    it('does not continue when a side-room result opens the summary shop', () => {
        const run = createPlayablePathFixture('sideRoomThenShop').run!;
        const nextRun = { ...run, sideRoom: null };
        const harness = createHarness({ run, view: 'sideRoom' });

        harness.controller.applySideRoomAction(() => nextRun);

        expect(harness.patches[0]).toMatchObject({ run: nextRun, shopReturnMode: 'summary', view: 'shop' });
        expect(harness.continueToNextLevel).not.toHaveBeenCalled();
    });

    it('returns malformed side-room state to playing', () => {
        const run = createNewRun(0);
        const harness = createHarness({ run, view: 'sideRoom' });

        harness.controller.applySideRoomAction((sideRoomRun) => sideRoomRun);

        expect(harness.patches).toEqual([{ view: 'playing' }]);
    });
});
