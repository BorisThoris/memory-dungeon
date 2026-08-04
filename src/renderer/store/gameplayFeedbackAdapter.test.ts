import { describe, expect, it } from 'vitest';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import {
    getLatestBoardTurnResolvedEvent,
    getLatestGameplayFeedback,
    getLatestGameplayFeedbackBatch,
    getNewGameplayFeedback,
    projectBoardTurnResolvedEvents,
    projectGameplayFeedback
} from './gameplayFeedbackAdapter';

const event = (
    sequence: number,
    value: Partial<GameplayEvent> & Pick<GameplayEvent, 'type'>
): GameplayEvent => ({
    schemaVersion: 1,
    commandId: 'command-1',
    eventId: `command-1:${sequence}`,
    sequence,
    source: { kind: 'system', id: 'test' },
    ...value
} as GameplayEvent);

describe('gameplayFeedbackAdapter', () => {
    it('selects only schema-valid board-turn facts and preserves their event identity', () => {
        const turn = createBoardTurnResolvedEventFixture({
            commandId: 'command-1',
            eventId: 'command-1:2',
            sequence: 2,
            boardLevel: 2,
            matchedFindableKind: 'shard_spark',
            findablesClaimedBefore: 0,
            findablesClaimedAfter: 1,
            findablesTotalBefore: 2,
            findablesTotalAfter: 2,
            totalScoreAfter: 25,
            comboShardsAfter: 1
        });
        const journal = [
            { ...turn, matchedFindableKind: 'not-a-findable' },
            event(1, {
                type: 'feedback.requested',
                cue: 'build.shard_spark.matched',
                message: 'Shard spark claimed.',
                source: { kind: 'findable', id: 'shard_spark' },
                tone: 'reward'
            }),
            turn
        ];

        expect(projectBoardTurnResolvedEvents(journal)).toEqual([turn]);
        expect(getLatestBoardTurnResolvedEvent({ gameplayEventJournal: journal })).toEqual(turn);
    });

    it('projects typed pause, resume, and terminal lifecycle feedback separately', () => {
        const presentations = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'run.paused',
                message: 'Run paused from playing.',
                source: { kind: 'system', id: 'run_lifecycle' },
                tone: 'information'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'run.resumed',
                message: 'Run resumed into playing.',
                source: { kind: 'system', id: 'run_lifecycle' },
                tone: 'information'
            }),
            event(2, {
                type: 'feedback.requested',
                cue: 'run.interlude.terminal',
                message: 'Run ended at zero lives.',
                source: { kind: 'system', id: 'run_lifecycle' },
                tone: 'warning'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual(['pause', 'resume', 'run-end']);
        expect(presentations.at(-1)).toMatchObject({ priority: 'error' });
    });

    it('projects typed run bootstrap feedback as the sole start-audio cause', () => {
        expect(projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'run.started',
                message: 'Started endless on seed 81337.',
                source: { kind: 'system', id: 'run_start' },
                tone: 'information'
            })
        ])).toEqual([
            expect.objectContaining({
                audioCategory: 'run-start',
                cue: 'run.started',
                message: 'Started endless on seed 81337.'
            })
        ]);
    });

    it('projects debug reveal lifecycle feedback separately from the consumable Peek power', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'debug.reveal.timer_elapsed',
                message: 'Debug reveal expired; hidden tiles are concealed again.',
                source: { kind: 'system', id: 'debug_reveal' },
                tone: 'information'
            })
        ])[0];

        expect(presentation).toMatchObject({
            audioCategory: 'debug-reveal',
            cue: 'debug.reveal.timer_elapsed'
        });
    });

    it('projects progression safety repair as explicit system feedback', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'safety.progression.repaired',
                message: 'Progression safety repaired exit lock.',
                source: { kind: 'system', id: 'progression_safety' },
                tone: 'information'
            })
        ])[0];

        expect(presentation).toMatchObject({
            audioCategory: 'safety-repair',
            cue: 'safety.progression.repaired',
            priority: 'info'
        });
    });

    it('projects typed Gauntlet expiry as terminal pressure feedback', () => {
        expect(projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'mode.gauntlet.expired',
                message: 'Gauntlet time expired.',
                source: { kind: 'system', id: 'gauntlet_clock' },
                tone: 'warning'
            })
        ])).toEqual([
            expect.objectContaining({
                audioCategory: 'gauntlet-expire',
                cue: 'mode.gauntlet.expired',
                priority: 'error'
            })
        ]);
    });

    it('projects typed study completion as its own feedback category', () => {
        expect(projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'phase.memorize.completed',
                message: 'Study complete; 2 Focus charges are ready.',
                source: { kind: 'system', id: 'memorize_phase' },
                tone: 'information'
            })
        ])).toEqual([
            expect.objectContaining({
                audioCategory: 'memorize-complete',
                cue: 'phase.memorize.completed',
                message: 'Study complete; 2 Focus charges are ready.'
            })
        ]);
    });

    it('projects valid feedback and ignores corrupt persisted entries', () => {
        expect(projectGameplayFeedback([
            { bad: true },
            event(0, {
                type: 'feedback.requested',
                cue: 'power.peek.used',
                message: 'Peek used.',
                source: { kind: 'power', id: 'peek' },
                tone: 'information'
            })
        ])).toEqual([
            expect.objectContaining({
                audioCategory: 'peek',
                cue: 'power.peek.used',
                eventId: 'command-1:0',
                message: 'Peek used.',
                priority: 'info'
            })
        ]);
    });

    it('classifies owned action audio without making presentation into gameplay truth', () => {
        const presentations = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'build.warden_sigil.claimed',
                message: 'Relic claimed.',
                source: { kind: 'relic', id: 'guard_token_plus_one' },
                tone: 'reward'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'build.hazard_ward.claimed',
                message: 'Reward claimed.',
                source: { kind: 'bonus_reward', id: 'hazard_ward' },
                tone: 'reward'
            }),
            event(2, {
                type: 'feedback.requested',
                cue: 'build.shard_spark.matched',
                message: 'Findable matched.',
                source: { kind: 'findable', id: 'shard_spark' },
                tone: 'reward'
            }),
            event(3, {
                type: 'feedback.requested',
                cue: 'relic.offer_service.reroll_offer',
                message: 'Relic offer rerolled.',
                source: { kind: 'system', id: 'relic_offer' },
                tone: 'information'
            }),
            event(4, {
                type: 'feedback.requested',
                cue: 'side_room.rest_healed',
                message: 'Rest completed.',
                source: { kind: 'system', id: 'route_side_room' },
                tone: 'reward'
            }),
            event(5, {
                type: 'feedback.requested',
                cue: 'floor.advance.ready',
                message: 'Next floor ready.',
                source: { kind: 'system', id: 'floor_advance' },
                tone: 'information'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual([
            'relic-pick',
            'reward-claim',
            'match-resolution',
            'relic-service',
            'side-room',
            'floor-advance'
        ]);
    });

    it('classifies Route Gambler commitment and wager cues from typed sources', () => {
        const presentations = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'power.gambit.committed',
                message: 'Gambit committed.',
                source: { kind: 'power', id: 'gambit' },
                tone: 'warning'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'build.route_gambler.wager_accepted',
                message: 'Wager accepted.',
                source: { kind: 'system', id: 'risk_wager' },
                tone: 'warning'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual([
            'gambit-commit',
            'wager'
        ]);
    });

    it('classifies typed relic-offer opening separately from paid offer services', () => {
        const presentations = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'relic.offer.opened',
                message: 'Relic draft opened.',
                source: { kind: 'system', id: 'relic_offer' },
                tone: 'reward'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'relic.offer_service.reroll_offer',
                message: 'Relic offer rerolled.',
                source: { kind: 'system', id: 'relic_offer' },
                tone: 'information'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual([
            'relic-offer',
            'relic-service'
        ]);
    });

    it('classifies Memory Scout Flash and Undo cues from typed power sources', () => {
        const presentations = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'power.flash_pair.used',
                message: 'Flash Pair used.',
                source: { kind: 'power', id: 'flash_pair' },
                tone: 'information'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'power.undo_resolve.used',
                message: 'Undo used.',
                source: { kind: 'power', id: 'undo_resolve' },
                tone: 'information'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual(['flash-pair', 'undo']);
    });

    it('classifies Destroy Pair feedback from its typed power source', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'power.destroy_pair.used',
                message: 'Pair removed.',
                source: { kind: 'power', id: 'destroy_pair' },
                tone: 'information'
            })
        ])[0];

        expect(presentation).toMatchObject({ audioCategory: 'destroy-pair' });
    });

    it('classifies Hazard Banish floor-start feedback from its durable perk source', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'perk.hazard_banish.hazard_removed',
                message: 'Hazard removed.',
                source: { kind: 'reward_perk', id: 'hazard_banish_per_floor' },
                tone: 'reward'
            })
        ])[0];

        expect(presentation).toMatchObject({ audioCategory: 'hazard-banish' });
    });

    it('classifies route selection feedback from the typed progression source', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'route.choice.mystery',
                message: 'Mystery route selected.',
                source: { kind: 'system', id: 'route_choice' },
                tone: 'reward'
            })
        ])[0];

        expect(presentation).toMatchObject({ audioCategory: 'route-choice' });
    });

    it('classifies Locksmith shop and exit cues from typed sources', () => {
        const presentations = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'shop.master_key.purchased',
                message: 'Master Key purchased.',
                source: { kind: 'shop', id: 'run_shop' },
                tone: 'reward'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'dungeon.exit.activated',
                message: 'Exit activated.',
                source: { kind: 'system', id: 'dungeon_exit' },
                tone: 'information'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual(['shop-purchase', 'exit-activate']);
    });

    it('classifies typed stock rerolls separately from purchases', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'shop.stock.rerolled',
                message: 'Shop stock rerolled.',
                source: { kind: 'shop', id: 'run_shop' },
                tone: 'information'
            })
        ])[0];

        expect(presentation).toMatchObject({
            audioCategory: 'shop-reroll',
            cue: 'shop.stock.rerolled'
        });
    });

    it('classifies score-parasite ward and life-loss feedback from the typed hazard source', () => {
        const presentations = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'hazard.score_parasite.ward_consumed',
                message: 'Ward absorbed the hit.',
                source: { kind: 'system', id: 'score_parasite' },
                tone: 'reward'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'hazard.score_parasite.life_lost',
                message: 'A life was lost.',
                source: { kind: 'system', id: 'score_parasite' },
                tone: 'warning'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual(['parasite', 'parasite']);
    });

    it('classifies Wild Joker bridge feedback from the typed system source', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'feedback.requested',
                cue: 'wild_joker.match_consumed',
                message: 'Wild Joker bridged a symbol.',
                source: { kind: 'system', id: 'wild_joker' },
                tone: 'reward'
            })
        ])[0];

        expect(presentation).toMatchObject({ audioCategory: 'wild-match' });
    });

    it('adds the actual typed overflow score to otherwise ambiguous proc feedback', () => {
        const presentation = projectGameplayFeedback([
            event(0, {
                type: 'score.changed',
                reason: 'inventory_overflow',
                amount: 20,
                totalBefore: 100,
                totalAfter: 120,
                currentLevelBefore: 40,
                currentLevelAfter: 60,
                source: { kind: 'relic', id: 'guard_token_plus_one' }
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'build.warden_sigil.mirror_triggered',
                message: 'Mirror invoked the Warden Sigil for guard or overflow score.',
                source: { kind: 'relic', id: 'guard_token_plus_one' },
                tone: 'reward'
            })
        ])[0];

        expect(presentation?.message).toContain('Inventory overflow converted to +20 score.');
    });

    it('finds only new feedback across bounded journal snapshots', () => {
        const first = event(0, {
            type: 'feedback.requested',
            cue: 'first',
            message: 'First.',
            tone: 'information'
        });
        const second = event(1, {
            type: 'feedback.requested',
            cue: 'second',
            message: 'Second.',
            tone: 'warning'
        });

        expect(getNewGameplayFeedback(
            { gameplayEventJournal: [first] },
            { gameplayEventJournal: [first, second] }
        )).toEqual([expect.objectContaining({ eventId: 'command-1:1', priority: 'error' })]);
        expect(getLatestGameplayFeedback({ gameplayEventJournal: [first, second] }))
            .toEqual(expect.objectContaining({ eventId: 'command-1:1' }));
    });

    it('returns every ordered feedback event from the latest command', () => {
        const older = event(1, {
            type: 'feedback.requested',
            commandId: 'older-command',
            eventId: 'older-command:1',
            cue: 'older',
            message: 'Older feedback.',
            tone: 'warning'
        });
        const first = event(1, {
            type: 'feedback.requested',
            commandId: 'floor-advance',
            eventId: 'floor-advance:1',
            cue: 'hazard.score_parasite.drain_warning',
            message: 'Drain warning.',
            source: { kind: 'system', id: 'score_parasite' },
            tone: 'warning'
        });
        const second = event(5, {
            type: 'feedback.requested',
            commandId: 'floor-advance',
            eventId: 'floor-advance:5',
            cue: 'floor.advance.ready',
            message: 'Floor ready.',
            source: { kind: 'system', id: 'floor_advance' },
            tone: 'information'
        });

        expect(getLatestGameplayFeedbackBatch({
            gameplayEventJournal: [
                older,
                first,
                { corrupt: true } as unknown as GameplayEvent,
                second
            ]
        })).toEqual([
            expect.objectContaining({ eventId: 'floor-advance:1', priority: 'error' }),
            expect.objectContaining({ eventId: 'floor-advance:5', priority: 'info' })
        ]);
        expect(getLatestGameplayFeedbackBatch({ gameplayEventJournal: [] })).toEqual([]);
    });
});
