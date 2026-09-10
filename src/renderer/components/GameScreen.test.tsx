import { NotificationHost, useNotificationStore } from '@cross-repo-libs/notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { createDefaultSaveData } from '../../shared/save-data';
import { GAMBIT_KEYBOARD_HELP_TIP } from '../copy/gameplayHints';
import { PlatformTiltProvider } from '../platformTilt/PlatformTiltProvider';
import { useAppStore } from '../store/useAppStore';
import GameScreen, { FLOOR_CLEAR_BEAT_MS, LAST_PAIR_HOLD_MS } from './GameScreen';
import {
    getStackCashoutLaneCount,
    getVisualHudAnnouncementFollowup,
    getVisualHudAnnouncementImpact,
    getVisualHudAnnouncementSignal
} from './gameScreenFeedback';
import { BOARD_FLOATER_POP_CLEAR } from '../store/matchScorePop';

const gameSfxMocks = vi.hoisted(() => ({
    playMismatchRecoveryCrescendoSfx: vi.fn(),
    playPowerArmSfx: vi.fn(),
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
    claimedFindableKind: null as 'score_glint' | null,
    message: '',
    priority: 'info' as 'info' | 'error',
    queuePoliteAnnouncement: vi.fn(),
    formatHudActionFeedbackText: (text: string) => text.length > 48 ? `${text.slice(0, 45)}...` : text,
    getFindableToastText: vi.fn((kind: string) => (kind === 'score_glint' ? 'Score glint +25 score' : `${kind} reward`))
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
            perfect: true,
            mistakes: 0
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
                peekModeArmed: false,
                ...BOARD_FLOATER_POP_CLEAR
            });
        });
    });

    it('holds the board for a breath when the last pair resolves, then shows the floor-clear beat, then goes on by itself', () => {
        // The finish should be louder than anything before it. That needs a beat between the pair
        // resolving and the plate — but only on that transition, never on a screen that opens
        // already complete, or every resumed save would pay the wait for nothing. And then no
        // screen: the next floor is asked for on its own once the beat has been read.
        vi.useFakeTimers();
        const continueSpy = vi.spyOn(useAppStore.getState(), 'continueToNextLevel');
        try {
            const cleared = levelCompleteRunFixture();
            const playing: RunState = { ...cleared, status: 'playing', lastLevelResult: null };
            const { rerender } = render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={playing} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );
            rerender(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={cleared} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );
            expect(screen.queryByTestId('floor-clear-beat')).not.toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(LAST_PAIR_HOLD_MS + 10);
            });
            expect(screen.getByTestId('floor-clear-beat')).toBeInTheDocument();
            expect(screen.queryByRole('dialog', { name: /floor cleared/i })).not.toBeInTheDocument();
            expect(continueSpy).not.toHaveBeenCalled();

            act(() => {
                vi.advanceTimersByTime(FLOOR_CLEAR_BEAT_MS + 10);
            });
            expect(continueSpy).toHaveBeenCalledTimes(1);
        } finally {
            continueSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it('shows the beat at once on a screen that opens already complete, and still goes on by itself', () => {
        vi.useFakeTimers();
        const continueSpy = vi.spyOn(useAppStore.getState(), 'continueToNextLevel');
        try {
            render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={levelCompleteRunFixture()} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );
            expect(screen.getByTestId('floor-clear-beat')).toBeInTheDocument();
            act(() => {
                vi.advanceTimersByTime(FLOOR_CLEAR_BEAT_MS + 10);
            });
            expect(continueSpy).toHaveBeenCalledTimes(1);
        } finally {
            continueSpy.mockRestore();
            vi.useRealTimers();
        }
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
        // The guard's peek is his arrival gift; the greeting is the warning alone (Gen 183).
        expect(greeted.peekCharges).toBe(run.peekCharges);
        expect(
            (greeted.gameplayEventJournal as { type: string }[]).some(
                (event) => event.type === 'board.curio_greeted'
            )
        ).toBe(true);

        act(() => {
            fireEvent.click(greet);
        });
        const greetings = (useAppStore.getState().run!.gameplayEventJournal as { type: string }[]).filter(
            (event) => event.type === 'board.curio_greeted'
        );
        expect(greetings).toHaveLength(1);
    });

    it('defers achievement toasts while the floor-clear beat is up, then emits after leaving levelComplete', () => {
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

    it('says the floor, the score and the way it went on the beat, with nothing to press and the board still live', () => {
        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={levelCompleteRunFixture()} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        const beat = screen.getByTestId('floor-clear-beat');
        expect(beat).toHaveAttribute('role', 'status');
        expect(screen.getByTestId('floor-clear-title')).toHaveTextContent('Floor 1 cleared');
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+120');
        expect(beat).toHaveTextContent('Run total 120');
        // No screen between floors: no dialog, no Continue, no Main Menu, and the board underneath is not inert.
        expect(screen.queryByRole('dialog', { name: /floor cleared/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /^continue$/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /^main menu$/i })).toBeNull();
        expect(screen.getByTestId('board-stage').closest('[inert]')).toBeNull();
        expect(beat).not.toHaveTextContent(/payoff stack|Carry forward|Next floor loop/i);
        // No lives (Gen 183): the beat has no life bonus to note and never mentions one.
        expect(beat).not.toHaveTextContent(/\blives?\b/i);
    });

    it('normalizes malformed floor-clear counters before rendering overlay copy', () => {
        const fixture = levelCompleteRunFixture();
        const malformed: RunState = {
            ...fixture,
            findablesClaimedThisFloor: Number.POSITIVE_INFINITY,
            findablesTotalThisFloor: Number.NaN,
            stats: {
                ...fixture.stats,
                bestStreak: Number.NaN,
                totalScore: Number.POSITIVE_INFINITY
            },
            lastLevelResult: {
                ...fixture.lastLevelResult!,
                level: Number.POSITIVE_INFINITY,
                scoreGained: Number.NaN,
                mistakes: Number.POSITIVE_INFINITY,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                objectiveBonusScore: Number.POSITIVE_INFINITY,
                featuredObjectiveStreak: Number.NaN,
                featuredObjectiveStreakBonus: Number.POSITIVE_INFINITY
            }
        };

        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={malformed} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('floor-clear-title')).toHaveTextContent('Floor 0 cleared');
        expect(screen.getByTestId('floor-clear-beat')).not.toHaveTextContent(/NaN|Infinity/);
        expect(screen.getByTestId('floor-clear-score')).toHaveTextContent('+0');
        expect(screen.getByTestId('floor-clear-notes')).toHaveTextContent('Flip par: Complete');
    });

    it('pulses the stage with the break tier for one beat after a chunk breaks, then lets it go', () => {
        // The shatter is a projection of the turn event, not a diff of boards: the stage reads the
        // stamped tier and pairs from the latest resolved turn, holds the pulse for BREAK_PULSE_MS,
        // and drops it, so a board that re-renders for any other reason never pulses twice.
        vi.useFakeTimers();
        try {
            const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
            const breakEvent = createBoardTurnResolvedEventFixture({
                commandId: 'chunk-break',
                announcement: {
                    chunkPairsBrokenBefore: 0,
                    chunkPairsBrokenAfter: 3,
                    chainAfter: 5,
                    chainTierAfter: 'fever'
                }
            });
            const broken = {
                ...baseRun,
                chunkBreaksThisFloor: 1,
                chunkPairsBrokenThisFloor: 3,
                chunkPairsThisChain: 3,
                gameplayEventJournal: [breakEvent]
            } as RunState;
            const { rerender } = render(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={baseRun} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-break-pulse', 'none');
            rerender(
                <PlatformTiltProvider>
                    <NotificationHost>
                        <GameScreen achievements={[]} run={broken} />
                    </NotificationHost>
                </PlatformTiltProvider>
            );
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-break-pulse', 'fever');
            // Fever is held past the ordinary beat: the hit-stop, while the slowed wave plays out.
            act(() => {
                vi.advanceTimersByTime(800);
            });
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-break-pulse', 'fever');
            act(() => {
                vi.advanceTimersByTime(400);
            });
            expect(screen.getByTestId('board-stage')).toHaveAttribute('data-break-pulse', 'none');
        } finally {
            vi.useRealTimers();
        }
    });

    it('adds chain reward stack context to pickup reward toasts', async () => {
        const baseRun = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const initialRun = {
            ...baseRun,
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 2,
            stats: {
                ...baseRun.stats,
                currentStreak: 3
            }
        } as RunState;
        // The toast now projects the resolved-turn event rather than diffing board tiles,
        // so the claim is expressed as a journalled event.
        const claimEvent = createBoardTurnResolvedEventFixture({
            commandId: 'pickup-claim',
            matchedFindableKind: 'score_glint',
            findablesClaimedBefore: 0,
            findablesClaimedAfter: 1,
            findablesTotalBefore: 2,
            findablesTotalAfter: 2,
            announcement: {
                currentStreakAfter: 3,
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

        hudAnnouncementMock.claimedFindableKind = 'score_glint';
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
            expect(pickupToast?.message).toBe('Score glint +25 score. Pickups 1/2.');
        });
    });

    it('classifies visible action feedback into arcade signal chips', () => {
        expect(getVisualHudAnnouncementSignal('Chain times five - keep the chain.', 'info')).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getVisualHudAnnouncementSignal('Surge hit: x6. Surge tier live.', 'info')).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getVisualHudAnnouncementSignal('Chain x5 broken - recover with a remembered pair.', 'info')).toEqual({
            label: 'Risk',
            tone: 'risk'
        });
        expect(getVisualHudAnnouncementSignal('Score glint claimed: +25 score.', 'info')).toEqual({
            label: 'Reward',
            tone: 'reward'
        });
        expect(getVisualHudAnnouncementSignal('Pickup cashout: Score glint +25 score.', 'info')).toEqual({
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
        expect(getVisualHudAnnouncementSignal('Echo and Stasis trait resolved.', 'info')).toEqual({
            label: 'Trait',
            tone: 'trait'
        });
        expect(getVisualHudAnnouncementSignal('Perk pop: Echo Conduit Lens doubles the route.', 'info')).toEqual({
            label: 'Trait',
            tone: 'trait'
        });
    });

    it('summarizes visible action feedback into compact impact chips', () => {
        expect(getStackCashoutLaneCount(['Chain x5', 'Pickup', 'Route paid'])).toBe(3);
        expect(getStackCashoutLaneCount(['Chain x3', 'Streak live'])).toBe(1);
        expect(getStackCashoutLaneCount(['Chain x4', 'Pickup cashout', 'Route paid'])).toBe(3);
        expect(getStackCashoutLaneCount(['Route cashout', 'Trait cashout', 'Perk pop', 'Chain x6'])).toBe(3);
        expect(
            getVisualHudAnnouncementImpact(
                'Chain times five - Score glint claimed: +25 score. Trait routes: 2/2 complete.',
                'info'
            )
        ).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Chain x5', tone: 'chain' },
                { label: 'Pickup', tone: 'reward' },
                { label: 'Route paid', tone: 'trait' }
            ],
            level: 'high'
        });
        expect(getVisualHudAnnouncementImpact('No match.', 'error')).toEqual({
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
                'Trait penalty. No match. Next action: Recover route: prime with tools. Heavy: extra try. Recover - prime with tools',
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
        expect(getVisualHudAnnouncementImpact('Pickup cashout: Score glint +25 score.', 'info')).toEqual({
            burstTier: 'reward',
            details: [
                { label: 'Pickup cashout', tone: 'reward' },
                { label: 'Pickup', tone: 'reward' }
            ],
            level: 'medium'
        });
        // Gen 201: the +Gold chip went with the gold. Gold left in Gen 174 with the shop it bought
        // from, so the chip could only ever have fired on an announcement nothing can produce.
        expect(getVisualHudAnnouncementImpact('Route cashout: +25 score.', 'info')).toEqual({
            burstTier: 'reward',
            details: [{ label: 'Route cashout', tone: 'reward' }],
            level: 'low'
        });
        expect(getVisualHudAnnouncementImpact('Perk pop: Echo Conduit Lens doubles the route.', 'info')).toEqual({
            burstTier: 'trait',
            details: [{ label: 'Perk pop', tone: 'trait' }],
            level: 'low'
        });
        expect(getVisualHudAnnouncementImpact('Trait cashout: Conduit + Echo: peek spark.', 'info')).toEqual({
            burstTier: 'trait',
            details: [
                { label: 'Trait cashout', tone: 'trait' }
            ],
            level: 'low'
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
        expect(getVisualHudAnnouncementImpact('Trait combo surge: Conduit and Stasis resolved.', 'info')).toEqual({
            burstTier: 'trait',
            details: [{ label: 'Trait surge', tone: 'trait' }],
            level: 'medium'
        });
        expect(getVisualHudAnnouncementImpact('Cascade: chain cascade.', 'info')).toEqual({
            burstTier: 'chain',
            details: [{ label: 'Chain cascade', tone: 'chain' }],
            level: 'low'
        });
        expect(getVisualHudAnnouncementImpact('Cascade: combo cascade. Score glint +25 score.', 'info')).toEqual({
            burstTier: 'combo',
            details: [
                { label: 'Combo cascade', tone: 'chain' },
                { label: 'Reward cascade', tone: 'reward' }
            ],
            level: 'medium'
        });
        /*
         * Gen 201 removed a Cascade Cache row and a Shuffle Snare row from here. Both were hazards,
         * both left with the hazard layer in Gen 176, and the chips they asserted were the last
         * thing holding those branches in the projector.
         */
    });

    it('keeps the line after a miss quiet: a reset and a suggestion, nothing about what it cost', () => {
        // Thesis §67: a bad floor is unremarkable. Whatever the miss carried, the follow-up never
        // names a life, a loss or a penalty.
        const followup = (announcement: string): string | null =>
            getVisualHudAnnouncementFollowup({ announcement, priority: 'error', runStatus: 'playing', remainingPairCount: 3 });
        expect(followup('No match. Recover with a safe match. Chain reset.')).toBe('Next: cards reset; pick a remembered pair.');
        expect(followup('No match. Chain x4 broken.')).toBe('Next: rebuild from a confirmed pair before chasing rewards.');
        for (const announcement of [
            'No match. Recover with a safe match. Chain reset.',
            'No match. Chain x4 broken.',
            'Mimic Cache bit. Reduced loot claimed.'
        ]) {
            expect(followup(announcement)).not.toMatch(/\b(life|lives|lost|penalty|punish)\b/i);
        }
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Something unnamed went wrong.',
                priority: 'error',
                runStatus: 'playing',
                remainingPairCount: 3
            })
        ).toBe('Next: cards reset; pick a remembered pair.');
    });

    it('adds next-step lines for chain and reward feedback rail messages', () => {
        /*
         * Gen 201: the Guard Cache row went with the branch it was testing. Nothing in the game has
         * said "Guard Cache ward blocked" since Gen 176, so the assertion proved only that a dead
         * branch was still there - which is how the branch survived five years of removals.
         */
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Chain x5 broken - recover with a remembered pair.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: rebuild from a confirmed pair before chasing rewards.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Pickup cashout: Score glint +25 score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: pickup reward applied; keep the streak alive with a confirmed pair.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Route cashout: +25 score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: route value is banked; chase the safest chainable payoff.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Trait cashout: Conduit + Echo peek spark.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: trait payoff landed; look for the next connected trait card.');
    });




    it('adds next-step lines for pickups, chains, and Gambit feedback', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Score glint claimed: +25 score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: pickup reward applied; keep clearing confirmed pairs.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Chain times three - consecutive matches boost your score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
            })
        ).toBe('Next: preserve the streak with the best safe match.');
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Gambit window open: take the third flip for a chance at bonus score.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
            })
        ).toBe('Next: take the third flip only if the wager is worth it.');
    });

    it('adds next-step lines for trait route objective feedback', () => {
        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Trait route prime found. Use swap: Swap Conduit with Filler: Conduit: adjacent trait charge.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: use Swap on the marked cards to create the route.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Trait routes: 1/2.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: line up another trait interaction before the floor ends.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 2/4 pairs cleared. Trait routes: 2/2 complete.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 2,
            })
        ).toBe('Next: route cashout banked; spend it when the board gets risky.');
    });

    it('prioritizes reward and trait next-step copy over generic match progress', () => {

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Echo trait resolved.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: trait payoff landed; look for the next chainable interaction.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Perk pop: Echo Conduit Lens doubles the route.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: perk payoff landed; route the next trait or chain cashout.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Cursed trait penalty applied.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: trait penalty landed; rebuild from a confirmed pair.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'No match. Recover with a safe match. Chain reset. Trait surge: 2 penalties applied: Heavy and Stasis.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: multiple trait penalties landed; use the safest confirmed pair before touching that cluster again.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Combo. Plus 80 points. 3 match streak, 3 matches to x6. Cascade: combo cascade. Combo burst: 3-way payoff. Trait surge: 2 interactions.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: combo burst landed; cash the safest remaining payoff before the chain cools.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Reward. Plus 125 points. Cascade: reward cascade. Reward burst: 2-way payoff.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: reward burst landed; keep the payoff loop alive with a safe match.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Surge. Plus 80 points. Trait surge: 2 interactions.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
            })
        ).toBe('Next: trait surge landed; look for the next multi-trait route.');

        expect(
            getVisualHudAnnouncementFollowup({
                announcement: 'Match resolved. 1/4 pairs cleared. Trait combo surge: Conduit and Stasis resolved.',
                priority: 'info',
                runStatus: 'playing',
                remainingPairCount: 3,
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
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));

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
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
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

    it('marks plain chain-break misses as a break with one recovery line', () => {
        vi.useFakeTimers();
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
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
        const base = createNewRun(0, { echoFeedbackEnabled: false });
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
        const base = createNewRun(0, { echoFeedbackEnabled: false });
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

    it('does not call pause when KeyP is pressed during the floor-clear beat (levelComplete + lastLevelResult)', () => {
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
            ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false })),
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

    /*
     * Which run this is, and whether it can still earn perfect memory, used to sit on the bar.
     * The bar is numbers now; a player asks these by pausing, and the answer has to be here.
     */
    const pausedRun = (overrides: Partial<RunState> = {}, options: { practiceMode?: boolean } = {}): RunState => ({
        ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, ...options })),
        status: 'paused',
        timerState: {
            memorizeRemainingMs: null,
            resolveRemainingMs: null,
            debugRevealRemainingMs: null,
            pausedFromStatus: 'playing'
        },
        ...overrides
    });

    const renderPaused = (run: RunState): ReturnType<typeof render> =>
        render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={run} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

    it('names the run in the pause menu, so a Practice run is not mistaken for a Classic one', () => {
        const { unmount } = renderPaused(pausedRun());
        expect(screen.getByTestId('pause-run-identity')).toHaveTextContent(/^Classic Dungeon$/);
        expect(screen.getByTestId('game-hud')).not.toHaveTextContent(/Classic Dungeon/);
        unmount();

        renderPaused(pausedRun({}, { practiceMode: true }));
        expect(screen.getByTestId('pause-run-identity')).toHaveTextContent('Practice — Achievements off');
    });

    it('says in the pause menu whether the run can still earn perfect memory, and only while that is live stakes', () => {
        const { unmount } = renderPaused(pausedRun());
        expect(screen.getByTestId('pause-perfect-memory')).toHaveTextContent(/Eligible/);
        expect(screen.getByTestId('pause-perfect-memory')).toHaveAttribute('data-state', 'eligible');
        unmount();

        const { unmount: unmountLocked } = renderPaused(pausedRun({ powersUsedThisRun: true }));
        expect(screen.getByTestId('pause-perfect-memory')).toHaveTextContent(/Locked/);
        expect(screen.getByTestId('pause-perfect-memory')).toHaveAttribute('data-state', 'locked');
        unmountLocked();

        // Achievements off: nothing to lose, so nothing to say.
        renderPaused(pausedRun({}, { practiceMode: true }));
        expect(screen.queryByTestId('pause-perfect-memory')).not.toBeInTheDocument();
    });

    it('shows featured objective result and next-floor preview on endless floor clear', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false });
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            featuredObjectiveStreak: 2,
            recallFocus: 2,
            recallMistakesThisFloor: 1,
            forgottenTileIdsThisFloor: [baseRun.board!.tiles[1].id],
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
                perfect: true,
                mistakes: 0,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true,
                featuredObjectiveStreak: 2,
                featuredObjectiveStreakBonus: 10,
                objectiveBonusScore: 30,
                bonusTags: ['flip_par', 'objective_streak']
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
        const notes = screen.getByTestId('floor-clear-notes');
        expect(notes).toHaveTextContent('Flip par: Complete (+30 score)');
        expect(notes).not.toHaveTextContent(/life/i);
        // No route is offered between floors any more (Gen 173), and no screen at all since
        // Gen 182: the beat sits on the board and the floor clear goes straight on.
        expect(screen.queryByTestId('route-choice-panel')).toBeNull();
        expect(screen.queryByRole('dialog', { name: /floor cleared/i })).toBeNull();
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

    it('offers a double tap out of the study period, and only while it is running', () => {
        const memorizing = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        expect(memorizing.status).toBe('memorize');

        const view = render(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={memorizing} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.getByTestId('memorize-skip-layer')).toBeInTheDocument();

        view.rerender(
            <PlatformTiltProvider>
                <NotificationHost>
                    <GameScreen achievements={[]} run={finishMemorizePhase(memorizing)} />
                </NotificationHost>
            </PlatformTiltProvider>
        );

        expect(screen.queryByTestId('memorize-skip-layer')).toBeNull();
    });
});
