import type { GameplayHudBoardStateStripProps } from './GameplayHudBoardStateStrip';
import GameplayHudBoardStateStrip from './GameplayHudBoardStateStrip';
import type { GameplayHudLiveFeedbackStripProps } from './GameplayHudLiveFeedbackStrip';
import GameplayHudLiveFeedbackStrip from './GameplayHudLiveFeedbackStrip';
import type { GameplayHudObjectiveClusterProps } from './GameplayHudObjectiveCluster';
import GameplayHudObjectiveCluster from './GameplayHudObjectiveCluster';
import styles from './GameScreen.module.css';

export interface GameplayHudSecondaryRailProps {
    boardPairCount: number;
    gauntletRemainingMs: number | null;
    matchedPairCount: number;
    pairProgressTitle: string;
    boardStateStripProps: GameplayHudBoardStateStripProps;
    liveFeedbackStripProps: GameplayHudLiveFeedbackStripProps;
    objectiveClusterProps: GameplayHudObjectiveClusterProps;
}

const GameplayHudSecondaryRail = ({
    boardPairCount,
    gauntletRemainingMs,
    matchedPairCount,
    pairProgressTitle,
    boardStateStripProps,
    liveFeedbackStripProps,
    objectiveClusterProps
}: GameplayHudSecondaryRailProps) => (
    <div className={styles.statRail} data-hud-priority="secondary">
        <div className={styles.statPillCompact} data-testid="hud-pair-progress" title={pairProgressTitle}>
            <span className={styles.statKey}>Pairs</span>
            <span className={styles.statVal}>
                {matchedPairCount}/{boardPairCount}
            </span>
            <span className={styles.statSubline}>
                {Math.max(0, boardPairCount - matchedPairCount)} pair
                {Math.max(0, boardPairCount - matchedPairCount) === 1 ? '' : 's'} remain
            </span>
        </div>
        {gauntletRemainingMs !== null ? (
            <div className={styles.statPillCompact} title="Gauntlet time left">
                <span className={styles.statKey}>Time</span>
                <span className={styles.statVal}>{Math.ceil(gauntletRemainingMs / 1000)}s</span>
            </div>
        ) : null}
        <GameplayHudObjectiveCluster {...objectiveClusterProps} />
        <GameplayHudBoardStateStrip {...boardStateStripProps} />
        <GameplayHudLiveFeedbackStrip {...liveFeedbackStripProps} />
    </div>
);

export default GameplayHudSecondaryRail;
