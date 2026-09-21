import { describe, expect, it } from 'vitest';
import {
    CURSED_LAST_BONUS_SCORE,
    FLIP_PAR_BONUS_SCORE,
    SCHOLAR_STYLE_FLOOR_BONUS_SCORE
} from './contracts';
import {
    FEATURED_OBJECTIVE_BONUS_SCORES,
    getDefaultClearObjectiveBonus,
    getFloorClearObjectiveResult,
    getFeaturedObjectiveClearResult,
    getFeaturedObjectiveBonusScore,
    getFeaturedObjectiveRewardCopy,
    isWithinFloorPar,
    isFeaturedObjectiveCompleted
} from './secondary-objective-rules';
import { createNewRun } from './game-core';
import { SCATTERED_SUIT_CEILING, TILE_SUITS } from './tile-suit-rules';
import type { Tile, TileSuit } from './contracts';

/** A board's worth of tiles over a given palette, so a fixture's par is the palette it names. */
const tilesOf = (pairs: number, suits: number): Tile[] => {
    const palette = TILE_SUITS.slice(0, suits);
    return Array.from({ length: pairs * 2 }, (_, index) => {
        const pair = Math.floor(index / 2);
        return {
            id: `t-${index}`,
            pairKey: `p-${pair}`,
            symbol: `s-${pair}`,
            state: 'hidden',
            suit: palette[pair % palette.length] as TileSuit
        } as Tile;
    });
};

