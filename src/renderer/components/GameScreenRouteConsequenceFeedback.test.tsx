import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import {
    GameScreenActiveRouteFeedback,
    GameScreenSelectedRouteFeedback,
    getGameScreenRouteConsequenceProjection
} from './GameScreenRouteConsequenceFeedback';

const selectedGreedProjection = () => {
    const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 });
    return getGameScreenRouteConsequenceProjection({
        ...base,
        pendingRouteCardPlan: {
            choiceId: '42:1:2:greed',
            routeType: 'greed',
            sourceLevel: 1,
            targetLevel: 2
        },
        status: 'levelComplete'
    }).selected;
};

const activeGreedProjection = () => {
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
    return getGameScreenRouteConsequenceProjection(run).active;
};

describe('GameScreenRouteConsequenceFeedback', () => {
    it('renders selected-route commitment from projection facts only', () => {
        render(<GameScreenSelectedRouteFeedback projection={selectedGreedProjection()} />);

        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-type', 'greed');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-impact-cue', 'Greed route');
        expect(screen.getByTestId('route-selected-note')).toHaveTextContent('High reward');
        expect(screen.getByTestId('route-selected-impact-cue')).toHaveAccessibleName(
            'Selected route impact cue: Greed route: Risk cashout locked.'
        );
        expect(screen.getByTestId('route-selected-action-cue')).toHaveAttribute(
            'data-route-action-cue-audio',
            'route-payoff-risk'
        );
        expect(screen.getByTestId('route-selected-action-cue').querySelectorAll('[data-route-action-cue-beat]'))
            .toHaveLength(3);
    });

    it('renders active-board payoff and risk from the same route consequence projection', () => {
        render(<GameScreenActiveRouteFeedback projection={activeGreedProjection()} />);

        expect(screen.getByTestId('route-card-board-banner')).toHaveTextContent('Greed Cache');
        expect(screen.getByTestId('route-card-board-banner')).toHaveTextContent('+2 gold +25 score');
        expect(screen.getByTestId('route-card-board-banner-signals')).toHaveAccessibleName(
            'Route card payoff signals. Role: Payout. Payoff: Gold score. Risk: Lost if destroyed.'
        );
        expect(
            screen.getByTestId('route-card-board-banner-signals').querySelector('[data-route-card-signal-tone="risk"]')
        ).toHaveAttribute('data-route-card-signal-audio', 'route-card-risk');
    });

    it('renders neither lifecycle surface for null projections', () => {
        const { container } = render(
            <>
                <GameScreenActiveRouteFeedback projection={null} />
                <GameScreenSelectedRouteFeedback projection={null} />
            </>
        );

        expect(container).toBeEmptyDOMElement();
    });
});
