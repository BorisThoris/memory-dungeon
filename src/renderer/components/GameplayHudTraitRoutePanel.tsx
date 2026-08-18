import type { CSSProperties } from 'react';
import type {
    HudTraitInteractionLaneFeedbackModel,
    HudTraitRouteActionCueModel,
    HudTraitRouteStackCueModel
} from './gameplayHudTraitRouteFeedbackModels';
import GameplayHudTraitInteractionLaneMap from './GameplayHudTraitInteractionLaneMap';
import styles from './GameScreen.module.css';

interface GameplayHudTraitRoutePanelProps {
    actionCue: HudTraitRouteActionCueModel | null;
    bestToolLabel: string | null;
    buildLabel: string;
    comboCardCount: number;
    laneFeedbackModel: HudTraitInteractionLaneFeedbackModel;
    meterStyle: CSSProperties | null;
    progressLabel: string;
    stackCue: HudTraitRouteStackCueModel | null;
    title: string;
    toolUrgency: string;
    primaryLine: string;
}

const GameplayHudTraitRoutePanel = ({
    actionCue,
    bestToolLabel,
    buildLabel,
    comboCardCount,
    laneFeedbackModel,
    meterStyle,
    progressLabel,
    stackCue,
    title,
    toolUrgency,
    primaryLine
}: GameplayHudTraitRoutePanelProps) => (
    <div
        className={`${styles.statPillCompact} ${styles.hudTraitRoutePill}`}
        data-testid="hud-trait-route-panel"
        data-trait-chain-stack-cue={stackCue?.label ?? 'none'}
        data-trait-combo-preview-count={comboCardCount}
        data-trait-route-action-audio={actionCue?.audioCue ?? 'trait-route-watch'}
        data-trait-route-action-screen-cue={actionCue?.screenCue ?? 'tick'}
        data-trait-route-urgency={toolUrgency}
        title={title}
    >
        <span className={styles.statKey}>Trait routes</span>
        <span className={styles.statVal}>{progressLabel}</span>
        <span className={styles.statSubline}>{buildLabel}</span>
        <span data-testid="hud-trait-route-combo-count">Visible combo cards: {comboCardCount}</span>
        <small className={styles.hudTraitRoutePrimary}>{primaryLine}</small>
        {laneFeedbackModel.laneRows.length > 0 ? (
            <>
                <span className={styles.hudTraitRouteLaneMapLabel}>Trait lanes</span>
                <GameplayHudTraitInteractionLaneMap
                    feedbackModel={laneFeedbackModel}
                    summaryTestId="hud-trait-route-lane-map-summary"
                    testId="hud-trait-route-lane-map"
                />
            </>
        ) : null}
        {actionCue ? (
            <small
                aria-label={actionCue.ariaLabel}
                className={styles.hudTraitRouteActionCue}
                data-testid="hud-trait-route-action-cue"
                data-trait-route-action={actionCue.actionLabel}
                data-trait-route-action-audio={actionCue.audioCue}
                data-trait-route-action-beats={actionCue.beatCount}
                data-trait-route-action-screen-cue={actionCue.screenCue}
                data-trait-route-urgency={actionCue.urgency}
            >
                <strong>{actionCue.actionLabel}</strong>
                <span>{actionCue.stateLabel}</span>
                <span aria-hidden="true" className={styles.hudTraitRouteBeatPips}>
                    {Array.from({ length: actionCue.beatCount }, (_, beatIndex) => (
                        <i
                            data-trait-route-action-beat={beatIndex + 1}
                            data-trait-route-action-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                            key={beatIndex}
                        />
                    ))}
                </span>
            </small>
        ) : null}
        {stackCue ? (
            <small
                aria-label={stackCue.ariaLabel}
                className={styles.hudTraitRouteStackCue}
                data-testid="hud-trait-route-stack-cue"
                data-trait-chain-stack-action={stackCue.action}
                data-trait-chain-stack-audio={stackCue.audioCue}
                data-trait-chain-stack-beats={stackCue.beatCount}
                data-trait-chain-stack-screen-cue={stackCue.screenCue}
            >
                <span>{stackCue.label}</span>
                <strong>{stackCue.action}</strong>
                <em>{stackCue.value}</em>
                <span aria-hidden="true" className={styles.hudTraitRouteBeatPips}>
                    {Array.from({ length: stackCue.beatCount }, (_, beatIndex) => (
                        <i
                            data-trait-chain-stack-beat={beatIndex + 1}
                            data-trait-chain-stack-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                            key={beatIndex}
                        />
                    ))}
                </span>
            </small>
        ) : null}
        {bestToolLabel ? (
            <small className={styles.hudTraitRouteToolCue} data-testid="hud-trait-route-best-tool">
                {bestToolLabel}
            </small>
        ) : null}
        {meterStyle ? (
            <span
                aria-label={`Trait route meter ${progressLabel.replace('/', ' of ')}`}
                className={styles.hudMomentumMeter}
                data-meter-kind="trait"
                data-testid="hud-trait-route-meter"
                style={meterStyle}
            />
        ) : null}
    </div>
);

export default GameplayHudTraitRoutePanel;
