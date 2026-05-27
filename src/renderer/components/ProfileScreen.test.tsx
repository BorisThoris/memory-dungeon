import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import ProfileScreen from './ProfileScreen';

const profileStoreMocks = vi.hoisted(() => ({
    claimMetaProgressionReward: vi.fn(),
    closeSubscreen: vi.fn(),
    openSettings: vi.fn(),
    saveData: null as SaveData | null
}));

vi.mock('../audio/uiSfx', () => ({
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));
vi.mock('../store/useAppStore', async () => {
    const { createDefaultSaveData } = await import('../../shared/save-data');
    return {
        useAppStore: (selector: (state: unknown) => unknown) => {
            const saveData = profileStoreMocks.saveData ?? createDefaultSaveData();
            return selector({
                claimMetaProgressionReward: profileStoreMocks.claimMetaProgressionReward,
                closeSubscreen: profileStoreMocks.closeSubscreen,
                openSettings: profileStoreMocks.openSettings,
                saveData,
                settings: saveData.settings,
                steamConnected: false
            });
        }
    };
});

describe('ProfileScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        profileStoreMocks.saveData = null;
    });

    it('renders progress sections and returns to menu on Back', async () => {
        const user = userEvent.setup();
        render(<ProfileScreen />);

        expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
        expect(screen.getByTestId('profile-screen-body')).toBeInTheDocument();
        expect(screen.getByTestId('profile-summary-grid')).toBeInTheDocument();
        expect(screen.getByTestId('profile-progression-brief')).toBeInTheDocument();
        expect(screen.getAllByText(/initiate tier/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/next: week of archives/i)).toBeInTheDocument();
        expect(screen.getByText(/adept tier at profile level 3/i)).toBeInTheDocument();
        expect(screen.getByTestId('profile-milestone-rail')).toBeInTheDocument();
        expect(screen.getByText('Lv 1')).toBeInTheDocument();
        expect(screen.getByText('current')).toBeInTheDocument();
        expect(screen.getByText('10 honor marks')).toBeInTheDocument();
        expect(screen.getByTestId('profile-objective-board')).toBeInTheDocument();
        expect(screen.getByTestId('profile-daily-panel')).toBeInTheDocument();
        expect(screen.getByTestId('profile-recent-run')).toBeInTheDocument();
        expect(screen.getByTestId('profile-relic-details')).toBeInTheDocument();
        expect(screen.getByTestId('profile-save-trust-panel')).toBeInTheDocument();
        expect(screen.getByText('Local profile boundaries')).toBeInTheDocument();
        expect(screen.getByText('Cloud sync')).toBeInTheDocument();
        expect(screen.getByText(/cloud sync is not available in this build/i)).toBeInTheDocument();
        expect(screen.getByTestId('profile-trust-footer')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Settings' }));
        expect(profileStoreMocks.openSettings).toHaveBeenCalledWith('profile');

        await user.click(screen.getByRole('button', { name: 'Back' }));
        expect(profileStoreMocks.closeSubscreen).toHaveBeenCalledTimes(1);
    });

    it('lets a ready permanent upgrade be claimed from Profile', async () => {
        const user = userEvent.setup();
        const saveData = createDefaultSaveData();
        saveData.playerStats = {
            ...saveData.playerStats!,
            dailiesCompleted: 7
        };
        profileStoreMocks.saveData = saveData;

        render(<ProfileScreen />);

        await user.click(screen.getByRole('button', { name: 'Claim Week of Archives' }));

        expect(profileStoreMocks.claimMetaProgressionReward).toHaveBeenCalledWith('upgrade_relic_shrine_extra_pick');
    });
});
