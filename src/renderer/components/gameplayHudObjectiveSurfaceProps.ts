import { type RewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { type FeaturedObjectiveId, type RunState } from '../../shared/contracts';
import { getFeaturedObjectiveHudTooltip } from '../../shared/floor-mutator-schedule';
import { type SecondaryObjectiveProgress } from '../../shared/secondary-objectives';
import type { GameplayHudObjectiveClusterProps, HudRiskWagerModel } from './GameplayHudObjectiveCluster';
import type { GameplayHudRewardPerkStripProps } from './GameplayHudRewardPerkStrip';
import type { HudObjectiveSignalFeedbackModel } from './gameplayHudObjectiveSignalFeedbackModel';
import type { HudRewardPerkFeedbackModel } from './gameplayHudRewardPerkFeedbackModel';

const formatHudPerkRowsLabel = (
    label: string,
    rows: readonly RewardPerkReadinessRow[]
): string => {
    const rowCopy = rows
        .map(
            (row) =>
                `${row.arcadeCue}: ${row.lane}: ${row.payoff}. ${
                    row.readinessLabel ? `State: ${row.readinessLabel}. ` : ''
                }Moment: ${row.moment}. Next: ${row.nextCue}. ${row.readinessDetail ?? row.label}`
        )
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

const buildRiskWagerModel = ({
    activeRiskWagerBeatCount,
    activeRiskWagerFavor,
    boardLevel,
    endlessChapterActive,
    run
}: {
    activeRiskWagerBeatCount: number;
    activeRiskWagerFavor: number;
    boardLevel: number;
    endlessChapterActive: boolean;
    run: RunState;
}): HudRiskWagerModel | null =>
    endlessChapterActive && run.endlessRiskWager?.targetLevel === boardLevel
        ? {
              ariaLabel: `Active risk wager. Protect streak. +${activeRiskWagerFavor} Favor. x${run.endlessRiskWager.streakAtRisk} streak at risk. ${activeRiskWagerBeatCount} beats.`,
              beatCount: activeRiskWagerBeatCount,
              bonusFavor: activeRiskWagerFavor,
              screenCue: run.endlessRiskWager.streakAtRisk >= 3 ? 'risk' : 'guard',
              streakAtRisk: run.endlessRiskWager.streakAtRisk,
              title: run.relicIds.includes('wager_surety')
                  ? "Complete this floor's featured objective to win bonus Favor; miss it and the streak falls to x1"
                  : "Complete this floor's featured objective to win bonus Favor; miss it and the streak resets"
          }
        : null;

export const buildGameplayHudObjectiveClusterProps = ({
    activeRiskWagerBeatCount,
    activeRiskWagerFavor,
    boardLevel,
    endlessChapterActive,
    favorProgressTitle,
    featuredObjectiveId,
    featuredObjectiveLabel,
    objectiveSignalFeedbackModel,
    relicFavorProgress,
    run,
    secondaryObjectiveRows
}: {
    activeRiskWagerBeatCount: number;
    activeRiskWagerFavor: number;
    boardLevel: number;
    endlessChapterActive: boolean;
    favorProgressTitle: string | undefined;
    featuredObjectiveId: FeaturedObjectiveId | null | undefined;
    featuredObjectiveLabel: string | null;
    objectiveSignalFeedbackModel: HudObjectiveSignalFeedbackModel;
    relicFavorProgress: number;
    run: RunState;
    secondaryObjectiveRows: readonly SecondaryObjectiveProgress[];
}): GameplayHudObjectiveClusterProps => ({
    endlessChapterActive,
    favorProgressTitle,
    featuredObjectiveLabel,
    featuredObjectiveTitle:
        getFeaturedObjectiveHudTooltip(featuredObjectiveId ?? null) ?? 'Featured objective for this endless floor',
    objectiveSignalRows: objectiveSignalFeedbackModel.rows,
    objectiveSignalsLabel: objectiveSignalFeedbackModel.label,
    relicFavorProgress,
    riskWager: buildRiskWagerModel({
        activeRiskWagerBeatCount,
        activeRiskWagerFavor,
        boardLevel,
        endlessChapterActive,
        run
    }),
    secondaryObjectiveRows
});

export const buildGameplayHudRewardPerkStripProps = ({
    feedbackModel,
    rows
}: {
    feedbackModel: HudRewardPerkFeedbackModel;
    rows: readonly RewardPerkReadinessRow[];
}): GameplayHudRewardPerkStripProps => ({
    ariaLabel: formatHudPerkRowsLabel('Active perk payoff signals', rows),
    feedbackModel,
    rows,
    title: rows.map((row) => `${row.label}: ${row.nextCue}`).join(' ')
});
