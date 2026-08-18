import { type HazardTileBoardSummary } from '../../shared/hazard-tiles';
import { type RunBuildProfile } from '../../shared/relics';
import type { GameplayHudBoardStateStripProps } from './GameplayHudBoardStateStrip';
import type { GameplayHudRewardPerkStripProps } from './GameplayHudRewardPerkStrip';
import type { HudPickupChainStackCueModel } from './gameplayHudChainAccentFeedbackModels';
import type { HudTraitOpportunitySummaryModel } from './gameplayHudTraitRouteFeedbackModels';
import { type TraitOpportunitySummary } from '../../shared/trait-opportunities';

export const buildGameplayHudBoardStateStripProps = ({
    buildProfile,
    claimedFindables,
    findableProgressMeterPercent,
    findableProgressState,
    findableProgressSubline,
    hazardTileSummary,
    pickupChainStackCue,
    pickupProgressTitle,
    pickupRewardPreviewLabel,
    pickupRewardPreviewRows,
    rewardPerkStripProps,
    totalFindables,
    traitOpportunitySummary,
    traitOpportunitySummaryModel
}: {
    buildProfile: RunBuildProfile;
    claimedFindables: number;
    findableProgressMeterPercent: number;
    findableProgressState: string;
    findableProgressSubline: string;
    hazardTileSummary: HazardTileBoardSummary;
    pickupChainStackCue: HudPickupChainStackCueModel | null;
    pickupProgressTitle: string;
    pickupRewardPreviewLabel: string;
    pickupRewardPreviewRows: GameplayHudBoardStateStripProps['pickupRewardPreviewRows'];
    rewardPerkStripProps: GameplayHudRewardPerkStripProps | null;
    totalFindables: number;
    traitOpportunitySummary: TraitOpportunitySummary;
    traitOpportunitySummaryModel: HudTraitOpportunitySummaryModel;
}): GameplayHudBoardStateStripProps => ({
    buildProfile,
    claimedFindables,
    findableProgressMeterPercent,
    findableProgressState,
    findableProgressSubline,
    hazardSummarySubline:
        hazardTileSummary.rows.length > 0
            ? `${hazardTileSummary.rows[0].label} x${hazardTileSummary.rows[0].count}${
                  hazardTileSummary.rows.length > 1 ? ` + ${hazardTileSummary.rows.length - 1} more` : ''
              }`
            : hazardTileSummary.hudLabel,
    hazardTileSummary,
    pickupChainStackCue,
    pickupProgressTitle,
    pickupRewardPreviewLabel,
    pickupRewardPreviewRows,
    rewardPerkStripProps,
    totalFindables,
    traitOpportunityCardCount: traitOpportunitySummary.tiles.length,
    traitOpportunitySummaryModel
});
