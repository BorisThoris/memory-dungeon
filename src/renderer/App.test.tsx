import { NotificationHost } from '@cross-repo-libs/notifications';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./components/MainMenuBackground', () => ({
    default: () => <div aria-hidden="true" data-testid="menu-background" />
}));

vi.mock('./assets/preloadStartupAssets', () => ({
    preloadStartupCriticalAssets: vi.fn(() => Promise.resolve({ relicTextureSet: null }))
}));

import App, { APP_MAIN_LANDMARK_ID } from './App';
import type { RunState } from '../shared/contracts';
import { createNewRun, finishMemorizePhase, pauseRun } from '../shared/game-core';
import { createWildRun } from '../shared/run-creation-rules';
import { generateRouteChoices } from '../shared/route-rules';
import { createRunShopOffers } from '../shared/shop-rules';
import { createDefaultSaveData } from '../shared/save-data';
import { desktopClient } from './desktop-client';
import { PlatformTiltProvider } from './platformTilt/PlatformTiltProvider';
import { useAppStore } from './store/useAppStore';

const originalMatchMedia = window.matchMedia;
const originalVisualViewport = window.visualViewport;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;
const originalHydrate = useAppStore.getState().hydrate;

const renderApp = (): ReturnType<typeof render> =>
    render(
        <PlatformTiltProvider>
            <NotificationHost>
                <App />
            </NotificationHost>
        </PlatformTiltProvider>
    );

const resetStore = (): void => {
    const saveData = createDefaultSaveData();

    act(() => {
        useAppStore.setState({
            hydrated: false,
            hydrating: false,
            steamConnected: false,
            view: 'boot',
            settingsReturnView: 'menu',
            subscreenReturnView: 'menu',
            saveData,
            settings: saveData.settings,
            run: null,
            newlyUnlockedAchievements: [],
            achievementBridgeNotice: null,
            persistenceWriteNotice: null,
            hydrate: originalHydrate
        });
    });
};

const dismissStartupIntro = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(await screen.findByRole('dialog', { name: /startup relic intro/i }));
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: /startup relic intro/i })).not.toBeInTheDocument();
    }, { timeout: 3000 });
};

const chooseClassicRun = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(await screen.findByRole('button', { name: /^play$/i }));
    await user.click(await screen.findByRole('button', { name: /^start run$/i }));
};

const findGameplayBoardStage = async (): Promise<HTMLElement> => screen.findByTestId('board-stage', undefined, { timeout: 30_000 });

