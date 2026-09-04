import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { getHudActionFeedbackProfile } from '../copy/hudActionFeedback';
import type { BoardTurnAnnouncementFacts } from '../../shared/board-turn-event-facts';
import type { BoardTurnResolvedEvent, GameplayFeedbackPresentation } from '../store/gameplayFeedbackAdapter';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { formatHudActionFeedbackText, useHudPoliteLiveAnnouncement } from './useHudPoliteLiveAnnouncement';

const base = {
    gauntletRemainingMs: null as number | null,
    gauntletActive: false,
    scoreParasiteActive: true,
    parasiteFloors: 0,
    parasiteWardRemaining: 0,
    lives: 3,
    guardTokens: 0,
    comboShards: 0,
    shopGold: 0,
    shuffleCharges: 0,
    regionShuffleCharges: 0,
    stickyBlockIndex: null as number | null,
    boardLevel: 1 as number | null,
    boardTiles: [] as Tile[],
    matchedPairs: 0,
    pairCount: 2,
    mismatches: 0,
    tileTraitMatches: {
        echo: 0,
        volatile: 0,
        mirror: 0,
        cursed: 0,
        sealed: 0,
        heavy: 0,
        drift: 0,
        conduit: 0,
        stasis: 0
    },
    tileTraitMismatches: {
        echo: 0,
        volatile: 0,
        mirror: 0,
        cursed: 0,
        sealed: 0,
        heavy: 0,
        drift: 0,
        conduit: 0,
        stasis: 0
    },
    volatileTraitShuffles: 0,
    findablesClaimedThisFloor: 0,
    objectiveProgress: 0,
    objectiveRequired: 1,
    objectiveLabel: 'Find the exit',
    recallFocus: 1,
    recallFocusMax: 3,
    recallMatchesThisFloor: 0,
    recallMistakesThisFloor: 0,
    recallBonusScoreThisFloor: 0,
    forgottenTileCountThisFloor: 0,
    chainMatchStreak: 0,
    chainAnnounceActive: false,
    gambitThirdPickActive: false,
    gambitOpportunityFlippedIds: null as readonly string[] | null,
    reduceMotion: false,
    hazardTileTriggersThisFloor: 0,
    hazardShuffleSnaresThisFloor: 0,
    hazardCascadeCachesThisFloor: 0,
    hazardMirrorDecoysThisFloor: 0,
    hazardFragileCacheClaimsThisFloor: 0,
    hazardFragileCacheBreaksThisFloor: 0,
    hazardTollCachesThisFloor: 0,
    hazardFuseCachesThisFloor: 0,
    hazardFuseCacheExpiredClaimsThisFloor: 0,
    lanternWardScoutsThisFloor: 0,
    omenSealScoutsThisFloor: 0,
    mimicCacheClaimsThisFloor: 0,
    mimicCacheBitesThisFloor: 0,
    mimicCacheGuardBitesThisFloor: 0,
    safeHazardWardsUsedThisFloor: 0,
    dungeonEnemiesDefeatedThisFloor: 0,
    enemyHazardHitsThisFloor: 0,
    enemyHazardsDefeatedThisFloor: 0
};

/**
 * A resolved match turn. Pair progress, traits, and mismatches are read off the event now,
 * so tests drive them the same way the core reports them rather than through HUD props.
 */
const matchTurn = (
    commandId: string,
    announcement: Partial<BoardTurnAnnouncementFacts> = {}
): BoardTurnResolvedEvent =>
    createBoardTurnResolvedEventFixture({
        commandId,
        announcement: { matchedPairsBefore: 0, matchedPairsAfter: 1, pairTotal: 4, ...announcement }
    }) as BoardTurnResolvedEvent;

/**
 * A resolved turn with no pair progress. The scout, cache and ward channels announce on
 * their own before/after pairs, so they are asserted without a match summary in the way.
 */
const counterTurn = (
    commandId: string,
    announcement: Partial<BoardTurnAnnouncementFacts> = {}
): BoardTurnResolvedEvent =>
    createBoardTurnResolvedEventFixture({
        commandId,
        announcement: { currentStreakBefore: 0, currentStreakAfter: 0, ...announcement }
    }) as BoardTurnResolvedEvent;

/** A resolved turn that missed. */
const mismatchTurn = (
    commandId: string,
    announcement: Partial<BoardTurnAnnouncementFacts> = {}
): BoardTurnResolvedEvent =>
    createBoardTurnResolvedEventFixture({
        commandId,
        outcome: 'mismatch',
        matchesAfter: 0,
        announcement: {
            mismatchesBefore: 0,
            mismatchesAfter: 1,
            currentStreakBefore: 0,
            currentStreakAfter: 0,
            ...announcement
        }
    }) as BoardTurnResolvedEvent;

