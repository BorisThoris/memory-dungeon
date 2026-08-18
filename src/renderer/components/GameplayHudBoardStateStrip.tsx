import { type CSSProperties } from 'react';
import { type HazardTileBoardSummary } from '../../shared/hazard-tiles';
import { type RunBuildProfile } from '../../shared/relics';
import { type HudPickupChainStackCueModel } from './gameplayHudChainAccentFeedbackModels';
import { type HudTraitOpportunitySummaryModel } from './gameplayHudTraitRouteFeedbackModels';
import GameplayHudRewardPerkStrip, { type GameplayHudRewardPerkStripProps } from './GameplayHudRewardPerkStrip';
import styles from './GameScreen.module.css';

interface PickupRewardPreviewRow {
    id: string;
    rewardText: string;
}

export interface GameplayHudBoardStateStripProps {
    buildProfile: RunBuildProfile;
    findableProgressMeterPercent: number;
    findableProgressState: string;
    findableProgressSubline: string;
    hazardSummarySubline: string;
    hazardTileSummary: HazardTileBoardSummary;
    pickupChainStackCue: HudPickupChainStackCueModel | null;
    pickupProgressTitle: string;
    pickupRewardPreviewLabel: string;
    pickupRewardPreviewRows: readonly PickupRewardPreviewRow[];
    rewardPerkStripProps: GameplayHudRewardPerkStripProps | null;
    traitOpportunityCardCount: number;
    traitOpportunitySummaryModel: HudTraitOpportunitySummaryModel;
    totalFindables: number;
    claimedFindables: number;
}

const hudMeterStyle = (percent: number): CSSProperties =>
    ({
        '--hud-meter-fill': `${Math.max(0, Math.min(100, percent))}%`
    }) as CSSProperties;

const GameplayHudBoardStateStrip = ({
    buildProfile,
    findableProgressMeterPercent,
    findableProgressState,
    findableProgressSubline,
    hazardSummarySubline,
    hazardTileSummary,
    pickupChainStackCue,
    pickupProgressTitle,
    pickupRewardPreviewLabel,
    pickupRewardPreviewRows,
    rewardPerkStripProps,
    traitOpportunityCardCount,
    traitOpportunitySummaryModel,
    totalFindables,
    claimedFindables
}: GameplayHudBoardStateStripProps) => (
    <>
        {buildProfile.primary ? (
            <div
                className={styles.statPillCompact}
                data-testid="hud-build-profile"
                title={buildProfile.tooltip}
            >
                <span className={styles.statKey}>Build</span>
                <span className={styles.statVal}>
                    {buildProfile.primary.label} В· {buildProfile.primary.score}
                </span>
                <span className={styles.statSubline}>
                    {buildProfile.primary.decisionVerbs.slice(0, 3).join(' / ')}
                </span>
            </div>
        ) : null}
        {rewardPerkStripProps ? <GameplayHudRewardPerkStrip {...rewardPerkStripProps} /> : null}
        {totalFindables > 0 ? (
            <div
                className={`${styles.statPillCompact} ${styles.hudFindableProgressPill}`}
                data-findable-state={findableProgressState}
                data-testid="hud-findables-claimed"
                title={pickupProgressTitle}
            >
                <span className={styles.statKey}>Pickups</span>
                <span className={styles.statVal}>
                    {claimedFindables}/{totalFindables}
                </span>
                <span className={styles.statSubline}>{findableProgressSubline}</span>
                <span
                    aria-label={pickupRewardPreviewLabel}
                    className={styles.hudPickupRewardPreview}
                    data-testid="hud-pickup-reward-preview"
                >
                    {pickupRewardPreviewRows.map((row) => (
                        <span data-pickup-reward-kind={row.id} key={row.id}>
                            {row.rewardText}
                        </span>
                    ))}
                </span>
                {pickupChainStackCue ? (
                    <span
                        aria-label={pickupChainStackCue.ariaLabel}
                        className={styles.hudPickupStackCue}
                        data-pickup-stack-action={pickupChainStackCue.action}
                        data-pickup-stack-label={pickupChainStackCue.label}
                        data-testid="hud-pickup-stack-cue"
                    >
                        <small>{pickupChainStackCue.label}</small>
                        <strong>{pickupChainStackCue.action}</strong>
                        <em>{pickupChainStackCue.value}</em>
                    </span>
                ) : null}
                <span
                    aria-label={`Pickup reward meter ${claimedFindables} of ${totalFindables}`}
                    className={styles.hudMomentumMeter}
                    data-meter-kind="pickup"
                    data-testid="hud-pickup-meter"
                    style={hudMeterStyle(findableProgressMeterPercent)}
                />
            </div>
        ) : null}
        {hazardTileSummary.hasHazards ? (
            <div
                className={styles.statPillCompact}
                data-testid="hud-hazard-tiles"
                title={hazardTileSummary.hudDetail ?? 'Active hazard tiles on this floor'}
            >
                <span className={styles.statKey}>Hazards</span>
                <span className={styles.statVal}>{hazardTileSummary.totalHazardTiles}</span>
                <span className={styles.statSubline}>{hazardSummarySubline}</span>
            </div>
        ) : null}
        {traitOpportunityCardCount > 0 ? (
            <div
                className={`${styles.statPillCompact} ${styles.hudTraitOpportunityPill}`}
                data-testid="hud-trait-opportunity-cards"
                title={traitOpportunitySummaryModel.title}
            >
                <span className={styles.statKey}>Traits</span>
                <span className={styles.statVal}>{traitOpportunityCardCount}</span>
                <span className={styles.statSubline}>
                    {traitOpportunitySummaryModel.kindLine ??
                        traitOpportunitySummaryModel.cardCountLabel ??
                        'Combo cards'}
                </span>
                <span className={styles.hudTraitOpportunityRows}>
                    <small>{traitOpportunitySummaryModel.summaryLine}</small>
                </span>
            </div>
        ) : null}
    </>
);

export default GameplayHudBoardStateStrip;
