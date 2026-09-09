import { describe, expect, it } from 'vitest';
import { BOSS_FLOOR_SCORE_MULTIPLIER } from './contracts';
import { createNewRun } from './game';
import {
    calculateFloorClearBonus,
    calculateFloorClearScore,
    createFloorClearLevelResult,
    FLOOR_TIER_MULT,
    getFloorClearStatLevelResultFields
} from './level-clear-rules';

const coldBonus = (level: number) => calculateFloorClearBonus({ level, tier: 'none', parTurns: 10, turnsTaken: 10 });

describe('level-clear-rules', () => {
    it('maps positive floor counters into optional level-result fields', () => {
        const run = {
            ...createNewRun(0),
            chunkBreaksThisFloor: 2,
            feverBreaksThisFloor: 0,
            recallMatchesThisFloor: 1,
            recallMistakesThisFloor: 3,
            bestChainThisFloor: 0
        };

        expect(getFloorClearStatLevelResultFields(run)).toMatchObject({
            chunkBreaks: 2,
            feverBreaks: undefined,
            recallMatches: 1,
            recallMistakes: 3,
            bestChain: undefined
        });
    });

    describe('the floor-end bonus', () => {
        it('pays a hundred a level cold, times the tier the floor cleared at', () => {
            expect(FLOOR_TIER_MULT).toEqual({ none: 1, clean: 1.5, sharp: 2.5, fever: 5 });
            expect(coldBonus(3)).toMatchObject({ base: 300, tierMult: 1, tierBonus: 300, efficiencyBonus: 0, total: 300 });
            const fever = calculateFloorClearBonus({ level: 3, tier: 'fever', parTurns: 10, turnsTaken: 12 });
            expect(fever).toMatchObject({ base: 300, tierMult: 5, tierBonus: 1500, turnsUnderPar: 0, total: 1500 });
            // Clearing at Fever is worth five times clearing cold: the ceremony pays more than the floor.
            expect(fever.total / coldBonus(3).total).toBe(5);
            expect(calculateFloorClearBonus({ level: 4, tier: 'clean', parTurns: 8, turnsTaken: 8 }).tierBonus).toBe(600);
            expect(calculateFloorClearBonus({ level: 4, tier: 'sharp', parTurns: 8, turnsTaken: 8 }).tierBonus).toBe(1000);
        });

        it('pays fifty a level for every turn under par, and nothing for going over', () => {
            const under = calculateFloorClearBonus({ level: 6, tier: 'none', parTurns: 10, turnsTaken: 7 });
            expect(under).toMatchObject({ turnsUnderPar: 3, efficiencyBonus: 900, total: 600 + 900 });
            const over = calculateFloorClearBonus({ level: 6, tier: 'none', parTurns: 10, turnsTaken: 15 });
            expect(over).toMatchObject({ turnsUnderPar: 0, efficiencyBonus: 0, total: 600 });
        });

        it('normalizes a malformed level and turn count', () => {
            expect(calculateFloorClearBonus({ level: Number.NaN, tier: 'none', parTurns: 3, turnsTaken: Number.NaN }).total).toBe(100 + 3 * 50);
            expect(calculateFloorClearBonus({ level: 2.9, tier: 'none', parTurns: 4, turnsTaken: 4 }).base).toBe(200);
        });
    });

    it('calculates normal floor clear score from the floor bonus and floor counters', () => {
        const floorBonus = calculateFloorClearBonus({ level: 3, tier: 'clean', parTurns: 6, turnsTaken: 5 });
        const result = calculateFloorClearScore({
            currentLevelScore: 120,
            featuredObjectiveStreakBonus: 12,
            floorBonus,
            floorTag: 'normal',
            objectiveBonus: 40
        });

        expect(floorBonus.total).toBe(450 + 150);
        expect(result.floorBonus).toBe(floorBonus);
        expect(result.preBossSubtotal).toBe(120 + floorBonus.total + 40 + 12);
        expect(result.scoreGained).toBe(result.preBossSubtotal);
    });

    it('normalizes malformed floor clear score inputs before subtotaling', () => {
        const result = calculateFloorClearScore({
            currentLevelScore: Number.NaN,
            featuredObjectiveStreakBonus: 3.8,
            floorBonus: coldBonus(3),
            floorTag: 'normal',
            objectiveBonus: -12
        });

        expect(result.preBossSubtotal).toBe(300 + 3);
        expect(result.scoreGained).toBe(result.preBossSubtotal);
    });

    it('applies the boss floor score multiplier after the clear bonuses', () => {
        const result = calculateFloorClearScore({
            currentLevelScore: 150,
            featuredObjectiveStreakBonus: 0,
            floorBonus: coldBonus(10),
            floorTag: 'boss',
            objectiveBonus: 30
        });

        expect(result.preBossSubtotal).toBe(150 + 1000 + 30);
        expect(result.scoreGained).toBe(
            Math.floor(result.preBossSubtotal * BOSS_FLOOR_SCORE_MULTIPLIER)
        );
    });

    it('creates floor clear level results with deduped tags and positive optional counters', () => {
        const run = {
            ...createNewRun(0),
            chunkBreaksThisFloor: 2,
            recallMatchesThisFloor: 1,
            largestChunkScoreThisFloor: 96
        };

        const result = createFloorClearLevelResult({
            bonusTags: ['boss_floor', 'boss_floor', 'extreme_fever'],
            featuredObjectiveCompleted: true,
            featuredObjectiveId: 'flip_par',
            featuredObjectiveStreak: 3,
            featuredObjectiveStreakBonus: 12,
            floorBonus: calculateFloorClearBonus({ level: 7, tier: 'sharp', parTurns: 9, turnsTaken: 7 }),
            level: 7,
            mistakes: 0,
            momentumBonus: { momentum: 0, tier: 'none' as const },
            objectiveBonusScore: 40,
            parTurns: 9,
            perfect: true,
            playScore: 250,
            rating: 'S',
            run,
            scoreGained: 250,
            turnsTaken: 7
        });

        expect(result).toMatchObject({
            level: 7,
            scoreGained: 250,
            rating: 'S',
            perfect: true,
            mistakes: 0,
            bonusTags: ['boss_floor', 'extreme_fever'],
            objectiveBonusScore: 40,
            featuredObjectiveId: 'flip_par',
            featuredObjectiveCompleted: true,
            featuredObjectiveStreak: 3,
            featuredObjectiveStreakBonus: 12,
            chunkBreaks: 2,
            recallMatches: 1,
            parTurns: 9,
            turnsTaken: 7,
            playScore: 250,
            floorBonus: 1750 + 700,
            floorBonusTierMult: 2.5,
            floorEfficiencyBonus: 700,
            largestBreakScore: 96
        });
    });

    it('omits featured objective fields and zero optional rewards when absent', () => {
        const run = createNewRun(0);

        const result = createFloorClearLevelResult({
            bonusTags: [],
            featuredObjectiveCompleted: false,
            featuredObjectiveId: null,
            featuredObjectiveStreak: 0,
            featuredObjectiveStreakBonus: 0,
            floorBonus: coldBonus(2),
            level: 2,
            mistakes: 2,
            momentumBonus: { momentum: 0, tier: 'none' as const },
            objectiveBonusScore: 0,
            parTurns: 10,
            perfect: false,
            playScore: Number.NaN,
            rating: 'C',
            run,
            scoreGained: 100,
            turnsTaken: 10
        });
        expect(result.playScore).toBe(0);
        expect(result.floorEfficiencyBonus).toBeUndefined();
        expect(result.largestBreakScore).toBeUndefined();

        expect(result.bonusTags).toBeUndefined();
        expect(result.objectiveBonusScore).toBeUndefined();
        expect(result.featuredObjectiveId).toBeUndefined();
        expect(result.featuredObjectiveCompleted).toBeUndefined();
        expect(result.featuredObjectiveStreak).toBeUndefined();
        expect(result.featuredObjectiveStreakBonus).toBeUndefined();
        expect(result.chunkBreaks).toBeUndefined();
    });
});
