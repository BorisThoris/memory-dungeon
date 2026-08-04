import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { generateRouteChoices } from '../../shared/route-rules';
import { useGameScreenRouteChoiceProjection } from './useGameScreenRouteChoiceProjection';

const routeChoiceRun = (overrides: Partial<RunState> = {}): RunState => {
    const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 });
    const routeChoices = generateRouteChoices(base, 2);
    return {
        ...base,
        status: 'levelComplete',
        relicOffer: null,
        lastLevelResult: {
            level: 1,
            scoreGained: 120,
            rating: 'S',
            livesRemaining: base.lives,
            perfect: true,
            mistakes: 0,
            clearLifeReason: 'none',
            clearLifeGained: 0,
            routeChoices
        },
        ...overrides
    };
};

const project = (run: RunState, routeChoiceRequired = true) => {
    const routeChoices = run.lastLevelResult?.routeChoices ?? [];
    return renderHook(() => useGameScreenRouteChoiceProjection({
        firstRouteChoiceRequired: routeChoiceRequired && run.lastLevelResult?.level === 1,
        routeChoiceRequired,
        routeChoiceRequiredCopy: 'Choose one route.',
        routeChoices,
        run
    }));
};

describe('useGameScreenRouteChoiceProjection', () => {
    it('returns an inert choice projection without synthesizing cards outside a route decision', () => {
        const run = routeChoiceRun();
        const { result } = project(run, false);

        expect(result.current.routeChoiceRequired).toBe(false);
        expect(result.current.cards).toEqual([]);
        expect(result.current.recommendation).toBeNull();
        expect(result.current.memoryRecallFeedback.focus).toBeGreaterThanOrEqual(0);
    });

    it('projects each route once into synchronized action, payoff, recipe, feedback, and accessibility facts', () => {
        const run = routeChoiceRun();
        const { result } = project(run);
        const safe = result.current.cards.find((card) => card.row.routeType === 'safe');

        expect(result.current.cards).toHaveLength(3);
        expect(result.current.recommendation?.card.row.routeType).toBe('safe');
        expect(result.current.recommendation?.ariaLabel).toContain('Primary payoff: steady clear.');
        expect(safe).toMatchObject({
            actionCue: { action: 'Stabilize route', tone: 'memory' },
            beatCue: { audioCue: 'route-guard-beat', beatCount: 2, screenCue: 'guard' },
            decisionStack: { label: 'Route safety', tone: 'memory' },
            impactCue: { label: 'Safe route', value: 'Shield next floor' },
            primaryPayoff: {
                id: 'reward',
                audioCue: 'route-payoff-reward',
                beatCount: 4,
                screenCue: 'burst',
                value: 'steady clear'
            },
            signalRows: [
                { id: 'reward', audioCue: 'route-signal-reward', beatCount: 4, screenCue: 'burst' },
                { id: 'risk', audioCue: 'route-signal-risk', beatCount: 3, screenCue: 'risk' }
            ]
        });
        expect(safe?.recipeValue).toContain('Stabilize route -> steady clear');
        expect(safe?.ariaLabel).toContain('Route action: Stabilize route');
        expect(safe?.payoffsLabel).toContain('Route choice safe payoffs');
    });

    it('keeps one-life Greed unavailable and excludes it from the recommendation', () => {
        const run = routeChoiceRun({ lives: 1 });
        const { result } = project(run);
        const greed = result.current.cards.find((card) => card.row.routeType === 'greed');

        expect(greed?.availability).toEqual({
            available: false,
            reason: 'needs_more_lives',
            label: 'Unavailable at 1 life'
        });
        expect(greed?.ariaLabel).toContain('Unavailable at 1 life');
        expect(result.current.recommendation?.card.row.routeType).not.toBe('greed');
    });
});
