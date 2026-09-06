import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import type { RunState } from '../../shared/contracts';
import RunShell, { type RunShellTool } from './RunShell';

const playingRun = (): RunState => finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));

const tool = (overrides: Partial<RunShellTool> & { id: string }): RunShellTool => ({
    label: overrides.id,
    glyph: <svg />,
    onClick: vi.fn(),
    ...overrides
});

describe('RunShell', () => {
    it('renders the five run numbers as one stats group', () => {
        const run = playingRun();
        render(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={run} tools={[]} />);

        const stats = screen.getByRole('group', { name: /run stats/i });
        expect(within(stats).getByTestId('hud-floor')).toHaveTextContent(/floor/i);
        expect(within(stats).getByTestId('hud-lives')).toHaveTextContent(/lives/i);
        expect(within(stats).getByTestId('hud-score')).toHaveTextContent(/score/i);
        expect(within(stats).getByTestId('hud-combo-shards')).toHaveTextContent(/shards/i);
        expect(within(stats).getByTestId('hud-chain')).toHaveTextContent(/chain/i);
        // Guards, the clock and mutators only appear when they carry a value.
        expect(screen.queryByTestId('hud-guards')).not.toBeInTheDocument();
        expect(screen.queryByTestId('hud-gauntlet-timer')).not.toBeInTheDocument();
    });

    it('explains the chain tier from momentum, so a Sharp read on a x3 chain is not a mystery', () => {
        const base = playingRun();
        const run: RunState = {
            ...base,
            board: { ...base.board!, pairCount: 12 },
            chunkPairsThisChain: 2,
            stats: { ...base.stats, currentStreak: 3 }
        };
        render(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={run} tools={[]} />);

        const chain = within(screen.getByTestId('hud-chain')).getByText(/×3/);
        // Twelve pairs: Sharp from 5, Fever from 8. A chain of 3 plus 2 cascaded pairs is Sharp.
        expect(chain).toHaveAttribute('data-chain-tier', 'sharp');
        expect(chain).toHaveTextContent(/Sharp/);
        expect(chain).toHaveAttribute('title', expect.stringMatching(/momentum 5/));
        expect(chain).toHaveAttribute('title', expect.stringMatching(/Sharp from 5, Fever from 8/));
        // The meter reads the same ladder: momentum 5 of 8, Sharp, not yet full.
        const meter = screen.getByTestId('hud-chain-meter');
        expect(meter).toHaveAttribute('data-chain-tier', 'sharp');
        expect(meter).toHaveAttribute('data-meter-fill', '0.625');
        expect(meter).toHaveAttribute('data-meter-full', 'false');
        expect(meter).toHaveAttribute('aria-label', 'Fever meter: momentum 5 of 8.');
    });

    it('drains the meter for a beat when a chain of Clean or better drops to nothing', () => {
        vi.useFakeTimers();
        try {
            const base = playingRun();
            const chained: RunState = {
                ...base,
                board: { ...base.board!, pairCount: 12 },
                stats: { ...base.stats, currentStreak: 4 }
            };
            const { rerender } = render(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={chained} tools={[]} />);
            expect(screen.getByTestId('hud-chain-meter')).toHaveAttribute('data-meter-drop', 'false');
            rerender(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={{ ...chained, stats: { ...chained.stats, currentStreak: 0 } }} tools={[]} />);
            act(() => {
                vi.advanceTimersByTime(1);
            });
            expect(screen.getByTestId('hud-chain-meter')).toHaveAttribute('data-meter-drop', 'true');
            act(() => {
                vi.advanceTimersByTime(800);
            });
            expect(screen.getByTestId('hud-chain-meter')).toHaveAttribute('data-meter-drop', 'false');
        } finally {
            vi.useRealTimers();
        }
    });

    it('fills the Fever meter and keeps it full past the rung', () => {
        const base = playingRun();
        const run: RunState = {
            ...base,
            board: { ...base.board!, pairCount: 12 },
            chunkPairsThisChain: 4,
            stats: { ...base.stats, currentStreak: 6 }
        };
        render(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={run} tools={[]} />);
        const meter = screen.getByTestId('hud-chain-meter');
        expect(meter).toHaveAttribute('data-meter-full', 'true');
        expect(meter).toHaveAttribute('data-meter-fill', '1.000');
        expect(meter).toHaveAttribute('aria-label', 'Fever meter full: momentum 10.');
    });

    it('names the run mode, so a Practice run is not mistaken for a Classic one', () => {
        const { rerender } = render(
            <RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={playingRun()} tools={[]} />
        );
        expect(screen.getByTestId('hud-mode-identity')).toHaveTextContent(/Classic Dungeon/i);

        const practice = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, practiceMode: true }));
        rerender(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={practice} tools={[]} />);
        const identity = screen.getByTestId('hud-mode-identity');
        expect(identity).toHaveTextContent(/Practice/i);
        expect(identity).toHaveTextContent(/Achievements off/i);
    });

    it('says whether the run can still earn perfect memory, and strikes it out once it cannot', () => {
        const { rerender } = render(
            <RunShell gauntletRemainingMs={null} onPause={vi.fn()} perfectMemory="eligible" run={playingRun()} tools={[]} />
        );
        expect(screen.getByTestId('hud-perfect-memory')).toHaveTextContent(/Eligible/i);

        rerender(
            <RunShell gauntletRemainingMs={null} onPause={vi.fn()} perfectMemory="locked" run={playingRun()} tools={[]} />
        );
        expect(screen.getByTestId('hud-perfect-memory')).toHaveTextContent(/Locked/i);
    });

    it('leaves the bar alone when perfect memory is not live stakes for this run', () => {
        render(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} perfectMemory={null} run={playingRun()} tools={[]} />);

        expect(screen.queryByTestId('hud-perfect-memory')).not.toBeInTheDocument();
    });

    it('keeps the mode identity out of the numbers group, which stays a row of numbers', () => {
        render(<RunShell gauntletRemainingMs={null} onPause={vi.fn()} run={playingRun()} tools={[]} />);

        const stats = screen.getByRole('group', { name: /run stats/i });
        expect(within(stats).queryByTestId('hud-mode-identity')).not.toBeInTheDocument();
    });

    it('shows the gauntlet clock only when a gauntlet is running', () => {
        render(<RunShell gauntletRemainingMs={95_000} onPause={vi.fn()} run={playingRun()} tools={[]} />);

        expect(screen.getByRole('timer')).toHaveTextContent('1:35');
    });

    it('carries one line: feedback first, then the first-run instruction, then the objective', () => {
        const run = playingRun();
        const { rerender } = render(
            <RunShell
                feedback="Match resolved."
                gauntletRemainingMs={null}
                onboardingLine="Flip a marked tile"
                onPause={vi.fn()}
                run={run}
                tools={[]}
            />
        );
        expect(screen.getByTestId('run-shell-line')).toHaveTextContent('Match resolved.');

        rerender(
            <RunShell gauntletRemainingMs={null} onboardingLine="Flip a marked tile" onPause={vi.fn()} run={run} tools={[]} />
        );
        expect(screen.getByTestId('run-shell-line')).toHaveTextContent('Flip a marked tile');
        expect(screen.getByTestId('run-shell-line')).toHaveAttribute('data-run-shell-line-tone', 'info');
    });

    it('docks only the tools that have charges or are armed, plus the menu', async () => {
        const user = userEvent.setup();
        const onPause = vi.fn();
        const armed = tool({ id: 'pin', armed: true });
        const spent = tool({ id: 'peek', charges: 0 });
        const ready = tool({ id: 'shuffle', charges: 2 });
        render(<RunShell gauntletRemainingMs={null} onPause={onPause} run={playingRun()} tools={[armed, spent, ready]} />);

        const dock = screen.getByRole('toolbar', { name: /game controls/i });
        expect(within(dock).getByTestId('tool-pin')).toHaveAttribute('aria-pressed', 'true');
        expect(within(dock).getByTestId('tool-shuffle')).toHaveTextContent('2');
        expect(within(dock).queryByTestId('tool-peek')).not.toBeInTheDocument();

        await user.click(within(dock).getByRole('button', { name: /pause and open the run menu/i }));
        expect(onPause).toHaveBeenCalledTimes(1);
    });
});
