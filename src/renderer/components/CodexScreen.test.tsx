import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import CodexScreen from './CodexScreen';

const viewportSnapshot = { width: 1280, height: 800 };

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));

vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => viewportSnapshot
}));

vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) =>
        selector({
            closeSubscreen: vi.fn(),
            saveData: createDefaultSaveData(),
            settings: { masterVolume: 0, sfxVolume: 0 }
        })
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));

describe('CodexScreen REG-095 knowledge base', () => {
    beforeEach(() => {
        viewportSnapshot.width = 1280;
        viewportSnapshot.height = 800;
    });

    it('surfaces knowledge-base summary and local-only deep-link recovery', () => {
        render(<CodexScreen />);

        expect(screen.getByText(/Read-only reference v\d+ for cards, traits, rewards, and run rules\./)).toBeInTheDocument();

        const summary = screen.getByTestId('codex-knowledge-base-summary');
        expect(summary).toHaveTextContent(/Guide depth/);
        expect(summary).toHaveTextContent(/Table depth/);
        expect(summary).toHaveTextContent(/Deep links/);
        expect(summary).toHaveTextContent(/Filter recovery/);

        expect(screen.getByTestId('codex-reward-signal')).toHaveAccessibleName(
            /Codex reward signal.*Next:/i
        );
    });

    it('documents relic build archetypes as the player-facing build language', () => {
        render(<CodexScreen />);

        expect(screen.getByRole('link', { name: 'Builds' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Builds' })).toHaveAttribute('data-compact-label', 'Build');
        expect(screen.getByText('Build archetypes')).toBeInTheDocument();
        expect(screen.getByText('The Seer')).toBeInTheDocument();
        expect(screen.getByText(/peek, pin, read/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Peek charge/i).length).toBeGreaterThan(0);
    });

    it('documents tile trait rules and interactions without relying on gameplay state', () => {
        render(<CodexScreen />);

        expect(screen.getByRole('link', { name: 'Traits' })).toBeInTheDocument();
        expect(screen.getByText('Traits & interactions')).toBeInTheDocument();
        expect(screen.getByText('Echo')).toBeInTheDocument();
        expect(screen.getByText('Echo + Sealed: combo shard')).toBeInTheDocument();
        expect(screen.getByText(/Match Echo next to a different Sealed trait pair/i)).toBeInTheDocument();
    });

    it('renders encyclopedia descriptions without leaking inline Markdown markers', () => {
        render(<CodexScreen />);

        const scoringEntry = screen.getByText(/Match score, floor clear bonuses/i);
        expect(scoringEntry).toHaveTextContent('Scoring & survival');
        expect(scoringEntry).toHaveTextContent('Perfect Memory');
        expect(scoringEntry).not.toHaveTextContent('**');
    });

    it('REG-133 hides summary chrome in phone-width in-run lookup', () => {
        viewportSnapshot.width = 390;
        viewportSnapshot.height = 844;

        render(<CodexScreen stackedOnGameplay />);

        const filter = screen.getByTestId('codex-filter-row');
        const content = screen.getByTestId('codex-main-column');

        expect(filter).toBeInTheDocument();
        expect(content).toBeInTheDocument();
        expect(screen.queryByTestId('codex-knowledge-base-summary')).not.toBeInTheDocument();
        expect(screen.queryByTestId('codex-reward-signal')).not.toBeInTheDocument();
    });

    it('REG-133 marks unfiltered in-run phone codex for compact quick reference without capping filtered results', async () => {
        viewportSnapshot.width = 390;
        viewportSnapshot.height = 844;

        render(<CodexScreen stackedOnGameplay />);

        const codex = screen.getByTestId('codex-screen');
        expect(codex).toHaveAttribute('data-codex-context', 'in-run-desk');
        expect(codex).toHaveAttribute('data-codex-filter-state', 'unfiltered');

        fireEvent.change(screen.getByRole('searchbox', { name: /filter topics/i }), {
            target: { value: 'relic' }
        });

        await waitFor(() => expect(codex).toHaveAttribute('data-codex-filter-state', 'filtered'));
    });
});
