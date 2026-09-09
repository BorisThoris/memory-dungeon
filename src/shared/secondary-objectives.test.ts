import { describe, expect, it } from 'vitest';
import { FLIP_PAR_BONUS_SCORE, type RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import {
    formatLevelResultObjectiveLine,
    formatLevelResultTagLabel,
    getFloorClearLevelResultTags,
    getLevelResultTagDefinitions,
    getSecondaryObjectiveProgress,
    getVisibleLevelResultTags,
    LEVEL_RESULT_TAG_DEFINITIONS
} from './secondary-objectives';

describe('REG-048 secondary objective clarity', () => {
    it('explains active and failed objective states with bonus copy', () => {
        const active = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const row = getSecondaryObjectiveProgress(active);

        expect(row?.status).toBe('active');
        expect(row?.condition).toMatch(/within par/i);
        expect(row?.reward).toContain(`+${FLIP_PAR_BONUS_SCORE}`);

        const failed = {
            ...active,
            turnsThisFloor: 999
        };
        const failedRow = getSecondaryObjectiveProgress(failed);
        expect(failedRow?.status).toBe('failed');
        expect(failedRow?.failureReason).toMatch(/par exceeded/i);

        const malformed = {
            ...active,
            turnsThisFloor: Number.POSITIVE_INFINITY
        };
        const malformedRow = getSecondaryObjectiveProgress(malformed);
        expect(malformedRow?.status).toBe('active');
        expect(malformedRow?.condition).toContain('(0/');
    });

    it('returns completed status from level result for floor-clear celebration', () => {
        const completed = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S++' as const,
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par' as const,
                featuredObjectiveCompleted: true,
                objectiveBonusScore: 30
            }
        };
        expect(getSecondaryObjectiveProgress(completed)?.status).toBe('completed');
    });

    it('normalizes malformed objective bonus score before formatting level result copy', () => {
        expect(
            formatLevelResultObjectiveLine({
                level: 1,
                scoreGained: 100,
                rating: 'S++',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                objectiveBonusScore: Number.POSITIVE_INFINITY
            })
        ).toBe('Flip par: Complete');
    });


    it('tags a perfect clear taken without peeks or tools as a perfect scout', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));

        expect(getFloorClearLevelResultTags({ ...run, peekRevealedTileIds: [] }, true)).toEqual(['perfect_scout']);
        expect(getFloorClearLevelResultTags({ ...run, peekRevealedTileIds: [] }, false)).toEqual([]);
        expect(getFloorClearLevelResultTags({ ...run, peekRevealedTileIds: [], shuffleUsedThisFloor: true }, true)).toEqual([]);
        expect(
            getFloorClearLevelResultTags(
                { ...run, peekRevealedTileIds: Number.NaN as unknown as RunState['peekRevealedTileIds'] },
                true
            )
        ).toEqual(['perfect_scout']);
        expect(getLevelResultTagDefinitions(['perfect_scout']).every((tag) => !tag.rewardBearing)).toBe(true);
        expect(LEVEL_RESULT_TAG_DEFINITIONS.boss_floor.rewardBearing).toBe(true);
    });

    it('prioritizes the top three visible result tags for floor-clear copy', () => {
        const visible = getVisibleLevelResultTags([
            'flip_par',
            'boss_floor',
            'objective_streak',
            'perfect_scout'
        ]);

        expect(visible.map((tag) => tag.id)).toEqual(['boss_floor', 'objective_streak', 'perfect_scout']);
    });

    it.each(['__proto__', 'constructor', 'toString'])('rejects prototype result tag %s', (tag) => {
        expect(getLevelResultTagDefinitions([tag])).toEqual([]);
        expect(formatLevelResultTagLabel(tag)).toBe(tag);
    });
});
