import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { useAppStore } from '../store/useAppStore';
import FlashingLightsNotice from './FlashingLightsNotice';
import { FLASHING_NOTICE_STORAGE_KEY } from '../copy/flashingLightsCopy';

const newPlayer = (reduceMotion: boolean, onboardingDismissed = false): void => {
    const saveData = createDefaultSaveData();
    const settings = { ...saveData.settings, reduceMotion };
    useAppStore.setState({ saveData: { ...saveData, onboardingDismissed, settings }, settings, updateSettings: vi.fn().mockResolvedValue(undefined) });
};

describe('the word about flashing light', () => {
    beforeEach(() => window.localStorage.clear());

    it('tells a new player once, and turns Reduce Motion on from the note itself', async () => {
        newPlayer(false);
        const user = userEvent.setup();
        const { unmount } = render(<FlashingLightsNotice />);
        expect(screen.getByTestId('flashing-lights-notice')).toHaveTextContent('Reduce Motion stops the flashing');
        await user.click(screen.getByRole('button', { name: 'Turn on Reduce Motion' }));
        expect(useAppStore.getState().updateSettings).toHaveBeenCalledWith(expect.objectContaining({ reduceMotion: true }));
        expect(screen.queryByTestId('flashing-lights-notice')).toBeNull();
        unmount();
        // Put away for good on this device.
        render(<FlashingLightsNotice />);
        expect(screen.queryByTestId('flashing-lights-notice')).toBeNull();
        expect(window.localStorage.getItem(FLASHING_NOTICE_STORAGE_KEY)).toBe('yes');
    });

    it('says nothing with Reduce Motion already on, or to a returning player', () => {
        newPlayer(true);
        const { unmount } = render(<FlashingLightsNotice />);
        expect(screen.queryByTestId('flashing-lights-notice')).toBeNull();
        unmount();
        newPlayer(false, true);
        render(<FlashingLightsNotice />);
        expect(screen.queryByTestId('flashing-lights-notice')).toBeNull();
    });
});
