import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import type { BoardState, RunState } from '../../shared/contracts';
import { TILE_SUITS } from '../../shared/tile-suit-rules';
import RunShell, { type RunShellTool } from './RunShell';

const sfxMocks = vi.hoisted(() => ({ playStudyClosingTickSfx: vi.fn() }));
vi.mock('../audio/gameSfx', () => sfxMocks);

const hapticMocks = vi.hoisted(() => ({
    // Typed with the real signature so the assertions on `call[0]` (the reduce-motion flag the
    // shell hands down) are checked rather than indexing an empty tuple.
    tapStudyClosing: vi.fn((_reduceMotion: boolean) => true)
}));
vi.mock('../input/touchHaptics', () => hapticMocks);

// A fixed seed: the temper (and so the heat stage's name) is rolled from it, and the tests read the ember names.
const playingRun = (): RunState => finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, runSeed: 90_210, realm: null }));

/**
 * Floor 1's board carries two suits, and since Gen 259 par reads the palette off the board - so a
 * fixture that overrides `pairCount` to stand in for a bigger board has to deal the palette that
 * bigger board would carry, or it silently asks for the narrow palette's par.
 */
const overFullPalette = (board: BoardState, pairCount: number): BoardState => ({
    ...board,
    pairCount,
    tiles: board.tiles.map((tile, index) => ({ ...tile, suit: TILE_SUITS[index % TILE_SUITS.length]! }))
});

const tool = (overrides: Partial<RunShellTool> & { id: string }): RunShellTool => ({
    label: overrides.id,
    glyph: <svg />,
    onClick: vi.fn(),
    ...overrides
});

