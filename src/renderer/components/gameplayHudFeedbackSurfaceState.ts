import { getRewardPerkReadinessRows } from '../../shared/bonus-rewards';
import { type RunState } from '../../shared/contracts';
import { getDefaultDifficultyProfile } from '../../shared/difficulty-profile';
import { getHazardTileBoardSummary } from '../../shared/hazard-tiles';
import {
    getInRunCauseRows,
    getPerfectMemoryAttribution,
    getTouchHudDetailRows
} from '../../shared/long-run-feedback';
import { getRunBuildProfile } from '../../shared/relics';
import { getSecondaryObjectiveStatusRows } from '../../shared/secondary-objectives';
import { getTraitOpportunityHudModel, getTraitOpportunitySummary } from '../../shared/trait-opportunities';
import { getTraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import { perfectMemoryHudKind } from '../copy/perfectMemory';
import type { GameplayHudContextState } from './gameplayHudContextState';
import { temporaryCurrencyPurpose } from './gameplayHudContextState';
import {
    buildGameplayHudObjectiveClusterProps,
    buildGameplayHudRewardPerkStripProps
} from './gameplayHudObjectiveSurfaceProps';
import { buildHudInRunCauseFeedbackModel } from './gameplayHudInRunCauseFeedbackModel';
import { buildHudObjectiveSignalFeedbackModel } from './gameplayHudObjectiveSignalFeedbackModel';
import type { GameplayHudRecentActionState } from './gameplayHudRecentActionState';
import { buildHudRewardPerkFeedbackModel } from './gameplayHudRewardPerkFeedbackModel';
import { buildHudTraitOpportunitySummaryModel } from './gameplayHudTraitRouteFeedbackModels';
import { buildGameplayHudBoardStateStripProps } from './gameplayHudBoardSurfaceProps';
import {
    buildGameplayHudLiveFeedbackStripProps,
    buildGameplayHudSecondaryDrawerProps
} from './gameplayHudLiveSecondarySurfaceProps';
import { buildGameplayHudRewardFlowState, type GameplayHudRewardFlowState } from './gameplayHudRewardFlowState';
import type { GameplayHudBoardStateStripProps } from './GameplayHudBoardStateStrip';
import type { GameplayHudLiveFeedbackStripProps } from './GameplayHudLiveFeedbackStrip';
import type { GameplayHudObjectiveClusterProps } from './GameplayHudObjectiveCluster';
import type { GameplayHudRewardPerkStripProps } from './GameplayHudRewardPerkStrip';
import type { GameplayHudSecondaryDrawerProps } from './GameplayHudSecondaryDrawer';
import type { GameplayHudTraitRouteDetailsProps } from './GameplayHudTraitRouteDetails';

const hudEndlessRiskWagerBeatCount = (streakAtRisk: number): 3 | 4 => (streakAtRisk >= 3 ? 4 : 3);

export interface GameplayHudFeedbackSurfaceState {
    boardStateStripProps: GameplayHudBoardStateStripProps;
    liveFeedbackStripProps: GameplayHudLiveFeedbackStripProps;
    objectiveClusterProps: GameplayHudObjectiveClusterProps;
    rewardFlowState: GameplayHudRewardFlowState;
    secondaryDrawerProps: GameplayHudSecondaryDrawerProps;
}

export const buildGameplayHudFeedbackSurfaceState = ({
    contextState,
    featuredObjectiveLabel,
    politeHudAnnouncement,
    recentActionState,
    reduceMotion,
    run
}: {
    contextState: GameplayHudContextState;
    featuredObjectiveLabel: string | null;
    politeHudAnnouncement: string;
    recentActionState: GameplayHudRecentActionState;
    reduceMotion: boolean;
    run: RunState;
}): GameplayHudFeedbackSurfaceState => {
    const board = run.board;
    if (!board) {
        throw new Error('Gameplay HUD feedback surface state requires an active board.');
    }

    const endlessChapterActive = contextState.endlessChapterActive;
    const activeRiskWagerFavor =
        run.endlessRiskWager != null
            ? run.endlessRiskWager.bonusFavorOnSuccess + (run.relicIds.includes('wager_surety') ? 1 : 0)
            : 0;
    const activeRiskWagerBeatCount = run.endlessRiskWager
        ? hudEndlessRiskWagerBeatCount(run.endlessRiskWager.streakAtRisk)
        : 0;
    const objectiveSignalFeedbackModel = buildHudObjectiveSignalFeedbackModel({
        activeRiskWagerFavor,
        featuredObjectiveLabel,
        relicFavorProgress: run.relicFavorProgress,
        riskWagerActive: Boolean(run.endlessRiskWager?.targetLevel === board.level),
        streakAtRisk: run.endlessRiskWager?.streakAtRisk ?? run.featuredObjectiveStreak
    });
    const secondaryObjectiveRows = getSecondaryObjectiveStatusRows(run);
    const objectiveClusterProps = buildGameplayHudObjectiveClusterProps({
        activeRiskWagerBeatCount,
        activeRiskWagerFavor,
        boardLevel: board.level,
        endlessChapterActive,
        favorProgressTitle: temporaryCurrencyPurpose(run, 'relic_favor'),
        featuredObjectiveId: board.featuredObjectiveId,
        featuredObjectiveLabel,
        objectiveSignalFeedbackModel,
        relicFavorProgress: run.relicFavorProgress,
        run,
        secondaryObjectiveRows
    });

    const buildProfile = getRunBuildProfile(run);
    const rewardPerkRows = getRewardPerkReadinessRows(run).slice(0, 3);
    const rewardPerkFeedbackModel = buildHudRewardPerkFeedbackModel(rewardPerkRows);
    const rewardPerkStripProps: GameplayHudRewardPerkStripProps | null =
        rewardPerkRows.length > 0
            ? buildGameplayHudRewardPerkStripProps({
                  feedbackModel: rewardPerkFeedbackModel,
                  rows: rewardPerkRows
              })
            : null;

    const hazardTileSummary = getHazardTileBoardSummary(board);
    const traitOpportunitySummary = getTraitOpportunitySummary(board);
    const traitOpportunityHud = getTraitOpportunityHudModel(board, run);
    const traitOpportunitySummaryModel = buildHudTraitOpportunitySummaryModel({
        hud: traitOpportunityHud,
        summary: traitOpportunitySummary
    });
    const traitOpportunityLaneLines =
        traitOpportunitySummary.interactionLines.length > 0
            ? traitOpportunitySummary.interactionLines
            : traitOpportunityHud.swapHint?.matchCreatedLines ?? [];
    const traitRouteObjectiveStatus = getTraitRouteObjectiveStatus(run);
    const rewardFlowState = buildGameplayHudRewardFlowState({
        run,
        traitOpportunityHud,
        traitOpportunityLaneLines,
        traitRouteObjectiveStatus
    });

    const boardStateStripProps = buildGameplayHudBoardStateStripProps({
        buildProfile,
        claimedFindables: run.findablesClaimedThisFloor,
        findableProgressMeterPercent: rewardFlowState.findableProgressMeterPercent,
        findableProgressState: rewardFlowState.findableProgressState,
        findableProgressSubline: rewardFlowState.findableProgressSubline,
        hazardTileSummary,
        pickupChainStackCue: rewardFlowState.pickupChainStackCue,
        pickupProgressTitle: rewardFlowState.pickupProgressTitle,
        pickupRewardPreviewLabel: rewardFlowState.pickupRewardPreviewLabel,
        pickupRewardPreviewRows: rewardFlowState.pickupRewardPreviewRows,
        rewardPerkStripProps,
        totalFindables: run.findablesTotalThisFloor,
        traitOpportunitySummary,
        traitOpportunitySummaryModel
    });

    const inRunCauseFeedbackModel = buildHudInRunCauseFeedbackModel(getInRunCauseRows(run).slice(0, 3));
    const liveFeedbackStripProps = buildGameplayHudLiveFeedbackStripProps({
        chainAccentFeedbackModel: rewardFlowState.chainAccentFeedbackModel,
        chainLaneCue: rewardFlowState.chainLaneCue,
        chainMilestonePreview: rewardFlowState.chainMilestonePreview,
        chainMomentumLabel: rewardFlowState.chainMomentumLabel,
        chainMomentumMeterPercent: rewardFlowState.chainMomentumMeterPercent,
        chainMomentumSubline: rewardFlowState.chainMomentumSubline,
        chainMomentumTier: rewardFlowState.chainMomentumTier,
        chainNextFirstCue: rewardFlowState.chainNextFirstCue,
        chainNextKeepCue: rewardFlowState.chainNextKeepCue,
        chainNextTargetFill: rewardFlowState.chainNextTargetFill,
        chainNextTargetLabel: rewardFlowState.nextChainTargetLabel,
        chainNextThenCue: rewardFlowState.chainNextThenCue,
        chainRewardFeedbackModel: rewardFlowState.chainRewardFeedbackModel,
        chainRewardForecastLabel: rewardFlowState.chainRewardForecastLabel,
        compactHudAnnouncement: recentActionState.compactHudAnnouncement,
        currentStreak: run.stats.currentStreak,
        endlessChapterActive,
        featuredObjectiveStreak: run.featuredObjectiveStreak,
        inRunCauseFeedbackModel,
        politeHudAnnouncement,
        primaryRewardHot: rewardFlowState.primaryRewardHot,
        recentActionAriaLabel: recentActionState.recentActionAriaLabel,
        recentActionFeedbackModel: recentActionState.recentActionFeedbackModel,
        recentActionImpact: recentActionState.recentActionImpact,
        recentActionLabel: recentActionState.recentActionLabel,
        recentActionTone: recentActionState.recentActionTone,
        reduceMotion,
        rewardProgress: rewardFlowState.primaryChainRewardProgress,
        runStatus: run.status,
        traitInteractionLaneFeedbackModel: rewardFlowState.traitInteractionLaneFeedbackModel,
        traitOpportunityHud,
        traitOpportunitySummary,
        traitRouteActionCue: rewardFlowState.traitRouteActionCue,
        traitRouteBestToolLabel: rewardFlowState.traitRouteBestToolLabel,
        traitRouteMeterPercent: rewardFlowState.traitRouteMeterPercent,
        traitRouteObjectiveStatus,
        traitRouteProgressLabel: rewardFlowState.traitRouteProgressLabel,
        traitRouteRewardUrgencyTag: rewardFlowState.traitRouteRewardFeedbackModel.urgencyTag,
        traitRouteStackCue: rewardFlowState.traitChainStackCue,
        traitRouteTitle: traitOpportunityHud.title
    });

    const traitRouteDetailsProps: GameplayHudTraitRouteDetailsProps | null = traitOpportunityHud.active
        ? {
              laneFeedbackModel: rewardFlowState.traitInteractionLaneFeedbackModel,
              routeStatus: traitRouteObjectiveStatus,
              stackCue: rewardFlowState.traitChainStackCue,
              summaryModel: traitOpportunitySummaryModel,
              swapHintText: traitOpportunityHud.swapHint?.text ?? null,
              toolLine: traitOpportunityHud.toolLine
          }
        : null;
    const perfectMemoryHud = perfectMemoryHudKind(run.achievementsEnabled, run.powersUsedThisRun);
    const perfectMemoryAttribution = getPerfectMemoryAttribution(run);
    const difficultyProfile = getDefaultDifficultyProfile();
    const touchHudDetailRows = getTouchHudDetailRows(run);
    const secondaryDrawerProps = buildGameplayHudSecondaryDrawerProps({
        difficultyProfile,
        perfectMemoryAttribution,
        perfectMemoryHud,
        run,
        touchHudDetailRows,
        traitRouteDetailsProps
    });

    return {
        boardStateStripProps,
        liveFeedbackStripProps,
        objectiveClusterProps,
        rewardFlowState,
        secondaryDrawerProps
    };
};
