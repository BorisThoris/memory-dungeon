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
    it('renders the four run numbers as one stats group, with no hearts among them', () => {
        const run = playingRun();
        render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={run} tools={[]} />);

        const stats = screen.getByRole('group', { name: /run stats/i });
        expect(within(stats).getByTestId('hud-floor')).toHaveTextContent(/floor/i);
        expect(within(stats).getByTestId('hud-score')).toHaveTextContent(/score/i);
        expect(within(stats).getByTestId('hud-par')).toHaveTextContent(/par/i);
        expect(within(stats).getByTestId('hud-chain')).toHaveTextContent(/chain/i);
        // There are no lives (Gen 183): no hearts, no life count, and the mutator stat only
        // appears when it carries a value; there is no clock to show.
        expect(stats).not.toHaveTextContent(/lives|\u2665/i);
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('says what the rung the player is standing on pays, and grows it as they climb', () => {
        // The meter said where they were on the ladder and never what being there bought
        // (thesis §30.3a). The number is the multiplier a break at this rung is scored with -
        // Gen 186 showed the pairs a rung finds, which reads as a dead middle rung because Sharp
        // finds a third of a pair more than Clean and pays twice as much for each of them.
        const base = playingRun();
        const cold: RunState = { ...base, board: { ...base.board!, pairCount: 12 } };
        const { rerender } = render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={cold} tools={[]} />);

        const rungAt = (): HTMLElement => screen.getByTestId('hud-chain-rung-value');
        expect(rungAt()).toHaveAttribute('data-chain-tier', 'none');
        expect(rungAt()).toHaveAttribute('data-rung-multiplier', '1');
        expect(rungAt()).toHaveTextContent('×1');
        expect(rungAt().getAttribute('aria-label')).toMatch(
            /^A match with no chain takes about \d+ pairs? and pays ×1 for each\.$/
        );

        // Twelve pairs: Sharp from 5, Fever from 7. A Fever break is scored at eight times a pop.
        const hot: RunState = { ...cold, stats: { ...cold.stats, currentStreak: 9 } };
        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={hot} tools={[]} />);
        expect(rungAt()).toHaveAttribute('data-chain-tier', 'fever');
        expect(rungAt()).toHaveTextContent('×8');
        expect(Number(rungAt().getAttribute('data-rung-multiplier'))).toBeGreaterThan(1);

        // The meter's own label carries it too, so a screen reader is told the same thing.
        expect(within(screen.getByTestId('hud-chain')).getByTestId('hud-chain-meter')).toHaveAttribute(
            'aria-label',
            expect.stringContaining('A Fever break takes about')
        );
    });

    it('reads the ceiling on the par, and marks it once the floor is two turns from it', () => {
        // Twelve pairs: par 5, ceiling 15. The pressure of thesis §43 lives on the par stat.
        const base = playingRun();
        const calm: RunState = { ...base, board: { ...base.board!, pairCount: 12 }, turnsThisFloor: 4 };
        const { rerender } = render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={calm} tools={[]} />);

        const par = screen.getByTestId('hud-par');
        expect(within(par).getByRole('img')).toHaveAttribute('aria-label', '4 of 5 turns, ceiling 15');
        expect(par).toHaveTextContent('4 / 5');
        expect(par).not.toHaveAttribute('data-ceiling-near');

        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...calm, turnsThisFloor: 13 }} tools={[]} />);
        expect(screen.getByTestId('hud-par')).toHaveAttribute('data-ceiling-near', 'true');
        expect(within(screen.getByTestId('hud-par')).getByRole('img')).toHaveAttribute(
            'aria-label',
            '13 of 5 turns, ceiling 15'
        );
    });

    it('explains the chain tier from momentum, so a Sharp read on a x3 chain is not a mystery', () => {
        const base = playingRun();
        const run: RunState = {
            ...base,
            board: { ...base.board!, pairCount: 12 },
            chunkPairsThisChain: 3,
            stats: { ...base.stats, currentStreak: 3 }
        };
        render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={run} tools={[]} />);

        const chain = within(screen.getByTestId('hud-chain')).getByText(/×3/);
        // Twelve pairs: Sharp from 6, Fever from 8. A chain of 3 plus 3 cascaded pairs is Sharp.
        expect(chain).toHaveAttribute('data-chain-tier', 'sharp');
        expect(chain).toHaveTextContent(/Sharp/);
        expect(chain).toHaveAttribute('title', expect.stringMatching(/momentum 6/));
        expect(chain).toHaveAttribute('title', expect.stringMatching(/Sharp from 6 runs the reaction into the clump next door, Fever from 8/));
        // The meter reads the same ladder: momentum 6 of 8, Sharp, not yet full.
        const meter = screen.getByTestId('hud-chain-meter');
        expect(meter).toHaveAttribute('data-chain-tier', 'sharp');
        expect(meter).toHaveAttribute('data-meter-fill', '0.750');
        expect(meter).toHaveAttribute('data-meter-full', 'false');
        expect(meter).toHaveAttribute('aria-label', expect.stringContaining('Fever meter: momentum 6 of 8.'));
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
            const { rerender } = render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={chained} tools={[]} />);
            expect(screen.getByTestId('hud-chain-meter')).toHaveAttribute('data-meter-drop', 'false');
            rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...chained, stats: { ...chained.stats, currentStreak: 0 } }} tools={[]} />);
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
        render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={run} tools={[]} />);
        const meter = screen.getByTestId('hud-chain-meter');
        expect(meter).toHaveAttribute('data-meter-full', 'true');
        expect(meter).toHaveAttribute('data-meter-fill', '1.000');
        expect(meter).toHaveAttribute('aria-label', expect.stringContaining('Fever meter full: momentum 10.'));
    });

    it('marks the Floor stat as a personal best only when told the run is the deepest yet', () => {
        const { rerender } = render(
            <RunShell onPause={vi.fn()} personalBestDepth={false} run={playingRun()} tools={[]} />
        );
        expect(screen.queryByTestId('hud-personal-best')).not.toBeInTheDocument();
        expect(screen.getByTestId('hud-floor')).not.toHaveAttribute('data-personal-best');

        rerender(<RunShell onPause={vi.fn()} personalBestDepth run={playingRun()} tools={[]} />);
        const floor = screen.getByTestId('hud-floor');
        expect(floor).toHaveAttribute('data-personal-best', 'true');
        expect(within(floor).getByTestId('hud-personal-best')).toHaveTextContent('Best');
        expect(within(floor).getByRole('img', { name: /deepest floor yet/i })).toBeInTheDocument();
    });

    it('carries nothing about which run this is: the mode and the perfect-memory stakes live in the pause menu', () => {
        render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={playingRun()} tools={[]} />);

        expect(screen.getByTestId('game-hud')).not.toHaveTextContent(/Classic Dungeon|Perfect memory/i);
    });

    it('carries one line: feedback first, then the first-run instruction, and nothing otherwise', () => {
        const run = playingRun();
        const { rerender } = render(
            <RunShell
                feedback="Match resolved."
               
                onboardingLine="Flip a marked tile"
                personalBestDepth={false}
                onPause={vi.fn()}
                run={run}
                tools={[]}
            />
        );
        expect(screen.getByTestId('run-shell-line')).toHaveTextContent('Match resolved.');

        rerender(
            <RunShell personalBestDepth={false} onboardingLine="Flip a marked tile" onPause={vi.fn()} run={run} tools={[]} />
        );
        expect(screen.getByTestId('run-shell-line')).toHaveTextContent('Flip a marked tile');
        expect(screen.getByTestId('run-shell-line')).toHaveAttribute('data-run-shell-line-tone', 'info');

        rerender(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} tools={[]} />);
        expect(screen.queryByTestId('run-shell-line')).not.toBeInTheDocument();
    });

    it('docks only the tools that have charges or are armed, plus the menu', async () => {
        const user = userEvent.setup();
        const onPause = vi.fn();
        const armed = tool({ id: 'pin', armed: true });
        const spent = tool({ id: 'peek', charges: 0 });
        const ready = tool({ id: 'shuffle', charges: 2 });
        render(<RunShell personalBestDepth={false} onPause={onPause} run={playingRun()} tools={[armed, spent, ready]} />);

        const dock = screen.getByRole('toolbar', { name: /game controls/i });
        expect(within(dock).getByTestId('tool-pin')).toHaveAttribute('aria-pressed', 'true');
        expect(within(dock).getByTestId('tool-shuffle')).toHaveTextContent('2');
        expect(within(dock).queryByTestId('tool-peek')).not.toBeInTheDocument();

        await user.click(within(dock).getByRole('button', { name: /pause and open the run menu/i }));
        expect(onPause).toHaveBeenCalledTimes(1);
    });
});
