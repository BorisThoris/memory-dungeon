import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun, createRunSummary, finishMemorizePhase } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { getGameOverNextRunRows } from '../../shared/game-over-next-run';
import GameOverScreen from './GameOverScreen';

const uiSfxMocks = vi.hoisted(() => ({
    playGameOverOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
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
vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (s: never) => unknown) =>
        selector({
            goToMenu: vi.fn(),
            restartRun: vi.fn(),
            saveData: createDefaultSaveData(),
            settings: {
                reduceMotion: true,
                graphicsQuality: 'high',
                uiScale: 1
            }
        } as never)
}));

const gameOverRunFixture = (): RunState => {
    let run = finishMemorizePhase(createNewRun(100, { runSeed: 0xabc }));
    run = { ...run, status: 'gameOver', lives: 0 };
    return createRunSummary(run, []);
};

describe('GameOverScreen (REF-031)', () => {
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
        expect(screen.getByText(/Journal/)).toBeInTheDocument();
    });

    it('REG-096 surfaces next-run loop reasons from local summary data', () => {
        const rows = getGameOverNextRunRows(gameOverRunFixture());
        expect(rows.map((row) => row.id)).toEqual(['run_it_back', 'build_recap', 'local_share', 'next_goal']);
        expect(rows.every((row) => row.localOnly)).toBe(true);

        render(<GameOverScreen run={gameOverRunFixture()} />);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Classic/);
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Next goal/);
        expect(screen.getByTestId('game-over-dungeon-journal')).toHaveTextContent(/Dungeon node/);
        expect(screen.getByTestId('game-over-dungeon-journal')).toHaveTextContent(/Dungeon rewards/);
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
        expect(screen.getByTestId('game-over-next-run-loop')).toHaveTextContent(/Scholar Contract/i);
    });
});