describe('secondary objective rules', () => {
    it('keeps featured objective bonuses tied to contract constants', () => {
        expect(FEATURED_OBJECTIVE_BONUS_SCORES).toEqual({
            scholar_style: SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
            cursed_last: CURSED_LAST_BONUS_SCORE,
            flip_par: FLIP_PAR_BONUS_SCORE
        });
        expect(getFeaturedObjectiveBonusScore('flip_par')).toBe(FLIP_PAR_BONUS_SCORE);
    });

    it('reads within-par from the floor par and the turns taken, match or miss', () => {
        const run = createNewRun(0);
        /*
         * Twelve pairs on the full palette par at seven turns: ceil(12 x 0.45) is six, and Gen 210
         * gives a floor at or below thirteen pairs one turn back, because the pop takes a smaller
         * share of a small board and a linear par made the opening the only place a clean player
         * failed the target.
         *
         * The palette has to be dealt on the tiles rather than left as floor 1's, because par reads
         * it off the board since Gen 259 - a four-pair two-suit board standing in for a twelve-pair
         * one silently asked for the narrow palette's par.
         */
        const board = { ...run.board!, pairCount: 12, tiles: tilesOf(12, TILE_SUITS.length) };
        expect(isWithinFloorPar({ ...run, turnsThisFloor: 7 }, board)).toBe(true);
        expect(isWithinFloorPar({ ...run, turnsThisFloor: 8 }, board)).toBe(false);
        expect(isWithinFloorPar(run, { ...board, pairCount: 1 })).toBe(false);
    });

    it('holds the same board to a tighter par when it was dealt a narrow palette', () => {
        /*
         * Gen 259. The same twelve pairs over two suits pop a third faster, so seven turns is no
         * longer within par on it - the objective was free on every scattered and spotlight floor.
         */
        const run = createNewRun(0);
        const wide = { ...run.board!, pairCount: 12, tiles: tilesOf(12, TILE_SUITS.length) };
        const narrow = { ...wide, tiles: tilesOf(12, SCATTERED_SUIT_CEILING) };
        expect(isWithinFloorPar({ ...run, turnsThisFloor: 7 }, narrow)).toBe(false);
        expect(isWithinFloorPar({ ...run, turnsThisFloor: 6 }, narrow)).toBe(true);
        expect(isWithinFloorPar({ ...run, turnsThisFloor: 7 }, wide)).toBe(true);
    });

    it('uses the score table in reward copy', () => {
        expect(getFeaturedObjectiveRewardCopy('cursed_last')).toBe(
            `+${CURSED_LAST_BONUS_SCORE} score when scheduled.`
        );
    });

    it('checks featured objective completion from run and board state', () => {
        const run = createNewRun(0);
        const board = run.board!;

        expect(isFeaturedObjectiveCompleted(run, board, 'scholar_style')).toBe(true);
        expect(isFeaturedObjectiveCompleted({ ...run, shuffleUsedThisFloor: true }, board, 'scholar_style')).toBe(false);
        expect(isFeaturedObjectiveCompleted(run, { ...board, cursedPairKey: 'curse' }, 'cursed_last')).toBe(true);
        expect(isFeaturedObjectiveCompleted({ ...run, cursedMatchedEarlyThisFloor: true }, { ...board, cursedPairKey: 'curse' }, 'cursed_last')).toBe(false);
        expect(isFeaturedObjectiveCompleted(run, { ...board, pairCount: 4 }, 'flip_par')).toBe(true);
        expect(isFeaturedObjectiveCompleted({ ...run, turnsThisFloor: 99 }, { ...board, pairCount: 4 }, 'flip_par')).toBe(false);
        expect(
            isFeaturedObjectiveCompleted(
                { ...run, turnsThisFloor: Number.POSITIVE_INFINITY },
                { ...board, pairCount: 4 },
                'flip_par'
            )
        ).toBe(true);
    });

    it('collects default clear objective bonuses when no featured objective is scheduled', () => {
        const run = createNewRun(0);
        const board = { ...run.board!, cursedPairKey: 'curse', pairCount: 4 };

        expect(getDefaultClearObjectiveBonus(run, board)).toEqual({
            bonusScore:
                SCHOLAR_STYLE_FLOOR_BONUS_SCORE +
                CURSED_LAST_BONUS_SCORE +
                FLIP_PAR_BONUS_SCORE,
            bonusTags: ['scholar_style', 'cursed_last', 'flip_par']
        });
        expect(
            getDefaultClearObjectiveBonus(
                { ...run, turnsThisFloor: Number.NaN },
                board
            ).bonusTags
        ).toContain('flip_par');
    });

    it('omits default clear objective bonuses that were failed', () => {
        const run = {
            ...createNewRun(0),
            shuffleUsedThisFloor: true,
            cursedMatchedEarlyThisFloor: true,
            turnsThisFloor: 99
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
            gameMode: 'endless' as const
        };
        const board = { ...run.board!, featuredObjectiveId: null, cursedPairKey: 'curse', pairCount: 4 };

        expect(getFloorClearObjectiveResult(run, board)).toMatchObject({
            featuredObjectiveId: null,
            featuredObjectiveCompleted: false,
            objectiveBonus:
                SCHOLAR_STYLE_FLOOR_BONUS_SCORE +
                CURSED_LAST_BONUS_SCORE +
                FLIP_PAR_BONUS_SCORE,
            bonusTags: ['scholar_style', 'cursed_last', 'flip_par'],
            featuredObjectiveClear: {
                featuredObjectiveStreak: run.featuredObjectiveStreak,
                featuredObjectiveStreakBonus: 0
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
            }
        });
    });

    it('computes featured objective clear streak and streak bonus', () => {
        const run = {
            ...createNewRun(0),
            featuredObjectiveStreak: 2
        };

        const result = getFeaturedObjectiveClearResult({
            completed: true,
            objectiveId: 'scholar_style',
            run
        });

        expect(result).toMatchObject({
            featuredObjectiveStreak: 3,
        });
        expect(result.featuredObjectiveStreakBonus).toBeGreaterThan(0);
    });

    it('normalizes malformed featured objective streaks before clear or decay', () => {
        const run = {
            ...createNewRun(0),
            featuredObjectiveStreak: 2.9
        };

        expect(getFeaturedObjectiveClearResult({
            completed: true,
            objectiveId: 'scholar_style',
            run
        })).toMatchObject({
            featuredObjectiveStreak: 3
        });

        expect(getFeaturedObjectiveClearResult({
            completed: false,
            objectiveId: 'flip_par',
            run: { ...run, featuredObjectiveStreak: Number.POSITIVE_INFINITY }
        })).toMatchObject({
            featuredObjectiveStreak: 0
        });

        expect(getFeaturedObjectiveClearResult({
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
            completed: false,
            objectiveId: 'flip_par',
            run
        })).toMatchObject({
            featuredObjectiveStreak: 1,
        });
    });




});
