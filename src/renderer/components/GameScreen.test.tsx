import { NotificationHost, useNotificationStore } from '@cross-repo-libs/notifications';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunState, Tile } from '../../shared/contracts';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { createDefaultSaveData } from '../../shared/save-data';
import { GAMBIT_KEYBOARD_HELP_TIP } from '../copy/gameplayHints';
import { PlatformTiltProvider } from '../platformTilt/PlatformTiltProvider';
import { useAppStore } from '../store/useAppStore';
import GameScreen from './GameScreen';
import { BOARD_FLOATER_POP_CLEAR } from '../store/matchScorePop';
import {
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS,
    MATCH_SCORE_FLOAT_MS_FULL
} from './matchScoreFloaterTiming';

const gameSfxMocks = vi.hoisted(() => ({
    playRelicOfferOpenSfx: vi.fn(),
    playWagerArmSfx: vi.fn(),
    resumeAudioContext: vi.fn(),
    sfxGainFromSettings: (masterVolume: number, sfxVolume: number) =>
        Math.max(0, Math.min(1, masterVolume)) * Math.max(0, Math.min(1, sfxVolume))
}));

const uiSfxMocks = vi.hoisted(() => ({
    playMenuOpenSfx: vi.fn(),
    playUiBackSfx: vi.fn(),
    playUiClickSfx: vi.fn(),
    resumeUiSfxContext: vi.fn(),
    uiSfxGainFromSettings: (masterVolume: number, sfxVolume: number) =>
        Math.max(0, Math.min(1, masterVolume)) * Math.max(0, Math.min(1, sfxVolume))
}));

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('./GameLeftToolbar', () => ({ default: () => null }));
vi.mock('./GameplayHudBar', () => ({ default: () => null }));
vi.mock('./TileBoard', () => ({
    default: forwardRef(function TileBoardStub(props: { guidedTargetTileIds?: string[] }, ref) {
        useImperativeHandle(ref, () => ({
            getTileClientRectAtGrid: () => null,
            getTileClientRectById: (tileId: string) => {
                if (tileId === 'cx') {
                    return null;
                }
                const tri: Record<string, { left: number; top: number; width: number; height: number }> = {
                    ga: { left: 110, top: 220, width: 40, height: 40 },
                    gb: { left: 410, top: 220, width: 40, height: 40 },
                    gc: { left: 710, top: 220, width: 40, height: 40 }
                };
                const r = tri[tileId];
                if (r) {
                    return {
                        ...r,
                        right: r.left + r.width,
                        bottom: r.top + r.height,
                        x: r.left,
                        y: r.top,
                        toJSON: () => ({})
                    };
                }
                return {
                    left: 200,
                    top: 160,
                    width: 40,
                    height: 40,
                    right: 240,
                    bottom: 200,
                    x: 200,
                    y: 160,
                    toJSON: () => ({})
                };
            },
            runShuffleAnimation: (applyShuffle: () => void) => {
                applyShuffle();
            }
        }));
        return (
            <div data-guided-targets={(props.guidedTargetTileIds ?? []).join(',')} data-testid="tile-board-stub" />
        );
    })
}));
vi.mock('../hooks/useViewportSize', () => ({
    useViewportSize: () => ({ width: 1280, height: 800 })
}));
vi.mock('../hooks/useDistractionChannelTick', () => ({
    useDistractionChannelTick: () => 0
}));
vi.mock('../hooks/useHudPoliteLiveAnnouncement', () => ({
    detectClaimedFindableKind: () => null,
    getFindableToastText: () => '',
    useHudPoliteLiveAnnouncement: () => ({
        message: '',
        queuePoliteAnnouncement: vi.fn()
    })
}));
vi.mock('../platformTilt/usePlatformTiltField', () => ({
    usePlatformTiltField: () => ({ tiltRef: { current: null } })
}));
vi.mock('../audio/gameSfx', () => gameSfxMocks);
vi.mock('../audio/uiSfx', () => uiSfxMocks);

const achievementNotifications = (): number =>
    useNotificationStore.getState().notifications.filter((n) => n.surface === 'achievement').length;

