import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import MainMenu from './MainMenu';

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => ({ width: 640, height: 390 })
}));
vi.mock('../platformTilt/usePlatformTiltField', () => ({
    usePlatformTiltField: () => ({ tiltRef: { current: null } })
}));
// A browser tab, as far as the menu can tell: no Electron bridge, so no window to exit.
vi.mock('../desktop-client', () => ({
    desktopClient: { quitApp: vi.fn() },
    hasDesktopBridge: () => false
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
        render(
            <MainMenu
                onDismissHowToPlay={async () => undefined}
                onOpenCodex={vi.fn()}
                onOpenCollection={vi.fn()}
                onOpenInventory={vi.fn()}
                onOpenProfile={onOpenProfile}
                onOpenSettings={vi.fn()}
                onPlay={vi.fn()}
                reduceMotion
                saveData={createDefaultSaveData()}
                showHowToPlay={false}
            />
        );

        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Collection' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
        // The showcase button is gone: it started Classic on a staged board with records off,
        // which is a way to show the dungeon rather than a way to play it.
        expect(screen.queryByRole('button', { name: 'Dungeon Showcase' })).toBeNull();
        // Exit Game closes an Electron window; in a browser tab it closed nothing, so it is not offered.
        expect(screen.queryByRole('button', { name: /exit game/i })).toBeNull();
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

describe('MainMenu as a title page', () => {
    const props = {
        onDismissHowToPlay: async () => undefined,
        onOpenCodex: vi.fn(),
        onOpenCollection: vi.fn(),
        onOpenInventory: vi.fn(),
        onOpenProfile: vi.fn(),
        onOpenSettings: vi.fn(),
        onPlay: vi.fn(),
        reduceMotion: true,
        showHowToPlay: false
    };

    it('lists the contents as a numbered ladder, Play first, in reading order', () => {
        render(<MainMenu {...props} saveData={createDefaultSaveData()} />);
        const group = screen.getByRole('group', { name: /primary actions/i });
        const names = [...group.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
        expect(names).toEqual(['Play', 'Collection', 'Profile', 'Inventory', 'Codex', 'Settings']);
        expect(group.textContent).toMatch(/^I\s*Play/);
        expect(group.textContent).toContain('VISettings');
        // The one document heading is the title; nothing in the contents is a heading.
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Memory\s*Dungeon/);
        expect(screen.queryAllByRole('heading')).toHaveLength(1);
    });

    it('says where the profile stands in the colophon, and what the last descent reached', () => {
        const fresh = createDefaultSaveData();
        const { unmount } = render(<MainMenu {...props} saveData={fresh} />);
        expect(screen.getByTestId('main-menu-colophon')).toHaveTextContent(/Level 1.*Best 0/);
        expect(screen.getByTestId('main-menu-colophon')).not.toHaveTextContent(/Last descent/);
        expect(screen.getByRole('button', { name: 'Play' })).toHaveTextContent(/Begin the descent/);
        unmount();

        const returning = {
            ...fresh,
            bestScore: 12_340,
            lastRunSummary: {
                ...(fresh.lastRunSummary ?? {}),
                totalScore: 12_340,
                bestScore: 12_340,
                levelsCleared: 6,
                highestLevel: 7,
                achievementsEnabled: true,
                unlockedAchievements: [],
                bestStreak: 4,
                perfectClears: 1
            }
        };
        render(<MainMenu {...props} saveData={returning} />);
        expect(screen.getByTestId('main-menu-colophon')).toHaveTextContent(/Best 12,340.*Last descent to floor 7/);
        expect(screen.getByRole('button', { name: 'Play' })).toHaveTextContent(/Floor 7 last time/);
    });

    it('does not scale the page: no zoom anywhere in the shell', () => {
        const { container } = render(<MainMenu {...props} saveData={createDefaultSaveData()} />);
        const zoomed = [...container.querySelectorAll<HTMLElement>('[style]')].filter((el) => el.style.zoom !== '');
        expect(zoomed).toHaveLength(0);
    });
});
