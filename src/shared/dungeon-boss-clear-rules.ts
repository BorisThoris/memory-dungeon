import { type BoardState, type RunState } from './contracts';
import { getDungeonObjectiveStatus } from './dungeon-board-status';
import { hasRunRelic } from './relics';

export const DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD = 90;
export const CHAPTER_COMPASS_BOSS_TROPHY_SCORE_BONUS = 30;

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
    const chapterCompassBonus =
        outcome === 'claimed' && hasRunRelic(run, 'chapter_compass')
            ? CHAPTER_COMPASS_BOSS_TROPHY_SCORE_BONUS
            : 0;
    return {
        outcome,
        score: outcome === 'claimed' ? DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD + chapterCompassBonus : 0
    };
};
