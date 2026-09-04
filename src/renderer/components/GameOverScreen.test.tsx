import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun, createRunSummary, finishMemorizePhase } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { getGameOverNextRunRows } from '../../shared/game-over-next-run';
import GameOverScreen from './GameOverScreen';

const uiSfxMocks = vi.hoisted(() => ({
    playGameOverOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
    playUiCopySfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 1
}));

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => ({ width: 1280, height: 800 })
}));
vi.mock('../platformTilt/usePlatformTiltField', () => ({
    usePlatformTiltField: () => ({ tiltRef: { current: null } })
}));
vi.mock('../audio/uiSfx', () => uiSfxMocks);
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));
/** The best score as it stood when the run started; the personal-best line is read off this. */
const gameOverStoreMocks = vi.hoisted(() => ({ bestScoreAtRunStart: null as number | null }));

vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (s: never) => unknown) =>
        selector({
            goToMenu: vi.fn(),
            restartRun: vi.fn(),
            runStartSaveData:
                gameOverStoreMocks.bestScoreAtRunStart === null
                    ? null
                    : { ...createDefaultSaveData(), bestScore: gameOverStoreMocks.bestScoreAtRunStart },
            saveData: createDefaultSaveData(),
            settings: {
                reduceMotion: true,
                graphicsQuality: 'high',
                uiScale: 1
            }
        } as never)
}));

const gameOverRunFixture = (totalScore = 0): RunState => {
    let run = finishMemorizePhase(createNewRun(100, { runSeed: 0xabc }));
    run = { ...run, lives: 0, stats: { ...run.stats, totalScore }, status: 'gameOver' };
    return createRunSummary(run, []);
};

describe('GameOverScreen (REF-031)', () => {
    beforeEach(() => {
        gameOverStoreMocks.bestScoreAtRunStart = null;
    });

    it('says the run beat the record, which the Best Score stat never did', () => {
        gameOverStoreMocks.bestScoreAtRunStart = 900;

        render(<GameOverScreen run={gameOverRunFixture(1200)} />);

        const line = screen.getByTestId('game-over-personal-best');
        expect(line).toHaveTextContent(/new personal best/i);
        expect(line).toHaveAttribute('data-personal-best', 'beaten');
    });

    it('stays silent about a run that fell short of the record', () => {
        gameOverStoreMocks.bestScoreAtRunStart = 5000;

        render(<GameOverScreen run={gameOverRunFixture(1200)} />);

        expect(screen.queryByTestId('game-over-personal-best')).not.toBeInTheDocument();
    });

    it('hands the run over on the clipboard, seed and all, and confirms it did', async () => {
        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        // Not userEvent: its setup swaps in its own clipboard stub, so the real one never runs.
        render(<GameOverScreen run={gameOverRunFixture()} />);

        fireEvent.click(screen.getByTestId('game-over-copy-result'));

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0]?.[0]).toMatch(/^Memory Dungeon — .*Same run: /u);
        await waitFor(() => expect(screen.getByTestId('game-over-copy-result')).toHaveTextContent(/copied/i));
    });

    it('says it could not copy rather than doing nothing when the clipboard refuses', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }
        });
        render(<GameOverScreen run={gameOverRunFixture()} />);

        fireEvent.click(screen.getByTestId('game-over-copy-result'));

        await waitFor(() =>
            expect(screen.getByTestId('game-over-copy-result')).toHaveTextContent(/could not copy/i)
        );
    });

    it('exposes a single page title and polite run summary for assistive tech', () => {
        render(<GameOverScreen run={gameOverRunFixture()} />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1, name: 'Expedition Over' })).toBeInTheDocument();

        const polite = screen.getByLabelText('Run summary announcement');
        expect(polite).toHaveAttribute('aria-live', 'polite');
        expect(polite).toHaveTextContent(/Expedition complete/);

        expect(screen.getAllByRole('button', { name: 'Play Again - start a new run after this expedition' })[0]).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Mobile Play Again - start a new run after this expedition' })[0]).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Return to the main menu' })[0]).toBeInTheDocument();
    });

    it('uses a second-level heading for unlocked achievements', () => {
        const run = gameOverRunFixture();
        const withAchievement: RunState = {
            ...run,
            lastRunSummary: run.lastRunSummary
                ? {
                      ...run.lastRunSummary,
                      unlockedAchievements: ['ACH_FIRST_CLEAR']
                  }
                : null
        };
        render(<GameOverScreen run={withAchievement} />);

        expect(screen.getByRole('heading', { level: 2, name: 'New archive entries' })).toBeInTheDocument();
    });

    it('plays game-over open on mount', () => {
        render(<GameOverScreen run={gameOverRunFixture()} />);
        expect(uiSfxMocks.playGameOverOpenSfx).toHaveBeenCalledTimes(1);
    });

    it('REG-007 keeps primary retry actions in the above-fold mobile summary block', () => {
        render(<GameOverScreen run={gameOverRunFixture()} />);

        const topSummary = screen.getByTestId('game-over-above-fold-summary');
        expect(topSummary).toHaveTextContent('score');
        expect(topSummary).toHaveTextContent('Play Again');
        expect(topSummary).toHaveTextContent('Main Menu');
        // The journal id, share string and flip-timeline drawer were telemetry, not a result.
        expect(screen.queryByText(/Journal/)).toBeNull();
        expect(screen.queryByTestId('game-over-detail-drawer')).toBeNull();
    });

    it('REG-096 surfaces next-run loop reasons from local summary data', () => {
        const rows = getGameOverNextRunRows(gameOverRunFixture());
        expect(rows.map((row) => row.id)).toEqual(['run_it_back', 'chain_target', 'build_recap', 'local_share', 'next_goal']);
        expect(rows.every((row) => row.localOnly)).toBe(true);

        render(<GameOverScreen run={gameOverRunFixture()} />);
        // The rail shows only what changes the next run. The mode is named once, in the
        // eyebrow; the build recap restated the relic and mutator chips; the share string
        // and the dungeon journal were telemetry.
        const loop = screen.getByTestId('game-over-next-run-loop');
        expect(loop).toHaveTextContent(/Chain target/);
        expect(loop).toHaveTextContent(/Next goal/);
        expect(loop).not.toHaveTextContent(/Run it back|Build recap|Local share/);
        expect(screen.getByTestId('game-over-mode-heading')).toHaveTextContent(/Classic/);
        expect(screen.queryByTestId('game-over-dungeon-journal')).toBeNull();
    });

    it('PPI-006 preserves contract mode identity in game-over summary', () => {
        const run = gameOverRunFixture();
        const scholarRun: RunState = {
            ...run,
            activeContract: {
                noShuffle: true,
                noDestroy: false,
                maxMismatches: null,
                bonusRelicDraftPick: true
            },
            lastRunSummary: run.lastRunSummary
                ? {
                      ...run.lastRunSummary,
                      activeContract: {
                          noShuffle: true,
                          noDestroy: false,
                          maxMismatches: null,
                          bonusRelicDraftPick: true
                      }
                  }
                : null
        };

        render(<GameOverScreen run={scholarRun} />);

        expect(screen.getByTestId('game-over-mode-heading')).toHaveTextContent(/Scholar contract/i);
        expect(screen.getByTestId('game-over-mode-identity')).toHaveTextContent(/no full-board shuffle/i);
    });
});
