import type { ComponentProps, CSSProperties } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './TileBoard.module.css';
import TileBoardChainOpportunityActionPriority from './TileBoardChainOpportunityActionPriority';
import TileBoardChainOpportunityBeatMap from './TileBoardChainOpportunityBeatMap';
import TileBoardChainOpportunityCadenceMap from './TileBoardChainOpportunityCadenceMap';
import TileBoardChainOpportunityMarkerKey from './TileBoardChainOpportunityMarkerKey';
import TileBoardChainOpportunityProgressionCues from './TileBoardChainOpportunityProgressionCues';
import TileBoardChainOpportunityRewardLadder from './TileBoardChainOpportunityRewardLadder';
import TileBoardChainOpportunityShotMap from './TileBoardChainOpportunityShotMap';
import TileBoardChainOpportunityStatusMeters from './TileBoardChainOpportunityStatusMeters';

interface ChainOpportunityEyebrowView {
    beatAction: string;
    beatAudio: string;
    beatCount: number;
    beatScreenCue: string;
    beatState: string;
    label: string;
}

interface ChainOpportunityPriorityView {
    beatAudio: string;
    beatCount: number;
    beatScreenCue: string;
    id: string;
    label: string;
}

interface ChainOpportunityCueView {
    beatAction: string;
    beatAudio: string;
    beatCount: number;
    beatScreenCue: string;
    beatState: string;
    fill: number;
    label: string;
}

interface ChainOpportunityRoleLaneView {
    action: string;
    count: number;
    id: string;
    label: string;
    tone: string;
}

interface ChainOpportunityPrimaryTraitLaneView {
    accessibleLabel: string;
    action: string;
    audio: string;
    beatCount: number;
    count: number;
    label: string;
    role: string;
    roleId: string;
    screenCue: string;
    traitLaneId: string;
}

interface ChainOpportunityBeatView {
    action: string;
    actionId: string;
    accessibleLabel: string;
    audio: string;
    beatCount: number;
    detail: string;
    label: string;
    meterFill: number;
    screenCue: string;
    tier: string;
}

interface ChainOpportunityNextActionView {
    accessibleLabel: string;
    detail: string | null;
    id: string;
    meterFill: number;
    pipCount: number;
    tier: string;
    tone: string;
    verb: string;
}

interface ChainOpportunityPrimaryShotView {
    accessibleLabel: string;
    beatCount: number;
    beatId: string;
    cadenceAction: string | null;
    cadenceId: string;
    detail: string;
    focus: string;
    id: string;
    screenCue: string;
    shotAudio: string;
    shotLabel: string;
}

interface ChainOpportunityArcadeCalloutView {
    action: string;
    audio: string;
    beatCount: number;
    label: string;
    screenCue: string;
    tone: string;
    value: string;
}

interface ChainOpportunityRecipeRowView {
    action: string;
    beatCount: number;
    label: string;
    laneId: string;
    recipe: string;
    roleId: string;
    sourceLine: string;
}

interface ChainOpportunityRecipesView {
    accessibleLabel: string;
    meterFill: number;
    rows: ChainOpportunityRecipeRowView[];
}

interface TraitInteractionLanePrimaryView {
    action: string;
    audio: string;
    id: string;
    role: string;
    roleId: string;
    screenCue: string;
}

interface TraitInteractionLaneRowView {
    action: string;
    audio: string;
    beats: number;
    count: number;
    cue: string;
    focus: 'primary' | 'support';
    id: string;
    label: string;
    role: string;
    roleId: string;
    screenCue: string;
}

interface TraitInteractionLaneMapView {
    accessibleLabel: string;
    actionMap: string;
    laneMap: string;
    meterFill: number;
    primary: TraitInteractionLanePrimaryView | null;
    roleMap: string;
    rows: TraitInteractionLaneRowView[];
    summaryAccessibleLabel: string;
    summaryBeatCount: number;
}

