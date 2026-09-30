import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RunEndStamp, type RunEndStampAction } from './RunEndStamp';
import { RUN_END_VERDICT, RUN_END_VERDICT_UNKNOWN, runEndFlourish, runEndVerdict } from '../copy/runEndStamp';

const actions = (onPlay = vi.fn(), onMenu = vi.fn()): RunEndStampAction[] => [
    { id: 'play-again', label: 'PLAY AGAIN', ariaLabel: 'Play Again - start a new run after this expedition', onClick: onPlay },
    { id: 'main-menu', label: 'MAIN MENU', ariaLabel: 'Return to the main menu', onClick: onMenu }
];

describe('the run, stamped', () => {
    it('stamps a verdict word for every way a run ends, and the old title when the reason is unknown', () => {
        expect(runEndVerdict('miss_budget')).toBe('JOURNEY OVER');
        expect(runEndVerdict('quit')).toBe('UNTIL NEXT TIME');
        expect(runEndVerdict(null)).toBe(RUN_END_VERDICT_UNKNOWN);
        for (const word of Object.values(RUN_END_VERDICT)) expect(word).toMatch(/^[A-Z' ]+$/);
        // Never a verdict on the player.
        for (const word of Object.values(RUN_END_VERDICT)) expect(word).not.toMatch(/FAIL|LOSE|LOST|DEAD|DIED/);
    });

    it('flourishes a record over a hot run, and a hot run by the heat its best chain reached', () => {
        expect(runEndFlourish({ bestStreak: 30 }, 'beaten')).toEqual({ text: 'NEW RECORD!', tone: 'gold' });
        expect(runEndFlourish({ bestStreak: 30 }, null)?.text).toBe('LEGENDARY RUN');
        expect(runEndFlourish({ bestStreak: 16 }, 'matched')?.text).toBe('INFERNO RUN');
        expect(runEndFlourish({ bestStreak: 10 }, null)?.text).toBe('BLAZING RUN');
        expect(runEndFlourish({ bestStreak: 9 }, null)).toBeNull();
    });

    it('is the page heading and real buttons, in the run temper, pressable', () => {
        const onPlay = vi.fn();
        const onMenu = vi.fn();
        render(
            <RunEndStamp
                actions={actions(onPlay, onMenu)}
                personalBest="beaten"
                reason="miss_budget"
                reduceMotion={false}
                runSeed={14}
                summary={{ totalScore: 12_345, highestLevel: 9, bestStreak: 12 }}
            />
        );
        expect(screen.getByRole('heading', { level: 1, name: 'JOURNEY OVER' })).toBeInTheDocument();
        expect(screen.getByTestId('run-end-score-line')).toHaveTextContent('12,345 · Floor 9');
        expect(screen.getByTestId('run-end-flourish')).toHaveTextContent('NEW RECORD!');
        // Seed 14 is a frost run: the stamp carries the temper.
        expect(screen.getByTestId('run-end-stamp')).toHaveAttribute('data-temper', 'frost');
        expect(screen.getByTestId('run-end-stamp')).toHaveAttribute('data-tone', 'miss');
        fireEvent.click(screen.getByRole('button', { name: 'Play Again - start a new run after this expedition' }));
        fireEvent.click(screen.getByRole('button', { name: 'Return to the main menu' }));
        expect(onPlay).toHaveBeenCalledTimes(1);
        expect(onMenu).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('run-end-stamp-play-again')).toHaveTextContent('PLAY AGAIN');
    });

    it('holds still under reduced motion and shows no flourish for a quiet run', () => {
        render(
            <RunEndStamp actions={actions()} personalBest={null} reason="quit" reduceMotion runSeed={90_210} summary={{ totalScore: 0, highestLevel: 1, bestStreak: 2 }} />
        );
        expect(screen.getByTestId('run-end-stamp')).toHaveAttribute('data-reduce-motion', 'true');
        expect(screen.queryByTestId('run-end-flourish')).toBeNull();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('UNTIL NEXT TIME');
    });
});
