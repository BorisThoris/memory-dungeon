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
    shuffleCharges: 0,
    regionShuffleCharges: 0,
    stickyBlockIndex: null as number | null,
    boardLevel: 1 as number | null,
    boardTiles: [] as Tile[],
    matchedPairs: 0,
    pairCount: 2,
    mismatches: 0,
    tileTraitMatches: { echo: 0, heavy: 0, conduit: 0, stasis: 0 },
    tileTraitMismatches: { echo: 0, heavy: 0, conduit: 0, stasis: 0 },
    findablesClaimedThisFloor: 0,
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
    reduceMotion: false
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
                'Shuffle Snare fired. Hidden safe tiles reordered. Cascade Cache fired. One safe hidden pair cleared. Ripple carried a second wave. The chain held at Sharp.'
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
        expect(getHudActionFeedbackProfile('Score glint claimed: +25 score.')).toEqual({
            label: 'Reward burst',
            tone: 'reward'
        });
        expect(getHudActionFeedbackProfile('Echo and Stasis trait resolved.')).toEqual({
            label: 'Trait play',
            tone: 'trait'
        });
        expect(getHudActionFeedbackProfile('Trait combo surge: Conduit and Stasis resolved.')).toEqual({
            label: 'Trait surge',
            tone: 'trait'
        });
        expect(getHudActionFeedbackProfile('Shop gold gained. 4 available.')).toEqual({
            label: 'Reward burst',
            tone: 'reward'
        });
        expect(getHudActionFeedbackProfile('Pickup cashout: Score glint +25 score.')).toEqual({
            label: 'Reward burst',
            tone: 'reward'
        });
        expect(
            getHudActionFeedbackProfile(
                'Trait combo surge: Echo and Stasis resolved. Payoff stack: 4 payoffs cashed. Cash stack now.'
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
        expect(getHudActionFeedbackProfile('Surge hit: x6. Surge tier live.')).toEqual({
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

        expect(result.current.message).toBe('Chain started: x3. Reward loop online.');
    });

    it('announces surge chain milestones', async () => {
        const surgeEvent = createBoardTurnResolvedEventFixture({
            commandId: 'chain-surge',
            announcement: {
                level: 3,
                currentStreakBefore: 5,
                currentStreakAfter: 6
            }
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

        await flushRaf();

        await act(async () => {
            rerender({ turnEvent: surgeEvent as BoardTurnResolvedEvent });
        });
        await flushRaf();

        expect(result.current.message).toBe('Surge hit: x6. Surge tier live.');
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
            matchedFindableKind: 'score_glint',
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

        expect(result.current.message).toBe('Score glint claimed: +25 score.');
    });

    it('announces a resolved match as one readable action summary', async () => {
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
            rerender({ turnEvent: matchTurn('summary-turn') });
        });
        await flushRaf();

        expect(result.current.message).toBe('Match resolved. 1/4 pairs cleared.');
        expect(result.current.priority).toBe('info');
    });

    it('announces every event one command raised, not just the last of them', async () => {
        // A single flip can claim a findable and trip a hazard. The hook used to take the latest
        // feedback event and drop the rest, so the player heard one of the two.
        const command = 'flip-7';
        const feedback: GameplayFeedbackPresentation[] = [
            {
                audioCategory: 'match-resolution',
                commandId: command,
                cue: 'findable.claimed',
                eventId: `${command}:1`,
                message: 'Cache claimed.',
                priority: 'info',
                source: { kind: 'findable', id: 'cache' },
                tone: 'reward'
            },
            {
                audioCategory: 'match-resolution',
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
            audioCategory: 'match-resolution',
            commandId: 'reward-1',
            cue: 'findable.score_glint.matched',
            eventId: 'reward-1:2',
            message: 'Score Glint requested 25 score through match resolution.',
            priority: 'info',
            source: { kind: 'findable', id: 'score_glint' },
            tone: 'reward'
        };
        const { result, rerender } = renderHook(
            (p: { feedback: GameplayFeedbackPresentation | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    gameplayFeedback: p.feedback ? [p.feedback] : []
                }),
            { initialProps: { feedback: null as GameplayFeedbackPresentation | null } }
        );

        await act(async () => {
            rerender({ feedback });
        });
        await flushRaf();

        expect(result.current.message).toBe('Score Glint requested 25 score through match resolution.');
        expect(result.current.message).not.toContain('available');
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

    it('announces trait combo surges, charge gains, and stasis locks with the resolved match', async () => {
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
                turnEvent: matchTurn('conduit-turn', { matchedTraitKinds: ['conduit', 'stasis'] }),
                rowCharges: 1,
                fullCharges: 1,
                sticky: 3
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'Match resolved. 1/4 pairs cleared. Trait combo surge: Conduit and Stasis resolved. 1 row/swap charge gained. 1 full shuffle charge gained. Stasis blocked a nearby trait tile from opening first next turn.'
        );
    });

    it('announces tile trait mismatch penalties', async () => {
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
                turnEvent: mismatchTurn('heavy-miss-turn', {
                    matchedTraitKinds: ['heavy']
                })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'No match. Recover with a safe match. Chain reset. Heavy trait penalty applied.'
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
                    matchedTraitKinds: ['heavy', 'stasis']
                })
            });
        });
        await flushRaf();

        expect(result.current.message).toBe(
            'No match. Recover with a safe match. Chain reset. Trait surge: 2 penalties applied: Heavy and Stasis.'
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

    it('keeps a miss quiet: the cards reset and the chain does, and nothing is said to have been lost', async () => {
        // Thesis §67: a bad floor is unremarkable. A miss is routine information, not an error.
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
            rerender({ turnEvent: mismatchTurn('miss-turn') });
        });
        await flushRaf();

        expect(result.current.message).toBe('No match. Recover with a safe match. Chain reset.');
        expect(result.current.message).not.toMatch(/\b(life|lives|lost|penalty|punish)\b/i);
        expect(result.current.priority).toBe('info');
    });

    it('stays silent when a turn changes none of the announced counters', async () => {
        // The counters this used to watch were per-floor totals, so a floor that started
        // with one already recorded announced it again on the first render. Keyed on the
        // event's own before/after pair, a quiet turn says nothing.
        const { result, rerender } = renderHook(
            (p: { turnEvent: BoardTurnResolvedEvent | null }) =>
                useHudPoliteLiveAnnouncement({
                    ...base,
                    boardTurnEvent: p.turnEvent
                }),
            { initialProps: { turnEvent: null as BoardTurnResolvedEvent | null } }
        );

        await flushRaf();
        expect(result.current.message).toBe('');

        await act(async () => {
            rerender({
                turnEvent: counterTurn('quiet-turn', {})
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
