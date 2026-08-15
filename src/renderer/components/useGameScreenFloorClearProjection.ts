import { useMemo } from 'react';
import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    type RunState
} from '../../shared/contracts';
import { getFloorIdentityContract } from '../../shared/boss-encounters';
import {
    getFeaturedObjectiveLabel,
    getFloorArchetypeDefinition,
    usesEndlessFloorSchedule
} from '../../shared/floor-mutator-schedule';
import { getFloorClearCausalityRows } from '../../shared/level-result-presentation';
import { canOfferEndlessRiskWager } from '../../shared/objective-rules';
import { routeChoicesForResult } from '../../shared/route-rules';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { formatLevelResultObjectiveLine } from '../../shared/secondary-objectives';
import {
    formatGameplayDetailRowsLabel,
    formatGameplaySignalRowsLabel,
    getClearLifeBonusLabel,
    getRiskWagerPrimaryCue,
    getRiskWagerSignalRows
} from './gameScreenDecisionSignals';
import {
    type FloorClearObjectiveSignalRow,
    countFavorBonusPicksBanked,
    featuredObjectiveFailReason,
    formatBonusTagsLine,
    getFloorClearActionSequenceCue,
    getFloorClearCarryForwardCue,
    getFloorClearCashoutRows,
    getFloorClearPayoffStackSignal
} from './gameScreenFloorClearFeedbackModel';

