import { NotificationHost, useNotificationStore } from '@cross-repo-libs/notifications';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunState, Tile } from '../../shared/contracts';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { applyEnemyHazardClick } from '../../shared/turn-resolution';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { createDungeonRunMapState } from '../../shared/run-map';
import { createDefaultSaveData } from '../../shared/save-data';
import { GAMBIT_KEYBOARD_HELP_TIP } from '../copy/gameplayHints';
import { PlatformTiltProvider } from '../platformTilt/PlatformTiltProvider';
import { useAppStore } from '../store/useAppStore';
import GameScreen from './GameScreen';
import { getDungeonCombatLogRows, getVisualHudAnnouncementFollowup } from './gameScreenFeedback';
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

const hudAnnouncementMock = vi.hoisted(() => ({
    message: '',
    priority: 'info' as 'info' | 'error',
    queuePoliteAnnouncement: vi.fn(),
    formatHudActionFeedbackText: (text: string) => text.length > 48 ? `${text.slice(0, 45)}...` : text
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
    formatHudActionFeedbackText: hudAnnouncementMock.formatHudActionFeedbackText,
    getFindableToastText: () => '',
    useHudPoliteLiveAnnouncement: () => ({
        message: hudAnnouncementMock.message,
        priority: hudAnnouncementMock.priority,
        queuePoliteAnnouncement: hudAnnouncementMock.queuePoliteAnnouncement
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
        hudAnnouncementMock.message = '';
        hudAnnouncementMock.priority = 'info';
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

    it('shows critical visible action feedback for high-priority health loss announcements', () => {
        hudAnnouncementMock.message = 'Life lost. 2 lives remain.';
        hudAnnouncementMock.priority = 'error';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-tone', 'error');
        expect(rail).toHaveTextContent('Critical');
        expect(rail).toHaveTextContent('Life lost. 2 lives remain.');
    });

    it('adds a next-step line to visible match action feedback', () => {
        hudAnnouncementMock.message = 'Match resolved. 3/4 pairs cleared.';
        hudAnnouncementMock.priority = 'info';
        const playing = finishMemorizePhase(createNewRun(0));
        const run: RunState = {
            ...playing,
            board: {
                ...playing.board!,
                matchedPairs: 3,
                pairCount: 4
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveTextContent('Last action');
        expect(rail).toHaveTextContent('Match resolved. 3/4 pairs cleared.');
        expect(rail).toHaveTextContent('Next: 1 pair left.');
    });

    it('adds next-step lines for guard, hazard, and resource feedback rail messages', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Guard token spent. 0 guard tokens remain.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: guard absorbed the mistake; keep lives protected.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Guard Cache ward blocked a hazard.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: hazard blocked; continue from the safest known pair.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: '2 guard tokens gained. 2 available.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: guard can absorb the next unsafe hit before lives drop.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: '2 combo shards spent. 1 available.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: spend shards on powers when the board gets risky.');
    });

    it('adds next-step lines for scout and route-special feedback rail messages', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Lantern Ward scouted a hidden threat.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: use the revealed threat marker to route around danger.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Omen Seal revealed hidden danger.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: treat the marked danger as known information before flipping.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Anchor Seal froze rotating pressure.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: pressure is frozen; clear the best confirmed pair now.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Pin Lattice rewarded deliberate planning.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: planning paid out; preserve pins for uncertain pairs.');
    });

    it('adds specific next-step lines for disruptive hazard and mimic feedback', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Shuffle Snare fired. Hidden safe tiles reordered.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: board order changed; recheck positions before pairing.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Mimic Cache bit. Life lost; reduced loot claimed.',
                priority: 'error',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 1
            })
        ).toBe('Next: recover control before touching another risky cache.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Fuse Cache claimed late. Fuse expired; consolation gold gained.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
                lives: 3
            })
        ).toBe('Next: late fuse still pays consolation gold; clear safer pairs.');
    });

    it('adds specific next-step lines for moving enemy combat feedback', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Life lost. 1 life remains. Moving enemy contact.',
                priority: 'error',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 1
            })
        ).toBe('Next: track the patrol path before risking the last life.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 2/4 pairs cleared. Moving enemy defeated. 1 cleared this floor.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
                lives: 3
            })
        ).toBe('Next: threat removed; use the opened space to clear confirmed pairs.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 2/4 pairs cleared. Dungeon enemy defeated. 1 defeated this floor.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
                lives: 3
            })
        ).toBe('Next: pressure is down; keep clearing confirmed pairs.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Life lost. 0 lives remain. Moving enemy contact.',
                priority: 'error',
                runStatus: 'gameOver',
                remainingPairCount: 3,
                lives: 0
            })
        ).toBe('Next: review the run summary before starting the next descent.');
    });

    it('builds a compact per-floor dungeon combat log from combat counters', () => {
        const rows = getDungeonCombatLogRows({
            ...finishMemorizePhase(createNewRun(0)),
            lives: 1,
            enemyHazardHitsThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 1,
            dungeonEnemiesDefeatedThisFloor: 1,
            safeHazardWardsUsedThisFloor: 1
        });

        expect(rows).toEqual([
            {
                id: 'patrol-contact',
                label: '1 patrol contact',
                detail: 'Critical health; avoid the next patrol path.',
                tone: 'danger'
            },
            {
                id: 'patrol-defeats',
                label: '1 patrol defeated',
                detail: 'Moving threat removed from this floor.',
                tone: 'success'
            },
            {
                id: 'dungeon-enemy-defeats',
                label: '1 enemy pair defeated',
                detail: 'Dungeon objective pressure converted into progress.',
                tone: 'success'
            },
            {
                id: 'ward-blocks',
                label: '1 hazard warded',
                detail: 'A ward absorbed a trap or cache effect.',
                tone: 'info'
            }
        ]);
    });

    it('pluralizes combat-log counters when multiple threats resolve', () => {
        const rows = getDungeonCombatLogRows({
            ...finishMemorizePhase(createNewRun(0)),
            lives: 3,
            enemyHazardHitsThisFloor: 2,
            enemyHazardsDefeatedThisFloor: 2,
            dungeonEnemiesDefeatedThisFloor: 3
        });

        expect(rows.map((row) => row.label)).toEqual([
            '2 patrol contacts',
            '2 patrols defeated',
            '3 enemy pairs defeated'
        ]);
    });

    it('adds next-step lines for health recovery, pickups, chains, and Gambit feedback', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Life restored. 3 lives available.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: extra life secured; spend it only on controlled risks.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Shard spark claimed: +1 combo shard.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: pickup reward applied; keep clearing confirmed pairs.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Chain times three - consecutive matches boost your score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
                lives: 3
            })
        ).toBe('Next: preserve the streak with the safest known match.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Gambit window open: take the third flip for a chance at bonus score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
                lives: 3
            })
        ).toBe('Next: take the third flip only if the wager is worth it.');
    });

    it('adds next-step lines for trait route objective feedback', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Trait routes: 1/2.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: line up another trait interaction before the floor ends.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 2/4 pairs cleared. Trait routes: 2/2 complete. Combo shard gained. 1 available.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
                lives: 3
            })
        ).toBe('Next: route reward claimed; spend the resource when the board gets risky.');
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

        expect(screen.getByTestId('playable-onboarding-prompt')).toHaveTextContent(/Exit in sight/i);
        expect(screen.getByTestId('playable-onboarding-prompt')).toHaveTextContent(/Clear the final pair/i);
        expect(screen.getByTestId('playable-onboarding-prompt')).toHaveTextContent(/opens your first route choice/i);

        const runAfterGuidedPairs = {
            ...runAfterMatch,
            board: {
                ...runAfterMatch.board,
                matchedPairs: 2,
                pairCount: Math.max(runAfterMatch.board.pairCount, 4),
                tiles: runAfterMatch.board.tiles.map((tile, index) =>
                    index < 4 ? { ...tile, state: 'matched' as const } : tile
                )
            },
            stats: {
                ...runAfterMatch.stats,
                matchesFound: 2,
                currentStreak: 2,
                currentLevelScore: 70,
                totalScore: 70
            }
        };

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={runAfterGuidedPairs} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.queryByTestId('playable-onboarding-prompt')).toBeNull();
        expect(screen.getByTestId('first-run-room-goal-prompt')).toHaveTextContent(/Clear the remaining pairs/i);
        expect(screen.getByTestId('first-run-room-goal-prompt')).toHaveTextContent(/opens the first route choice/i);
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

    it('REG-097 resumes a paused run when Escape uses the overlay back path', () => {
        const resumeSpy = vi.spyOn(useAppStore.getState(), 'resume');
        const paused: RunState = {
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' })),
            status: 'paused',
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: 'playing'
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={paused} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        act(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
            );
        });

        expect(resumeSpy).toHaveBeenCalledTimes(1);
        resumeSpy.mockRestore();
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
                options: ['chapter_compass', 'memorize_bonus_ms', 'destroy_bank_plus_one'],
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
        expect(getByText(/Trait build: Conduit Cartographer/)).toBeTruthy();
        expect(getByText(/The Saboteur \/ The Slayer: disarm, delete, reroute./)).toBeTruthy();
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
            recallFocus: 2,
            recallMistakesThisFloor: 1,
            forgottenTileIdsThisFloor: [baseRun.board!.tiles[1].id],
            board: {
                ...baseRun.board!,
                tiles: baseRun.board!.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, routeSpecialKind: 'mystery_veil' as const, routeSpecialRevealed: true }
                        : tile
                )
            },
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
                traitRouteObjectiveCompleted: true,
                traitRouteObjectiveProgress: 1,
                traitRouteObjectiveRequired: 1,
                traitRouteObjectiveReward: '+1 combo shard',
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
                    },
                    {
                        id: '14:1:2:mystery',
                        routeType: 'mystery',
                        label: 'Mystery route',
                        detail: 'Hidden treasure or secret-room hook.'
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
        expect(getByText('Trait routes: Complete (+1 combo shard)')).toBeTruthy();
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
        expect(screen.getByTestId('route-choice-required-copy')).toHaveTextContent('Choose the next room type');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveAttribute('data-pressure', 'strained');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('Focus 2/3 - locked');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('Bonus +28');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('1 learned clue');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('1 recall lapse');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Reward: Balanced score and survival path.');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Risk: Stable path.');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Recommended first route');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Memory: Use this when the last room left forgotten tiles or broken focus.');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent(
            'Recall: Safe route fits the current recall state.'
        );
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent(
            'Atmosphere: A steadier corridor keeps its marks close to the wall.'
        );
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-type', 'greed');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('Mnemonic Sentinel: Sentinel pressure and greed anchors.');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('High reward, higher danger');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('Memory: Take only if you can remember enemy, trap, and symbol positions under pressure.');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent(
            'Recall: Greed is unsafe until forgotten markers are repaired.'
        );
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent(
            'Atmosphere: The louder stair promises value, but every card remembers the noise.'
        );
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent('Changes the next board');
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent(
            'Recall: Mystery has a remembered clue to anchor the unknown.'
        );
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent(
            'Atmosphere: The unindexed door offers a clue first and an answer later.'
        );
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

    it('keeps boss-route approach labels visible when room choices converge', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 66_006 });
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            dungeonRun: createDungeonRunMapState(baseRun.runSeed, baseRun.runRulesVersion, 5),
            lastLevelResult: {
                level: 5,
                scoreGained: 220,
                rating: 'S',
                livesRemaining: 4,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                routeChoices: [
                    {
                        id: 'boss:safe',
                        routeType: 'safe',
                        label: 'Safe passage',
                        detail: 'Boss gate through a controlled route.'
                    },
                    {
                        id: 'boss:greed',
                        routeType: 'greed',
                        label: 'Greedy route',
                        detail: 'Boss gate through an elite route.'
                    },
                    {
                        id: 'boss:mystery',
                        routeType: 'mystery',
                        label: 'Mystery route',
                        detail: 'Boss gate through an omen route.'
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

        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Approach: Safe passage');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Keeper Chamber via Safe passage');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('Approach: Greedy route');
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent('Approach: Mystery route');
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
            enemyHazardHitsThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 1,
            safeHazardWardsUsedThisFloor: 1,
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
        expect(panel).toHaveAttribute('role', 'status');
        expect(panel).toHaveAttribute('aria-live', 'polite');
        expect(panel).toHaveAccessibleName('Dungeon combat status');
        expect(panel).toHaveTextContent('Dungeon');
        expect(panel).toHaveTextContent('Disarm the traps 0/1');
        expect(panel).toHaveTextContent('Exit');
        expect(panel).toHaveTextContent('Levers 0/1');
        expect(panel).toHaveTextContent('Traps');
        expect(panel).toHaveTextContent('Room');
        expect(panel).toHaveTextContent(/armed trap/i);
        expect(screen.getByTestId('dungeon-combat-log')).toHaveAccessibleName('This floor combat log');
        expect(screen.getByTestId('dungeon-combat-log')).toHaveTextContent('1 patrol contact');
        expect(screen.getByTestId('dungeon-combat-log')).toHaveTextContent('1 patrol defeated');
        expect(screen.getByTestId('dungeon-combat-log')).toHaveTextContent('1 hazard warded');
        expect(screen.queryByTestId('dungeon-card-board-banner')).toBeNull();
        expect(screen.getByTestId('dungeon-run-strip')).toHaveTextContent('Threshold Archive');
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

    it('keeps fatal patrol contact on a stable game-over combat read', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' }));
        const occupiedTile: Tile = {
            id: 'enemy-occupied',
            pairKey: 'enemy',
            state: 'hidden',
            symbol: 'E',
            label: 'Awake Sentry',
            dungeonCardKind: 'enemy',
            dungeonCardState: 'revealed'
        };
        const pairedTile: Tile = { ...occupiedTile, id: 'enemy-pair' };
        const safeTile: Tile = {
            id: 'safe-a',
            pairKey: 'safe',
            state: 'hidden',
            symbol: 'S',
            label: 'Safe Rune'
        };
        const safePairTile: Tile = { ...safeTile, id: 'safe-b' };
        const runBeforeContact: RunState = {
            ...baseRun,
            lives: 1,
            status: 'playing',
            stats: { ...baseRun.stats, guardTokens: 0 },
            board: {
                ...baseRun.board!,
                tiles: [occupiedTile, pairedTile, safeTile, safePairTile],
                pairCount: 2,
                columns: 2,
                rows: 2,
                matchedPairs: 0,
                flippedTileIds: [],
                dungeonObjectiveId: 'pacify_floor',
                enemyHazards: [
                    {
                        id: 'fatal-patrol',
                        kind: 'sentinel',
                        label: 'Patrol Sentry',
                        currentTileId: occupiedTile.id,
                        nextTileId: safeTile.id,
                        pattern: 'patrol',
                        state: 'hidden',
                        damage: 2,
                        hp: 1,
                        maxHp: 1
                    }
                ],
                enemyHazardTurn: 0
            }
        };

        const fatalRun = applyEnemyHazardClick(runBeforeContact, occupiedTile.id);
        hudAnnouncementMock.message = 'Life lost. 0 lives remain. Moving enemy contact.';
        hudAnnouncementMock.priority = 'error';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={fatalRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(fatalRun.status).toBe('gameOver');
        expect(fatalRun.board!.enemyHazardTurn).toBe(0);
        expect(fatalRun.board!.tiles.find((tile) => tile.id === occupiedTile.id)?.state).toBe('hidden');
        expect(fatalRun.board!.enemyHazards![0]).toMatchObject({
            state: 'revealed',
            currentTileId: occupiedTile.id,
            nextTileId: safeTile.id
        });
        expect(screen.getByTestId('dungeon-status-panel')).toHaveTextContent('Patrols1/1');
        expect(screen.getByTestId('dungeon-status-panel')).toHaveTextContent(/safe matches damage revealed patrols/i);
        expect(screen.getByTestId('dungeon-combat-log')).toHaveTextContent('1 patrol contact');
        expect(screen.getByTestId('action-feedback-rail')).toHaveTextContent(
            'Next: review the run summary before starting the next descent.'
        );
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
