/* eslint-disable react-refresh/only-export-components -- The route consequence renderer re-exports its pure projection as one public boundary. */
import styles from './GameScreen.module.css';
import type {
    GameScreenActiveRouteProjection,
    GameScreenRouteConsequenceCueProjection,
    GameScreenSelectedRouteProjection
} from './gameScreenRouteConsequenceProjection';

export { getGameScreenRouteConsequenceProjection } from './gameScreenRouteConsequenceProjection';

const CueBeatPips = ({
    attribute,
    beatCount
}: {
    attribute: 'action' | 'impact';
    beatCount: GameScreenRouteConsequenceCueProjection['beatCount'];
}) => (
    <span aria-hidden="true" className={styles.routeSelectedBeatPips}>
        {Array.from({ length: beatCount }, (_, index) => (
            <i
                {...(attribute === 'impact'
                    ? {
                          'data-route-impact-cue-beat': index + 1,
                          'data-route-impact-cue-beat-focus': index === 0 ? 'primary' : 'support'
                      }
                    : {
                          'data-route-action-cue-beat': index + 1,
                          'data-route-action-cue-beat-focus': index === 0 ? 'primary' : 'support'
                      })}
                key={index}
            />
        ))}
    </span>
);

export const GameScreenActiveRouteFeedback = ({
    projection
}: {
    projection: GameScreenActiveRouteProjection | null;
}) => {
    if (!projection) return null;

    return (
        <div className={styles.routeCardBanner} data-testid="route-card-board-banner">
            <strong>{projection.label}</strong>
            <span>{projection.rewardLine}</span>
            <div
                aria-label={projection.signalsLabel}
                className={styles.routeCardBannerSignals}
                data-testid="route-card-board-banner-signals"
            >
                {projection.signals.map((signal) => (
                    <span
                        data-route-card-signal-audio={signal.audioCue}
                        data-route-card-signal-beats={signal.beatCount}
                        data-route-card-signal-screen-cue={signal.screenCue}
                        data-route-card-signal-tone={signal.tone}
                        key={`${signal.label}:${signal.value}`}
                    >
                        <small>{signal.label}</small>
                        <b>{signal.value}</b>
                        <span aria-hidden="true" className={styles.routeCardBannerBeatPips}>
                            {Array.from({ length: signal.beatCount }, (_, index) => (
                                <i
                                    data-route-card-signal-beat={index + 1}
                                    data-route-card-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={index}
                                />
                            ))}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
};

export const GameScreenSelectedRouteFeedback = ({
    projection
}: {
    projection: GameScreenSelectedRouteProjection | null;
}) => {
    if (!projection) return null;

    const { actionCue, impactCue } = projection;
    return (
        <>
            <div
                className={styles.routeSelectedNote}
                data-route-action-cue={actionCue.label}
                data-route-action-cue-audio={actionCue.audioCue}
                data-route-action-cue-beats={actionCue.beatCount}
                data-route-action-cue-screen-cue={actionCue.screenCue}
                data-route-action-cue-tone={actionCue.tone}
                data-route-impact-cue={impactCue.label}
                data-route-impact-cue-audio={impactCue.audioCue}
                data-route-impact-cue-beats={impactCue.beatCount}
                data-route-impact-cue-screen-cue={impactCue.screenCue}
                data-route-impact-cue-tone={impactCue.tone}
                data-route-type={projection.routeType}
                data-testid="route-selected-note"
            >
                <span className={styles.routeSelectedCopy}>{projection.copy}</span>
                <span
                    aria-label={impactCue.ariaLabel}
                    className={styles.routeSelectedImpactCue}
                    data-route-impact-cue-audio={impactCue.audioCue}
                    data-route-impact-cue-beats={impactCue.beatCount}
                    data-route-impact-cue-screen-cue={impactCue.screenCue}
                    data-route-impact-cue-tone={impactCue.tone}
                    data-testid="route-selected-impact-cue"
                >
                    <small>{impactCue.label}</small>
                    <strong>{impactCue.value}</strong>
                    <CueBeatPips attribute="impact" beatCount={impactCue.beatCount} />
                </span>
                <span
                    aria-label={actionCue.ariaLabel}
                    className={styles.routeSelectedActionCue}
                    data-route-action-cue-audio={actionCue.audioCue}
                    data-route-action-cue-beats={actionCue.beatCount}
                    data-route-action-cue-screen-cue={actionCue.screenCue}
                    data-route-action-cue-tone={actionCue.tone}
                    data-testid="route-selected-action-cue"
                >
                    <small>{actionCue.label}</small>
                    <strong>{actionCue.value}</strong>
                    <CueBeatPips attribute="action" beatCount={actionCue.beatCount} />
                    <em>{actionCue.detail}</em>
                </span>
                <span className={styles.routeSelectedSignals}>
                    {projection.signals.map((signal) => (
                        <span
                            data-route-signal={signal.id}
                            data-route-signal-audio={signal.audioCue}
                            data-route-signal-beats={signal.beatCount}
                            data-route-signal-screen-cue={signal.screenCue}
                            key={signal.id}
                        >
                            {signal.label}
                            <span aria-hidden="true" className={styles.routeSelectedSignalBeatPips}>
                                {Array.from({ length: signal.beatCount }, (_, index) => (
                                    <i
                                        data-route-signal-beat={index + 1}
                                        data-route-signal-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={index}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </span>
            </div>
            {projection.armedNodeCopy ? (
                <p className={styles.routeSelectedNote}>{projection.armedNodeCopy}</p>
            ) : null}
        </>
    );
};
