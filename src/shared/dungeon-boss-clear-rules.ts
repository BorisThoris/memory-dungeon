import { type BoardState, type RunState } from './contracts';
import { getDungeonObjectiveStatus } from './dungeon-board-status';

export const DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD = 90;

export interface DungeonBossTrophyCacheResult {
    outcome: 'claimed' | 'forfeited' | undefined;
    score: number;
}

export const getDungeonBossTrophyCacheResult = (
    run: RunState,
    board: BoardState
): DungeonBossTrophyCacheResult => {
    if (board.floorTag !== 'boss') {
        return {
            outcome: undefined,
            score: 0
        };
    }

    const objectiveCompleted = getDungeonObjectiveStatus({ ...run, board }).completed;
    const outcome = objectiveCompleted ? 'claimed' : 'forfeited';
    return {
        outcome,
        score: outcome === 'claimed' ? DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD : 0
    };
};
