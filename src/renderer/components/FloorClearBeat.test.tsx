import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LevelResult } from '../../shared/contracts';
import FloorClearBeat from './FloorClearBeat';

const result: LevelResult = {
    level: 3,
    scoreGained: 2400,
    rating: 'A',
    perfect: false,
    mistakes: 2,
    parTurns: 5,
    turnsTaken: 3,
    playScore: 900,
    floorBonus: 1500 + 600,
    floorBonusTierMult: 5,
    floorEfficiencyBonus: 600,
    momentumBonusTier: 'fever'
};

describe('FloorClearBeat', () => {
    it('shows only the floor and payout, with nothing to press', () => {
        render(<FloorClearBeat personalBest={false} result={result} />);
        const beat = screen.getByTestId('floor-clear-beat');
        expect(beat).toHaveAttribute('role', 'status');
        expect(beat).toHaveAttribute('data-tier', 'fever');
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByTestId('floor-clear-title')).toHaveTextContent('Floor 3 cleared');
        expect(screen.queryByTestId('floor-clear-par')).toBeNull();
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+2,400');
        expect(beat).not.toHaveTextContent('Run total');
        expect(screen.queryByTestId('floor-clear-bonus')).toBeNull();
        expect(screen.queryByTestId('floor-clear-notes')).toBeNull();
        expect(screen.queryByTestId('floor-clear-personal-best')).toBeNull();
    });

    it('marks a new deepest floor without a receipt', () => {
        render(
            <FloorClearBeat
                personalBest
                result={{ ...result, parTurns: 4, turnsTaken: 6, floorBonus: 300, floorBonusTierMult: 1, floorEfficiencyBonus: undefined, momentumBonusTier: undefined }}
            />
        );
        expect(screen.getByTestId('floor-clear-beat')).toHaveAttribute('data-personal-best', 'true');
        expect(screen.getByTestId('floor-clear-personal-best')).toHaveTextContent('New deepest floor');
        expect(screen.queryByTestId('floor-clear-par')).toBeNull();
        expect(screen.queryByTestId('floor-clear-bonus')).toBeNull();
        expect(screen.queryByTestId('floor-clear-notes')).toBeNull();
    });

    it('keeps gold and elemental breakdowns out of the payoff', () => {
        render(<FloorClearBeat personalBest={false} result={{ ...result, goldEarned: 6, elementalDrops: { ember: 2 } }} />);
        expect(screen.queryByTestId('floor-clear-bonus')).toBeNull();
        expect(screen.queryByTestId('floor-clear-essence')).toBeNull();
        expect(screen.getByTestId('floor-clear-beat')).not.toHaveTextContent('Floor bonus');
    });

    it('says nothing it cannot read: a result from before the par has no par line or bonus line, and never NaN', () => {
        render(
            <FloorClearBeat
                personalBest={false}
                result={{ ...result, level: Number.POSITIVE_INFINITY, scoreGained: Number.NaN, parTurns: undefined, turnsTaken: undefined, floorBonus: undefined }}
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