interface TraitLaneBeatMapRowView {
    action: string;
    audio: string;
    beatCount: number;
    count: number;
    focus: 'primary' | 'support';
    id: string;
    label: string;
    role: string;
    roleId: string;
    screenCue: string;
}

interface TraitLaneBeatMapView {
    accessibleLabel: string;
    meterFill: number;
    primaryAction: string;
    primaryAudio: string;
    primaryId: string;
    primaryRole: string;
    primaryRoleId: string;
    primaryScreenCue: string;
    rows: TraitLaneBeatMapRowView[];
    summaryAccessibleLabel: string;
    summaryAction: string;
    summaryBeatCount: number;
    summaryScreenCue: string;
    summaryTier: string;
}

interface ChainOpportunityMeterLaneView {
    action: string;
    count: number;
    id: string;
    label: string;
    pipCount: number;
    tone: string;
}

interface ChainOpportunityMeterView {
    accessibleLabel: string;
    fill: number;
    lanes: ChainOpportunityMeterLaneView[];
    nextRouteBeatCount: number;
    nextRouteLabel: string;
    secondaryRouteLabel: string | null;
    tone: string;
}

export interface TileBoardChainOpportunityChipProps {
    accessibleLabel: string;
    actionPriority: ComponentProps<typeof TileBoardChainOpportunityActionPriority>;
    arcadeCallout: ChainOpportunityArcadeCalloutView | null;
    beat: ChainOpportunityBeatView | null;
    beatMap: ComponentProps<typeof TileBoardChainOpportunityBeatMap>;
    cadenceMap: ComponentProps<typeof TileBoardChainOpportunityCadenceMap>;
    compact?: boolean;
    cue: ChainOpportunityCueView;
    eyebrow: ChainOpportunityEyebrowView;
    markerKey: ComponentProps<typeof TileBoardChainOpportunityMarkerKey>;
    meter: ChainOpportunityMeterView | null;
    nextAction: ChainOpportunityNextActionView | null;
    primaryShot: ChainOpportunityPrimaryShotView | null;
    primaryTraitLane: ChainOpportunityPrimaryTraitLaneView | null;
    priority: ChainOpportunityPriorityView | null;
    progressionCues: ComponentProps<typeof TileBoardChainOpportunityProgressionCues>;
    recipes: ChainOpportunityRecipesView | null;
    rewardLadder: ComponentProps<typeof TileBoardChainOpportunityRewardLadder>;
    roleSummaryLanes: ChainOpportunityRoleLaneView[];
    shotMap: ComponentProps<typeof TileBoardChainOpportunityShotMap>;
    statusMeters: ComponentProps<typeof TileBoardChainOpportunityStatusMeters>;
    tone: string;
    traitInteractionLaneMap: TraitInteractionLaneMapView | null;
    traitLaneBeatMap: TraitLaneBeatMapView | null;
}

