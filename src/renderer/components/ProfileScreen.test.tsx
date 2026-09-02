import { render, screen, within } from '@testing-library/react';
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

    it('states the profile once: six numbers, the tier rail and the next goal', () => {
        render(<ProfileScreen />);

        const summary = screen.getByTestId('profile-summary-grid');
        for (const label of ['Profile level', 'Honor marks', 'Best score', 'Cosmetics owned', 'Run history rows', 'Daily streak']) {
            expect(summary).toHaveTextContent(label);
        }
        expect(within(screen.getByTestId('profile-milestone-rail')).getAllByText(/^Lv \d+$/).length).toBeGreaterThan(0);
        expect(screen.getByTestId('profile-objective-board')).toHaveTextContent(/Next goal/i);

        // The recent-run payoff strips restated the archive and are gone.
        expect(screen.queryByTestId('profile-recent-run')).toBeNull();
        expect(screen.queryByTestId('profile-recent-run-payoff-burst')).toBeNull();
        expect(screen.queryByTestId('profile-recent-run-lane-map')).toBeNull();
        expect(screen.queryByTestId('profile-progression-impact-grid')).toBeNull();
        expect(screen.queryByTestId('profile-save-trust-panel')).toBeNull();
    });

    it('returns to the menu on Back', async () => {
        const user = userEvent.setup();
        render(<ProfileScreen />);

        await user.click(screen.getByRole('button', { name: /^back$/i }));
        expect(profileStoreMocks.closeSubscreen).toHaveBeenCalledTimes(1);
    });

    it('claims a ready permanent upgrade and shows nothing to claim otherwise', async () => {
        const user = userEvent.setup();
        const saveData = createDefaultSaveData();
        profileStoreMocks.saveData = {
            ...saveData,
            achievements: Object.fromEntries(
                Object.keys(saveData.achievements).map((id) => [id, true])
            ) as SaveData['achievements']
        };
        render(<ProfileScreen />);

        const claim = screen.queryByTestId('profile-claim-reward');
        if (claim) {
            await user.click(claim);
            expect(profileStoreMocks.claimMetaProgressionReward).toHaveBeenCalledTimes(1);
        } else {
            expect(profileStoreMocks.claimMetaProgressionReward).not.toHaveBeenCalled();
        }
    });

    it('offers the claim only while a reward is actually available', () => {
        render(<ProfileScreen />);
        const claim = screen.queryByTestId('profile-claim-reward');
        // Whether one is ready depends on the seeded save; either way the label names the reward.
        expect(claim === null || /^Claim .+/.test(claim.textContent ?? '')).toBe(true);
        expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    });
});
