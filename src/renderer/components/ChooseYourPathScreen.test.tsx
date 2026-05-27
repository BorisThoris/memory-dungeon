import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChooseYourPathScreen from './ChooseYourPathScreen';

const viewportSnapshot = { width: 390, height: 844 };
const storeSpies = vi.hoisted(() => ({
    startRun: vi.fn(),
    startDungeonShowcaseRun: vi.fn()
}));

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => viewportSnapshot
}));
vi.mock('../hooks/useFitShellZoom', () => ({
    useFitShellZoom: () => ({ fitZoom: 1 })
}));
vi.mock('../hooks/useDragScroll', () => ({
    useDragScroll: () => ({
        onPointerDownCapture: vi.fn(),
        onKeyDownCapture: vi.fn(),
        tabIndex: 0 as const
    })
}));
vi.mock('../desktop-client', () => ({
    desktopClient: { quitApp: vi.fn() }
}));
vi.mock('../audio/uiSfx', () => ({
    playMenuOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    playUiConfirmSfx: vi.fn(),
    playUiCounterSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));
vi.mock('../store/useAppStore', async () => {
    const { createDefaultSaveData } = await import('../../shared/save-data');
    const saveData = createDefaultSaveData();
    const state = {
        closeSubscreen: vi.fn(),
        openSettings: vi.fn(),
        saveData,
        settings: saveData.settings,
        startDailyRun: vi.fn(),
        startDungeonShowcaseRun: storeSpies.startDungeonShowcaseRun,
        startGauntletRun: vi.fn(),
        startMeditationRun: vi.fn(),
        startMeditationRunWithMutators: vi.fn(),
        startPinVowRun: vi.fn(),
        startPracticeRun: vi.fn(),
        startPuzzleRun: vi.fn(),
        startRun: storeSpies.startRun,
        startScholarContractRun: vi.fn(),
        startWildRun: vi.fn()
    };
    return {
        useAppStore: (selector: (s: typeof state) => unknown) => selector(state)
    };
});

describe('ChooseYourPathScreen REG-010 discoverability', () => {
    beforeEach(() => {
        storeSpies.startRun.mockClear();
        storeSpies.startDungeonShowcaseRun.mockClear();
    });

    it('defaults a fresh profile to Classic Run with browse content open', () => {
        render(<ChooseYourPathScreen />);

        const launcher = screen.getByTestId('choose-path-launcher');
        expect(launcher).toHaveTextContent(/Classic Run/);
        expect(launcher).toHaveTextContent(/guided first room/i);
        const firstRunBeats = screen.getByTestId('choose-path-first-run-beats');
        expect(firstRunBeats).toHaveTextContent(/Match the marked pair/i);
        expect(firstRunBeats).toHaveTextContent(/Clear the room/i);
        expect(firstRunBeats).toHaveTextContent(/Safe, Greed, or Mystery/i);
        expect(screen.getByRole('button', { name: /start run/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /hide modes/i })).toBeInTheDocument();
        expect(screen.getByTestId('choose-path-more-modes')).toBeInTheDocument();
        expect(screen.getByTestId('choose-path-offline-note')).toBeInTheDocument();
        expect(screen.getByText(/Dungeon Showcase/)).toBeInTheDocument();
        expect(screen.getByText(/Endless Mode/)).toBeInTheDocument();
    });

    it('shows browse/search/page and locked-mode copy by default', () => {
        render(<ChooseYourPathScreen />);

        const library = screen.getByTestId('choose-path-more-modes');
        expect(library).toHaveTextContent(/Dungeon Showcase/);
        expect(library).toHaveTextContent(/Daily Challenge/);
        expect(library).toHaveTextContent(/Endless Mode/);
        expect(library).toHaveTextContent(/Locked/);
        expect(screen.getByRole('button', { name: /search modes/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /page 1 of/i })).toBeInTheDocument();
        const offlineNote = screen.getByTestId('choose-path-offline-note');
        expect(offlineNote).toHaveTextContent(/Offline-first/);
        expect(offlineNote).toHaveTextContent(/Profile/);
    });

    it('starts Classic Run from the fresh-profile hero launcher in one action', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /start run/i }));

        expect(storeSpies.startRun).toHaveBeenCalledTimes(1);
        expect(storeSpies.startDungeonShowcaseRun).not.toHaveBeenCalled();
    });
});
