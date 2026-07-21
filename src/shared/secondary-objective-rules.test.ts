import { describe, expect, it } from 'vitest';
import {
    CURSED_LAST_BONUS_SCORE,
    FLIP_PAR_BONUS_SCORE,
    GLASS_WITNESS_BONUS_SCORE,
    type RelicId,
    SCHOLAR_STYLE_FLOOR_BONUS_SCORE
} from './contracts';
import {
    FEATURED_OBJECTIVE_BONUS_SCORES,
    getDefaultClearObjectiveBonus,
    getFloorClearObjectiveResult,
    getFeaturedObjectiveClearResult,
    getFeaturedObjectiveBonusScore,
    getFeaturedObjectiveRewardCopy,
    getFlipParLimit,
    isFeaturedObjectiveCompleted
} from './secondary-objective-rules';
import { createNewRun } from './game-core';

describe('secondary objective rules', () => {
    it('keeps featured objective bonuses tied to contract constants', () => {
        expect(FEATURED_OBJECTIVE_BONUS_SCORES).toEqual({
            scholar_style: SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
            glass_witness: GLASS_WITNESS_BONUS_SCORE,
            cursed_last: CURSED_LAST_BONUS_SCORE,
            flip_par: FLIP_PAR_BONUS_SCORE
        });
        expect(getFeaturedObjectiveBonusScore('flip_par')).toBe(FLIP_PAR_BONUS_SCORE);
    });

    it('computes match-resolution par from pair count', () => {
        expect(getFlipParLimit(0)).toBe(2);
        expect(getFlipParLimit(2)).toBe(5);
        expect(getFlipParLimit(8)).toBe(12);
    });

    it('uses the score table in reward copy', () => {
        expect(getFeaturedObjectiveRewardCopy('cursed_last')).toBe(
            `+${CURSED_LAST_BONUS_SCORE} score and featured-objective Favor when scheduled.`
        );
    });

    it('checks featured objective completion from run and board state', () => {
        const run = createNewRun(0);
        const board = run.board!;

        expect(isFeaturedObjectiveCompleted(run, board, 'scholar_style')).toBe(true);
        expect(isFeaturedObjectiveCompleted({ ...run, shuffleUsedThisFloor: true }, board, 'scholar_style')).toBe(false);
        expect(isFeaturedObjectiveCompleted({ ...run, glassDecoyActiveThisFloor: true }, board, 'glass_witness')).toBe(true);
        expect(isFeaturedObjectiveCompleted(
            { ...run, glassDecoyActiveThisFloor: true, decoyFlippedThisFloor: true },
            board,
            'glass_witness'
        )).toBe(false);
        expect(isFeaturedObjectiveCompleted(run, { ...board, cursedPairKey: 'curse' }, 'cursed_last')).toBe(true);
        expect(isFeaturedObjectiveCompleted({ ...run, cursedMatchedEarlyThisFloor: true }, { ...board, cursedPairKey: 'curse' }, 'cursed_last')).toBe(false);
        expect(isFeaturedObjectiveCompleted(run, { ...board, pairCount: 4 }, 'flip_par')).toBe(true);
        expect(isFeaturedObjectiveCompleted({ ...run, matchResolutionsThisFloor: 99 }, { ...board, pairCount: 4 }, 'flip_par')).toBe(false);
        expect(
            isFeaturedObjectiveCompleted(
                { ...run, matchResolutionsThisFloor: Number.POSITIVE_INFINITY },
                { ...board, pairCount: 4 },
                'flip_par'
            )
        ).toBe(true);
    });

    it('collects default clear objective bonuses when no featured objective is scheduled', () => {
        const run = {
            ...createNewRun(0),
            glassDecoyActiveThisFloor: true
        };
        const board = { ...run.board!, cursedPairKey: 'curse', pairCount: 4 };

        expect(getDefaultClearObjectiveBonus(run, board)).toEqual({
            bonusScore:
                SCHOLAR_STYLE_FLOOR_BONUS_SCORE +
                GLASS_WITNESS_BONUS_SCORE +
                CURSED_LAST_BONUS_SCORE +
                FLIP_PAR_BONUS_SCORE,
            bonusTags: ['scholar_style', 'glass_witness', 'cursed_last', 'flip_par']
        });
        expect(
            getDefaultClearObjectiveBonus(
                { ...run, matchResolutionsThisFloor: Number.NaN },
                board
            ).bonusTags
        ).toContain('flip_par');
    });

    it('omits default clear objective bonuses that were failed', () => {
        const run = {
            ...createNewRun(0),
            shuffleUsedThisFloor: true,
            destroyUsedThisFloor: true,
            glassDecoyActiveThisFloor: true,
            decoyFlippedThisFloor: true,
            cursedMatchedEarlyThisFloor: true,
            matchResolutionsThisFloor: 99
        };
        const board = { ...run.board!, cursedPairKey: 'curse', pairCount: 4 };

        expect(getDefaultClearObjectiveBonus(run, board)).toEqual({
            bonusScore: 0,
            bonusTags: []
        });
    });

    it('creates default floor-clear objective results when no featured objective is active', () => {
        const run = {
            ...createNewRun(0),
            gameMode: 'endless' as const,
            glassDecoyActiveThisFloor: true
        };
        const board = { ...run.board!, featuredObjectiveId: null, cursedPairKey: 'curse', pairCount: 4 };

        expect(getFloorClearObjectiveResult(run, board)).toMatchObject({
            featuredObjectiveId: null,
            featuredObjectiveCompleted: false,
            objectiveBonus:
                SCHOLAR_STYLE_FLOOR_BONUS_SCORE +
                GLASS_WITNESS_BONUS_SCORE +
                CURSED_LAST_BONUS_SCORE +
                FLIP_PAR_BONUS_SCORE,
            bonusTags: ['scholar_style', 'glass_witness', 'cursed_last', 'flip_par'],
            featuredObjectiveClear: {
                featuredObjectiveStreak: run.featuredObjectiveStreak,
                featuredObjectiveStreakBonus: 0,
                relicFavorGained: 0
            }
        });
    });

    it('creates featured floor-clear objective results for scheduled endless objectives', () => {
        const run = {
            ...createNewRun(0),
            gameMode: 'endless' as const,
            featuredObjectiveStreak: 1
        };
        const board = { ...run.board!, featuredObjectiveId: 'scholar_style' as const, level: 2 };

        expect(getFloorClearObjectiveResult(run, board)).toMatchObject({
            featuredObjectiveId: 'scholar_style',
            featuredObjectiveCompleted: true,
            objectiveBonus: SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
            bonusTags: ['scholar_style', 'objective_streak'],
            featuredObjectiveClear: {
                featuredObjectiveStreak: 2,
                relicFavorGained: 1
            }
        });
    });

    it('computes featured objective clear streak, favor, and streak bonus', () => {
        const run = {
            ...createNewRun(0),
            featuredObjectiveStreak: 2
        };

        const result = getFeaturedObjectiveClearResult({
            board: { ...run.board!, floorTag: 'normal', level: 3 },
            completed: true,
            objectiveId: 'scholar_style',
            run
        });

        expect(result).toMatchObject({
            activeEndlessRiskWager: null,
            endlessRiskWagerFavorGained: 0,
            endlessRiskWagerOutcome: undefined,
            featuredObjectiveStreak: 3,
            relicFavorGained: 1
        });
        expect(result.featuredObjectiveStreakBonus).toBeGreaterThan(0);
    });

    it('normalizes malformed featured objective streaks before clear or decay', () => {
        const run = {
            ...createNewRun(0),
            featuredObjectiveStreak: 2.9
        };

        expect(getFeaturedObjectiveClearResult({
            board: run.board!,
            completed: true,
            objectiveId: 'scholar_style',
            run
        })).toMatchObject({
            featuredObjectiveStreak: 3
        });

        expect(getFeaturedObjectiveClearResult({
            board: run.board!,
            completed: false,
            objectiveId: 'flip_par',
            run: { ...run, featuredObjectiveStreak: Number.POSITIVE_INFINITY }
        })).toMatchObject({
            featuredObjectiveStreak: 0
        });

        expect(getFeaturedObjectiveClearResult({
            board: run.board!,
            completed: false,
            objectiveId: null,
            run: { ...run, featuredObjectiveStreak: Number.NaN }
        })).toMatchObject({
            featuredObjectiveStreak: 0
        });
    });

    it('decays featured objective streak on non-wager misses', () => {
        const run = {
            ...createNewRun(0),
            featuredObjectiveStreak: 3
        };

        expect(getFeaturedObjectiveClearResult({
            board: run.board!,
            completed: false,
            objectiveId: 'flip_par',
            run
        })).toMatchObject({
            featuredObjectiveStreak: 1,
            endlessRiskWagerStreakLost: undefined,
            relicFavorGained: 0
        });
    });

    it('resets wager misses unless wager surety is held', () => {
        const run = {
            ...createNewRun(0),
            endlessRiskWager: {
                acceptedOnLevel: 1,
                targetLevel: 2,
                streakAtRisk: 4,
                bonusFavorOnSuccess: 2
            },
            featuredObjectiveStreak: 4
        };
        const board = { ...run.board!, level: 2 };

        expect(getFeaturedObjectiveClearResult({
            board,
            completed: false,
            objectiveId: 'glass_witness',
            run
        })).toMatchObject({
            endlessRiskWagerOutcome: 'lost',
            endlessRiskWagerStreakLost: 4,
            featuredObjectiveStreak: 0
        });
        expect(getFeaturedObjectiveClearResult({
            board,
            completed: false,
            objectiveId: 'glass_witness',
            run: { ...run, relicIds: ['wager_surety'] }
        })).toMatchObject({
            endlessRiskWagerOutcome: 'lost',
            endlessRiskWagerStreakLost: 3,
            featuredObjectiveStreak: 1
        });
    });

    it('normalizes malformed wager counters before loss and reward calculations', () => {
        const run = {
            ...createNewRun(0),
            endlessRiskWager: {
                acceptedOnLevel: 1,
                targetLevel: 2,
                streakAtRisk: 4.9,
                bonusFavorOnSuccess: Number.POSITIVE_INFINITY
            },
            featuredObjectiveStreak: 4.9
        };
        const board = { ...run.board!, level: 2 };

        expect(getFeaturedObjectiveClearResult({
            board,
            completed: false,
            objectiveId: 'glass_witness',
            run: { ...run, relicIds: ['wager_surety'] }
        })).toMatchObject({
            endlessRiskWagerOutcome: 'lost',
            endlessRiskWagerStreakLost: 3,
            featuredObjectiveStreak: 1
        });

        expect(getFeaturedObjectiveClearResult({
            board,
            completed: true,
            objectiveId: 'glass_witness',
            run: { ...run, relicIds: ['wager_surety'] }
        })).toMatchObject({
            endlessRiskWagerFavorGained: 1,
            endlessRiskWagerOutcome: 'won',
            featuredObjectiveStreak: 5
        });
    });

    it('ignores malformed relic ids before applying wager surety', () => {
        const run = {
            ...createNewRun(0),
            endlessRiskWager: {
                acceptedOnLevel: 1,
                targetLevel: 2,
                streakAtRisk: 4,
                bonusFavorOnSuccess: 2
            },
            featuredObjectiveStreak: 4,
            relicIds: Number.NaN as unknown as RelicId[]
        };

        expect(getFeaturedObjectiveClearResult({
            board: { ...run.board!, level: 2 },
            completed: false,
            objectiveId: 'glass_witness',
            run
        })).toMatchObject({
            endlessRiskWagerOutcome: 'lost',
            endlessRiskWagerStreakLost: 4,
            featuredObjectiveStreak: 0
        });
    });

    it('adds wager favor on featured objective wager wins', () => {
        const run = {
            ...createNewRun(0),
            endlessRiskWager: {
                acceptedOnLevel: 1,
                targetLevel: 2,
                streakAtRisk: 2,
                bonusFavorOnSuccess: 2
            },
            featuredObjectiveStreak: 2,
            relicIds: ['wager_surety'] satisfies RelicId[]
        };

        expect(getFeaturedObjectiveClearResult({
            board: { ...run.board!, level: 2 },
            completed: true,
            objectiveId: 'scholar_style',
            run
        })).toMatchObject({
            endlessRiskWagerFavorGained: 3,
            endlessRiskWagerOutcome: 'won',
            featuredObjectiveStreak: 3,
            relicFavorGained: 1
        });
    });
});
