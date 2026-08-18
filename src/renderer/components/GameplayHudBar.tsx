import { useId } from 'react';
import { type RunState } from '../../shared/contracts';
import { getFeaturedObjectiveLabel } from '../../shared/floor-mutator-schedule';
import { REG106_HUD_IA } from '../gameplay/regPhase4PlayContract';
import GameplayHudModeContextStrip from './GameplayHudModeContextStrip';
import GameplayHudPrimaryStatsStrip from './GameplayHudPrimaryStatsStrip';
import GameplayHudSecondaryRail from './GameplayHudSecondaryRail';
import GameplayHudSecondaryDrawer from './GameplayHudSecondaryDrawer';
import { buildGameplayHudContextState } from './gameplayHudContextState';
import { buildGameplayHudFeedbackSurfaceState } from './gameplayHudFeedbackSurfaceState';
import { buildGameplayHudRecentActionState } from './gameplayHudRecentActionState';
import {
    buildGameplayHudPrimaryStatsStripProps,
    buildGameplayHudSecondaryRailProps
} from './gameplayHudSurfaceProps';
import styles from './GameScreen.module.css';

export interface GameplayHudBarProps {
    run: RunState;
    cameraViewportMode: boolean;
    /** Precomputed from host clock (`gauntletDeadlineMs - now`), or null when gauntlet is off. */
    gauntletRemainingMs: number | null;
    /** HUD-015: low-frequency status line for screen readers (`aria-live="polite"`). */
    politeHudAnnouncement?: string;
    /** Mirrors the visible board feedback tone in compact HUD context. */
    politeHudAnnouncementPriority?: 'info' | 'error';
    /** Gates brief chain-pill emphasis animation */
    reduceMotion?: boolean;
}

const GameplayHudBar = ({
    run,
    cameraViewportMode,
    gauntletRemainingMs,
    politeHudAnnouncement = '',
    politeHudAnnouncementPriority = 'info',
    reduceMotion = false
}: GameplayHudBarProps) => {
    const floorHexUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const floorHexStrokeGradId = `hud-floor-hex-stroke-${floorHexUid}`;
    const floorHexFillGradId = `hud-floor-hex-fill-${floorHexUid}`;

    const board = run.board;
    if (!board) {
        return null;
    }

    const recentActionState = buildGameplayHudRecentActionState({
        politeHudAnnouncement,
        politeHudAnnouncementPriority
    });
    const featuredObjectiveLabel = getFeaturedObjectiveLabel(board.featuredObjectiveId);
    const contextState = buildGameplayHudContextState({
        featuredObjectiveLabel,
        gauntletRemainingMs,
        run
    });
    const feedbackSurfaceState = buildGameplayHudFeedbackSurfaceState({
        contextState,
        featuredObjectiveLabel,
        politeHudAnnouncement,
        recentActionState,
        reduceMotion,
        run
    });
    const primaryStatsStripProps = buildGameplayHudPrimaryStatsStripProps({
        contextState,
        floorHexFillGradId,
        floorHexStrokeGradId,
        rewardFlowState: feedbackSurfaceState.rewardFlowState,
        run
    });
    const secondaryRailProps = buildGameplayHudSecondaryRailProps({
        board,
        boardStateStripProps: feedbackSurfaceState.boardStateStripProps,
        gauntletRemainingMs,
        liveFeedbackStripProps: feedbackSurfaceState.liveFeedbackStripProps,
        objectiveClusterProps: feedbackSurfaceState.objectiveClusterProps
    });

    /*
     * PLAY-003 (HUD IA): Primary row keeps the reference вЂњslim stripвЂќ read вЂ” floor, lives, shards, hero score,
     * plus identity widgets (daily id, score-parasite) in the top-right grid cell. Mode label, mutator/context
     * chips, and the compact stat rail move to a second slim strip below on wide layouts so they do not set
     * the primary rowвЂ™s height or compete optically with score. Narrow / mobile camera stacks the primary
     * grid first, then this context strip (toolbar flyout was considered and rejected here to avoid hiding
     * live mutator state behind an extra tap).
     */
    return (
        <header
            className={`${styles.hudRow} ${cameraViewportMode ? styles.mobileCameraHud : ''}`}
            data-reg-hud-ia="v1"
            data-reg-hud-primary-lanes={REG106_HUD_IA.primary.join(',')}
            data-testid="game-hud"
        >
            <div className={`${styles.floatingDeck} ${styles.statsDeck} ${styles.hudDeck}`} role="group" aria-label="Run stats">
                <div className={styles.hudDeckDualRow}>
                    <GameplayHudPrimaryStatsStrip {...primaryStatsStripProps} />
                    <details
                        className={`${styles.hudContextSecondaryStrip} ${styles.hudContextRegion}`}
                        data-testid="hud-wing-right"
                        aria-label="Run context"
                    >
                        <summary className={styles.hudContextSummary} title="Run context">
                            Info
                        </summary>
                        <div className={styles.hudStripRightInnerColumn}>
                            <GameplayHudModeContextStrip board={board} contextState={contextState} />
                            <GameplayHudSecondaryRail {...secondaryRailProps} />
                            <GameplayHudSecondaryDrawer {...feedbackSurfaceState.secondaryDrawerProps} />
                        </div>
                    </details>
                </div>
            </div>
            <div
                aria-atomic="true"
                aria-live="polite"
                className={styles.srOnly}
                data-testid="hud-polite-live-region"
                role="status"
            >
                {politeHudAnnouncement}
            </div>
        </header>
    );
};

export default GameplayHudBar;
