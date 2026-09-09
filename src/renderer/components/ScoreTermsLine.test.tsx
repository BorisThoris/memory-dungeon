import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ScoreTermsLine, { SCORE_TERM_STEP_MS } from './ScoreTermsLine';
import { getBreakScoreBreakdown } from '../../shared/score-terms-rules';

const breakdown = () => getBreakScoreBreakdown({ level: 3, pairs: 4, tier: 'clean', waves: 3 })!;

describe('the break score built in front of the player', () => {
    it('arrives one term at a time, and the total climbs with them', () => {
        vi.useFakeTimers();
        try {
            const terms = breakdown();
            render(<ScoreTermsLine breakdown={terms} reduceMotion={false} />);
            const line = (): HTMLElement => screen.getByTestId('board-floater-score-terms');

            // The first beat is the pairs alone.
            expect(line()).toHaveAttribute('data-score-terms-revealed', '1');
            expect(line()).toHaveTextContent('4 pairs = ');
            expect(line()).not.toHaveTextContent('Clean');

            act(() => {
                vi.advanceTimersByTime(SCORE_TERM_STEP_MS);
            });
            expect(line()).toHaveAttribute('data-score-terms-revealed', '2');
            expect(line()).toHaveTextContent('4 pairs × Clean ×2 = ');

            act(() => {
                vi.advanceTimersByTime(SCORE_TERM_STEP_MS);
            });
            expect(line()).toHaveAttribute('data-score-terms-revealed', '3');
            expect(line()).toHaveTextContent('Ripple ×2.5');
            // The number it lands on is the score the rule awarded, not a rounding of it.
            expect(line()).toHaveTextContent(`= ${terms.total.toLocaleString()}`);
        } finally {
            vi.useRealTimers();
        }
    });

    it('shows the finished line at once when motion is reduced', () => {
        const terms = breakdown();
        render(<ScoreTermsLine breakdown={terms} reduceMotion />);

        const line = screen.getByTestId('board-floater-score-terms');
        expect(line).toHaveAttribute('data-score-terms-revealed', String(terms.terms.length));
        expect(line).toHaveTextContent(`= ${terms.total.toLocaleString()}`);
    });
});
