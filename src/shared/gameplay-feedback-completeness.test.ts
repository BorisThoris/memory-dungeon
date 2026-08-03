import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import {
    createGameplayPeekCommand,
    type GameplayEvent
} from './gameplay-core-contracts';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import { createBoardTurnResolvedEventFixture } from './test/gameplay-event-fixtures';

const run = (overrides: Partial<RunState> = {}): RunState => ({
    status: 'playing',
    lives: 3,
    board: null,
    shopGold: 0,
    recallFocus: 0,
    recallMatchesThisFloor: 0,
    recallMistakesThisFloor: 0,
    recallBonusScoreThisFloor: 0,
    forgottenTileIdsThisFloor: [],
    dungeonEnemiesDefeatedThisFloor: 0,
    enemyHazardHitsThisFloor: 0,
    enemyHazardsDefeatedThisFloor: 0,
    stats: { guardTokens: 0, comboShards: 0 },
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
    it('reports exact normalized critical fields changed without typed presentation', () => {
        const command = createGameplayPeekCommand('missing-feedback', 'tile-a');
        const diagnostic = inspectGameplayFeedbackCompleteness({
            before: run(),
            after: run({
                lives: 2,
                shopGold: 3,
                recallFocus: 1,
                forgottenTileIdsThisFloor: ['tile-a'],
                stats: { guardTokens: 1, comboShards: 2 } as RunState['stats']
            }),
            command,
            events: [],
            accepted: true
        });

        expect(diagnostic).toEqual({
            commandId: 'missing-feedback',
            commandType: 'board.peek',
            changedFields: [
                'lives',
                'guardTokens',
                'comboShards',
                'shopGold',
                'recallFocus',
                'forgottenTileCountThisFloor'
            ],
            eventTypes: [],
            message: 'Accepted board.peek command missing-feedback changed feedback-critical fields without typed presentation: lives, guardTokens, comboShards, shopGold, recallFocus, forgottenTileCountThisFloor.'
        });
    });

    it('accepts typed feedback and the authoritative board-turn envelope', () => {
        const command = createGameplayPeekCommand('covered-feedback', 'tile-a');
        const before = run();
        const after = run({ lives: 2 });

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
            after: run({ lives: Number.NaN, shopGold: -1 }),
            command,
            events: [],
            accepted: false
        })).toBeNull();
        expect(inspectGameplayFeedbackCompleteness({
            before: run({ lives: Number.NaN, shopGold: -1 }),
            after: run({ lives: 0, shopGold: 0 }),
            command,
            events: [],
            accepted: true
        })).toBeNull();
    });
});