export const useGameScreenFloorClearProjection = ({
    onboardingDismissed,
    run
}: {
    onboardingDismissed: boolean;
    run: RunState;
}) => {
    const clearLifeBonusLabel = run.lastLevelResult ? getClearLifeBonusLabel(run.lastLevelResult) : null;
    const objectiveBonusLine =
        run.lastLevelResult && runNonNegativeInteger(run.lastLevelResult.objectiveBonusScore) > 0
            ? `Objective bonuses: +${runNonNegativeInteger(run.lastLevelResult.objectiveBonusScore).toLocaleString()}`
            : null;
    const bonusTagsLine = run.lastLevelResult ? formatBonusTagsLine(run.lastLevelResult.bonusTags) : null;
    const traitRouteObjectiveLine =
        run.lastLevelResult?.traitRouteObjectiveRequired != null
            ? run.lastLevelResult.traitRouteObjectiveCompleted
                ? `Trait routes: Complete (${run.lastLevelResult.traitRouteObjectiveReward ?? 'trait route cashout'})`
                : `Trait routes: ${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveProgress)}/${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveRequired)}`
            : null;
    const endlessChapterActive =
        run.gameMode === 'endless' && usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion);
    const currentArchetype = getFloorArchetypeDefinition(run.board?.floorArchetypeId ?? null);
    const currentFeaturedObjectiveLabel = getFeaturedObjectiveLabel(run.board?.featuredObjectiveId ?? null);
    const currentFloorIdentity = run.board
        ? getFloorIdentityContract({
              floorTag: run.board.floorTag ?? 'normal',
              floorArchetypeId: run.board.floorArchetypeId,
              mutators: run.activeMutators,
              featuredObjectiveLabel: currentFeaturedObjectiveLabel
          })
        : null;
    const floorClearCausalityRows = run.lastLevelResult
        ? getFloorClearCausalityRows(run.lastLevelResult, run.powersUsedThisRun, currentFloorIdentity)
        : [];
    const favorGained = runNonNegativeInteger(run.lastLevelResult?.relicFavorGained);
    const favorBankedPickCount = countFavorBonusPicksBanked(run.relicFavorProgress, favorGained);
    const floorClearMomentumRows = run.lastLevelResult
        ? [
              {
                  id: 'score',
                  label: 'Score pop',
                  value: `+${runNonNegativeInteger(run.lastLevelResult.scoreGained).toLocaleString()}`
              },
              {
                  id: 'rating',
                  label: 'Rating',
                  value: run.lastLevelResult.rating
              },
              runNonNegativeInteger(run.stats.bestStreak) > 0
                  ? {
                        id: 'streak',
                        label: 'Best chain',
                        value: `x${runNonNegativeInteger(run.stats.bestStreak)}`
                    }
                  : null,
              runNonNegativeInteger(run.findablesTotalThisFloor) > 0
                  ? {
                        id: 'pickups',
                        label: 'Pickups',
                        value: `${runNonNegativeInteger(run.findablesClaimedThisFloor)}/${runNonNegativeInteger(run.findablesTotalThisFloor)}`
                    }
                  : null,
              runNonNegativeInteger(run.stats.comboShards) > 0
                  ? {
                        id: 'shards',
                        label: 'Shards',
                        value: `${runNonNegativeInteger(run.stats.comboShards)}`
                    }
                  : null,
              favorGained > 0
                  ? {
                        id: 'favor',
                        label: 'Favor',
                        value:
                            favorBankedPickCount > 0
                                ? `+${favorGained} pick banked`
                                : `+${favorGained} -> ${run.relicFavorProgress}/3`
                    }
                  : null
          ].filter((row): row is { id: string; label: string; value: string } => row != null)
        : [];
    const floorClearMomentumRowsLabel = formatGameplaySignalRowsLabel(
        'Floor clear momentum signals',
        floorClearMomentumRows
    );
    const floorClearCashoutRows = getFloorClearCashoutRows(run);
    const floorClearCashoutRowsLabel = formatGameplayDetailRowsLabel(
        'Floor clear cashout read',
        floorClearCashoutRows
    );
    const floorClearCarryForwardCue = getFloorClearCarryForwardCue(run, favorBankedPickCount);
    const floorClearObjectiveSignalRows = run.lastLevelResult
        ? [
              run.lastLevelResult.featuredObjectiveId != null
                  ? {
                        id: 'featured-objective',
                        label: run.lastLevelResult.featuredObjectiveCompleted ? 'Objective paid' : 'Objective missed',
                        value: run.lastLevelResult.featuredObjectiveCompleted
                            ? `+${runNonNegativeInteger(run.lastLevelResult.objectiveBonusScore).toLocaleString()} score`
                            : 'Payout lost',
                        tone: run.lastLevelResult.featuredObjectiveCompleted ? 'reward' : 'risk'
                    }
                  : null,
              run.lastLevelResult.featuredObjectiveId != null
                  ? {
                        id: 'objective-streak',
                        label: 'Objective streak',
                        value: `x${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreak)}${
                            runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus) > 0
                                ? ` +${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus).toLocaleString()}`
                                : ''
                        }`,
                        tone: runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreak) > 1 ? 'momentum' : 'neutral'
                    }
                  : null,
              run.lastLevelResult.traitRouteObjectiveRequired != null
                  ? {
                        id: 'trait-route-objective',
                        label: run.lastLevelResult.traitRouteObjectiveCompleted ? 'Trait route paid' : 'Trait route',
                        value: run.lastLevelResult.traitRouteObjectiveCompleted
                            ? run.lastLevelResult.traitRouteObjectiveReward ?? 'Trait route cashout'
                            : `${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveProgress)}/${runNonNegativeInteger(run.lastLevelResult.traitRouteObjectiveRequired)}`,
                        tone: run.lastLevelResult.traitRouteObjectiveCompleted ? 'trait' : 'neutral'
                    }
                  : null,
              run.lastLevelResult.endlessRiskWagerOutcome
                  ? {
                        id: 'risk-wager',
                        label:
                            run.lastLevelResult.endlessRiskWagerOutcome === 'won'
                                ? 'Wager paid'
                                : 'Wager lost',
                        value:
                            run.lastLevelResult.endlessRiskWagerOutcome === 'won'
                                ? `+${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerFavorGained)} Favor`
                                : `-${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerStreakLost)} streak`,
                        tone: run.lastLevelResult.endlessRiskWagerOutcome === 'won' ? 'reward' : 'risk'
                    }
                  : null
          ].filter((row): row is FloorClearObjectiveSignalRow => row != null)
        : [];
    const floorClearObjectiveSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Floor clear objective signals',
        floorClearObjectiveSignalRows
    );
    const floorClearPayoffStackSignal = getFloorClearPayoffStackSignal(
        run,
        floorClearCashoutRows,
        floorClearObjectiveSignalRows,
        favorBankedPickCount
    );
    const featuredObjectiveResultLine = run.lastLevelResult ? formatLevelResultObjectiveLine(run.lastLevelResult) : null;
    const featuredObjectiveFailureLine = featuredObjectiveFailReason(run);
    const favorGainLine =
        run.lastLevelResult?.featuredObjectiveId != null ? `Favor gained: +${favorGained}` : null;
    const wagerSuretyActive = run.relicIds.includes('wager_surety');
    const offeredRiskWagerFavor = ENDLESS_RISK_WAGER_BONUS_FAVOR + (wagerSuretyActive ? 1 : 0);
    const endlessRiskWagerOutcomeLine =
        run.lastLevelResult?.endlessRiskWagerOutcome === 'won'
            ? `Risk wager won: +${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerFavorGained)} Favor`
            : run.lastLevelResult?.endlessRiskWagerOutcome === 'lost'
              ? `Risk wager lost: -${runNonNegativeInteger(run.lastLevelResult.endlessRiskWagerStreakLost)} streak`
              : null;
    const featuredObjectiveStreakLine =
        run.lastLevelResult?.featuredObjectiveId != null
            ? `Objective streak: x${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreak)}${
                  runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus) > 0
                      ? ` (+${runNonNegativeInteger(run.lastLevelResult.featuredObjectiveStreakBonus).toLocaleString()})`
                      : ''
              }`
            : null;
    const favorBankedLine =
        favorBankedPickCount > 0
            ? `Extra relic ${favorBankedPickCount === 1 ? 'pick' : 'picks'} banked for the next shrine`
            : null;
    const firstClearOnboardingLine =
        run.lastLevelResult?.level === 1 && onboardingDismissed
            ? 'First-run guide complete. Continue when you are ready; deeper help stays available from Codex.'
            : null;
    const endlessRiskWagerOfferAvailable = canOfferEndlessRiskWager(run);
    const acceptedEndlessRiskWager =
        run.lastLevelResult && run.endlessRiskWager?.acceptedOnLevel === run.lastLevelResult.level
            ? run.endlessRiskWager
            : null;
    const visibleRiskWagerSignalRows =
        acceptedEndlessRiskWager || endlessRiskWagerOfferAvailable
            ? getRiskWagerSignalRows({
                  armed: Boolean(acceptedEndlessRiskWager),
                  bonusFavor: acceptedEndlessRiskWager?.bonusFavorOnSuccess ?? offeredRiskWagerFavor,
                  streakAtRisk: acceptedEndlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
              })
            : [];
    const riskWagerPrimaryCue =
        acceptedEndlessRiskWager || endlessRiskWagerOfferAvailable
            ? getRiskWagerPrimaryCue({
                  armed: Boolean(acceptedEndlessRiskWager),
                  bonusFavor: acceptedEndlessRiskWager?.bonusFavorOnSuccess ?? offeredRiskWagerFavor,
                  streakAtRisk: acceptedEndlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
              })
            : null;
    const riskWagerArmAriaLabel =
        visibleRiskWagerSignalRows.length > 0
            ? `Arm wager. ${visibleRiskWagerSignalRows
                  .map((row) => `${row.label}: ${row.value}`)
                  .join('. ')}. Complete the next featured objective for bonus Favor; miss it and the streak ${
                  wagerSuretyActive ? 'falls to x1' : 'breaks'
              }.`
            : 'Arm wager';
    const riskWagerSignalRowsLabel = formatGameplaySignalRowsLabel(
        'Risk wager decision signals',
        visibleRiskWagerSignalRows
    );
    const routeChoices = useMemo(() => routeChoicesForResult(run.lastLevelResult), [run.lastLevelResult]);
    const routeChoiceRequired = routeChoices.length > 0 && !run.pendingRouteCardPlan;
    const floorClearActionSequenceCue = getFloorClearActionSequenceCue({
        carryForwardCue: floorClearCarryForwardCue,
        cashoutRows: floorClearCashoutRows,
        payoffStackSignal: floorClearPayoffStackSignal,
        routeChoiceRequired,
        run
    });
    const firstRouteChoiceRequired = routeChoiceRequired && run.lastLevelResult?.level === 1;
    const routeChoiceRequiredCopy =
        firstRouteChoiceRequired
            ? 'Choose the next room type. Safe protects the run, Greed trades danger for reward, and Mystery changes the next board.'
            : 'Pick one room to continue. Route choice is the active decision; other floor-clear actions resume after the route is locked.';

    return {
        clearLifeBonusLabel,
        objectiveBonusLine,
        bonusTagsLine,
        traitRouteObjectiveLine,
        endlessChapterActive,
        currentArchetype,
        currentFeaturedObjectiveLabel,
        currentFloorIdentity,
        floorClearCausalityRows,
        favorGained,
        favorBankedPickCount,
        floorClearMomentumRows,
        floorClearMomentumRowsLabel,
        floorClearCashoutRows,
        floorClearCashoutRowsLabel,
        floorClearCarryForwardCue,
        floorClearObjectiveSignalRows,
        floorClearObjectiveSignalRowsLabel,
        floorClearPayoffStackSignal,
        featuredObjectiveResultLine,
        featuredObjectiveFailureLine,
        favorGainLine,
        wagerSuretyActive,
        offeredRiskWagerFavor,
        endlessRiskWagerOutcomeLine,
        featuredObjectiveStreakLine,
        favorBankedLine,
        firstClearOnboardingLine,
        endlessRiskWagerOfferAvailable,
        acceptedEndlessRiskWager,
        visibleRiskWagerSignalRows,
        riskWagerPrimaryCue,
        riskWagerArmAriaLabel,
        riskWagerSignalRowsLabel,
        routeChoices,
        routeChoiceRequired,
        floorClearActionSequenceCue,
        firstRouteChoiceRequired,
        routeChoiceRequiredCopy
    };
};
