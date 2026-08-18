import { type CSSProperties } from 'react';
import { type RewardPerkReadinessRow } from '../../shared/bonus-rewards';
import { type HudRewardPerkFeedbackModel } from './gameplayHudRewardPerkFeedbackModel';
import styles from './GameScreen.module.css';

export interface GameplayHudRewardPerkStripProps {
    ariaLabel: string;
    feedbackModel: HudRewardPerkFeedbackModel;
    rows: readonly RewardPerkReadinessRow[];
    title: string;
}

const sentenceWithPeriod = (text: string): string =>
    /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;

const meterFillStyle = (percent: number): CSSProperties =>
    ({
        '--reward-perk-meter-fill': `${Math.max(0, Math.min(100, percent))}%`
    }) as CSSProperties;

const hudMeterStyle = (percent: number): CSSProperties =>
    ({
        '--hud-meter-fill': `${Math.max(0, Math.min(100, percent))}%`
    }) as CSSProperties;

const GameplayHudRewardPerkStrip = ({
    ariaLabel,
    feedbackModel,
    rows,
    title
}: GameplayHudRewardPerkStripProps) => {
    const { beatCue, focus, laneActionMapAttr, laneMapAttr, laneMapLabel, laneRoleIdMapAttr, laneRoleMapAttr, laneRows, meterFill, primaryLane } =
        feedbackModel;

    return (
        <div
            aria-label={ariaLabel}
            className={`${styles.statPillCompact} ${styles.hudRewardPerkStrip}`}
            data-reward-perk-beat-count={beatCue?.beatCount ?? 'none'}
            data-reward-perk-beat-cue={beatCue?.label ?? 'none'}
            data-reward-perk-beat-audio={beatCue?.audioCue ?? 'perk-silent'}
            data-reward-perk-beat-screen-cue={beatCue?.screenCue ?? 'none'}
            data-reward-perk-beat-tier={beatCue?.tier ?? 'none'}
            data-reward-perk-focus-action={focus?.action ?? 'none'}
            data-reward-perk-focus-id={focus?.row.id ?? 'none'}
            data-reward-perk-focus-lane={focus?.row.lane ?? 'none'}
            data-reward-perk-focus-payoff={focus?.row.payoff ?? 'none'}
            data-reward-perk-focus-readiness={focus?.tone ?? 'none'}
            data-reward-perk-lane-actions={laneActionMapAttr}
            data-reward-perk-lane-map={laneMapAttr}
            data-reward-perk-lane-roles={laneRoleMapAttr}
            data-reward-perk-lane-role-ids={laneRoleIdMapAttr}
            data-reward-perk-meter-fill={meterFill}
            data-testid="hud-reward-perk-strip"
            title={title}
        >
            <span className={styles.statKey}>Perks</span>
            <span className={styles.statVal}>{rows.length}</span>
            <span className={styles.statSubline}>{rows[0]?.lane}</span>
            <span
                aria-hidden="true"
                className={styles.hudRewardPerkMeter}
                data-reward-perk-meter-fill={meterFill}
            >
                <i className={styles.hudRewardPerkMeterFill} style={meterFillStyle(meterFill)} />
            </span>
            {focus ? (
                <span
                    aria-label={`Primary perk payoff. ${focus.action}: ${focus.row.lane}. ${focus.row.payoff}. ${focus.row.readinessLabel}. ${sentenceWithPeriod(focus.row.nextCue)}`}
                    className={styles.hudRewardPerkPrimaryCue}
                    data-reward-perk-primary-action={focus.action}
                    data-reward-perk-primary-audio={beatCue?.audioCue ?? 'perk-silent'}
                    data-reward-perk-primary-beats={beatCue?.beatCount ?? 0}
                    data-reward-perk-primary-lane={focus.row.lane}
                    data-reward-perk-primary-payoff={focus.row.payoff}
                    data-reward-perk-primary-screen-cue={beatCue?.screenCue ?? 'none'}
                    data-reward-perk-primary-tone={focus.tone}
                    data-testid="hud-reward-perk-primary-cue"
                >
                    <small>Next perk</small>
                    <strong>{focus.action}</strong>
                    <em>{focus.row.payoff}</em>
                    <b>{focus.row.lane}</b>
                    {beatCue ? (
                        <span aria-hidden="true" className={styles.hudRewardPerkPrimaryBeatPips}>
                            {Array.from({ length: beatCue.beatCount }, (_, beatIndex) => (
                                <i
                                    data-reward-perk-primary-beat={beatIndex + 1}
                                    data-reward-perk-primary-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    key={beatIndex}
                                />
                            ))}
                        </span>
                    ) : null}
                </span>
            ) : null}
            {focus ? (
                <span
                    aria-label={`Focused perk payoff. ${focus.action}: ${focus.row.arcadeCue}. ${focus.row.readinessLabel}. ${focus.row.nextCue}`}
                    className={styles.hudRewardPerkFocus}
                    data-reward-perk-focus-action={focus.action}
                    data-reward-perk-focus-audio={beatCue?.audioCue ?? 'perk-silent'}
                    data-reward-perk-focus-screen-cue={beatCue?.screenCue ?? 'none'}
                    data-reward-perk-focus-tone={focus.tone}
                    data-testid="hud-reward-perk-focus"
                >
                    <small>{focus.action}</small>
                    <strong>{focus.row.arcadeCue}</strong>
                    <em>{focus.row.readinessLabel}</em>
                    <b>{focus.row.nextCue}</b>
                    {beatCue ? (
                        <span
                            aria-label={`Reward perk beat. ${beatCue.label}. ${beatCue.beatCount} beats. ${beatCue.action}: ${focus.row.readinessDetail}`}
                            className={styles.hudRewardPerkBeat}
                            data-reward-perk-beat-action={beatCue.action}
                            data-reward-perk-beat-audio={beatCue.audioCue}
                            data-reward-perk-beat-screen-cue={beatCue.screenCue}
                            data-reward-perk-beat-tier={beatCue.tier}
                            data-testid="hud-reward-perk-beat"
                        >
                            <small>{beatCue.label}</small>
                            <span aria-hidden="true" className={styles.hudRewardPerkBeatPips}>
                                {Array.from({ length: beatCue.beatCount }, (_, beatIndex) => (
                                    <i key={beatIndex} />
                                ))}
                            </span>
                        </span>
                    ) : null}
                </span>
            ) : null}
            {laneRows.length > 1 ? (
                <span
                    aria-label={laneMapLabel}
                    className={styles.hudRewardPerkLaneMap}
                    data-reward-perk-lane-actions={laneActionMapAttr}
                    data-reward-perk-lane-map={laneMapAttr}
                    data-reward-perk-lane-roles={laneRoleMapAttr}
                    data-reward-perk-lane-role-ids={laneRoleIdMapAttr}
                    data-testid="hud-reward-perk-lane-map"
                >
                    <span
                        aria-label={`Reward perk lane summary. ${laneRows.length} ${laneRows.length === 1 ? 'lane' : 'lanes'}.`}
                        className={styles.hudRewardPerkLaneMapSummary}
                        data-reward-perk-lane-count={laneRows.length}
                        data-reward-perk-lane-summary-primary={primaryLane?.lane ?? 'none'}
                        data-reward-perk-lane-summary-primary-action={primaryLane?.action ?? 'none'}
                        data-reward-perk-lane-summary-primary-audio={primaryLane?.audioCue ?? 'none'}
                        data-reward-perk-lane-summary-primary-readiness={primaryLane?.readiness ?? 'none'}
                        data-reward-perk-lane-summary-primary-role-id={primaryLane?.roleId ?? 'none'}
                        data-reward-perk-lane-summary-primary-screen-cue={primaryLane?.screenCue ?? 'none'}
                        data-testid="hud-reward-perk-lane-map-summary"
                    >
                        <small>Lanes</small>
                        <b>
                            {laneRows.length} {laneRows.length === 1 ? 'lane' : 'lanes'}
                        </b>
                        <span aria-hidden="true" className={styles.hudRewardPerkLaneMapSummaryBeatPips}>
                            {Array.from({ length: Math.max(2, Math.min(5, laneRows.length + 1)) }, (_, beatIndex) => (
                                <i
                                    data-reward-perk-lane-map-summary-beat={beatIndex + 1}
                                    data-reward-perk-lane-map-summary-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    data-reward-perk-lane-map-summary-beat-readiness={primaryLane?.readiness ?? 'none'}
                                    data-reward-perk-lane-map-summary-beat-role-id={primaryLane?.roleId ?? 'none'}
                                    data-reward-perk-lane-map-summary-beat-screen-cue={primaryLane?.screenCue ?? 'none'}
                                    key={beatIndex}
                                />
                            ))}
                        </span>
                    </span>
                    {laneRows.map((lane) => (
                        <span
                            aria-label={lane.ariaLabel}
                            data-reward-perk-lane-action={lane.action}
                            data-reward-perk-lane-count={lane.count}
                            data-reward-perk-lane-cue-id={lane.cue.id}
                            data-reward-perk-lane-kind={lane.lane}
                            data-reward-perk-lane-readiness={lane.readiness}
                            data-reward-perk-lane-role={lane.role}
                            data-reward-perk-lane-role-id={lane.roleId}
                            key={lane.lane}
                        >
                            <small>{lane.lane}</small>
                            <strong aria-hidden="true">{lane.cue.glyph}</strong>
                            <b>
                                {lane.role} В· {lane.action}
                            </b>
                            <em>
                                {lane.cue.label} cue В· x{lane.count} / {lane.nextCue}
                            </em>
                        </span>
                    ))}
                </span>
            ) : null}
            <span className={styles.hudRewardPerkRows}>
                {rows.map((row) => (
                    <span
                        data-reward-perk-lane={row.lane}
                        data-reward-perk-readiness={row.readiness}
                        key={row.id}
                        title={row.readinessDetail}
                    >
                        <small>{row.arcadeCue}</small>
                        <small data-reward-perk-signal="readiness">{row.readinessLabel}</small>
                        <i>{row.lane}</i>
                        <strong>{row.payoff}</strong>
                        <em>{row.moment}</em>
                        <span
                            aria-hidden="true"
                            className={styles.hudRewardPerkMeter}
                            data-reward-perk-meter={row.readiness}
                        >
                            <span style={hudMeterStyle(row.meterPercent)} />
                        </span>
                        <b>{row.nextCue}</b>
                    </span>
                ))}
            </span>
        </div>
    );
};

export default GameplayHudRewardPerkStrip;
