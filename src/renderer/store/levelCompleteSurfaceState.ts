import type { RunState } from '../../shared/contracts';
import { openRelicOfferThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import { advanceFloorThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import { needsRelicPick } from '../../shared/relics';
import { repairRunProgressionThroughGameplayCore } from '../../shared/gameplay-core-adapters';
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
    // Through the command like the resolution controller's repair, so a floor-clear
    // repair is journalled rather than silently mutating the run.
    const repair = repairRunProgressionThroughGameplayCore(run);
    run = repair.accepted ? repair.run : run;

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
        // Through the command so the offer appears in the journal: which relics were
        // presented is part of what happened in the run, and a replay that skips the
        // offer diverges from the moment the player picks.
        const offer = openRelicOfferThroughGameplayCore(nextRun);
        const offerRun = offer.run;
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
