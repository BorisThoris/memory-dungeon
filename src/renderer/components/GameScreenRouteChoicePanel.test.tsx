import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { generateRouteChoices } from '../../shared/route-rules';
import { GameScreenRouteChoicePanel } from './GameScreenRouteChoicePanel';
import { useGameScreenRouteChoiceProjection } from './useGameScreenRouteChoiceProjection';

const routeChoiceRun = (lives = 5): RunState => {
    const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 42_001 });
    return {
        ...base,
        lives,
        status: 'levelComplete',
        relicOffer: null,
        lastLevelResult: {
            level: 1,
            scoreGained: 120,
            rating: 'S',
            livesRemaining: lives,
            perfect: true,
            mistakes: 0,
            clearLifeReason: 'none',
            clearLifeGained: 0,
            routeChoices: generateRouteChoices(base, 2)
        }
    };
};

const renderPanel = (run: RunState, routeChoiceRequired = true) => {
    const routeChoices = run.lastLevelResult?.routeChoices ?? [];
    const projection = renderHook(() => useGameScreenRouteChoiceProjection({
        firstRouteChoiceRequired: routeChoiceRequired,
        routeChoiceRequired,
        routeChoiceRequiredCopy: 'Choose the next room type.',
        routeChoices,
        run
    })).result.current;
    const onChooseRoute = vi.fn();
    const view = render(<GameScreenRouteChoicePanel onChooseRoute={onChooseRoute} projection={projection} />);
    return { onChooseRoute, view };
};

describe('GameScreenRouteChoicePanel', () => {
    it('renders the typed projection and submits only the selected route identity', () => {
        const { onChooseRoute } = renderPanel(routeChoiceRun());
        const safe = screen.getByTestId('route-choice-safe');

        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute(
            'data-route-recommendation-route',
            'safe'
        );
        expect(safe).toHaveAttribute('data-route-next-action', 'Stabilize route');
        expect(safe).toHaveAttribute('data-route-primary-payoff', 'steady clear');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveAccessibleName(
            expect.stringContaining('Route choice safe payoffs')
        );

        fireEvent.click(safe);
        expect(onChooseRoute).toHaveBeenCalledOnce();
        expect(onChooseRoute).toHaveBeenCalledWith(expect.stringMatching(/:safe$/u));
    });

    it('keeps unavailable Greed inert at one life', () => {
        const { onChooseRoute } = renderPanel(routeChoiceRun(1));
        const greed = screen.getByTestId('route-choice-greed');

        expect(greed).toBeDisabled();
        expect(greed).toHaveTextContent('Unavailable at 1 life');
        fireEvent.click(greed);
        expect(onChooseRoute).not.toHaveBeenCalled();
    });

    it('renders nothing when the projection has no active route decision', () => {
        const { view } = renderPanel(routeChoiceRun(), false);

        expect(view.container).toBeEmptyDOMElement();
    });
});
