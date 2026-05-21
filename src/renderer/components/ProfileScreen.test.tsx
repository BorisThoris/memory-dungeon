import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProfileScreen from './ProfileScreen';

const profileStoreMocks = vi.hoisted(() => ({
    closeSubscreen: vi.fn(),
    openSettings: vi.fn()
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
    const saveData = createDefaultSaveData();
    return {
        useAppStore: (selector: (state: unknown) => unknown) =>
            selector({
                closeSubscreen: profileStoreMocks.closeSubscreen,
                openSettings: profileStoreMocks.openSettings,
                saveData,
                settings: saveData.settings,
                steamConnected: false
            })
    };
});

describe('ProfileScreen', () => {
    it('renders progress sections and returns to menu on Back', async () => {
        const user = userEvent.setup();
        render(<ProfileScreen />);

        expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
        expect(screen.getByTestId('profile-screen-body')).toBeInTheDocument();
        expect(screen.getByTestId('profile-summary-grid')).toBeInTheDocument();
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
});