describe('RunShell', () => {
    it('keeps lives prominent beside the floor and score', () => {
        const run = playingRun();
        render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={run} tools={[]} />);

        const stats = screen.getByRole('group', { name: /run stats/i });
        expect(within(stats).getByTestId('hud-floor')).toHaveTextContent(/floor/i);
        expect(within(stats).getByTestId('hud-score')).toHaveTextContent(/score/i);
        expect(within(stats).getByTestId('hud-par')).toHaveTextContent(/turns/i);
        expect(within(stats).getByTestId('hud-chain')).toHaveTextContent(/combo/i);
        expect(within(stats).getByTestId('hud-misses-left')).toHaveAccessibleName('3 lives left');
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('opens secondary stats and closes them with Escape', async () => {
        const user = userEvent.setup();
        render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={playingRun()} tools={[]} />);
        const toggle = screen.getByLabelText('Run details');
        const details = toggle.closest('details')!;
        expect(details.open).toBe(false);
        await user.click(toggle);
        expect(details.open).toBe(true);
        expect(screen.getByTestId('hud-par')).toBeVisible();
        await user.keyboard('{Escape}');
        expect(details.open).toBe(false);
        expect(toggle).toHaveFocus();
        expect(screen.getByTestId('hud-misses-left')).toBeVisible();
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
        expect(rungAt()).toHaveAccessibleName('Your match clears its pair. Reach Clean to start popping nearby pairs.');

        // Twelve pairs: Sharp from 5, Fever from 7. A Fever break is scored at eight times a pop.
        const hot: RunState = { ...cold, stats: { ...cold.stats, currentStreak: 9 } };
        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={hot} tools={[]} />);
        expect(rungAt()).toHaveAttribute('data-chain-tier', 'fever');
        expect(rungAt()).toHaveTextContent('×8');
        expect(Number(rungAt().getAttribute('data-rung-multiplier'))).toBeGreaterThan(1);

        // The meter's own label carries it too, so a screen reader is told the same thing.
        expect(within(screen.getByTestId('hud-chain')).getByTestId('hud-chain-meter')).toHaveAttribute(
            'aria-label',
            expect.stringContaining('Fever can pop up to 4 extra pairs by contact.')
        );
    });

    it('lights the ladder once when the meter fills, and not while it stays full', async () => {
        // Losing a chain already had a beat here and topping it did not, so the ladder said more
        // about failing than about the thing a run is played for.
        const base = playingRun();
        const cold: RunState = { ...base, board: { ...base.board!, pairCount: 12 } };
        const { rerender } = render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={cold} tools={[]} />);
        const ladder = (): HTMLElement => screen.getByTestId('hud-chain');
        expect(ladder()).toHaveAttribute('data-meter-arrive', 'false');

        // Twelve pairs puts Fever at 7: nine fills the meter.
        const fever: RunState = { ...cold, stats: { ...cold.stats, currentStreak: 9 } };
        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={fever} tools={[]} />);
        await waitFor(() => expect(ladder()).toHaveAttribute('data-meter-arrive', 'true'));

        // Climbing further inside Fever is not a second arrival.
        const deeper: RunState = { ...cold, stats: { ...cold.stats, currentStreak: 11 } };
        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={deeper} tools={[]} />);
        await waitFor(() => expect(ladder()).toHaveAttribute('data-meter-arrive', 'false'), { timeout: 3000 });
        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={deeper} tools={[]} />);
        expect(ladder()).toHaveAttribute('data-meter-arrive', 'false');
    });

    it('reads the misses left on the par, and marks the last one', () => {
        // Twelve pairs over the full palette: par 11 (0.72 a pair since the pop was capped on
        // 2026-09-23, the miss allowance, and floor 6's reading kept because a bigger board is never
        // cheaper). The run's life is its miss bank (`miss-bank.ts`), and the count beside the par
        // is what it has left. The pressure of thesis §43 lives on the par stat.
        const base = playingRun();
        const calm: RunState = { ...base, board: overFullPalette(base.board!, 12), turnsThisFloor: 4, missBank: [{ floor: 1, misses: 3 }] };
        const { rerender } = render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={calm} tools={[]} />);

        const par = screen.getByTestId('hud-par');
        expect(within(par).getByRole('img')).toHaveAttribute('aria-label', '4 of 11 turns, 3 misses left');
        expect(par).toHaveTextContent('4 of 11 turns');
        expect(par).not.toHaveAttribute('data-ceiling-near');

        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...calm, turnsThisFloor: 8, missBank: [{ floor: 1, misses: 1 }] }} tools={[]} />);
        expect(screen.getByTestId('hud-par')).toHaveAttribute('data-ceiling-near', 'true');
        expect(within(screen.getByTestId('hud-par')).getByRole('img')).toHaveAttribute('aria-label', '8 of 11 turns, 1 miss left');
    });

    it('draws the misses the run has left, and says so when there are none', () => {
        // The head used to say `4 of 7 turns` and speak the run's end to a screen reader alone, so
        // a sighted player had no reading at all of how close the run was to ending - the thing
        // the old row of hearts did well (Gen 183 took the lives; docs/REMOVED_LIVES.md). The turn
        // bank that followed counted the turns a floor needs to be matched at all, and read as
        // seventeen lives on floor 4. It counts misses now, the only thing that can end the run.
        const base = playingRun();
        const board = overFullPalette(base.board!, 12);
        const early: RunState = { ...base, board, turnsThisFloor: 4, missBank: [{ floor: 1, misses: 3 }] };
        const { rerender } = render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={early} tools={[]} />);

        const left = (): HTMLElement => screen.getByTestId('hud-misses-left');
        expect(left()).toHaveAccessibleName('3 lives left');
        expect(left()).not.toHaveAttribute('data-low');

        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...early, missBank: [{ floor: 1, misses: 1 }] }} tools={[]} />);
        expect(left()).toHaveAccessibleName('1 life left');
        expect(left()).toHaveAttribute('data-low', 'true');

        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...early, missBank: [] }} tools={[]} />);
        expect(left()).toHaveAccessibleName('0 lives left');
        expect(left()).toHaveAttribute('data-low', 'true');
        expect(within(screen.getByTestId('hud-par')).getByRole('img')).toHaveAttribute('aria-label', '4 of 11 turns, no misses left');

        // A run built without a bank shows no count at all rather than a number it does not have.
        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...early, missBank: undefined }} tools={[]} />);
        expect(screen.queryByTestId('hud-misses-left')).toBeNull();
    });

    it('says so on the count when a chain earns a miss, and only then', async () => {
        // Since 2026-09-24 the bank is earned: every five in a row pays a miss in (`miss-bank.ts`),
        // and it is the one way the run's life goes up mid-floor, so the count itself says it.
        const base = playingRun();
        const board = overFullPalette(base.board!, 12);
        const one: RunState = { ...base, board, turnsThisFloor: 4, missBank: [{ floor: 1, misses: 1 }] };
        const { rerender } = render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={one} tools={[]} />);
        expect(screen.queryByTestId('hud-miss-earned')).toBeNull();

        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...one, missBank: [{ floor: 1, misses: 2 }] }} tools={[]} />);
        await waitFor(() => expect(screen.getByTestId('hud-miss-earned')).toHaveTextContent('+1 miss earned'));
        expect(screen.getByTestId('hud-misses-left')).toHaveAttribute('data-miss-earned', 'true');

        // Spending one is the miss's beat, not this one.
        rerender(<RunShell personalBestDepth={false} onPause={vi.fn()} run={{ ...one, missBank: [{ floor: 1, misses: 1 }] }} tools={[]} />);
        await waitFor(() => expect(screen.queryByTestId('hud-miss-earned')).toBeNull());
    });

    it('keeps the multiplier and accessible momentum without explanatory labels', () => {
        const base = playingRun();
        const run: RunState = {
            ...base,
            board: { ...base.board!, pairCount: 12 },
            chunkPairsThisChain: 4,
            stats: { ...base.stats, currentStreak: 3 }
        };
        render(<RunShell personalBestDepth={false} onPause={vi.fn()} run={run} tools={[]} />);

        expect(screen.getByTestId('hud-combo')).toHaveAttribute('data-combo', '3');
        expect(screen.getByTestId('hud-chain-rung-value')).toHaveAttribute('data-chain-tier', 'sharp');
        // The meter reads the same ladder: momentum 7 of 9, Sharp, not yet full.
        const meter = screen.getByTestId('hud-chain-meter');
        expect(meter).toHaveAttribute('data-chain-tier', 'sharp');
        expect(meter).toHaveAttribute('data-meter-fill', '0.778');
        expect(meter).toHaveAttribute('data-meter-full', 'false');
        expect(meter).toHaveAttribute('aria-label', expect.stringContaining('Fever meter: momentum 7 of 9.'));
        expect(screen.queryByTestId('hud-chain-goal')).toBeNull();
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

    it('speaks the caption only when it says something the announcer does not', () => {
        /*
         * `feedback` is the announcer's own text, which the HUD's polite region below already
         * speaks. As a live caption it made every bomb, flinch and lantern line be heard twice.
         */
        const run = playingRun();
        const { rerender } = render(
            <RunShell feedback="Bomb took that card and its twin off the board." onPause={vi.fn()} personalBestDepth={false} politeAnnouncement="Bomb took that card and its twin off the board." run={run} tools={[]} />
        );
        expect(screen.getByTestId('run-shell-line')).toHaveAttribute('aria-live', 'off');
        expect(screen.getByTestId('hud-polite-live-region')).toHaveAttribute('aria-live', 'polite');

        // The first floor's prompt is said nowhere else, so the caption stays a status line for it.
        rerender(<RunShell onboardingLine="Flip a marked tile" onPause={vi.fn()} personalBestDepth={false} run={run} tools={[]} />);
        const line = screen.getByTestId('run-shell-line');
        expect(line).toHaveAttribute('role', 'status');
        expect(line).not.toHaveAttribute('aria-live');
    });

    it('keeps focus in the dock when the focused tool spends its last charge and leaves', () => {
        const run = playingRun();
        const dock = (bombs: number) => (
            <RunShell
                onPause={vi.fn()}
                personalBestDepth={false}
                run={run}
                tools={[tool({ id: 'peek', charges: 1 }), tool({ id: 'bomb', charges: bombs }), tool({ id: 'greet' })]}
            />
        );
        const { rerender } = render(dock(1));
        screen.getByTestId('tool-bomb').focus();
        rerender(dock(0));
        expect(screen.queryByTestId('tool-bomb')).not.toBeInTheDocument();
        // Bomb's place is taken by the tool after it, and it is the dock's one tab stop now.
        expect(document.activeElement).toBe(screen.getByTestId('tool-greet'));
        expect(screen.getByTestId('tool-greet').tabIndex).toBe(0);
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

describe('RunShell — The Margin', () => {
    it('sets the study period on the running head as a count, and says so in the caption', () => {
        vi.useFakeTimers();
        try {
            const base = createNewRun(0, { echoFeedbackEnabled: false });
            const run: RunState = { ...base, timerState: { ...base.timerState, memorizeRemainingMs: 4000 } };
            expect(run.status).toBe('memorize');
            render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} tools={[]} />);

            const head = screen.getByTestId('hud-memorize');
            expect(head).toHaveTextContent('Memorize · 4');
            expect(head).toHaveTextContent('Double-tap the board to start early');
            expect(screen.getByTestId('run-shell-line')).toHaveTextContent(/Every face shows for 4 seconds/);
            expect(screen.getByTestId('game-action-dock')).toHaveTextContent('Study the board');

            act(() => {
                vi.advanceTimersByTime(1100);
            });
            expect(screen.getByTestId('hud-memorize')).toHaveTextContent('Memorize · 3');
            // The head counts; the sentence states the window. A live region that re-words itself
            // every second is re-read every second.
            expect(screen.getByTestId('run-shell-line')).toHaveTextContent(/Every face shows for 4 seconds/);
        } finally {
            vi.useRealTimers();
        }
    });

    it('lets the study clock run out louder than it started', () => {
        // The bar always carried the fact that the window was nearly gone. A fact in an unchanged
        // colour is one the player stopped rereading nine seconds ago, so the last seconds now read
        // differently from the first.
        vi.useFakeTimers();
        try {
            const base = createNewRun(0, { echoFeedbackEnabled: false });
            const run: RunState = { ...base, timerState: { ...base.timerState, memorizeRemainingMs: 10_000 } };
            render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} tools={[]} />);

            const urgency = () => Number(screen.getByTestId('hud-memorize-bar').style.getPropertyValue('--memorize-urgency'));
            const closing = () => screen.getByTestId('hud-memorize-bar').getAttribute('data-closing');

            act(() => {
                vi.advanceTimersByTime(250);
            });
            // Early on the head says nothing new: this stretch is for looking.
            expect(urgency()).toBe(0);
            expect(closing()).toBeNull();

            act(() => {
                vi.advanceTimersByTime(7_500);
            });
            const late = urgency();
            expect(late).toBeGreaterThan(0);
            expect(closing()).toBeNull();

            act(() => {
                vi.advanceTimersByTime(2_000);
            });
            expect(urgency()).toBeGreaterThan(late);
            expect(closing()).toBe('true');
            expect(screen.getByTestId('hud-memorize')).toHaveAttribute('data-closing', 'true');
        } finally {
            vi.useRealTimers();
        }
    });

    it('ticks the closing study window once a second, not once a frame', () => {
        // The countdown re-reads four times a second. Keying the cue on the seconds value rather
        // than on the tick is the whole difference between a clock and a buzz.
        vi.useFakeTimers();
        sfxMocks.playStudyClosingTickSfx.mockClear();
        try {
            const base = createNewRun(0, { echoFeedbackEnabled: false });
            const run: RunState = { ...base, timerState: { ...base.timerState, memorizeRemainingMs: 10_000 } };
            render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} sfxGain={0.5} tools={[]} />);

            act(() => {
                vi.advanceTimersByTime(8_000);
            });
            // The early window is for looking: nothing has sounded yet.
            expect(sfxMocks.playStudyClosingTickSfx).not.toHaveBeenCalled();

            // Stepped at the countdown's own cadence rather than jumped in one go. Advancing two
            // seconds at once coalesces every interval into a single render, so the effect would
            // only ever see the last state — which is the same reason a tab that stalls through
            // the end of the window simply misses its ticks instead of firing them all at once.
            for (let i = 0; i < 8; i += 1) {
                act(() => {
                    vi.advanceTimersByTime(250);
                });
            }
            const calls = sfxMocks.playStudyClosingTickSfx.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            // One per whole second, never twice for the same one.
            const seconds = calls.map((call) => call[1]);
            expect(new Set(seconds).size).toBe(seconds.length);
            expect(seconds.length).toBeLessThanOrEqual(3);
            for (const call of calls) {
                expect(call[0]).toBe(0.5);
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('taps the device on the same beat it ticks, so a muted phone is not left with nothing', () => {
        // The bar misses the player watching the board, which is what memorizing is; the tick
        // misses a muted phone. The two channels fire together because they miss different people.
        vi.useFakeTimers();
        sfxMocks.playStudyClosingTickSfx.mockClear();
        hapticMocks.tapStudyClosing.mockClear();
        try {
            const base = createNewRun(0, { echoFeedbackEnabled: false });
            const run: RunState = { ...base, timerState: { ...base.timerState, memorizeRemainingMs: 10_000 } };
            const { rerender } = render(
                <RunShell onPause={vi.fn()} personalBestDepth={false} run={run} sfxGain={0.5} tools={[]} />
            );
            for (let i = 0; i < 40; i += 1) {
                act(() => {
                    vi.advanceTimersByTime(250);
                });
            }
            expect(hapticMocks.tapStudyClosing.mock.calls.length).toBe(
                sfxMocks.playStudyClosingTickSfx.mock.calls.length
            );
            expect(hapticMocks.tapStudyClosing.mock.calls.length).toBeGreaterThan(0);
            // The shell hands its own reduce-motion setting down rather than deciding for it.
            for (const call of hapticMocks.tapStudyClosing.mock.calls) {
                expect(call[0]).toBe(false);
            }

            hapticMocks.tapStudyClosing.mockClear();
            rerender(
                <RunShell onPause={vi.fn()} personalBestDepth={false} reduceMotion run={run} sfxGain={0.5} tools={[]} />
            );
            const quiet: RunState = { ...base, timerState: { ...base.timerState, memorizeRemainingMs: 9_000 } };
            rerender(
                <RunShell onPause={vi.fn()} personalBestDepth={false} reduceMotion run={quiet} sfxGain={0.5} tools={[]} />
            );
            for (let i = 0; i < 40; i += 1) {
                act(() => {
                    vi.advanceTimersByTime(250);
                });
            }
            for (const call of hapticMocks.tapStudyClosing.mock.calls) {
                expect(call[0]).toBe(true);
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('stays silent through the study window when the player has the volume down', () => {
        vi.useFakeTimers();
        sfxMocks.playStudyClosingTickSfx.mockClear();
        try {
            const base = createNewRun(0, { echoFeedbackEnabled: false });
            const run: RunState = { ...base, timerState: { ...base.timerState, memorizeRemainingMs: 4_000 } };
            // No `sfxGain` at all: a shell rendered without one must not invent a sound.
            render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} tools={[]} />);
            act(() => {
                vi.advanceTimersByTime(4_000);
            });
            for (const call of sfxMocks.playStudyClosingTickSfx.mock.calls) {
                expect(call[0]).toBe(0);
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('leaves the study count behind once the floor is in play, and names the chain over the line', () => {
        const run = playingRun();
        render(
            <RunShell
                feedback="No match. Chain reset."
                feedbackPriority="error"
                onPause={vi.fn()}
                personalBestDepth={false}
                run={run}
                tools={[]}
            />
        );
        expect(screen.queryByTestId('hud-memorize')).not.toBeInTheDocument();
        expect(screen.getByTestId('game-action-dock')).toHaveTextContent('No match');
        expect(screen.getByTestId('run-shell-line')).toHaveAttribute('data-run-shell-line-tone', 'error');
    });

    it('names every rung of the ladder with what standing on it pays', () => {
        const base = playingRun();
        const run: RunState = { ...base, board: { ...base.board!, pairCount: 12 }, stats: { ...base.stats, currentStreak: 3 } };
        render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} tools={[]} />);
        const ladder = screen.getByTestId('hud-chain-meter');
        expect(ladder).toHaveTextContent('Fever×8');
        expect(ladder).toHaveTextContent('Sharp×4');
        expect(ladder).toHaveTextContent('Clean×2');
        expect(ladder).toHaveTextContent('Lone×1');
        // A chain of three stands on Clean: that rung and the ones below read as reached.
        expect(ladder.querySelector('[data-rung="clean"]')).toHaveAttribute('data-rung-reached', 'true');
        expect(ladder.querySelector('[data-rung="sharp"]')).toHaveAttribute('data-rung-reached', 'false');
        expect(screen.getByTestId('hud-chain-rung-value')).toHaveTextContent('×2');
    });

    it('headlines the carried combo without perk explanations', () => {
        // The combo carries whole until a miss while the ladder restarts each floor; a rail back on
        // Lone under a small "Chain 9" read as a lost combo, so the combo is the big number now.
        const base = playingRun();
        const carried: RunState = { ...base, comboLinksCarried: 8, board: { ...base.board!, pairCount: 12 }, stats: { ...base.stats, currentStreak: 9 } };
        const { rerender } = render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={carried} tools={[]} />);
        expect(screen.getByTestId('hud-combo')).toHaveAttribute('data-combo', '9');
        expect(screen.getByTestId('hud-combo')).toHaveTextContent(/9\s*Combo/);
        expect(screen.queryByTestId('hud-combo-carried')).toBeNull();
        // Nine is Hot: the shell carries the heat stage and the label says it beside the combo.
        expect(screen.getByTestId('run-shell')).toHaveAttribute('data-combo-stage', 'hot');
        expect(screen.getByTestId('hud-combo-stage')).toHaveTextContent('Combo · Hot');
        // The heat stays visible without a perk receipt.
        expect(screen.queryByTestId('hud-combo-perks')).toBeNull();
        expect(screen.getByTestId('hud-chain-flames')).toBeInTheDocument();
        // The ladder came down the stairs with it: nine on twelve pairs is Fever.
        expect(screen.getByTestId('hud-chain-rung-value')).toHaveAttribute('data-chain-tier', 'fever');
        rerender(<RunShell onPause={vi.fn()} personalBestDepth={false} run={{ ...base, stats: { ...base.stats, currentStreak: 2 } }} tools={[]} />);
        expect(screen.getByTestId('hud-combo')).toHaveAttribute('data-combo-carried', 'false');
        expect(screen.queryByTestId('hud-combo-carried')).toBeNull();
        expect(screen.getByTestId('run-shell')).toHaveAttribute('data-combo-stage', 'cold');
        expect(screen.getByTestId('hud-combo-stage')).toHaveTextContent(/^Combo$/);
    });

    /**
     * The one part of the ladder that looks forward. Everything else it does reports something that
     * has already happened; this says what the next pair buys, which is the reason a player takes
     * one more turn.
     */
    const ladderAtStreak = (currentStreak: number) => {
        const base = playingRun();
        const run: RunState = {
            ...base,
            board: { ...base.board!, pairCount: 12 },
            stats: { ...base.stats, currentStreak }
        };
        const { unmount } = render(<RunShell onPause={vi.fn()} personalBestDepth={false} run={run} tools={[]} />);
        const ladder = screen.getByTestId('hud-chain-meter');
        const state = (tier: string) => ({
            next: ladder.querySelector(`[data-rung="${tier}"]`)?.getAttribute('data-rung-next'),
            imminent: ladder.querySelector(`[data-rung="${tier}"]`)?.getAttribute('data-rung-imminent')
        });
        const read = { clean: state('clean'), sharp: state('sharp'), fever: state('fever') };
        unmount();
        return read;
    };

    it('marks the rung the next pair buys, and only that one', () => {
        // Twelve pairs: Clean 3, Sharp 7, Fever 9.
        const climbing = ladderAtStreak(4);
        expect(climbing.sharp.next).toBe('true');
        expect(climbing.clean.next).toBeNull();
        expect(climbing.fever.next).toBeNull();
    });

    it('leans on a rung only at the pair that lands it', () => {
        expect(ladderAtStreak(5).sharp.imminent).toBeNull();
        expect(ladderAtStreak(6).sharp.imminent).toBe('true');
        // Landed: the lean is gone, and the rung above is the one being climbed to now.
        const landed = ladderAtStreak(7);
        expect(landed.sharp.imminent).toBeNull();
        expect(landed.sharp.next).toBeNull();
        expect(landed.fever.next).toBe('true');
    });

    it('stops leaning at the top: Fever has nothing above it to promise', () => {
        const atFever = ladderAtStreak(9);
        expect(atFever.fever.next).toBeNull();
        expect(atFever.fever.imminent).toBeNull();
        expect(atFever.sharp.next).toBeNull();
    });
});
