import { NotificationHost, useNotificationStore } from '@cross-repo-libs/notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardState, RunState, Tile } from '../../shared/contracts';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { applyEnemyHazardClick } from '../../shared/turn-resolution';
import { getPlayableOnboardingStep } from '../../shared/playable-onboarding';
import { createDungeonRunMapState, revealDungeonChoices, selectDungeonNode } from '../../shared/run-map';
import { createDefaultSaveData } from '../../shared/save-data';
import { GAMBIT_KEYBOARD_HELP_TIP } from '../copy/gameplayHints';
import { PlatformTiltProvider } from '../platformTilt/PlatformTiltProvider';
import { useAppStore } from '../store/useAppStore';
import GameScreen from './GameScreen';
import {
    getDungeonCombatLogRows,
    getStackCashoutLaneCount,
    getVisualHudAnnouncementFollowup,
    getVisualHudAnnouncementImpact,
    getVisualHudAnnouncementSignal
} from './gameScreenFeedback';
import { BOARD_FLOATER_POP_CLEAR } from '../store/matchScorePop';
import {
    MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS,
    MATCH_SCORE_FLOAT_MS_FULL,
    matchScoreFloatDurationMs
} from './matchScoreFloaterTiming';

const gameSfxMocks = vi.hoisted(() => ({
    playMismatchRecoveryCrescendoSfx: vi.fn(),
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
    claimedFindableKind: null as 'shard_spark' | null,
    message: '',
    priority: 'info' as 'info' | 'error',
    queuePoliteAnnouncement: vi.fn(),
    formatHudActionFeedbackText: (text: string) => text.length > 48 ? `${text.slice(0, 45)}...` : text,
    getFindableToastText: vi.fn((kind: string) => (kind === 'shard_spark' ? 'Shard spark +1 combo shard' : `${kind} reward`))
}));

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
vi.mock('./GameLeftToolbar', () => ({ default: () => null }));
vi.mock('./GameplayHudBar', () => ({ default: () => null }));
vi.mock('./TileBoard', () => ({
    default: forwardRef(function TileBoardStub(
        props: {
            chainContext?: {
                armedPerkId?: string | null;
                armedPerkDetail?: string | null;
                armedPerkLabel?: string | null;
                armedPerkPayoff?: string | null;
            };
            guidedTargetTileIds?: string[];
            recoveryContext?: {
                action: string;
                detail: string;
                impactCue: string;
                tone: string;
                value: string;
            } | null;
        },
        ref
    ) {
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
            <div
                data-armed-perk-detail={props.chainContext?.armedPerkDetail ?? 'none'}
                data-armed-perk-id={props.chainContext?.armedPerkId ?? 'none'}
                data-armed-perk-label={props.chainContext?.armedPerkLabel ?? 'none'}
                data-armed-perk-payoff={props.chainContext?.armedPerkPayoff ?? 'none'}
                data-guided-targets={(props.guidedTargetTileIds ?? []).join(',')}
                data-recovery-action={props.recoveryContext?.action ?? 'none'}
                data-recovery-detail={props.recoveryContext?.detail ?? 'none'}
                data-recovery-impact-cue={props.recoveryContext?.impactCue ?? 'none'}
                data-recovery-tone={props.recoveryContext?.tone ?? 'none'}
                data-recovery-value={props.recoveryContext?.value ?? 'none'}
                data-testid="tile-board-stub"
            />
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
    detectClaimedFindableKind: () => hudAnnouncementMock.claimedFindableKind,
    formatHudActionFeedbackText: hudAnnouncementMock.formatHudActionFeedbackText,
    getFindableToastText: hudAnnouncementMock.getFindableToastText,
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
        hudAnnouncementMock.claimedFindableKind = null;
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
                dungeonExitPromptOpen: false,
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
        expect(rail).toHaveTextContent('Risk');
        expect(rail.querySelector('[data-action-feedback-signal="risk"]')).toHaveTextContent('Risk');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Recover lane');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Recover lane');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
            'data-action-feedback-impact-tone',
            'risk'
        );
        expect(rail).toHaveAttribute('data-intensity', 'high');
        expect(rail.querySelector('[data-action-feedback-detail="risk"]')).toHaveTextContent('Life lost');
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
        expect(rail).toHaveTextContent('Action result');
        expect(rail).toHaveTextContent('Objective');
        expect(rail.querySelector('[data-action-feedback-signal="objective"]')).toHaveTextContent('Objective');
        expect(rail).toHaveTextContent('Match resolved. 3/4 pairs cleared.');
        expect(rail).toHaveTextContent('Next: 1 pair left.');
        expect(rail.querySelector('[data-action-feedback-followup="info"]')).toHaveTextContent('Next: 1 pair left.');
    });

    it('queues a polite next-tool announcement when a swap can create a trait route', async () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run = {
            ...baseRun,
            regionShuffleCharges: 1,
            board: {
                ...baseRun.board!,
                columns: 2,
                tiles: [
                    { id: 's1', pairKey: 'sealed', symbol: 'S', label: 'Sealed', state: 'hidden', tileTraitKind: 'sealed' as const },
                    { id: 'f1', pairKey: 'filler', symbol: 'F', label: 'Filler', state: 'hidden' },
                    { id: 'x1', pairKey: 'origin', symbol: 'O', label: 'Origin', state: 'hidden' },
                    { id: 'h1', pairKey: 'heavy', symbol: 'H', label: 'Heavy', state: 'hidden', tileTraitKind: 'heavy' as const }
                ]
            }
        } as RunState;

        const rendered = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        await waitFor(() => {
            expect(hudAnnouncementMock.queuePoliteAnnouncement).toHaveBeenCalledWith(
                'Trait route prime found. Use swap: Swap Sealed with Filler: Sealed + Heavy: score surge.',
                {
                    dedupeKey: 'trait-route-setup:1:s1:f1',
                    priority: 'info'
                }
            );
        });

        rendered.rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen
                        achievements={[]}
                        run={{ ...run, board: { ...run.board!, tiles: [...run.board!.tiles] } }}
                    />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        await waitFor(() => {
            const routeSetupCalls = hudAnnouncementMock.queuePoliteAnnouncement.mock.calls.filter(
                ([text]) => text === 'Trait route prime found. Use swap: Swap Sealed with Filler: Sealed + Heavy: score surge.'
            );
            expect(routeSetupCalls).toHaveLength(1);
        });
    });

    it('adds chain reward stack context to pickup reward toasts', async () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const initialRun = {
            ...baseRun,
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 2,
            lives: 4,
            stats: {
                ...baseRun.stats,
                comboShards: 1,
                currentStreak: 3
            }
        } as RunState;
        const claimedRun = {
            ...initialRun,
            findablesClaimedThisFloor: 1,
            board: {
                ...initialRun.board!,
                tiles: [...initialRun.board!.tiles]
            }
        } as RunState;

        const rendered = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={initialRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        hudAnnouncementMock.claimedFindableKind = 'shard_spark';
        rendered.rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={claimedRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        await waitFor(() => {
            const pickupToast = useNotificationStore
                .getState()
                .notifications.find((notification) => notification.stackKey === 'pickup:1:1');
            expect(pickupToast?.message).toBe(
                'Stack prime: Shard spark +1 combo shard. Double cashout: x4 +1 shard in 1 match. Pickups 1/2.'
            );
        });
    });

    it('renders action feedback impact chips for chainable reward moments', () => {
        hudAnnouncementMock.message = 'Chain times five - Shard spark claimed: +1 combo shard. Trait routes: 2/2 complete.';
        hudAnnouncementMock.priority = 'info';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-intensity', 'high');
        expect(rail).toHaveAttribute('data-burst-tier', 'combo');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Stack cashout');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-intensity', 'stack');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-count', '4');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-beats', '5');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-tier', 'super');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-beats', '5');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-cue', 'super');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('5 beat');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Super burst');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('4 payoff signals');
        expect(screen.getByTestId('action-feedback-crescendo').querySelectorAll('[data-action-feedback-crescendo-beat]')).toHaveLength(5);
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('4');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Stack');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Cash stack');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveAttribute(
            'data-action-feedback-payoff-beats',
            '5'
        );
        expect(
            screen.getByTestId('action-feedback-payoff-intensity').querySelectorAll('[data-action-feedback-payoff-beat]')
        ).toHaveLength(5);
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
            'data-action-feedback-impact-tone',
            'combo'
        );
        expect(rail).toHaveAttribute('data-action-feedback-tempo-cue', 'Cash combo');
        expect(rail).toHaveAttribute('data-action-feedback-tempo-beats', '5');
        expect(rail).toHaveAttribute('data-action-feedback-tempo-cadence', 'cashout');
        expect(rail).toHaveAttribute('data-action-feedback-tempo-label', 'Combo snap');
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Now');
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Cash combo');
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Combo snap');
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveAttribute(
            'data-action-feedback-tempo-tone',
            'combo'
        );
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveAttribute(
            'data-action-feedback-tempo-beats',
            '5'
        );
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveAttribute(
            'data-action-feedback-tempo-cadence',
            'cashout'
        );
        expect(
            screen.getByTestId('action-feedback-tempo-cue').querySelectorAll('[data-action-feedback-tempo-beat]')
        ).toHaveLength(5);
        expect(rail.querySelector('[data-action-feedback-stack="combo"]')).toHaveTextContent('4x combo');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Chain x5');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Shard cashout');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Route paid');
        expect(rail.querySelector('[data-action-feedback-detail="chain"]')).toHaveTextContent('Chain x5');
        expect(rail.querySelector('[data-action-feedback-detail="reward"]')).toHaveTextContent('Shard cashout');
        expect(rail.querySelector('[data-action-feedback-detail="trait"]')).toHaveTextContent('Route paid');
        expect(rail).toHaveAttribute('data-action-feedback-lane-map', 'cash:2>route:1>chain:1');
        expect(rail).toHaveAttribute('data-action-feedback-lane-roles', 'cash:Cashout:2>route:Route:1>chain:Protect:1');
        expect(rail).toHaveAttribute('data-action-feedback-lane-role-ids', 'cash:cashout:2>route:route:1>chain:protect:1');
        expect(rail).toHaveAttribute(
            'data-action-feedback-lane-actions',
            'cash:Cash now:2>route:Route next:1>chain:Protect streak:1'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-lane-map',
            'cash:2>route:1>chain:1'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-lane-roles',
            'cash:Cashout:2>route:Route:1>chain:Protect:1'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-lane-role-ids',
            'cash:cashout:2>route:route:1>chain:protect:1'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-lane-actions',
            'cash:Cash now:2>route:Route next:1>chain:Protect streak:1'
        );
        const laneMapSummary = screen.getByTestId('action-feedback-lane-map-summary');
        expect(laneMapSummary).toHaveTextContent('Lanes');
        expect(laneMapSummary).toHaveTextContent('3 lanes');
        expect(laneMapSummary).toHaveAttribute('data-action-feedback-lane-summary-primary', 'cash');
        expect(laneMapSummary).toHaveAttribute('data-action-feedback-lane-summary-primary-action', 'Cash now');
        expect(laneMapSummary).toHaveAttribute('data-action-feedback-lane-summary-primary-audio', 'feedback-cash-lane');
        expect(laneMapSummary).toHaveAttribute('data-action-feedback-lane-summary-primary-role', 'Cashout');
        expect(laneMapSummary).toHaveAttribute('data-action-feedback-lane-summary-primary-role-id', 'cashout');
        expect(laneMapSummary).toHaveAttribute('data-action-feedback-lane-summary-primary-screen-cue', 'burst');
        expect(laneMapSummary.querySelectorAll('[data-action-feedback-lane-map-summary-beat]')).toHaveLength(4);
        expect(
            laneMapSummary.querySelector('[data-action-feedback-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-action-feedback-lane-map-summary-beat-focus', 'primary');
        expect(
            laneMapSummary.querySelector('[data-action-feedback-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-action-feedback-lane-map-summary-beat-primary', 'cash');
        expect(
            laneMapSummary.querySelector('[data-action-feedback-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-action-feedback-lane-map-summary-beat-role-id', 'cashout');
        expect(
            laneMapSummary.querySelector('[data-action-feedback-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-action-feedback-lane-map-summary-beat-screen-cue', 'burst');
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute('data-action-feedback-primary-lane', 'cash');
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-primary-lane-action',
            'Cash now'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-primary-lane-audio',
            'feedback-cash-lane'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute('data-action-feedback-primary-lane-beats', '4');
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-primary-lane-cue',
            'Shard cashout'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-primary-lane-role',
            'Cashout'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-primary-lane-role-id',
            'cashout'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAttribute(
            'data-action-feedback-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('action-feedback-lane-map')).toHaveAccessibleName(
            'Action lane map. Cash Cashout x2. Cash now. Shard cashout. Route Route x1. Route next. Route paid. Chain Protect x1. Protect streak. Chain x5.'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAccessibleName(
            'Primary feedback lane. Cashout Cash: Cash now. Shard cashout. 4 beats.'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAttribute('data-action-feedback-primary-lane', 'cash');
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAttribute(
            'data-action-feedback-primary-lane-action',
            'Cash now'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAttribute(
            'data-action-feedback-primary-lane-audio',
            'feedback-cash-lane'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAttribute(
            'data-action-feedback-primary-lane-cue',
            'Shard cashout'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAttribute(
            'data-action-feedback-primary-lane-role',
            'Cashout'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAttribute(
            'data-action-feedback-primary-lane-role-id',
            'cashout'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveAttribute(
            'data-action-feedback-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('action-feedback-primary-lane')).toHaveTextContent('Next chase');
        expect(screen.getByTestId('action-feedback-primary-lane').querySelectorAll('[data-action-feedback-primary-lane-beat]')).toHaveLength(4);
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="cash"]')).toHaveTextContent(
            'x2 / Shard cashout'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="cash"]')).toHaveTextContent(
            'Cash now'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="cash"]')).toHaveAttribute(
            'data-action-feedback-lane-role',
            'Cashout'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="cash"]')).toHaveAttribute(
            'data-action-feedback-lane-role-id',
            'cashout'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="cash"]')).toHaveAttribute(
            'data-action-feedback-lane-action',
            'Cash now'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="cash"]')).toHaveAttribute(
            'data-action-feedback-lane-beats',
            '4'
        );
        expect(
            screen
                .getByTestId('action-feedback-lane-map')
                .querySelector('[data-action-feedback-lane="cash"]')
                ?.querySelectorAll('[data-action-feedback-lane-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="route"]')).toHaveTextContent(
            'Route paid'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="route"]')).toHaveTextContent(
            'x1 / Route paid'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="route"]')).toHaveTextContent(
            'Route next'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="route"]')).toHaveAttribute(
            'data-action-feedback-lane-role',
            'Route'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="route"]')).toHaveAttribute(
            'data-action-feedback-lane-role-id',
            'route'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="route"]')).toHaveAttribute(
            'data-action-feedback-lane-action',
            'Route next'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="route"]')).toHaveAttribute(
            'data-action-feedback-lane-beats',
            '3'
        );
        expect(
            screen
                .getByTestId('action-feedback-lane-map')
                .querySelector('[data-action-feedback-lane="route"]')
                ?.querySelectorAll('[data-action-feedback-lane-beat]')
        ).toHaveLength(3);
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="chain"]')).toHaveTextContent(
            'Chain x5'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="chain"]')).toHaveTextContent(
            'x1 / Chain x5'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="chain"]')).toHaveTextContent(
            'Protect streak'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="chain"]')).toHaveAttribute(
            'data-action-feedback-lane-role',
            'Protect'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="chain"]')).toHaveAttribute(
            'data-action-feedback-lane-role-id',
            'protect'
        );
        expect(screen.getByTestId('action-feedback-lane-map').querySelector('[data-action-feedback-lane="chain"]')).toHaveAttribute(
            'data-action-feedback-lane-beats',
            '3'
        );
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAttribute(
            'data-action-feedback-stack-action',
            'Cash now'
        );
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAttribute(
            'data-action-feedback-stack-tone',
            'cashout'
        );
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent('Cash now');
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
            'Chain x5 + Shard cashout + Pickup + Route paid'
        );
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAccessibleName(
            /Stack cashout: Cash now\. Chain x5 \+ Shard cashout \+ Pickup \+ Route paid\. Next:/i
        );
    });

    it('renders trait combo surge as a distinct action feedback burst', () => {
        hudAnnouncementMock.message =
            'Match resolved. 1/4 pairs cleared. Trait combo surge: Drift and Stasis resolved.';
        hudAnnouncementMock.priority = 'info';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-intensity', 'medium');
        expect(rail).toHaveAttribute('data-burst-tier', 'trait');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Trait surge');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-intensity', 'surge');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-count', '1');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-action', 'Chain routes');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-audio', 'prime-pop');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-screen-cue', 'pulse');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-tier', 'prime');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-beats', '2');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-action', 'Chain routes');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-audio', 'prime-pop');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-cue', 'pulse');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Prime beat');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Chain routes');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveAttribute(
            'data-action-feedback-crescendo-action',
            'Chain routes'
        );
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveAttribute(
            'data-action-feedback-crescendo-audio',
            'prime-pop'
        );
        expect(screen.getByTestId('action-feedback-crescendo').querySelectorAll('[data-action-feedback-crescendo-beat]')).toHaveLength(2);
        expect(rail).toHaveAttribute('data-action-feedback-impact-action', 'Route next');
        expect(rail).toHaveAttribute('data-action-feedback-impact-audio', 'action-trait');
        expect(rail).toHaveAttribute('data-action-feedback-impact-screen-cue', 'snap');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
            'data-action-feedback-impact-tone',
            'trait'
        );
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
            'data-action-feedback-impact-action',
            'Route next'
        );
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Surge');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Chain routes');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveAttribute(
            'data-action-feedback-payoff-audio',
            'prime-pop'
        );
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Trait surge');
        expect(rail.querySelector('[data-action-feedback-detail="trait"]')).toHaveTextContent('Trait surge');
    });

    it('headlines trait-only perk and cashout payoffs instead of generic trait lane', () => {
        hudAnnouncementMock.message = 'Perk pop: Trait Streak Lens flashes a pair.';
        hudAnnouncementMock.priority = 'info';

        const rendered = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        let rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-burst-tier', 'trait');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Perk pop');
        expect(rail).toHaveAttribute('data-action-feedback-tempo-cue', 'Cash perk');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Perk pop');
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Cash perk');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Perk pop');

        hudAnnouncementMock.message = 'Trait cashout: Echo + Sealed: combo shard.';
        rendered.rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-burst-tier', 'reward');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Trait cashout');
        expect(rail).toHaveAttribute('data-action-feedback-tempo-cue', 'Cash trait');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Trait cashout');
        expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Cash trait');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Trait cashout');
    });

    it('renders trait and perk payoff announcements as stack cashout rail cues when chained', () => {
        hudAnnouncementMock.message =
            'Chain started: x3. Perk pop: Echo Conduit Lens doubles the route. Trait cashout: Echo + Sealed: combo shard.';
        hudAnnouncementMock.priority = 'info';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-burst-tier', 'combo');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Stack cashout');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Chain x3');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Perk pop');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Trait cashout');
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent('Stack cashout');
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAttribute(
            'data-action-feedback-stack-tone',
            'cashout'
        );
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
            'Chain x3 + Shard cashout + Perk pop + Trait cashout'
        );
        expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveAccessibleName(
            /Action sequence\. First: Cash now\. Then: Cash combo\. Keep: perk payoff landed; route the next trait or chain cashout\./i
        );
    });

    it('headlines single pickup rewards as pickup cashouts in the action rail', () => {
        hudAnnouncementMock.message = 'Pickup cashout: Shard spark +1 combo shard.';
        hudAnnouncementMock.priority = 'info';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-burst-tier', 'reward');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Pickup cashout');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-intensity', 'cashout');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-count', '3');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-tier', 'cashout');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-beats', '3');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Cashout beat');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Cashout');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Hit now');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Pickup cashout');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
            'data-action-feedback-impact-tone',
            'reward'
        );
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Pickup cashout');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Pickup');
    });

    it('renders chain reward urgency as a distinct action feedback chip', () => {
        hudAnnouncementMock.message =
            'Chain started: x3. Reward loop online. Next reward: One-away cashout: x4 +1 shard in 1 match.';
        hudAnnouncementMock.priority = 'info';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-burst-tier', 'combo');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Prime cashout');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-intensity', 'prime');
        expect(rail).toHaveAttribute('data-action-feedback-payoff-count', '3');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-tier', 'prime');
        expect(rail).toHaveAttribute('data-action-feedback-crescendo-beats', '2');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Prime beat');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Prime route');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Prime');
        expect(screen.getByTestId('action-feedback-payoff-intensity')).toHaveTextContent('Prime route');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Prime cashout');
        expect(rail.querySelector('[data-action-feedback-detail-kind="chain-x3"]')).toHaveTextContent('Chain x3');
        expect(rail.querySelector('[data-action-feedback-detail-kind="shard-cashout"]')).toHaveTextContent('Shard cashout');
        expect(rail.querySelector('[data-action-feedback-detail-kind="one-away-cashout"]')).toHaveTextContent('One-away cashout');
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
            'Chain x3 + Shard cashout + One-away cashout'
        );
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAttribute(
            'data-action-feedback-stack-action',
            'Prime'
        );
        expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAttribute(
            'data-action-feedback-stack-tone',
            'build'
        );
    });

    it('renders next-reward prime as a cashout chase instead of generic resource advice', () => {
        hudAnnouncementMock.message =
            'Surge hit: x6. Surge tier live. Next reward: Combo prime: x8 +1 shard in 2 matches.';
        hudAnnouncementMock.priority = 'info';

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const rail = screen.getByTestId('action-feedback-rail');
        expect(rail).toHaveAttribute('data-burst-tier', 'combo');
        expect(rail).toHaveAttribute('data-action-feedback-impact-cue', 'Prime cashout');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Prime cashout');
        expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
            'data-action-feedback-impact-tone',
            'combo'
        );
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Chain x6');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Shard setup');
        expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Combo prime');
        expect(rail.querySelector('[data-action-feedback-followup="reward"]')).toHaveTextContent(
            'Next: prime the cashout with the safest confirmed match.'
        );
    });

    it('classifies visible action feedback into arcade signal chips', () => {
        expect(getVisualHudAnnouncementSignal('Chain times five - keep the chain.', 'info')).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getVisualHudAnnouncementSignal('Surge hit: x6. Surge tier live. Next reward: Combo prime: x8 +1 shard in 2 matches.', 'info')).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getVisualHudAnnouncementSignal('Chain x5 broken - recover with a remembered pair.', 'info')).toEqual({
            label: 'Risk',
            tone: 'risk'
        });
        expect(getVisualHudAnnouncementSignal('Shard spark claimed: +1 combo shard.', 'info')).toEqual({
            label: 'Reward',
            tone: 'reward'
        });
        expect(getVisualHudAnnouncementSignal('Pickup cashout: Shard spark +1 combo shard.', 'info')).toEqual({
            label: 'Reward',
            tone: 'reward'
        });
        expect(getVisualHudAnnouncementSignal('Cascade: chain cascade.', 'info')).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getVisualHudAnnouncementSignal('Cascade: combo cascade.', 'info')).toEqual({
            label: 'Reward',
            tone: 'reward'
        });
        expect(getVisualHudAnnouncementSignal('Cascade Cache fired. One safe hidden pair cleared.', 'info')).toEqual({
            label: 'Reward',
            tone: 'reward'
        });
        expect(getVisualHudAnnouncementSignal('Shuffle Snare fired. Hidden safe tiles reordered.', 'info')).toEqual({
            label: 'Risk',
            tone: 'risk'
        });
        expect(getVisualHudAnnouncementSignal('Reward lost: x8 +1 shard.', 'info')).toEqual({
            label: 'Risk',
            tone: 'risk'
        });
        expect(getVisualHudAnnouncementSignal('Echo and Stasis trait resolved.', 'info')).toEqual({
            label: 'Trait',
            tone: 'trait'
        });
        expect(getVisualHudAnnouncementSignal('Perk pop: Echo Conduit Lens doubles the route.', 'info')).toEqual({
            label: 'Trait',
            tone: 'trait'
        });
        expect(getVisualHudAnnouncementSignal('Guard token spent. 0 guard tokens remain.', 'info')).toEqual({
            label: 'Guard',
            tone: 'guard'
        });
    });

    it('summarizes visible action feedback into compact impact chips', () => {
        expect(getStackCashoutLaneCount(['Chain x5', 'Shard cashout', 'Pickup', 'Route paid'])).toBe(3);
        expect(getStackCashoutLaneCount(['Chain x3', 'Shard cashout', 'One-away cashout'])).toBe(1);
        expect(getStackCashoutLaneCount(['Cashout armed', 'Pickup cashout', 'Route paid'])).toBe(3);
        expect(getStackCashoutLaneCount(['Route cashout', 'Trait cashout', 'Perk pop', 'One-away cashout'])).toBe(3);
        expect(
            getVisualHudAnnouncementImpact(
                'Chain times five - Shard spark claimed: +1 combo shard. Trait routes: 2/2 complete.',
                'info'
            )
        ).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Chain x5', tone: 'chain' },
                { label: 'Shard cashout', tone: 'reward' },
                { label: 'Pickup', tone: 'reward' },
                { label: 'Route paid', tone: 'trait' }
            ],
            level: 'high'
        });
        expect(getVisualHudAnnouncementImpact('2 guard tokens gained. 2 available.', 'info')).toEqual({
            burstTier: 'reward',
            details: [
                { label: '+Guard', tone: 'guard' }
            ],
            level: 'low'
        });
        expect(getVisualHudAnnouncementImpact('Life lost. No match.', 'error')).toEqual({
            burstTier: 'risk',
            details: [
                { label: 'Miss', tone: 'risk' }
            ],
            level: 'high'
        });
        expect(getVisualHudAnnouncementImpact('Chain x5 broken - recover with a remembered pair.', 'info')).toEqual({
            burstTier: 'risk',
            details: [
                { label: 'Chain x5', tone: 'chain' },
                { label: 'Chain break', tone: 'risk' }
            ],
            level: 'high'
        });
        expect(
            getVisualHudAnnouncementImpact(
                'No match. Chain x6 broken. Lost reward target: x8 +1 shard in 2 matches. Next chase: Break into x10. Next action: Save cashout: Rebuild toward x8 +1 shard. Recover with a safe match. x6 lost',
                'info'
            )
        ).toEqual({
            burstTier: 'risk',
            details: [
                { label: 'Chain x6', tone: 'chain' },
                { label: 'Chain break', tone: 'risk' },
                { label: 'Lost reward', tone: 'risk' },
                { label: 'Next chase', tone: 'chain' }
            ],
            level: 'high'
        });
        expect(
            getVisualHudAnnouncementImpact(
                'Trait penalty. No match. Next action: Recover route: peek or route away. Cursed + Volatile: recall pressure. Recover - peek or route away',
                'info'
            )
        ).toEqual({
            burstTier: 'risk',
            details: [
                { label: 'Trait penalty', tone: 'risk' },
                { label: 'Miss', tone: 'risk' },
                { label: 'Recover', tone: 'risk' }
            ],
            level: 'high'
        });
        expect(
            getVisualHudAnnouncementImpact(
                'Surge hit: x6. Surge tier live. Next reward: Combo prime: x8 +1 shard in 2 matches.',
                'info'
            )
        ).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Chain x6', tone: 'chain' },
                { label: 'Shard setup', tone: 'reward' },
                { label: 'Combo prime', tone: 'reward' }
            ],
            level: 'high'
        });
        expect(
            getVisualHudAnnouncementImpact(
                'Chain started: x3. Reward loop online. Next reward: One-away cashout: x4 +1 shard in 1 match.',
                'info'
            )
        ).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Chain x3', tone: 'chain' },
                { label: 'Shard cashout', tone: 'reward' },
                { label: 'One-away cashout', tone: 'reward' }
            ],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Pickup cashout: Shard spark +1 combo shard.', 'info')).toEqual({
            burstTier: 'reward',
            details: [
                { label: 'Shard cashout', tone: 'reward' },
                { label: 'Pickup cashout', tone: 'reward' },
                { label: 'Pickup', tone: 'reward' }
            ],
            level: 'medium'
        });
        expect(
            getVisualHudAnnouncementImpact(
                'Chain. Plus 30 points. 5 match streak, 1 match to x6. Cashout armed: x6 +1 shard. Impact cue: Cashout armed.',
                'info'
            )
        ).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Streak live', tone: 'chain' },
                { label: 'Shard cashout', tone: 'reward' },
                { label: 'Cashout armed', tone: 'reward' }
            ],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Route cashout: Greed Cache +2 gold +25 score.', 'info')).toEqual({
            burstTier: 'reward',
            details: [
                { label: 'Route cashout', tone: 'reward' },
                { label: '+Gold', tone: 'reward' }
            ],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Perk pop: Echo Conduit Lens doubles the route.', 'info')).toEqual({
            burstTier: 'trait',
            details: [{ label: 'Perk pop', tone: 'trait' }],
            level: 'low'
        });
        expect(getVisualHudAnnouncementImpact('Trait cashout: Echo + Sealed: combo shard.', 'info')).toEqual({
            burstTier: 'reward',
            details: [
                { label: 'Shard cashout', tone: 'reward' },
                { label: 'Trait cashout', tone: 'trait' }
            ],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Trait surge: 2 interactions. Cascade: combo cascade.', 'info')).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Combo cascade', tone: 'chain' },
                { label: 'Reward cascade', tone: 'reward' },
                { label: 'Trait surge', tone: 'trait' }
            ],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Trait combo surge: Drift and Stasis resolved.', 'info')).toEqual({
            burstTier: 'trait',
            details: [{ label: 'Trait surge', tone: 'trait' }],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Cascade: chain cascade.', 'info')).toEqual({
            burstTier: 'chain',
            details: [{ label: 'Chain cascade', tone: 'chain' }],
            level: 'low'
        });
        expect(getVisualHudAnnouncementImpact('Cascade: combo cascade. Shard spark +1 combo shard.', 'info')).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Combo cascade', tone: 'chain' },
                { label: 'Reward cascade', tone: 'reward' },
                { label: '+Shard', tone: 'reward' }
            ],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Cascade Cache fired. One safe pair cleared itself.', 'info')).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Hazard payoff', tone: 'reward' },
                { label: 'Auto-clear', tone: 'chain' }
            ],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Shuffle Snare fired. Hidden safe tiles reordered.', 'info')).toEqual({
            burstTier: 'risk',
            details: [{ label: 'Hazard trigger', tone: 'risk' }],
            level: 'high'
        });
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
        ).toBe('Next: hazard blocked; continue from the best safe match.');
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
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Chain x5 broken - recover with a remembered pair.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: rebuild from a confirmed pair before chasing rewards.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'No match. Chain x6 broken. Lost reward target: x8 +1 shard in 2 matches.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 4,
                lives: 3
            })
        ).toBe('Next: rebuild from a confirmed pair before chasing the lost reward again.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Pickup cashout: Shard spark +1 combo shard.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: pickup reward applied; keep the streak alive with a confirmed pair.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Cashout armed: x6 +1 shard.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: cashout is armed; take the safest confirmed match now.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Surge hit: x6. Surge tier live. Next reward: Combo prime: x8 +1 shard in 2 matches.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: prime the cashout with the safest confirmed match.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Chain started: x3. Reward loop online. Next reward: One-away cashout: x4 +1 shard in 1 match.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: cashout is one match away; take the safest confirmed match.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Route cashout: Greed Cache +2 gold +25 score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: route value is banked; chase the safest chainable payoff.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Trait cashout: Echo + Sealed combo shard.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: trait payoff landed; look for the next connected trait card.');
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
        ).toBe('Next: preserve the streak with the best safe match.');
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
                announcement: 'Trait route prime found. Use swap: Swap Sealed with Filler: Sealed + Heavy: score surge.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: use Swap on the marked cards to create the route.');

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
        ).toBe('Next: route cashout banked; spend it when the board gets risky.');
    });

    it('prioritizes reward and trait next-step copy over generic match progress', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Combo shard gained. 1 available.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: spend shards on powers when the board gets risky.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Echo trait resolved.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: trait payoff landed; look for the next chainable interaction.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Perk pop: Echo Conduit Lens doubles the route.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: perk payoff landed; route the next trait or chain cashout.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Cursed trait penalty applied.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: trait penalty landed; rebuild from a confirmed pair.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'No match. Recover with a safe match. Chain reset. Trait surge: 2 penalties applied: Volatile and Mirror.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: multiple trait penalties landed; use the safest confirmed pair before touching that cluster again.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Combo. Plus 80 points. 3 match streak, 3 matches to x6. Cascade: combo cascade. Combo burst: 3-way payoff. Trait surge: 2 interactions.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: combo burst landed; cash the safest remaining payoff before the chain cools.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Reward. Plus 125 points. Cascade: reward cascade. Reward burst: 2-way payoff.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: reward burst landed; keep the payoff loop alive with a safe match.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Surge. Plus 80 points. Trait surge: 2 interactions.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: trait surge landed; look for the next multi-trait route.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Trait combo surge: Drift and Stasis resolved.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
                lives: 3
            })
        ).toBe('Next: trait surge landed; look for the next multi-trait route.');
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
        expect(screen.getByTestId('playable-onboarding-signals')).toHaveTextContent('Flip pair');
        expect(screen.getByTestId('playable-onboarding-signals')).toHaveTextContent('Score pop');
        expect(screen.getByTestId('playable-onboarding-signals')).toHaveTextContent('Start streak');
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="action"]')).toHaveAttribute(
            'data-onboarding-signal-beats',
            '2'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="action"]')).toHaveAttribute(
            'data-onboarding-signal-audio',
            'onboarding-action'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="action"]')).toHaveAttribute(
            'data-onboarding-signal-screen-cue',
            'action'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="reward"]')).toHaveAttribute(
            'data-onboarding-signal-beats',
            '4'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="reward"]')).toHaveAttribute(
            'data-onboarding-signal-audio',
            'onboarding-reward'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="reward"]')).toHaveAttribute(
            'data-onboarding-signal-screen-cue',
            'burst'
        );
        expect(
            screen
                .getByTestId('playable-onboarding-signals')
                .querySelector('[data-onboarding-signal-tone="reward"]')
                ?.querySelectorAll('[data-onboarding-signal-beat]')
        ).toHaveLength(4);
        expect(
            screen
                .getByTestId('playable-onboarding-signals')
                .querySelector('[data-onboarding-signal-tone="reward"] [data-onboarding-signal-beat="1"]')
        ).toHaveAttribute('data-onboarding-signal-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('playable-onboarding-signals')
                .querySelector('[data-onboarding-signal-tone="reward"] [data-onboarding-signal-beat="2"]')
        ).toHaveAttribute('data-onboarding-signal-beat-focus', 'support');
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="chain"]')).toHaveAttribute(
            'data-onboarding-signal-beats',
            '3'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="chain"]')).toHaveAttribute(
            'data-onboarding-signal-audio',
            'onboarding-chain'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="chain"]')).toHaveAttribute(
            'data-onboarding-signal-screen-cue',
            'chain'
        );
        expect(screen.getByTestId('playable-onboarding-signals')).toHaveAttribute(
            'aria-label',
            'Onboarding action and reward signals. Action: Flip pair. Reward: Score pop. Chain: Start streak.'
        );
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
        expect(screen.getByTestId('playable-onboarding-signals')).toHaveTextContent('Rebuild');
        expect(screen.getByTestId('playable-onboarding-signals')).toHaveTextContent('Keep clean');
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="recovery"]')).toHaveAttribute(
            'data-onboarding-signal-beats',
            '3'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="recovery"]')).toHaveAttribute(
            'data-onboarding-signal-audio',
            'onboarding-recovery'
        );
        expect(screen.getByTestId('playable-onboarding-signals').querySelector('[data-onboarding-signal-tone="recovery"]')).toHaveAttribute(
            'data-onboarding-signal-screen-cue',
            'recover'
        );

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
        expect(screen.getByTestId('first-run-room-goal-signals')).toHaveTextContent('Clear pairs');
        expect(screen.getByTestId('first-run-room-goal-signals')).toHaveTextContent('Route choice');
        expect(screen.getByTestId('first-run-room-goal-signals')).toHaveTextContent('Clean finish');
        expect(
            screen
                .getByTestId('first-run-room-goal-signals')
                .querySelector('[data-onboarding-signal-tone="route"] [data-onboarding-signal-beat="1"]')
        ).toHaveAttribute('data-onboarding-signal-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('first-run-room-goal-signals')
                .querySelector('[data-onboarding-signal-tone="route"] [data-onboarding-signal-beat="2"]')
        ).toHaveAttribute('data-onboarding-signal-beat-focus', 'support');
        expect(screen.getByTestId('first-run-room-goal-signals')).toHaveAttribute(
            'aria-label',
            'Room goal reward signals. Goal: Clear pairs. Reward: Route choice. Chain: Clean finish.'
        );
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
                        chainDepth: 4,
                        feedbackHeadline: 'Chain',
                        feedbackIntensity: 'mid',
                        feedbackSignal: { label: 'Pickup', tone: 'pickup' },
                        impactCue: { label: 'Stack cashout', tone: 'reward' },
                        crescendo: {
                            audioCue: 'stack-burst',
                            beatCount: 4,
                            detail: '2 payoff lanes',
                            label: 'Stack burst',
                            screenCue: 'burst',
                            tier: 'stack'
                        },
                        cascadeCue: { label: 'Cascade', value: 'reward cascade', tier: 'reward' },
                        rewardBurst: { action: 'Stack cashout', label: 'Reward burst', value: '2-way payoff', tier: 'stack' },
                        payoffSummary: {
                            label: 'Stack cashout',
                            value: '2 payoffs: Pickup + Chain',
                            tier: 'reward'
                        },
                        payoffLadder: {
                            first: 'Pickup cashout',
                            lanes: ['Pickup cashout', 'Chain cashout'],
                            then: 'One-away cashout',
                            keep: 'Hit now',
                            tone: 'reward'
                        },
                        chainRewardForecastCues: [
                            {
                                actionLabel: 'Next',
                                chaseLabel: 'Hit now',
                                distance: 1,
                                distanceLabel: '1 match',
                                id: 'shard-4',
                                label: 'x4 +1 shard',
                                stackSize: 2,
                                targetStreak: 4,
                                tone: 'reward',
                                urgency: 'next'
                            },
                            {
                                actionLabel: 'Next',
                                chaseLabel: 'Hit now',
                                distance: 1,
                                distanceLabel: '1 match',
                                id: 'guard-4',
                                label: 'x4 +1 guard',
                                stackSize: 2,
                                targetStreak: 4,
                                tone: 'guard',
                                urgency: 'next'
                            }
                        ],
                        payoffChips: [
                            { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+99', tone: 'score' },
                            { arcadeCue: 'Prime cashout', id: 'streak', label: 'Streak', value: 'x4', tone: 'chain' },
                            { arcadeCue: 'Reward cascade', id: 'cascade', label: 'Cascade', value: 'reward cascade', tone: 'chain' },
                            { arcadeCue: 'Pickup cashout', id: 'pickup', label: 'Pickup', value: 'Shard spark +1 combo shard', tone: 'pickup' },
                            { arcadeCue: 'Chain cashout', id: 'chainReward', label: 'Cashout', value: '+1 combo shard / +1 guard token', tone: 'reward' },
                            {
                                arcadeCue: 'One-away cashout',
                                id: 'next',
                                label: 'Next shard',
                                value: 'x4 +1 shard',
                                tone: 'reward'
                            }
                        ],
                        chainRewardText: '+1 combo shard / +1 guard token',
                        pickupRewardText: 'Shard spark +1 combo shard',
                        tileIdA: 'a',
                        tileIdB: 'b',
                        key: 'test-floater-1'
                    }
                });
            });

            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('Chain');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-crescendo-audio', 'stack-burst');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-crescendo-beats', '4');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-crescendo-cue', 'burst');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-crescendo-tier', 'stack');
            expect(screen.getByTestId('match-score-floater-crescendo')).toHaveTextContent('Stack burst');
            expect(screen.getByTestId('match-score-floater-crescendo')).toHaveTextContent('2 payoff lanes');
            expect(screen.getByTestId('match-score-floater-crescendo')).toHaveAttribute('data-match-crescendo-tier', 'stack');
            expect(screen.getByTestId('match-score-floater-crescendo')).toHaveAccessibleName(
                'Match crescendo Stack burst: 2 payoff lanes. 4 beats.'
            );
            expect(screen.getByTestId('match-score-floater-crescendo').querySelectorAll('[data-match-crescendo-beat]')).toHaveLength(4);
            expect(
                screen.getByTestId('match-score-floater-crescendo').querySelector('[data-match-crescendo-beat="1"]')
            ).toHaveAttribute('data-match-crescendo-beat-focus', 'primary');
            expect(
                screen.getByTestId('match-score-floater-crescendo').querySelector('[data-match-crescendo-beat="2"]')
            ).toHaveAttribute('data-match-crescendo-beat-focus', 'support');
            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('Pickup');
            expect(screen.getByTestId('match-score-floater').querySelector('[data-floater-signal="pickup"]')).toHaveTextContent('Pickup');
            expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveTextContent('Stack cashout');
            expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute('data-match-impact-cue-tone', 'reward');
            expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute('data-match-impact-cue-beats', '4');
            expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute('data-match-impact-cue-screen-cue', 'burst');
            expect(screen.getByTestId('match-score-floater-impact-cue').querySelectorAll('[data-match-impact-cue-beat]')).toHaveLength(4);
            expect(
                screen.getByTestId('match-score-floater-impact-cue').querySelector('[data-match-impact-cue-beat="1"]')
            ).toHaveAttribute('data-match-impact-cue-beat-focus', 'primary');
            expect(
                screen.getByTestId('match-score-floater-impact-cue').querySelector('[data-match-impact-cue-beat="2"]')
            ).toHaveAttribute('data-match-impact-cue-beat-focus', 'support');
            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('+99');
            expect(screen.getByTestId('match-score-floater-cascade')).toHaveTextContent('Cascade');
            expect(screen.getByTestId('match-score-floater-cascade')).toHaveTextContent('reward cascade');
            expect(screen.getByTestId('match-score-floater-cascade')).toHaveAttribute('data-cascade-tier', 'reward');
            expect(screen.getByTestId('match-score-floater-cascade')).toHaveAttribute('data-cascade-beats', '4');
            expect(screen.getByTestId('match-score-floater-cascade').querySelectorAll('[data-cascade-beat]')).toHaveLength(4);
            expect(screen.getByTestId('match-score-floater-cascade').querySelector('[data-cascade-beat="1"]')).toHaveAttribute(
                'data-cascade-beat-focus',
                'primary'
            );
            expect(screen.getByTestId('match-score-floater-cascade').querySelector('[data-cascade-beat="2"]')).toHaveAttribute(
                'data-cascade-beat-focus',
                'support'
            );
            expect(screen.getByTestId('match-score-floater-cascade')).toHaveAccessibleName('Cascade: reward cascade');
            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('x4 streak');
            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('2 matches to x6');
            expect(screen.getByTestId('match-score-floater').querySelector('[data-chain-streak-depth="4"]')).toBeInTheDocument();
            expect(
                screen.getByTestId('match-score-floater').querySelector('[data-chain-streak-depth="4"]')?.querySelectorAll(
                    '[data-chain-streak-beat]'
                )
            ).toHaveLength(4);
            expect(
                screen.getByTestId('match-score-floater').querySelector('[data-chain-streak-depth="4"]')?.querySelector(
                    '[data-chain-streak-beat="1"]'
                )
            ).toHaveAttribute('data-chain-streak-beat-focus', 'primary');
            expect(screen.getByTestId('match-score-floater').querySelector('[data-chain-streak-depth="4"]')).toHaveTextContent(
                'x4 streak'
            );
            expect(screen.getByTestId('match-score-floater').querySelector('[data-chain-streak-depth="4"]')).toHaveTextContent(
                '2 matches to x6'
            );
            expect(
                screen.getByTestId('match-score-floater').querySelector('[data-chain-streak-depth="4"]')?.querySelectorAll(
                    '[data-chain-streak-cue-beat]'
                )
            ).toHaveLength(4);
            expect(
                screen.getByTestId('match-score-floater').querySelector('[data-chain-streak-depth="4"]')?.querySelector(
                    '[data-chain-streak-cue-beat="1"]'
                )
            ).toHaveAttribute('data-chain-streak-cue-beat-focus', 'primary');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('x4 +1 shard');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('x4 +1 guard');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('2x stack');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('Hit now');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('Next');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('Cash next');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('Double cashout');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('1 match');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('2/2');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('4/4');
            const rewardForecastSummary = screen.getByTestId('match-score-floater-reward-forecast-summary');
            expect(rewardForecastSummary).toHaveTextContent('Forecast');
            expect(rewardForecastSummary).toHaveTextContent('2 rewards');
            expect(rewardForecastSummary.querySelectorAll('[data-chain-reward-forecast-summary-beat]')).toHaveLength(3);
            expect(
                rewardForecastSummary.querySelector('[data-chain-reward-forecast-summary-beat="1"]')
            ).toHaveAttribute('data-chain-reward-forecast-summary-beat-focus', 'primary');
            expect(rewardForecastSummary).toHaveAttribute('data-chain-reward-forecast-summary-tone', 'reward');
            expect(rewardForecastSummary).toHaveAttribute('data-chain-reward-forecast-summary-urgency', 'next');
            expect(rewardForecastSummary).toHaveAttribute('data-chain-reward-forecast-summary-screen-cue', 'burst');
            expect(
                rewardForecastSummary.querySelector('[data-chain-reward-forecast-summary-beat="1"]')
            ).toHaveAttribute('data-chain-reward-forecast-summary-beat-tone', 'reward');
            expect(
                rewardForecastSummary.querySelector('[data-chain-reward-forecast-summary-beat="1"]')
            ).toHaveAttribute('data-chain-reward-forecast-summary-beat-screen-cue', 'burst');
            expect(
                screen
                    .getByTestId('match-score-floater-reward-forecast')
                    .querySelector('[data-chain-reward-tone="reward"]')
            ).toHaveAttribute('data-chain-reward-stack-size', '2');
            expect(
                screen
                    .getByTestId('match-score-floater-reward-forecast')
                    .querySelector('[data-chain-reward-tone="reward"]')
                    ?.querySelectorAll('[data-chain-reward-stack-beat]')
            ).toHaveLength(2);
            expect(
                screen
                    .getByTestId('match-score-floater-reward-forecast')
                    .querySelector('[data-chain-reward-tone="reward"]')
                    ?.querySelector('[data-chain-reward-stack-beat="1"]')
            ).toHaveAttribute('data-chain-reward-stack-beat-focus', 'primary');
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveAccessibleName(
                /Match score floater reward forecast.*Hit now: Next: Cash next: x4 \+1 shard: 1 match: Double cashout: 2\/2: 0 matches left: 2x stack.*Hit now: Next: Cash next: x4 \+1 guard: 1 match: Double cashout: 4\/4: 0 matches left: 2x stack/i
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('x4 +1 shard');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('Hit now');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('Cash next');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveTextContent('2/2');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-progress',
                '2/2'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-progress-filled',
                '2'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-progress-total',
                '2'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-beats',
                '4'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-audio',
                'chain-reward-stack'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-screen-cue',
                'burst'
            );
            expect(
                screen
                    .getByTestId('match-score-floater-reward-forecast')
                    .querySelector('[data-chain-reward-tone="reward"]')
                    ?.querySelectorAll('[data-chain-reward-beat]')
            ).toHaveLength(4);
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-lane-action',
                'Cash next'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-stack-size',
                '2'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute('data-chain-reward-urgency', 'next');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-arcade-cue',
                'Double cashout'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute('data-chain-reward-distance', '1');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveTextContent('x4 +1 guard');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveTextContent('4/4');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-progress',
                '4/4'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-progress-filled',
                '4'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-progress-total',
                '4'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-beats',
                '4'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-audio',
                'chain-reward-stack'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-screen-cue',
                'burst'
            );
            expect(
                screen
                    .getByTestId('match-score-floater-reward-forecast')
                    .querySelector('[data-chain-reward-tone="guard"]')
                    ?.querySelectorAll('[data-chain-reward-beat]')
            ).toHaveLength(4);
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-lane-action',
                'Cash next'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute('data-chain-reward-urgency', 'next');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="guard"]')).toHaveAttribute(
                'data-chain-reward-arcade-cue',
                'Double cashout'
            );
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveTextContent('Reward burst');
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveTextContent('Stack cashout');
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveTextContent('2-way payoff');
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute(
                'data-reward-burst-action',
                'Stack cashout'
            );
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute(
                'data-reward-burst-label',
                'Reward burst'
            );
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute(
                'data-reward-burst-audio',
                'reward-burst-stack'
            );
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute(
                'data-reward-burst-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute('data-reward-burst-tier', 'stack');
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute('data-reward-burst-beats', '4');
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute('data-reward-burst-fill', '80');
            expect(screen.getByTestId('match-score-floater-reward-burst').querySelectorAll('[data-reward-burst-beat]')).toHaveLength(4);
            expect(
                screen.getByTestId('match-score-floater-reward-burst').querySelector('[data-reward-burst-beat="1"]')
            ).toHaveAttribute('data-reward-burst-beat-focus', 'primary');
            expect(
                screen.getByTestId('match-score-floater-reward-burst').querySelector('[data-reward-burst-beat="2"]')
            ).toHaveAttribute('data-reward-burst-beat-focus', 'support');
            expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAccessibleName(
                'Reward burst: Stack cashout: 2-way payoff'
            );
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveTextContent('Stack cashout');
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveTextContent('2 payoffs: Pickup + Chain');
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute(
                'data-payoff-summary-label',
                'Stack cashout'
            );
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute(
                'data-payoff-summary-audio',
                'payoff-summary-stack'
            );
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute(
                'data-payoff-summary-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute('data-payoff-summary-tier', 'reward');
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute('data-payoff-summary-beats', '4');
            expect(screen.getByTestId('match-score-floater-payoff-summary').querySelectorAll('[data-payoff-summary-beat]')).toHaveLength(4);
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAccessibleName(
                /Stack cashout: 2 payoffs: Pickup \+ Chain/i
            );
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('First');
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Pickup cashout');
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Then');
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('One-away cashout');
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Keep');
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Hit now');
            expect(
                screen
                    .getByTestId('match-score-floater-payoff-ladder')
                    .querySelector('[data-match-payoff-lane-index="1"]')
            ).toHaveTextContent('Pickup cashout');
            expect(
                screen
                    .getByTestId('match-score-floater-payoff-ladder')
                    .querySelector('[data-match-payoff-lane-index="1"]')?.querySelectorAll('[data-match-payoff-lane-pip]')
            ).toHaveLength(1);
            expect(
                screen
                    .getByTestId('match-score-floater-payoff-ladder')
                    .querySelector('[data-match-payoff-lane-index="2"]')?.querySelectorAll('[data-match-payoff-lane-pip]')
            ).toHaveLength(2);
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
                'data-match-payoff-ladder-tone',
                'reward'
            );
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
                'data-match-payoff-ladder-audio',
                'payoff-ladder-reward'
            );
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
                'data-match-payoff-ladder-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
                'data-match-payoff-ladder-lanes',
                'Pickup cashout|Chain cashout'
            );
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
                'data-match-payoff-ladder-beats',
                '4'
            );
            expect(
                screen
                    .getByTestId('match-score-floater-payoff-ladder')
                    .querySelectorAll('[data-match-payoff-ladder-beat]')
            ).toHaveLength(4);
            expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAccessibleName(
                'Match payoff ladder. First: Pickup cashout. Then: One-away cashout. Keep: Hit now. Lanes: Pickup cashout to Chain cashout.'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Score');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Score pop');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Prime cashout');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Reward cascade');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Pickup cashout');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Chain cashout');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('+99');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveAccessibleName(
                /Match score payoff chips.*Score pop: Score: \+99.*Prime cashout: Streak: x4.*Reward cascade: Cascade: reward cascade.*Pickup cashout: Pickup: Shard spark \+1 combo shard.*Chain cashout: Cashout: \+1 combo shard \/ \+1 guard token.*One-away cashout: Next shard: x4 \+1 shard/i
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Streak');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('x4');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="score"]')).toHaveAttribute(
                'data-match-payoff-beats',
                '1'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="score"]')).toHaveAttribute(
                'data-match-payoff-audio',
                'match-payoff-score'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="score"]')).toHaveAttribute(
                'data-match-payoff-screen-cue',
                'tick'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="score"]')).toHaveAttribute(
                'data-match-payoff-arcade-screen-cue',
                'tick'
            );
            expect(
                screen
                    .getByTestId('match-score-floater-payoff-chips')
                    .querySelector('[data-match-payoff-id="score"]')
                    ?.querySelectorAll('[data-match-payoff-chip-beat]')
            ).toHaveLength(1);
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="cascade"]')).toHaveTextContent('reward cascade');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="cascade"]')).toHaveAttribute(
                'data-match-payoff-arcade-cue',
                'Reward cascade'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="pickup"]')).toHaveTextContent('Shard spark +1 combo shard');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="pickup"]')).toHaveAttribute(
                'data-match-payoff-arcade-cue',
                'Pickup cashout'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="pickup"]')).toHaveAttribute(
                'data-match-payoff-audio',
                'match-payoff-pickup'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="pickup"]')).toHaveAttribute(
                'data-match-payoff-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="pickup"]')).toHaveAttribute(
                'data-match-payoff-arcade-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="chainReward"]')).toHaveTextContent('+1 combo shard / +1 guard token');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="chainReward"]')).toHaveAttribute(
                'data-match-payoff-arcade-cue',
                'Chain cashout'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="chainReward"]')).toHaveAttribute(
                'data-match-payoff-audio',
                'match-payoff-reward'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="chainReward"]')).toHaveAttribute(
                'data-match-payoff-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="chainReward"]')).toHaveAttribute(
                'data-match-payoff-arcade-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveTextContent('Next shard');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveTextContent('x4 +1 shard');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveTextContent('One-away cashout');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveAttribute(
                'data-match-payoff-arcade-cue',
                'One-away cashout'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveAttribute(
                'data-match-payoff-beats',
                '4'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveAttribute(
                'data-match-payoff-arcade-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveAttribute(
                'data-match-payoff-audio',
                'match-payoff-reward'
            );
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveAttribute(
                'data-match-payoff-screen-cue',
                'burst'
            );
            expect(
                screen
                    .getByTestId('match-score-floater-payoff-chips')
                    .querySelector('[data-match-payoff-id="next"]')
                    ?.querySelectorAll('[data-match-payoff-chip-beat]')
            ).toHaveLength(4);
            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('Shard spark +1 combo shard');
            expect(screen.getByTestId('match-score-floater')).toHaveTextContent('+1 combo shard / +1 guard token');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-feedback-intensity', 'mid');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-floater-heat', 'stack');
            expect(
                screen.getByText(/Chain\. Plus 99 points\. 4 match streak, 2 matches to x6\. Next rewards: Cash next: Double cashout: 1 match to x4 \+1 shard, Cash next: Double cashout: 1 match to x4 \+1 guard\. Cascade: reward cascade\. Reward burst: Stack cashout: 2-way payoff\. Stack cashout: 2 payoffs: Pickup \+ Chain\. Crescendo: Stack burst: 2 payoff lanes\. Impact cue: Stack cashout\. First: Pickup cashout\. Then: One-away cashout\. Keep: Hit now\. Lanes: Pickup cashout to Chain cashout\. Shard spark \+1 combo shard\. \+1 combo shard \/ \+1 guard token/)
            ).toBeInTheDocument();
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-burst-tier', 'combo');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-crescendo-tier', 'stack');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-crescendo-beats', '4');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-crescendo-cue', 'burst');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-crescendo-audio', 'stack-burst');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-payoff-action', 'Cash stack');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-payoff-audio', 'stack-burst');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-payoff-screen-cue', 'burst');
            expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('4 beat');
            expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Stack burst');
            expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('2 payoff lanes');
            expect(screen.getByTestId('action-feedback-crescendo')).toHaveAttribute(
                'data-action-feedback-crescendo-action',
                '2 payoff lanes'
            );
            expect(screen.getByTestId('action-feedback-crescendo')).toHaveAttribute(
                'data-action-feedback-crescendo-audio',
                'stack-burst'
            );
            expect(screen.getByTestId('action-feedback-crescendo')).toHaveAttribute('data-action-feedback-crescendo-tone', 'combo');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-impact-cue',
                'Stack cashout'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-impact-action', 'Cash now');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-impact-audio', 'action-cashout');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-impact-screen-cue', 'burst');
            expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Stack cashout');
            expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
                'data-action-feedback-impact-tone',
                'combo'
            );
            expect(screen.getByTestId('action-feedback-rail').querySelector('[data-action-feedback-stack="combo"]')).toHaveTextContent(
                '4x combo'
            );
            expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Reward cascade');
            expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Shard cashout');
            expect(screen.getByTestId('action-feedback-details')).toHaveTextContent('Stack cashout');
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAttribute(
                'data-action-feedback-stack-summary',
                'combo'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent('Stack cashout');
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
                'Reward cascade + Shard cashout + Stack cashout'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(/^.*Next:/);
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAccessibleName(
                /Stack cashout: Cash now\. Reward cascade \+ Shard cashout \+ Stack cashout\. Next:/i
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-sequence-first',
                'Cash now'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-sequence-then',
                'Cash combo'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-sequence-tone',
                'combo'
            );
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveAttribute(
                'data-action-feedback-sequence-tone',
                'combo'
            );
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent('First');
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent('Cash now');
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent('Then');
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent('Cash combo');
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent('Keep');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-payoff-stack', 'reward');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-payoff-stack-action', 'Cash stack');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-payoff-stack-audio', 'match-stack-cashout');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-payoff-stack-beats', '4');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-payoff-stack-screen-cue', 'burst');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-crescendo-tier', 'stack');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-crescendo-beats', '4');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-crescendo-cue', 'burst');
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-match-payoff-stack-lanes', '2');
            expect(screen.getByTestId('board-stage')).toHaveAttribute(
                'data-match-payoff-stack-first-cue',
                'Score pop'
            );
            expect(screen.getByTestId('board-stage')).toHaveAttribute(
                'data-match-payoff-stack-summary',
                '2 payoffs: Pickup + Chain'
            );
            expect(screen.getByTestId('board-stage')).toHaveAttribute(
                'data-match-payoff-stack-sequence-first',
                'Prime cashout'
            );
            expect(screen.getByTestId('board-stage')).toHaveAttribute(
                'data-match-payoff-stack-sequence-then',
                'One-away cashout'
            );
            expect(screen.getByTestId('board-stage')).toHaveAttribute(
                'data-match-payoff-stack-sequence-keep',
                'Hit now'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-tone',
                'reward'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-action',
                'Cash stack'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-audio',
                'match-stack-cashout'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-beats',
                '4'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-screen-cue',
                'burst'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-sequence-first',
                'Prime cashout'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-sequence-then',
                'One-away cashout'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-keep',
                'Hit now'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAttribute(
                'data-match-payoff-stack-fill',
                '80'
            );
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveTextContent('Stack cashout');
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveTextContent('2 payoffs: Pickup + Chain');
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveTextContent('Cash stack');
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveTextContent('Score pop');
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveTextContent('One-away cashout');
            expect(screen.getByTestId('board-match-payoff-stack-cue').querySelectorAll('[data-match-payoff-stack-beat]')).toHaveLength(4);
            expect(
                screen.getByTestId('board-match-payoff-stack-cue').querySelector('[data-match-payoff-stack-beat="1"]')
            ).toHaveAttribute('data-match-payoff-stack-beat-focus', 'primary');
            expect(
                screen.getByTestId('board-match-payoff-stack-cue').querySelector('[data-match-payoff-stack-beat="2"]')
            ).toHaveAttribute('data-match-payoff-stack-beat-focus', 'support');
            expect(screen.getByTestId('board-match-payoff-stack-sequence')).toHaveTextContent('First');
            expect(screen.getByTestId('board-match-payoff-stack-sequence')).toHaveTextContent('Prime cashout');
            expect(screen.getByTestId('board-match-payoff-stack-sequence')).toHaveTextContent('Then');
            expect(screen.getByTestId('board-match-payoff-stack-sequence')).toHaveTextContent('One-away cashout');
            expect(screen.getByTestId('board-match-payoff-stack-sequence')).toHaveTextContent('Keep');
            expect(screen.getByTestId('board-match-payoff-stack-sequence')).toHaveTextContent('Hit now');
            expect(screen.getByTestId('board-match-payoff-stack-cue')).toHaveAccessibleName(
                'Last match payoff stack. Stack cashout: 2 payoffs: Pickup + Chain. Cash stack. 4 beats. Score pop. One-away cashout. Sequence: first Prime cashout; then One-away cashout; keep Hit now.'
            );

            await act(async () => {
                const matchPop = useAppStore.getState().matchScorePop;
                await vi.advanceTimersByTimeAsync(
                    matchScoreFloatDurationMs(false, matchPop ? { kind: 'match', ...matchPop } : null) +
                        MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS +
                        25
                );
            });

            expect(useAppStore.getState().matchScorePop).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders setup forecast chips with explicit arcade cue metadata', async () => {
        vi.useFakeTimers();
        try {
            render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={finishMemorizePhase(createNewRun(0))} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );

            await act(async () => {
                useAppStore.setState({
                    matchScorePop: {
                        amount: 25,
                        chainDepth: 4,
                        feedbackHeadline: 'Chain',
                        feedbackIntensity: 'mid',
                        feedbackSignal: { label: 'Chain', tone: 'chain' },
                        impactCue: { label: 'Prime chain', tone: 'chain' },
                        chainRewardForecastCues: [
                            {
                                actionLabel: 'Soon',
                                chaseLabel: 'Prime',
                                distance: 2,
                                distanceLabel: '2 matches',
                                id: 'shard-6',
                                label: 'x6 +1 shard',
                                targetStreak: 6,
                                tone: 'reward',
                                urgency: 'soon'
                            }
                        ],
                        payoffChips: [
                            { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+25', tone: 'score' },
                            { arcadeCue: 'Prime cashout', id: 'streak', label: 'Streak', value: 'x4', tone: 'chain' },
                            { arcadeCue: 'Combo prime', id: 'next', label: 'Soon shard', value: 'x6 +1 shard', tone: 'reward' }
                        ],
                        tileIdA: 'a',
                        tileIdB: 'b',
                        key: 'test-floater-setup-forecast'
                    }
                });
            });

            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('Combo prime');
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-arcade-cue',
                'Combo prime'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-urgency',
                'soon'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-audio',
                'chain-reward-shard'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast').querySelector('[data-chain-reward-tone="reward"]')).toHaveAttribute(
                'data-chain-reward-screen-cue',
                'pulse'
            );
            expect(
                screen
                    .getByTestId('match-score-floater-reward-forecast')
                    .querySelector('[data-chain-reward-tone="reward"]')
                    ?.querySelector('[data-chain-reward-beat="1"]')
            ).toHaveAttribute('data-chain-reward-beat-focus', 'primary');
            expect(
                screen
                    .getByTestId('match-score-floater-reward-forecast')
                    .querySelector('[data-chain-reward-tone="reward"]')
                    ?.querySelector('[data-chain-reward-beat="2"]')
            ).toHaveAttribute('data-chain-reward-beat-focus', 'support');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Prime cashout');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Combo prime');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-floater-heat', 'prime');
        } finally {
            vi.useRealTimers();
        }
    });

    it('marks chain milestone floaters with tone and target attributes', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);

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
                    amount: 55,
                    chainDepth: 6,
                    chainMilestone: {
                        action: 'Push surge',
                        audioCue: 'surge-hit-ping',
                        beatCount: 4,
                        label: 'Surge hit',
                        screenCue: 'surge-live',
                        target: 'x6',
                        tone: 'surge',
                        value: 'Surge tier live'
                    },
                    feedbackHeadline: 'Surge',
                    feedbackIntensity: 'high',
                    feedbackSignal: { label: 'Chain', tone: 'chain' },
                    impactCue: { label: 'Prime chain', tone: 'chain' },
                    payoffChips: [
                        { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+55', tone: 'score' },
                        { arcadeCue: 'Combo prime', id: 'next', label: 'Soon shard', value: 'x8 +1 shard', tone: 'reward' }
                    ],
                    tileIdA: 'a',
                    tileIdB: 'b',
                    key: 'test-floater-chain-milestone'
                }
            });
        });

        const milestone = screen.getByTestId('match-score-floater-chain-milestone');
        expect(milestone).toHaveAttribute('data-chain-milestone-tone', 'surge');
        expect(milestone).toHaveAttribute('data-chain-milestone-action', 'Push surge');
        expect(milestone).toHaveAttribute('data-chain-milestone-audio', 'surge-hit-ping');
        expect(milestone).toHaveAttribute('data-chain-milestone-cue', 'surge-live');
        expect(milestone).toHaveAttribute('data-chain-milestone-screen-cue', 'surge-live');
        expect(milestone).toHaveAttribute('data-chain-milestone-target', 'x6');
        expect(milestone).toHaveAttribute('data-chain-milestone-beats', '4');
        expect(milestone).toHaveAttribute('data-chain-milestone-fill', '80');
        expect(milestone.querySelectorAll('[data-chain-milestone-beat]')).toHaveLength(4);
        expect(milestone.querySelector('[data-chain-milestone-beat="1"]')).toHaveAttribute(
            'data-chain-milestone-beat-focus',
            'primary'
        );
        expect(milestone.querySelector('[data-chain-milestone-beat="2"]')).toHaveAttribute(
            'data-chain-milestone-beat-focus',
            'support'
        );
        expect(milestone).toHaveAccessibleName('Chain milestone Surge hit: x6. Action: Push surge. Surge tier live. 4 beats.');
        expect(milestone).toHaveTextContent('Surge hit');
        expect(milestone).toHaveTextContent('x6');
        expect(milestone).toHaveTextContent('Push surge');
        expect(milestone).toHaveTextContent('Surge tier live');
    });

    it('renders one-away chain rewards as armed cashout match floaters', async () => {
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
                        amount: 30,
                        chainDepth: 5,
                        feedbackHeadline: 'Chain',
                        feedbackIntensity: 'mid',
                        feedbackSignal: { label: 'Chain', tone: 'chain' },
                        impactCue: { label: 'Cashout armed', tone: 'reward' },
                        payoffSummary: { label: 'Cashout armed', value: 'x6 +1 shard', tier: 'reward' },
                        chainRewardForecastCues: [
                            {
                                actionLabel: 'Next',
                                chaseLabel: 'Hit now',
                                distance: 1,
                                distanceLabel: '1 match',
                                id: 'shard-6',
                                label: 'x6 +1 shard',
                                targetStreak: 6,
                                tone: 'reward',
                                urgency: 'next'
                            }
                        ],
                        payoffChips: [
                            { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+30', tone: 'score' },
                            { arcadeCue: 'Prime cashout', id: 'streak', label: 'Streak', value: 'x5', tone: 'chain' },
                            {
                                arcadeCue: 'One-away cashout',
                                id: 'next',
                                label: 'Next shard',
                                value: 'x6 +1 shard',
                                tone: 'reward'
                            }
                        ],
                        tileIdA: 'a',
                        tileIdB: 'b',
                        key: 'test-floater-cashout-armed'
                    }
                });
            });

            expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveTextContent('Cashout armed');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-floater-heat', 'cashout');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-tier', 'cashout');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-audio', 'match-jackpot-cashout');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-screen-cue', 'cashout');
            expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-beats', '3');
            expect(screen.getByTestId('match-score-floater-jackpot')).toHaveTextContent('Cashout armed');
            expect(screen.getByTestId('match-score-floater-jackpot')).toHaveTextContent('Cash now');
            expect(screen.getByTestId('match-score-floater-jackpot')).toHaveTextContent('x6 +1 shard');
            expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-tier', 'cashout');
            expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-action', 'Cash now');
            expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-audio', 'match-jackpot-cashout');
            expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-screen-cue', 'cashout');
            expect(screen.getByTestId('match-score-floater-jackpot').querySelectorAll('[data-match-jackpot-beat]')).toHaveLength(3);
            expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute(
                'data-match-impact-cue-tone',
                'reward'
            );
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveTextContent('Cashout armed');
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveTextContent('x6 +1 shard');
            expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAccessibleName(
                'Cashout armed: x6 +1 shard'
            );
            expect(screen.getByTestId('match-score-floater-reward-forecast')).toHaveTextContent('One-away cashout');
            expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('One-away cashout');
            expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="next"]')).toHaveAttribute(
                'data-match-payoff-arcade-cue',
                'One-away cashout'
            );
            expect(
                screen.getByText(/Chain\. Plus 30 points\. 5 match streak, 1 match to x6\. Next rewards: Cash next: One-away cashout: 1 match to x6 \+1 shard\. Cashout armed: x6 \+1 shard\. Impact cue: Cashout armed/)
            ).toBeInTheDocument();

            await act(async () => {
                const matchPop = useAppStore.getState().matchScorePop;
                await vi.advanceTimersByTimeAsync(
                    matchScoreFloatDurationMs(false, matchPop ? { kind: 'match', ...matchPop } : null) +
                        MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS +
                        25
                );
            });

            expect(useAppStore.getState().matchScorePop).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders super-stack match floaters with distinct payoff attributes and copy', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
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
                    amount: 125,
                    chainDepth: 4,
                    feedbackHeadline: 'Reward',
                    feedbackIntensity: 'high',
                    feedbackSignal: { label: 'Route', tone: 'route' },
                    impactCue: { label: 'Super stack', tone: 'reward' },
                    crescendo: {
                        audioCue: 'super-burst',
                        beatCount: 5,
                        detail: '4 payoff lanes',
                        label: 'Super burst',
                        screenCue: 'super',
                        tier: 'super'
                    },
                    rewardBurst: { action: 'Cash super stack', label: 'Super stack', value: '4-way payoff', tier: 'mega' },
                    payoffSummary: {
                        label: 'Super stack',
                        value: '4 payoffs: Route + Pickup + Trait + Chain',
                        tier: 'combo'
                    },
                    payoffLadder: {
                        first: 'Route cashout',
                        lanes: ['Route cashout', 'Pickup cashout', 'Trait cashout', 'Chain cashout'],
                        then: 'Cash super stack',
                        keep: 'Prime',
                        tone: 'combo'
                    },
                    payoffLaneMap: [
                        { id: 'route', label: 'Route', count: 1, tone: 'route', cue: 'Route cashout' },
                        { id: 'pickup', label: 'Pickup', count: 1, tone: 'pickup', cue: 'Pickup cashout' },
                        { id: 'trait', label: 'Trait', count: 1, tone: 'trait', cue: 'Trait cashout' },
                        { id: 'chain', label: 'Chain', count: 1, tone: 'chain', cue: 'Chain cashout' }
                    ],
                    payoffChips: [
                        { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+125', tone: 'score' },
                        { arcadeCue: 'Route cashout', id: 'route', label: 'Route', value: 'Greed Cache +2 gold', tone: 'route' },
                        { arcadeCue: 'Pickup cashout', id: 'pickup', label: 'Pickup', value: 'Shard spark +1 shard', tone: 'pickup' },
                        { arcadeCue: 'Trait cashout', id: 'trait', label: 'Trait', value: 'Echo + Sealed: combo shard', tone: 'trait' },
                        { arcadeCue: 'Chain cashout', id: 'chainReward', label: 'Cashout', value: '+1 guard token', tone: 'reward' }
                    ],
                    traitInteractionTexts: [
                        'Echo + Sealed: combo shard',
                        'Mirror + Stasis: guard ward',
                        'Stasis buffered Sealed',
                        'Echo + Mirror: recall focus'
                    ],
                    tileIdA: 'a',
                    tileIdB: 'b',
                    key: 'test-super-stack-floater'
                }
            });
        });

        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute('data-match-impact-cue-beats', '5');
        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute('data-match-impact-cue-screen-cue', 'burst');
        expect(screen.getByTestId('match-score-floater-impact-cue').querySelectorAll('[data-match-impact-cue-beat]')).toHaveLength(5);
        expect(screen.getByTestId('match-score-floater-impact-cue').querySelector('[data-match-impact-cue-beat="1"]')).toHaveAttribute(
            'data-match-impact-cue-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-crescendo-tier', 'super');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-tier', 'super');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-audio', 'match-jackpot-super');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-screen-cue', 'super');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-jackpot-beats', '5');
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveTextContent('Cash super stack');
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveTextContent('4 payoffs');
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-tier', 'super');
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-action', 'Cash super stack');
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-audio', 'match-jackpot-super');
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAttribute('data-match-jackpot-screen-cue', 'super');
        expect(screen.getByTestId('match-score-floater-jackpot').querySelectorAll('[data-match-jackpot-beat]')).toHaveLength(5);
        expect(screen.getByTestId('match-score-floater-jackpot').querySelector('[data-match-jackpot-beat="1"]')).toHaveAttribute(
            'data-match-jackpot-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('match-score-floater-jackpot').querySelector('[data-match-jackpot-beat="2"]')).toHaveAttribute(
            'data-match-jackpot-beat-focus',
            'support'
        );
        expect(screen.getByTestId('match-score-floater-jackpot')).toHaveAccessibleName(
            'Super stack: Cash super stack: 4 payoffs: Route + Pickup + Trait + Chain. 5 beats.'
        );
        expect(screen.getByTestId('match-score-floater-crescendo')).toHaveTextContent('Super burst');
        expect(screen.getByTestId('match-score-floater-crescendo')).toHaveAccessibleName(
            'Match crescendo Super burst: 4 payoff lanes. 5 beats.'
        );
        expect(screen.getByTestId('match-score-floater-crescendo').querySelectorAll('[data-match-crescendo-beat]')).toHaveLength(5);
        expect(screen.getByTestId('match-score-floater-crescendo').querySelector('[data-match-crescendo-beat="1"]')).toHaveAttribute(
            'data-match-crescendo-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-crescendo-tier', 'super');
        expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-action-feedback-crescendo-beats', '5');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveTextContent('Super burst');
        expect(screen.getByTestId('action-feedback-crescendo')).toHaveAttribute('data-action-feedback-crescendo-tone', 'combo');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-floater-heat', 'stack');
        expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute(
            'data-reward-burst-label',
            'Super stack'
        );
        expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute(
            'data-reward-burst-audio',
            'reward-burst-super'
        );
        expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute(
            'data-reward-burst-screen-cue',
            'super'
        );
        expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute('data-reward-burst-tier', 'mega');
        expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute('data-reward-burst-beats', '5');
        expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAttribute('data-reward-burst-fill', '100');
        expect(screen.getByTestId('match-score-floater-reward-burst').querySelectorAll('[data-reward-burst-beat]')).toHaveLength(5);
        expect(screen.getByTestId('match-score-floater-reward-burst').querySelector('[data-reward-burst-beat="1"]')).toHaveAttribute(
            'data-reward-burst-beat-focus',
            'primary'
        );
        expect(screen.getByTestId('match-score-floater-reward-burst')).toHaveAccessibleName(
            'Super stack: Cash super stack: 4-way payoff'
        );
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute(
            'data-payoff-summary-label',
            'Super stack'
        );
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute(
            'data-payoff-summary-audio',
            'payoff-summary-super'
        );
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute(
            'data-payoff-summary-screen-cue',
            'super'
        );
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute('data-payoff-summary-tier', 'combo');
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute('data-payoff-summary-focus', 'cashout');
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveAttribute('data-payoff-summary-beats', '5');
        expect(screen.getByTestId('match-score-floater-payoff-summary').querySelectorAll('[data-payoff-summary-beat]')).toHaveLength(5);
        expect(
            screen
                .getByTestId('match-score-floater-payoff-summary')
                .querySelector('[data-payoff-summary-beat="1"]')
        ).toHaveAttribute('data-payoff-summary-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-summary')
                .querySelector('[data-payoff-summary-beat="1"]')
        ).toHaveAttribute('data-payoff-summary-beat-screen-cue', 'super');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-summary')
                .querySelector('[data-payoff-summary-beat="1"]')
        ).toHaveAttribute('data-payoff-summary-beat-tier', 'combo');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-summary')
                .querySelector('[data-payoff-summary-beat="2"]')
        ).toHaveAttribute('data-payoff-summary-beat-focus', 'support');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveAttribute(
            'data-match-payoff-lane-map',
            'route:1>pickup:1>trait:1>chain:1'
        );
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveAttribute(
            'data-match-payoff-lane-actions',
            'route:Cash route:1>pickup:Claim pickup:1>trait:Cash trait:1>chain:Cash chain:1'
        );
        const payoffLaneMapSummary = screen.getByTestId('match-score-floater-payoff-lane-map-summary');
        expect(payoffLaneMapSummary).toHaveTextContent('Lanes');
        expect(payoffLaneMapSummary).toHaveTextContent('4 lanes');
        expect(payoffLaneMapSummary).toHaveAttribute('data-match-payoff-lane-map-summary-primary', 'route');
        expect(payoffLaneMapSummary).toHaveAttribute('data-match-payoff-lane-map-summary-primary-action', 'Cash route');
        expect(payoffLaneMapSummary).toHaveAttribute(
            'data-match-payoff-lane-map-summary-primary-audio',
            'match-payoff-route'
        );
        expect(payoffLaneMapSummary).toHaveAttribute('data-match-payoff-lane-map-summary-primary-cue', 'burst');
        expect(payoffLaneMapSummary).toHaveAttribute('data-match-payoff-lane-map-summary-primary-screen-cue', 'burst');
        expect(payoffLaneMapSummary).toHaveAttribute('data-match-payoff-lane-map-summary-primary-tone', 'route');
        expect(payoffLaneMapSummary.querySelectorAll('[data-match-payoff-lane-map-summary-beat]')).toHaveLength(5);
        expect(
            payoffLaneMapSummary.querySelector('[data-match-payoff-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-match-payoff-lane-map-summary-beat-focus', 'primary');
        expect(
            payoffLaneMapSummary.querySelector('[data-match-payoff-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-match-payoff-lane-map-summary-beat-primary-tone', 'route');
        expect(
            payoffLaneMapSummary.querySelector('[data-match-payoff-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-match-payoff-lane-map-summary-beat-primary-cue', 'burst');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveAttribute(
            'data-match-payoff-lane-primary',
            'route'
        );
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveAttribute(
            'data-match-payoff-lane-primary-action',
            'Cash route'
        );
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveAttribute(
            'data-match-payoff-lane-primary-focus',
            'cashout'
        );
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveAccessibleName(
            'Match payoff lane map. Route Route x1. Cash route. Route cashout. Pickup Claim x1. Claim pickup. Pickup cashout. Trait Trait x1. Cash trait. Trait cashout. Chain Chain x1. Cash chain. Chain cashout.'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAttribute(
            'data-match-payoff-primary-lane',
            'route'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAttribute(
            'data-match-payoff-primary-lane-action',
            'Cash route'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAttribute(
            'data-match-payoff-primary-lane-beats',
            '3'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAttribute(
            'data-match-payoff-primary-lane-focus',
            'cashout'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAttribute(
            'data-match-payoff-primary-lane-audio',
            'match-payoff-route'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAttribute(
            'data-match-payoff-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAttribute(
            'data-match-payoff-primary-lane-tone',
            'route'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveAccessibleName(
            'Primary paid lane. Cash route: Route. Route cashout. 3 beats.'
        );
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveTextContent('Paid lane');
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveTextContent('Cash route');
        expect(screen.getByTestId('match-score-floater-primary-payoff-lane')).toHaveTextContent('Route cashout');
        expect(
            screen
                .getByTestId('match-score-floater-primary-payoff-lane')
                .querySelectorAll('[data-match-payoff-primary-lane-beat]')
        ).toHaveLength(3);
        expect(
            screen
                .getByTestId('match-score-floater-primary-payoff-lane')
                .querySelector('[data-match-payoff-primary-lane-beat="1"]')
        ).toHaveAttribute('data-match-payoff-primary-lane-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('match-score-floater-primary-payoff-lane')
                .querySelector('[data-match-payoff-primary-lane-beat="2"]')
        ).toHaveAttribute('data-match-payoff-primary-lane-beat-focus', 'support');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Route');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Pickup');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Trait');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Chain');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Cash route');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Claim pickup');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Cash trait');
        expect(screen.getByTestId('match-score-floater-payoff-lane-map')).toHaveTextContent('Cash chain');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="route"]')
        ).toHaveAttribute('data-match-payoff-lane-beats', '3');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="route"]')
        ).toHaveAttribute('data-match-payoff-lane-action', 'Cash route');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="route"]')
        ).toHaveAttribute('data-match-payoff-lane-audio', 'match-payoff-route');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="route"]')
        ).toHaveAttribute('data-match-payoff-lane-screen-cue', 'burst');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-lane-map')
                .querySelector('[data-match-payoff-lane="route"]')
                ?.querySelectorAll('[data-match-payoff-lane-beat]')
        ).toHaveLength(3);
        expect(
            screen
                .getByTestId('match-score-floater-payoff-lane-map')
                .querySelector('[data-match-payoff-lane="route"]')
                ?.querySelector('[data-match-payoff-lane-beat="1"]')
        ).toHaveAttribute('data-match-payoff-lane-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-lane-map')
                .querySelector('[data-match-payoff-lane="route"]')
                ?.querySelector('[data-match-payoff-lane-beat="2"]')
        ).toHaveAttribute('data-match-payoff-lane-beat-focus', 'support');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="trait"]')
        ).toHaveAttribute('data-match-payoff-lane-tone', 'trait');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="trait"]')
        ).toHaveAttribute('data-match-payoff-lane-beats', '3');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="trait"]')
        ).toHaveAttribute('data-match-payoff-lane-audio', 'match-payoff-trait');
        expect(
            screen.getByTestId('match-score-floater-payoff-lane-map').querySelector('[data-match-payoff-lane="trait"]')
        ).toHaveAttribute('data-match-payoff-lane-screen-cue', 'trait');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-lane-map')
                .querySelector('[data-match-payoff-lane="trait"]')
                ?.querySelectorAll('[data-match-payoff-lane-beat]')
        ).toHaveLength(3);
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute(
            'data-match-trait-lane-map',
            'shard:1>guard:1>block:1>recall:1'
        );
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute(
            'data-match-trait-lane-role-ids',
            'shard:cashout:1>guard:protect:1>block:block:1>recall:recall:1'
        );
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-trait-lane-count', '4');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-lane-map',
            'shard:1>guard:1>block:1>recall:1'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-lane-actions',
            'shard:Cash shard:1>guard:Protect run:1>block:Deny match:1>recall:Set memory:1'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-lane-roles',
            'shard:Cashout:1>guard:Protect:1>block:Block:1>recall:Recall:1'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-lane-role-ids',
            'shard:cashout:1>guard:protect:1>block:block:1>recall:recall:1'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane',
            'shard'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane-action',
            'Cash shard'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane-audio',
            'match-trait-shard'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane-beats',
            '3'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane-cue',
            'Echo + Sealed: combo shard'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane-role',
            'Cashout'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane-role-id',
            'cashout'
        );
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAttribute(
            'data-match-trait-primary-lane-screen-cue',
            'burst'
        );
        const traitLaneMapSummary = screen.getByTestId('match-score-floater-trait-lane-map-summary');
        expect(traitLaneMapSummary).toHaveTextContent('Traits');
        expect(traitLaneMapSummary).toHaveTextContent('4 lanes');
        expect(traitLaneMapSummary).toHaveAttribute('data-match-trait-lane-summary-fill', '80');
        expect(traitLaneMapSummary).toHaveAttribute('data-match-trait-lane-summary-total', '4');
        expect(traitLaneMapSummary).toHaveAttribute('data-match-trait-lane-summary-primary', 'shard');
        expect(traitLaneMapSummary).toHaveAttribute('data-match-trait-lane-summary-role', 'Cashout');
        expect(traitLaneMapSummary).toHaveAttribute('data-match-trait-lane-summary-role-id', 'cashout');
        expect(traitLaneMapSummary).toHaveAttribute('data-match-trait-lane-summary-screen-cue', 'burst');
        expect(traitLaneMapSummary.querySelectorAll('[data-match-trait-lane-map-summary-beat]')).toHaveLength(5);
        expect(
            traitLaneMapSummary.querySelector('[data-match-trait-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-match-trait-lane-map-summary-beat-focus', 'primary');
        expect(
            traitLaneMapSummary.querySelector('[data-match-trait-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-match-trait-lane-map-summary-beat-role-id', 'cashout');
        expect(
            traitLaneMapSummary.querySelector('[data-match-trait-lane-map-summary-beat="1"]')
        ).toHaveAttribute('data-match-trait-lane-map-summary-beat-screen-cue', 'burst');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveAccessibleName(
            'Match trait interaction lanes. Shard Cashout x1. Cash shard. Echo + Sealed: combo shard. Guard Protect x1. Protect run. Mirror + Stasis: guard ward. Block Block x1. Deny match. Stasis buffered Sealed. Recall Recall x1. Set memory. Echo + Mirror: recall focus.'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAccessibleName(
            'Primary trait payoff lane. Cashout Shard: Cash shard. Echo + Sealed: combo shard. 3 beats.'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAttribute(
            'data-match-trait-primary-lane',
            'shard'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAttribute(
            'data-match-trait-primary-lane-action',
            'Cash shard'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAttribute(
            'data-match-trait-primary-lane-audio',
            'match-trait-shard'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAttribute(
            'data-match-trait-primary-lane-role',
            'Cashout'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAttribute(
            'data-match-trait-primary-lane-role-id',
            'cashout'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAttribute(
            'data-match-trait-primary-lane-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveAttribute(
            'data-match-trait-primary-lane-fill',
            '75'
        );
        expect(screen.getByTestId('match-score-floater-primary-trait-lane')).toHaveTextContent('Trait focus');
        expect(
            screen
                .getByTestId('match-score-floater-primary-trait-lane')
                .querySelectorAll('[data-match-trait-primary-lane-beat]')
        ).toHaveLength(3);
        expect(
            screen
                .getByTestId('match-score-floater-primary-trait-lane')
                .querySelector('[data-match-trait-primary-lane-beat="1"]')
        ).toHaveAttribute('data-match-trait-primary-lane-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('match-score-floater-primary-trait-lane')
                .querySelector('[data-match-trait-primary-lane-beat="2"]')
        ).toHaveAttribute('data-match-trait-primary-lane-beat-focus', 'support');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Shard');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Cash shard');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Guard');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Protect run');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Block');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Deny match');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Recall');
        expect(screen.getByTestId('match-score-floater-trait-lane-map')).toHaveTextContent('Set memory');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="shard"]')
        ).toHaveTextContent('Echo + Sealed: combo shard');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="shard"]')
        ).toHaveAttribute('data-match-trait-lane-action', 'Cash shard');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="shard"]')
        ).toHaveAttribute('data-match-trait-lane-role', 'Cashout');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="shard"]')
        ).toHaveAttribute('data-match-trait-lane-role-id', 'cashout');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="shard"]')
        ).toHaveAttribute('data-match-trait-lane-beats', '3');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="shard"]')
        ).toHaveAttribute('data-match-trait-lane-audio', 'match-trait-shard');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="shard"]')
        ).toHaveAttribute('data-match-trait-lane-screen-cue', 'burst');
        expect(
            screen
                .getByTestId('match-score-floater-trait-lane-map')
                .querySelector('[data-match-trait-lane="shard"]')
                ?.querySelectorAll('[data-match-trait-lane-beat]')
        ).toHaveLength(3);
        expect(
            screen
                .getByTestId('match-score-floater-trait-lane-map')
                .querySelector('[data-match-trait-lane="shard"]')
                ?.querySelector('[data-match-trait-lane-beat="1"]')
        ).toHaveAttribute('data-match-trait-lane-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('match-score-floater-trait-lane-map')
                .querySelector('[data-match-trait-lane="shard"]')
                ?.querySelector('[data-match-trait-lane-beat="2"]')
        ).toHaveAttribute('data-match-trait-lane-beat-focus', 'support');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="block"]')
        ).toHaveAttribute('data-match-trait-lane-beats', '3');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="block"]')
        ).toHaveAttribute('data-match-trait-lane-role-id', 'block');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="block"]')
        ).toHaveAttribute('data-match-trait-lane-audio', 'match-trait-block');
        expect(
            screen.getByTestId('match-score-floater-trait-lane-map').querySelector('[data-match-trait-lane="block"]')
        ).toHaveAttribute('data-match-trait-lane-screen-cue', 'control');
        expect(
            screen
                .getByTestId('match-score-floater-trait-lane-map')
                .querySelector('[data-match-trait-lane="block"]')
                ?.querySelectorAll('[data-match-trait-lane-beat]')
        ).toHaveLength(3);
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Cash super stack');
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
            'data-match-payoff-ladder-lanes',
            'Route cashout|Pickup cashout|Trait cashout|Chain cashout'
        );
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
            'data-match-payoff-ladder-beats',
            '5'
        );
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
            'data-match-payoff-ladder-audio',
            'payoff-ladder-super'
        );
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAttribute(
            'data-match-payoff-ladder-screen-cue',
            'super'
        );
        expect(
            screen
                .getByTestId('match-score-floater-payoff-ladder')
                .querySelectorAll('[data-match-payoff-ladder-beat]')
        ).toHaveLength(5);
        expect(
            screen
                .getByTestId('match-score-floater-payoff-ladder')
                .querySelector('[data-match-payoff-ladder-beat="1"]')
        ).toHaveAttribute('data-match-payoff-ladder-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-ladder')
                .querySelector('[data-match-payoff-ladder-beat="2"]')
        ).toHaveAttribute('data-match-payoff-ladder-beat-focus', 'support');
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveAccessibleName(
            'Match payoff ladder. First: Route cashout. Then: Cash super stack. Keep: Prime. Lanes: Route cashout to Pickup cashout to Trait cashout to Chain cashout.'
        );
        expect(
            screen.getByTestId('match-score-floater-payoff-ladder').querySelector('[data-match-payoff-ladder-step="then"]')
        ).toHaveTextContent('Cash super stack');
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Route cashout');
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Pickup cashout');
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Trait cashout');
        expect(screen.getByTestId('match-score-floater-payoff-ladder')).toHaveTextContent('Chain cashout');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-ladder')
                .querySelector('[data-match-payoff-lane-index="1"]')?.querySelectorAll('[data-match-payoff-lane-pip]')
        ).toHaveLength(1);
        expect(
            screen
                .getByTestId('match-score-floater-payoff-ladder')
                .querySelector('[data-match-payoff-lane-index="4"]')?.querySelectorAll('[data-match-payoff-lane-pip]')
        ).toHaveLength(3);
        const payoffLadderSummary = screen.getByTestId('match-score-floater-payoff-ladder-summary');
        expect(payoffLadderSummary).toHaveAttribute('data-match-payoff-ladder-summary-audio', 'payoff-ladder-super');
        expect(payoffLadderSummary).toHaveAttribute('data-match-payoff-ladder-summary-beats', '5');
        expect(payoffLadderSummary).toHaveTextContent('Ladder');
        expect(payoffLadderSummary).toHaveTextContent('4 lanes');
        expect(payoffLadderSummary).toHaveAttribute('data-match-payoff-ladder-summary-screen-cue', 'super');
        expect(payoffLadderSummary).toHaveAttribute('data-match-payoff-ladder-summary-tone', 'combo');
        expect(payoffLadderSummary.querySelectorAll('[data-match-payoff-ladder-summary-beat]')).toHaveLength(5);
        expect(
            payoffLadderSummary.querySelector('[data-match-payoff-ladder-summary-beat="1"]')
        ).toHaveAttribute('data-match-payoff-ladder-summary-beat-focus', 'primary');
        expect(
            payoffLadderSummary.querySelector('[data-match-payoff-ladder-summary-beat="1"]')
        ).toHaveAttribute('data-match-payoff-ladder-summary-beat-screen-cue', 'super');
        expect(
            payoffLadderSummary.querySelector('[data-match-payoff-ladder-summary-beat="1"]')
        ).toHaveAttribute('data-match-payoff-ladder-summary-beat-tone', 'combo');
        expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveTextContent('Route cashout');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-chips')
                .querySelector('[data-match-payoff-id="route"]')
                ?.querySelectorAll('[data-match-payoff-chip-beat]')
        ).toHaveLength(4);
        expect(
            screen
                .getByTestId('match-score-floater-payoff-chips')
                .querySelector('[data-match-payoff-id="route"]')
                ?.querySelector('[data-match-payoff-chip-beat="1"]')
        ).toHaveAttribute('data-match-payoff-chip-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('match-score-floater-payoff-chips')
                .querySelector('[data-match-payoff-id="route"]')
                ?.querySelector('[data-match-payoff-chip-beat="2"]')
        ).toHaveAttribute('data-match-payoff-chip-beat-focus', 'support');
    });

    it('renders perk pop payoff chips as distinct match floater activations', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
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
                    amount: 45,
                    chainDepth: 2,
                    feedbackHeadline: 'Surge',
                    feedbackIntensity: 'high',
                    feedbackSignal: { label: 'Trait', tone: 'trait' },
                    impactCue: { label: 'Perk pop', tone: 'trait' },
                    payoffSummary: {
                        label: 'Perk pop',
                        value: 'Perk pop: Cursed Opener pays gold',
                        tier: 'reward'
                    },
                    payoffChips: [
                        { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+45', tone: 'score' },
                        {
                            arcadeCue: 'Perk pop',
                            id: 'trait',
                            label: 'Perk',
                            value: 'Perk pop: Cursed Opener pays gold',
                            tone: 'trait'
                        }
                    ],
                    traitInteractionTexts: ['Perk pop: Cursed Opener pays gold'],
                    tileIdA: 'a',
                    tileIdB: 'b',
                    key: 'test-perk-pop-floater'
                }
            });
        });

        expect(screen.getByTestId('match-score-floater')).toHaveTextContent('Perk pop');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-match-floater-heat', 'score');
        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveTextContent('Perk pop');
        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute('data-match-impact-cue-tone', 'trait');
        expect(screen.getByTestId('match-score-floater-impact-cue')).toHaveAttribute('data-match-impact-cue-screen-cue', 'surge');
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveTextContent('Perk pop');
        expect(screen.getByTestId('match-score-floater-payoff-summary')).toHaveTextContent('Cursed Opener pays gold');
        expect(screen.getByTestId('match-score-floater-payoff-chips')).toHaveAccessibleName(
            /Match score payoff chips.*Perk pop: Perk: Perk pop: Cursed Opener pays gold/i
        );
        expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="trait"]')).toHaveAttribute(
            'data-match-payoff-arcade-cue',
            'Perk pop'
        );
        expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="trait"]')).toHaveAttribute(
            'data-match-payoff-tone',
            'trait'
        );
        expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="trait"]')).toHaveAttribute(
            'data-match-payoff-audio',
            'match-payoff-trait'
        );
        expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="trait"]')).toHaveAttribute(
            'data-match-payoff-screen-cue',
            'trait'
        );
        expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="trait"]')).toHaveAttribute(
            'data-match-payoff-arcade-screen-cue',
            'trait'
        );
        expect(screen.getByTestId('match-score-floater-payoff-chips').querySelector('[data-match-payoff-id="trait"]')).toHaveTextContent(
            'Perk pop: Cursed Opener pays gold'
        );
    });

    it('passes armed durable reward perk cues into the board chain context', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const playing = finishMemorizePhase(base);
        const run = {
            ...playing,
            rewardPerkIds: ['trait_streak_toolkit'],
            stats: {
                ...playing.stats,
                currentStreak: 2
            }
        } as RunState;

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('tile-board-stub')).toHaveAttribute(
            'data-armed-perk-id',
            'trait_streak_toolkit'
        );
        expect(screen.getByTestId('tile-board-stub')).toHaveAttribute(
            'data-armed-perk-label',
            'Trait cashout armed'
        );
        expect(screen.getByTestId('tile-board-stub')).toHaveAttribute(
            'data-armed-perk-payoff',
            'x3 trait flash'
        );
        expect(screen.getByTestId('tile-board-stub')).toHaveAttribute(
            'data-armed-perk-detail',
            'The next trait match in this clean chain creates a flash-pair charge.'
        );
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
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute('data-mismatch-floater-heat', 'recover');
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-beats',
                '2'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-cue',
                'pulse'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-screen-cue',
                'pulse'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-tier',
                'recover'
            );
            expect(screen.getByTestId('mismatch-score-floater').querySelector('[data-floater-signal="miss"]')).toHaveTextContent('Miss');
            expect(screen.getByTestId('mismatch-score-floater-recovery')).toHaveTextContent('Recover - safe match');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('Recover now');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('Safe match');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAttribute('data-mismatch-next-action', 'recover');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAttribute(
                'data-mismatch-next-action-cue',
                'Safe pair'
            );
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAccessibleName(
                'Safe pair: Recover now: Safe match'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Recover');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Safe pair');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Safe match');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Tempo');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Chain reset');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Safe pair"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-beats', '1');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Safe pair"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-audio', 'mismatch-chip-recover');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Safe pair"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-screen-cue', 'recover');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Safe pair"]')
                    ?.querySelectorAll('[data-mismatch-recovery-chip-beat]')
            ).toHaveLength(1);
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip="tempo"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-beats', '2');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip="tempo"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-audio', 'mismatch-chip-tempo');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip="tempo"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-screen-cue', 'tempo');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip="tempo"]')
                    ?.querySelectorAll('[data-mismatch-recovery-chip-beat]')
            ).toHaveLength(2);
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('Recover');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('Safe match');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveAttribute(
                'data-recovery-burst-tier',
                'recover'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent('Recover beat');
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent(
                'Safe match then prime x3 loop'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveAccessibleName(
                'Mismatch recovery crescendo: Recover beat. 2 beats. Safe match then prime x3 loop.'
            );
            expect(
                screen.getByTestId('mismatch-score-floater-recovery-crescendo').querySelectorAll('i')
            ).toHaveLength(2);
            expect(gameSfxMocks.playMismatchRecoveryCrescendoSfx).toHaveBeenCalledTimes(1);
            expect(gameSfxMocks.playMismatchRecoveryCrescendoSfx.mock.calls[0]?.[0]).toBeCloseTo(0.64);
            expect(gameSfxMocks.playMismatchRecoveryCrescendoSfx.mock.calls[0]?.slice(1)).toEqual(['recover', 2]);
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('First');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Safe match');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Then');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Prime x3 loop');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Keep');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Re-prime chain');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveAttribute(
                'data-mismatch-recovery-sequence',
                'recover'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveAccessibleName(
                'Recovery sequence. First: Safe match. Then: Prime x3 loop. Keep: Re-prime chain.'
            );
            expect(screen.getByTestId('tile-board-stub')).toHaveAttribute('data-recovery-action', 'Recover');
            expect(screen.getByTestId('tile-board-stub')).toHaveAttribute('data-recovery-impact-cue', 'Safe pair');
            expect(screen.getByTestId('tile-board-stub')).toHaveAttribute('data-recovery-tone', 'recover');
            expect(screen.getByTestId('tile-board-stub')).toHaveAttribute('data-recovery-value', 'Safe match');
            expect(screen.getByTestId('tile-board-stub')).toHaveAttribute('data-recovery-detail', 'Recover - safe match');
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-lane-map',
                'recover:1>chain:1'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-lane-actions',
                'recover:Confirm pair:1>chain:Reset chain:1'
            );
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="recover"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-action', 'Confirm pair');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="recover"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-beats', '2');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="recover"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-audio', 'mismatch-recovery-safe');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="recover"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-screen-cue', 'recover');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="recover"]')
                    ?.querySelectorAll('[data-mismatch-recovery-lane-beat]')
            ).toHaveLength(2);
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-action', 'Reset chain');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-beats', '3');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-audio', 'mismatch-recovery-chain');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-screen-cue', 'chain');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
                    ?.querySelectorAll('[data-mismatch-recovery-lane-beat]')
            ).toHaveLength(3);
            expect(
                screen.getByText(
                    /No match\. Next action: Safe pair: Safe match\. Recovery sequence: First Safe match\. Then Prime x3 loop\. Keep Re-prime chain\. Recovery lane map\. Recover Recover x1\. Confirm pair\. Safe pair\. Chain Rebuild x1\. Reset chain\. Reset\. Recover beat: Safe match then prime x3 loop\. Recover with a safe match\. Chain reset/
                )
            ).toBeInTheDocument();
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-tone', 'error');

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

    it('renders high-streak mismatch floaters as chain breaks', async () => {
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
                        brokenChainDepth: 6,
                        brokenChainRewardCue: {
                            actionLabel: 'Soon',
                            chaseLabel: 'Prime',
                            distance: 2,
                            distanceLabel: '2 matches',
                            id: 'shard-8',
                            label: 'x8 +1 shard',
                            targetStreak: 8,
                            tone: 'reward',
                            urgency: 'soon'
                        },
                        key: 'test-break-miss-1'
                    },
                    matchScorePop: null
                });
            });

            const floater = screen.getByTestId('mismatch-score-floater');
            expect(floater).toHaveTextContent('Break');
            expect(floater).toHaveAttribute('data-feedback-intensity', 'break');
            expect(floater).toHaveAttribute('data-mismatch-floater-heat', 'lost-reward');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-beats', '4');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-cue', 'burst');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-screen-cue', 'burst');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-tier', 'lost-reward');
            expect(floater.querySelector('[data-floater-signal="break"]')).toHaveTextContent('Break');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('x6 lost');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Lost reward');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Lost cashout');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('x8 +1 shard');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Next chase');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Rebuild chase');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Break into x10');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips').querySelector('[data-mismatch-recovery-chip="chain"]')).toHaveTextContent('Break into x10');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Lost cashout"]')
            ).toHaveTextContent('x8 +1 shard');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Lost cashout"]')
            ).toHaveAttribute('data-mismatch-recovery-urgency', 'setup');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Lost cashout"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-audio', 'mismatch-chip-lost');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Lost cashout"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-screen-cue', 'lost');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Rebuild chase"]')
            ).toHaveTextContent('Break into x10');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Rebuild chase"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-audio', 'mismatch-chip-chain');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-chips')
                    .querySelector('[data-mismatch-recovery-chip-cue="Rebuild chase"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-screen-cue', 'chain');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('Save streak');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('Save cashout');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('Rebuild toward x8 +1 shard');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAttribute('data-mismatch-next-action', 'lost-reward');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAttribute(
                'data-mismatch-next-action-cue',
                'Save cashout'
            );
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAccessibleName(
                'Save cashout: Save streak: Rebuild toward x8 +1 shard'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('Reward lost');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('x8 +1 shard');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveAttribute(
                'data-recovery-burst-tier',
                'lost-reward'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent(
                'Lost reward burst'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent(
                'Rebuild toward x8 +1 shard'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-tier',
                'lost-reward'
            );
            expect(
                screen.getByTestId('mismatch-score-floater-recovery-crescendo').querySelectorAll('i')
            ).toHaveLength(4);
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveTextContent('Lost reward stack');
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveTextContent(
                'Chain break + Lost reward + Next chase'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveTextContent(
                'x6 lost -> x8 +1 shard -> Break into x10'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveAttribute(
                'data-mismatch-recovery-stack',
                'lost-reward'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveAccessibleName(
                'Lost reward stack: Chain break + Lost reward + Next chase. x6 lost -> x8 +1 shard -> Break into x10'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Safe match');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Rebuild toward x8 +1 shard');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Break into x10');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveAttribute(
                'data-mismatch-recovery-sequence',
                'lost-reward'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveAttribute(
                'data-mismatch-sequence-then',
                'Rebuild toward x8 +1 shard'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveAccessibleName(
                'Recovery sequence. First: Safe match. Then: Rebuild toward x8 +1 shard. Keep: Break into x10.'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-lane-map',
                'recover:1>lost:1>chain:2'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-lane-map-fill',
                '75'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-lane-actions',
                'recover:Confirm pair:1>lost:Save cashout:1>chain:Rebuild chain:2'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane',
                'lost'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-action',
                'Save cashout'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-beats',
                '4'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-audio',
                'mismatch-recovery-lost'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-cue',
                'Lost cashout'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-screen-cue',
                'risk'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveAccessibleName(
                'Recovery lane map. Recover Recover x1. Confirm pair. Safe pair. Lost Save x1. Save cashout. Lost cashout. Chain Rebuild x2. Rebuild chain. Chain lost.'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveAccessibleName(
                'Primary recovery lane. Lost: Save cashout. Lost cashout. 4 beats.'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane',
                'lost'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-action',
                'Save cashout'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-audio',
                'mismatch-recovery-lost'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-beats',
                '4'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-fill',
                '100'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveAttribute(
                'data-mismatch-recovery-primary-lane-screen-cue',
                'risk'
            );
            expect(screen.getByTestId('mismatch-score-floater-primary-recovery-lane')).toHaveTextContent('Recovery focus');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-primary-recovery-lane')
                    .querySelectorAll('[data-mismatch-recovery-primary-lane-beat]')
            ).toHaveLength(4);
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveTextContent('Recover');
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveTextContent('Confirm pair');
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveTextContent('Safe pair');
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveTextContent('Save cashout');
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveTextContent('Rebuild chain');
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveTextContent('Lost cashout');
            expect(screen.getByTestId('mismatch-score-floater-recovery-lane-map')).toHaveTextContent('Chain lost');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-count', '2');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="lost"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-action', 'Save cashout');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="lost"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-beats', '4');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="lost"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-audio', 'mismatch-recovery-lost');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="lost"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-screen-cue', 'risk');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="lost"]')
                    ?.querySelectorAll('[data-mismatch-recovery-lane-beat]')
            ).toHaveLength(4);
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-action', 'Rebuild chain');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-beats', '4');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-audio', 'mismatch-recovery-chain');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
            ).toHaveAttribute('data-mismatch-recovery-lane-screen-cue', 'chain');
            expect(
                screen
                    .getByTestId('mismatch-score-floater-recovery-lane-map')
                    .querySelector('[data-mismatch-recovery-lane="chain"]')
                    ?.querySelectorAll('[data-mismatch-recovery-lane-beat]')
            ).toHaveLength(4);
            expect(
                screen.getByText(
                    /No match\. Chain x6 broken\. Lost reward target: x8 \+1 shard in 2 matches\. Next chase: Break into x10\. Next action: Save cashout: Rebuild toward x8 \+1 shard\. Recovery sequence: First Safe match\. Then Rebuild toward x8 \+1 shard\. Keep Break into x10\. Recovery lane map\. Recover Recover x1\. Confirm pair\. Safe pair\. Lost Save x1\. Save cashout\. Lost cashout\. Chain Rebuild x2\. Rebuild chain\. Chain lost\. Lost reward burst: Rebuild toward x8 \+1 shard\. Recover with a safe match\. x6 lost/
                )
            ).toBeInTheDocument();
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-burst-tier', 'risk');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-intensity', 'high');
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-impact-cue',
                'Save cashout'
            );
            expect(screen.getByTestId('action-feedback-impact-cue')).toHaveTextContent('Save cashout');
            expect(screen.getByTestId('action-feedback-impact-cue')).toHaveAttribute(
                'data-action-feedback-impact-tone',
                'risk'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-tempo-cue',
                'Save payoff'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-tempo-beats',
                '2'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-tempo-cadence',
                'recover'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-tempo-label',
                'Recovery pulse'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-tempo-action',
                'Save payoff'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-tempo-audio',
                'tempo-recover'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-tempo-screen-cue',
                'guard'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-impact-action',
                'Recover'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-impact-audio',
                'action-recover'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-impact-screen-cue',
                'guard'
            );
            expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Fix');
            expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Save payoff');
            expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveTextContent('Recovery pulse');
            expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveAttribute(
                'data-action-feedback-tempo-tone',
                'risk'
            );
            expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveAttribute(
                'data-action-feedback-tempo-beats',
                '2'
            );
            expect(screen.getByTestId('action-feedback-tempo-cue')).toHaveAttribute(
                'data-action-feedback-tempo-cadence',
                'recover'
            );
            expect(
                screen.getByTestId('action-feedback-tempo-cue').querySelectorAll('[data-action-feedback-tempo-beat]')
            ).toHaveLength(2);
            expect(screen.getByTestId('action-feedback-rail').querySelector('[data-action-feedback-stack="risk"]')).toHaveTextContent(
                '4x risk'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveAttribute(
                'data-action-feedback-stack-summary',
                'risk'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent('Risk stack');
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
                'Chain x6 + Chain break + Lost reward + Next chase'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
                'Next: rebuild from a confirmed pair before chasing the lost reward again.'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-sequence-first',
                'Save cashout'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-sequence-then',
                'Save payoff'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute(
                'data-action-feedback-sequence-keep',
                'rebuild from a confirmed pair before chasing the lost reward again'
            );
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveAttribute(
                'data-action-feedback-sequence-tone',
                'risk'
            );
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent('Save cashout');
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent('Save payoff');
            expect(screen.getByTestId('action-feedback-sequence-cue')).toHaveTextContent(
                'rebuild from a confirmed pair before chasing the lost reward again'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveTextContent(
                'Next: rebuild from a confirmed pair before chasing the lost reward again.'
            );
            expect(
                screen.getByText(
                    /No match\. Chain x6 broken\. Lost reward target: x8 \+1 shard in 2 matches\. Next chase: Break into x10\. Next action: Save cashout: Rebuild toward x8 \+1 shard\. Recovery sequence: First Safe match\. Then Rebuild toward x8 \+1 shard\. Keep Break into x10\. Recovery lane map\. Recover Recover x1\. Confirm pair\. Safe pair\. Lost Save x1\. Save cashout\. Lost cashout\. Chain Rebuild x2\. Rebuild chain\. Chain lost\. Lost reward burst: Rebuild toward x8 \+1 shard\. Recover with a safe match\. x6 lost/
                )
            ).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('marks plain chain-break mismatch floaters separately from lost rewards', () => {
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
                        brokenChainDepth: 4,
                        key: 'test-break-miss-no-reward'
                    },
                    matchScorePop: null
                });
            });

            const floater = screen.getByTestId('mismatch-score-floater');
            expect(floater).toHaveAttribute('data-feedback-intensity', 'break');
            expect(floater).toHaveAttribute('data-mismatch-floater-heat', 'break');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-beats', '3');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-cue', 'snap');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-screen-cue', 'snap');
            expect(floater).toHaveAttribute('data-mismatch-recovery-crescendo-tier', 'break');
            expect(floater.querySelector('[data-floater-signal="break"]')).toHaveTextContent('Break');
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders trait-penalty mismatch floaters with stronger labels', async () => {
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
                        traitInteractionTexts: ['Cursed + Volatile: recall pressure'],
                        key: 'test-penalty-miss-1'
                    },
                    matchScorePop: null
                });
            });

            expect(screen.getByTestId('mismatch-score-floater')).toHaveTextContent('Penalty');
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute('data-mismatch-floater-heat', 'risk');
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-beats',
                '3'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-cue',
                'snap'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-tier',
                'risk'
            );
            expect(screen.getByTestId('mismatch-score-floater').querySelector('[data-floater-signal="penalty"]')).toHaveTextContent('Risk');
            expect(screen.getByTestId('mismatch-score-floater')).toHaveTextContent('Cursed + Volatile');
            expect(screen.getByTestId('mismatch-score-floater-recovery')).toHaveTextContent('Recover - peek or route away');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('Recover route');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveTextContent('peek or route away');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAttribute('data-mismatch-next-action', 'risk');
            expect(screen.getByTestId('mismatch-score-floater-next-action')).toHaveAttribute(
                'data-mismatch-next-action-cue',
                'Recover route'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Tool');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Use tool');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Peek / route');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips').querySelector('[data-mismatch-recovery-chip="risk"]')).toHaveTextContent('Avoid repeat');
            expect(
                screen.getByTestId('mismatch-score-floater-recovery-chips').querySelector('[data-mismatch-recovery-chip="risk"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-fill', '75');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('Route risk');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('peek or route away');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveAttribute(
                'data-recovery-burst-tier',
                'risk'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveAttribute(
                'data-recovery-burst-fill',
                '60'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent('Risk beat');
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent(
                'peek or route away'
            );
            expect(
                screen.getByTestId('mismatch-score-floater-recovery-crescendo').querySelectorAll('i')
            ).toHaveLength(3);
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveTextContent('Risk stack');
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveTextContent(
                'Trait risk + Tool + Recover'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveTextContent(
                'Cursed + Volatile -> peek or route away'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveAttribute(
                'data-mismatch-recovery-stack',
                'risk'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('peek or route away');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Prime with tool');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveTextContent('Avoid repeat risk');
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveAttribute(
                'data-mismatch-recovery-sequence',
                'risk'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-sequence')).toHaveAccessibleName(
                'Recovery sequence. First: peek or route away. Then: Prime with tool. Keep: Avoid repeat risk.'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveAttribute('data-burst-tier', 'risk');
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent('Risk stack');
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
                'Trait penalty + Miss + Recover'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
                'Next: cards reset; pick a remembered pair.'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute('data-feedback-intensity', 'penalty');
            expect(
                screen.getByText(
                    /Trait penalty\. No match\. Next action: Recover route: peek or route away\. Recovery sequence: First peek or route away\. Then Prime with tool\. Keep Avoid repeat risk\. Cursed \+ Volatile: recall pressure\. Recover - peek or route away\. Recovery lane map\. Recover Recover x1\. Stabilize route\. Recover route\. Tool Tool x1\. Trigger tool\. Use tool\. Risk Risk x1\. Route away\. Avoid repeat\. Risk beat: peek or route away/
                )
            ).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders multi-trait penalty mismatch floaters as trait-surge risk feedback', async () => {
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
                        traitInteractionTexts: [
                            'Cursed + Volatile: recall pressure',
                            'Stasis: nearby trait blocked'
                        ],
                        key: 'test-trait-surge-miss-1'
                    },
                    matchScorePop: null
                });
            });

            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute('data-mismatch-floater-heat', 'trait-surge');
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-beats',
                '4'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-cue',
                'burst'
            );
            expect(screen.getByTestId('mismatch-score-floater')).toHaveAttribute(
                'data-mismatch-recovery-crescendo-tier',
                'trait-surge'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('Trait surge');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveTextContent('2 risks');
            expect(screen.getByTestId('mismatch-score-floater-recovery-burst')).toHaveAttribute(
                'data-recovery-burst-fill',
                '80'
            );
            expect(
                screen.getByTestId('mismatch-score-floater-recovery-chips').querySelector('[data-mismatch-recovery-chip="risk"]')
            ).toHaveAttribute('data-mismatch-recovery-chip-fill', '75');
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent(
                'Trait surge burst'
            );
            expect(screen.getByTestId('mismatch-score-floater-recovery-crescendo')).toHaveTextContent(
                '2 trait risks; route away before chasing'
            );
            expect(
                screen.getByTestId('mismatch-score-floater-recovery-crescendo').querySelectorAll('i')
            ).toHaveLength(4);
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Trait surge');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('Risk spike');
            expect(screen.getByTestId('mismatch-score-floater-recovery-chips')).toHaveTextContent('2 risks');
            expect(screen.getByTestId('mismatch-score-floater-recovery-stack')).toHaveTextContent(
                'Trait surge + Tool + Recover'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent('Risk stack');
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
                'Trait surge + Miss + Recover'
            );
            expect(screen.getByTestId('action-feedback-stack-summary')).toHaveTextContent(
                'Next: multiple trait penalties landed; use the safest confirmed pair before touching that cluster again.'
            );
            expect(screen.getByTestId('action-feedback-rail')).toHaveTextContent(
                'Next: multiple trait penalties landed; use the safest confirmed pair before touching that cluster again.'
            );
            expect(
                screen.getByText(
                    /Trait surge: 2 risks\. No match\. Next action: Recover route: choose another opener\. Recovery sequence: First choose another opener\. Then Route away from surge\. Keep Avoid repeat risk\. Cursed \+ Volatile: recall pressure\. Stasis: nearby trait blocked\. Next - choose another opener\. Recovery lane map\. Recover Recover x1\. Stabilize route\. Recover route\. Tool Tool x1\. Trigger tool\. Use tool\. Risk Risk x2\. Route away\. Risk spike\. Trait surge burst: 2 trait risks; route away before chasing/
                )
            ).toBeInTheDocument();
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
        expect(getByTestId('endless-chapter-signals')).toHaveTextContent('Pressure');
        expect(getByTestId('endless-chapter-signals')).toHaveTextContent('Counter');
        expect(getByTestId('endless-chapter-signals')).toHaveTextContent('Payoff');
        expect(getByTestId('endless-chapter-signals').querySelector('[data-chapter-signal-tone="counter"]')).toHaveAttribute(
            'data-chapter-signal-beats',
            '2'
        );
        expect(getByTestId('endless-chapter-signals').querySelector('[data-chapter-signal-tone="counter"]')).toHaveAttribute(
            'data-chapter-signal-audio',
            'chapter-signal-counter'
        );
        expect(getByTestId('endless-chapter-signals').querySelector('[data-chapter-signal-tone="counter"]')).toHaveAttribute(
            'data-chapter-signal-screen-cue',
            'snap'
        );
        expect(getByTestId('endless-chapter-signals').querySelector('[data-chapter-signal-tone="objective"]')).toHaveAttribute(
            'data-chapter-signal-beats',
            '4'
        );
        expect(getByTestId('endless-chapter-signals').querySelector('[data-chapter-signal-tone="objective"]')).toHaveAttribute(
            'data-chapter-signal-audio',
            'chapter-signal-reward'
        );
        expect(getByTestId('endless-chapter-signals').querySelector('[data-chapter-signal-tone="objective"]')).toHaveAttribute(
            'data-chapter-signal-screen-cue',
            'burst'
        );
        expect(
            getByTestId('endless-chapter-signals')
                .querySelector('[data-chapter-signal-tone="objective"]')
                ?.querySelectorAll('[data-chapter-signal-beat]')
        ).toHaveLength(4);
        expect(
            getByTestId('endless-chapter-signals').querySelector(
                '[data-chapter-signal-tone="objective"] [data-chapter-signal-beat="1"]'
            )
        ).toHaveAttribute('data-chapter-signal-beat-focus', 'primary');
        expect(
            getByTestId('endless-chapter-signals').querySelector(
                '[data-chapter-signal-tone="objective"] [data-chapter-signal-beat="2"]'
            )
        ).toHaveAttribute('data-chapter-signal-beat-focus', 'support');
        expect(getByTestId('endless-chapter-signals').getAttribute('aria-label')).toContain(
            'Chapter gameplay signals. Pressure: Baseline descent. Counter: Read plan. Payoff: Flip par.'
        );
        expect(getByTestId('endless-chapter-signals').getAttribute('aria-label')).toContain(
            'Now: Route Flip par.'
        );
        expect(getByTestId('endless-chapter-action-cue')).toHaveTextContent('Now');
        expect(getByTestId('endless-chapter-action-cue')).toHaveTextContent('Route Flip par');
        expect(getByTestId('endless-chapter-action-cue')).toHaveAttribute('data-chapter-action-tone', 'counter');
        expect(getByTestId('endless-chapter-action-cue')).toHaveAttribute('data-chapter-action-audio', 'chapter-action-counter');
        expect(getByTestId('endless-chapter-action-cue')).toHaveAttribute('data-chapter-action-beats', '2');
        expect(getByTestId('endless-chapter-action-cue')).toHaveAttribute('data-chapter-action-screen-cue', 'snap');
        expect(getByTestId('endless-chapter-action-cue').querySelectorAll('[data-chapter-action-beat]')).toHaveLength(2);
        expect(getByTestId('endless-chapter-action-cue').querySelector('[data-chapter-action-beat="1"]')).toHaveAttribute(
            'data-chapter-action-beat-focus',
            'primary'
        );
        expect(getByTestId('endless-chapter-action-cue').querySelector('[data-chapter-action-beat="2"]')).toHaveAttribute(
            'data-chapter-action-beat-focus',
            'support'
        );
        expect(getByTestId('endless-chapter-action-cue')).toHaveAccessibleName(
            'Chapter action cue. Now: Route Flip par.'
        );
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
            findablesClaimedThisFloor: 1,
            findablesTotalThisFloor: 2,
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

        const { getByText, rerender } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByText(/Flip par: Complete/)).toBeTruthy();
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('Score pop');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('+120');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('Rating');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('S++');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('Best chain');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('x2');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('Pickups');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('1/2');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('Shards');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('Favor');
        expect(screen.getByTestId('floor-clear-momentum-strip')).toHaveTextContent('+1 pick banked');
        expect(screen.getByTestId('floor-clear-momentum-strip').getAttribute('aria-label')).toContain(
            'Floor clear momentum signals. Score pop: +120. Rating: S++. Best chain: x2.'
        );
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-tone', 'super');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-action', 'Rebuild stack');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-audio', 'floor-stack-super');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-beats', '5');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-screen-cue', 'super');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveTextContent('Super stack');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveTextContent('5 payoffs paid');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveTextContent('Rebuild stack');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveTextContent('Trait route + Objective + Pickup + Shard + Relic pick');
        expect(screen.getByTestId('floor-clear-payoff-stack').querySelectorAll('[data-floor-payoff-stack-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('floor-clear-payoff-stack').querySelector('[data-floor-payoff-stack-beat="1"]')
        ).toHaveAttribute('data-floor-payoff-stack-beat-focus', 'primary');
        expect(
            screen.getByTestId('floor-clear-payoff-stack').querySelector('[data-floor-payoff-stack-beat="2"]')
        ).toHaveAttribute('data-floor-payoff-stack-beat-focus', 'support');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAccessibleName(
            'Super stack: 5 payoffs paid. Rebuild stack. 5 beats. Trait route + Objective + Pickup + Shard + Relic pick paid on the clear; open the next floor by rebuilding the super-stack route.'
        );
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('Cashout');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('trait route + objective + 1 pickup');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('+1 combo shard');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('Missed value');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('1 pickup left');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('Visible reward pairs were left on the board.');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('Next chase');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('claim pickups');
        expect(screen.getByTestId('floor-clear-cashout-strip').querySelector('[data-cashout-tone="missed"]')).toHaveTextContent('1 pickup left');
        expect(screen.getByTestId('floor-clear-cashout-strip').getAttribute('aria-label')).toContain(
            'Floor clear cashout read. Cashout: trait route + objective + 1 pickup - +1 combo shard.'
        );
        expect(screen.getByTestId('floor-clear-cashout-strip').getAttribute('aria-label')).toContain(
            'Next chase: claim pickups - Prioritize marked reward pairs before ending the floor.'
        );
        expect(screen.getByTestId('floor-clear-carry-forward')).toHaveTextContent('Carry forward');
        expect(screen.getByTestId('floor-clear-carry-forward')).toHaveTextContent('+1 relic pick banked');
        expect(screen.getByTestId('floor-clear-carry-forward')).toHaveTextContent('Spend it at the next milestone draft.');
        expect(screen.getByTestId('floor-clear-carry-forward')).toHaveAttribute('data-carry-forward-tone', 'reward');
        expect(screen.getByTestId('floor-clear-carry-forward')).toHaveAccessibleName(
            'Carry forward: +1 relic pick banked. Spend it at the next milestone draft.'
        );
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveTextContent('Next floor loop');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveTextContent('Choose route card');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveTextContent('Spend banked relic pick');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveTextContent('Claim pickups early');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveAttribute('data-floor-clear-sequence-tone', 'route');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveAttribute('data-floor-clear-sequence-first', 'Choose route card');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveAttribute('data-floor-clear-sequence-then', 'Spend banked relic pick');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveAttribute('data-floor-clear-sequence-keep', 'Claim pickups early');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveAccessibleName(
            'Next floor loop. First: Choose route card. Then: Spend banked relic pick. Keep: Claim pickups early.'
        );
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('Objective paid');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('+30 score');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('Objective streak');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('x2 +10');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('Trait route paid');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('+1 combo shard');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"]')).toHaveTextContent('Objective paid');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="trait"]')).toHaveTextContent('Trait route paid');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"]')).toHaveAttribute('data-objective-beats', '4');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"]')).toHaveAttribute('data-objective-audio', 'floor-objective-reward');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"]')).toHaveAttribute('data-objective-screen-cue', 'burst');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"]')?.querySelectorAll('[data-objective-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"] [data-objective-beat="1"]')
        ).toHaveAttribute('data-objective-beat-focus', 'primary');
        expect(
            screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"] [data-objective-beat="2"]')
        ).toHaveAttribute('data-objective-beat-focus', 'support');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="momentum"]')).toHaveAttribute('data-objective-beats', '3');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="momentum"]')).toHaveAttribute('data-objective-audio', 'floor-objective-momentum');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="momentum"]')).toHaveAttribute('data-objective-screen-cue', 'pulse');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="trait"]')).toHaveAttribute('data-objective-beats', '4');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="trait"]')).toHaveAttribute('data-objective-audio', 'floor-objective-trait');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="trait"]')).toHaveAttribute('data-objective-screen-cue', 'trait');
        expect(screen.getByTestId('floor-clear-objective-strip').getAttribute('aria-label')).toContain(
            'Floor clear objective signals. Objective paid: +30 score. Objective streak: x2 +10. Trait route paid: +1 combo shard.'
        );
        const cleanChainRun: RunState = {
            ...run,
            findablesClaimedThisFloor: 2,
            findablesTotalThisFloor: 2,
            stats: {
                ...run.stats,
                currentStreak: 7,
                bestStreak: 7
            }
        };
        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={cleanChainRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveTextContent('Chain cashout');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveTextContent('Trait route + Objective + Pickup + Chain cashout + Shard + Relic pick');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-action', 'Rebuild stack');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-audio', 'floor-stack-super');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-beats', '5');
        expect(screen.getByTestId('floor-clear-payoff-stack')).toHaveAttribute('data-floor-payoff-stack-screen-cue', 'super');
        expect(screen.getByTestId('floor-clear-payoff-stack').querySelectorAll('[data-floor-payoff-stack-beat]')).toHaveLength(5);
        expect(
            screen.getByTestId('floor-clear-payoff-stack').querySelector('[data-floor-payoff-stack-beat="1"]')
        ).toHaveAttribute('data-floor-payoff-stack-beat-focus', 'primary');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('chain x6 +1 shard');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('Chain cashout: x6 +1 shard.');
        expect(screen.getByTestId('floor-clear-cashout-strip')).toHaveTextContent('Break into x10');
        expect(screen.getByTestId('floor-clear-cashout-strip').getAttribute('aria-label')).toContain(
            'Next chase: Break into x10 - Prioritize visible pairs and use peek/shuffle before the chain drops.'
        );
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveTextContent('Break into x10');
        expect(screen.getByTestId('floor-clear-action-sequence')).toHaveAttribute('data-floor-clear-sequence-keep', 'Break into x10');
        expect(getByText('Trait routes: Complete (+1 combo shard)')).toBeTruthy();
        expect(getByText('Objective streak: x2 (+10)')).toBeTruthy();
        expect(getByText('Favor gained: +1')).toBeTruthy();
        expect(getByText(/Extra relic pick banked/)).toBeTruthy();
        expect(screen.getByTestId('floor-clear-next-signal-strip')).toHaveTextContent('Floor');
        expect(screen.getByTestId('floor-clear-next-signal-strip')).toHaveTextContent('Speed Trial');
        expect(screen.getByTestId('floor-clear-next-signal-strip')).toHaveTextContent('Objective');
        expect(screen.getByTestId('floor-clear-next-signal-strip')).toHaveTextContent('Lantern Academy');
        expect(screen.getByTestId('floor-clear-next-signal-strip')).toHaveTextContent('Pressure');
        expect(screen.getByTestId('floor-clear-next-signal-strip')).toHaveTextContent('speed check');
        expect(screen.getByTestId('floor-clear-next-signal-strip')).toHaveTextContent('Counterplay');
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="reward"]')).toHaveAttribute(
            'data-next-beats',
            '4'
        );
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="reward"]')).toHaveAttribute(
            'data-next-audio',
            'next-floor-reward'
        );
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="reward"]')).toHaveAttribute(
            'data-next-screen-cue',
            'burst'
        );
        expect(
            screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="reward"]')?.querySelectorAll('[data-next-beat]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="reward"] [data-next-beat="1"]')
        ).toHaveAttribute('data-next-beat-focus', 'primary');
        expect(
            screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="reward"] [data-next-beat="2"]')
        ).toHaveAttribute('data-next-beat-focus', 'support');
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="pressure"]')).toHaveAttribute(
            'data-next-beats',
            '3'
        );
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="pressure"]')).toHaveAttribute(
            'data-next-audio',
            'next-floor-pressure'
        );
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="pressure"]')).toHaveAttribute(
            'data-next-screen-cue',
            'guard'
        );
        expect(
            screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="pressure"] [data-next-beat="1"]')
        ).toHaveAttribute('data-next-beat-focus', 'primary');
        expect(
            screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="pressure"] [data-next-beat="2"]')
        ).toHaveAttribute('data-next-beat-focus', 'support');
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="counterplay"]')).toHaveAttribute(
            'data-next-beats',
            '4'
        );
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="counterplay"]')).toHaveAttribute(
            'data-next-audio',
            'next-floor-counterplay'
        );
        expect(screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="counterplay"]')).toHaveAttribute(
            'data-next-screen-cue',
            'burst'
        );
        expect(
            screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="counterplay"] [data-next-beat="1"]')
        ).toHaveAttribute('data-next-beat-focus', 'primary');
        expect(
            screen.getByTestId('floor-clear-next-signal-strip').querySelector('[data-next-tone="counterplay"] [data-next-beat="2"]')
        ).toHaveAttribute('data-next-beat-focus', 'support');
        expect(screen.getByTestId('floor-clear-next-signal-strip').getAttribute('aria-label')).toContain(
            'Next floor preview signals. Floor: Speed Trial'
        );
        expect(screen.getByTestId('floor-clear-next-signal-strip').getAttribute('aria-label')).toContain(
            'Objective: Flip par - Featured payout target.'
        );
        expect(screen.getByTestId('floor-clear-causality-grid')).toHaveTextContent('Baseline descent');
        expect(screen.getByTestId('floor-clear-causality-grid')).toHaveTextContent('score, objective value, and assist discipline');
        expect(screen.getByTestId('floor-clear-causality-grid')).toHaveTextContent(
            'The corridor remembers the clean pairs first'
        );
        expect(screen.getByTestId('floor-clear-causality-grid').getAttribute('aria-label')).toContain(
            'Baseline descent - Baseline descent resolved; score, objective value, and assist discipline remain the main read.'
        );
        expect(screen.getByTestId('floor-clear-result-stack')).toHaveAttribute('data-route-choice-required', 'true');
        expect(screen.getByTestId('route-choice-panel')).toHaveTextContent('Choose the next room');
        expect(screen.getByTestId('route-choice-panel')).toHaveAttribute('data-decision-state', 'required');
        expect(screen.getByTestId('route-choice-required-copy')).toHaveTextContent('Choose the next room type');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute('data-route-recommendation-route', 'safe');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute('data-route-recommendation-action', 'Stabilize route');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute('data-route-recommendation-audio', 'route-guard-beat');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute('data-route-recommendation-beats', '2');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute('data-route-recommendation-payoff', 'steady clear');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute('data-route-recommendation-screen-cue', 'guard');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAttribute('data-route-recommendation-tone', 'memory');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveTextContent('Recommended route');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveTextContent('Safe passage');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveTextContent('Stabilize route');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveTextContent('steady clear');
        expect(screen.getByTestId('route-choice-recommendation').querySelectorAll('[data-route-recommendation-beat]')).toHaveLength(2);
        expect(
            screen.getByTestId('route-choice-recommendation').querySelector('[data-route-recommendation-beat="1"]')
        ).toHaveAttribute('data-route-recommendation-beat-focus', 'primary');
        expect(
            screen.getByTestId('route-choice-recommendation').querySelector('[data-route-recommendation-beat="2"]')
        ).toHaveAttribute('data-route-recommendation-beat-focus', 'support');
        expect(screen.getByTestId('route-choice-recommendation')).toHaveAccessibleName(
            'Recommended route. Safe passage. Stabilize route. Safe route fits the current recall state. 2 beats. Primary payoff: steady clear.'
        );
        expect(
            screen.getByTestId('route-choice-safe-beat-cue').querySelector('[data-route-beat-pip="1"]')
        ).toHaveAttribute('data-route-beat-pip-focus', 'primary');
        expect(
            screen.getByTestId('route-choice-safe-beat-cue').querySelector('[data-route-beat-pip="2"]')
        ).toHaveAttribute('data-route-beat-pip-focus', 'support');
        expect(
            screen.getByTestId('route-choice-safe-beat-cue').querySelector('[data-route-beat-pip="1"]')
        ).toHaveAttribute('data-route-beat-pip-focus', 'primary');
        expect(
            screen.getByTestId('route-choice-safe-beat-cue').querySelector('[data-route-beat-pip="2"]')
        ).toHaveAttribute('data-route-beat-pip-focus', 'support');
        expect(
            screen.getByTestId('route-choice-safe-signals').querySelector(
                '[data-route-signal="reward"] [data-route-choice-signal-beat="1"]'
            )
        ).toHaveAttribute('data-route-choice-signal-beat-focus', 'primary');
        expect(
            screen.getByTestId('route-choice-safe-signals').querySelector(
                '[data-route-signal="reward"] [data-route-choice-signal-beat="2"]'
            )
        ).toHaveAttribute('data-route-choice-signal-beat-focus', 'support');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveAttribute('data-pressure', 'strained');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('Focus 2/3 - locked');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('Bonus +28');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('1 learned clue');
        expect(screen.getByTestId('route-memory-read-panel')).toHaveTextContent('1 recall lapse');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Reward: Balanced score and survival path.');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Risk: Stable path.');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Recommended first route');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-impact-cue', 'Safe route');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-impact-cue-tone', 'memory');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-next-action', 'Stabilize route');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-next-action-tone', 'memory');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-beat-action', 'Stabilize route');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-beat-audio', 'route-guard-beat');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-beat-cue', 'Guard beat');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-beat-screen-cue', 'guard');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-beat-tier', 'guard');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-beat-count', '2');
        expect(screen.getByTestId('route-choice-safe-beat-cue')).toHaveAttribute('data-route-beat-action', 'Stabilize route');
        expect(screen.getByTestId('route-choice-safe-beat-cue')).toHaveAttribute('data-route-beat-audio', 'route-guard-beat');
        expect(screen.getByTestId('route-choice-safe-beat-cue')).toHaveAttribute('data-route-beat-screen-cue', 'guard');
        expect(screen.getByTestId('route-choice-safe-beat-cue')).toHaveTextContent('Guard beat');
        expect(screen.getByTestId('route-choice-safe-beat-cue')).toHaveTextContent('Stabilize route');
        expect(screen.getByTestId('route-choice-safe-beat-cue').querySelectorAll('i')).toHaveLength(2);
        expect(screen.getByTestId('route-choice-safe-impact-cue')).toHaveTextContent('Safe route');
        expect(screen.getByTestId('route-choice-safe-impact-cue')).toHaveTextContent('Shield next floor');
        expect(screen.getByTestId('route-choice-safe-impact-cue')).toHaveAccessibleName(
            'Route impact cue: Safe route: Shield next floor.'
        );
        expect(screen.getByTestId('route-choice-safe-action-cue')).toHaveTextContent('Do next');
        expect(screen.getByTestId('route-choice-safe-action-cue')).toHaveTextContent('Stabilize route');
        expect(screen.getByTestId('route-choice-safe-action-cue')).toHaveTextContent('Safe route fits the current recall state.');
        expect(screen.getByTestId('route-choice-safe-action-cue')).toHaveAttribute('data-route-action-tone', 'memory');
        expect(screen.getByTestId('route-choice-safe-action-cue')).toHaveAccessibleName(
            'Do next: Stabilize route. Safe route fits the current recall state.'
        );
        expect(screen.getByTestId('route-choice-safe-signals')).toHaveTextContent('Stable reward');
        expect(screen.getByTestId('route-choice-safe-signals')).toHaveTextContent('Low risk');
        expect(screen.getByTestId('route-choice-safe-signals').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-beats',
            '4'
        );
        expect(
            screen.getByTestId('route-choice-safe-signals').querySelector('[data-route-signal="reward"]')?.querySelectorAll('[data-route-choice-signal-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('route-choice-safe-signals').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-audio',
            'route-signal-reward'
        );
        expect(screen.getByTestId('route-choice-safe-signals').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('route-choice-safe-signals').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-beats',
            '3'
        );
        expect(screen.getByTestId('route-choice-safe-signals').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-audio',
            'route-signal-risk'
        );
        expect(screen.getByTestId('route-choice-safe-signals').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-screen-cue',
            'risk'
        );
        expect(screen.getByTestId('route-choice-safe-signals')).toHaveAttribute(
            'aria-label',
            'Route choice safe signals. Reward: Stable reward. Risk: Low risk.'
        );
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveTextContent('Payoff');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveTextContent('steady clear');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveTextContent('low pressure');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveTextContent('ward support');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveTextContent('Safe route fits the current recall state.');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-primary-payoff', 'steady clear');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-primary-payoff-audio', 'route-payoff-reward');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-primary-payoff-id', 'reward');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-primary-payoff-screen-cue', 'burst');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-primary-payoff-tone', 'reward');
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute('data-route-primary-payoff-beats', '4');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveAttribute('data-route-primary-payoff', 'steady clear');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveAttribute('data-route-primary-payoff-audio', 'route-payoff-reward');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveAttribute('data-route-primary-payoff-id', 'reward');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveAttribute('data-route-primary-payoff-screen-cue', 'burst');
        expect(screen.getByTestId('route-choice-safe-payoffs')).toHaveAttribute('data-route-primary-payoff-tone', 'reward');
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveAccessibleName(
            'Primary route payoff. Payoff: steady clear. 4 beats.'
        );
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveAttribute('data-route-primary-payoff-id', 'reward');
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveAttribute(
            'data-route-primary-payoff-audio',
            'route-payoff-reward'
        );
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveAttribute(
            'data-route-primary-payoff-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveAttribute('data-route-primary-payoff-tone', 'reward');
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveAttribute('data-route-primary-payoff-beats', '4');
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveTextContent('Primary payoff');
        expect(screen.getByTestId('route-choice-safe-primary-payoff')).toHaveTextContent('steady clear');
        expect(screen.getByTestId('route-choice-safe-primary-payoff').querySelectorAll('[data-route-primary-payoff-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('route-choice-safe-primary-payoff').querySelector('[data-route-primary-payoff-beat="1"]')
        ).toHaveAttribute('data-route-primary-payoff-beat-focus', 'primary');
        expect(
            screen.getByTestId('route-choice-safe-primary-payoff').querySelector('[data-route-primary-payoff-beat="2"]')
        ).toHaveAttribute('data-route-primary-payoff-beat-focus', 'support');
        expect(screen.getByTestId('route-choice-safe-payoffs').getAttribute('aria-label')).toContain(
            'Route choice safe payoffs. Payoff: steady clear. Risk: low pressure. Next: ward support. Recall: Safe route fits the current recall state.'
        );
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '4'
        );
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveAttribute(
            'data-route-payoff-audio',
            'route-payoff-reward'
        );
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveAttribute(
            'data-route-payoff-screen-cue',
            'burst'
        );
        expect(
            screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="reward"]')?.querySelectorAll('[data-route-payoff-beat]')
        ).toHaveLength(4);
        expect(
            screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="reward"] [data-route-payoff-beat="1"]')
        ).toHaveAttribute('data-route-payoff-beat-focus', 'primary');
        expect(
            screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="reward"] [data-route-payoff-beat="2"]')
        ).toHaveAttribute('data-route-payoff-beat-focus', 'support');
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveTextContent('ward support');
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '2'
        );
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveAttribute(
            'data-route-payoff-audio',
            'route-payoff-route'
        );
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveAttribute(
            'data-route-payoff-screen-cue',
            'pulse'
        );
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="memory"]')).toHaveTextContent('Safe route fits');
        expect(screen.getByTestId('route-choice-safe-payoffs').querySelector('[data-route-payoff-id="memory"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '2'
        );
        expect(screen.getByTestId('route-choice-safe-decision-stack')).toHaveTextContent('Route safety');
        expect(screen.getByTestId('route-choice-safe-decision-stack')).toHaveTextContent('Stable reward + Safe route fits the current recall state');
        expect(screen.getByTestId('route-choice-safe-decision-stack')).toHaveTextContent('First: stabilize with ward support');
        expect(screen.getByTestId('route-choice-safe-decision-stack')).toHaveAttribute('data-route-decision-stack-tone', 'memory');
        expect(screen.getByTestId('route-choice-safe-decision-stack')).toHaveAccessibleName(
            'Route safety: Stable reward + Safe route fits the current recall state. First: stabilize with ward support.'
        );
        expect(screen.getByTestId('route-choice-safe')).toHaveAttribute(
            'data-route-recipe',
            'Stabilize route -> steady clear -> Safe route fits the current recall state. -> stabilize with ward support'
        );
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('First');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('Stabilize route');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('Payoff');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('steady clear');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('Recall');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('Safe route fits the current recall state.');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('Keep');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveTextContent('stabilize with ward support');
        expect(screen.getByTestId('route-choice-safe-recipe')).toHaveAccessibleName(
            'Route recipe safe. First: Stabilize route. Payoff: steady clear. Recall: Safe route fits the current recall state. Keep: stabilize with ward support.'
        );
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent('Memory: Use this when the last room left forgotten tiles or broken focus.');
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent(
            'Recall: Safe route fits the current recall state.'
        );
        expect(screen.getByTestId('route-choice-safe')).toHaveTextContent(
            'Atmosphere: A steadier corridor keeps its marks close to the wall.'
        );
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-type', 'greed');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-impact-cue', 'Greed route');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-impact-cue-tone', 'risk');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-next-action', 'Cash greed');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-next-action-tone', 'risk');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-beat-action', 'Cash greed');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-beat-audio', 'route-cashout-beat');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-beat-cue', 'Cashout beat');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-beat-screen-cue', 'super');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-beat-tier', 'cashout');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute('data-route-beat-count', '5');
        expect(screen.getByTestId('route-choice-greed-beat-cue')).toHaveAttribute('data-route-beat-action', 'Cash greed');
        expect(screen.getByTestId('route-choice-greed-beat-cue')).toHaveAttribute('data-route-beat-audio', 'route-cashout-beat');
        expect(screen.getByTestId('route-choice-greed-beat-cue')).toHaveAttribute('data-route-beat-screen-cue', 'super');
        expect(screen.getByTestId('route-choice-greed-beat-cue')).toHaveTextContent('Cashout beat');
        expect(screen.getByTestId('route-choice-greed-beat-cue')).toHaveTextContent('Cash greed');
        expect(screen.getByTestId('route-choice-greed-beat-cue').querySelectorAll('i')).toHaveLength(5);
        expect(screen.getByTestId('route-choice-greed-impact-cue')).toHaveTextContent('Pressure cashout');
        expect(screen.getByTestId('route-choice-greed-action-cue')).toHaveTextContent('Do next');
        expect(screen.getByTestId('route-choice-greed-action-cue')).toHaveTextContent('Cash greed');
        expect(screen.getByTestId('route-choice-greed-action-cue')).toHaveTextContent('Repair recall before taking pressure cashout');
        expect(screen.getByTestId('route-choice-greed-action-cue')).toHaveAttribute('data-route-action-tone', 'risk');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('Mnemonic Sentinel: Sentinel pressure and greed anchors.');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('High reward, higher danger');
        expect(screen.getByTestId('route-choice-greed-signals')).toHaveTextContent('High reward');
        expect(screen.getByTestId('route-choice-greed-signals')).toHaveTextContent('High risk');
        expect(screen.getByTestId('route-choice-greed-signals').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-beats',
            '4'
        );
        expect(screen.getByTestId('route-choice-greed-signals').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-beats',
            '3'
        );
        expect(screen.getByTestId('route-choice-greed-signals')).toHaveAttribute(
            'aria-label',
            'Route choice greed signals. Reward: High reward. Risk: High risk.'
        );
        expect(screen.getByTestId('route-choice-greed-payoffs')).toHaveTextContent('bonus value');
        expect(screen.getByTestId('route-choice-greed-payoffs')).toHaveTextContent('high pressure');
        expect(screen.getByTestId('route-choice-greed-payoffs')).toHaveTextContent('richer caches');
        expect(screen.getByTestId('route-choice-greed-payoffs')).toHaveTextContent('Greed is unsafe until forgotten markers are repaired.');
        expect(screen.getByTestId('route-choice-greed-payoffs').getAttribute('aria-label')).toContain(
            'Route choice greed payoffs. Payoff: bonus value. Risk: high pressure. Next: richer caches. Recall: Greed is unsafe until forgotten markers are repaired.'
        );
        expect(screen.getByTestId('route-choice-greed-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '4'
        );
        expect(screen.getByTestId('route-choice-greed-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveTextContent('richer caches');
        expect(screen.getByTestId('route-choice-greed-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '3'
        );
        expect(screen.getByTestId('route-choice-greed-payoffs').querySelector('[data-route-payoff-id="risk"]')).toHaveTextContent('high pressure');
        expect(screen.getByTestId('route-choice-greed-payoffs').querySelector('[data-route-payoff-id="risk"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '3'
        );
        expect(screen.getByTestId('route-choice-greed-payoffs').querySelector('[data-route-payoff-id="risk"]')).toHaveAttribute(
            'data-route-payoff-audio',
            'route-payoff-risk'
        );
        expect(screen.getByTestId('route-choice-greed-payoffs').querySelector('[data-route-payoff-id="risk"]')).toHaveAttribute(
            'data-route-payoff-screen-cue',
            'risk'
        );
        expect(screen.getByTestId('route-choice-greed-decision-stack')).toHaveTextContent('Route gamble');
        expect(screen.getByTestId('route-choice-greed-decision-stack')).toHaveTextContent('High reward + Greed is unsafe until forgotten markers are repaired');
        expect(screen.getByTestId('route-choice-greed-decision-stack')).toHaveTextContent('First: confirm recall before bonus value');
        expect(screen.getByTestId('route-choice-greed-decision-stack')).toHaveAttribute('data-route-decision-stack-tone', 'risk');
        expect(screen.getByTestId('route-choice-greed')).toHaveAttribute(
            'data-route-recipe',
            'Cash greed -> bonus value -> Greed is unsafe until forgotten markers are repaired. -> confirm recall before bonus value'
        );
        expect(screen.getByTestId('route-choice-greed-recipe')).toHaveTextContent('Cash greed');
        expect(screen.getByTestId('route-choice-greed-recipe')).toHaveTextContent('bonus value');
        expect(screen.getByTestId('route-choice-greed-recipe')).toHaveTextContent('Greed is unsafe until forgotten markers are repaired.');
        expect(screen.getByTestId('route-choice-greed-recipe')).toHaveTextContent('confirm recall before bonus value');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent('Memory: Take only if you can remember enemy, trap, and symbol positions under pressure.');
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent(
            'Recall: Greed is unsafe until forgotten markers are repaired.'
        );
        expect(screen.getByTestId('route-choice-greed')).toHaveTextContent(
            'Atmosphere: The louder stair promises value, but every card remembers the noise.'
        );
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent('Changes the next board');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-impact-cue', 'Mystery route');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-impact-cue-tone', 'build');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-next-action', 'Prime mystery');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-next-action-tone', 'build');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-beat-action', 'Prime mystery');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-beat-audio', 'route-prime-beat');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-beat-cue', 'Prime beat');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-beat-screen-cue', 'pulse');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-beat-tier', 'prime');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-beat-count', '3');
        expect(screen.getByTestId('route-choice-mystery-beat-cue')).toHaveAttribute('data-route-beat-action', 'Prime mystery');
        expect(screen.getByTestId('route-choice-mystery-beat-cue')).toHaveAttribute('data-route-beat-audio', 'route-prime-beat');
        expect(screen.getByTestId('route-choice-mystery-beat-cue')).toHaveAttribute('data-route-beat-screen-cue', 'pulse');
        expect(screen.getByTestId('route-choice-mystery-beat-cue')).toHaveTextContent('Prime beat');
        expect(screen.getByTestId('route-choice-mystery-beat-cue')).toHaveTextContent('Prime mystery');
        expect(screen.getByTestId('route-choice-mystery-beat-cue').querySelectorAll('i')).toHaveLength(3);
        expect(screen.getByTestId('route-choice-mystery-impact-cue')).toHaveTextContent('Board remix');
        expect(screen.getByTestId('route-choice-mystery-action-cue')).toHaveTextContent('Do next');
        expect(screen.getByTestId('route-choice-mystery-action-cue')).toHaveTextContent('Prime mystery');
        expect(screen.getByTestId('route-choice-mystery-action-cue')).toHaveTextContent('Mystery has a remembered clue to anchor the unknown.');
        expect(screen.getByTestId('route-choice-mystery-action-cue')).toHaveAttribute('data-route-action-tone', 'build');
        expect(screen.getByTestId('route-choice-mystery-signals')).toHaveTextContent('Board change');
        expect(screen.getByTestId('route-choice-mystery-signals')).toHaveTextContent('Unknown risk');
        expect(screen.getByTestId('route-choice-mystery-signals').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-beats',
            '4'
        );
        expect(screen.getByTestId('route-choice-mystery-signals').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-beats',
            '3'
        );
        expect(screen.getByTestId('route-choice-mystery-signals')).toHaveAttribute(
            'aria-label',
            'Route choice mystery signals. Reward: Board change. Risk: Unknown risk.'
        );
        expect(screen.getByTestId('route-choice-mystery-payoffs')).toHaveTextContent('board twist');
        expect(screen.getByTestId('route-choice-mystery-payoffs')).toHaveTextContent('unknown');
        expect(screen.getByTestId('route-choice-mystery-payoffs')).toHaveTextContent('changed board');
        expect(screen.getByTestId('route-choice-mystery-payoffs')).toHaveTextContent('Mystery has a remembered clue to anchor the unknown.');
        expect(screen.getByTestId('route-choice-mystery-payoffs').getAttribute('aria-label')).toContain(
            'Route choice mystery payoffs. Payoff: board twist. Risk: unknown. Next: changed board. Recall: Mystery has a remembered clue to anchor the unknown.'
        );
        expect(screen.getByTestId('route-choice-mystery-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveTextContent('changed board');
        expect(screen.getByTestId('route-choice-mystery-payoffs').querySelector('[data-route-payoff-id="next"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '3'
        );
        expect(screen.getByTestId('route-choice-mystery-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveTextContent('board twist');
        expect(screen.getByTestId('route-choice-mystery-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveAttribute(
            'data-route-payoff-beats',
            '3'
        );
        expect(screen.getByTestId('route-choice-mystery-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveAttribute(
            'data-route-payoff-audio',
            'route-payoff-build'
        );
        expect(screen.getByTestId('route-choice-mystery-payoffs').querySelector('[data-route-payoff-id="reward"]')).toHaveAttribute(
            'data-route-payoff-screen-cue',
            'build'
        );
        expect(screen.getByTestId('route-choice-mystery-decision-stack')).toHaveTextContent('Route mystery');
        expect(screen.getByTestId('route-choice-mystery-decision-stack')).toHaveTextContent('Board change + Mystery has a remembered clue to anchor the unknown');
        expect(screen.getByTestId('route-choice-mystery-decision-stack')).toHaveTextContent('First: anchor clue before changed board');
        expect(screen.getByTestId('route-choice-mystery-decision-stack')).toHaveAttribute('data-route-decision-stack-tone', 'build');
        expect(screen.getByTestId('route-choice-mystery')).toHaveAttribute(
            'data-route-recipe',
            'Prime mystery -> board twist -> Mystery has a remembered clue to anchor the unknown. -> anchor clue before changed board'
        );
        expect(screen.getByTestId('route-choice-mystery-recipe')).toHaveTextContent('Prime mystery');
        expect(screen.getByTestId('route-choice-mystery-recipe')).toHaveTextContent('board twist');
        expect(screen.getByTestId('route-choice-mystery-recipe')).toHaveTextContent('Mystery has a remembered clue to anchor the unknown.');
        expect(screen.getByTestId('route-choice-mystery-recipe')).toHaveTextContent('anchor clue before changed board');
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent(
            'Recall: Mystery has a remembered clue to anchor the unknown.'
        );
        expect(screen.getByTestId('route-choice-mystery')).toHaveTextContent(
            'Atmosphere: The unindexed door offers a clue first and an answer later.'
        );
        expect(screen.getByRole('button', { name: /Safe passage.*Route action: Stabilize route: Safe route fits.*Route safety: Stable reward.*First: stabilize with ward support.*Recall: Safe route fits/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Greedy route.*Route action: Cash greed: Repair recall before taking pressure cashout.*Route gamble: High reward.*First: confirm recall before bonus value.*Recall: Greed is unsafe/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Mystery route.*Route action: Prime mystery: Mystery has a remembered clue.*Route mystery: Board change.*First: anchor clue before changed board.*Recall: Mystery has a remembered clue/i })).toBeTruthy();
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
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-type', 'greed');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-impact-cue', 'Greed route');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-impact-cue-audio', 'route-payoff-risk');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-impact-cue-beats', '3');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-impact-cue-screen-cue', 'risk');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-impact-cue-tone', 'risk');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-action-cue', 'Opening tactic');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-action-cue-audio', 'route-payoff-risk');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-action-cue-beats', '3');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-action-cue-screen-cue', 'risk');
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-action-cue-tone', 'risk');
        expect(screen.getByTestId('route-selected-impact-cue')).toHaveTextContent('Greed route');
        expect(screen.getByTestId('route-selected-impact-cue')).toHaveTextContent('Risk cashout locked');
        expect(screen.getByTestId('route-selected-impact-cue')).toHaveAttribute('data-route-impact-cue-beats', '3');
        expect(screen.getByTestId('route-selected-impact-cue')).toHaveAttribute('data-route-impact-cue-audio', 'route-payoff-risk');
        expect(screen.getByTestId('route-selected-impact-cue')).toHaveAttribute('data-route-impact-cue-screen-cue', 'risk');
        expect(screen.getByTestId('route-selected-impact-cue').querySelectorAll('[data-route-impact-cue-beat]')).toHaveLength(3);
        expect(screen.getByTestId('route-selected-impact-cue')).toHaveAccessibleName(
            'Selected route impact cue: Greed route: Risk cashout locked.'
        );
        expect(screen.getByTestId('route-selected-action-cue')).toHaveTextContent('Opening tactic');
        expect(screen.getByTestId('route-selected-action-cue')).toHaveTextContent('Verify before cashout');
        expect(screen.getByTestId('route-selected-action-cue')).toHaveTextContent('Confirm recall before chasing richer caches.');
        expect(screen.getByTestId('route-selected-action-cue')).toHaveAttribute('data-route-action-cue-beats', '3');
        expect(screen.getByTestId('route-selected-action-cue')).toHaveAttribute('data-route-action-cue-audio', 'route-payoff-risk');
        expect(screen.getByTestId('route-selected-action-cue')).toHaveAttribute('data-route-action-cue-screen-cue', 'risk');
        expect(screen.getByTestId('route-selected-action-cue').querySelectorAll('[data-route-action-cue-beat]')).toHaveLength(3);
        expect(screen.getByTestId('route-selected-action-cue')).toHaveAccessibleName(
            'Selected route action cue: Opening tactic: Verify before cashout. Confirm recall before chasing richer caches.'
        );
        expect(screen.getByTestId('route-selected-note')).toHaveTextContent('High reward');
        expect(screen.getByTestId('route-selected-note')).toHaveTextContent('High risk');
        expect(screen.getByTestId('route-selected-note').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-beats',
            '4'
        );
        expect(
            screen.getByTestId('route-selected-note').querySelector('[data-route-signal="reward"]')?.querySelectorAll('[data-route-signal-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('route-selected-note').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-audio',
            'route-signal-reward'
        );
        expect(screen.getByTestId('route-selected-note').querySelector('[data-route-signal="reward"]')).toHaveAttribute(
            'data-route-signal-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('route-selected-note').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-beats',
            '3'
        );
        expect(screen.getByTestId('route-selected-note').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-audio',
            'route-signal-risk'
        );
        expect(screen.getByTestId('route-selected-note').querySelector('[data-route-signal="risk"]')).toHaveAttribute(
            'data-route-signal-screen-cue',
            'risk'
        );
        expect(screen.getByRole('button', { name: /continue to greedy route floor/i })).toBeTruthy();
    });

    it('does not show stale skipped dungeon node copy for corrupted pending route state', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false });
        const routeChoices = [
            {
                id: '17:1:2:safe',
                routeType: 'safe' as const,
                label: 'Safe passage',
                detail: 'Controlled path.'
            },
            {
                id: '17:1:2:greed',
                routeType: 'greed' as const,
                label: 'Greedy route',
                detail: 'Higher pressure route hook for future shop, elite, or bonus rewards.'
            }
        ];
        const revealedDungeonRun = revealDungeonChoices(baseRun.dungeonRun, 1, routeChoices);
        const greedNode = revealedDungeonRun.nodes.find((node) => node.choiceId === '17:1:2:greed');
        const safeNode = revealedDungeonRun.nodes.find((node) => node.choiceId === '17:1:2:safe');
        expect(greedNode).toBeTruthy();
        expect(safeNode).toBeTruthy();
        const selectedDungeonRun = selectDungeonNode(revealedDungeonRun, greedNode!.id);
        const corruptedDungeonRun = {
            ...selectedDungeonRun,
            selectedNodeId: safeNode!.id
        };
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            dungeonRun: corruptedDungeonRun,
            pendingRouteCardPlan: {
                choiceId: '17:1:2:safe',
                routeType: 'safe',
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
                routeChoices
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
        expect(screen.getByText(/Safe route selected: next floor adds defensive ward support/i)).toBeTruthy();
        expect(screen.queryByText(/Dungeon node armed:/i)).toBeNull();
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
        expect(screen.getByTestId('route-card-board-banner-signals')).toHaveTextContent('Payout');
        expect(screen.getByTestId('route-card-board-banner-signals')).toHaveTextContent('Gold score');
        expect(screen.getByTestId('route-card-board-banner-signals')).toHaveTextContent('Lost if destroyed');
        expect(screen.getByTestId('route-card-board-banner-signals').querySelector('[data-route-card-signal-tone="reward"]')).toHaveAttribute(
            'data-route-card-signal-beats',
            '4'
        );
        expect(screen.getByTestId('route-card-board-banner-signals').querySelector('[data-route-card-signal-tone="reward"]')).toHaveAttribute(
            'data-route-card-signal-audio',
            'route-card-reward'
        );
        expect(screen.getByTestId('route-card-board-banner-signals').querySelector('[data-route-card-signal-tone="reward"]')).toHaveAttribute(
            'data-route-card-signal-screen-cue',
            'burst'
        );
        expect(
            screen
                .getByTestId('route-card-board-banner-signals')
                .querySelector('[data-route-card-signal-tone="reward"]')
                ?.querySelectorAll('[data-route-card-signal-beat]')
        ).toHaveLength(4);
        expect(
            screen
                .getByTestId('route-card-board-banner-signals')
                .querySelector('[data-route-card-signal-tone="reward"] [data-route-card-signal-beat="1"]')
        ).toHaveAttribute('data-route-card-signal-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('route-card-board-banner-signals')
                .querySelector('[data-route-card-signal-tone="reward"] [data-route-card-signal-beat="2"]')
        ).toHaveAttribute('data-route-card-signal-beat-focus', 'support');
        expect(screen.getByTestId('route-card-board-banner-signals').querySelector('[data-route-card-signal-tone="risk"]')).toHaveAttribute(
            'data-route-card-signal-beats',
            '3'
        );
        expect(screen.getByTestId('route-card-board-banner-signals').querySelector('[data-route-card-signal-tone="risk"]')).toHaveAttribute(
            'data-route-card-signal-audio',
            'route-card-risk'
        );
        expect(screen.getByTestId('route-card-board-banner-signals').querySelector('[data-route-card-signal-tone="risk"]')).toHaveAttribute(
            'data-route-card-signal-screen-cue',
            'risk'
        );
        expect(screen.getByTestId('route-card-board-banner-signals')).toHaveAttribute(
            'aria-label',
            'Route card payoff signals. Role: Payout. Payoff: Gold score. Risk: Lost if destroyed.'
        );
    });

    it('shows payoff and cost signals while the Gambit third flip is active', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const flippedTiles = baseRun.board!.tiles.map((tile, index) =>
            index < 2 ? { ...tile, state: 'flipped' as const } : tile
        );
        const run: RunState = {
            ...baseRun,
            status: 'resolving',
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false,
            board: {
                ...baseRun.board!,
                flippedTileIds: [flippedTiles[0]!.id, flippedTiles[1]!.id],
                tiles: flippedTiles
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('gambit-opportunity-hint')).toHaveTextContent('one more flip is available');
        expect(screen.getByTestId('gambit-opportunity-signals')).toHaveTextContent('Third flip');
        expect(screen.getByTestId('gambit-opportunity-signals')).toHaveTextContent('Recover pair');
        expect(screen.getByTestId('gambit-opportunity-signals')).toHaveTextContent('No perfect');
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="window"]')).toHaveAttribute(
            'data-gambit-signal-beats',
            '2'
        );
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="window"]')).toHaveAttribute(
            'data-gambit-signal-audio',
            'gambit-window'
        );
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="window"]')).toHaveAttribute(
            'data-gambit-signal-screen-cue',
            'window'
        );
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="payoff"]')).toHaveAttribute(
            'data-gambit-signal-beats',
            '4'
        );
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="payoff"]')).toHaveAttribute(
            'data-gambit-signal-audio',
            'gambit-payoff'
        );
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="payoff"]')).toHaveAttribute(
            'data-gambit-signal-screen-cue',
            'burst'
        );
        expect(
            screen
                .getByTestId('gambit-opportunity-signals')
                .querySelector('[data-gambit-signal="payoff"]')
                ?.querySelectorAll('[data-gambit-signal-beat]')
        ).toHaveLength(4);
        expect(
            screen
                .getByTestId('gambit-opportunity-signals')
                .querySelector('[data-gambit-signal="payoff"] [data-gambit-signal-beat="1"]')
        ).toHaveAttribute('data-gambit-signal-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('gambit-opportunity-signals')
                .querySelector('[data-gambit-signal="payoff"] [data-gambit-signal-beat="2"]')
        ).toHaveAttribute('data-gambit-signal-beat-focus', 'support');
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="cost"]')).toHaveAttribute(
            'data-gambit-signal-beats',
            '3'
        );
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="cost"]')).toHaveAttribute(
            'data-gambit-signal-audio',
            'gambit-cost'
        );
        expect(screen.getByTestId('gambit-opportunity-signals').querySelector('[data-gambit-signal="cost"]')).toHaveAttribute(
            'data-gambit-signal-screen-cue',
            'risk'
        );
        expect(screen.getByTestId('gambit-opportunity-signals')).toHaveAttribute(
            'aria-label',
            'Gambit opportunity signals. Window: Third flip. Payoff: Recover pair. Cost: No perfect.'
        );
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
        expect(panel.querySelector('[data-dungeon-status-chip-tone="danger"]')).toHaveTextContent('Traps');
        expect(panel.querySelector('[data-dungeon-status-chip-tone="warning"]')).toHaveTextContent('Levers');
        expect(screen.getByTestId('dungeon-combat-log')).toHaveAccessibleName('This floor combat log');
        expect(
            screen.getByTestId('dungeon-combat-log').querySelector('[data-dungeon-combat-log-tone="danger"]')
        ).toHaveTextContent('1 patrol contact');
        expect(
            screen.getByTestId('dungeon-combat-log').querySelector('[data-dungeon-combat-log-tone="success"]')
        ).toHaveTextContent('1 patrol defeated');
        expect(screen.getByTestId('dungeon-combat-log')).toHaveTextContent('1 patrol contact');
        expect(screen.getByTestId('dungeon-combat-log')).toHaveTextContent('1 patrol defeated');
        expect(screen.getByTestId('dungeon-combat-log')).toHaveTextContent('1 hazard warded');
        expect(screen.queryByTestId('dungeon-card-board-banner')).toBeNull();
        expect(screen.getByTestId('dungeon-run-strip')).toHaveTextContent('Threshold Archive');
        expect(screen.getByTestId('dungeon-run-strip').querySelector('[data-dungeon-current-tone]')).toHaveAttribute(
            'data-dungeon-current-tone',
            'safe'
        );
        expect(
            screen.getByTestId('dungeon-run-strip').querySelector('[data-dungeon-node-status="current"]')
        ).toHaveAttribute('data-dungeon-node-tone', 'safe');
    });

    it('shows a free proceed action for terminal key-lock fallback exits', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' }));
        const exitTile: Tile = {
            id: 'exit',
            pairKey: EXIT_PAIR_KEY,
            state: 'flipped',
            symbol: '^',
            label: 'Iron Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_safe',
            dungeonExitLockKind: 'iron'
        };
        const board: BoardState = {
            ...baseRun.board!,
            tiles: [
                { ...baseRun.board!.tiles[0]!, state: 'matched' },
                { ...baseRun.board!.tiles[1]!, state: 'matched' },
                exitTile
            ],
            pairCount: 1,
            matchedPairs: 1,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron'
        };
        const run: RunState = {
            ...baseRun,
            board,
            dungeonKeys: {},
            dungeonMasterKeys: 0,
            status: 'playing'
        };
        act(() => {
            useAppStore.setState({ dungeonExitPromptOpen: true });
        });

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('dungeon-exit-overlay')).toHaveTextContent('Unlocked exit');
        expect(screen.getByRole('button', { name: 'Proceed' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Use key' })).toBeNull();
        expect(screen.queryByText(/Needs an iron key/i)).toBeNull();
    });

    it('labels pending key fallback exits as pair-clear gates instead of key shopping tasks', () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' }));
        const exitTile: Tile = {
            id: 'exit',
            pairKey: EXIT_PAIR_KEY,
            state: 'flipped',
            symbol: '^',
            label: 'Iron Exit',
            dungeonCardKind: 'exit',
            dungeonCardState: 'revealed',
            dungeonCardEffectId: 'exit_safe',
            dungeonExitLockKind: 'iron'
        };
        const board: BoardState = {
            ...baseRun.board!,
            tiles: [
                { ...baseRun.board!.tiles[0]!, id: 'a1', pairKey: 'a', state: 'hidden' },
                { ...baseRun.board!.tiles[1]!, id: 'a2', pairKey: 'a', state: 'hidden' },
                exitTile
            ],
            pairCount: 1,
            matchedPairs: 0,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron'
        };
        const run: RunState = {
            ...baseRun,
            board,
            dungeonKeys: {},
            dungeonMasterKeys: 0,
            status: 'playing'
        };
        act(() => {
            useAppStore.setState({ dungeonExitPromptOpen: true });
        });

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const overlay = screen.getByTestId('dungeon-exit-overlay');
        expect(overlay).toHaveTextContent('Key fallback pending');
        expect(overlay).toHaveTextContent('No key source remains; clear the remaining pairs to force this exit open.');
        expect(screen.queryByRole('button', { name: 'Proceed' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Use key' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Stay' })).toBeEnabled();
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
            'ExitClear pairs to open',
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
        expect(screen.getByTestId('dungeon-status-forecast')).toHaveTextContent(/No guard/i);
        expect(screen.getByTestId('dungeon-status-forecast-signals')).toHaveTextContent('Patrol hit');
        expect(screen.getByTestId('dungeon-status-forecast-signals')).toHaveTextContent('No guard');
        expect(screen.getByTestId('dungeon-status-forecast-signals')).toHaveTextContent('Play');
        expect(screen.getByTestId('dungeon-status-forecast-signals')).toHaveTextContent('Avoid contact');
        expect(screen.getByTestId('dungeon-status-forecast-action-cue')).toHaveTextContent('Now');
        expect(screen.getByTestId('dungeon-status-forecast-action-cue')).toHaveTextContent('Avoid hit');
        expect(screen.getByTestId('dungeon-status-forecast-action-cue')).toHaveAttribute(
            'data-forecast-action-tone',
            'risk'
        );
        expect(screen.getByTestId('dungeon-status-forecast-action-cue')).toHaveAttribute(
            'data-forecast-action-audio',
            'forecast-action-risk'
        );
        expect(screen.getByTestId('dungeon-status-forecast-action-cue')).toHaveAttribute(
            'data-forecast-action-beats',
            '4'
        );
        expect(screen.getByTestId('dungeon-status-forecast-action-cue')).toHaveAttribute(
            'data-forecast-action-screen-cue',
            'risk'
        );
        expect(
            screen.getByTestId('dungeon-status-forecast-action-cue').querySelectorAll('[data-forecast-action-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('dungeon-status-forecast-action-cue')).toHaveAccessibleName(
            'Dungeon forecast action cue. Now: Avoid hit.'
        );
        const forecastSignals = screen.getByTestId('dungeon-status-forecast-signals');
        expect(forecastSignals.querySelector('[data-forecast-signal-tone="risk"]')).toHaveAttribute(
            'data-forecast-signal-beats',
            '3'
        );
        expect(forecastSignals.querySelector('[data-forecast-signal-tone="risk"]')).toHaveAttribute(
            'data-forecast-signal-audio',
            'forecast-signal-risk'
        );
        expect(forecastSignals.querySelector('[data-forecast-signal-tone="risk"]')).toHaveAttribute(
            'data-forecast-signal-screen-cue',
            'risk'
        );
        expect(
            [...forecastSignals.querySelectorAll('[data-forecast-signal-tone="risk"]')].find((row) =>
                row.textContent?.includes('No guard')
            )
        ).toHaveAttribute('data-forecast-signal-beats', '4');
        expect(
            [...forecastSignals.querySelectorAll('[data-forecast-signal-tone="risk"]')].find((row) =>
                row.textContent?.includes('No guard')
            )
        ).toHaveAttribute('data-forecast-signal-audio', 'forecast-signal-risk');
        expect(
            [...forecastSignals.querySelectorAll('[data-forecast-signal-tone="action"]')].find((row) =>
                row.textContent?.includes('Avoid contact')
            )
        ).toHaveAttribute('data-forecast-signal-screen-cue', 'pulse');
        expect(
            [...forecastSignals.querySelectorAll('[data-forecast-signal-tone="action"]')].find((row) =>
                row.textContent?.includes('Avoid contact')
            )
        ).toHaveAttribute('data-forecast-signal-beats', '2');
        expect(
            [...forecastSignals.querySelectorAll('[data-forecast-signal-tone="risk"]')].find((row) =>
                row.textContent?.includes('No guard')
            )?.querySelectorAll('[data-forecast-signal-beat]')
        ).toHaveLength(4);
        expect(screen.getByTestId('dungeon-status-forecast-signals').getAttribute('aria-label')).toContain(
            'Threat: Patrol hit. Defense: No guard. Play: Avoid contact.'
        );
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
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-action', 'Arm wager');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-audio', 'risk-wager-offer');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-beats', '3');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-payoff', '+2 Favor');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-risk', 'x2 streak');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-screen-cue', 'risk');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-tone', 'offer');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveAccessibleName(
            'Wager available. Arm wager. Payoff +2 Favor. Risk x2 streak. 3 beats.'
        );
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveTextContent('Wager available');
        expect(getByTestId('endless-risk-wager-primary-cue')).toHaveTextContent('Arm wager');
        expect(getByTestId('endless-risk-wager-primary-cue').querySelectorAll('[data-risk-wager-primary-beat]')).toHaveLength(3);
        expect(
            getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-focus', 'primary');
        expect(
            getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-action', 'Arm wager');
        expect(
            getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-audio', 'risk-wager-offer');
        expect(
            getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-screen-cue', 'risk');
        expect(
            getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-tone', 'offer');
        expect(
            getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="2"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-focus', 'support');
        expect(getByTestId('endless-risk-wager-signals')).toHaveTextContent('x2 streak');
        expect(getByTestId('endless-risk-wager-signals')).toHaveTextContent('+2 Favor');
        expect(getByTestId('endless-risk-wager-signals')).toHaveTextContent('Next objective');
        expect(
            getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="risk"]')
        ).toHaveAttribute('data-risk-wager-signal-beats', '3');
        expect(
            getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="risk"]')
        ).toHaveAttribute('data-risk-wager-signal-audio', 'risk-wager-signal-risk');
        expect(
            getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="risk"]')
        ).toHaveAttribute('data-risk-wager-signal-screen-cue', 'risk');
        expect(
            getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="reward"]')
        ).toHaveAttribute('data-risk-wager-signal-audio', 'risk-wager-signal-reward');
        expect(
            getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="reward"]')
        ).toHaveAttribute('data-risk-wager-signal-screen-cue', 'burst');
        expect(
            getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="objective"]')
        ).toHaveAttribute('data-risk-wager-signal-audio', 'risk-wager-signal-objective');
        expect(
            getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="objective"]')
        ).toHaveAttribute('data-risk-wager-signal-screen-cue', 'objective');
        expect(
            getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="reward"]')
                ?.querySelectorAll('[data-risk-wager-signal-beat]')
        ).toHaveLength(4);
        expect(
            getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="reward"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-focus', 'primary');
        expect(
            getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="reward"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-audio', 'risk-wager-signal-reward');
        expect(
            getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="reward"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-screen-cue', 'burst');
        expect(
            getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="reward"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-tone', 'reward');
        expect(
            getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="reward"]')
                ?.querySelector('[data-risk-wager-signal-beat="2"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-focus', 'support');
        fireEvent.click(
            getByRole('button', {
                name: /Arm wager\. Stake: x2 streak\. Payoff: \+2 Favor\. Trigger: Next objective.*miss it and the streak breaks/i
            })
        );
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
        const lostRun: RunState = {
            ...baseRun,
            status: 'levelComplete',
            relicOffer: null,
            featuredObjectiveStreak: 1,
            lastLevelResult: {
                level: 3,
                scoreGained: 80,
                rating: 'B',
                livesRemaining: 4,
                perfect: false,
                mistakes: 1,
                clearLifeReason: 'none',
                clearLifeGained: 0,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: false,
                relicFavorGained: 0,
                featuredObjectiveStreak: 1,
                endlessRiskWagerOutcome: 'lost',
                endlessRiskWagerStreakLost: 2
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
        expect(screen.getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute(
            'data-risk-wager-primary-action',
            'Protect streak'
        );
        expect(screen.getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute(
            'data-risk-wager-primary-audio',
            'risk-wager-armed'
        );
        expect(screen.getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-beats', '4');
        expect(screen.getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute(
            'data-risk-wager-primary-screen-cue',
            'burst'
        );
        expect(screen.getByTestId('endless-risk-wager-primary-cue')).toHaveAttribute('data-risk-wager-primary-tone', 'armed');
        expect(screen.getByTestId('endless-risk-wager-primary-cue')).toHaveAccessibleName(
            'Wager armed. Protect streak. Payoff +2 Favor. Risk x2 streak. 4 beats.'
        );
        expect(screen.getByTestId('endless-risk-wager-primary-cue')).toHaveTextContent('Protect streak');
        expect(screen.getByTestId('endless-risk-wager-primary-cue').querySelectorAll('[data-risk-wager-primary-beat]')).toHaveLength(4);
        expect(
            screen.getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-action', 'Protect streak');
        expect(
            screen.getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-audio', 'risk-wager-armed');
        expect(
            screen.getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-screen-cue', 'burst');
        expect(
            screen.getByTestId('endless-risk-wager-primary-cue').querySelector('[data-risk-wager-primary-beat="1"]')
        ).toHaveAttribute('data-risk-wager-primary-beat-tone', 'armed');
        expect(screen.getByTestId('endless-risk-wager-signals')).toHaveTextContent('Armed');
        expect(screen.getByTestId('endless-risk-wager-signals')).toHaveTextContent('x2 streak');
        expect(screen.getByTestId('endless-risk-wager-signals')).toHaveTextContent('+2 Favor');
        expect(
            screen.getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="armed"]')
        ).toHaveAttribute('data-risk-wager-signal-beats', '3');
        expect(
            screen.getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="armed"]')
        ).toHaveAttribute('data-risk-wager-signal-audio', 'risk-wager-signal-armed');
        expect(
            screen.getByTestId('endless-risk-wager-signals').querySelector('[data-risk-wager-signal-tone="armed"]')
        ).toHaveAttribute('data-risk-wager-signal-screen-cue', 'armed');
        expect(
            screen
                .getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="objective"]')
                ?.querySelectorAll('[data-risk-wager-signal-beat]')
        ).toHaveLength(2);
        expect(
            screen
                .getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="armed"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-focus', 'primary');
        expect(
            screen
                .getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="armed"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-audio', 'risk-wager-signal-armed');
        expect(
            screen
                .getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="armed"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-screen-cue', 'armed');
        expect(
            screen
                .getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="armed"]')
                ?.querySelector('[data-risk-wager-signal-beat="1"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-tone', 'armed');
        expect(
            screen
                .getByTestId('endless-risk-wager-signals')
                .querySelector('[data-risk-wager-signal-tone="armed"]')
                ?.querySelector('[data-risk-wager-signal-beat="2"]')
        ).toHaveAttribute('data-risk-wager-signal-beat-focus', 'support');
        expect(screen.getByTestId('endless-risk-wager-signals')).toHaveAttribute(
            'aria-label',
            'Risk wager decision signals. Armed: x2 streak. Payoff: +2 Favor. Trigger: Next objective.'
        );

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={resolvedRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(getByText('Risk wager won: +2 Favor')).toBeTruthy();
        expect(getByText('Favor gained: +3')).toBeTruthy();
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('Wager paid');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('+2 Favor');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="reward"]')).toHaveTextContent('Objective paid');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelectorAll('[data-objective-tone="reward"]')).toHaveLength(2);
        expect(
            Array.from(screen.getByTestId('floor-clear-objective-strip').querySelectorAll('[data-objective-tone="reward"]')).every(
                (element) => element.getAttribute('data-objective-beats') === '4'
            )
        ).toBe(true);

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={lostRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('Objective missed');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('Payout lost');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('Wager lost');
        expect(screen.getByTestId('floor-clear-objective-strip')).toHaveTextContent('-2 streak');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelector('[data-objective-tone="risk"]')).toHaveTextContent('Objective missed');
        expect(screen.getByTestId('floor-clear-objective-strip').querySelectorAll('[data-objective-tone="risk"]')).toHaveLength(2);
        expect(
            Array.from(screen.getByTestId('floor-clear-objective-strip').querySelectorAll('[data-objective-tone="risk"]')).every(
                (element) => element.getAttribute('data-objective-beats') === '3'
            )
        ).toBe(true);
    });
});