/** No hazard kind fired; override only the one a test is about. */
const HAZARD_KINDS_QUIET = {
    shuffleSnareBefore: 0,
    shuffleSnareAfter: 0,
    cascadeCacheBefore: 0,
    cascadeCacheAfter: 0,
    mirrorDecoyBefore: 0,
    mirrorDecoyAfter: 0,
    fragileCacheClaimBefore: 0,
    fragileCacheClaimAfter: 0,
    fragileCacheBreakBefore: 0,
    fragileCacheBreakAfter: 0,
    tollCacheBefore: 0,
    tollCacheAfter: 0,
    fuseCacheBefore: 0,
    fuseCacheAfter: 0,
    fuseCacheExpiredBefore: 0,
    fuseCacheExpiredAfter: 0
} as const;

const flushRaf = async (): Promise<void> => {
    await act(async () => {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
        });
        await Promise.resolve();
    });
};

describe('useHudPoliteLiveAnnouncement', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('keeps compact visual action feedback readable for long multi-event updates', () => {
        expect(
            formatHudActionFeedbackText(
                'Shuffle Snare fired. Hidden safe tiles reordered. Cascade Cache fired. One safe hidden pair cleared. Mirror Decoy misled the mismatch. It cannot form a pair.'
            )
        ).toBe('Shuffle Snare fired. Hidden safe tiles reordered. +4 more updates.');
    });

    it('clips single long visual action feedback without changing live-region copy', () => {
        expect(
            formatHudActionFeedbackText(
                'Memory aid used with an unusually long explanation that would otherwise cover the board and compete with cards for attention.',
                { maxChars: 64 }
            )
        ).toBe('Memory aid used with an unusually long explanation that...');
    });

    it('keeps blank or punctuation-only visual action feedback empty', () => {
        expect(formatHudActionFeedbackText('   ')).toBe('');
        expect(formatHudActionFeedbackText('?!...', { maxChars: 3 })).toBe('');
    });

    it('classifies compact visual action feedback by gameplay impact', () => {
        expect(getHudActionFeedbackProfile('Shard spark claimed: +1 combo shard.')).toEqual({
            label: 'Reward burst',
            tone: 'reward'
        });
        expect(getHudActionFeedbackProfile('Echo and Stasis trait resolved.')).toEqual({
            label: 'Trait play',
            tone: 'trait'
        });
        expect(getHudActionFeedbackProfile('Trait combo surge: Drift and Stasis resolved.')).toEqual({
            label: 'Trait surge',
            tone: 'trait'
        });
        expect(getHudActionFeedbackProfile('Shop gold gained. 4 available.')).toEqual({
            label: 'Reward burst',
            tone: 'reward'
        });
        expect(getHudActionFeedbackProfile('Pickup cashout: Shard spark +1 combo shard.')).toEqual({
            label: 'Reward burst',
            tone: 'reward'
        });
        expect(
            getHudActionFeedbackProfile(
                'Trait combo surge: Echo and Stasis resolved. Combo shard gained. Payoff stack: 4 payoffs cashed. Cash stack now.'
            )
        ).toEqual({
            label: 'Payoff stack',
            tone: 'reward'
        });
        expect(getHudActionFeedbackProfile('Cashout hit: 2 payoffs paid together. Keep the chain live.')).toEqual({
            label: 'Cashout hit',
            tone: 'reward'
        });
        expect(getHudActionFeedbackProfile('Reward cashout: 2 payoffs paid together.')).toEqual({
            label: 'Reward cashout',
            tone: 'reward'
        });
        expect(getHudActionFeedbackProfile('Chain times five - keep the chain for bigger match payouts.')).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getHudActionFeedbackProfile('Surge hit: x6. Surge tier live. Next reward: Combo prime: x8 +1 shard in 2 matches.')).toEqual({
            label: 'Chain',
            tone: 'chain'
        });
        expect(getHudActionFeedbackProfile('Chain x5 broken - recover with a remembered pair.')).toEqual({
            label: 'Chain break',
            tone: 'danger'
        });
        expect(getHudActionFeedbackProfile('No match. Recover with a safe match. Chain reset.')).toEqual({
            label: 'Miss',
            tone: 'danger'
        });
        expect(getHudActionFeedbackProfile('Life lost. 1 life remains.', 'error')).toEqual({
            label: 'Critical',
            tone: 'danger'
        });
    });

    it('announces when gauntlet crosses the sixty-second bucket', async () => {
        const { result, rerender } = renderHook(
            (p: { ms: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gauntletActive: true,
                    gauntletRemainingMs: p.ms
                }),
            { initialProps: { ms: 90_000 } }
        );
        expect(result.current.message).toBe('');
        rerender({ ms: 90_000 });
        expect(result.current.message).toBe('');
        await act(async () => {
            rerender({ ms: 59_000 });
        });
        await flushRaf();
        expect(result.current.message).toBe('Gauntlet: one minute or less remaining.');
    });

    it('announces score parasite one-floor-before-drain', async () => {
        const { result, rerender } = renderHook(
            (p: { level: number; pf: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: p.level,
                    parasiteFloors: p.pf
                }),
            { initialProps: { level: 3, pf: 2 } }
        );
        await act(async () => {
            rerender({ level: 4, pf: 3 });
        });
        await flushRaf();
        expect(result.current.message).toBe(
            'Score parasite: next cleared floor triggers the drain unless warded.'
        );
    });

    it('announces score parasite life drain', async () => {
        const { result, rerender } = renderHook(
            (p: { level: number; pf: number; lives: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: p.level,
                    parasiteFloors: p.pf,
                    lives: p.lives
                }),
            { initialProps: { level: 4, pf: 3, lives: 3 } }
        );
        await act(async () => {
            rerender({ level: 5, pf: 0, lives: 2 });
        });
        await flushRaf();
        expect(result.current.message).toBe('Score parasite drained one life.');
    });

    it('announces ward absorbing parasite drain', async () => {
        const { result, rerender } = renderHook(
            (p: { level: number; pf: number; ward: number; lives: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: p.level,
                    parasiteFloors: p.pf,
                    parasiteWardRemaining: p.ward,
                    lives: p.lives
                }),
            { initialProps: { level: 4, pf: 3, ward: 1, lives: 3 } }
        );
        await act(async () => {
            rerender({ level: 5, pf: 0, ward: 0, lives: 3 });
        });
        await flushRaf();
        expect(result.current.message).toBe('Score parasite drain absorbed by ward.');
    });

    it('announces match chain milestones with arcade payoff copy while playing', async () => {
        // The streak crossing is reported by the turn event, not inferred from a remembered
        // previous render, so one resolved turn announces the milestone exactly once.
        const milestoneEvent = createBoardTurnResolvedEventFixture({
            commandId: 'chain-milestone',
            announcement: { level: 3, currentStreakBefore: 2, currentStreakAfter: 3 }
        });

        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 3,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turnEvent: milestoneEvent as BoardTurnResolvedEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Chain started: x3. Reward loop online. Next reward: Double cashout: x4 +1 shard in 1 match.'
        );

    });

    it('announces surge chain milestones with the next reward target', async () => {
        const surgeEvent = createBoardTurnResolvedEventFixture({
            commandId: 'chain-surge',
            announcement: {
                level: 3,
                currentStreakBefore: 5,
                currentStreakAfter: 6,
                comboShardsBefore: 1,
                comboShardsAfter: 1
            }
        });

        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 3,
                    comboShards: 1,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await flushRaf();

        await act(async () => {
            rerender({ turnEvent: surgeEvent as BoardTurnResolvedEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Surge hit: x6. Surge tier live. Next reward: Triple prime: x8 +1 shard in 2 matches.'
        );
    });

    it('announces when a meaningful match chain breaks', async () => {
        const breakEvent = createBoardTurnResolvedEventFixture({
            commandId: 'chain-break',
            outcome: 'mismatch',
            announcement: { level: 3, currentStreakBefore: 5, currentStreakAfter: 0 }
        });

        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 3,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turnEvent: breakEvent as BoardTurnResolvedEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe('Chain x5 broken - recover with a remembered pair.');
    });

    it('announces pickup claims with reward-specific copy', async () => {
        // Driven by the resolved-turn event rather than a tile diff: the core reports the
        // claimed findable, so the announcer no longer infers it from board snapshots.
        const pickupEvent = createBoardTurnResolvedEventFixture({
            commandId: 'pickup-turn',
            matchedFindableKind: 'shard_spark',
            announcement: { findablesClaimedBefore: 0, findablesClaimedAfter: 1 }
        });

        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turnEvent: pickupEvent as BoardTurnResolvedEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe('Shard spark claimed: +1 combo shard.');
    });

    it('announces match, objective, and resource deltas as one readable action summary', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; shards: number; progress: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    comboShards: p.shards,
                    objectiveProgress: p.progress,
                    objectiveRequired: 2,
                    objectiveLabel: 'Disarm traps'
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null, shards: 0, progress: 0 } }
        );

        await act(async () => {
            rerender({ turnEvent: matchTurn('summary-turn'), shards: 1, progress: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Disarm traps: 1/2. Combo shard gained. 1 available.'
        );
        expect(result.current.priority).toBe('info');
    });

    it('announces every event one command raised, not just the last of them', async () => {
        // A single flip can claim a findable and trip a hazard. The hook used to take the latest
        // feedback event and drop the rest, so the player heard one of the two.
        const command = 'flip-7';
        const feedback: GameplayFeedbackPresentation[] = [
            {
                audioCategory: 'reward-claim',
                commandId: command,
                cue: 'findable.claimed',
                eventId: `${command}:1`,
                message: 'Cache claimed.',
                priority: 'info',
                source: { kind: 'findable', id: 'cache' },
                tone: 'reward'
            },
            {
                audioCategory: 'hazard-banish',
                commandId: command,
                cue: 'trait.snare.tripped',
                eventId: `${command}:2`,
                message: 'Snare tripped.',
                priority: 'error',
                source: { kind: 'trait', id: 'snare' },
                tone: 'warning'
            }
        ];

        const { result, rerender } = renderHook(
            (p: { feedback: readonly GameplayFeedbackPresentation[] }) =>
                useHudPoliteLiveAnnouncement({ ...base, gameplayFeedback: p.feedback }),
            { initialProps: { feedback: [] as readonly GameplayFeedbackPresentation[] } }
        );

        await act(async () => {
            rerender({ feedback });
        });
        await flushRaf();

        expect(result.current.message).toContain('Cache claimed.');
        expect(result.current.message).toContain('Snare tripped.');
        // One error among them makes the whole line an error, so it is not announced as routine.
        expect(result.current.priority).toBe('error');
    });

    it('uses one typed reward message instead of duplicate legacy resource-gain copy', async () => {
        const feedback: GameplayFeedbackPresentation = {
            audioCategory: 'reward-claim',
            commandId: 'reward-1',
            cue: 'build.bonus_shards.claimed',
            eventId: 'reward-1:2',
            message: 'Bonus Shards added one combo shard and one guard token.',
            priority: 'info',
            source: { kind: 'bonus_reward', id: 'bonus_shards' },
            tone: 'reward'
        };
        const { result, rerender } = renderHook(
            (p: { feedback: GameplayFeedbackPresentation | null; guards: number; shards: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gameplayFeedback: p.feedback ? [p.feedback] : [],
                    guardTokens: p.guards,
                    comboShards: p.shards
                }),
            { initialProps: { feedback: null as GameplayFeedbackPresentation | null, guards: 0, shards: 0 } }
        );

        await act(async () => {
            rerender({ feedback, guards: 1, shards: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Bonus Shards added one combo shard and one guard token.');
        expect(result.current.message).not.toContain('available');
    });

    it('summarizes stacked reward cashouts in the live-region action summary', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; shards: number; guards: number; gold: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    comboShards: p.shards,
                    guardTokens: p.guards,
                    shopGold: p.gold
                }),
            {
                initialProps: {
                    turnEvent: null as BoardTurnResolvedEvent | null,
                    shards: 0,
                    guards: 0,
                    gold: 0
                }
            }
        );

        await act(async () => {
            rerender({
                turnEvent: matchTurn('cashout-turn', {
                    currentStreakBefore: 3,
                    currentStreakAfter: 4,
                    matchedTraitKinds: ['echo', 'stasis']
                }),
                shards: 1,
                guards: 1,
                gold: 2
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            '1 guard token gained. 1 available. Match resolved. 1/4 pairs cleared. Trait combo surge: Echo and Stasis resolved. Combo shard gained. 1 available. 2 shop gold gained. 2 available. Payoff stack: 4 payoffs cashed. Cash stack now.'
        );
    });

    it('announces matched tile trait effects with the resolved match', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turnEvent: matchTurn('echo-turn', { matchedTraitKinds: ['echo'] }) });
        });
        await flushRaf();

        expect(result.current.message).toBe('Match resolved. 1/4 pairs cleared. Echo trait resolved.');
    });

    it('announces trait-driven shuffle charges and stasis locks with the resolved match', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; rowCharges: number; fullCharges: number; sticky: number | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    regionShuffleCharges: p.rowCharges,
                    shuffleCharges: p.fullCharges,
                    stickyBlockIndex: p.sticky
                }),
            {
                initialProps: {
                    turnEvent: null as BoardTurnResolvedEvent | null,
                    rowCharges: 0,
                    fullCharges: 0,
                    sticky: null as number | null
                }
            }
        );

        await act(async () => {
            rerender({
                turnEvent: matchTurn('drift-turn', { matchedTraitKinds: ['drift', 'stasis'] }),
                rowCharges: 1,
                fullCharges: 1,
                sticky: 3
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Trait combo surge: Drift and Stasis resolved. 1 row/swap charge gained. 1 full shuffle charge gained. Stasis blocked a nearby trait tile from opening first next turn.'
        );
    });

    it('announces tile trait mismatch penalties and volatile shuffles', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                turnEvent: mismatchTurn('mirror-miss-turn', {
                    matchedTraitKinds: ['mirror'],
                    volatileTraitShufflesBefore: 0,
                    volatileTraitShufflesAfter: 1
                })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'No match. Recover with a safe match. Chain reset. Mirror trait penalty applied. Volatile trait shuffled hidden cards.'
        );
    });

    it('announces multi-trait mismatch penalties as a trait surge', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                turnEvent: mismatchTurn('multi-trait-miss-turn', {
                    matchedTraitKinds: ['volatile', 'mirror']
                })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'No match. Recover with a safe match. Chain reset. Trait surge: 2 penalties applied: Volatile and Mirror.'
        );
    });

    it('announces recall focus and memory score when a remembered match resolves', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; recallFocus: number; recallMatches: number; recallBonus: number; forgotten?: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    recallFocus: p.recallFocus,
                    recallMatchesThisFloor: p.recallMatches,
                    recallBonusScoreThisFloor: p.recallBonus,
                    forgottenTileCountThisFloor: p.forgotten ?? 0
                }),
            {
                initialProps: {
                    turnEvent: null as BoardTurnResolvedEvent | null,
                    recallFocus: 1,
                    recallMatches: 0,
                    recallBonus: 0
                }
            }
        );

        await act(async () => {
            rerender({ turnEvent: matchTurn('recall-turn'), recallFocus: 2, recallMatches: 1, recallBonus: 8 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 2/3; +8 memory score.'
        );
    });

    it('announces normalized recall focus when stale run data exceeds the cap', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; recallFocus: number; recallMatches: number; recallBonus: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    recallFocus: p.recallFocus,
                    recallMatchesThisFloor: p.recallMatches,
                    recallBonusScoreThisFloor: p.recallBonus
                }),
            {
                initialProps: {
                    turnEvent: null as BoardTurnResolvedEvent | null,
                    recallFocus: 99,
                    recallMatches: 0,
                    recallBonus: 0
                }
            }
        );

        await act(async () => {
            rerender({ turnEvent: matchTurn('recall-cap-turn'), recallFocus: 99, recallMatches: 1, recallBonus: 8 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 3/3; +8 memory score.'
        );
    });

    it('announces normalized recall focus when stale run data has malformed caps', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; recallFocus: number; recallFocusMax: number; recallMatches: number; recallBonus: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    recallFocus: p.recallFocus,
                    recallFocusMax: p.recallFocusMax,
                    recallMatchesThisFloor: p.recallMatches,
                    recallBonusScoreThisFloor: p.recallBonus
                }),
            {
                initialProps: {
                    turnEvent: null as BoardTurnResolvedEvent | null,
                    recallFocus: Number.NaN,
                    recallFocusMax: Number.POSITIVE_INFINITY,
                    recallMatches: 0,
                    recallBonus: 0
                }
            }
        );

        await act(async () => {
            rerender({
                turnEvent: matchTurn('recall-malformed-turn'),
                recallFocus: 2.9,
                recallFocusMax: Number.POSITIVE_INFINITY,
                recallMatches: 1,
                recallBonus: 8
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 2/3; +8 memory score.'
        );
    });

    it('announces when a later match stabilizes forgotten tile memory', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; recallFocus: number; recallMatches: number; recallBonus: number; forgotten: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    recallFocus: p.recallFocus,
                    recallMatchesThisFloor: p.recallMatches,
                    recallBonusScoreThisFloor: p.recallBonus,
                    forgottenTileCountThisFloor: p.forgotten
                }),
            {
                initialProps: {
                    turnEvent: null as BoardTurnResolvedEvent | null,
                    recallFocus: 0,
                    recallMatches: 0,
                    recallBonus: 0,
                    forgotten: 2
                }
            }
        );

        await act(async () => {
            rerender({
                turnEvent: matchTurn('recall-stabilize-turn'),
                recallFocus: 1,
                recallMatches: 1,
                recallBonus: 0,
                forgotten: 1
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 1/3. 1 unstable tile memory stabilized.'
        );
    });

    it('announces recall breakage when a miss marks remembered tiles unstable', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; recallFocus: number; recallMistakes: number; forgotten: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    recallFocus: p.recallFocus,
                    recallMistakesThisFloor: p.recallMistakes,
                    forgottenTileCountThisFloor: p.forgotten
                }),
            {
                initialProps: {
                    turnEvent: null as BoardTurnResolvedEvent | null,
                    recallFocus: 1,
                    recallMistakes: 0,
                    forgotten: 0
                }
            }
        );

        await act(async () => {
            rerender({
                turnEvent: mismatchTurn('recall-break-turn'),
                recallFocus: 0,
                recallMistakes: 1,
                forgotten: 2
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'No match. Recover with a safe match. Chain reset. Recall broken. 2 tile memories are unstable.'
        );
    });

    it('announces life loss before generic mismatch feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { lives: number; turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    lives: p.lives,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { lives: 3, turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ lives: 2, turnEvent: mismatchTurn('life-loss-turn', { livesBefore: 3, livesAfter: 2 }) });
        });
        await flushRaf();

        expect(result.current.message).toBe('Life lost. 2 lives remain.');
        expect(result.current.priority).toBe('error');
    });

    it('announces guard-token mismatch absorption', async () => {
        const { result, rerender } = renderHook(
            (p: { guards: number; turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    guardTokens: p.guards,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { guards: 1, turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                guards: 0,
                turnEvent: mismatchTurn('guard-absorb-turn', { guardTokensBefore: 1, guardTokensAfter: 0 })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe('Guard token spent. 0 guard tokens remain.');
    });

    it('announces moving enemy contact alongside damage feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { lives: number; hits: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    lives: p.lives,
                    enemyHazardHitsThisFloor: p.hits
                }),
            { initialProps: { lives: 3, hits: 0 } }
        );

        await act(async () => {
            rerender({ lives: 2, hits: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe('Life lost. 2 lives remain. Moving enemy contact.');
        expect(result.current.priority).toBe('error');
    });

    it('announces moving enemy defeats with match feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; defeated: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    enemyHazardsDefeatedThisFloor: p.defeated
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null, defeated: 0 } }
        );

        await act(async () => {
            rerender({ turnEvent: matchTurn('enemy-defeat-turn'), defeated: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Moving enemy defeated. 1 cleared this floor.'
        );
    });

    it('announces dungeon enemy card defeats with match feedback', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null; defeated: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turnEvent,
                    dungeonEnemiesDefeatedThisFloor: p.defeated
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null, defeated: 0 } }
        );

        await act(async () => {
            rerender({ turnEvent: matchTurn('dungeon-defeat-turn'), defeated: 1 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Dungeon enemy defeated. 1 defeated this floor.'
        );
    });

    it('announces recovery and resource spending deltas', async () => {
        const { result, rerender } = renderHook(
            (p: { lives: number; guards: number; shards: number; gold: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    lives: p.lives,
                    guardTokens: p.guards,
                    comboShards: p.shards,
                    shopGold: p.gold
                }),
            { initialProps: { lives: 2, guards: 0, shards: 3, gold: 8 } }
        );

        await act(async () => {
            rerender({ lives: 3, guards: 1, shards: 1, gold: 5 });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Life restored. 3 lives available. 2 combo shards spent. 1 available. 3 shop gold spent. 5 available.'
        );
    });

    it('announces guard token gains when no higher-priority health delta is present', async () => {
        const { result, rerender } = renderHook(
            (p: { guards: number }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    guardTokens: p.guards
                }),
            { initialProps: { guards: 0 } }
        );

        await act(async () => {
            rerender({ guards: 2 });
        });
        await flushRaf();

        expect(result.current.message).toBe('2 guard tokens gained. 2 available.');
    });

    it('announces hazard tile trigger deltas in a stable order', async () => {
        // Every hazard kind reports its own before/after pair on the turn event, so a
        // turn that trips several announces all of them in HAZARD_TILE_KINDS order.
        const hazardEvent = createBoardTurnResolvedEventFixture({
            commandId: 'hazard-sweep',
            announcement: {
                hazardTilesBefore: 0,
                hazardTilesAfter: 7,
                hazardKinds: {
                    shuffleSnareBefore: 0,
                    shuffleSnareAfter: 1,
                    cascadeCacheBefore: 0,
                    cascadeCacheAfter: 1,
                    mirrorDecoyBefore: 0,
                    mirrorDecoyAfter: 1,
                    fragileCacheClaimBefore: 0,
                    fragileCacheClaimAfter: 1,
                    fragileCacheBreakBefore: 0,
                    fragileCacheBreakAfter: 1,
                    tollCacheBefore: 0,
                    tollCacheAfter: 1,
                    fuseCacheBefore: 0,
                    fuseCacheAfter: 1,
                    fuseCacheExpiredBefore: 0,
                    fuseCacheExpiredAfter: 0
                }
            }
        }) as BoardTurnResolvedEvent;

        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turnEvent: hazardEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Shuffle Snare fired. Hidden safe tiles reordered. Cascade Cache fired. One safe hidden pair cleared. Mirror Decoy misled the mismatch. It cannot form a pair. Fragile Cache claimed. Bonus score added. Fragile Cache broke. Its bonus is gone, but the pair still matches. Toll Cache claimed. Shop gold gained; score toll paid. Fuse Cache claimed early. Full payout gained.'
        );
    });

    it('announces late Fuse Cache claims with expired-fuse copy', async () => {
        const fuseEvent = createBoardTurnResolvedEventFixture({
            commandId: 'fuse-late',
            announcement: {
                hazardTilesBefore: 0,
                hazardTilesAfter: 1,
                hazardKinds: {
                    ...HAZARD_KINDS_QUIET,
                    fuseCacheAfter: 1,
                    fuseCacheExpiredAfter: 1
                }
            }
        }) as BoardTurnResolvedEvent;

        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turnEvent: fuseEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe('Fuse Cache claimed late. Fuse expired; consolation gold gained.');
    });

    it('uses reduced-motion copy for hazard tile trigger announcements', async () => {
        const snareEvent = createBoardTurnResolvedEventFixture({
            commandId: 'snare-reduced-motion',
            announcement: {
                hazardTilesBefore: 0,
                hazardTilesAfter: 1,
                hazardKinds: { ...HAZARD_KINDS_QUIET, shuffleSnareAfter: 1 }
            }
        }) as BoardTurnResolvedEvent;

        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    reduceMotion: true,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turnEvent: snareEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Shuffle Snare fired. Hidden safe tiles reordered without motion.'
        );
    });

    it('announces lantern ward scout deltas', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                turnEvent: counterTurn('lantern-scout', { scoutsBefore: 0, scoutsAfter: 1 })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe('Lantern Ward scouted a hidden threat.');
    });

    it('announces omen seal scout deltas', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                turnEvent: counterTurn('omen-scout', { omenScoutsBefore: 0, omenScoutsAfter: 1 })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe('Omen Seal revealed hidden danger.');
    });

    it('announces controlled mimic cache claims', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                turnEvent: counterTurn('mimic-claim', { mimicCacheBefore: 0, mimicCacheAfter: 1 })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe('Mimic Cache controlled. Full loot claimed.');
    });

    it('announces mimic cache guard bites before generic life bites', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                turnEvent: counterTurn('mimic-guard-bite', {
                    mimicCacheBefore: 0,
                    mimicCacheAfter: 1,
                    mimicCacheBitesBefore: 0,
                    mimicCacheBitesAfter: 1,
                    mimicCacheGuardBitesBefore: 0,
                    mimicCacheGuardBitesAfter: 1
                })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe('Mimic Cache bit. Guard absorbed the hit.');
    });

    it('announces Guard Cache ward blocks', async () => {
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({
                turnEvent: counterTurn('ward-block', {
                    safeHazardWardsUsedBefore: 0,
                    safeHazardWardsUsedAfter: 1
                })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe('Guard Cache ward blocked a hazard.');
    });

    it('stays silent when a turn fires no hazard tile', async () => {
        // The counters this used to watch were per-floor totals, so a floor that started
        // with a hazard already recorded announced it again on the first render. Keyed on
        // the event's own before/after pair, a turn with no hazard says nothing.
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    scoreParasiteActive: false,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await flushRaf();
        expect(result.current.message).toBe('');

        await act(async () => {
            rerender({
                turnEvent: counterTurn('quiet-turn', { hazardTilesBefore: 4, hazardTilesAfter: 4 })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe('');
    });

    it('dedupes announcements with the same key in one rAF flush', async () => {
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );

        await act(async () => {
            result.current.queuePoliteAnnouncement('a', { dedupeKey: 'k', priority: 'info' });
            result.current.queuePoliteAnnouncement('b', { dedupeKey: 'k', priority: 'info' });
        });
        await flushRaf();

        expect(result.current.message).toBe('b');
    });

    it('prefers higher priority when dedupe key matches', async () => {
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );

        await act(async () => {
            result.current.queuePoliteAnnouncement('info-text', { dedupeKey: 'x', priority: 'info' });
            result.current.queuePoliteAnnouncement('error-text', { dedupeKey: 'x', priority: 'error' });
        });
        await flushRaf();

        expect(result.current.message).toBe('error-text');
    });

    it('does not downgrade priority when a lower priority shares a dedupe key', async () => {
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );

        await act(async () => {
            result.current.queuePoliteAnnouncement('error-text', { dedupeKey: 'x', priority: 'error' });
            result.current.queuePoliteAnnouncement('info-text', { dedupeKey: 'x', priority: 'info' });
        });
        await flushRaf();

        expect(result.current.message).toBe('error-text');
    });

    it('drops an older queued live-region publish when a newer delivery overtakes it', async () => {
        const pendingFrames: FrameRequestCallback[] = [];
        const pendingMicrotasks: VoidFunction[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
            pendingFrames.push(callback);
            return pendingFrames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
            pendingMicrotasks.push(callback);
        });
        vi.spyOn(performance, 'now').mockReturnValue(1000);
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );
        pendingMicrotasks.length = 0;
        const flushNextFrame = async (time: number): Promise<void> => {
            const callback = pendingFrames.shift();
            expect(callback).toBeDefined();
            vi.mocked(performance.now).mockReturnValue(time);
            await act(async () => {
                callback?.(time);
                await Promise.resolve();
            });
        };

        act(() => {
            result.current.queuePoliteAnnouncement('first', { dedupeKey: 'first' });
        });
        await flushNextFrame(1000);
        expect(result.current.message).toBe('');
        const stalePublishes = pendingMicrotasks.splice(0);
        expect(stalePublishes.length).toBeGreaterThan(0);

        act(() => {
            result.current.queuePoliteAnnouncement('second', { dedupeKey: 'second' });
        });
        await flushNextFrame(1500);
        expect(result.current.message).toBe('');
        const freshPublishes = pendingMicrotasks.splice(0);
        expect(freshPublishes.length).toBeGreaterThan(0);

        await act(async () => {
            for (const publish of stalePublishes) {
                publish();
                await Promise.resolve();
            }
        });
        expect(result.current.message).toBe('');

        await act(async () => {
            for (const publish of freshPublishes) {
                publish();
                await Promise.resolve();
            }
        });
        expect(result.current.message).toBe('second');
    });

    it('throttles a second delivery when the first delivery timestamp is zero', async () => {
        const pendingFrames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
            pendingFrames.push(callback);
            return pendingFrames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const { result, unmount } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardLevel: null
            })
        );
        const flushNextFrame = async (): Promise<void> => {
            const callback = pendingFrames.shift();
            expect(callback).toBeDefined();
            await act(async () => {
                callback?.(0);
                await Promise.resolve();
            });
        };

        act(() => {
            result.current.queuePoliteAnnouncement('first', { dedupeKey: 'a' });
        });
        await flushNextFrame();
        expect(result.current.message).toBe('first');

        act(() => {
            result.current.queuePoliteAnnouncement('second', { dedupeKey: 'b' });
        });
        await flushNextFrame();

        expect(result.current.message).toBe('first');
        unmount();
    });

    it(
        'throttles rapid successive deliveries (min gap between live-region updates)',
        async () => {
            const { result } = renderHook(() =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: null
                })
            );

            await act(async () => {
                result.current.queuePoliteAnnouncement('first', { dedupeKey: 'a' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                result.current.queuePoliteAnnouncement('second', { dedupeKey: 'b' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                await new Promise<void>((r) => setTimeout(r, 420));
            });
            expect(result.current.message).toBe('second');
        },
        10_000
    );

    it(
        'keeps a pending critical announcement when a lower-priority update arrives during throttle',
        async () => {
            const { result } = renderHook(() =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: null
                })
            );

            await act(async () => {
                result.current.queuePoliteAnnouncement('first', { dedupeKey: 'a', priority: 'info' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                result.current.queuePoliteAnnouncement('critical hit', { dedupeKey: 'b', priority: 'error' });
            });
            await flushRaf();
            expect(result.current.message).toBe('first');

            await act(async () => {
                result.current.queuePoliteAnnouncement('minor update', { dedupeKey: 'c', priority: 'info' });
            });
            await flushRaf();

            await act(async () => {
                await new Promise<void>((r) => setTimeout(r, 420));
            });
            expect(result.current.message).toBe('critical hit');
            expect(result.current.priority).toBe('error');
        },
        10_000
    );

    it('announces Gambit third-flip opportunity when the window opens', async () => {
        const { result, rerender } = renderHook(
            (p: { active: boolean; ids: readonly string[] | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    scoreParasiteActive: false,
                    gambitThirdPickActive: p.active,
                    gambitOpportunityFlippedIds: p.ids
                }),
            { initialProps: { active: false, ids: null as readonly string[] | null } }
        );
        await act(async () => {
            rerender({ active: true, ids: ['tile-a', 'tile-b'] });
        });
        await flushRaf();
        expect(result.current.message).toBe(GAMBIT_OPPORTUNITY_HINT_LINE);
    });
});
