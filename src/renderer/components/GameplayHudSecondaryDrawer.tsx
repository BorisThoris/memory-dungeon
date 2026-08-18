import { type RunState } from '../../shared/contracts';
import { type TouchHudDetailRow } from '../../shared/long-run-feedback';
import GameplayHudTraitRouteDetails, { type GameplayHudTraitRouteDetailsProps } from './GameplayHudTraitRouteDetails';
import styles from './GameScreen.module.css';

export interface GameplayHudSecondaryDrawerProps {
    difficultyLabel: string;
    difficultyTitle: string;
    perfectMemoryLocked: boolean;
    perfectMemoryTitle: string;
    perfectMemoryValue: string | null;
    run: RunState;
    touchHudDetailRows: readonly TouchHudDetailRow[];
    traitRouteDetailsProps: GameplayHudTraitRouteDetailsProps | null;
}

const GameplayHudSecondaryDrawer = ({
    difficultyLabel,
    difficultyTitle,
    perfectMemoryLocked,
    perfectMemoryTitle,
    perfectMemoryValue,
    run,
    touchHudDetailRows,
    traitRouteDetailsProps
}: GameplayHudSecondaryDrawerProps) => (
    <details className={styles.hudTertiaryDetails} data-testid="hud-secondary-stat-drawer">
        <summary aria-label="More run context" title="More run context">
            More
        </summary>
        <div className={styles.statRailTertiary} data-hud-priority="tertiary">
            {run.status === 'memorize' || run.status === 'playing' ? (
                <>
                    <div
                        className={styles.statPillCompact}
                        data-testid="hud-shuffle-charges"
                        title={
                            run.activeContract?.noShuffle
                                ? 'Scholar contract: full-board shuffle is locked.'
                                : `Search - Shuffle charges: ${run.shuffleCharges}. Uses a run charge; breaks Scholar-style and some perfect-memory rules when used.`
                        }
                    >
                        <span className={styles.statKey}>Shuffle</span>
                        <span className={styles.statVal}>{run.activeContract?.noShuffle ? 'Off' : run.shuffleCharges}</span>
                        <span className={styles.statSubline}>
                            {run.activeContract?.noShuffle ? 'Locked in Scholar' : 'Reshuffles hidden board order'}
                        </span>
                    </div>
                    <div
                        className={styles.statPillCompact}
                        data-testid="hud-destroy-charges"
                        title={
                            run.activeContract?.noDestroy
                                ? 'Scholar contract: destroy pair is locked.'
                                : `Damage control - Destroy charges: ${run.destroyPairCharges}. Spend to remove a fully hidden pair with no match score - forfeits pickups on that pair. Run rewards can add to the uncapped bank.`
                        }
                    >
                        <span className={styles.statKey}>Destroy</span>
                        <span className={styles.statVal}>{run.activeContract?.noDestroy ? 'Off' : run.destroyPairCharges}</span>
                        <span className={styles.statSubline}>
                            {run.activeContract?.noDestroy ? 'Locked in Scholar' : 'Forfeits pickups on that pair'}
                        </span>
                    </div>
                    <div
                        className={styles.statPillCompact}
                        data-testid="hud-peek-charges"
                        title={`Recall - Peek charges: ${run.peekCharges}. Arm peek in the toolbar, then tap a tile for a brief reveal.`}
                    >
                        <span className={styles.statKey}>Peek</span>
                        <span className={styles.statVal}>{run.peekCharges}</span>
                        <span className={styles.statSubline}>Brief reveal only</span>
                    </div>
                </>
            ) : null}
            {run.activeContract?.noShuffle ? (
                <div className={styles.statPillCompact}>
                    <span className={styles.statKey}>Contract</span>
                    <span className={styles.statVal}>Scholar</span>
                </div>
            ) : null}
            {traitRouteDetailsProps ? <GameplayHudTraitRouteDetails {...traitRouteDetailsProps} /> : null}
            {run.activeContract?.maxPinsTotalRun != null ? (
                <div className={styles.statPillCompact} title="Pin vow contract">
                    <span className={styles.statKey}>Pins</span>
                    <span className={styles.statVal}>
                        {run.pinsPlacedCountThisRun}/{run.activeContract.maxPinsTotalRun}
                    </span>
                </div>
            ) : null}
            {run.gameMode === 'meditation' ? (
                <div className={styles.statPillCompact} title="Meditation run">
                    <span className={styles.statKey}>Mode</span>
                    <span className={styles.statVal}>Meditation</span>
                </div>
            ) : null}
            <div className={styles.statPillCompact} data-testid="hud-difficulty-profile" title={difficultyTitle}>
                <span className={styles.statKey}>Difficulty</span>
                <span className={styles.statVal}>{difficultyLabel}</span>
            </div>
            {run.wildMenuRun ? (
                <div className={styles.statPillCompact} title="Wild joker run">
                    <span className={styles.statKey}>Wild</span>
                    <span className={styles.statVal}>On</span>
                </div>
            ) : null}
            {perfectMemoryValue ? (
                <div
                    className={`${styles.statPillCompact} ${
                        perfectMemoryLocked ? styles.statPillCompactPerfectMemoryLocked : ''
                    }`}
                    data-testid="hud-perfect-memory"
                    title={perfectMemoryTitle}
                >
                    <span className={styles.statKey}>Perfect Memory</span>
                    <span className={styles.statVal}>{perfectMemoryValue}</span>
                </div>
            ) : null}
            <div className={styles.hudTouchDetailRows} data-testid="hud-touch-detail-rows">
                {touchHudDetailRows.map((row) => (
                    <div
                        className={styles.statPillCompact}
                        data-testid={`hud-touch-detail-${row.id}`}
                        key={row.id}
                        title={row.detail}
                    >
                        <span className={styles.statKey}>{row.label}</span>
                        <span className={styles.statVal}>{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    </details>
);

export default GameplayHudSecondaryDrawer;
