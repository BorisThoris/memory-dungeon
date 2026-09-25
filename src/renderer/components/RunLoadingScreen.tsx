import { useEffect, useState, type CSSProperties } from 'react';
import { subscribeRunAssetProgress, type RunAssetProgress } from '../assets/preloadRunAssets';
import type { GraphicsQualityPreset, RunState } from '../../shared/contracts';
import { GameplayScene } from './GameplayScene';
import { modeTitle } from './inventoryScreenModel';
import styles from './RunLoadingScreen.module.css';

interface RunLoadingScreenProps {
    /** Null before a run exists; the screen then falls back to generic descent copy. */
    run?: RunState | null;
    quality?: GraphicsQualityPreset;
    reduceMotion?: boolean;
}

const DEALT_CARD_COUNT = 5;

/**
 * Shown between Choose Your Path and the board while the lazy gameplay chunk resolves.
 *
 * This used to be a bare `<div role="status">Loading run...</div>` — unstyled text in the top-left
 * corner of an empty screen, which read as a broken page rather than a transition. It has `run` in
 * scope, so it names the run the player just chose and the floor they are dropping into instead of
 * saying "loading".
 *
 * The room the player is dropping into is already behind it (`GameplayScene`, sunk deeper than the
 * board sinks it and with the chain at rest), so the descent does not cut to a blank page and back:
 * the torches are already burning when the board arrives over them.
 */
export const RunLoadingScreen = ({ quality = 'medium', reduceMotion = false, run }: RunLoadingScreenProps) => {
    const floor = run?.board?.level ?? 1;
    // No run, or a run without a mode, both mean there is no name to show — say what is happening
    // instead. Defaulting to a mode id would print that id when the catalog has no title for it.
    const label = run?.gameMode ? modeTitle(run.gameMode) : 'Descending';
    // What is still being loaded, if anything: the rail fills with it and the status says which step landed last.
    const [progress, setProgress] = useState<RunAssetProgress | null>(null);
    useEffect(() => subscribeRunAssetProgress(setProgress), []);
    const railFill = progress ? progress.completed / progress.total : 0;

    return (
        <div aria-live="polite" className={styles.screen} data-testid="run-loading-screen" role="status">
            <div aria-hidden="true" className={styles.scene}>
                <GameplayScene
                    fill={0}
                    memorize={false}
                    pulse="none"
                    pulseKey={null}
                    quality={quality}
                    reduceMotion={reduceMotion}
                    tier="none"
                />
            </div>
            <div className={styles.panel}>
                <p className={styles.eyebrow}>{label}</p>
                <p className={styles.floor}>Floor {floor}</p>

                <div aria-hidden="true" className={styles.deck}>
                    {Array.from({ length: DEALT_CARD_COUNT }, (_unused, index) => (
                        <span className={styles.card} key={index} style={{ '--deal-i': index } as CSSProperties} />
                    ))}
                </div>

                <div
                    aria-hidden="true"
                    className={styles.rail}
                    data-progress={progress ? `${progress.completed}/${progress.total}` : undefined}
                    style={{ '--load-fill': railFill } as CSSProperties}
                />
                {/* The only part a screen reader needs; everything above is the same fact, drawn. */}
                <p className={styles.status} data-testid="run-loading-status">
                    {progress && progress.completed < progress.total ? progress.label : 'Dealing the board…'}
                </p>
            </div>
        </div>
    );
};

export default RunLoadingScreen;
