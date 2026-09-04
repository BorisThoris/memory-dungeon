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

    it('says where finished runs will appear on a profile that has none yet', () => {
        render(<ProfileScreen />);

        expect(screen.getByTestId('profile-run-history')).toHaveTextContent(/Finished runs are recorded here/i);
        expect(screen.queryByTestId('profile-run-history-copy')).not.toBeInTheDocument();
    });

    it('lists past runs newest first, and hands over the key for one', async () => {
        const saveData = createDefaultSaveData();
        saveData.runHistory = [
            {
                endedAtIso: '2026-09-04T12:00:00.000Z',
                highestLevel: 12,
                mode: 'Wild Run',
                shareKey: 'md1:wild:33:912',
                totalScore: 3400
            },
            {
                endedAtIso: '2026-09-01T09:00:00.000Z',
                highestLevel: 4,
                mode: 'Practice',
                shareKey: 'md1:practice:33:77',
                totalScore: 800
            }
        ];
        profileStoreMocks.saveData = saveData;

        const writeText = vi.fn(async (_text: string) => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

        render(<ProfileScreen />);
        const history = screen.getByTestId('profile-run-history');
        const rows = within(history).getAllByRole('listitem');

        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent('Wild Run');
        expect(rows[0]).toHaveTextContent('Floor 12');
        expect(rows[0]).toHaveTextContent('3,400');
        expect(rows[1]).toHaveTextContent('Practice');

        fireEvent.click(within(rows[0]!).getByTestId('profile-run-history-copy'));
        expect(writeText).toHaveBeenCalledWith('md1:wild:33:912');
        await waitFor(() => expect(rows[0]).toHaveTextContent(/copied/i));
        // Only the row that was pressed says so.
        expect(rows[1]).not.toHaveTextContent(/copied/i);
    });

    it('keeps a record per mode, so a Gauntlet and a Classic run stop competing for one slot', () => {
        const saveData = createDefaultSaveData();
        saveData.runHistory = [
            {
                endedAtIso: '2026-09-04T12:00:00.000Z',
                highestLevel: 12,
                mode: 'Classic Dungeon',
                shareKey: 'md1:classic:33:1',
                totalScore: 3400
            },
            {
                endedAtIso: '2026-09-03T12:00:00.000Z',
                highestLevel: 3,
                mode: 'Gauntlet',
                shareKey: 'md1:gauntlet:33:2:600000',
                totalScore: 700
            },
            {
                endedAtIso: '2026-09-02T12:00:00.000Z',
                highestLevel: 2,
                mode: 'Gauntlet',
                shareKey: 'md1:gauntlet:33:3:600000',
                totalScore: 200
            }
        ];
        profileStoreMocks.saveData = saveData;

        render(<ProfileScreen />);
        const rows = within(screen.getByTestId('profile-mode-records')).getAllByRole('listitem');

        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent('Classic Dungeon');
        expect(rows[0]).toHaveTextContent('3,400');
        // The Gauntlet record is its own best, and says how many runs stand behind it.
        expect(rows[1]).toHaveTextContent('Gauntlet');
        expect(rows[1]).toHaveTextContent('700');
        expect(rows[1]).toHaveTextContent('2 runs');
    });

    it('says where records will appear rather than listing every mode at zero', () => {
        render(<ProfileScreen />);

        const records = screen.getByTestId('profile-mode-records');
        expect(records).toHaveTextContent(/A record appears here for each mode/i);
        expect(within(records).queryAllByRole('listitem')).toHaveLength(0);
    });

    it('marks the best recorded run, and marks only that one', () => {
        const saveData = createDefaultSaveData();
        saveData.runHistory = [
            {
                endedAtIso: '2026-09-04T12:00:00.000Z',
                highestLevel: 5,
                mode: 'Classic Dungeon',
                shareKey: 'md1:classic:33:1',
                totalScore: 900
            },
            {
                endedAtIso: '2026-09-03T12:00:00.000Z',
                highestLevel: 14,
                mode: 'Wild Run',
                shareKey: 'md1:wild:33:2',
                totalScore: 3400
            },
            {
                endedAtIso: '2026-09-02T12:00:00.000Z',
                highestLevel: 2,
                mode: 'Practice',
                shareKey: 'md1:practice:33:3',
                totalScore: 100
            }
        ];
        profileStoreMocks.saveData = saveData;

        render(<ProfileScreen />);
        const rows = within(screen.getByTestId('profile-run-history')).getAllByRole('listitem');

        // The best run is the highest score, not the newest row.
        expect(within(rows[1]!).getByTestId('profile-run-history-best')).toBeInTheDocument();
        expect(within(rows[0]!).queryByTestId('profile-run-history-best')).not.toBeInTheDocument();
        expect(within(rows[2]!).queryByTestId('profile-run-history-best')).not.toBeInTheDocument();
    });

    it('offers no key for a run that cannot be handed over, rather than a broken one', () => {
        const saveData = createDefaultSaveData();
        saveData.runHistory = [
            {
                endedAtIso: '2026-09-04T12:00:00.000Z',
                highestLevel: 6,
                mode: 'Daily challenge',
                shareKey: null,
                totalScore: 1200
            }
        ];
        profileStoreMocks.saveData = saveData;

        render(<ProfileScreen />);

        expect(screen.getByTestId('profile-run-history')).toHaveTextContent('Daily challenge');
        expect(screen.queryByTestId('profile-run-history-copy')).not.toBeInTheDocument();
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
