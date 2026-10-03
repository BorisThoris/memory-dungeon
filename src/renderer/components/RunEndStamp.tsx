import type { CSSProperties, ReactNode } from 'react';
import type { RunEndReason, RunSummary } from '../../shared/contracts';
import { comboHeatThemeForSeed } from '../../shared/combo-heat-rules';
import { runEndFlourish, runEndScoreLine, runEndVerdict } from '../copy/runEndStamp';
import styles from './RunEndStamp.module.css';

/** The stable run record: one verdict, score, optional achievement and action group. */
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
    personalBest: 'beaten' | 'matched' | null;
    actions: readonly RunEndStampAction[];
    reduceMotion: boolean;
    /** The mode eyebrow, rendered above the kicker. */
    eyebrow?: ReactNode;
    /** The record already carries its personal-best line and run statistics. */
    showFlourish?: boolean;
}

export function RunEndStamp({ summary, reason, runSeed, personalBest, actions, reduceMotion, eyebrow, showFlourish = true }: RunEndStampProps) {
    const temper = comboHeatThemeForSeed(runSeed);
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
            {eyebrow}
            <h1 tabIndex={-1} className={styles.verdict} data-testid="run-end-verdict">
                <span className={styles.stampText} data-text={verdict}>
                    {verdict}
                </span>
            </h1>
            <p className={styles.scoreLine} data-testid="run-end-score-line">
                {runEndScoreLine(summary.totalScore, summary.highestLevel)}
            </p>
            {showFlourish && flourish ? (
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
