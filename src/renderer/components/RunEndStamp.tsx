import type { CSSProperties, ReactNode } from 'react';
import type { RunEndReason, RunSummary } from '../../shared/contracts';
import { temperForWorld } from '../../shared/combo-heat-rules';
import type { TileSuit } from '../../shared/contracts';
import { RUN_END_STAMP_COPY, runEndFlourish, runEndScoreLine, runEndVerdict } from '../copy/runEndStamp';
import styles from './RunEndStamp.module.css';

/**
 * The run's end, stamped: the verdict word slams in over the results the way a rank-up does in
 * play, the score line lands under it, a flourish stamp says the one extra thing worth saying,
 * and the choices come in one after another as stamps you can press. The tone is the run's own
 * world's temper (`temperForWorld`), so a run that ended in a bone world ends in frost.
 *
 * The stamps are the page's real heading and buttons, not decoration over them: the h1 is the
 * verdict, the buttons carry the same accessible names as the ledger's did, and reduced motion
 * shows everything at rest.
 */
export interface RunEndStampAction {
    id: 'play-again' | 'rematch' | 'main-menu' | 'record';
    label: string;
    ariaLabel: string;
    testId?: string;
    onClick: () => void;
}

export interface RunEndStampProps {
    summary: Pick<RunSummary, 'totalScore' | 'highestLevel' | 'bestStreak'>;
    reason: RunEndReason | null | undefined;
    runSeed: number;
    /** The world the run ended in. */
    world?: readonly TileSuit[];
    personalBest: 'beaten' | 'matched' | null;
    actions: readonly RunEndStampAction[];
    reduceMotion: boolean;
    /** The mode eyebrow, rendered above the kicker. */
    eyebrow?: ReactNode;
}

export function RunEndStamp({ summary, reason, runSeed, world, personalBest, actions, reduceMotion, eyebrow }: RunEndStampProps) {
    const temper = temperForWorld(world, runSeed);
    const verdict = runEndVerdict(reason);
    const flourish = runEndFlourish(summary, personalBest);
    const tone = reason === 'miss_budget' ? 'miss' : reason === 'quit' || reason == null ? 'paper' : 'gold';
    return (
        <div
            className={styles.stampHero}
            data-reduce-motion={reduceMotion ? 'true' : 'false'}
            data-temper={temper.id}
            data-testid="run-end-stamp"
            data-tone={tone}
            style={{ '--temper': temper.colors[3], '--temper-hot': temper.colors[5] } as CSSProperties}
        >
            <span className={styles.flash} />
            <span className={styles.lines} />
            {eyebrow}
            <span className={styles.kicker}>{RUN_END_STAMP_COPY.kicker}</span>
            <h1 className={styles.verdict} data-testid="run-end-verdict">
                <span className={styles.stampText} data-text={verdict}>
                    {verdict}
                </span>
            </h1>
            <p className={styles.scoreLine} data-testid="run-end-score-line">
                {runEndScoreLine(summary.totalScore, summary.highestLevel)}
            </p>
            {flourish ? (
                <span className={styles.flourish} data-testid="run-end-flourish" data-tone={flourish.tone}>
                    <span className={styles.stampText} data-text={flourish.text}>
                        {flourish.text}
                    </span>
                </span>
            ) : null}
            <div className={styles.actions} role="group" aria-label="What next">
                {actions.map((action, index) => (
                    <button
                        aria-label={action.ariaLabel}
                        className={styles.stampButton}
                        data-action={action.id}
                        data-testid={action.testId ?? `run-end-stamp-${action.id}`}
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
        </div>
    );
}
