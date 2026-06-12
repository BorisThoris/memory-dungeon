import { describe, expect, it } from 'vitest';

import { createNewRun } from './game-core';
import { createPlayablePathFixture } from './playable-path-fixtures';
import { createRouteCardPlan, createRouteCardPlanForRoute } from './route-card-plan-rules';

describe('route card plan rules', () => {
    it('creates a plan from the last cleared floor', () => {
        const run = {
            ...createPlayablePathFixture('floorClearWithRouteChoices').run!,
            lastLevelResult: {
                ...createPlayablePathFixture('floorClearWithRouteChoices').run!.lastLevelResult!,
                level: 4
            }
        };

        expect(createRouteCardPlanForRoute(run, 'greed', 'choice-a')).toEqual({
            choiceId: 'choice-a',
            routeType: 'greed',
            sourceLevel: 4,
            targetLevel: 5
        });
    });

    it('creates a plan from a route choice', () => {
        const run = createNewRun(0);

        expect(createRouteCardPlan(run, { id: 'choice-b', label: 'Safe', detail: 'Recover.', routeType: 'safe' })).toMatchObject({
            choiceId: 'choice-b',
            routeType: 'safe'
        });
    });
});
