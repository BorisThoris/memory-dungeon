import { describe, expect, it } from 'vitest';
import { BOSS_FLOOR_SCORE_MULTIPLIER, type BoardState } from './contracts';
import { createNewRun } from './game';
import {
    applyFloorClearEnemyHazardDefeats,
    calculateFloorClearScore,
    createFloorClearLevelResult,
    getFloorClearStatLevelResultFields,
    getClearLifeReason
} from './level-clear-rules';

describe('level-clear-rules', () => {
    it('classifies clear-life rewards from level tries', () => {
        expect(getClearLifeReason(0)).toBe('perfect');
        expect(getClearLifeReason(1)).toBe('clean');
        expect(getClearLifeReason(2)).toBe('none');
        expect(getClearLifeReason(9)).toBe('none');
    });



    it('closes the open flips on a floor clear and leaves the run alone', () => {
        const run = createNewRun(0);
        const board: BoardState = {
            ...run.board!,
            flippedTileIds: ['tile-a']
        };

        const result = applyFloorClearEnemyHazardDefeats(run, board);

        expect(result.run).toBe(run);
        expect(result.board.flippedTileIds).toEqual([]);
        expect(result.board.tiles).toBe(board.tiles);
    });

    it('maps positive floor counters into optional level-result fields', () => {
        const run = {
            ...createNewRun(0),
            hazardTileTriggersThisFloor: 2,
            hazardShuffleSnaresThisFloor: 0,
            mimicCacheClaimsThisFloor: 1,
            recallMistakesThisFloor: 3,
            safeHazardWardsUsedThisFloor: 0
        };

        expect(getFloorClearStatLevelResultFields(run)).toMatchObject({
            hazardTileTriggers: 2,
            hazardShuffleSnares: undefined,
            mimicCacheClaims: 1,
            recallMistakes: 3,
            safeHazardWardsUsed: undefined
        });
    });

    it('calculates normal floor clear score from clear bonuses and floor counters', () => {
        const result = calculateFloorClearScore({
            bossTrophyCacheScore: 0,
            currentLevelScore: 120,
            featuredObjectiveStreakBonus: 12,
            floorTag: 'normal',
            level: 3,
            objectiveBonus: 40,
            perfect: true
        });

        expect(result.levelBonus).toBeGreaterThan(0);
        expect(result.perfectBonus).toBeGreaterThan(0);
        expect(result.preBossSubtotal).toBe(
            120 + result.levelBonus + result.perfectBonus + 40 + 12
        );
        expect(result.scoreGained).toBe(result.preBossSubtotal);
    });

    it('normalizes malformed floor clear score inputs before subtotaling', () => {
        const result = calculateFloorClearScore({
            bossTrophyCacheScore: Number.POSITIVE_INFINITY,
            currentLevelScore: Number.NaN,
            featuredObjectiveStreakBonus: 3.8,
            floorTag: 'normal',
            level: 3,
            objectiveBonus: -12,
            perfect: false
        });

        expect(result.preBossSubtotal).toBe(result.levelBonus + 3);
        expect(result.scoreGained).toBe(result.preBossSubtotal);
    });

    it('applies the boss floor score multiplier after boss trophy cache score', () => {
        const result = calculateFloorClearScore({
            bossTrophyCacheScore: 90,
            currentLevelScore: 150,
            featuredObjectiveStreakBonus: 0,
            floorTag: 'boss',
            level: 10,
            objectiveBonus: 30,
            perfect: false
        });

        expect(result.perfectBonus).toBe(0);
        expect(result.preBossSubtotal).toBe(150 + result.levelBonus + 30 + 90);
        expect(result.scoreGained).toBe(
            Math.floor(result.preBossSubtotal * BOSS_FLOOR_SCORE_MULTIPLIER)
        );
    });

    it('creates floor clear level results with deduped tags and positive optional counters', () => {
        const run = {
            ...createNewRun(0),
            hazardTileTriggersThisFloor: 2,
            recallMatchesThisFloor: 1
        };

        const result = createFloorClearLevelResult({
            bossTrophyCacheOutcome: 'claimed',
            bossTrophyCacheScore: 90,
            bonusTags: ['boss_floor', 'boss_floor', 'boss_trophy_cache'],
            clearLifeGained: 1,
            clearLifeReason: 'perfect',
            featuredObjectiveCompleted: true,
            featuredObjectiveId: 'flip_par',
            featuredObjectiveStreak: 3,
            featuredObjectiveStreakBonus: 12,
            level: 7,
            livesRemaining: 4,
            mistakes: 0,
            momentumBonus: { momentum: 0, tier: 'none' as const, shards: 0 },
            objectiveBonusScore: 40,
            perfect: true,
            rating: 'S',
            routeChoices: [{ id: 'route-a', routeType: 'safe', label: 'Safe', detail: 'Safe route.' }],
            run,
            scoreGained: 250
        });

        expect(result).toMatchObject({
            level: 7,
            scoreGained: 250,
            rating: 'S',
            livesRemaining: 4,
            perfect: true,
            mistakes: 0,
            clearLifeReason: 'perfect',
            clearLifeGained: 1,
            bonusTags: ['boss_floor', 'boss_trophy_cache'],
            objectiveBonusScore: 40,
            featuredObjectiveId: 'flip_par',
            featuredObjectiveCompleted: true,
            featuredObjectiveStreak: 3,
            featuredObjectiveStreakBonus: 12,
            bossTrophyCacheOutcome: 'claimed',
            bossTrophyCacheScore: 90,
            hazardTileTriggers: 2,
            recallMatches: 1
        });
        expect(result.routeChoices).toHaveLength(1);
    });

    it('omits featured objective fields and zero optional rewards when absent', () => {
        const run = createNewRun(0);

        const result = createFloorClearLevelResult({
            bossTrophyCacheOutcome: undefined,
            bossTrophyCacheScore: 0,
            bonusTags: [],
            clearLifeGained: 0,
            clearLifeReason: 'none',
            featuredObjectiveCompleted: false,
            featuredObjectiveId: null,
            featuredObjectiveStreak: 0,
            featuredObjectiveStreakBonus: 0,
            level: 2,
            livesRemaining: 3,
            mistakes: 2,
            momentumBonus: { momentum: 0, tier: 'none' as const, shards: 0 },
            objectiveBonusScore: 0,
            perfect: false,
            rating: 'C',
            routeChoices: undefined,
            run,
            scoreGained: 100
        });

        expect(result.bonusTags).toBeUndefined();
        expect(result.objectiveBonusScore).toBeUndefined();
        expect(result.featuredObjectiveId).toBeUndefined();
        expect(result.featuredObjectiveCompleted).toBeUndefined();
        expect(result.featuredObjectiveStreak).toBeUndefined();
        expect(result.featuredObjectiveStreakBonus).toBeUndefined();
        expect(result.bossTrophyCacheScore).toBeUndefined();
    });
});