const TileBoardChainOpportunityChip = ({
    accessibleLabel,
    actionPriority,
    arcadeCallout,
    beat,
    beatMap,
    cadenceMap,
    compact = false,
    cue,
    eyebrow,
    markerKey,
    meter,
    nextAction,
    primaryShot,
    primaryTraitLane,
    priority,
    progressionCues,
    recipes,
    rewardLadder,
    roleSummaryLanes,
    shotMap,
    statusMeters,
    tone,
    traitInteractionLaneMap,
    traitLaneBeatMap
}: TileBoardChainOpportunityChipProps) => {
    const renderedRoleSummaryLanes = compact ? roleSummaryLanes.slice(0, 2) : roleSummaryLanes;

    return (
        <div
        aria-label={accessibleLabel}
        className={styles.chainOpportunityChip}
        data-chain-opportunity-tone={tone}
        data-testid="chain-opportunity-chip"
        role="status"
    >
        <span className={styles.chainOpportunityEyebrow}>
            {eyebrow.label}
            <FeedbackBeatPips
                className={styles.chainOpportunityEyebrowBeatPips}
                count={eyebrow.beatCount}
                itemProps={(index) => ({
                    'data-chain-eyebrow-beat': index + 1,
                    'data-chain-eyebrow-beat-action': eyebrow.beatAction,
                    'data-chain-eyebrow-beat-audio': eyebrow.beatAudio,
                    'data-chain-eyebrow-beat-focus': index === 0 ? 'primary' : 'support',
                    'data-chain-eyebrow-beat-screen-cue': eyebrow.beatScreenCue,
                    'data-chain-eyebrow-beat-state': eyebrow.beatState
                })}
                keyPrefix={`chain-eyebrow-${eyebrow.beatAction}`}
            />
        </span>
        {priority ? (
            <span className={styles.chainOpportunityPriority} data-chain-priority={priority.id}>
                {priority.label}
                <FeedbackBeatPips
                    className={styles.chainOpportunityPriorityBeatPips}
                    count={priority.beatCount}
                    itemProps={(index) => ({
                        'data-chain-priority-beat': index + 1,
                        'data-chain-priority-beat-action': priority.id,
                        'data-chain-priority-beat-audio': priority.beatAudio,
                        'data-chain-priority-beat-focus': index === 0 ? 'primary' : 'support',
                        'data-chain-priority-beat-screen-cue': priority.beatScreenCue
                    })}
                    keyPrefix={`chain-priority-${priority.id}`}
                />
            </span>
        ) : null}
        <span
            aria-label={`Chain cue meter. ${cue.label}.`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={cue.fill}
            className={styles.chainOpportunityCue}
            data-chain-cue-meter-fill={cue.fill}
            data-chain-cue-meter-state={cue.beatState}
            role="progressbar"
            style={{ '--chain-cue-meter-fill': `${cue.fill}%` } as CSSProperties}
        >
            {cue.label}
            <i aria-hidden="true" className={styles.chainOpportunityCueMeter}>
                <i aria-hidden="true" className={styles.chainOpportunityCueMeterFill} />
            </i>
        </span>
        <FeedbackBeatPips
            className={styles.chainOpportunityCueBeatPips}
            count={cue.beatCount}
            itemProps={(index) => ({
                'data-chain-cue-beat': index + 1,
                'data-chain-cue-beat-action': cue.beatAction,
                'data-chain-cue-beat-audio': cue.beatAudio,
                'data-chain-cue-beat-focus': index === 0 ? 'primary' : 'support',
                'data-chain-cue-beat-screen-cue': cue.beatScreenCue,
                'data-chain-cue-beat-state': cue.beatState
            })}
            keyPrefix={`chain-cue-${cue.beatAction}`}
        />
        <span aria-label="Chain role summary." className={styles.chainOpportunityRoleSummary} data-testid="chain-opportunity-role-summary">
            {renderedRoleSummaryLanes.map((lane) => (
                <span
                    aria-hidden="true"
                    className={styles.chainOpportunityRoleSummaryLane}
                    data-chain-role-lane={lane.id}
                    data-chain-role-lane-action={lane.action}
                    data-chain-role-lane-count={lane.count}
                    data-chain-role-lane-tone={lane.tone}
                    key={lane.id}
                >
                    <small>{lane.label}</small>
                    <b>{lane.count}</b>
                    <span aria-hidden="true" className={styles.chainOpportunityRoleSummaryPips}>
                        {Array.from({ length: Math.min(4, lane.count) }, (_, index) => (
                            <i
                                data-chain-role-lane-pip={index + 1}
                                data-chain-role-lane-pip-action={lane.action}
                                data-chain-role-lane-pip-tone={lane.tone}
                                key={`${lane.id}-${index}`}
                            />
                        ))}
                    </span>
                </span>
            ))}
        </span>
        <i
            aria-hidden="true"
            className={styles.chainOpportunityMeterFill}
            data-chain-meter-fill={meter?.fill ?? 0}
            style={{ '--chain-meter-fill': `${meter?.fill ?? 0}%` } as CSSProperties}
        />
        {primaryTraitLane ? (
            <span
                aria-label={primaryTraitLane.accessibleLabel}
                className={styles.chainOpportunityPrimaryTraitLane}
                data-card-trait-lane-primary={primaryTraitLane.traitLaneId}
                data-card-trait-lane-primary-action={primaryTraitLane.action}
                data-card-trait-lane-primary-audio={primaryTraitLane.audio}
                data-card-trait-lane-primary-beats={primaryTraitLane.beatCount}
                data-card-trait-lane-primary-role={primaryTraitLane.role}
                data-card-trait-lane-primary-role-id={primaryTraitLane.roleId}
                data-card-trait-lane-primary-screen-cue={primaryTraitLane.screenCue}
                data-testid="chain-opportunity-primary-trait-lane"
            >
                <small>Next lane</small>
                <b>{primaryTraitLane.action}</b>
                <em>
                    {primaryTraitLane.label} x{primaryTraitLane.count}
                </em>
                <span aria-hidden="true" className={styles.chainOpportunityPrimaryTraitLanePips}>
                    {Array.from({ length: primaryTraitLane.beatCount }, (_, index) => (
                        <i data-card-trait-lane-primary-pip={index + 1} key={index} />
                    ))}
                </span>
            </span>
        ) : null}
        {beat ? (
            <span
                aria-label={beat.accessibleLabel}
                className={styles.chainOpportunityBeat}
                data-chain-beat-action={beat.action}
                data-chain-beat-action-id={beat.actionId}
                data-chain-beat-audio={beat.audio}
                data-chain-beat-meter-fill={beat.meterFill}
                data-chain-beat-screen-cue={beat.screenCue}
                data-chain-beat-tier={beat.tier}
                data-testid="chain-opportunity-beat"
                style={{ '--chain-beat-meter-fill': `${beat.meterFill}%` } as CSSProperties}
            >
                <small>{beat.label}</small>
                <b>{beat.action}</b>
                <i aria-hidden="true" className={styles.chainOpportunityBeatMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityBeatMeterFill} />
                </i>
                <FeedbackBeatPips
                    containerTag="strong"
                    count={beat.beatCount}
                    itemProps={(index) => ({
                        'data-chain-opportunity-beat-pip': index + 1,
                        'data-chain-opportunity-beat-pip-action': beat.actionId,
                        'data-chain-opportunity-beat-pip-audio': beat.audio,
                        'data-chain-opportunity-beat-pip-focus': index === 0 ? 'primary' : 'support',
                        'data-chain-opportunity-beat-pip-screen-cue': beat.screenCue,
                        'data-chain-opportunity-beat-pip-tier': beat.tier
                    })}
                    keyPrefix={`chain-opportunity-beat-${beat.actionId}`}
                />
                <em>{beat.detail}</em>
            </span>
        ) : null}
        {nextAction ? (
            <span
                aria-label={nextAction.accessibleLabel}
                className={styles.chainOpportunityNextAction}
                data-chain-next-action={nextAction.id}
                data-chain-next-action-meter-fill={nextAction.meterFill}
                data-chain-next-action-tier={nextAction.tier}
                data-chain-next-action-tone={nextAction.tone}
                data-testid="chain-opportunity-next-action"
                style={{ '--chain-next-action-meter-fill': `${nextAction.meterFill}%` } as CSSProperties}
            >
                <small>{nextAction.verb}</small>
                {nextAction.detail ? <b>{nextAction.detail}</b> : null}
                <i aria-hidden="true" className={styles.chainOpportunityNextActionMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityNextActionMeterFill} />
                </i>
                <span aria-hidden="true" className={styles.chainOpportunityNextActionPips}>
                    {Array.from({ length: nextAction.pipCount }, (_, index) => (
                        <i
                            data-chain-next-action-pip={index + 1}
                            data-chain-next-action-pip-focus={index === 0 ? 'primary' : 'support'}
                            key={index}
                        />
                    ))}
                </span>
            </span>
        ) : null}
        {primaryShot ? (
            <span
                aria-label={primaryShot.accessibleLabel}
                className={styles.chainOpportunityPrimaryShot}
                data-card-primary-shot={primaryShot.id}
                data-card-primary-shot-audio={primaryShot.shotAudio}
                data-card-primary-shot-beat={primaryShot.beatId}
                data-card-primary-shot-beats={primaryShot.beatCount}
                data-card-primary-shot-cadence={primaryShot.cadenceId}
                data-card-primary-shot-cadence-action={primaryShot.cadenceAction ?? 'none'}
                data-card-primary-shot-detail={primaryShot.detail}
                data-card-primary-shot-focus={primaryShot.focus}
                data-card-primary-shot-screen-cue={primaryShot.screenCue}
                data-testid="chain-opportunity-primary-shot"
            >
                <small>Best shot</small>
                <b>{primaryShot.shotLabel}</b>
                <em>{primaryShot.detail}</em>
                {primaryShot.beatId !== 'none' ? (
                    <span aria-hidden="true" className={styles.chainOpportunityPrimaryShotBeatPips}>
                        {Array.from({ length: primaryShot.beatCount }, (_, index) => (
                            <i
                                data-card-primary-shot-beat-pip={index + 1}
                                data-card-primary-shot-beat-pip-focus={index === 0 ? 'primary' : 'support'}
                                data-card-primary-shot-beat-pip-screen-cue={primaryShot.screenCue}
                                data-card-primary-shot-beat-pip-shot-focus={primaryShot.focus}
                                key={index}
                            />
                        ))}
                    </span>
                ) : null}
                {primaryShot.cadenceAction ? <strong>{primaryShot.cadenceAction}</strong> : null}
            </span>
        ) : null}
        {arcadeCallout ? (
            <span
                className={styles.chainOpportunityArcadeCallout}
                data-chain-callout-tone={arcadeCallout.tone}
                data-testid="chain-opportunity-arcade-callout"
            >
                <small>{arcadeCallout.label}</small>
                <b>{arcadeCallout.value}</b>
                <span aria-hidden="true" className={styles.chainOpportunityArcadeCalloutBeatPips}>
                    {Array.from({ length: arcadeCallout.beatCount }, (_, index) => (
                        <i
                            data-chain-callout-beat={index + 1}
                            data-chain-callout-beat-action={arcadeCallout.action}
                            data-chain-callout-beat-audio={arcadeCallout.audio}
                            data-chain-callout-beat-focus={index === 0 ? 'primary' : 'support'}
                            data-chain-callout-beat-screen-cue={arcadeCallout.screenCue}
                            data-chain-callout-beat-tone={arcadeCallout.tone}
                            key={index}
                        />
                    ))}
                </span>
            </span>
        ) : null}
        {recipes ? (
            <span
                aria-label={recipes.accessibleLabel}
                className={styles.chainOpportunityRecipe}
                data-chain-recipe-meter-fill={recipes.meterFill}
                data-testid="chain-opportunity-recipes"
                style={{ '--chain-recipe-meter-fill': `${recipes.meterFill}%` } as CSSProperties}
            >
                <i aria-hidden="true" className={styles.chainOpportunityRecipeMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityRecipeMeterFill} />
                </i>
                {recipes.rows.map((row) => (
                    <b
                        data-chain-recipe={row.recipe}
                        data-chain-recipe-action={row.action}
                        data-chain-recipe-label={row.label}
                        data-chain-recipe-lane={row.laneId}
                        data-chain-recipe-role-id={row.roleId}
                        data-chain-recipe-source={row.sourceLine}
                        key={row.recipe}
                    >
                        {row.recipe}
                        <span aria-hidden="true" className={styles.chainOpportunityRecipeBeatPips}>
                            {Array.from({ length: row.beatCount }, (_, index) => (
                                <i
                                    data-chain-recipe-beat={index + 1}
                                    data-chain-recipe-beat-focus={index === 0 ? 'primary' : 'support'}
                                    data-chain-recipe-beat-lane={row.laneId}
                                    data-chain-recipe-beat-role-id={row.roleId}
                                    key={index}
                                />
                            ))}
                        </span>
                    </b>
                ))}
            </span>
        ) : null}
        {traitInteractionLaneMap ? (
            <span
                aria-label={traitInteractionLaneMap.accessibleLabel}
                className={styles.chainOpportunityTraitLaneMap}
                data-testid="chain-opportunity-trait-lane-map"
                data-trait-interaction-lane-actions={traitInteractionLaneMap.actionMap}
                data-trait-interaction-lane-map={traitInteractionLaneMap.laneMap}
                data-trait-interaction-lane-primary={traitInteractionLaneMap.primary?.id ?? 'none'}
                data-trait-interaction-lane-primary-action={traitInteractionLaneMap.primary?.action ?? 'none'}
                data-trait-interaction-lane-primary-audio={traitInteractionLaneMap.primary?.audio ?? 'none'}
                data-trait-interaction-lane-primary-role={traitInteractionLaneMap.primary?.role ?? 'none'}
                data-trait-interaction-lane-primary-role-id={traitInteractionLaneMap.primary?.roleId ?? 'none'}
                data-trait-interaction-lane-primary-screen-cue={traitInteractionLaneMap.primary?.screenCue ?? 'none'}
                data-trait-interaction-lane-roles={traitInteractionLaneMap.roleMap}
            >
                <span
                    aria-label={traitInteractionLaneMap.summaryAccessibleLabel}
                    className={styles.chainOpportunityTraitLaneMapSummary}
                    data-testid="chain-opportunity-trait-lane-map-summary"
                    data-trait-interaction-lane-map-meter-fill={traitInteractionLaneMap.meterFill}
                    style={{ '--trait-interaction-lane-map-meter-fill': `${traitInteractionLaneMap.meterFill}%` } as CSSProperties}
                >
                    <small>Traits</small>
                    <b>
                        {traitInteractionLaneMap.rows.length} {traitInteractionLaneMap.rows.length === 1 ? 'lane' : 'lanes'}
                    </b>
                    <span aria-hidden="true" className={styles.chainOpportunityTraitLaneMapSummaryBeatPips}>
                        {Array.from({ length: traitInteractionLaneMap.summaryBeatCount }, (_, index) => (
                            <i
                                data-trait-interaction-lane-summary-beat={index + 1}
                                data-trait-interaction-lane-summary-beat-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    <i aria-hidden="true" className={styles.chainOpportunityTraitLaneMapMeter}>
                        <i aria-hidden="true" className={styles.chainOpportunityTraitLaneMapMeterFill} />
                    </i>
                </span>
                {traitInteractionLaneMap.rows.map((lane) => (
                    <span
                        aria-label={`Trait interaction lane. ${lane.label}. ${lane.role}. ${lane.action}. ${lane.count}. ${lane.cue}.`}
                        data-trait-interaction-lane={lane.id}
                        data-trait-interaction-lane-action={lane.action}
                        data-trait-interaction-lane-audio={lane.audio}
                        data-trait-interaction-lane-beats={lane.beats}
                        data-trait-interaction-lane-count={lane.count}
                        data-trait-interaction-lane-focus={lane.focus}
                        data-trait-interaction-lane-role={lane.role}
                        data-trait-interaction-lane-role-id={lane.roleId}
                        data-trait-interaction-lane-screen-cue={lane.screenCue}
                        key={lane.id}
                    >
                        <small>{lane.label}</small>
                        <b>{lane.role}</b>
                        <strong>{lane.action}</strong>
                        <span aria-hidden="true" className={styles.chainOpportunityTraitLaneMapBeatPips}>
                            {Array.from({ length: lane.beats }, (_, index) => (
                                <i
                                    data-trait-interaction-lane-beat={index + 1}
                                    data-trait-interaction-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={index}
                                />
                            ))}
                        </span>
                        <em>
                            x{lane.count} / {lane.cue}
                        </em>
                    </span>
                ))}
            </span>
        ) : null}
        <TileBoardChainOpportunityMarkerKey {...markerKey} />
        <TileBoardChainOpportunityActionPriority {...actionPriority} />
        <TileBoardChainOpportunityShotMap {...shotMap} />
        <TileBoardChainOpportunityBeatMap {...beatMap} />
        <TileBoardChainOpportunityCadenceMap {...cadenceMap} />
        {traitLaneBeatMap ? (
            <span
                aria-label={traitLaneBeatMap.accessibleLabel}
                className={styles.chainOpportunityTraitLaneBeatMap}
                data-card-trait-lane-beat-map-summary-action={traitLaneBeatMap.summaryAction}
                data-card-trait-lane-beat-map-summary-beats={traitLaneBeatMap.summaryBeatCount}
                data-card-trait-lane-beat-map-summary-screen-cue={traitLaneBeatMap.summaryScreenCue}
                data-card-trait-lane-beat-map-summary-tier={traitLaneBeatMap.summaryTier}
                data-card-trait-lane-beat-primary={traitLaneBeatMap.primaryId}
                data-card-trait-lane-beat-primary-role={traitLaneBeatMap.primaryRole}
                data-card-trait-lane-beat-primary-role-id={traitLaneBeatMap.primaryRoleId}
                data-card-trait-lane-primary-action={traitLaneBeatMap.primaryAction}
                data-card-trait-lane-primary-audio={traitLaneBeatMap.primaryAudio}
                data-card-trait-lane-primary-role={traitLaneBeatMap.primaryRole}
                data-card-trait-lane-primary-role-id={traitLaneBeatMap.primaryRoleId}
                data-card-trait-lane-primary-screen-cue={traitLaneBeatMap.primaryScreenCue}
                data-testid="chain-opportunity-trait-lane-beat-map"
            >
                <span
                    aria-label={traitLaneBeatMap.summaryAccessibleLabel}
                    className={styles.chainOpportunityTraitLaneBeatMapSummary}
                    data-card-trait-lane-beat-map-meter-fill={traitLaneBeatMap.meterFill}
                    data-card-trait-lane-beat-map-summary-action={traitLaneBeatMap.summaryAction}
                    data-card-trait-lane-beat-map-summary-beats={traitLaneBeatMap.summaryBeatCount}
                    data-card-trait-lane-beat-map-summary-screen-cue={traitLaneBeatMap.summaryScreenCue}
                    data-card-trait-lane-beat-map-summary-tier={traitLaneBeatMap.summaryTier}
                    data-testid="chain-opportunity-trait-lane-beat-map-summary"
                    style={{ '--card-trait-lane-beat-map-meter-fill': `${traitLaneBeatMap.meterFill}%` } as CSSProperties}
                >
                    <small>Beats</small>
                    <b>
                        {traitLaneBeatMap.rows.length} {traitLaneBeatMap.rows.length === 1 ? 'lane' : 'lanes'}
                    </b>
                    <span aria-hidden="true" className={styles.chainOpportunityTraitLaneBeatMapSummaryPips}>
                        {Array.from({ length: traitLaneBeatMap.summaryBeatCount }, (_, index) => (
                            <i
                                data-card-trait-lane-beat-map-summary-pip={index + 1}
                                data-card-trait-lane-beat-map-summary-pip-action={traitLaneBeatMap.summaryAction}
                                data-card-trait-lane-beat-map-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    <i aria-hidden="true" className={styles.chainOpportunityTraitLaneBeatMapMeter}>
                        <i aria-hidden="true" className={styles.chainOpportunityTraitLaneBeatMapMeterFill} />
                    </i>
                </span>
                {traitLaneBeatMap.rows.map((row) => (
                    <span
                        aria-label={`Trait lane beat row. ${row.label}. ${row.role}. ${row.count}. ${row.beatCount}-beat ${row.action}.`}
                        data-card-trait-lane-beat={row.id}
                        data-card-trait-lane-beat-audio={row.audio}
                        data-card-trait-lane-beat-focus={row.focus}
                        data-card-trait-lane-beat-role={row.role}
                        data-card-trait-lane-beat-role-id={row.roleId}
                        data-card-trait-lane-beat-screen-cue={row.screenCue}
                        key={row.id}
                    >
                        <b>{row.label}</b>
                        <em>{row.count}</em>
                        <span aria-hidden="true" className={styles.chainOpportunityTraitLaneBeatPips}>
                            {Array.from({ length: row.beatCount }, (_, index) => (
                                <i
                                    data-card-trait-lane-beat-pip={index + 1}
                                    data-card-trait-lane-beat-pip-focus={index === 0 ? 'primary' : 'support'}
                                    key={index}
                                />
                            ))}
                        </span>
                        <i>
                            {row.beatCount}-beat {row.action}
                        </i>
                    </span>
                ))}
            </span>
        ) : null}
        {meter ? (
            <span
                aria-label={meter.accessibleLabel}
                className={styles.chainOpportunityMeter}
                data-chain-meter-fill={meter.fill}
                data-chain-meter-tone={meter.tone}
                data-testid="chain-opportunity-meter"
                style={{ '--chain-meter-fill': `${meter.fill}%` } as CSSProperties}
            >
                {meter.lanes.map((lane) => (
                    <span
                        data-chain-meter-lane={lane.id}
                        data-chain-meter-lane-action={lane.action}
                        data-chain-meter-lane-tone={lane.tone}
                        key={lane.id}
                    >
                        <small>{lane.label}</small>
                        <b>{lane.count}</b>
                        <span aria-hidden="true" className={styles.chainOpportunityMeterPips}>
                            {Array.from({ length: lane.pipCount }, (_, index) => (
                                <i
                                    data-chain-meter-pip={index + 1}
                                    data-chain-meter-pip-action={lane.action}
                                    data-chain-meter-pip-focus={index === 0 ? 'primary' : 'support'}
                                    data-chain-meter-pip-tone={lane.tone}
                                    key={`${lane.id}-${index}`}
                                />
                            ))}
                        </span>
                    </span>
                ))}
                <span className={styles.chainOpportunityNextRoute} data-chain-meter-route-tone={meter.tone}>
                    <small>{meter.tone === 'setup' ? 'Prime' : 'Next'}</small>
                    <b>{meter.nextRouteLabel}</b>
                    <span aria-hidden="true" className={styles.chainOpportunityNextRoutePips}>
                        {Array.from({ length: meter.nextRouteBeatCount }, (_, index) => (
                            <i
                                data-chain-next-route-pip={index + 1}
                                data-chain-next-route-pip-focus={index === 0 ? 'primary' : 'support'}
                                data-chain-next-route-pip-tone={meter.tone}
                                key={`route-${index}`}
                            />
                        ))}
                    </span>
                    {meter.secondaryRouteLabel ? <em>{meter.secondaryRouteLabel}</em> : null}
                </span>
                <i aria-hidden="true" className={styles.chainOpportunityMeterFill} />
            </span>
        ) : null}
        <TileBoardChainOpportunityRewardLadder {...rewardLadder} />
        <TileBoardChainOpportunityProgressionCues {...progressionCues} />
        <TileBoardChainOpportunityStatusMeters {...statusMeters} />
    </div>
    );
};

export default TileBoardChainOpportunityChip;
