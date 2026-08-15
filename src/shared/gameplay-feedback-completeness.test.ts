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
    it('keeps every normalized HUD field attached to one machine-readable graph state source', () => {
        expect(GAMEPLAY_FEEDBACK_CRITICAL_FIELDS).toEqual(Object.keys(GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES));
        expect(new Set(Object.values(GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES)).size).toBe(
            GAMEPLAY_FEEDBACK_CRITICAL_FIELDS.length
        );
        expect(GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES).toMatchObject({
            totalScore: 'totalScore',
            dungeonKeys: 'dungeonKeys',
            peekCharges: 'peekCharges',
            pinnedTileCount: 'pinnedTileIds',
            relicFavorProgress: 'relicFavorProgress'
        });
    });

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

    it('reports power, key, score, streak, and Favor HUD counters that the narrow audit previously missed', () => {
        const command = createGameplayPeekCommand('missing-resource-feedback', 'tile-a');
        const diagnostic = inspectGameplayFeedbackCompleteness({
            before: run(),
            after: run({
                dungeonKeys: { iron: 1, treasure: 1, shrine: 1, boss: 1, trap: 1 },
                dungeonMasterKeys: 1,
                shuffleCharges: 1,
                regionShuffleCharges: 1,
                destroyPairCharges: 1,
                peekCharges: 1,
                flashPairCharges: 1,
                strayRemoveCharges: 1,
                relicFavorProgress: 1,
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
            'dungeonKeys',
            'shuffleCharges',
            'regionShuffleCharges',
            'destroyPairCharges',
            'peekCharges',
            'flashPairCharges',
            'strayRemoveCharges',
            'relicFavorProgress',
            'pinnedTileCount'
        ]);
        expect(diagnostic?.message).toContain('changed feedback-critical fields without typed presentation');
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
