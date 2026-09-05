import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LevelResult } from '../../shared/contracts';
import FloorClearDialog, { type FloorClearDialogProps, type FloorClearRouteOption } from './FloorClearDialog';

const result: LevelResult = {
    level: 3,
    scoreGained: 240,
    rating: 'A',
    livesRemaining: 4,
    perfect: false,
    mistakes: 2,
    clearLifeReason: 'none',
    clearLifeGained: 0
};

const doors: FloorClearRouteOption[] = [
    {
        id: 'r:safe',
        routeType: 'safe',
        label: 'Safe passage',
        room: 'Rest',
        glyph: 'S',
        reward: 'Recover 1 life if wounded.',
        risk: 'None.',
        available: true
    },
    {
        id: 'r:greed',
        routeType: 'greed',
        label: 'Greedy route',
        room: 'Treasure',
        glyph: 'G',
        reward: '+3 shop gold and +35 score.',
        risk: '-1 life.',
        available: false,
        unavailableLabel: 'Unavailable at 1 life'
    },
    {
        id: 'r:mystery',
        routeType: 'mystery',
        label: 'Mystery route',
        room: 'Keeper Chamber via Mystery route',
        approachLabel: 'Mystery route',
        glyph: 'M',
        reward: 'Deterministic local reward.',
        risk: 'Unknown board.',
        available: true
    }
];

const renderDialog = (overrides: Partial<FloorClearDialogProps> = {}) => {
    const props: FloorClearDialogProps = {
        actions: [{ label: 'Continue', onClick: vi.fn(), variant: 'primary' }],
        bestStreak: 6,
        lifeBonusLine: null,
        objectiveLine: null,
        onArmWager: vi.fn(),
        onChooseRoute: vi.fn(),
        residentLine: null,
        result,
        routeIntro: 'Pick one door to continue.',
        routeOptions: [],
        routeRequired: false,
        selectedRoute: null,
        totalScore: 1240,
        wager: null,
        ...overrides
    };
    render(<FloorClearDialog {...props} />);
    return props;
};

describe('FloorClearDialog', () => {
    it('names who is on the next floor before the stairs are taken', () => {
        renderDialog({ residentLine: 'Downstairs: A hoarding rat. It has been collecting.' });
        expect(screen.getByTestId('floor-clear-resident')).toHaveTextContent(/a hoarding rat/i);
    });

    it('leaves the notes list out entirely when there is nothing to note', () => {
        renderDialog();
        expect(screen.queryByTestId('floor-clear-notes')).not.toBeInTheDocument();
    });

    it('states the floor score, run total and four stats once', () => {
        renderDialog();
        expect(screen.getByRole('dialog', { name: /floor cleared/i })).toHaveTextContent('Floor 3');
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+240');
        expect(screen.getByText(/run total 1,240/i)).toBeInTheDocument();
        const stats = screen.getByTestId('floor-clear-stats');
        expect(stats).toHaveTextContent(/Rating\s*A/);
        expect(stats).toHaveTextContent(/Best streak\s*6/);
        expect(stats).toHaveTextContent(/Misses\s*2/);
        expect(stats).toHaveTextContent(/Lives\s*4/);
        expect(screen.queryByTestId('floor-clear-notes')).toBeNull();
        expect(screen.queryByTestId('route-choice-panel')).toBeNull();
    });

    it('renders one door per route, disables the locked one, and reports the chosen id', async () => {
        const user = userEvent.setup();
        const props = renderDialog({ routeOptions: doors, routeRequired: true });

        expect(screen.getByTestId('floor-clear-result-stack')).toHaveAttribute('data-route-choice-required', 'true');
        expect(screen.getByTestId('route-choice-panel')).toHaveAttribute('data-decision-state', 'required');
        expect(screen.getByTestId('route-choice-required-copy')).toHaveTextContent('Pick one door to continue.');

        const greed = screen.getByTestId('route-choice-greed');
        expect(greed).toBeDisabled();
        expect(greed).toHaveTextContent('Unavailable at 1 life');
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent('Approach: Mystery route');
        expect(screen.getByRole('button', { name: /^Safe passage\. Rest\. Reward: Recover 1 life if wounded\. Risk: None\.$/ })).toBeEnabled();

        await user.click(screen.getByTestId('route-choice-safe'));
        expect(props.onChooseRoute).toHaveBeenCalledWith('r:safe');
        await user.click(greed);
        expect(props.onChooseRoute).toHaveBeenCalledTimes(1);
    });

    it('shows the locked route as one line once a door is chosen', () => {
        renderDialog({ selectedRoute: { routeType: 'greed', label: 'Greedy route', line: 'The next floor adds richer caches.' } });
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-type', 'greed');
        expect(screen.getByTestId('route-selected-note')).toHaveTextContent('Greedy route selected. The next floor adds richer caches.');
    });

    it('lists the life bonus and objective outcome as notes', () => {
        renderDialog({ lifeBonusLine: 'Clean floor bonus: +1 Life', objectiveLine: 'Flip par: Complete (+30 score) · +1 Favor' });
        const notes = screen.getByTestId('floor-clear-notes');
        expect(notes).toHaveTextContent('Clean floor bonus: +1 Life');
        expect(notes).toHaveTextContent('Flip par: Complete (+30 score) · +1 Favor');
    });

    it('offers the wager with one line and one button, then shows it armed', async () => {
        const user = userEvent.setup();
        const props = renderDialog({ wager: { armed: false, bonusFavor: 2, streakAtRisk: 3, suretyActive: false } });
        expect(screen.getByTestId('endless-risk-wager-panel')).toHaveTextContent(
            'Stake your x3 objective streak on the next floor for +2 Favor.'
        );
        await user.click(screen.getByRole('button', { name: /^arm wager\./i }));
        expect(props.onArmWager).toHaveBeenCalledTimes(1);

        render(
            <FloorClearDialog {...props} wager={{ armed: true, bonusFavor: 2, streakAtRisk: 3, suretyActive: true }} />
        );
        const armed = screen.getAllByTestId('endless-risk-wager-panel').at(-1)!;
        expect(armed).toHaveAttribute('data-armed', 'true');
        expect(armed).toHaveTextContent('a miss drops the x3 streak');
        expect(screen.getAllByRole('button', { name: /arm wager/i })).toHaveLength(1);
    });
});