describe('desktop app flow', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.matchMedia = originalMatchMedia;
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth, writable: true });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight, writable: true });
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: originalVisualViewport
        });
        resetStore();
    });

    it('exposes a skip link to the main landmark (A11Y-002)', async () => {
        const user = userEvent.setup();
        renderApp();

        const skip = screen.getByRole('link', { name: /skip to main content/i });
        expect(skip).toHaveAttribute('href', `#${APP_MAIN_LANDMARK_ID}`);

        const main = document.getElementById(APP_MAIN_LANDMARK_ID);
        expect(main?.tagName.toLowerCase()).toBe('main');

        await user.click(skip);
        expect(document.activeElement).toBe(main);
    });

    it('gates menu interaction behind the startup intro and starts an arcade run after skip', async () => {
        const user = userEvent.setup();

        renderApp();

        expect(screen.queryByRole('button', { name: /^play$/i })).not.toBeInTheDocument();

        await dismissStartupIntro(user);
        await chooseClassicRun(user);

        expect(await findGameplayBoardStage()).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /run stats/i })).toBeInTheDocument();
        expect(screen.getByTestId('hud-score')).toHaveTextContent(/score/i);
        expect(screen.getByText(/^shards$/i)).toBeInTheDocument();
    }, 45_000);

    it('turns off the app-level ambient grid while the menu or game Pixi background is active', async () => {
        const user = userEvent.setup();
        const { container } = renderApp();

        await dismissStartupIntro(user);
        await screen.findByRole('button', { name: /^play$/i });

        expect(container.firstElementChild).toHaveAttribute('data-view', 'menu');
        expect(container.firstElementChild).toHaveAttribute('data-ambient-grid', 'off');

        await chooseClassicRun(user);
        await findGameplayBoardStage();
        expect(container.firstElementChild).toHaveAttribute('data-view', 'playing');
        expect(container.firstElementChild).toHaveAttribute('data-ambient-grid', 'off');
    });

    it('opens settings and persists changes through the desktop fallback bridge', async () => {
        const user = userEvent.setup();

        renderApp();

        await dismissStartupIntro(user);
        await user.click(await screen.findByRole('button', { name: /settings/i }));
        expect(await screen.findByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
        expect(screen.queryByLabelText(/ui scale/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/debug tools/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /reduce motion/i })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /audio/i }));
        expect(screen.getByLabelText(/master volume/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/master volume/i), { target: { value: '0.45' } });
        expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
        await user.click(screen.getByRole('button', { name: /^save$/i }));

        await waitFor(() => {
            expect(window.localStorage.getItem('memory-dungeon-save-data')).not.toBeNull();
        });
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: /startup relic intro/i })).not.toBeInTheDocument();

        const rawSave = window.localStorage.getItem('memory-dungeon-save-data');
        expect(rawSave).not.toBeNull();

        const parsed = JSON.parse(rawSave ?? '{}') as ReturnType<typeof createDefaultSaveData>;
        expect(parsed.settings.masterVolume).toBe(0.45);
        expect(parsed.settings.reduceMotion).toBe(false);

        await user.click(screen.getByRole('button', { name: /^back$/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument();
        });
    });

    it('dismisses the how-to panel without completing playable onboarding', async () => {
        const user = userEvent.setup();

        renderApp();

        await dismissStartupIntro(user);
        expect(await screen.findByText(/read, match, and protect the streak/i)).toBeInTheDocument();
        await user.click(screen.getByText(/^open$/i));
        expect(screen.getByText(/score and recover/i)).toBeInTheDocument();
        expect(screen.getByText(/Codex is the deeper reference/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /dismiss/i }));

        await waitFor(() => {
            expect(screen.queryByText(/read, match, and protect the streak/i)).not.toBeInTheDocument();
        });

        const rawSave = window.localStorage.getItem('memory-dungeon-save-data');
        expect(rawSave).not.toBeNull();

        const parsed = JSON.parse(rawSave ?? '{}') as ReturnType<typeof createDefaultSaveData>;
        expect(parsed.firstRunHelpDismissed).toBe(true);
        expect(parsed.onboardingDismissed).toBe(false);
    });

    it('shows the life-bonus reason in the floor-cleared modal', async () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0);
        const run = {
            ...baseRun,
            status: 'levelComplete' as const,
            lives: 5,
            stats: {
                ...baseRun.stats,
                totalScore: 120,
                currentLevelScore: 120,
                tries: 1,
                rating: 'S' as const,
                levelsCleared: 1,
                matchesFound: 2,
                highestLevel: 1,
                currentStreak: 2,
                bestStreak: 2,
                comboShards: 1
            },
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S' as const,
                livesRemaining: 5,
                perfect: false,
                mistakes: 1,
                clearLifeReason: 'clean' as const,
                clearLifeGained: 1
            }
        };

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'playing',
                settingsReturnView: 'menu',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run,
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        expect(await screen.findByRole('dialog', { name: /floor cleared/i })).toBeInTheDocument();
        expect(screen.getByText(/clean floor bonus: \+1 life/i)).toBeInTheDocument();
    });

    it('hides the forgiveness hint after the floor has started', async () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0);
        const run = {
            ...baseRun,
            status: 'playing' as const,
            board: baseRun.board
                ? {
                      ...baseRun.board,
                      matchedPairs: 1
                  }
                : null,
            stats: {
                ...baseRun.stats,
                totalScore: 30,
                currentLevelScore: 30,
                matchesFound: 1,
                currentStreak: 1,
                bestStreak: 1
            },
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            }
        };

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'playing',
                settingsReturnView: 'menu',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run,
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        expect(await findGameplayBoardStage()).toBeInTheDocument();
        expect(screen.queryByText(/first miss each floor is free/i)).not.toBeInTheDocument();
    });

    it('suppresses the pause OverlayModal while run settings are open (OVR-009)', async () => {
        const saveData = createDefaultSaveData();
        const pausedRun = pauseRun(createNewRun(0));

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'settings',
                settingsReturnView: 'playing',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run: pausedRun,
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        expect(screen.queryByRole('dialog', { name: /run paused/i })).not.toBeInTheDocument();
        expect(await screen.findByRole('dialog', { name: /run settings/i })).toBeInTheDocument();
    });

    it('suppresses the floor-cleared OverlayModal while in-run inventory is open (OVR-009)', async () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0);
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete' as const,
            lives: 5,
            stats: {
                ...baseRun.stats,
                totalScore: 120,
                currentLevelScore: 120,
                tries: 1,
                rating: 'S' as const,
                levelsCleared: 1,
                matchesFound: 2,
                highestLevel: 1,
                currentStreak: 2,
                bestStreak: 2,
                comboShards: 1
            },
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S' as const,
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none' as const,
                clearLifeGained: 0
            },
            relicOffer: null
        };

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'inventory',
                settingsReturnView: 'menu',
                subscreenReturnView: 'playing',
                saveData,
                settings: saveData.settings,
                run,
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        expect(screen.queryByRole('dialog', { name: /floor cleared/i })).not.toBeInTheDocument();
        expect(await screen.findByRole('region', { name: /inventory/i })).toBeInTheDocument();
    });

    it('renders the dedicated shop over gameplay and suppresses the floor-cleared modal', async () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0);
        const runBase: RunState = {
            ...baseRun,
            status: 'levelComplete',
            shopGold: 5,
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S',
                livesRemaining: baseRun.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0
            },
            relicOffer: null
        };

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'shop',
                settingsReturnView: 'menu',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run: {
                    ...runBase,
                    shopOffers: createRunShopOffers(runBase)
                },
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        expect(screen.queryByRole('dialog', { name: /floor cleared/i })).not.toBeInTheDocument();
        expect(await screen.findByRole('dialog', { name: /vendor alcove/i })).toBeInTheDocument();
        expect(screen.getByTestId('game-hud')).toBeInTheDocument();
    });

    it('shows a finished run on Profile, which is the only place it survives', async () => {
        // The history is written at game over and read on Profile; this is the seam between them.
        const saveData = createDefaultSaveData();
        saveData.runHistory = [
            {
                endedAtIso: '2026-09-04T12:00:00.000Z',
                highestLevel: 9,
                mode: 'Scholar Contract',
                shareKey: 'md1:scholar:33:404',
                totalScore: 2100
            }
        ];

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'profile',
                settingsReturnView: 'menu',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run: null,
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        // Profile opens on what the player is part-way through; the run list is one tab over.
        fireEvent.click(await screen.findByTestId('profile-ledger-runs', undefined, { timeout: 10_000 }));
        const history = await screen.findByTestId('profile-run-history', undefined, { timeout: 10_000 });
        expect(history).toHaveTextContent('Scholar Contract');
        expect(history).toHaveTextContent('Floor 9');
    });

    it('names the run mode in the HUD of a real gameplay view, not just in the catalog', async () => {
        // PPI-006: every mode's start contract promises the HUD says which mode this is. The
        // component test proves RunShell can render it; this proves the app actually mounts the
        // shell that does, on a run that is not the default endless one.
        const saveData = createDefaultSaveData();
        const wildRun = finishMemorizePhase(createWildRun(0));

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'playing',
                settingsReturnView: 'menu',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run: wildRun,
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        // GameScreen is lazy: the shell shows "Loading run..." until the chunk resolves.
        expect(await screen.findByTestId('game-hud', undefined, { timeout: 10_000 })).toBeInTheDocument();
        expect(screen.getByTestId('hud-mode-identity')).toHaveTextContent(/Wild Run/i);
    });

    it('renders the route side-room overlay over gameplay', async () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0);
        const runBase: RunState = {
            ...baseRun,
            status: 'levelComplete',
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S',
                livesRemaining: baseRun.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0
            },
            relicOffer: null,
            sideRoom: {
                id: 'test-side-room',
                kind: 'bonus_reward',
                routeType: 'greed',
                nodeKind: 'treasure',
                floor: 2,
                title: 'Greed Treasure chest',
                body: 'A route reward waits before the next floor.',
                primaryLabel: 'Claim Treasure chest',
                primaryDetail: '+2 shop gold and +25 score.',
                skipLabel: 'Leave it',
                payload: { kind: 'bonus_reward', instanceId: 'missing' }
            }
        };

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'sideRoom',
                settingsReturnView: 'menu',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run: runBase,
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        expect(screen.queryByRole('dialog', { name: /floor cleared/i })).not.toBeInTheDocument();
        expect(await screen.findByRole('dialog', { name: /route side room/i })).toBeInTheDocument();
        expect(screen.getByText(/greed treasure chest/i)).toBeInTheDocument();
        expect(screen.getByTestId('game-hud')).toBeInTheDocument();
    });

    it('normalizes invalid shop view to playing when the run is not level complete', async () => {
        const saveData = createDefaultSaveData();
        const baseRun = createNewRun(0);

        act(() => {
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                steamConnected: false,
                view: 'shop',
                settingsReturnView: 'menu',
                subscreenReturnView: 'menu',
                saveData,
                settings: saveData.settings,
                run: { ...baseRun, status: 'playing' },
                newlyUnlockedAchievements: [],
                hydrate: async () => {}
            });
        });

        renderApp();

        await waitFor(() => {
            expect(useAppStore.getState().view).toBe('playing');
        });
    });

    it(
        'pauses and resumes the run via P and the pause modal',
        async () => {
            const user = userEvent.setup();

            renderApp();

            await dismissStartupIntro(user);
            await chooseClassicRun(user);
            expect(await findGameplayBoardStage()).toBeInTheDocument();

            await user.keyboard('p');
            const modalTitle = await screen.findByRole('heading', { name: /run paused/i });
            expect(modalTitle).toBeInTheDocument();

            const inertScope = screen.getByTestId('game-shell').querySelector('[data-a11y-gameplay-inert="true"]');
            expect(inertScope).not.toBeNull();
            expect(inertScope).toHaveAttribute('inert', '');

            const modal = modalTitle.closest('section');
            expect(modal).not.toBeNull();

            await user.click(within(modal as HTMLElement).getByRole('button', { name: /resume/i }));

            await waitFor(() => {
                expect(screen.queryByText(/run paused/i)).not.toBeInTheDocument();
            });
        },
        30_000
    );

    it(
        'opens run settings as a modal over the board',
        async () => {
            const user = userEvent.setup();

            renderApp();

            await dismissStartupIntro(user);
            await chooseClassicRun(user);
            expect(await findGameplayBoardStage()).toBeInTheDocument();

            await user.click(await screen.findByRole('button', { name: /pause and open the run menu/i }));
            await user.click(await screen.findByRole('button', { name: /^settings$/i }));

            const dialog = await screen.findByRole('dialog', { name: /run settings/i });
            expect(dialog).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: /level 1/i })).toBeInTheDocument();
            expect(screen.queryByRole('heading', { name: /run paused/i })).not.toBeInTheDocument();
            expect(within(dialog).queryByLabelText(/ui scale/i)).not.toBeInTheDocument();
            expect(within(dialog).queryByText(/debug tools/i)).not.toBeInTheDocument();
            expect(within(dialog).queryByRole('checkbox', { name: /reduce motion/i })).not.toBeInTheDocument();
            await user.click(within(dialog).getByRole('button', { name: /audio/i }));
            expect(within(dialog).getByLabelText(/master volume/i)).toBeInTheDocument();
            expect(within(dialog).queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
            expect(within(dialog).getByRole('button', { name: /^back$/i })).toBeInTheDocument();
            expect(within(dialog).getByRole('button', { name: /^save$/i })).toBeDisabled();

            fireEvent.change(within(dialog).getByLabelText(/master volume/i), { target: { value: '0.35' } });
            expect(within(dialog).getByRole('button', { name: /^save$/i })).toBeEnabled();
            await user.click(within(dialog).getByRole('button', { name: /^save$/i }));

            await waitFor(() => {
                expect(screen.getByRole('dialog', { name: /run settings/i })).toBeInTheDocument();
            });

            await user.click(within(dialog).getByRole('button', { name: /^back$/i }));

            await waitFor(() => {
                expect(screen.queryByRole('dialog', { name: /run settings/i })).not.toBeInTheDocument();
            });
            expect(screen.getByRole('heading', { name: /level 1/i })).toBeInTheDocument();
        },
        30_000
    );

    it('shows the Fit board control in the gameplay camera viewport', async () => {
        const user = userEvent.setup();

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390, writable: true });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844, writable: true });
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: {
                width: 390,
                height: 844,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            }
        });
        window.matchMedia = vi.fn((query: string) => ({
            matches: query.includes('pointer: coarse'),
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
            onchange: null
        })) as typeof window.matchMedia;

        renderApp();

        await dismissStartupIntro(user);
        await chooseClassicRun(user);

        await user.click(await screen.findByRole('button', { name: /pause and open the run menu/i }));
        expect(await screen.findByRole('button', { name: /fit board/i })).toBeInTheDocument();
    });

    it('shows the Fit board control on desktop gameplay too', async () => {
        const user = userEvent.setup();

        renderApp();

        await dismissStartupIntro(user);
        await chooseClassicRun(user);

        await user.click(await screen.findByRole('button', { name: /pause and open the run menu/i }));
        expect(await screen.findByRole('button', { name: /fit board/i })).toBeInTheDocument();
    });

    it('opens Choose Your Path from Play and keeps Endless Mode locked in Browse modes', async () => {
        const user = userEvent.setup();
        renderApp();
        await dismissStartupIntro(user);
        await user.click(await screen.findByRole('button', { name: /^play$/i }));
        const choosePath = await screen.findByRole('region', { name: /choose your path/i });
        expect(choosePath).toBeInTheDocument();
        expect(await screen.findByRole('region', { name: /browse modes/i })).toBeInTheDocument();
        // Endless was a locked card promising a longer Classic and never became one; the browse
        // grid now holds the authored puzzles, which are the only entries that build a different
        // board rather than the same one with a setting changed.
        expect(screen.queryByRole('button', { name: /endless mode/i })).toBeNull();
        await waitFor(() => {
            expect(within(choosePath).getAllByText(/puzzle/i).length).toBeGreaterThan(0);
        });
    }, 30_000);

    it('explains and disables greedy route choice when the run is on its last life', async () => {
        const baseRun = createNewRun(0, { runSeed: 88_120 });
        const routeChoices = generateRouteChoices(baseRun, 2);
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            lives: 1,
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S',
                livesRemaining: 1,
                perfect: false,
                mistakes: 1,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                routeChoices
            }
        };

        act(() => {
            const saveData = createDefaultSaveData();
            useAppStore.setState({
                hydrated: true,
                hydrating: false,
                view: 'playing',
                run,
                saveData,
                settings: saveData.settings
            });
        });

        renderApp();

        expect(await screen.findByRole('dialog', { name: /floor cleared/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /greedy route/i })).toBeDisabled();
        expect(screen.getByText(/unavailable at 1 life/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /safe passage/i })).toBeEnabled();
    });

    it('opens Collection from the main menu and returns', async () => {
        const user = userEvent.setup();
        renderApp();
        await dismissStartupIntro(user);
        await user.click(await screen.findByRole('button', { name: /^collection$/i }));
        expect(await screen.findByRole('region', { name: /collection/i })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /^back$/i }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument();
        });
    });

    it('opens Inventory from the main menu when no run is active and returns', async () => {
        const user = userEvent.setup();
        renderApp();
        await dismissStartupIntro(user);
        await user.click(await screen.findByRole('button', { name: /^inventory$/i }));
        expect(await screen.findByText(/No active expedition/i)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /^back$/i }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument();
        });
    });

    it('opens Inventory and Codex from the run menu and returns to playing', async () => {
        const user = userEvent.setup();
        renderApp();
        await dismissStartupIntro(user);
        await chooseClassicRun(user);

        await user.click(await screen.findByRole('button', { name: /pause and open the run menu/i }));
        await user.click(await screen.findByRole('button', { name: /^inventory$/i }));
        expect(await screen.findByRole('region', { name: /inventory/i })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /^back$/i }));
        expect(await findGameplayBoardStage()).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: /pause and open the run menu/i }));
        await user.click(await screen.findByRole('button', { name: /^codex$/i }));
        expect(await screen.findByRole('region', { name: /codex/i })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /^back$/i }));
        expect(await findGameplayBoardStage()).toBeInTheDocument();
    }, 30_000);

    it('resets settings to defaults from the About tab', async () => {
        const user = userEvent.setup();
        renderApp();
        await dismissStartupIntro(user);
        await user.click(await screen.findByRole('button', { name: /settings/i }));
        await user.click(await screen.findByRole('button', { name: /^audio/i }));
        fireEvent.change(screen.getByLabelText(/master volume/i), { target: { value: '0.2' } });
        await user.click(screen.getByRole('button', { name: /^save$/i }));
        await waitFor(() => {
            const raw = window.localStorage.getItem('memory-dungeon-save-data');
            expect(raw).not.toBeNull();
            expect(JSON.parse(raw!).settings.masterVolume).toBeCloseTo(0.2);
        });

        await user.click(screen.getByRole('button', { name: /^about/i }));
        for (const closeBtn of screen.queryAllByRole('button', { name: /close notification/i })) {
            await user.click(closeBtn);
        }
        const subsectionNav = screen.queryByTestId('settings-subsection-nav');
        if (subsectionNav) {
            await user.click(within(subsectionNav).getByRole('button', { name: /^reset$/i }));
        }
        await user.click(await screen.findByRole('button', { name: /reset to defaults/i }));

        await waitFor(() => {
            const raw = window.localStorage.getItem('memory-dungeon-save-data');
            expect(raw).not.toBeNull();
            expect(JSON.parse(raw!).settings.masterVolume).toBe(createDefaultSaveData().settings.masterVolume);
        });
    });

    it('invokes quitApp when Exit Game is clicked', async () => {
        const quitSpy = vi.spyOn(desktopClient, 'quitApp').mockResolvedValue(undefined);
        const user = userEvent.setup();
        renderApp();
        await dismissStartupIntro(user);
        await user.click(await screen.findByRole('button', { name: /exit game/i }));
        expect(quitSpy).toHaveBeenCalled();
        quitSpy.mockRestore();
    });
});
