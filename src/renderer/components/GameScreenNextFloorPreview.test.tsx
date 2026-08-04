import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { GameScreenNextFloorPreview } from './GameScreenNextFloorPreview';
import { getGameScreenNextFloorProjection } from './gameScreenNextFloorProjection';

const completedRun = (gameMode: RunState['gameMode'] = 'endless'): RunState => {
    const base = createNewRun(0, {
        echoFeedbackEnabled: false,
        gameMode,
        runSeed: 42_001
    });
    return {
        ...base,
        relicOffer: null,
        status: 'levelComplete',
        lastLevelResult: {
            level: 1,
            scoreGained: 120,
            rating: 'S',
            livesRemaining: base.lives,
            perfect: true,
            mistakes: 0,
            clearLifeReason: 'none',
            clearLifeGained: 0
        }
    };
};

describe('GameScreenNextFloorPreview', () => {
    it('renders projected schedule facts without reconstructing their cues', () => {
        render(
            <GameScreenNextFloorPreview
                projection={getGameScreenNextFloorProjection(completedRun('endless'))}
            />
        );

        const strip = screen.getByTestId('floor-clear-next-signal-strip');
        expect(strip).toHaveAccessibleName(expect.stringContaining('Next floor preview signals. Floor: Speed Trial'));
        expect(strip).toHaveTextContent('Flip par');
        expect(strip.querySelector('[data-next-tone="reward"]')).toHaveAttribute(
            'data-next-audio',
            'next-floor-reward'
        );
        expect(strip.querySelector('[data-next-tone="reward"]')).toHaveAttribute('data-next-beats', '4');
        expect(strip.querySelectorAll('[data-next-tone="reward"] [data-next-beat]')).toHaveLength(4);
        expect(screen.getByText(/Choose a connected room to shape the next board/i)).toBeTruthy();
    });

    it('renders only cleared-node guidance when the mode has no endless schedule', () => {
        render(
            <GameScreenNextFloorPreview
                projection={getGameScreenNextFloorProjection(completedRun('meditation'))}
            />
        );

        expect(screen.queryByTestId('floor-clear-next-signal-strip')).toBeNull();
        expect(screen.getByText(/Cleared node:/i)).toBeTruthy();
    });

    it('renders nothing for an inactive projection', () => {
        const { container } = render(<GameScreenNextFloorPreview projection={null} />);

        expect(container).toBeEmptyDOMElement();
    });
});
