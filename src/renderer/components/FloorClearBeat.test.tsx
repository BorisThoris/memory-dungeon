import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LevelResult } from '../../shared/contracts';
import FloorClearBeat from './FloorClearBeat';

const result: LevelResult = {
    level: 3,
    scoreGained: 2400,
    rating: 'A',
    livesRemaining: 4,
    perfect: false,
    mistakes: 2,
    clearLifeReason: 'none',
    clearLifeGained: 0,
    parTurns: 5,
    turnsTaken: 3,
    playScore: 900,
    floorBonus: 1500 + 600,
    floorBonusTierMult: 5,
    floorEfficiencyBonus: 600,
    momentumBonusTier: 'fever'
};

describe('FloorClearBeat', () => {
    it('is a status, not a dialog: nothing to press, four things said', () => {
        render(<FloorClearBeat notes={[]} personalBest={false} result={result} totalScore={12_340} />);
        const beat = screen.getByTestId('floor-clear-beat');
        expect(beat).toHaveAttribute('role', 'status');
        expect(beat).toHaveAttribute('data-tier', 'fever');
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByTestId('floor-clear-title')).toHaveTextContent('Floor 3 cleared');
        expect(screen.getByTestId('floor-clear-par')).toHaveTextContent('3 turns, par 5');
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+2,400');
        expect(beat).toHaveTextContent('Run total 12,340');
        expect(screen.getByTestId('floor-clear-bonus')).toHaveTextContent('Floor bonus +2,100: Fever ×5 · 2 under par +600.');
        expect(screen.queryByTestId('floor-clear-notes')).toBeNull();
        expect(screen.queryByTestId('floor-clear-personal-best')).toBeNull();
    });

    it('marks a new deepest floor and lists the notes it was given', () => {
        render(
            <FloorClearBeat
                notes={['Perfect floor bonus: +1 Life', 'Flip par: Complete (+30 score)']}
                personalBest
                result={{ ...result, parTurns: 4, turnsTaken: 6, floorBonus: 300, floorBonusTierMult: 1, floorEfficiencyBonus: undefined, momentumBonusTier: undefined }}
                totalScore={300}
            />
        );
        expect(screen.getByTestId('floor-clear-beat')).toHaveAttribute('data-personal-best', 'true');
        expect(screen.getByTestId('floor-clear-personal-best')).toHaveTextContent('New deepest floor');
        expect(screen.getByTestId('floor-clear-par')).toHaveTextContent('6 turns, par 4');
        expect(screen.getByTestId('floor-clear-bonus')).toHaveTextContent('Floor bonus +300: cleared cold.');
        const notes = screen.getByTestId('floor-clear-notes');
        expect(notes).toHaveTextContent('Perfect floor bonus: +1 Life');
        expect(notes).toHaveTextContent('Flip par: Complete (+30 score)');
    });

    it('says nothing it cannot read: a result from before the par has no par line or bonus line, and never NaN', () => {
        render(
            <FloorClearBeat
                notes={[]}
                personalBest={false}
                result={{ ...result, level: Number.POSITIVE_INFINITY, scoreGained: Number.NaN, parTurns: undefined, turnsTaken: undefined, floorBonus: undefined }}
                totalScore={Number.NaN}
            />
        );
        const beat = screen.getByTestId('floor-clear-beat');
        expect(beat).not.toHaveTextContent(/NaN|Infinity/);
        expect(screen.getByTestId('floor-clear-title')).toHaveTextContent('Floor 0 cleared');
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+0');
        expect(screen.queryByTestId('floor-clear-par')).toBeNull();
        expect(screen.queryByTestId('floor-clear-bonus')).toBeNull();
    });
});
