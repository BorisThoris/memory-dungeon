import { MAX_LIVES, type RunState } from '../../shared/contracts';
import type { GameplayHudContextState } from './gameplayHudContextState';
import type { GameplayHudPrimaryStatsStripProps } from './GameplayHudPrimaryStatsStrip';
import type { GameplayHudRewardFlowState } from './gameplayHudRewardFlowState';
import type { GameplayHudBoardStateStripProps } from './GameplayHudBoardStateStrip';
import type { GameplayHudLiveFeedbackStripProps } from './GameplayHudLiveFeedbackStrip';
import type { GameplayHudObjectiveClusterProps } from './GameplayHudObjectiveCluster';
import type { GameplayHudSecondaryRailProps } from './GameplayHudSecondaryRail';

const buildLifeTrackLabel = (run: RunState): string =>
    run.lives <= 1
        ? `${run.lives} of ${MAX_LIVES} lives remaining. Critical health; protect the last life.`
        : `${run.lives} of ${MAX_LIVES} lives remaining`;

const buildLifeSegmentTitle = (run: RunState): string =>
    run.lives <= 1
        ? 'Critical health: one more unguarded hit can end the run.'
        : 'Lives carry across floors; clean clears, routes, shops, rests, and shrines can restore them.';

const buildPairProgressTitle = (matchedPairCount: number, pairCount: number): string => {
    const remainingPairCount = Math.max(0, pairCount - matchedPairCount);
    return remainingPairCount === 0
        ? 'All required pairs are clear. The exit or floor clear prompt is ready.'
        : `${remainingPairCount} ${remainingPairCount === 1 ? 'pair remains' : 'pairs remain'} before the floor is clear.`;
};

export const buildGameplayHudPrimaryStatsStripProps = ({
    contextState,
    floorHexFillGradId,
    floorHexStrokeGradId,
    rewardFlowState,
    run
}: {
    contextState: GameplayHudContextState;
    floorHexFillGradId: string;
    floorHexStrokeGradId: string;
    rewardFlowState: GameplayHudRewardFlowState;
    run: RunState;
}): GameplayHudPrimaryStatsStripProps => {
    const board = run.board;
    if (!board) {
        throw new Error('Gameplay HUD primary strip requires an active board.');
    }

    return {
        board,
        bossCounterplayTitle: contextState.bossCounterplayTitle,
        dailyDateStripKey: run.gameMode === 'daily' && run.dailyDateKeyUtc ? run.dailyDateKeyUtc : null,
        encounterIdentity: contextState.encounterIdentity,
        floorHexFillGradId,
        floorHexStrokeGradId,
        floorIdentity: contextState.floorIdentity,
        healthTone: run.lives <= 1 ? 'critical' : run.lives < MAX_LIVES ? 'wounded' : 'safe',
        lifeSegmentTitle: buildLifeSegmentTitle(run),
        lifeTrackLabel: buildLifeTrackLabel(run),
        parasiteFloorProgress: contextState.parasiteFloorProgress,
        resourceSegmentTitle: contextState.resourceSegmentTitle,
        rewardFlowState,
        run,
        scoreParasiteActive: contextState.scoreParasiteActive
    };
};

export const buildGameplayHudSecondaryRailProps = ({
    board,
    boardStateStripProps,
    gauntletRemainingMs,
    liveFeedbackStripProps,
    objectiveClusterProps
}: {
    board: NonNullable<RunState['board']>;
    boardStateStripProps: GameplayHudBoardStateStripProps;
    gauntletRemainingMs: number | null;
    liveFeedbackStripProps: GameplayHudLiveFeedbackStripProps;
    objectiveClusterProps: GameplayHudObjectiveClusterProps;
}): GameplayHudSecondaryRailProps => {
    const matchedPairCount = Math.min(board.pairCount, board.matchedPairs);

    return {
        boardPairCount: board.pairCount,
        boardStateStripProps,
        gauntletRemainingMs,
        liveFeedbackStripProps,
        matchedPairCount,
        objectiveClusterProps,
        pairProgressTitle: buildPairProgressTitle(matchedPairCount, board.pairCount)
    };
};
