import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { GAMBIT_OPPORTUNITY_HINT_LINE } from '../copy/gameplayHints';
import { getHudActionFeedbackProfile } from '../copy/hudActionFeedback';
import type {
    BoardTurnResolvedEvent,
    GameplayFeedbackPresentation
} from '../store/gameplayFeedbackAdapter';
import { formatHudActionFeedbackText, useHudPoliteLiveAnnouncement } from './useHudPoliteLiveAnnouncement';

const base = {
    gauntletRemainingMs: null as number | null,
    gauntletActive: false,
    boardLevel: 1 as number | null,
    gambitThirdPickActive: false,
    gambitOpportunityFlippedIds: null as readonly string[] | null,
    reduceMotion: false
};

const pickupTurnEvent = (eventId: string): BoardTurnResolvedEvent =>
    createBoardTurnResolvedEventFixture({
        commandId: eventId.split(':')[0] ?? eventId,
        eventId,
        boardLevel: 2,
        matchedPairKey: 'A',
        matchedFindableKind: 'shard_spark',
        findablesClaimedAfter: 1,
        findablesTotalBefore: 2,
        findablesTotalAfter: 2,
        totalScoreAfter: 25,
        comboShardsAfter: 1
    });

const typedFeedback = (
    eventId: string,
    message: string,
    overrides: Partial<GameplayFeedbackPresentation> = {}
): GameplayFeedbackPresentation => ({
    audioCategory: 'floor-advance',
    commandId: eventId.split(':')[0] ?? eventId,
    cue: 'floor.advance.ready',
    eventId,
    message,
    priority: 'info',
    source: { kind: 'system', id: 'floor_advance' },
    tone: 'information',
    ...overrides
});

const flushRaf = async (): Promise<void> => {
    await act(async () => {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
        });
        await Promise.resolve();
    });
};

