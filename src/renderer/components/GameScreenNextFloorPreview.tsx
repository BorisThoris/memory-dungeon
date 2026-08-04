import styles from './GameScreen.module.css';
import type { GameScreenNextFloorProjection } from './gameScreenNextFloorProjection';

export const GameScreenNextFloorPreview = ({
    projection
}: {
    projection: GameScreenNextFloorProjection | null;
}) => {
    if (!projection) return null;

    return (
        <>
            {projection.signals.length > 0 ? (
                <div
                    aria-label={projection.signalsLabel}
                    className={styles.floorClearNextSignalStrip}
                    data-testid="floor-clear-next-signal-strip"
                >
                    {projection.signals.map((signal) => (
                        <span
                            data-next-audio={signal.audioCue}
                            data-next-beats={signal.beatCount}
                            data-next-screen-cue={signal.screenCue}
                            data-next-tone={signal.tone}
                            key={signal.id}
                        >
                            <small>{signal.label}</small>
                            <strong>{signal.value}</strong>
                            <span aria-hidden="true" className={styles.floorClearNextBeatPips}>
                                {Array.from({ length: signal.beatCount }, (_, index) => (
                                    <i
                                        data-next-beat={index + 1}
                                        data-next-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={index}
                                    />
                                ))}
                            </span>
                            {signal.detail ? <em>{signal.detail}</em> : null}
                        </span>
                    ))}
                </div>
            ) : null}
            {projection.clearedNodeCopy ? (
                <p className={styles.modalNote}>{projection.clearedNodeCopy}</p>
            ) : null}
        </>
    );
};
