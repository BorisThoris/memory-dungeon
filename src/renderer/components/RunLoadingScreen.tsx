import type { CSSProperties } from 'react';
import type { RunState } from '../../shared/contracts';
import { modeTitle } from './inventoryScreenModel';
import styles from './RunLoadingScreen.module.css';

interface RunLoadingScreenProps {
    /** Null before a run exists; the screen then falls back to generic descent copy. */
    run?: RunState | null;
}

const DEALT_CARD_COUNT = 5;

/**
 * Shown between Choose Your Path and the board while the lazy gameplay chunk resolves.
 *
 * This used to be a bare `<div role="status">Loading run...</div>` — unstyled text in the top-left
 * corner of an empty screen, which read as a broken page rather than a transition. It has `run` in
 * scope, so it names the run the player just chose and the floor they are dropping into instead of
 * saying "loading".
 */
export const RunLoadingScreen = ({ run }: RunLoadingScreenProps) => {
    const floor = run?.board?.level ?? 1;
    // No run, or a run without a mode, both mean there is no name to show — say what is happening
    // instead. Defaulting to a mode id would print that id when the catalog has no title for it.
    const label = run?.gameMode ? modeTitle(run.gameMode) : 'Descending';

    return (
        <div aria-live="polite" className={styles.screen} data-testid="run-loading-screen" role="status">
            <div className={styles.panel}>
                <p className={styles.eyebrow}>{label}</p>
                <p className={styles.floor}>Floor {floor}</p>

                <div aria-hidden="true" className={styles.deck}>
                    {Array.from({ length: DEALT_CARD_COUNT }, (_unused, index) => (
                        <span className={styles.card} key={index} style={{ '--deal-i': index } as CSSProperties} />
                    ))}
                </div>

                <div aria-hidden="true" className={styles.rail} />
                {/* The only part a screen reader needs; everything above is the same fact, drawn. */}
                <p className={styles.status}>Dealing the board…</p>
            </div>
        </div>
    );
};

export default RunLoadingScreen;
