import type { RunState } from '../../shared/contracts';
import {
    advanceFloorThroughGameplayCore,
    openRelicOfferThroughGameplayCore,
    repairRunProgressionThroughGameplayCore
} from '../../shared/gameplay-core-adapters';
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
    run = repairRunProgressionThroughGameplayCore(
        run,
        `progression-repair:${run.runSeed}:${run.board?.level ?? 0}:${Array.isArray(run.gameplayCommandJournal) ? run.gameplayCommandJournal.length : 0}`
    ).run;

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

    if (!nextRun.relicOffer) {
        const offerOpen = openRelicOfferThroughGameplayCore(
            nextRun,
            `relic-offer-open:${nextRun.runSeed}:${nextRun.lastLevelResult?.level ?? 0}:${nextRun.relicTiersClaimed}`
        );
        if (offerOpen.accepted) {
            nextRun = offerOpen.run;
        }
        if (nextRun.relicOffer) {
            return {
                kind: 'relicOffer',
                patch: {
                    view: 'playing',
                    ...createRunWithBoardInteractionClearedPatch(nextRun)
                }
            };
        }
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
