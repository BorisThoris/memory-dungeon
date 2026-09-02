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
    it('opens on the tab rail and entries, with no knowledge-base or reward-signal frames', () => {
        render(<CodexScreen />);

        expect(screen.queryByTestId('codex-knowledge-base-summary')).toBeNull();
        expect(screen.queryByTestId('codex-reward-signal')).toBeNull();
        expect(screen.getByRole('link', { name: 'Core' })).toBeInTheDocument();
        expect(screen.getByLabelText(/filter topics/i)).toBeInTheDocument();
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
