import type { RunState } from '../../shared/contracts';
import { advanceToNextLevel, openRelicOffer } from '../../shared/game-core';
import { needsRelicPick } from '../../shared/relics';
import { repairRunProgressionSoftlocks } from '../../shared/run-progression-repair';
import { createRunWithBoardInteractionClearedPatch, type RunSurfaceState } from './runSurfaceState';

export type LevelCompleteContinuationSurfaceResult =
    | {
          kind: 'sideRoom';
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
              run: RunState;
              view: 'sideRoom';
          };
      }
    | {
          kind: 'shop';
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
              run: RunState;
              shopReturnMode: 'summary';
              view: 'shop';
          };
      }
    | {
          kind: 'relicOffer';
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
              run: RunState;
              view: 'playing';
          };
      }
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

interface LevelCompleteContinuationSurfaceOptions {
    includeSummaryShop: boolean;
}

export const createLevelCompleteContinuationSurfaceResult = (
    run: RunState,
    { includeSummaryShop }: LevelCompleteContinuationSurfaceOptions
): LevelCompleteContinuationSurfaceResult => {
    run = repairRunProgressionSoftlocks(run);

    if (run.sideRoom) {
        return {
            kind: 'sideRoom',
            patch: {
                view: 'sideRoom',
                ...createRunWithBoardInteractionClearedPatch(run)
            }
        };
    }

    if (includeSummaryShop && run.shopOffers.length > 0) {
        return {
            kind: 'shop',
            patch: {
                view: 'shop',
                shopReturnMode: 'summary',
                ...createRunWithBoardInteractionClearedPatch(run)
            }
        };
    }

    let nextRun = run;

    if (needsRelicPick(nextRun) && !nextRun.relicOffer) {
        const offerRun = openRelicOffer(nextRun);
        if (offerRun.relicOffer) {
            return {
                kind: 'relicOffer',
                patch: {
                    view: 'playing',
                    ...createRunWithBoardInteractionClearedPatch(offerRun)
                }
            };
        }
        nextRun = offerRun;
    }

    if (nextRun.relicOffer) {
        return {
            kind: 'runOnly',
            patch: { run: nextRun }
        };
    }

    const advancedRun = advanceToNextLevel(nextRun);

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
