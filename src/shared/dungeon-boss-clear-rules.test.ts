import { describe, expect, it } from 'vitest';
import { type BoardState } from './contracts';
import { createNewRun } from './game';
import {
    CHAPTER_COMPASS_BOSS_TROPHY_SCORE_BONUS,
    DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD,
    getDungeonBossTrophyCacheResult
} from './dungeon-boss-clear-rules';

describe('getDungeonBossTrophyCacheResult', () => {
    it('has no trophy cache result outside boss floors', () => {
        const run = createNewRun(0);

        expect(getDungeonBossTrophyCacheResult(run, run.board!)).toEqual({
            outcome: undefined,
            score: 0
        });
    });

    it('claims trophy cache score when the boss objective is complete', () => {
        const run = {
            ...createNewRun(0),
            dungeonEnemiesDefeated: 1
        };
        const board: BoardState = {
            ...run.board!,
            floorTag: 'boss',
            dungeonBossId: 'trap_warden',
            dungeonObjectiveId: 'defeat_boss',
            enemyHazards: []
        };

        expect(getDungeonBossTrophyCacheResult(run, board)).toEqual({
            outcome: 'claimed',
            score: DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD
        });
    });

    it('lets Chapter Compass improve claimed boss trophy cache score', () => {
        const run = {
            ...createNewRun(0, { initialRelicIds: ['chapter_compass'] }),
            dungeonEnemiesDefeated: 1
        };
        const board: BoardState = {
            ...run.board!,
            floorTag: 'boss',
            dungeonBossId: 'trap_warden',
            dungeonObjectiveId: 'defeat_boss',
            enemyHazards: []
        };

        expect(getDungeonBossTrophyCacheResult(run, board)).toEqual({
            outcome: 'claimed',
            score: DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD + CHAPTER_COMPASS_BOSS_TROPHY_SCORE_BONUS
        });
        expect(getDungeonBossTrophyCacheResult(run, board, { chapterCompassScoreBonus: 0 })).toEqual({
            outcome: 'claimed',
            score: DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD
        });
    });

    it('forfeits the trophy cache when the boss objective is incomplete', () => {
        const run = createNewRun(0);
        const board: BoardState = {
            ...run.board!,
            floorTag: 'boss',
            dungeonObjectiveId: 'defeat_boss',
            enemyHazards: [{
                id: 'boss',
                kind: 'warden',
                label: 'boss',
                currentTileId: 'a',
                nextTileId: 'b',
                pattern: 'guard',
                state: 'revealed',
                damage: 1,
                hp: 1,
                maxHp: 2,
                bossId: 'trap_warden'
            }]
        };

        expect(getDungeonBossTrophyCacheResult(run, board)).toEqual({
            outcome: 'forfeited',
            score: 0
        });
    });
});
