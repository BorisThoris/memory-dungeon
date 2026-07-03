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
        const runLoop = screen.getByTestId('choose-path-mode-loop-classic');
        expect(runLoop).toHaveTextContent(/Chain into route rewards/i);
        expect(runLoop).toHaveTextContent(/shops and relic milestones/i);
        expect(runLoop).toHaveAttribute('data-loop-cue-tone', 'build');
        expect(runLoop).toHaveAccessibleName(
            /Classic Run gameplay loop\. Chain into route rewards\. Clear clean pairs.*shops and relic milestones/i
        );
        expect(screen.getByTestId('choose-path-mode-signals-classic')).toHaveTextContent(/Shops \+ relics/i);
        expect(screen.getByTestId('choose-path-mode-signals-classic')).toHaveTextContent(/Route choices/i);
        expect(screen.getByTestId('choose-path-mode-signals-classic')).toHaveAttribute(
            'data-mode-lane-map',
            'chain:1>reward:1>pressure:1'
        );
        expect(screen.getByTestId('choose-path-mode-signals-classic')).toHaveAttribute(
            'data-mode-lane-actions',
            'chain:Build chain:1>reward:Chase reward:1>pressure:Read pressure:1'
        );
        expect(screen.getByTestId('choose-path-mode-signals-classic')).toHaveAccessibleName(
            /Classic Run launch signals.*Payoff: Shops \+ relics.*Pressure: Route choices/i
        );
        const classicSignals = screen.getByTestId('choose-path-mode-signals-classic');
        expect(classicSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-beats',
            '4'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-action',
            'Chase reward'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-audio',
            'mode-signal-reward'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-screen-cue',
            'burst'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveTextContent('Chase reward');
        expect(
            classicSignals.querySelector('[data-mode-signal-tone="payoff"]')?.querySelectorAll('[data-mode-signal-beat]')
        ).toHaveLength(4);
        expect(classicSignals.querySelector('[data-mode-signal-tone="pressure"]')).toHaveAttribute(
            'data-mode-signal-beats',
            '3'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="pressure"]')).toHaveAttribute(
            'data-mode-signal-action',
            'Read pressure'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="pressure"]')).toHaveAttribute(
            'data-mode-signal-audio',
            'mode-signal-pressure'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="pressure"]')).toHaveAttribute(
            'data-mode-signal-screen-cue',
            'guard'
        );
        expect(
            classicSignals.querySelector('[data-mode-signal-tone="pressure"]')?.querySelectorAll('[data-mode-signal-beat]')
        ).toHaveLength(3);
        expect(classicSignals.querySelector('[data-mode-signal-tone="pace"]')).toHaveAttribute(
            'data-mode-signal-beats',
            '2'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="pace"]')).toHaveAttribute(
            'data-mode-signal-action',
            'Build chain'
        );
        expect(classicSignals.querySelector('[data-mode-signal-tone="pace"]')).toHaveAttribute(
            'data-mode-signal-screen-cue',
            'pulse'
        );
        const classicLaneMap = screen.getByTestId('choose-path-mode-lane-map-classic-launch');
        expect(classicLaneMap).toHaveAttribute('data-mode-lane-map', 'chain:1>reward:1>pressure:1');
        expect(classicLaneMap).toHaveAttribute(
            'data-mode-lane-actions',
            'chain:Build chain:1>reward:Chase reward:1>pressure:Read pressure:1'
        );
        expect(classicLaneMap).toHaveAttribute('data-mode-primary-lane', 'chain');
        expect(classicLaneMap).toHaveAttribute('data-mode-primary-lane-action', 'Build chain');
        expect(classicLaneMap).toHaveAttribute('data-mode-primary-lane-audio', 'mode-lane-chain');
        expect(classicLaneMap).toHaveAttribute('data-mode-primary-lane-beats', '4');
        expect(classicLaneMap).toHaveAttribute('data-mode-primary-lane-cue', 'Escalating floors');
        expect(classicLaneMap).toHaveAttribute('data-mode-primary-lane-screen-cue', 'burst');
        expect(classicLaneMap).toHaveTextContent('Chain');
        expect(classicLaneMap).toHaveTextContent('Build chain');
        expect(classicLaneMap).toHaveTextContent('Escalating floors');
        expect(classicLaneMap).toHaveTextContent('Reward');
        expect(classicLaneMap).toHaveTextContent('Chase reward');
        expect(classicLaneMap).toHaveTextContent('Shops + relics');
        expect(classicLaneMap).toHaveTextContent('Pressure');
        expect(classicLaneMap).toHaveTextContent('Read pressure');
        expect(classicLaneMap).toHaveTextContent('Route choices');
        expect(classicLaneMap.querySelector('[data-mode-lane="chain"]')).toHaveAttribute(
            'data-mode-lane-action',
            'Build chain'
        );
        expect(classicLaneMap.querySelector('[data-mode-lane="reward"]')).toHaveAttribute(
            'data-mode-lane-action',
            'Chase reward'
        );
        expect(classicLaneMap.querySelector('[data-mode-lane="pressure"]')).toHaveAttribute(
            'data-mode-lane-action',
            'Read pressure'
        );
        expect(classicLaneMap).toHaveAccessibleName(
            'Classic Run launch lane map. Chain: 1. Build chain. Escalating floors. Reward: 1. Chase reward. Shops + relics. Pressure: 1. Read pressure. Route choices.'
        );
        const classicPrimaryLane = screen.getByTestId('choose-path-mode-primary-lane-classic-launch');
        expect(classicPrimaryLane).toHaveAccessibleName(
            'Primary mode lane. Chain: Build chain. Escalating floors. 4 beats.'
        );
        expect(classicPrimaryLane).toHaveAttribute('data-mode-primary-lane', 'chain');
        expect(classicPrimaryLane).toHaveAttribute('data-mode-primary-lane-action', 'Build chain');
        expect(classicPrimaryLane).toHaveAttribute('data-mode-primary-lane-audio', 'mode-lane-chain');
        expect(classicPrimaryLane).toHaveAttribute('data-mode-primary-lane-beats', '4');
        expect(classicPrimaryLane).toHaveAttribute('data-mode-primary-lane-cue', 'Escalating floors');
        expect(classicPrimaryLane).toHaveAttribute('data-mode-primary-lane-screen-cue', 'burst');
        expect(classicPrimaryLane).toHaveTextContent('Launch loop');
        expect(classicPrimaryLane.querySelectorAll('[data-mode-primary-lane-beat]')).toHaveLength(4);
        const startButton = screen.getByRole('button', { name: /Start Classic Run.*Payoff: Shops \+ relics/i });
        expect(startButton).toBeInTheDocument();
        expect(startButton).toHaveTextContent(/Chain into route rewards/i);
        expect(startButton).toHaveAttribute('data-start-action-cue', 'Chain into route rewards');
        expect(startButton).toHaveAttribute('data-start-action-tone', 'build');
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
        expect(library).toHaveTextContent(/Dungeon systems/);
        expect(library).toHaveTextContent(/Boss \+ locks/);
        const showcaseLaneMap = screen.getByTestId('choose-path-mode-lane-map-dungeon_showcase-tile');
        expect(showcaseLaneMap).toHaveAttribute('data-mode-lane-map', 'chain:1>reward:1>pressure:1');
        expect(showcaseLaneMap).toHaveAttribute(
            'data-mode-lane-actions',
            'chain:Build chain:1>reward:Chase reward:1>pressure:Read pressure:1'
        );
        expect(showcaseLaneMap).toHaveAttribute('data-mode-primary-lane', 'chain');
        expect(showcaseLaneMap).toHaveAttribute('data-mode-primary-lane-action', 'Build chain');
        expect(showcaseLaneMap).toHaveAttribute('data-mode-primary-lane-audio', 'mode-lane-chain');
        expect(showcaseLaneMap).toHaveAttribute('data-mode-primary-lane-beats', '4');
        expect(showcaseLaneMap).toHaveAttribute('data-mode-primary-lane-cue', 'Immediate dungeon');
        expect(showcaseLaneMap).toHaveAttribute('data-mode-primary-lane-screen-cue', 'burst');
        expect(showcaseLaneMap).toHaveAccessibleName(
            'Dungeon Showcase tile lane map. Chain: 1. Build chain. Immediate dungeon. Reward: 1. Chase reward. Dungeon systems. Pressure: 1. Read pressure. Boss + locks.'
        );
        const showcasePrimaryLane = screen.getByTestId('choose-path-mode-primary-lane-dungeon_showcase-tile');
        expect(showcasePrimaryLane).toHaveAccessibleName(
            'Primary mode lane. Chain: Build chain. Immediate dungeon. 4 beats.'
        );
        expect(showcasePrimaryLane).toHaveAttribute('data-mode-primary-lane', 'chain');
        expect(showcasePrimaryLane).toHaveAttribute('data-mode-primary-lane-audio', 'mode-lane-chain');
        expect(showcasePrimaryLane).toHaveAttribute('data-mode-primary-lane-screen-cue', 'burst');
        expect(showcasePrimaryLane.querySelectorAll('[data-mode-primary-lane-beat]')).toHaveLength(4);
        const showcaseSignals = screen.getByTestId('choose-path-mode-signals-dungeon_showcase');
        expect(showcaseSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-beats',
            '4'
        );
        expect(showcaseSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-action',
            'Chase reward'
        );
        expect(showcaseSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-audio',
            'mode-signal-reward'
        );
        expect(showcaseSignals.querySelector('[data-mode-signal-tone="payoff"]')).toHaveAttribute(
            'data-mode-signal-screen-cue',
            'burst'
        );
        expect(
            showcaseSignals.querySelector('[data-mode-signal-tone="payoff"]')?.querySelectorAll('[data-mode-signal-beat]')
        ).toHaveLength(4);
        expect(showcaseSignals.querySelector('[data-mode-signal-tone="pressure"]')).toHaveAttribute(
            'data-mode-signal-beats',
            '3'
        );
        expect(showcaseSignals.querySelector('[data-mode-signal-tone="pressure"]')).toHaveAttribute(
            'data-mode-signal-action',
            'Read pressure'
        );
        expect(screen.getByRole('button', { name: /Dungeon Showcase.*Payoff: Dungeon systems.*Pressure: Boss \+ locks/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /search modes/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /page 1 of/i })).toBeInTheDocument();
        const offlineNote = screen.getByTestId('choose-path-offline-note');
        expect(offlineNote).toHaveTextContent(/Offline-first/);
        expect(offlineNote).toHaveTextContent(/Profile/);
    });

    it('surfaces the selected mode gameplay loop in the detail modal', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /Dungeon Showcase.*Open details/i }));

        const loop = screen.getByTestId('choose-path-mode-loop-dungeon_showcase');
        expect(loop).toHaveTextContent(/Read locks before pressure spikes/i);
        expect(loop).toHaveTextContent(/enemies, keys, traps, shops, and bosses/i);
        expect(loop).toHaveAttribute('data-loop-cue-tone', 'route');
        expect(loop).toHaveAccessibleName(
            /Dungeon Showcase gameplay loop\. Read locks before pressure spikes\. Practice enemies, keys, traps, shops, and bosses/i
        );
    });

    it('starts Classic Run from the fresh-profile hero launcher in one action', async () => {
        const user = userEvent.setup();
        render(<ChooseYourPathScreen />);

        await user.click(screen.getByRole('button', { name: /Start Classic Run/i }));

        expect(storeSpies.startRun).toHaveBeenCalledTimes(1);
        expect(storeSpies.startDungeonShowcaseRun).not.toHaveBeenCalled();
    });
});
