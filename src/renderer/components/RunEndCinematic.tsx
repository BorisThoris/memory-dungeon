import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { RunEndReason, RunSummary } from '../../shared/contracts';
import { comboHeatThemeForSeed } from '../../shared/combo-heat-rules';
import { RUN_END_STAMP_COPY, runEndComboLine, runEndComboReplay, runEndFlourish, runEndScoreLine, runEndVerdict } from '../copy/runEndStamp';
import type { RunEndStampAction } from './RunEndStamp';
import styles from './RunEndCinematic.module.css';

/**
 * The end of a run as a cut-scene, the way the 2000s duel and hunt games did it: the room goes
 * dark, a burst of speed lines, and the verdict word is plastered across the middle of the
 * screen - slammed in oversized, swept with a sheen, held - then it leaves, and in its place
 * the choices come in one at a time as stamped words you can press. A flourish (a record, a hot
 * run) gets its own beat between the two. Nothing else is on the screen until the player
 * chooses; the ledger of numbers is one of the choices.
 *
 * Phases: `verdict` -> (`replay`) -> (`flourish`) -> `choices`. The replay flicks the best combo's
 * stamps through again (`runEndComboReplay`) when it earned any; it names the heat itself, so after
 * it only a new record still gets a flourish. A press or a key during the first two skips
 * to the choices, so nobody waits on a cut-scene twice. Reduced motion opens on the choices
 * with the verdict held small above them.
 */
export type RunEndCinematicPhase = 'verdict' | 'replay' | 'flourish' | 'choices';

export const RUN_END_VERDICT_MS = 2300;
export const RUN_END_FLOURISH_MS = 1400;
/** Each of the best combo's stamps, replayed. */
export const RUN_END_REPLAY_STEP_MS = 300;
/** The replay's last stamp is held this long with the combo's number. */
export const RUN_END_REPLAY_HOLD_MS = 900;

export interface RunEndCinematicProps {
    comparison?: string | null;
    summary: Pick<RunSummary, 'totalScore' | 'highestLevel' | 'bestStreak'>;
    reason: RunEndReason | null | undefined;
    runSeed: number;
    personalBest: 'beaten' | 'matched' | null;
    actions: readonly RunEndStampAction[];
    reduceMotion: boolean;
    /** Each replayed stamp as it lands, with its stage (cold 0 through legendary 5): where its sting plays. */
    onReplayStamp?: (stage: number) => void;
}

