import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUN_END_FLOURISH_MS, RUN_END_REPLAY_HOLD_MS, RUN_END_REPLAY_STEP_MS, RUN_END_VERDICT_MS, RunEndCinematic } from './RunEndCinematic';
import { comboHeatThemeForSeed } from '../../shared/combo-heat-rules';
import { runEndComboReplay, RUN_END_REPLAY_MAX_STAMPS } from '../copy/runEndStamp';
import type { RunEndStampAction } from './RunEndStamp';

const actions = (onPlay = vi.fn(), onRecord = vi.fn()): RunEndStampAction[] => [
    { id: 'play-again', label: 'PLAY AGAIN', ariaLabel: 'Play Again - start a new run after this expedition', onClick: onPlay },
    { id: 'main-menu', label: 'MAIN MENU', ariaLabel: 'Return to the main menu', onClick: vi.fn() },
    { id: 'record', label: 'THE RECORD', ariaLabel: 'The record - see the run in numbers', onClick: onRecord }
];

describe('the end as a cut-scene', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('plasters the verdict, replays the best combo, then the flourish, then the choices, on its own clock', () => {
        render(
            <RunEndCinematic actions={actions()} personalBest="beaten" reason="miss_budget" reduceMotion={false} runSeed={14} summary={{ totalScore: 12_345, highestLevel: 9, bestStreak: 12 }} />
        );
        const stage = screen.getByTestId('run-end-cinematic');
        expect(stage).toHaveAttribute('data-phase', 'verdict');
        expect(stage).toHaveAttribute('data-temper', 'frost');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('JOURNEY OVER');
        expect(screen.queryByTestId('game-over-end-reason')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
        act(() => vi.advanceTimersByTime(RUN_END_VERDICT_MS + 5));
        // A best combo of 12 earned Hot and Blazing: both are stamped again, in the run's words.
        const frost = comboHeatThemeForSeed(14);
        expect(stage).toHaveAttribute('data-phase', 'replay');
        expect(screen.getByTestId('run-end-cinematic-replay')).toHaveTextContent('Best combo ×12');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(frost.callouts.hot);
        act(() => vi.advanceTimersByTime(RUN_END_REPLAY_STEP_MS + 5));
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(frost.callouts.blazing);
        act(() => vi.advanceTimersByTime(RUN_END_REPLAY_HOLD_MS + 5));
        // A record still gets its own stamp after the replay.
        expect(stage).toHaveAttribute('data-phase', 'flourish');
        expect(screen.getByTestId('run-end-cinematic-flourish')).toHaveTextContent('NEW RECORD!');
        act(() => vi.advanceTimersByTime(RUN_END_FLOURISH_MS + 5));
        expect(stage).toHaveAttribute('data-phase', 'choices');
        expect(screen.getAllByRole('button')).toHaveLength(3);
        // The verdict is held small above the choices, with the reason still on it.
        expect(screen.getByTestId('run-end-cinematic-held')).toHaveTextContent('JOURNEY OVER');
        expect(screen.queryByTestId('game-over-end-reason')).toBeNull();
    });

    it('skips straight to the choices on a press, and never on Escape', () => {
        const onRecord = vi.fn();
        render(
            <RunEndCinematic actions={actions(vi.fn(), onRecord)} personalBest={null} reason="quit" reduceMotion={false} runSeed={90_210} summary={{ totalScore: 0, highestLevel: 2, bestStreak: 0 }} />
        );
        const stage = screen.getByTestId('run-end-cinematic');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(stage).toHaveAttribute('data-phase', 'verdict');
        fireEvent.pointerDown(stage);
        expect(stage).toHaveAttribute('data-phase', 'choices');
        fireEvent.click(screen.getByTestId('run-end-cinematic-record'));
        expect(onRecord).toHaveBeenCalledTimes(1);
        // A quiet run has no flourish, so the verdict would have gone straight to the choices.
        expect(screen.queryByTestId('run-end-cinematic-flourish')).toBeNull();
    });

    it('lets the replay name the heat, so a hot run without a record goes from the replay to the choices', () => {
        const onReplayStamp = vi.fn();
        render(
            <RunEndCinematic actions={actions()} onReplayStamp={onReplayStamp} personalBest={null} reason="miss_budget" reduceMotion={false} runSeed={90_210} summary={{ totalScore: 50, highestLevel: 6, bestStreak: 30 }} />
        );
        expect(onReplayStamp).not.toHaveBeenCalled();
        const stage = screen.getByTestId('run-end-cinematic');
        act(() => vi.advanceTimersByTime(RUN_END_VERDICT_MS + 5));
        expect(stage).toHaveAttribute('data-phase', 'replay');
        for (let step = 0; step < 3; step += 1) act(() => vi.advanceTimersByTime(RUN_END_REPLAY_STEP_MS + 5));
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(comboHeatThemeForSeed(90_210).callouts.legendary);
        act(() => vi.advanceTimersByTime(RUN_END_REPLAY_HOLD_MS + 5));
        expect(stage).toHaveAttribute('data-phase', 'choices');
        expect(screen.queryByTestId('run-end-cinematic-flourish')).toBeNull();
        // One sting per replayed stamp, climbing the stages: Hot, Blazing, Inferno, Legendary.
        expect(onReplayStamp.mock.calls.map(([replayed]) => replayed)).toEqual([2, 3, 4, 5]);
    });

    it("keeps a long combo's replay a beat: its first ascensions and its last", () => {
        const temper = comboHeatThemeForSeed(90_210);
        expect(runEndComboReplay(5, temper)).toEqual([]);
        expect(runEndComboReplay(6, temper).map((stamp) => stamp.text)).toEqual([temper.callouts.hot]);
        const long = runEndComboReplay(25 + 25 * 40, temper);
        expect(long).toHaveLength(RUN_END_REPLAY_MAX_STAMPS);
        expect(long.at(-1)!.text).toContain('XLI');
        expect(long.at(-2)!.text).toContain(' II!');
    });

    it('opens on the choices under reduced motion, verdict held above them', () => {
        render(
            <RunEndCinematic actions={actions()} personalBest={null} reason="contract" reduceMotion runSeed={30} summary={{ totalScore: 10, highestLevel: 3, bestStreak: 3 }} />
        );
        expect(screen.getByTestId('run-end-cinematic')).toHaveAttribute('data-phase', 'choices');
        expect(screen.getByTestId('run-end-cinematic-held')).toHaveTextContent('CONTRACT SEALED');
        expect(screen.getByRole('button', { name: 'Play Again - start a new run after this expedition' })).toBeInTheDocument();
    });
});
