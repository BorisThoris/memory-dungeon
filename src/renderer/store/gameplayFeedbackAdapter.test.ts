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
                cue: 'build.score_glint.matched',
                message: 'Findable matched.',
                source: { kind: 'findable', id: 'score_glint' },
                tone: 'reward'
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'floor.advance.ready',
                message: 'Next floor ready.',
                source: { kind: 'system', id: 'floor_advance' },
                tone: 'information'
            }),
            event(2, {
                type: 'feedback.requested',
                cue: 'power.gambit.committed',
                message: 'Gambit committed.',
                source: { kind: 'power', id: 'gambit' },
                tone: 'warning'
            })
        ]);

        expect(presentations.map((item) => item.audioCategory)).toEqual([
            'match-resolution',
            'floor-advance',
            'gambit-commit'
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
                source: { kind: 'trait', id: 'conduit' }
            }),
            event(1, {
                type: 'feedback.requested',
                cue: 'trait.conduit.overflow',
                message: 'Conduit paid its reward as overflow score.',
                source: { kind: 'trait', id: 'conduit' },
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
