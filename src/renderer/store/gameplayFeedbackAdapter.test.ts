import { describe, expect, it } from 'vitest';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import {
    getLatestGameplayFeedback,
    getNewGameplayFeedback,
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
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual([
            'relic-pick',
            'reward-claim',
            'match-resolution'
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
});