const announceBoardTurn = async (
    turn: BoardTurnResolvedEvent,
    feedback: GameplayFeedbackPresentation | null = null,
    inputOverrides: Partial<typeof base> = {}
) => {
    const { result, rerender } = renderHook(
        (props: {
            turn: BoardTurnResolvedEvent | null;
            feedback: GameplayFeedbackPresentation | null;
        }) =>
            useHudPoliteLiveAnnouncement({
                ...base,
                ...inputOverrides,
                boardLevel: turn.boardLevel,
                boardTurnEvent: props.turn,
                gameplayFeedbackBatch: props.feedback ? [props.feedback] : []
            }),
        {
            initialProps: {
                turn: null as BoardTurnResolvedEvent | null,
                feedback: null as GameplayFeedbackPresentation | null
            }
        }
    );

    await act(async () => {
        rerender({ turn, feedback });
    });
    await flushRaf();
    return result.current;
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

    it('announces every typed consequence from a compound command in journal order', async () => {
        const batch = [
            typedFeedback(
                'floor-advance:1',
                'Score Parasite: next cleared floor triggers the drain unless warded.',
                {
                    audioCategory: 'parasite',
                    cue: 'hazard.score_parasite.drain_warning',
                    priority: 'error',
                    source: { kind: 'system', id: 'score_parasite' },
                    tone: 'warning'
                }
            ),
            typedFeedback('floor-advance:3', 'Hazard Banish cleared Fuse Cache pressure.', {
                audioCategory: 'hazard-banish',
                cue: 'perk.hazard_banish.hazard_removed',
                source: { kind: 'reward_perk', id: 'hazard_banish_per_floor' },
                tone: 'reward'
            }),
            typedFeedback('floor-advance:5', 'Floor 5 is ready to memorize (8 pairs).')
        ];
        const { result, rerender } = renderHook(
            (feedbackBatch: readonly GameplayFeedbackPresentation[]) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gameplayFeedbackBatch: feedbackBatch
                }),
            { initialProps: [] as readonly GameplayFeedbackPresentation[] }
        );

        await act(async () => {
            rerender(batch);
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Score Parasite: next cleared floor triggers the drain unless warded. Hazard Banish cleared Fuse Cache pressure. Floor 5 is ready to memorize (8 pairs).'
        );
        expect(result.current.priority).toBe('error');
    });

    it('does not announce a persisted typed feedback batch on first render', async () => {
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                gameplayFeedbackBatch: [typedFeedback('persisted:2', 'Historical floor feedback.')]
            })
        );

        await flushRaf();
        expect(result.current.message).toBe('');
    });

    it('announces match chain milestones from the resolved turn event', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 3,
            currentStreakBefore: 2,
            currentStreakAfter: 3
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Chain started: x3. Reward loop online. Next reward: Double cashout: x4 +1 shard in 1 match.'
        );
    });

    it('announces surge chain milestones with the event-owned reward target', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 3,
            currentStreakBefore: 5,
            currentStreakAfter: 6,
            comboShardsBefore: 1,
            comboShardsAfter: 1
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Surge hit: x6. Surge tier live. Next reward: Triple prime: x8 +1 shard in 2 matches.'
        );
    });

    it('announces a meaningful chain break from the mismatch event', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 3,
            outcome: 'mismatch',
            matchedPairKey: null,
            matchesAfter: 0,
            mismatchesAfter: 1,
            currentStreakBefore: 5,
            currentStreakAfter: 0,
            announcement: { matchedPairsAfter: 0 }
        }));

        expect(result.message).toBe(
            'No match. Recover with a safe match. Chain reset. Chain x5 broken - recover with a remembered pair.'
        );
    });

    it('announces pickup claims with reward-specific copy', async () => {
        const { result, rerender } = renderHook(
            (p: { turn: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardLevel: 2,
                    boardTurnEvent: p.turn
                }),
            { initialProps: { turn: null as BoardTurnResolvedEvent | null } }
        );

        await act(async () => {
            rerender({ turn: pickupTurnEvent('pickup-turn:0') });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Shard spark claimed: +1 combo shard. Match resolved. 1/2 pairs cleared.'
        );
    });

    it('announces match, objective, and resource deltas as one readable action summary', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            comboShardsAfter: 1,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                objectiveBefore: { label: 'Disarm traps', progress: 0, required: 2 },
                objectiveAfter: { label: 'Disarm traps', progress: 1, required: 2 }
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Disarm traps: 1/2. Combo shard gained. 1 available.'
        );
        expect(result.priority).toBe('info');
    });

    it('uses one authoritative typed reward message', async () => {
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
            (p: { feedback: GameplayFeedbackPresentation | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gameplayFeedbackBatch: p.feedback ? [p.feedback] : []
                }),
            { initialProps: { feedback: null as GameplayFeedbackPresentation | null } }
        );

        await act(async () => {
            rerender({ feedback });
        });
        await flushRaf();

        expect(result.current.message).toBe('Bonus Shards added one combo shard and one guard token.');
        expect(result.current.message).not.toContain('available');
    });

    it('uses exact typed shop feedback', async () => {
        const feedback: GameplayFeedbackPresentation = {
            audioCategory: 'shop-purchase',
            commandId: 'shop-1',
            cue: 'shop.master_key.purchased',
            eventId: 'shop-1:1',
            message: 'Master Key purchased for 4 shop gold; 3 remains.',
            priority: 'info',
            source: { kind: 'shop', id: 'run_shop' },
            tone: 'reward'
        };
        const { result, rerender } = renderHook(
            (props: { feedback: GameplayFeedbackPresentation | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gameplayFeedbackBatch: props.feedback ? [props.feedback] : []
                }),
            { initialProps: { feedback: null as GameplayFeedbackPresentation | null } }
        );

        await act(async () => {
            rerender({ feedback });
        });
        await flushRaf();

        expect(result.current.message).toBe('Master Key purchased for 4 shop gold; 3 remains.');
        expect(result.current.message).not.toContain('Shop gold spent');
    });

    it('uses exact typed enemy-contact feedback', async () => {
        const feedback: GameplayFeedbackPresentation = {
            audioCategory: 'match-resolution',
            commandId: 'contact-1',
            cue: 'hazard.enemy_contact.life_lost',
            eventId: 'contact-1:1',
            message: 'Warden struck for 1 life; 2 remain.',
            priority: 'error',
            source: { kind: 'system', id: 'enemy_hazard_contact' },
            tone: 'warning'
        };
        const { result, rerender } = renderHook(
            (props: { feedback: GameplayFeedbackPresentation | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gameplayFeedbackBatch: props.feedback ? [props.feedback] : []
                }),
            {
                initialProps: {
                    feedback: null as GameplayFeedbackPresentation | null
                }
            }
        );

        await act(async () => {
            rerender({ feedback });
        });
        await flushRaf();

        expect(result.current.message).toBe('Warden struck for 1 life; 2 remain.');
        expect(result.current.message).not.toContain('Moving enemy contact');
        expect(result.current.priority).toBe('error');
    });

    it('uses complete typed power feedback', async () => {
        const feedback: GameplayFeedbackPresentation = {
            audioCategory: 'peek',
            commandId: 'peek-1',
            cue: 'power.peek.used',
            eventId: 'peek-1:2',
            message: 'Peek revealed echo-a; 1 charge remains. Recall focus 0/3; 1 tile memory is unstable.',
            priority: 'info',
            source: { kind: 'power', id: 'peek' },
            tone: 'information'
        };
        const { result, rerender } = renderHook(
            (props: { feedback: GameplayFeedbackPresentation | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gameplayFeedbackBatch: props.feedback ? [props.feedback] : []
                }),
            {
                initialProps: {
                    feedback: null as GameplayFeedbackPresentation | null
                }
            }
        );

        await act(async () => {
            rerender({ feedback });
        });
        await flushRaf();

        expect(result.current.message).toBe(feedback.message);
        expect(result.current.message.match(/Recall focus/g)).toHaveLength(1);
    });

    it('summarizes stacked reward cashouts in the live-region action summary', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            currentStreakAfter: 4,
            comboShardsAfter: 1,
            guardTokensAfter: 1,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                shopGoldAfter: 2,
                matchedTraitKinds: ['echo', 'stasis']
            }
        }));

        expect(result.message).toBe(
            '1 guard token gained. 1 available. Match resolved. 1/4 pairs cleared. Trait combo surge: Echo and Stasis resolved. Chain started: x3. Reward loop online. Next reward: Combo prime: x6 +1 shard in 2 matches. Combo shard gained. 1 available. 2 shop gold gained. 2 available. Payoff stack: 4 payoffs cashed. Cash stack now.'
        );
    });

    it('announces matched tile trait effects with the resolved match', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                matchedTraitKinds: ['echo']
            }
        }));

        expect(result.message).toBe('Match resolved. 1/4 pairs cleared. Echo trait resolved.');
    });

    it('announces trait-driven shuffle charges and stasis locks with the resolved match', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                matchedTraitKinds: ['drift', 'stasis'],
                regionShuffleChargesAfter: 1,
                shuffleChargesAfter: 1,
                stickyBlockIndexAfter: 3
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Trait combo surge: Drift and Stasis resolved. 1 row/swap charge gained. 1 full shuffle charge gained. Stasis blocked a nearby trait tile from opening first next turn.'
        );
    });

    it('announces tile trait mismatch penalties and volatile shuffles', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            outcome: 'mismatch',
            matchedPairKey: null,
            matchesAfter: 0,
            mismatchesAfter: 1,
            currentStreakAfter: 0,
            announcement: {
                matchedPairsAfter: 0,
                mismatchedTraitKinds: ['mirror'],
                volatileTraitShufflesAfter: 1
            }
        }));

        expect(result.message).toBe(
            'No match. Recover with a safe match. Chain reset. Mirror trait penalty applied. Volatile trait shuffled hidden cards.'
        );
    });

    it('announces multi-trait mismatch penalties as a trait surge', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            outcome: 'mismatch',
            matchedPairKey: null,
            matchesAfter: 0,
            mismatchesAfter: 1,
            currentStreakAfter: 0,
            announcement: {
                matchedPairsAfter: 0,
                mismatchedTraitKinds: ['volatile', 'mirror']
            }
        }));

        expect(result.message).toBe(
            'No match. Recover with a safe match. Chain reset. Trait surge: 2 penalties applied: Volatile and Mirror.'
        );
    });

    it('announces recall focus and memory score when a remembered match resolves', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                recallFocusBefore: 1,
                recallFocusAfter: 2,
                recallMatchesAfter: 1,
                recallBonusScoreAfter: 8
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 2/3; +8 memory score.'
        );
    });

    it('announces the core-normalized maximum recall focus from the event', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                recallFocusBefore: 3,
                recallFocusAfter: 3,
                recallMatchesAfter: 1,
                recallBonusScoreAfter: 8
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 3/3; +8 memory score.'
        );
    });

    it('announces integer recall facts from the schema-validated event', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                recallFocusBefore: 1,
                recallFocusAfter: 2,
                recallMatchesAfter: 1,
                recallBonusScoreAfter: 8
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 2/3; +8 memory score.'
        );
    });

    it('announces when a later match stabilizes forgotten tile memory', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                recallFocusBefore: 0,
                recallFocusAfter: 1,
                recallMatchesAfter: 1,
                forgottenTileCountBefore: 2,
                forgottenTileCountAfter: 1
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Recall focus 1/3. 1 unstable tile memory stabilized.'
        );
    });

    it('announces recall breakage when a miss marks remembered tiles unstable', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            outcome: 'mismatch',
            matchedPairKey: null,
            matchesAfter: 0,
            mismatchesAfter: 1,
            currentStreakAfter: 0,
            announcement: {
                matchedPairsAfter: 0,
                recallFocusBefore: 1,
                recallFocusAfter: 0,
                recallMistakesAfter: 1,
                forgottenTileCountAfter: 2
            }
        }));

        expect(result.message).toBe(
            'No match. Recover with a safe match. Chain reset. Recall broken. 2 tile memories are unstable.'
        );
    });

    it('announces life loss before generic mismatch feedback', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            outcome: 'mismatch',
            matchedPairKey: null,
            matchesAfter: 0,
            mismatchesAfter: 1,
            currentStreakAfter: 0,
            livesAfter: 2,
            announcement: { matchedPairsAfter: 0 }
        }));

        expect(result.message).toBe('Life lost. 2 lives remain.');
        expect(result.priority).toBe('error');
    });

    it('announces guard-token mismatch absorption', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            outcome: 'mismatch',
            matchedPairKey: null,
            matchesAfter: 0,
            mismatchesAfter: 1,
            currentStreakAfter: 0,
            guardTokensBefore: 1,
            announcement: { matchedPairsAfter: 0 }
        }));

        expect(result.message).toBe('Guard token spent. 0 guard tokens remain.');
    });

    it('announces moving enemy defeats with match feedback', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                enemyHazardsDefeatedAfter: 1
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Moving enemy defeated. 1 cleared this floor.'
        );
    });

    it('announces dungeon enemy card defeats with match feedback', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            boardLevel: 2,
            announcement: {
                matchedPairsAfter: 1,
                pairCountBefore: 4,
                pairCountAfter: 4,
                dungeonEnemiesDefeatedAfter: 1
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/4 pairs cleared. Dungeon enemy defeated. 1 defeated this floor.'
        );
    });

    it('announces typed hazard tile consequences in a stable order', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            announcement: {
                hazardTilesAfter: {
                    totalTriggers: 7,
                    shuffleSnares: 1,
                    cascadeCaches: 1,
                    mirrorDecoys: 1,
                    fragileCacheClaims: 1,
                    fragileCacheBreaks: 1,
                    tollCaches: 1,
                    fuseCaches: 1
                }
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Shuffle Snare fired. Hidden safe tiles reordered. Cascade Cache fired. One safe hidden pair cleared. Mirror Decoy misled the mismatch. It cannot form a pair. Fragile Cache claimed. Bonus score added. Fragile Cache broke. Its bonus is gone, but the pair still matches. Toll Cache claimed. Shop gold gained; score toll paid. Fuse Cache claimed early. Full payout gained.'
        );
    });

    it('announces late Fuse Cache claims with expired-fuse copy', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            announcement: {
                hazardTilesAfter: {
                    totalTriggers: 1,
                    fuseCaches: 1,
                    fuseExpiredClaims: 1
                }
            }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Fuse Cache claimed late. Fuse expired; consolation gold gained.'
        );
    });

    it('uses reduced-motion copy for hazard tile trigger announcements', async () => {
        const result = await announceBoardTurn(
            createBoardTurnResolvedEventFixture({
                announcement: {
                    hazardTilesAfter: { totalTriggers: 1, shuffleSnares: 1 }
                }
            }),
            null,
            { reduceMotion: true }
        );

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Shuffle Snare fired. Hidden safe tiles reordered without motion.'
        );
    });

    it('announces both typed scout consequences from one turn', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            announcement: { scoutsAfter: { lanternWard: 1, omenSeal: 1 } }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Lantern Ward scouted a hidden threat. Omen Seal revealed hidden danger.'
        );
    });

    it('announces controlled mimic cache claims', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            announcement: { mimicCacheAfter: { claims: 1 } }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Mimic Cache controlled. Full loot claimed.'
        );
    });

    it('announces mimic cache guard bites before generic life bites', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            announcement: { mimicCacheAfter: { claims: 1, bites: 1, guardBites: 1 } }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Mimic Cache bit. Guard absorbed the hit.'
        );
        expect(result.priority).toBe('error');
    });

    it('announces Guard Cache ward blocks', async () => {
        const result = await announceBoardTurn(createBoardTurnResolvedEventFixture({
            announcement: { safeHazardWardsUsedAfter: 1 }
        }));

        expect(result.message).toBe(
            'Match resolved. 1/2 pairs cleared. Guard Cache ward blocked a hazard.'
        );
    });

    it('does not announce an existing board-turn event on first render', async () => {
        const turn = createBoardTurnResolvedEventFixture({
            announcement: { hazardTilesAfter: { totalTriggers: 1, cascadeCaches: 1 } }
        });
        const { result } = renderHook(() =>
            useHudPoliteLiveAnnouncement({
                ...base,
                boardTurnEvent: turn
            })
        );

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
