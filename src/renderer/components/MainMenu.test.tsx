import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import MainMenu from './MainMenu';

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => ({ width: 640, height: 390 })
}));
vi.mock('../hooks/useFitShellZoom', () => ({
    useFitShellZoom: () => ({ fitZoom: 1 })
}));
vi.mock('../platformTilt/usePlatformTiltField', () => ({
    usePlatformTiltField: () => ({ tiltRef: { current: null } })
}));
vi.mock('../desktop-client', () => ({
    desktopClient: { quitApp: vi.fn() }
}));
vi.mock('../audio/uiSfx', () => ({
    playMenuOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: () => 0
}));
vi.mock('zustand/react/shallow', () => ({
    useShallow: <T,>(fn: T) => fn
}));
vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) =>
        selector({
            achievementBridgeNotice: null,
            clearAchievementBridgeNotice: vi.fn(),
            persistenceWriteNotice: null,
            clearPersistenceWriteNotice: vi.fn()
        })
}));

describe('MainMenu REG-009 mobile landscape density', () => {
    it('keeps Play dominant and secondary actions in a compact group', async () => {
        const user = userEvent.setup();
        const onOpenProfile = vi.fn();
        const onStartDungeonShowcase = vi.fn();
        render(
            <MainMenu
                onDismissHowToPlay={async () => undefined}
                onOpenCodex={vi.fn()}
                onOpenCollection={vi.fn()}
                onOpenInventory={vi.fn()}
                onOpenProfile={onOpenProfile}
                onOpenSettings={vi.fn()}
                onPlay={vi.fn()}
                onStartDungeonShowcase={onStartDungeonShowcase}
                reduceMotion
                saveData={createDefaultSaveData()}
                showHowToPlay={false}
            />
        );

        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Dungeon Showcase' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Collection' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Dungeon Showcase' }));
        expect(onStartDungeonShowcase).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole('button', { name: 'Profile' }));
        expect(onOpenProfile).toHaveBeenCalledTimes(1);
    });

    it('REG-098 surfaces skippable first-run help center beats', () => {
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
                showHowToPlay
            />
        );

        const help = screen.getByTestId('main-menu-help-center');
        expect(help).toHaveTextContent(/Flip and match/);
        expect(screen.getByText(/Skippable help center/i)).toBeInTheDocument();
    });
});