export function RunEndCinematic({ summary, reason, runSeed, personalBest, actions, reduceMotion, comparison, onReplayStamp }: RunEndCinematicProps) {
    const temper = comboHeatThemeForSeed(runSeed);
    const verdict = runEndVerdict(reason);
    const replay = runEndComboReplay(summary.bestStreak, temper);
    const heatFlourish = runEndFlourish(summary, personalBest);
    const flourish = replay.length > 0 && heatFlourish?.tone !== 'gold' ? null : heatFlourish;
    const [phase, setPhase] = useState<RunEndCinematicPhase>(reduceMotion ? 'choices' : 'verdict');
    const [replayStep, setReplayStep] = useState(0);
    useEffect(() => {
        if (phase === 'choices') return undefined;
        if (phase === 'replay' && replayStep < replay.length - 1) {
            const step = window.setTimeout(() => setReplayStep((index) => index + 1), RUN_END_REPLAY_STEP_MS);
            return () => window.clearTimeout(step);
        }
        const afterReplay: RunEndCinematicPhase = flourish ? 'flourish' : 'choices';
        const next: RunEndCinematicPhase = phase === 'verdict' ? (replay.length > 0 ? 'replay' : afterReplay) : phase === 'replay' ? afterReplay : 'choices';
        const wait = phase === 'verdict' ? RUN_END_VERDICT_MS : phase === 'replay' ? RUN_END_REPLAY_HOLD_MS : RUN_END_FLOURISH_MS;
        const timer = window.setTimeout(() => setPhase(next), wait);
        return () => window.clearTimeout(timer);
    }, [phase, flourish, replay.length, replayStep]);
    const replayStamp = replay[Math.min(replayStep, replay.length - 1)];
    const replayStage = phase === 'replay' ? replayStamp?.stage ?? null : null;
    useEffect(() => {
        if (replayStage !== null) onReplayStamp?.(replayStage);
    }, [replayStep, replayStage]); // eslint-disable-line react-hooks/exhaustive-deps -- one sting per stamp, not per new callback identity
    const skip = useCallback(() => setPhase('choices'), []);
    useEffect(() => {
        if (phase === 'choices') return undefined;
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') return;
            skip();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phase, skip]);
    const tone = reason === 'miss_budget' ? 'miss' : reason === 'quit' || reason == null ? 'paper' : 'gold';
    return (
        <div
            className={styles.cinematic}
            data-phase={phase}
            data-reduce-motion={reduceMotion ? 'true' : 'false'}
            data-temper={temper.id}
            data-testid="run-end-cinematic"
            data-tone={tone}
            onPointerDown={phase === 'choices' ? undefined : skip}
            style={{ '--temper': temper.colors[3], '--temper-hot': temper.colors[5] } as CSSProperties}
        >
            <span aria-hidden="true" className={styles.burst} />
            <span aria-hidden="true" className={styles.flash} />
            <span className={styles.kicker}>{RUN_END_STAMP_COPY.kicker}</span>
            {phase === 'choices' ? (
                <>
                    {/* The verdict, held small above the choices once it has had its moment. */}
                    <div className={styles.held} data-testid="run-end-cinematic-held">
                        <h1 className={styles.heldVerdict}>{verdict}</h1>
                        <span className={styles.heldLine}>{runEndScoreLine(summary.totalScore, summary.highestLevel)}</span>
                        {comparison ? <p className={styles.comparison} data-testid="rematch-comparison">{comparison}</p> : null}
                    </div>
                    <div className={styles.choices} data-testid="run-end-cinematic-choices" role="group" aria-label="What next">
                        {actions.map((action, index) => (
                            <button
                                aria-label={action.ariaLabel}
                                className={styles.choice}
                                data-action={action.id}
                                data-testid={action.testId ?? `run-end-cinematic-${action.id}`}
                                key={action.id}
                                onClick={action.onClick}
                                style={{ '--i': index } as CSSProperties}
                                type="button"
                            >
                                <span className={styles.stampText} data-text={action.label}>
                                    {action.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            ) : phase === 'replay' && replayStamp ? (
                <div className={styles.replay} data-testid="run-end-cinematic-replay">
                    <span className={styles.replayKicker}>{runEndComboLine(summary.bestStreak)}</span>
                    <h1
                        className={styles.verdict}
                        data-replay-step={replayStep}
                        key={`replay:${replayStep}`}
                        style={{ '--replay-color': temper.colors[replayStamp.stage] } as CSSProperties}
                    >
                        <span className={styles.stampText} data-text={replayStamp.text}>
                            {replayStamp.text}
                        </span>
                    </h1>
                    <ol aria-hidden="true" className={styles.replayTrail}>
                        {replay.slice(0, replayStep + 1).map((stamp, index) => (
                            <li key={index} style={{ '--replay-color': temper.colors[stamp.stage] } as CSSProperties} />
                        ))}
                    </ol>
                </div>
            ) : phase === 'flourish' && flourish ? (
                <h1 className={styles.verdict} data-flourish-tone={flourish.tone} data-testid="run-end-cinematic-flourish" key="flourish">
                    <span className={styles.stampText} data-text={flourish.text}>
                        {flourish.text}
                    </span>
                </h1>
            ) : (
                <>
                    <h1 className={styles.verdict} data-testid="run-end-cinematic-verdict" key="verdict">
                        <span className={styles.stampText} data-text={verdict}>
                            {verdict}
                        </span>
                    </h1>
                    <p className={styles.line}>
                        <span className={styles.scoreLine}>{runEndScoreLine(summary.totalScore, summary.highestLevel)}</span>
                    </p>
                    <span className={styles.skipHint}>{RUN_END_STAMP_COPY.skipHint}</span>
                </>
            )}
        </div>
    );
}
