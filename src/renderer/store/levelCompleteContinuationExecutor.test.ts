import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createPlayablePathFixture } from '../../shared/playable-path-fixtures';
import { openRelicOffer } from '../../shared/game-core';
import {
    executeChooseRouteAndContinue,
    executeContinueToNextLevel,
    type LevelCompleteContinuationExecutorDeps,
    type LevelCompleteContinuationExecutorState
} from './levelCompleteContinuationExecutor';

const createState = (overrides: Partial<LevelCompleteContinuationExecutorState> = {}): LevelCompleteContinuationExecutorState => ({
    run: null,
    view: 'playing',
    ...overrides
});

const createDeps = (
    state: LevelCompleteContinuationExecutorState
): LevelCompleteContinuationExecutorDeps => ({
    applyResolvedRun: vi.fn(),
    clearAllTimers: vi.fn(),
    continueToNextLevel: vi.fn(),
    getState: vi.fn(() => state),
    prepareMemorizeTimerForBoardReady: vi.fn(),
    setState: vi.fn()
});

describe('level complete continuation executors', () => {
    it('advances eligible completed floors and prepares the memorize timer', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const deps = createDeps(createState({ run }));

        executeContinueToNextLevel(deps);

        expect(deps.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(deps.setState).toHaveBeenCalledWith(expect.objectContaining({
            newlyUnlockedAchievements: [],
            view: 'playing'
        }));
        expect(deps.prepareMemorizeTimerForBoardReady).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'memorize' })
        );
    });

    it('does not advance puzzle runs or runs with an existing relic offer', () => {
        const puzzleRun = {
            ...createPlayablePathFixture('floorClearWithRouteChoices').run!,
            gameMode: 'puzzle' as const
        };
        const puzzleDeps = createDeps(createState({ run: puzzleRun }));
        executeContinueToNextLevel(puzzleDeps);
        expect(puzzleDeps.clearAllTimers).not.toHaveBeenCalled();

        const relicRun = openRelicOffer(createPlayablePathFixture('relicDraft').run!);
        const relicDeps = createDeps(createState({ run: relicRun }));
        executeContinueToNextLevel(relicDeps);
        expect(relicDeps.clearAllTimers).not.toHaveBeenCalled();
    });

    it('routes dead interlude runs through game-over resolution before early returns', () => {
        const run: RunState = {
            ...createPlayablePathFixture('floorClearWithRouteChoices').run!,
            gameMode: 'puzzle',
            lives: 0
        };
        const deps = createDeps(createState({ run }));

        executeContinueToNextLevel(deps);

        expect(deps.applyResolvedRun).toHaveBeenCalledWith(expect.objectContaining({
            lives: 0,
            status: 'gameOver'
        }));
        expect(deps.clearAllTimers).not.toHaveBeenCalled();
    });

    it('delegates route choice to normal continuation while a route card plan is pending', () => {
        const run = {
            ...createPlayablePathFixture('floorClearWithRouteChoices').run!,
            pendingRouteCardPlan: { routeType: 'safe' }
        } as RunState;
        const deps = createDeps(createState({ run }));

        executeChooseRouteAndContinue('choice-safe', deps);

        expect(deps.continueToNextLevel).toHaveBeenCalledTimes(1);
        expect(deps.clearAllTimers).not.toHaveBeenCalled();
    });

    it('applies route choice outcome and routes into the next continuation surface', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const choiceId = run.lastLevelResult!.routeChoices![0]!.id;
        const deps = createDeps(createState({ run }));

        executeChooseRouteAndContinue(choiceId, deps);

        expect(deps.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(deps.setState).toHaveBeenCalledWith(expect.objectContaining({
            view: expect.any(String),
            run: expect.objectContaining({
                gameplayCommandJournal: expect.arrayContaining([
                    expect.objectContaining({ type: 'route.choose', choiceId })
                ]),
                gameplayEventJournal: expect.arrayContaining([
                    expect.objectContaining({ type: 'route.choice_selected', choiceId }),
                    expect.objectContaining({ type: 'side_room.opened' }),
                    expect.objectContaining({ type: 'feedback.requested', cue: 'route.choice.safe' })
                ]),
                sideRoom: expect.objectContaining({ routeType: 'safe' })
            })
        }));
    });
});
