import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { useAppStore } from '../store/useAppStore';
import SettingsScreen from './SettingsScreen';

vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => ({ width: 1280, height: 800 })
}));

describe('SettingsScreen', () => {
    beforeEach(() => {
        const saveData = createDefaultSaveData();
        useAppStore.setState({
            hydrated: true,
            saveData,
            settings: saveData.settings,
            closeSettings: vi.fn(),
            updateSettings: vi.fn().mockResolvedValue(undefined)
        });
    });

    it('opens a confirmation when Back is pressed with a dirty draft', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);

        await user.click(screen.getByRole('button', { name: /accessibility/i }));
        const reduceMotion = screen.getByRole('checkbox', { name: /reduce motion/i });
        await user.click(reduceMotion);

        await user.click(screen.getByRole('button', { name: 'Back' }));

        expect(screen.getByTestId('settings-unsaved-back-modal')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Discard' }));

        expect(useAppStore.getState().closeSettings).toHaveBeenCalled();
    });

    it('REG-006 keeps mobile settings footer reachable in stacked layout', () => {
        render(<SettingsScreen presentation="modal" />);

        const shell = screen.getByTestId('settings-modal-shell');
        expect(shell).toHaveAttribute('data-settings-layout', 'wide-short');
        expect(screen.getByTestId('settings-shell-footer')).toHaveTextContent('Back');
        expect(screen.getByTestId('settings-shell-footer')).toHaveTextContent('Save');
    });

    it('REG-032 explains local save scope, profile summary, and destructive reset boundaries', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);

        await user.click(screen.getByRole('button', { name: /about/i }));
        expect(screen.getByTestId('settings-save-trust')).toHaveTextContent(/Single local profile/);
        expect(screen.getByTestId('settings-save-trust')).toHaveTextContent(/Cloud sync/);
        expect(screen.getByTestId('settings-profile-summary')).toHaveTextContent(/Profile level/);

        await user.click(screen.getByRole('button', { name: /^reset$/i }));
        expect(screen.getByText(/Save data, profile level, history, honors, and cosmetics are not deleted/)).toBeInTheDocument();
    });

    it('REG-036 labels reference controls as non-persisted future rows', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);

        await user.click(screen.getByRole('button', { name: /^gameplay reference$/i }));

        const reference = screen.getByTestId('settings-gameplay-reference');
        expect(reference).toHaveTextContent(/Difficulty/);
        expect(reference).toHaveTextContent(/Not in Steam demo/);
        expect(reference).toHaveTextContent(/GAME_RULES_VERSION/);
        expect(reference).toHaveTextContent(/Card theme/);
    });

    it('REG-054 surfaces premium economy policy without ad or IAP promises', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);

        await user.click(screen.getByRole('button', { name: /about/i }));
        const policy = screen.getByTestId('settings-premium-economy-policy');
        expect(policy).toHaveTextContent(/Premium offline-first/);
        expect(policy).toHaveTextContent(/Fairness is never monetized/);
        expect(policy).toHaveTextContent(/No rewarded ads/);
        expect(policy).not.toHaveTextContent(/buy gems|microtransaction|premium currency/i);
    });

    it('opens on the settings themselves, with no developer control-center strip', () => {
        render(<SettingsScreen presentation="page" />);

        expect(screen.queryByTestId('settings-control-center-strip')).toBeNull();
        expect(screen.getByTestId('settings-shell-panel')).toBeInTheDocument();
        expect(screen.queryByText(/Live controls|Reference placeholders|Profile trust|Mobile reachability/)).toBeNull();
    });
});

describe('the crash reports line in Settings', () => {
    beforeEach(() => {
        const saveData = createDefaultSaveData();
        useAppStore.setState({
            closeSettings: vi.fn(),
            hydrated: true,
            saveData,
            settings: saveData.settings,
            updateSettings: vi.fn().mockResolvedValue(undefined)
        });
    });

    const openAbout = async (user: ReturnType<typeof userEvent.setup>) => {
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /about/i }));
    };

    it('names the folder so a report can actually be found and sent', async () => {
        useAppStore.setState({
            priorCrashNotice: '2 crash reports from earlier sessions, in /home/p/.config/Memory Dungeon/crash-logs'
        });
        await openAbout(userEvent.setup());

        // The summary existed for a long time with a console.warn as its only consumer, which no
        // player has ever read. Local-only logs are worth nothing if nobody is told where they are.
        const row = screen.getByTestId('settings-crash-reports');
        expect(row).toHaveTextContent('2 crash reports');
        expect(row).toHaveTextContent('crash-logs');
        expect(row).toHaveTextContent('Reports stay on this machine');
    });

    it('says so plainly when nothing has crashed', async () => {
        useAppStore.setState({ priorCrashNotice: null });
        await openAbout(userEvent.setup());

        expect(screen.getByTestId('settings-crash-reports')).toHaveTextContent('No crash reports');
    });
});
