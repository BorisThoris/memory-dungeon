import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { getGameScreenRouteConsequenceProjection } from './gameScreenRouteConsequenceProjection';

const selectedRouteRun = (routeType: 'greed' | 'mystery' | 'safe'): RunState => {
    const run = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 });
    return {
        ...run,
        pendingRouteCardPlan: {
            choiceId: `42:1:2:${routeType}`,
            routeType,
            sourceLevel: 1,
            targetLevel: 2
        },
        status: 'levelComplete'
    };
};

describe('getGameScreenRouteConsequenceProjection', () => {
    it('returns an inert serializable projection without selected or active route facts', () => {
        const projection = getGameScreenRouteConsequenceProjection(
            createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 })
        );

        expect(projection).toEqual({ active: null, selected: null });
        expect(JSON.parse(JSON.stringify(projection))).toEqual(projection);
    });

    it('projects one selected Greed commitment into copy, action, impact, and multimodal signals', () => {
        const projection = getGameScreenRouteConsequenceProjection(selectedRouteRun('greed'));

        expect(projection.active).toBeNull();
        expect(projection.selected).toMatchObject({
            actionCue: {
                ariaLabel:
                    'Selected route action cue: Opening tactic: Verify before cashout. Confirm recall before chasing richer caches.',
                audioCue: 'route-payoff-risk',
                beatCount: 3,
                label: 'Opening tactic',
                screenCue: 'risk',
                tone: 'risk',
                value: 'Verify before cashout'
            },
            copy: 'Greedy route selected: next floor adds richer caches and extra reward-risk pressure.',
            impactCue: {
                ariaLabel: 'Selected route impact cue: Greed route: Risk cashout locked.',
                audioCue: 'route-payoff-risk',
                beatCount: 3,
                label: 'Greed route',
                screenCue: 'risk',
                value: 'Risk cashout locked'
            },
            routeCardKind: 'greed_cache',
            routeType: 'greed',
            signals: [
                { id: 'reward', label: 'High reward', audioCue: 'route-signal-reward', beatCount: 4 },
                { id: 'risk', label: 'High risk', audioCue: 'route-signal-risk', beatCount: 3 }
            ]
        });
    });

    it('projects the surviving in-board route pair and its complete payoff/risk feedback', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 });
        const run: RunState = {
            ...base,
            board: {
                ...base.board!,
                tiles: base.board!.tiles.map((tile, index) =>
                    index < 2 ? { ...tile, routeCardKind: 'greed_cache' as const } : tile
                )
            }
        };
        const projection = getGameScreenRouteConsequenceProjection(run);

        expect(projection.selected).toBeNull();
        expect(projection.active).toMatchObject({
            kind: 'greed_cache',
            label: 'Greed Cache',
            rewardLine: 'Match the Greed Cache pair for +2 gold +25 score.',
            signalsLabel: 'Route card payoff signals. Role: Payout. Payoff: Gold score. Risk: Lost if destroyed.',
            signals: [
                { label: 'Role', value: 'Payout', tone: 'reward', audioCue: 'route-card-reward', beatCount: 4 },
                { label: 'Payoff', value: 'Gold score', tone: 'reward', audioCue: 'route-card-reward', beatCount: 4 },
                { label: 'Risk', value: 'Lost if destroyed', tone: 'risk', audioCue: 'route-card-risk', beatCount: 3 }
            ]
        });
    });
});
