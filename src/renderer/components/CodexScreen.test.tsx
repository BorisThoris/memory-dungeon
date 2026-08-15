import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import CodexScreen from './CodexScreen';

vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
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
    it('surfaces knowledge-base summary and local-only deep-link recovery', () => {
        render(<CodexScreen />);

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
        expect(screen.getByText('Build archetypes')).toBeInTheDocument();
        expect(screen.getByText('The Conduit Cartographer')).toBeInTheDocument();
        expect(screen.getByText('The Emergency Toolkit')).toBeInTheDocument();
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
});
