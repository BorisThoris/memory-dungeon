import styles from './TileBoard.module.css';

type TrapResolutionSignal = 'continue' | 'effect' | 'resolved';
type TrapResolutionScreenCue = 'burst' | 'pulse' | 'snap';

interface TrapResolutionDetails {
    count: number;
    effect: string;
    next: string;
}

interface TileBoardTrapResolutionFeedbackProps {
    details: TrapResolutionDetails | null;
    message: string;
}

const getTrapResolutionSignalBeatCount = (signal: TrapResolutionSignal): 2 | 3 | 4 => {
    if (signal === 'effect') {
        return 4;
    }
    if (signal === 'resolved') {
        return 3;
    }
    return 2;
};

const getTrapResolutionSignalAction = (
    signal: TrapResolutionSignal
): 'Chase next pair' | 'Confirm trap' | 'Resolve effect' => {
    if (signal === 'resolved') {
        return 'Confirm trap';
    }
    if (signal === 'effect') {
        return 'Resolve effect';
    }
    return 'Chase next pair';
};

const getTrapResolutionSignalAudioCue = (
    signal: TrapResolutionSignal
): 'trap-continue' | 'trap-effect' | 'trap-resolved' => {
    if (signal === 'resolved') {
        return 'trap-resolved';
    }
    if (signal === 'effect') {
        return 'trap-effect';
    }
    return 'trap-continue';
};

const getTrapResolutionSignalScreenCue = (signal: TrapResolutionSignal): TrapResolutionScreenCue => {
    if (signal === 'effect') {
        return 'burst';
    }
    if (signal === 'resolved') {
        return 'snap';
    }
    return 'pulse';
};

const SIGNAL_ORDER: readonly TrapResolutionSignal[] = ['resolved', 'effect', 'continue'];

const signalLabel = (signal: TrapResolutionSignal): string => {
    if (signal === 'resolved') {
        return 'Resolved';
    }
    if (signal === 'effect') {
        return 'Effect';
    }
    return 'Next';
};

const signalValue = (details: TrapResolutionDetails, signal: TrapResolutionSignal): string => {
    if (signal === 'resolved') {
        return details.count === 1 ? '1 trap' : `${details.count} traps`;
    }
    if (signal === 'effect') {
        return details.effect;
    }
    return details.next;
};

const TileBoardTrapResolutionFeedback = ({ details, message }: TileBoardTrapResolutionFeedbackProps) => {
    if (!message) {
        return null;
    }

    return (
        <div className={styles.trapResolutionToast} data-testid="trap-resolution-feedback" role="status" aria-live="polite">
            <span className={styles.trapResolutionSigil} aria-hidden="true">
                !
            </span>
            <span className={styles.trapResolutionCopy}>{message}</span>
            {details ? (
                <span
                    aria-label={`Trap resolution signals: ${
                        details.count === 1 ? '1 trap' : `${details.count} traps`
                    } resolved. Effect: ${details.effect}. Next: ${details.next}.`}
                    className={styles.trapResolutionSignals}
                    data-testid="trap-resolution-signals"
                >
                    {SIGNAL_ORDER.map((signal) => {
                        const beatCount = getTrapResolutionSignalBeatCount(signal);
                        const action = getTrapResolutionSignalAction(signal);
                        const audio = getTrapResolutionSignalAudioCue(signal);
                        const screenCue = getTrapResolutionSignalScreenCue(signal);

                        return (
                            <span
                                data-trap-resolution-action={action}
                                data-trap-resolution-audio={audio}
                                data-trap-resolution-beats={beatCount}
                                data-trap-resolution-screen-cue={screenCue}
                                data-trap-resolution-signal={signal}
                                key={signal}
                            >
                                <small>{signalLabel(signal)}</small>
                                <b>{signalValue(details, signal)}</b>
                                <span aria-hidden="true" className={styles.trapResolutionBeatPips}>
                                    {Array.from({ length: beatCount }, (_, index) => (
                                        <i
                                            data-trap-resolution-beat={index + 1}
                                            data-trap-resolution-beat-action={action}
                                            data-trap-resolution-beat-audio={audio}
                                            data-trap-resolution-beat-focus={index === 0 ? 'primary' : 'support'}
                                            data-trap-resolution-beat-screen-cue={screenCue}
                                            data-trap-resolution-beat-signal={signal}
                                            key={`${signal}-${index}`}
                                        />
                                    ))}
                                </span>
                            </span>
                        );
                    })}
                </span>
            ) : null}
        </div>
    );
};

export default TileBoardTrapResolutionFeedback;
