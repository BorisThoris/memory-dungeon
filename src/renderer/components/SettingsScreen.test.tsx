import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { useAppStore } from '../store/useAppStore';
import SettingsScreen from './SettingsScreen';
import { useDevOptions } from '../dev/useDevOptions';
import { serializeSaveExport } from '../saveTransfer';

vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => ({ width: 1280, height: 800 })
}));

describe('SettingsScreen', () => {
    beforeEach(() => {
        useDevOptions.getState().setComboPopEffects(true);
        const saveData = createDefaultSaveData();
        useAppStore.setState({
            hydrated: true,
            saveData,
            settings: saveData.settings,
            closeSettings: vi.fn(),
            updateSettings: vi.fn().mockResolvedValue(undefined)
        });
    });

    it('remembers the immediate combo pop switch in Effects without changing run settings', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<SettingsScreen />);
        await user.click(screen.getByRole('button', { name: /^effects$/i }));
        await user.click(screen.getByRole('checkbox', { name: /combo pop effects/i }));
        expect(useDevOptions.getState().comboPopEffects).toBe(false);
        expect(localStorage.getItem('memory-dungeon.dev.combo-pop-effects')).toBe('off');
        expect(useAppStore.getState().updateSettings).not.toHaveBeenCalled();
        unmount();
        render(<SettingsScreen />);
        await user.click(screen.getByRole('button', { name: /^effects$/i }));
        expect(screen.getByRole('checkbox', { name: /combo pop effects/i })).not.toBeChecked();
        await user.click(screen.getByRole('checkbox', { name: /combo pop effects/i }));
        expect(localStorage.getItem('memory-dungeon.dev.combo-pop-effects')).toBe('on');
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
        expect(screen.getByTestId('settings-save-trust')).toHaveTextContent(/One profile, saved on this device/);
        expect(screen.getByTestId('settings-save-trust')).toHaveTextContent(/Cloud sync/);
        expect(screen.getByTestId('settings-profile-summary')).toHaveTextContent(/Profile level/);

        await user.click(screen.getByRole('button', { name: /^reset$/i }));
        expect(screen.getByText(/Your saves, profile level,\s+history, honors and cosmetics are kept/)).toBeInTheDocument();
    });

    it('leaves unavailable settings and implementation notes out of player controls', () => {
        render(<SettingsScreen presentation="page" />);
        expect(screen.queryByRole('button', { name: /^gameplay reference$/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('settings-gameplay-reference')).not.toBeInTheDocument();
        expect(screen.queryByText(/GAME_RULES_VERSION/)).not.toBeInTheDocument();
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

describe('About: credits, licences, the privacy policy and deleting progress', () => {
    beforeEach(() => {
        const saveData = createDefaultSaveData();
        useAppStore.setState({
            closeSettings: vi.fn(),
            hydrated: true,
            run: null,
            saveData,
            settings: saveData.settings,
            updateSettings: vi.fn().mockResolvedValue(undefined),
            deleteAllProgress: vi.fn().mockResolvedValue(undefined)
        });
    });

    it('credits the people and the software the game is made with, and links the privacy policy', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /about/i }));
        const privacy = screen.getByTestId('settings-privacy-link');
        expect(privacy).toHaveAttribute('href', 'https://memory-dungeon-git.pages.dev/privacy');
        expect(privacy).toHaveAttribute('rel', expect.stringContaining('noopener'));
        await user.click(screen.getByRole('button', { name: /^credits$/i }));
        expect(screen.getByTestId('settings-credits')).toHaveTextContent('Kenney');
        expect(screen.getByTestId('settings-credits')).toHaveTextContent('SIL Open Font License 1.1');
        expect(screen.getByTestId('settings-licences')).toHaveTextContent('three.js');
    });

    it('deletes progress only after a second, explicit yes', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /about/i }));
        await user.click(screen.getByRole('button', { name: /^reset$/i }));
        await user.click(screen.getByTestId('settings-delete-progress'));
        expect(screen.getByTestId('settings-delete-progress-modal')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Keep my progress' }));
        expect(useAppStore.getState().deleteAllProgress).not.toHaveBeenCalled();
        await user.click(screen.getByTestId('settings-delete-progress'));
        await user.click(screen.getByRole('button', { name: 'Delete everything' }));
        expect(useAppStore.getState().deleteAllProgress).toHaveBeenCalledTimes(1);
        expect(await screen.findByText(/Progress deleted/)).toBeInTheDocument();
    });

    it('imports progress from another device only after a yes, and refuses a file that is not a save', async () => {
        useAppStore.setState({ importSaveData: vi.fn().mockResolvedValue(undefined) });
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /about/i }));
        await user.click(screen.getByRole('button', { name: /^move progress$/i }));
        expect(screen.getByTestId('settings-export-progress')).toBeInTheDocument();
        const picker = screen.getByTestId('settings-import-progress').querySelector('input[type="file"]')!;

        await user.upload(picker as HTMLInputElement, new File(['not a save'], 'notes.json', { type: 'application/json' }));
        expect(await screen.findByTestId('settings-transfer-note')).toHaveTextContent('not a Memory Dungeon save');

        const exported = serializeSaveExport({ ...createDefaultSaveData(), bestScore: 777 }, new Date());
        await user.upload(picker as HTMLInputElement, new File([exported], 'save.json', { type: 'application/json' }));
        const modal = await screen.findByTestId('settings-import-progress-modal');
        expect(modal).toHaveTextContent('best score 777');
        await user.click(screen.getByRole('button', { name: 'Replace it' }));
        expect(useAppStore.getState().importSaveData).toHaveBeenCalledWith(expect.objectContaining({ bestScore: 777 }));
        expect(await screen.findByText('Progress imported.')).toBeInTheDocument();
    });

    it('does not offer it in the middle of a run', async () => {
        useAppStore.setState({ run: { status: 'playing' } as never });
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /about/i }));
        await user.click(screen.getByRole('button', { name: /^reset$/i }));
        expect(screen.queryByTestId('settings-delete-progress')).toBeNull();
        useAppStore.setState({ run: null });
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

describe('Keys, High Contrast and What’s new', () => {
    beforeEach(() => {
        const saveData = createDefaultSaveData();
        useAppStore.setState({
            closeSettings: vi.fn(),
            hydrated: true,
            run: null,
            saveData,
            settings: saveData.settings,
            updateSettings: vi.fn().mockResolvedValue(undefined)
        });
    });

    it('saves a rebound key with the rest of the settings, and the Input line follows it', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /^controls/i }));
        expect(screen.getByText(/P pauses\./)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /^keys$/i }));
        await user.click(screen.getByRole('button', { name: 'Change Pause key' }));
        await user.keyboard('o');
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(useAppStore.getState().updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({ keyBindings: expect.objectContaining({ pause: 'KeyO' }) })
        );
    });

    it('offers High Contrast beside Reduce Motion and saves it', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /accessibility/i }));
        await user.click(screen.getByRole('checkbox', { name: /high contrast/i }));
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(useAppStore.getState().updateSettings).toHaveBeenCalledWith(expect.objectContaining({ highContrast: true }));
    });

    it('lists what changed, newest week first', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);
        await user.click(screen.getByRole('button', { name: /about/i }));
        await user.click(screen.getByRole('button', { name: /what’s new/i }));
        const notes = screen.getByTestId('settings-patch-notes');
        expect(notes.firstElementChild).toHaveTextContent('Week of 2026-11-09');
        expect(notes).toHaveTextContent('Continue');
    });
});