const levelCompleteRunFixture = (): RunState => {
    const baseRun = createNewRun(0);
    return {
        ...baseRun,
        status: 'levelComplete',
        lives: 5,
        relicOffer: null,
        stats: {
            ...baseRun.stats,
            totalScore: 120,
            currentLevelScore: 120,
            tries: 1,
            rating: 'S',
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
            rating: 'S',
            livesRemaining: 5,
            perfect: true,
            mistakes: 0,
            clearLifeReason: 'none',
            clearLifeGained: 0
        }
    };
};

describe('GameScreen (OVR-014)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useNotificationStore.setState({
            notifications: [],
            maxNotifications: 5,
            notificationSequence: 0
        });
        const saveData = createDefaultSaveData();
        act(() => {
            useAppStore.setState({
                saveData,
                settings: saveData.settings,
                boardPinMode: false,
                destroyPairArmed: false,
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
        });
    });

    it('defers achievement toasts while the floor-cleared modal is visible, then emits after leaving levelComplete', () => {
        const runFixture = levelCompleteRunFixture();

        const { rerender } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={['ACH_FIRST_CLEAR']} run={runFixture} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(achievementNotifications()).toBe(0);

        const nextRun: RunState = {
            ...runFixture,
            status: 'memorize',
            lastLevelResult: null
        };

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={nextRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(achievementNotifications()).toBe(1);
    });

    it('explains that lives carry across floors on the floor-cleared modal', () => {
        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={{ ...levelCompleteRunFixture(), lives: 3 }} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByText(/Lives carry across the run/i)).toBeInTheDocument();
        expect(screen.getByText(/Clean clears, safe routes, shops, rests, and shrines can restore them/i)).toBeInTheDocument();
    });

    it('surfaces first-clear onboarding completion copy after completion is durable', () => {
        const saveData = { ...createDefaultSaveData(), onboardingDismissed: true };
        act(() => {
            useAppStore.setState({ saveData, settings: saveData.settings });
        });

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={levelCompleteRunFixture()} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByText(/First-run guide complete/i)).toBeInTheDocument();
    });

    it('still surfaces playable onboarding when only powers FTUE has been seen', () => {
        const saveData = { ...createDefaultSaveData(), onboardingDismissed: false, powersFtueSeen: true };
        act(() => {
            useAppStore.setState({ saveData, settings: saveData.settings });
        });

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('playable-onboarding-prompt')).toHaveTextContent(/Make your first match/i);
    });

    it('keyboard shortcuts overlay lists board navigation and Gambit tip after F1', () => {
        const playing = finishMemorizePhase(createNewRun(0));
        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={playing} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        act(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', { code: 'F1', bubbles: true, cancelable: true })
            );
        });

        expect(screen.getByTestId('game-shortcuts-help-overlay')).toBeTruthy();
        expect(screen.getByText(/Arrow keys/)).toBeTruthy();
        expect(screen.getByText(/Flip the focused tile/)).toBeTruthy();
        expect(screen.getByText(GAMBIT_KEYBOARD_HELP_TIP)).toBeTruthy();
    });

    it('REG-026 surfaces action-gated playable onboarding without hiding card targets', () => {
        const playing = finishMemorizePhase(createNewRun(0, { onboardingSafeFirstFloor: true }));
        const expectedTargets = getPlayableOnboardingStep(playing, {
            onboardingDismissed: false,
            powersFtueSeen: false
        })!.targetTileIds;

        const { rerender } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={playing} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('playable-onboarding-prompt')).toHaveTextContent(/Make your first match/i);
        expect(screen.getByTestId('tile-board-stub')).toHaveAttribute(
            'data-guided-targets',
            expectedTargets.join(',')
        );

        const runAfterMatch = {
            ...playing,
            board: {
                ...playing.board!,
                matchedPairs: 1,
                tiles: playing.board!.tiles.map((tile) =>
                    expectedTargets.includes(tile.id) ? { ...tile, state: 'matched' as const } : tile
                )
            },
            stats: {
                ...playing.stats,
                matchesFound: 1,
                currentStreak: 1,
                currentLevelScore: 30,
                totalScore: 30
            }
        };

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={runAfterMatch} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('playable-onboarding-prompt')).toHaveTextContent(/Use recovery tools/i);
    });

    it('renders match score floater from store and clears after float window', async () => {
        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        try {
            render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={playing} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );

            act(() => {
                useAppStore.setState({
                    matchScorePop: {
                        amount: 99,
                        tileIdA: 'a',
                        tileIdB: 'b',
                        key: 'test-floater-1'
                    }
                });
            });

            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('+99');
            expect(screen.getByText(/Plus 99 points/)).toBeInTheDocument();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    MATCH_SCORE_FLOAT_MS_FULL + MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS + 25
                );
            });

            expect(useAppStore.getState().matchScorePop).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders mismatch floater from store', async () => {
        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        try {
            render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={playing} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );

            act(() => {
                useAppStore.setState({
                    mismatchScorePop: {
                        tileIdA: 'a',
                        tileIdB: 'b',
                        key: 'test-miss-1'
                    },
                    matchScorePop: null
                });
            });

            expect(screen.getByTestId('mismatch-score-floater')).toHaveTextContent('Miss');
            expect(screen.getByText(/No match/)).toBeInTheDocument();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(
                    MATCH_SCORE_FLOAT_MS_FULL + MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS + 25
                );
            });

            expect(useAppStore.getState().mismatchScorePop).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('positions gambit mismatch floater at centroid of three tile rects (tileIdC)', () => {
        const origBound = HTMLElement.prototype.getBoundingClientRect;
        const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (this.getAttribute('data-testid') === 'board-stage') {
                return {
                    left: 10,
                    top: 20,
                    width: 1000,
                    height: 800,
                    right: 1010,
                    bottom: 820,
                    x: 10,
                    y: 20,
                    toJSON: () => ({})
                } as DOMRect;
            }
            return origBound.call(this);
        });

        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        try {
            render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={playing} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );

            act(() => {
                useAppStore.setState({
                    mismatchScorePop: {
                        tileIdA: 'ga',
                        tileIdB: 'gb',
                        tileIdC: 'gc',
                        key: 'test-gambit-miss-centroid'
                    },
                    matchScorePop: null
                });
            });

            const floater = screen.getByTestId('mismatch-score-floater');
            // Stage (10,20); tile centers relative to stage: (120,220),(420,220),(720,220) => centroid (420,220)
            expect(floater).toHaveStyle({ left: '420px', top: '220px' });
        } finally {
            spy.mockRestore();
            vi.useRealTimers();
        }
    });

    it('falls back to two-tile midpoint when tileIdC is set but third rect is missing', () => {
        const origBound = HTMLElement.prototype.getBoundingClientRect;
        const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (this.getAttribute('data-testid') === 'board-stage') {
                return {
                    left: 10,
                    top: 20,
                    width: 1000,
                    height: 800,
                    right: 1010,
                    bottom: 820,
                    x: 10,
                    y: 20,
                    toJSON: () => ({})
                } as DOMRect;
            }
            return origBound.call(this);
        });

        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        try {
            render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={playing} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );

            act(() => {
                useAppStore.setState({
                    mismatchScorePop: {
                        tileIdA: 'ga',
                        tileIdB: 'gb',
                        tileIdC: 'cx',
                        key: 'test-gambit-miss-partial-rect'
                    },
                    matchScorePop: null
                });
            });

            const floater = screen.getByTestId('mismatch-score-floater');
            expect(floater).toHaveStyle({ left: '270px', top: '220px' });
        } finally {
            spy.mockRestore();
            vi.useRealTimers();
        }
    });

    it('does not call pause when KeyP is pressed during a relic offer', () => {
        const pauseSpy = vi.spyOn(useAppStore.getState(), 'pause');
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        const run: RunState = {
            ...playing,
            status: 'playing',
            relicOffer: {
                tier: 1,
                options: ['extra_shuffle_charge'],
                picksRemaining: 1,
                pickRound: 0
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
            <GameScreen achievements={[]} run={{ ...run, shopGold: 5, shopOffers: [] }} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        document.dispatchEvent(
            new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true, cancelable: true })
        );
        expect(pauseSpy).not.toHaveBeenCalled();
        pauseSpy.mockRestore();
    });

    it('does not call pause when KeyP is pressed on the floor-cleared overlay (levelComplete + lastLevelResult)', () => {
        const pauseSpy = vi.spyOn(useAppStore.getState(), 'pause');
        const runFixture = levelCompleteRunFixture();

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={runFixture} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        document.dispatchEvent(
            new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true, cancelable: true })
        );
        expect(pauseSpy).not.toHaveBeenCalled();
        pauseSpy.mockRestore();
    });

    it('shows relic draft title, progress, and Scholar footnote for a multi-pick offer', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        const run: RunState = {
            ...playing,
            status: 'playing',
            lastLevelResult: {
                level: 3,
                scoreGained: 100,
                rating: 'S',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0
            },
            activeContract: {
                noShuffle: false,
                noDestroy: false,
                maxMismatches: null,
                bonusRelicDraftPick: true
            },
            relicOffer: {
                tier: 1,
                options: ['extra_shuffle_charge', 'memorize_bonus_ms', 'destroy_bank_plus_one'],
                picksRemaining: 2,
                pickRound: 0,
                favorBonusPicks: 1
            }
        };

        const { getByTestId, getByText } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByTestId('game-relic-offer-overlay')).toBeTruthy();
        expect(getByText('Relic draft · tier 1')).toBeTruthy();
        expect(getByText('Pick 1 of 2 this visit')).toBeTruthy();
        expect(getByText(/Featured-objective favor/)).toBeTruthy();
        expect(getByText(/Scholar contract/)).toBeTruthy();
        expect(getByText(/The Saboteur: disarm, delete, reroute./)).toBeTruthy();
        expect(getByText(/The Warden \/ The Seer: guard, absorb, stabilize./)).toBeTruthy();
        expect(gameSfxMocks.playRelicOfferOpenSfx).toHaveBeenCalledTimes(1);
    });

    it('does not show progress line for a single-pick relic offer', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        const run: RunState = {
            ...playing,
            status: 'playing',
            relicOffer: {
                tier: 1,
                options: ['extra_shuffle_charge'],
                picksRemaining: 1,
                pickRound: 0
            }
        };

        const { getByTestId, queryByText } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByTestId('game-relic-offer-overlay')).toBeTruthy();
        expect(queryByText(/this visit/)).toBeNull();
    });

    it('shows contextual relic draft reasons and chapter-aligned footnote', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const playing = finishMemorizePhase(base);
        const run: RunState = {
            ...playing,
            status: 'playing',
            lastLevelResult: {
                level: 3,
                scoreGained: 100,
                rating: 'S',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0
            },
            relicOffer: {
                tier: 1,
                options: ['memorize_under_short_memorize', 'peek_charge_plus_one', 'shrine_echo'],
                picksRemaining: 1,
                pickRound: 0,
                contextualOptionReasons: {
                    memorize_under_short_memorize: 'Answers short memorize'
                }
            }
        };

        const { getByText } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByText('Answers short memorize')).toBeTruthy();
        expect(getByText('At least one choice is chapter-aligned for this Endless route.')).toBeTruthy();
    });

    it('shows the endless chapter banner during memorize on scheduled endless floors', () => {
        const run = createNewRun(0, { echoFeedbackEnabled: false });

        const { getAllByText, getByTestId, getByText } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByTestId('endless-chapter-banner')).toBeTruthy();
        expect(getByTestId('endless-chapter-banner').getAttribute('data-chapter-theme')).toBe('Gate');
        expect(getByText('Dungeon Gate')).toBeTruthy();
        expect(getByText(/Read the board/i)).toBeTruthy();
        expect(getAllByText(/Objective: Flip par/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows featured objective result, favor gain, and next-floor preview on endless floor clear', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false });
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            shopGold: 5,
            featuredObjectiveStreak: 2,
            shopOffers: [
                {
                    id: 'test-shop-peek',
                    itemId: 'peek_charge',
                    category: 'service',
                    label: 'Peek charge',
                    description: 'Add 1 peek charge for this run.',
                    baseCost: 2,
                    cost: 2,
                    stock: 1,
                    maxStock: 1,
                    stackLimit: null,
                    compatibleWhen: 'owned',
                    compatible: true,
                    unavailableReason: null,
                    purchased: false
                }
            ],
            relicFavorProgress: 0,
            bonusRelicPicksNextOffer: 1,
            favorBonusRelicPicksNextOffer: 1,
            stats: {
                ...baseRun.stats,
                totalScore: 120,
                currentLevelScore: 120,
                tries: 0,
                rating: 'S++',
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
                rating: 'S++',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                relicFavorGained: 1,
                featuredObjectiveStreak: 2,
                featuredObjectiveStreakBonus: 10,
                objectiveBonusScore: 30,
                bonusTags: ['flip_par', 'objective_streak']
                ,
                routeChoices: [
                    {
                        id: '14:1:2:safe',
                        routeType: 'safe',
                        label: 'Safe passage',
                        detail: 'Standard next floor. Keep the run curve predictable.'
                    },
                    {
                        id: '14:1:2:greed',
                        routeType: 'greed',
                        label: 'Greedy route',
                        detail: 'Higher pressure route hook for future shop, elite, or bonus rewards.'
                    }
                ]
            }
        };

        const { getByText } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByText(/Flip par: Complete/)).toBeTruthy();
        expect(getByText('Objective streak: x2 (+10)')).toBeTruthy();
        expect(getByText('Favor gained: +1')).toBeTruthy();
        expect(getByText(/Extra relic pick banked/)).toBeTruthy();
        expect(getByText(/Next: Speed Trial/)).toBeTruthy();
        expect(getByText(/Lantern Academy/)).toBeTruthy();
        expect(getByText(/speed check/)).toBeTruthy();
        expect(screen.getByTestId('floor-clear-causality-grid')).toHaveTextContent('Baseline descent');
        expect(screen.getByTestId('floor-clear-causality-grid')).toHaveTextContent('score, objective value, and assist discipline');
        expect(getByText(/Baseline descent: Use assists only when they save more value/)).toBeTruthy();
        expect(screen.getByTestId('floor-clear-result-stack')).toHaveAttribute('data-route-choice-required', 'true');
        expect(screen.getByTestId('route-choice-panel')).toHaveTextContent('Choose the next room');
        expect(screen.getByTestId('route-choice-panel')).toHaveAttribute('data-decision-state', 'required');
        expect(screen.getByTestId('route-choice-required-copy')).toHaveTextContent('Pick one room to continue');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Reward: Balanced score and survival path.');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Risk: Stable path.');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-type', 'greed');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('Elite memory: Elite enemy pressure and greed anchors.');
        expect(screen.getByRole('button', { name: 'Safe passage' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Greedy route' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Continue$/i })).toBeNull();
        expect(screen.queryByTestId('endless-risk-wager-panel')).toBeNull();
        expect(screen.queryByRole('button', { name: /visit shop/i })).toBeNull();
        expect(screen.queryByTestId('shop-offer-panel')).toBeNull();
        expect(screen.getByText(/Vendor alcove available: 1 services, 5 shop gold/)).toBeTruthy();
    });

    it('shows selected route copy instead of route buttons after a route is locked', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false });
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            pendingRouteCardPlan: {
                choiceId: '17:1:2:greed',
                routeType: 'greed',
                sourceLevel: 1,
                targetLevel: 2
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S++',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                routeChoices: [
                    {
                        id: '17:1:2:greed',
                        routeType: 'greed',
                        label: 'Greedy route',
                        detail: 'Higher pressure route hook for future shop, elite, or bonus rewards.'
                    }
                ]
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.queryByTestId('route-choice-panel')).toBeNull();
        expect(screen.getByText(/Greedy route selected: next floor adds richer caches and extra reward-risk pressure/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: /continue to greedy route floor/i })).toBeTruthy();
    });

    it('shows an in-board route card banner while route cards are unclaimed', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run: RunState = {
            ...baseRun,
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index < 2 ? { ...tile, routeCardKind: 'greed_cache' as const } : tile
                )
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('route-card-board-banner')).toHaveTextContent('Greed Cache');
        expect(screen.getByTestId('route-card-board-banner')).toHaveTextContent('+2 gold +25 score');
    });

    it('shows a structured dungeon status panel for active dungeon boards', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' }));
        const exitTile: Tile = {
            id: 'exit',
            pairKey: EXIT_PAIR_KEY,
            state: 'flipped',
            symbol: '^',
            label: 'Primary Safe Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_safe',
            dungeonRouteType: 'safe',
            dungeonExitLockKind: 'lever',
            dungeonExitRequiredLeverCount: 1,
            dungeonExitActivated: false
        };
        const trapA: Tile = {
            id: 'trap-a',
            pairKey: 'trap',
            state: 'hidden',
            symbol: '!',
            label: 'Snare Trap',
            dungeonCardKind: 'trap',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'trap_snare'
        };
        const trapB: Tile = { ...trapA, id: 'trap-b' };
        const roomTile: Tile = {
            id: 'room',
            pairKey: ROOM_PAIR_KEY,
            state: 'hidden',
            symbol: 'R',
            label: 'Campfire',
            dungeonCardKind: 'room',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'room_campfire'
        };
        const run: RunState = {
            ...baseRun,
            board: {
                ...baseRun.board!,
                tiles: [exitTile, trapA, trapB, roomTile],
                pairCount: 1,
                columns: 2,
                rows: 2,
                dungeonObjectiveId: 'disarm_traps',
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'lever',
                dungeonExitRequiredLeverCount: 1,
                dungeonLeverCount: 0
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const panel = screen.getByTestId('dungeon-status-panel');
        expect(panel).toHaveTextContent('Dungeon');
        expect(panel).toHaveTextContent('Disarm the traps 0/1');
        expect(panel).toHaveTextContent('Exit');
        expect(panel).toHaveTextContent('Levers 0/1');
        expect(panel).toHaveTextContent('Traps');
        expect(panel).toHaveTextContent('Room');
        expect(panel).toHaveTextContent(/armed trap/i);
        expect(screen.queryByTestId('dungeon-card-board-banner')).toBeNull();
        expect(screen.getByTestId('dungeon-run-strip')).toHaveTextContent('Dungeon gate');
    });

    it('renders crowded dungeon status chips in priority order with one alert', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' }));
        const exitTile: Tile = {
            id: 'exit',
            pairKey: EXIT_PAIR_KEY,
            state: 'flipped',
            symbol: '^',
            label: 'Locked Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_safe',
            dungeonExitLockKind: 'iron'
        };
        const bossTile: Tile = {
            id: 'boss-a',
            pairKey: 'boss',
            state: 'hidden',
            symbol: 'B',
            label: 'Trap Warden',
            dungeonCardKind: 'enemy',
            dungeonCardState: 'revealed',
            dungeonBossId: 'trap_warden',
            dungeonCardHp: 2,
            dungeonCardMaxHp: 4
        };
        const trapTile: Tile = {
            id: 'trap-a',
            pairKey: 'trap',
            state: 'hidden',
            symbol: '!',
            label: 'Alarm Trap',
            dungeonCardKind: 'trap',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'trap_alarm'
        };
        const enemyTile: Tile = {
            id: 'enemy-a',
            pairKey: 'enemy',
            state: 'hidden',
            symbol: 'E',
            label: 'Awake Sentry',
            dungeonCardKind: 'enemy',
            dungeonCardState: 'revealed'
        };
        const roomTile: Tile = {
            id: 'room',
            pairKey: ROOM_PAIR_KEY,
            state: 'hidden',
            symbol: 'R',
            label: 'Campfire',
            dungeonCardKind: 'room',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'room_campfire'
        };
        const shopTile: Tile = {
            id: 'shop',
            pairKey: SHOP_PAIR_KEY,
            state: 'hidden',
            symbol: 'S',
            label: 'Vendor',
            dungeonCardKind: 'shop',
            dungeonCardState: 'hidden'
        };
        const run: RunState = {
            ...baseRun,
            dungeonKeys: {},
            dungeonMasterKeys: 0,
            board: {
                ...baseRun.board!,
                tiles: [
                    exitTile,
                    bossTile,
                    { ...bossTile, id: 'boss-b' },
                    trapTile,
                    { ...trapTile, id: 'trap-b' },
                    enemyTile,
                    { ...enemyTile, id: 'enemy-b' },
                    roomTile,
                    shopTile
                ],
                dungeonBossId: 'trap_warden',
                dungeonObjectiveId: 'defeat_boss',
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron',
                enemyHazards: [
                    {
                        id: 'patrol',
                        kind: 'sentinel',
                        label: 'Moving Patrol',
                        currentTileId: 'room',
                        nextTileId: 'shop',
                        pattern: 'patrol',
                        state: 'revealed',
                        damage: 1,
                        hp: 1,
                        maxHp: 1
                    }
                ]
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const panel = screen.getByTestId('dungeon-status-panel');
        const chipLabels = Array.from(panel.querySelectorAll('[data-priority]')).map((chip) =>
            chip.textContent?.replace(/\s+/g, ' ').trim()
        );

        expect(chipLabels).toEqual([
            'Traps1',
            'Patrols1/1',
            'Boss2/4 HP',
            'Enemies2',
            'ExitNeeds iron key',
            'Keys0 keys'
        ]);
        expect(panel).toHaveTextContent(/armed trap/i);
        expect(panel).not.toHaveTextContent(/moving enemy/);
        expect(panel).not.toHaveTextContent('Room available');
        expect(panel).not.toHaveTextContent('Shop available');
    });

    it('hides the dungeon status panel on plain boards', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
        const run: RunState = {
            ...baseRun,
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile) => ({
                    ...tile,
                    dungeonCardKind: undefined,
                    dungeonCardState: undefined,
                    dungeonCardEffectId: undefined
                })),
                dungeonObjectiveId: 'find_exit'
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.queryByTestId('dungeon-status-panel')).toBeNull();
    });

    it('shows and arms an endless risk wager when the cleared streak is eligible', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false });
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            featuredObjectiveStreak: 2,
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S++',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                relicFavorGained: 1,
                featuredObjectiveStreak: 2,
                objectiveBonusScore: 30,
                bonusTags: ['flip_par', 'objective_streak']
            }
        };
        act(() => {
            useAppStore.setState({ run });
        });

        const { getByTestId, getByRole } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByTestId('endless-risk-wager-panel')).toBeTruthy();
        fireEvent.click(getByRole('button', { name: 'Arm wager' }));
        expect(useAppStore.getState().run?.endlessRiskWager).toEqual({
            acceptedOnLevel: 1,
            targetLevel: 2,
            streakAtRisk: 2,
            bonusFavorOnSuccess: 2
        });
    });

    it('shows armed and resolved endless risk wager copy', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false });
        const armedRun: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            featuredObjectiveStreak: 2,
            endlessRiskWager: {
                acceptedOnLevel: 1,
                targetLevel: 2,
                streakAtRisk: 2,
                bonusFavorOnSuccess: 2
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'S++',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                relicFavorGained: 1,
                featuredObjectiveStreak: 2
            }
        };
        const resolvedRun: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            featuredObjectiveStreak: 3,
            lastLevelResult: {
                level: 2,
                scoreGained: 160,
                rating: 'S++',
                livesRemaining: 5,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                relicFavorGained: 3,
                featuredObjectiveStreak: 3,
                endlessRiskWagerOutcome: 'won',
                endlessRiskWagerFavorGained: 2
            }
        };

        const { getByText, rerender } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={armedRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByText('Risk wager armed')).toBeTruthy();
        expect(getByText(/Next featured objective: \+2 Favor/)).toBeTruthy();

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={resolvedRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByText('Risk wager won: +2 Favor')).toBeTruthy();
        expect(getByText('Favor gained: +3')).toBeTruthy();
    });
});
