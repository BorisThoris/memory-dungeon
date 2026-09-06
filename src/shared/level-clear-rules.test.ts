import { describe, expect, it } from 'vitest';
import { BOSS_FLOOR_SCORE_MULTIPLIER, type BoardState, type EnemyHazardState } from './contracts';
import { createNewRun } from './game';
import {
    applyFloorClearEnemyHazardDefeats,
    calculateFloorClearScore,
    createFloorClearLevelResult,
    getFloorClearStatLevelResultFields,
    getClearLifeReason
} from './level-clear-rules';

const enemyHazard = (id: string, overrides: Partial<EnemyHazardState> = {}): EnemyHazardState => ({
    id,
    kind: 'sentinel',
    label: id,
    currentTileId: 'tile-a',
    nextTileId: 'tile-b',
    pattern: 'patrol',
    state: 'revealed',
    damage: 1,
    hp: 1,
    maxHp: 1,
    ...overrides
});

describe('level-clear-rules', () => {
    it('classifies clear-life rewards from level tries', () => {
        expect(getClearLifeReason(0)).toBe('perfect');
        expect(getClearLifeReason(1)).toBe('clean');
        expect(getClearLifeReason(2)).toBe('none');
        expect(getClearLifeReason(9)).toBe('none');
    });

    it('defeats active enemy hazards and updates floor-clear counters', () => {
        const run = {
            ...createNewRun(0),
            dungeonEnemiesDefeated: 2,
            dungeonEnemiesDefeatedThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 3
        };
        const board: BoardState = {
            ...run.board!,
            flippedTileIds: ['tile-a'],
            enemyHazards: [
                enemyHazard('normal'),
                enemyHazard('boss', { bossId: 'trap_warden', hp: 2, maxHp: 2 })
            ]
        };

        const result = applyFloorClearEnemyHazardDefeats(run, board);

        expect(result.board.flippedTileIds).toEqual([]);
        expect(result.board.enemyHazards).toEqual([
            expect.objectContaining({ id: 'normal', hp: 0, state: 'defeated' }),
            expect.objectContaining({ id: 'boss', hp: 0, state: 'defeated' })
        ]);
        expect(result.run.dungeonEnemiesDefeated).toBe(3);
        expect(result.run.dungeonEnemiesDefeatedThisFloor).toBe(2);
        expect(result.run.enemyHazardsDefeatedThisFloor).toBe(5);
    });

    it('normalizes malformed enemy hazard counters before floor-clear defeats', () => {
        const run = {
            ...createNewRun(0),
            dungeonEnemiesDefeated: Number.NaN,
            dungeonEnemiesDefeatedThisFloor: 1.9,
            enemyHazardsDefeatedThisFloor: Number.POSITIVE_INFINITY
        };
        const board: BoardState = {
            ...run.board!,
            enemyHazards: [
                enemyHazard('normal'),
                enemyHazard('boss', { bossId: 'trap_warden', hp: 2, maxHp: 2 })
            ]
        };

        const result = applyFloorClearEnemyHazardDefeats(run, board);

        expect(result.run.dungeonEnemiesDefeated).toBe(1);
        expect(result.run.dungeonEnemiesDefeatedThisFloor).toBe(2);
        expect(result.run.enemyHazardsDefeatedThisFloor).toBe(2);
    });

    it('clears flipped ids without cloning run counters when no enemy hazards are active', () => {
        const run = createNewRun(0);
        const board: BoardState = {
            ...run.board!,
            flippedTileIds: ['tile-a'],
            enemyHazards: [enemyHazard('done', { state: 'defeated', hp: 0 })]
        };

        const result = applyFloorClearEnemyHazardDefeats(run, board);

        expect(result.run).toBe(run);
        expect(result.board.flippedTileIds).toEqual([]);
        expect(result.board.enemyHazards).toEqual(board.enemyHazards);
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
            endlessRiskWagerFavorGained: 2,
            endlessRiskWagerOutcome: 'won',
            endlessRiskWagerStreakLost: undefined,
            featuredObjectiveCompleted: true,
            featuredObjectiveId: 'flip_par',
            featuredObjectiveStreak: 3,
            featuredObjectiveStreakBonus: 12,
            level: 7,
            livesRemaining: 4,
            mistakes: 0,
            momentumBonus: { momentum: 0, tier: 'none' as const, shards: 0, gold: 0 },
            objectiveBonusScore: 40,
            perfect: true,
            rating: 'S',
            relicFavorGained: 5,
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
            relicFavorGained: 5,
            featuredObjectiveStreak: 3,
            featuredObjectiveStreakBonus: 12,
            endlessRiskWagerOutcome: 'won',
            endlessRiskWagerFavorGained: 2,
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
            endlessRiskWagerFavorGained: 0,
            endlessRiskWagerOutcome: undefined,
            endlessRiskWagerStreakLost: undefined,
            featuredObjectiveCompleted: false,
            featuredObjectiveId: null,
            featuredObjectiveStreak: 0,
            featuredObjectiveStreakBonus: 0,
            level: 2,
            livesRemaining: 3,
            mistakes: 2,
            momentumBonus: { momentum: 0, tier: 'none' as const, shards: 0, gold: 0 },
            objectiveBonusScore: 0,
            perfect: false,
            rating: 'C',
            relicFavorGained: 0,
            routeChoices: undefined,
            run,
            scoreGained: 100
        });

        expect(result.bonusTags).toBeUndefined();
        expect(result.objectiveBonusScore).toBeUndefined();
        expect(result.featuredObjectiveId).toBeUndefined();
        expect(result.featuredObjectiveCompleted).toBeUndefined();
        expect(result.relicFavorGained).toBeUndefined();
        expect(result.featuredObjectiveStreak).toBeUndefined();
        expect(result.featuredObjectiveStreakBonus).toBeUndefined();
        expect(result.endlessRiskWagerFavorGained).toBeUndefined();
        expect(result.bossTrophyCacheScore).toBeUndefined();
    });
});
