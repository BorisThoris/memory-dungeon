import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import {
    createGameplayPeekCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import {
    GAMEPLAY_FEEDBACK_CRITICAL_FIELDS,
    GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES
} from './gameplay-feedback-facts';
import { createBoardTurnResolvedEventFixture } from './test/gameplay-event-fixtures';

const run = (overrides: Partial<RunState> = {}): RunState => ({
    status: 'playing',
    board: null,
    recallFocus: 0,
    recallMatchesThisFloor: 0,
    recallMistakesThisFloor: 0,
    recallBonusScoreThisFloor: 0,
    forgottenTileIdsThisFloor: [],
    stats: { comboShards: 0 },
    ...overrides
} as RunState);

const feedbackEvent = (commandId: string): GameplayEvent => ({
    schemaVersion: 1,
    commandId,
    eventId: `${commandId}:0`,
    sequence: 0,
    source: { kind: 'power', id: 'peek' },
    type: 'feedback.requested',
    cue: 'power.peek.used',
    message: 'Peek consequence reported.',
    tone: 'information'
});

describe('gameplay feedback completeness', () => {
    it('keeps every normalized HUD field attached to one machine-readable graph state source', () => {
        expect(GAMEPLAY_FEEDBACK_CRITICAL_FIELDS).toEqual(Object.keys(GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES));
        expect(new Set(Object.values(GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES)).size).toBe(
            GAMEPLAY_FEEDBACK_CRITICAL_FIELDS.length
        );
        expect(GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES).toMatchObject({
            totalScore: 'totalScore',
            peekCharges: 'peekCharges',
            pinnedTileCount: 'pinnedTileIds'
        });
    });

    it('reports exact normalized critical fields changed without typed presentation', () => {
        const command = createGameplayPeekCommand('missing-feedback', 'tile-a');
        const diagnostic = inspectGameplayFeedbackCompleteness({
            before: run(),
            after: run({
                recallFocus: 1,
                forgottenTileIdsThisFloor: ['tile-a'],
                stats: { comboShards: 2 } as RunState['stats']
            }),
            command,
            events: [],
            accepted: true
        });

        expect(diagnostic).toEqual({
            commandId: 'missing-feedback',
            commandType: 'board.peek',
            changedFields: [
                'comboShards',
                'recallFocus',
                'forgottenTileCountThisFloor'
            ],
            eventTypes: [],
            message: 'Accepted board.peek command missing-feedback changed feedback-critical fields without typed presentation: comboShards, recallFocus, forgottenTileCountThisFloor.'
        });
    });

    it('reports power, score and streak HUD counters that the narrow audit previously missed', () => {
        const command = createGameplayPeekCommand('missing-resource-feedback', 'tile-a');
        const diagnostic = inspectGameplayFeedbackCompleteness({
            before: run(),
            after: run({
                shuffleCharges: 1,
                regionShuffleCharges: 1,
                destroyPairCharges: 1,
                peekCharges: 1,
                flashPairCharges: 1,
                strayRemoveCharges: 1,
                pinnedTileIds: ['tile-a'],
                stats: {
                    currentStreak: 1,
                    currentLevelScore: 10,
                    totalScore: 10,
                    tries: 1,
                    mismatches: 1
                } as RunState['stats']
            }),
            command,
            events: [],
            accepted: true
        });

        expect(diagnostic?.changedFields).toEqual([
            'currentStreak',
            'currentLevelScore',
            'totalScore',
            'tries',
            'mismatches',
            'shuffleCharges',
            'regionShuffleCharges',
            'destroyPairCharges',
            'peekCharges',
            'flashPairCharges',
            'strayRemoveCharges',
            'pinnedTileCount'
        ]);
        expect(diagnostic?.message).toContain('changed feedback-critical fields without typed presentation');
    });

    it('accepts typed feedback and the authoritative board-turn envelope', () => {
        const command = createGameplayPeekCommand('covered-feedback', 'tile-a');
        const before = run();
        const after = run({ recallFocus: 2 });

        expect(inspectGameplayFeedbackCompleteness({
            before,
            after,
            command,
            events: [feedbackEvent(command.commandId)],
            accepted: true
        })).toBeNull();
        expect(inspectGameplayFeedbackCompleteness({
            before,
            after,
            command,
            events: [createBoardTurnResolvedEventFixture({ commandId: command.commandId })],
            accepted: true
        })).toBeNull();
    });

    it('does not require consequence feedback for rejected or normalized no-op transitions', () => {
        const command = createGameplayPeekCommand('no-feedback-owed', 'tile-a');
        expect(inspectGameplayFeedbackCompleteness({
            before: run(),
            after: run({ recallFocus: Number.NaN, peekCharges: -1 }),
            command,
            events: [],
            accepted: false
        })).toBeNull();
        expect(inspectGameplayFeedbackCompleteness({
            before: run({ recallFocus: Number.NaN, peekCharges: -1 }),
            after: run({ recallFocus: 0, peekCharges: 0 }),
            command,
            events: [],
            accepted: true
        })).toBeNull();
    });
});
