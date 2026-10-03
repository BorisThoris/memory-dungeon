import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import { FloorJourney } from './FloorJourney';

describe('between-floor continuity', () => {
    it('keeps the actual earned rewards separate from the remaining purse after buying', () => {
        const run = { ...createNewRun(0), gold: 1, elementalEssence: { tide: 0 },
            lastLevelResult: { level: 3, scoreGained: 2400, rating: 'A' as const, perfect: false, mistakes: 2,
                goldEarned: 7, elementalDrops: { tide: 2 }, realmId: 'ember' as const, realmSmoke: 2 } };
        const { rerender } = render(<FloorJourney run={run} phase="forge" />);
        expect(screen.getByTestId('floor-journey')).toHaveTextContent('+7 gold earned');
        expect(screen.getByTestId('floor-journey')).toHaveTextContent('+2 Water essence');
        expect(screen.getByTestId('floor-journey')).toHaveTextContent('24% shorter');
        expect(screen.getByTestId('floor-journey')).toHaveTextContent('Floor 4 ahead');
        rerender(<FloorJourney run={run} phase="route" />);
        expect(screen.getByTestId('floor-journey')).toHaveTextContent('Choose your next arena');
        expect(screen.getByTestId('floor-journey')).toHaveTextContent('+7 gold earned');
    });
});
