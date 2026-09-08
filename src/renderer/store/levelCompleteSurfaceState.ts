import type { RunState } from '../../shared/contracts';
import { advanceFloorThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import { repairRunProgressionThroughGameplayCore } from '../../shared/gameplay-core-adapters';
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
    // Through the command like the resolution controller's repair, so a floor-clear
    // repair is journalled rather than silently mutating the run.
    const repair = repairRunProgressionThroughGameplayCore(run);
    run = repair.accepted ? repair.run : run;

    /*
     * Every third floor used to stop here for a relic draft. The draft went in Gen 175, so a
     * cleared floor goes straight to the next one.
     */
    const nextRun = run;

    const floorAdvance = advanceFloorThroughGameplayCore(
        nextRun,
        `floor-advance:${nextRun.runSeed}:${(nextRun.board?.level ?? 0) + 1}`
    );
    if (!floorAdvance.accepted) {
        return { kind: 'runOnly', patch: { run: nextRun } };
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
