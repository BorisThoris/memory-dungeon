import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { SAVE_RECOVERY_COPY } from '../copy/saveRecoveryNotice';
import MainMenu from './MainMenu';

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('../hooks/useViewportSize', () => ({ useViewportSize: () => ({ height: 800, width: 1280 }) }));
vi.mock('../hooks/useFitShellZoom', () => ({ useFitShellZoom: () => ({ fitZoom: 1 }) }));
vi.mock('../platformTilt/usePlatformTiltField', () => ({
    usePlatformTiltField: () => ({ tiltRef: { current: null } })
}));
vi.mock('../desktop-client', () => ({ desktopClient: { quitApp: vi.fn() } }));
vi.mock('../audio/uiSfx', () => ({
    playMenuOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({ useShallow: <T,>(fn: T) => fn }));

const storeMocks = vi.hoisted(() => ({
    recoverUnreadableSave: vi.fn(),
    saveReadFailureNotice: null as string | null,
    saveWritesBlockedByReadFailure: false
}));

vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) =>
        selector({
            achievementBridgeNotice: null,
            clearAchievementBridgeNotice: vi.fn(),
            clearPersistenceWriteNotice: vi.fn(),
            persistenceWriteNotice: null,
            recoverUnreadableSave: storeMocks.recoverUnreadableSave,
            saveReadFailureNotice: storeMocks.saveReadFailureNotice,
            saveWritesBlockedByReadFailure: storeMocks.saveWritesBlockedByReadFailure
        })
}));

const renderMenu = () =>
    render(
        <MainMenu
            onDismissHowToPlay={async () => undefined}
            onOpenCodex={vi.fn()}
            onOpenCollection={vi.fn()}
            onOpenInventory={vi.fn()}
            onOpenProfile={vi.fn()}
            onOpenSettings={vi.fn()}
            onPlay={vi.fn()}
            onStartDungeonShowcase={vi.fn()}
            reduceMotion
            saveData={createDefaultSaveData()}
            showHowToPlay={false}
        />
    );

describe('the notice shown when a save cannot be read', () => {
    it('says nothing at all when the save read fine', () => {
        storeMocks.saveReadFailureNotice = null;
        storeMocks.saveWritesBlockedByReadFailure = false;
        renderMenu();

        expect(screen.queryByText(SAVE_RECOVERY_COPY.title)).toBeNull();
    });

    it('reaches the player rather than sitting in the store', async () => {
        // The whole point of this test: the notice was computed and stored for a long time while
        // nothing rendered it, so a player whose save failed to load just quietly stopped saving.
        storeMocks.recoverUnreadableSave.mockReset();
        storeMocks.saveReadFailureNotice = 'Save read failed.';
        storeMocks.saveWritesBlockedByReadFailure = true;
        const user = userEvent.setup();
        renderMenu();

        expect(screen.getByRole('alert')).toHaveTextContent(SAVE_RECOVERY_COPY.title);
        expect(screen.getByRole('alert')).toHaveTextContent('Save read failed.');
        // And the way out has to be an actual affordance, not just an explanation.
        expect(screen.getByRole('alert')).toHaveTextContent(SAVE_RECOVERY_COPY.detail);

        await user.click(screen.getByRole('button', { name: SAVE_RECOVERY_COPY.action }));
        expect(storeMocks.recoverUnreadableSave).toHaveBeenCalledTimes(1);
    });

    it('offers no fresh profile when writes are not blocked', () => {
        storeMocks.saveReadFailureNotice = 'Could not start a fresh profile.';
        storeMocks.saveWritesBlockedByReadFailure = false;
        renderMenu();

        expect(screen.getByRole('alert')).toHaveTextContent('Could not start a fresh profile.');
        expect(screen.queryByRole('button', { name: SAVE_RECOVERY_COPY.action })).toBeNull();
    });
});
