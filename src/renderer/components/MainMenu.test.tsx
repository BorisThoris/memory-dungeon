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
const menuStore = vi.hoisted(() => ({
    state: {
        achievementBridgeNotice: null,
        clearAchievementBridgeNotice: () => undefined,
        persistenceWriteNotice: null,
        clearPersistenceWriteNotice: () => undefined,
        saveData: { onboardingDismissed: true },
        settings: { reduceMotion: true },
        updateSettings: (() => Promise.resolve()) as (settings: unknown) => Promise<void>,
        suspendedRun: null as null | { floor: number; score: number; savedAt: number; passAndPlay: boolean },
        continueSuspendedRun: (() => undefined) as () => void
    }
}));
vi.mock('../store/useAppStore', () => ({
    useAppStore: (selector: (state: unknown) => unknown) => selector(menuStore.state)
}));

describe('MainMenu REG-009 mobile landscape density', () => {
    it('keeps Play dominant and secondary actions in a compact group', async () => {
        const user = userEvent.setup();
        const onOpenProfile = vi.fn();
        render(
            <MainMenu
                onOpenCodex={vi.fn()}
                onOpenCollection={vi.fn()}
                onOpenInventory={vi.fn()}
                onOpenProfile={onOpenProfile}
                onOpenSettings={vi.fn()}
                onPlay={vi.fn()}
                reduceMotion
                saveData={createDefaultSaveData()}
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

    it('offers the Tutorial Hall instead of a long first-run help panel', () => {
        render(
            <MainMenu
                onOpenCodex={vi.fn()}
                onOpenCollection={vi.fn()}
                onOpenInventory={vi.fn()}
                onOpenProfile={vi.fn()}
                onOpenSettings={vi.fn()}
                onPlay={vi.fn()}
                reduceMotion
                saveData={createDefaultSaveData()}
            />
        );

        expect(screen.getByRole('button', { name: 'Tutorial Hall' })).toBeInTheDocument();
        expect(screen.queryByTestId('main-menu-help-center')).not.toBeInTheDocument();
    });
});

describe('MainMenu as a title page', () => {
    const props = {
        onOpenCodex: vi.fn(),
        onOpenCollection: vi.fn(),
        onOpenInventory: vi.fn(),
        onOpenProfile: vi.fn(),
        onOpenSettings: vi.fn(),
        onPlay: vi.fn(),
        reduceMotion: true
    };

    it('lists the contents as a numbered ladder, Play first, in reading order', () => {
        render(<MainMenu {...props} saveData={createDefaultSaveData()} />);
        const group = screen.getByRole('group', { name: /primary actions/i });
        const names = [...group.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
        expect(names).toEqual(['Play', 'Tutorial Hall', 'Collection', 'Profile', 'Inventory', 'Codex', 'Settings']);
        expect(group.textContent).toMatch(/^I\s*Play/);
        expect(group.textContent).toContain('VIISettings');
        // The title and global champion are headings; the contents remain an action ladder.
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Memory\s*Dungeon/);
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Dungeon Master');
        expect(group.querySelectorAll('h1, h2, h3')).toHaveLength(0);
    });

    it('puts a run left mid-way first, as Continue, with a new run beside it', async () => {
        const user = userEvent.setup();
        const continueSuspendedRun = vi.fn();
        const onPlay = vi.fn();
        menuStore.state.suspendedRun = { floor: 7, score: 12_345, savedAt: 1, passAndPlay: false };
        menuStore.state.continueSuspendedRun = continueSuspendedRun;
        try {
            render(<MainMenu {...props} onPlay={onPlay} saveData={createDefaultSaveData()} />);
            const group = screen.getByRole('group', { name: /primary actions/i });
            const names = [...group.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
            expect(names.slice(0, 3)).toEqual(['Continue', 'New run', 'Tutorial Hall']);
            expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
            expect(screen.getByTestId('main-menu-continue')).toHaveTextContent('Floor 7 · 12,345 score');
            await user.click(screen.getByRole('button', { name: 'Continue' }));
            expect(continueSuspendedRun).toHaveBeenCalledTimes(1);
            await user.click(screen.getByRole('button', { name: 'New run' }));
            expect(onPlay).toHaveBeenCalledTimes(1);
        } finally {
            menuStore.state.suspendedRun = null;
        }
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
