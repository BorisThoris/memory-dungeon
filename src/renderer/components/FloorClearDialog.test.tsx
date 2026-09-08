import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LevelResult } from '../../shared/contracts';
import FloorClearDialog, { type FloorClearDialogProps } from './FloorClearDialog';

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

const renderDialog = (overrides: Partial<FloorClearDialogProps> = {}) => {
    const props: FloorClearDialogProps = {
        actions: [{ label: 'Continue', onClick: vi.fn(), variant: 'primary' }],
        bestStreak: 6,
        lifeBonusLine: null,
        objectiveLine: null,
        residentLine: null,
        result,
        totalScore: 1240,
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

    it('recaps the chain and names Extreme Fever with what it paid', () => {
        renderDialog({
            result: {
                ...result,
                bestChain: 6,
                chunkBreaks: 2,
                chunkPairsBroken: 5,
                feverBreaks: 1,
                chainMomentumAtClear: 9,
                momentumBonusTier: 'fever',
                momentumBonusShards: 1
            }
        });
        const chain = screen.getByTestId('floor-clear-chain');
        expect(chain).toHaveTextContent('Best chain ×6 · 2 chunks, 5 pairs cascaded · Fever ×1 · Extreme Fever at momentum 9: +1 shard.');
        expect(chain).toHaveAttribute('data-tone', 'reward');
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



    it('lists the life bonus and objective outcome as notes', () => {
        renderDialog({ lifeBonusLine: 'Clean floor bonus: +1 Life', objectiveLine: 'Flip par: Complete (+30 score) · +1 Favor' });
        const notes = screen.getByTestId('floor-clear-notes');
        expect(notes).toHaveTextContent('Clean floor bonus: +1 Life');
        expect(notes).toHaveTextContent('Flip par: Complete (+30 score) · +1 Favor');
    });

});
