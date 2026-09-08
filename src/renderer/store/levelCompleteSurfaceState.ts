import type { RunState } from '../../shared/contracts';
import { advanceFloorThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import { createRunWithBoardInteractionClearedPatch, type RunSurfaceState } from './runSurfaceState';

export type LevelCompleteContinuationSurfaceResult =
    | {
          kind: 'runOnly';
          patch: {
              run: RunState;
          };
      }
    | {
          kind: 'gameOver';
          run: RunState;
      }
    | {
          kind: 'nextLevel';
          patch: Pick<
              RunSurfaceState,
              | 'boardPinMode'
              | 'destroyPairArmed'
              | 'matchScorePop'
              | 'mismatchScorePop'
              | 'peekModeArmed'
              | 'tileSwapArmed'
              | 'tileSwapFirstTileId'
          > & {
              newlyUnlockedAchievements: [];
              run: RunState;
              view: 'playing';
          };
          run: RunState;
      };

export const createLevelCompleteContinuationSurfaceResult = (run: RunState): LevelCompleteContinuationSurfaceResult => {
    // A cleared floor goes straight to the next one: the between-floor stops went with the dungeon layer.
    const floorAdvance = advanceFloorThroughGameplayCore(
        run,
        `floor-advance:${run.runSeed}:${(run.board?.level ?? 0) + 1}`
    );
    if (!floorAdvance.accepted) {
        return { kind: 'runOnly', patch: { run } };
    }
    const advancedRun = floorAdvance.run;

    if (advancedRun.status === 'gameOver') {
        return { kind: 'gameOver', run: advancedRun };
    }

    return {
        kind: 'nextLevel',
        patch: {
            newlyUnlockedAchievements: [],
            view: 'playing',
            ...createRunWithBoardInteractionClearedPatch(advancedRun)
        },
        run: advancedRun
    };
};

export const shouldPrepareMemorizeTimerForContinuation = (
    result: LevelCompleteContinuationSurfaceResult
): result is Extract<LevelCompleteContinuationSurfaceResult, { kind: 'nextLevel' }> => result.kind === 'nextLevel';
