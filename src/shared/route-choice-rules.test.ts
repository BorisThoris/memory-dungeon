import { describe, expect, it } from 'vitest';

import type { RunState } from './contracts';
import {
    ROUTE_GREED_SCORE_REWARD,
    ROUTE_GREED_SHOP_GOLD_REWARD,
    generateRouteChoices,
    getRouteChoiceAvailability,
    routeChoicesForResult
} from './route-choice-rules';

const run = (overrides: Partial<RunState> = {}): RunState =>
    ({
        lives: 3,
        runRulesVersion: 8,
        runSeed: 123,
        ...overrides
    }) as RunState;

describe('route choice rules', () => {
    it('generates stable safe, greed, and mystery choices from run identity and target level', () => {
        const choices = generateRouteChoices(run(), 3);

        expect(choices.map((choice) => choice.id)).toEqual(['8:123:3:safe', '8:123:3:greed', '8:123:3:mystery']);
        expect(choices.map((choice) => choice.routeType)).toEqual(['safe', 'greed', 'mystery']);
        expect(choices[1]).toMatchObject({
            rewardPreview: `+${ROUTE_GREED_SHOP_GOLD_REWARD} shop gold and +${ROUTE_GREED_SCORE_REWARD} score.`,
            riskPreview: '-1 life; unavailable at 1 life.'
        });
        expect(choices[1]!.detail).toContain('Higher pressure route hook with vendor access after the next floor.');
        expect(choices[1]!.detail).toContain('Trait pressure: more Volatile/Cursed pairs');
    });

    it('switches mystery detail on fourth floors', () => {
        const detail = generateRouteChoices(run(), 4)[2]!.detail;
        expect(detail).toContain('Hidden treasure or secret-room hook with capped bonus rewards.');
        expect(detail).toContain('Trait pressure: Mirror/Sealed unknowns');
    });

    it('blocks greed route choices when only one life remains', () => {
        const greed = generateRouteChoices(run(), 2).find((choice) => choice.routeType === 'greed')!;
        const safe = generateRouteChoices(run(), 2).find((choice) => choice.routeType === 'safe')!;

        expect(getRouteChoiceAvailability(run({ lives: 1 }), greed)).toEqual({
            available: false,
            reason: 'needs_more_lives',
            label: 'Unavailable at 1 life'
        });
        expect(getRouteChoiceAvailability(run({ lives: 1 }), safe)).toEqual({ available: true });
    });

    it('normalizes malformed route choice payloads from level results', () => {
        const choices = generateRouteChoices(run(), 2);
        const safe = choices[0]!;
        const greed = choices[1]!;

        expect(
            routeChoicesForResult({
                level: 1,
                scoreGained: 100,
                rating: 'S',
                livesRemaining: 3,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                routeChoices: [
                    safe,
                    { id: 'broken', routeType: 'safe', label: 'Broken' },
                    { ...greed, detail: 12 },
                    greed
                ] as never
            })
        ).toEqual([safe, greed]);

        expect(
            routeChoicesForResult({
                level: 1,
                scoreGained: 100,
                rating: 'S',
                livesRemaining: 3,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                routeChoices: { length: 2 } as never
            })
        ).toEqual([]);
    });
});
