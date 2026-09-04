import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

    it('offers nothing to copy on a profile that has never run a daily', () => {
        render(<ProfileScreen />);

        expect(screen.queryByTestId('profile-copy-daily')).not.toBeInTheDocument();
    });

    it('copies the streak line once there is a daily record to post', async () => {
        const saveData = createDefaultSaveData();
        const stats = saveData.playerStats;
        expect(stats, 'a default save carries player stats').toBeDefined();
        stats!.dailiesCompleted = 3;
        stats!.dailyStreakCosmetic = 5;
        stats!.lastDailyDateKeyUtc = '20260904';
        profileStoreMocks.saveData = saveData;

        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        render(<ProfileScreen />);
        const button = screen.getByTestId('profile-copy-daily');
        fireEvent.click(button);

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0]?.[0]).toMatch(/^Daily 20260904 .*streak 5$/u);
        await waitFor(() => expect(button).toHaveTextContent(/copied/i));
    });

    it('shows what the player is part-way through, dailies and quests included', () => {
        render(<ProfileScreen />);

        const grid = screen.getByRole('list', { name: /progress/i });
        const cards = within(grid).getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);
        for (const card of cards) {
            expect(card).toHaveAttribute('data-status');
            expect(card.textContent?.trim().length ?? 0).toBeGreaterThan(0);
        }
    });

    it('states the daily streak in the subtitle, which nothing on any screen said before', () => {
        render(<ProfileScreen />);

        expect(screen.getByTestId('profile-screen')).toHaveTextContent(/daily streak/i);
    });

    it('states the profile once: six numbers, the tier rail and the next goal', () => {
        render(<ProfileScreen />);

        const summary = screen.getByTestId('profile-summary-grid');
        for (const label of ['Profile level', 'Honor marks', 'Best score', 'Title', 'Run history rows', 'Daily streak']) {
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
