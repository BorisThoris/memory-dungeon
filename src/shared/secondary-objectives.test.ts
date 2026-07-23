import { describe, expect, it } from 'vitest';
import { FLIP_PAR_BONUS_SCORE, type RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import {
    formatLevelResultObjectiveLine,
    formatLevelResultTagLabel,
    getDungeonLevelResultTags,
    getLevelResultTagDefinitions,
    getSecondaryObjectiveProgress,
    getSecondaryObjectiveStatusRows,
    getVisibleLevelResultTags,
    LEVEL_RESULT_TAG_DEFINITIONS
} from './secondary-objectives';

describe('REG-048 secondary objective clarity', () => {
    it('explains active and failed objective states with bonus copy', () => {
        const active = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const row = getSecondaryObjectiveProgress(active);

        expect(row?.status).toBe('active');
        expect(row?.condition).toMatch(/match-resolution par/i);
        expect(row?.reward).toContain(`+${FLIP_PAR_BONUS_SCORE}`);

        const failed = {
            ...active,
            matchResolutionsThisFloor: 999
        };
        const failedRow = getSecondaryObjectiveProgress(failed);
        expect(failedRow?.status).toBe('failed');
        expect(failedRow?.failureReason).toMatch(/par exceeded/i);

        const malformed = {
            ...active,
            matchResolutionsThisFloor: Number.POSITIVE_INFINITY
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

    it('generates dungeon result tags from rule state without reward-bearing duplicates', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const board = {
            ...run.board!,
            floorTag: 'boss' as const,
            selectedGatewayRouteType: 'greed' as const
        };
        const tags = getDungeonLevelResultTags(
            {
                ...run,
                dungeonEnemiesDefeatedThisFloor: 1,
                dungeonTrapsResolvedThisFloor: 2,
                dungeonTreasuresOpened: 1,
                dungeonTreasuresOpenedThisFloor: 1,
                dungeonGatewaysUsed: 1,
                dungeonGatewaysUsedThisFloor: 1,
                peekRevealedTileIds: []
            },
            board,
            true
        );

        expect(tags).toEqual([
            'boss_defeated',
            'traps_disarmed',
            'treasure_claimed',
            'route_claimed',
            'perfect_scout'
        ]);
        expect(getLevelResultTagDefinitions(tags).every((tag) => !tag.rewardBearing)).toBe(true);
        expect(LEVEL_RESULT_TAG_DEFINITIONS.boss_floor.rewardBearing).toBe(true);

        expect(
            getDungeonLevelResultTags(
                {
                    ...run,
                    dungeonTreasuresOpened: 1,
                    dungeonTreasuresOpenedThisFloor: 0,
                    dungeonGatewaysUsed: 1,
                    dungeonGatewaysUsedThisFloor: 0
                },
                run.board!,
                false
            )
        ).toEqual([]);

        expect(
            getDungeonLevelResultTags(
                {
                    ...run,
                    dungeonEnemiesDefeatedThisFloor: Number.POSITIVE_INFINITY,
                    dungeonTrapsResolvedThisFloor: Number.NaN,
                    dungeonTreasuresOpenedThisFloor: Number.NEGATIVE_INFINITY,
                    dungeonGatewaysUsedThisFloor: Number.NaN
                },
                { ...run.board!, floorTag: 'boss' },
                false
            )
        ).toEqual([]);

        expect(
            getDungeonLevelResultTags(
                {
                    ...run,
                    peekRevealedTileIds: Number.NaN as unknown as RunState['peekRevealedTileIds']
                },
                run.board!,
                true
            )
        ).toEqual(['perfect_scout']);
    });

    it('prioritizes the top three visible result tags for floor-clear copy', () => {
        const visible = getVisibleLevelResultTags([
            'flip_par',
            'boss_floor',
            'traps_disarmed',
            'treasure_claimed',
            'perfect_scout'
        ]);

        expect(visible.map((tag) => tag.id)).toEqual(['traps_disarmed', 'treasure_claimed', 'boss_floor']);
    });

    it.each(['__proto__', 'constructor', 'toString'])('rejects prototype result tag %s', (tag) => {
        expect(getLevelResultTagDefinitions([tag])).toEqual([]);
        expect(formatLevelResultTagLabel(tag)).toBe(tag);
    });

    it('includes active trait route objectives in secondary objective rows', () => {
        const run = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRequiredThisFloor: 2,
            traitRouteObjectiveCompletedThisFloor: false,
            traitRouteObjectiveRewardClaimedThisFloor: false,
            traitRouteObjectiveRewardTextThisFloor: null
        };

        expect(getSecondaryObjectiveStatusRows(run)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'trait_route_objective',
                    label: 'Trait routes',
                    condition: 'Trigger 2 trait routes.',
                    reward: '+1 combo shard'
                })
            ])
        );
    });
});
