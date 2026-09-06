import { NotificationHost, useNotificationStore } from '@cross-repo-libs/notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardState, RunState, Tile } from '../../shared/contracts';
import { EXIT_PAIR_KEY } from '../../shared/dungeon-rules';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
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

const gameSfxMocks = vi.hoisted(() => ({
    playMismatchRecoveryCrescendoSfx: vi.fn(),
    playPowerArmSfx: vi.fn(),
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

const viewportSizeMock = vi.hoisted(() => ({
    height: 800,
    width: 1280
}));

const gameLeftToolbarMock = vi.hoisted(() => ({
    props: null as { rulesHintsExpanded?: boolean } | null
}));

vi.mock('./MainMenuBackground', () => ({ default: () => null }));
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
    useViewportSize: () => viewportSizeMock
}));
vi.mock('../hooks/useDistractionChannelTick', () => ({
    useDistractionChannelTick: () => 0
}));
vi.mock('../hooks/useHudPoliteLiveAnnouncement', () => ({
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
        gameLeftToolbarMock.props = null;
        viewportSizeMock.height = 800;
        viewportSizeMock.width = 1280;
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

    it('docks a greet control that answers a press, and refuses a second hello on the same floor', async () => {
        // A verb that exists in the rules and in the store but is not on the board is a verb the
        // player does not have. Press the real button and read what the store came back with.
        const run: RunState = {
            ...createNewRun(0, { runSeed: 4_242 }),
            status: 'playing',
            floorCurioId: 'off_duty_guard',
            floorCurioGreeted: false
        };
        act(() => {
            useAppStore.setState({ run, view: 'playing' });
        });
        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const greet = screen.getByTestId('tool-greet');
        expect(greet).toBeEnabled();

        act(() => {
            fireEvent.click(greet);
        });

        const greeted = useAppStore.getState().run!;
        expect(greeted.floorCurioGreeted).toBe(true);
        expect(greeted.stats.guardTokens).toBe(run.stats.guardTokens + 1);
        expect(
            (greeted.gameplayEventJournal as { type: string }[]).some(
                (event) => event.type === 'board.curio_greeted'
            )
        ).toBe(true);

        act(() => {
            fireEvent.click(greet);
        });
        expect(useAppStore.getState().run!.stats.guardTokens).toBe(run.stats.guardTokens + 1);
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

    it('shows the floor score and the four stats on the floor-cleared dialog', () => {
        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={{ ...levelCompleteRunFixture(), lives: 3 }} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const dialog = screen.getByRole('dialog', { name: /floor cleared/i });
        expect(dialog).toHaveTextContent('Floor 1');
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+120');
        const stats = screen.getByTestId('floor-clear-stats');
        expect(stats).toHaveTextContent(/Rating\s*S/);
        expect(stats).toHaveTextContent(/Best streak\s*2/);
        expect(stats).toHaveTextContent(/Misses\s*0/);
        expect(stats).toHaveTextContent(/Lives\s*5/);
        // The coaching strips are gone: the dialog states the result and the route choice only.
        expect(dialog).not.toHaveTextContent(/Lives carry across the run|payoff stack|Carry forward|Next floor loop/i);
        expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
    });

    it('normalizes malformed floor-clear counters before rendering overlay copy', () => {
        const fixture = levelCompleteRunFixture();
        const malformed: RunState = {
            ...fixture,
            findablesClaimedThisFloor: Number.POSITIVE_INFINITY,
            findablesTotalThisFloor: Number.NaN,
            relicFavorProgress: Number.NaN,
            stats: {
                ...fixture.stats,
                bestStreak: Number.NaN,
                comboShards: Number.POSITIVE_INFINITY,
                totalScore: Number.POSITIVE_INFINITY
            },
            lastLevelResult: {
                ...fixture.lastLevelResult!,
                level: Number.POSITIVE_INFINITY,
                scoreGained: Number.NaN,
                mistakes: Number.POSITIVE_INFINITY,
                livesRemaining: Number.POSITIVE_INFINITY,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                objectiveBonusScore: Number.POSITIVE_INFINITY,
                featuredObjectiveStreak: Number.NaN,
                featuredObjectiveStreakBonus: Number.POSITIVE_INFINITY,
                relicFavorGained: Number.NaN,
                endlessRiskWagerOutcome: 'lost',
                endlessRiskWagerStreakLost: Number.POSITIVE_INFINITY,
                traitRouteObjectiveRequired: Number.POSITIVE_INFINITY,
                traitRouteObjectiveProgress: Number.NaN
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={malformed} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByRole('dialog', { name: /floor cleared/i })).toHaveTextContent('Floor 0');
        expect(screen.getByTestId('floor-clear-result-stack')).not.toHaveTextContent(/NaN|Infinity/);
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+0');
        expect(screen.getByTestId('floor-clear-stats')).toHaveTextContent(/Misses\s*0/);
        expect(screen.getByTestId('floor-clear-notes')).toHaveTextContent('Flip par: Complete');
        expect(screen.getByTestId('floor-clear-notes')).toHaveTextContent('Risk wager lost: -0 streak');
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
        // The toast now projects the resolved-turn event rather than diffing board tiles,
        // so the claim is expressed as a journalled event.
        const claimEvent = createBoardTurnResolvedEventFixture({
            commandId: 'pickup-claim',
            matchedFindableKind: 'shard_spark',
            findablesClaimedBefore: 0,
            findablesClaimedAfter: 1,
            findablesTotalBefore: 2,
            findablesTotalAfter: 2,
            announcement: {
                comboShardsAfter: 1,
                currentStreakAfter: 3,
                livesAfter: 4,
                findablesClaimedBefore: 0,
                findablesClaimedAfter: 1,
                findablesTotalBefore: 2,
                findablesTotalAfter: 2
            }
        });
        const claimedRun = {
            ...initialRun,
            findablesClaimedThisFloor: 1,
            gameplayEventJournal: [claimEvent],
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
                .notifications.find((notification) => notification.stackKey === `pickup:${claimEvent.eventId}`);
            expect(pickupToast?.message).toBe(
                'Stack prime: Shard spark +1 combo shard. Double cashout: x4 +1 shard in 1 match. Pickups 1/2.'
            );
        });
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

    it('states a match once: signal, amount, and the one reason worth naming', async () => {
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
                        pickupRewardText: 'Pickup: shard cache',
                        payoffChips: [
                            { arcadeCue: 'Score pop', id: 'score', label: 'Score', value: '+25', tone: 'score' },
                            { arcadeCue: 'Prime cashout', id: 'streak', label: 'Streak', value: 'x4', tone: 'chain' }
                        ],
                        tileIdA: 'a',
                        tileIdB: 'b',
                        key: 'test-floater-one-beat'
                    }
                });
            });

            const floater = screen.getByTestId('match-score-floater');
            expect(floater.querySelector('[data-floater-signal="chain"]')).toHaveTextContent('Chain');
            expect(screen.getByTestId('match-score-floater-amount')).toHaveTextContent('+25');
            expect(screen.getByTestId('board-floater-reason')).toHaveTextContent('Pickup: shard cache');
            expect(floater).toHaveAttribute('data-match-floater-heat', 'prime');
            // The forecast, ladder, lane-map, chip and crescendo layers restated this and are gone.
            for (const gone of [
                'match-score-floater-reward-forecast',
                'match-score-floater-payoff-chips',
                'match-score-floater-payoff-ladder',
                'match-score-floater-payoff-lane-map',
                'match-score-floater-chain-milestone',
                'match-score-floater-crescendo',
                'match-score-floater-jackpot'
            ]) {
                expect(screen.queryByTestId(gone)).toBeNull();
            }
            // Three text parts, not thirty-six.
            expect(
                [...floater.querySelectorAll('*')].filter(
                    (node) => node.children.length === 0 && (node.textContent ?? '').trim().length > 0
                ).length
            ).toBeLessThanOrEqual(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it('falls back to the chain cue when a match has no reward line to name', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));

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
                    feedbackHeadline: 'Surge',
                    feedbackIntensity: 'high',
                    feedbackSignal: { label: 'Chain', tone: 'chain' },
                    impactCue: { label: 'Prime chain', tone: 'chain' },
                    tileIdA: 'a',
                    tileIdB: 'b',
                    key: 'test-floater-chain-cue'
                }
            });
        });

        expect(screen.getByTestId('match-score-floater-amount')).toHaveTextContent('+55');
        expect(screen.getByTestId('match-score-floater')).toHaveAttribute('data-feedback-intensity', 'high');
        expect(screen.getByTestId('match-score-floater')).not.toHaveTextContent(/NaN|undefined/);
    });

    it('survives malformed floater array payloads without inventing rows', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
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
                    chainDepth: 4,
                    feedbackHeadline: 'Reward',
                    feedbackIntensity: 'high',
                    feedbackSignal: { label: 'Route', tone: 'route' },
                    impactCue: { label: 'Stack cashout', tone: 'reward' },
                    payoffSummary: { label: 'Stack cashout', value: '2 payoffs: Route + Pickup', tier: 'reward' },
                    payoffLaneMap: { length: 2 } as never,
                    payoffChips: { length: 3 } as never,
                    chainRewardForecastCues: { length: 1 } as never,
                    traitInteractionTexts: { length: 2 } as never,
                    tileIdA: 'a',
                    tileIdB: 'b',
                    key: 'malformed-match-floater-arrays'
                }
            });
        });

        const floater = screen.getByTestId('match-score-floater');
        expect(floater).toHaveTextContent('Route');
        expect(floater).toHaveAttribute('data-match-floater-heat', 'stack');
        expect(floater).not.toHaveTextContent(/NaN|undefined|\[object/);
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

    it('marks plain chain-break misses as a break with one recovery line', () => {
        vi.useFakeTimers();
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
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
            expect(floater.querySelector('[data-floater-signal="break"]')).toHaveTextContent('Break');
            expect(screen.getByTestId('board-floater-reason')).toHaveTextContent('Recover - safe match');
            expect(screen.queryByTestId('mismatch-score-floater-recovery-chips')).toBeNull();
            expect(screen.queryByTestId('mismatch-score-floater-recovery-lane-map')).toBeNull();
            expect(screen.queryByTestId('mismatch-score-floater-next-action')).toBeNull();
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
        // Each card carries one archetype chip; the full archetype line lives in the accessible name.
        expect(screen.getAllByText(/^The (Warden|Saboteur|Slayer|Vaultbreaker|Gambit|Conduit Cartographer|Emergency Toolkit|Catalyst)$/).length).toBeGreaterThan(0);
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

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+120');
        expect(screen.getByTestId('floor-clear-stats')).toHaveTextContent(/Rating\s*S\+\+/);
        const notes = screen.getByTestId('floor-clear-notes');
        expect(notes).toHaveTextContent('Perfect floor bonus: +1 Life');
        expect(notes).toHaveTextContent('Flip par: Complete (+30 score)');
        expect(notes).toHaveTextContent('+1 Favor');
        // Route choice is the one decision on the screen: three doors, no Continue until one is picked.
        expect(screen.getByTestId('route-choice-panel')).toHaveAttribute('data-decision-state', 'required');
        expect(screen.getByTestId('route-choice-safe')).toBeEnabled();
        expect(screen.getByTestId('route-choice-greed')).toBeEnabled();
        expect(screen.getByTestId('route-choice-mystery')).toBeEnabled();
        expect(screen.queryByRole('button', { name: /^continue$/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /visit shop/i })).toBeNull();
        expect(screen.queryByTestId('floor-clear-payoff-stack')).toBeNull();
        expect(screen.queryByTestId('floor-clear-momentum-strip')).toBeNull();
    });

    it('ignores malformed route choice payloads in the floor-clear result', () => {
        const baseRun = levelCompleteRunFixture();
        const run: RunState = {
            ...baseRun,
            lastLevelResult: {
                ...baseRun.lastLevelResult!,
                routeChoices: { length: 3 } as never
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('floor-clear-result-stack')).toHaveAttribute('data-route-choice-required', 'false');
        expect(screen.queryByTestId('route-choice-panel')).toBeNull();
        expect(screen.getByRole('button', { name: /^Continue$/i })).toBeTruthy();
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
        expect(screen.getByTestId('route-selected-note')).toHaveAttribute('data-route-type', 'greed');
        expect(screen.getByTestId('route-selected-note')).toHaveTextContent(
            'Greedy route selected. The next floor adds richer caches and extra reward-risk pressure.'
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
        expect(screen.getByTestId('route-selected-note')).toHaveTextContent('Safe route selected. The next floor adds defensive ward support.');
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

        // The hint already says it: one line, no restatement in three pip blocks beside it.
        const hint = screen.getByTestId('gambit-opportunity-hint');
        expect(hint).toHaveTextContent('one more flip is available');
        expect(hint).toHaveTextContent('locks Perfect Memory');
        expect(screen.queryByTestId('gambit-opportunity-signals')).toBeNull();
        expect(hint.querySelectorAll('*')).toHaveLength(0);
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

        expect(getByTestId('endless-risk-wager-panel')).toHaveAttribute('data-armed', 'false');
        expect(getByTestId('endless-risk-wager-panel')).toHaveTextContent(
            'Stake your x2 objective streak on the next floor for +2 Favor.'
        );
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

        const { rerender } = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={armedRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('endless-risk-wager-panel')).toHaveAttribute('data-armed', 'true');
        expect(screen.getByTestId('endless-risk-wager-panel')).toHaveTextContent(
            'Risk wager armed. The next objective pays +2 Favor; a miss breaks the x2 streak.'
        );
        expect(screen.queryByRole('button', { name: /arm wager/i })).toBeNull();

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={resolvedRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('floor-clear-notes')).toHaveTextContent('Risk wager won: +2 Favor');
        expect(screen.getByTestId('floor-clear-notes')).toHaveTextContent('+3 Favor');

        rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={lostRun} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('floor-clear-notes')).toHaveTextContent('Flip par: Missed');
        expect(screen.getByTestId('floor-clear-notes')).toHaveTextContent('Risk wager lost: -2 streak');
    });
});
