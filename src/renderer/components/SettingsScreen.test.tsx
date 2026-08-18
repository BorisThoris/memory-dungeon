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
        expect(screen.getByTestId('settings-save-state')).toHaveTextContent('Saved');
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('shows the save action only after settings become dirty', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);

        expect(screen.getByTestId('settings-save-state')).toHaveTextContent('Saved');
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /accessibility/i }));
        await user.click(screen.getByRole('checkbox', { name: /reduce motion/i }));

        expect(screen.getByTestId('settings-save-state')).toHaveTextContent('Unsaved');
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
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

    it('REG-092 surfaces settings as a searchable control center with persistence mapping', () => {
        render(<SettingsScreen presentation="page" />);

        const strip = screen.getByTestId('settings-control-center-strip');
        expect(strip).toHaveTextContent(/Live controls/);
        expect(strip).toHaveTextContent(/saved preferences/);
        expect(strip).toHaveTextContent(/Reference placeholders/);
    });

    it('uses readable compact labels for gameplay subsection tabs', () => {
        render(<SettingsScreen presentation="page" />);

        expect(screen.getByRole('button', { name: /^gameplay reference$/i })).toHaveAttribute(
            'data-compact-label',
            'Guide'
        );
    });

    it('REG-101 compacts desktop settings chrome for lighter categories', async () => {
        const user = userEvent.setup();
        render(<SettingsScreen presentation="page" />);

        const shell = screen.getByText('Settings').closest('section');
        expect(shell).not.toBeNull();
        expect(shell).toHaveAttribute('data-settings-density', 'expanded');

        await user.click(screen.getByRole('button', { name: /audio/i }));

        expect(shell).toHaveAttribute('data-settings-density', 'compact');
    });
});
