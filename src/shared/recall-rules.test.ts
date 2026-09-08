import { describe, expect, it } from 'vitest';
import {
    INITIAL_RECALL_FOCUS,
    MAX_PENDING_MEMORIZE_BONUS_MS,
    MEMORIZE_BONUS_PER_LIFE_LOST_MS,
    RECALL_FOCUS_MATCH_SCORE,
    RECALL_FOCUS_MAX,
    type RunState
} from './contracts';
import { createNewRun } from './game-core';
import {
    addPendingMemorizeBonusForLostLives,
    calculateRecallMatchBonus,
    decreaseRecallFocus,
    FORGOTTEN_TILE_LEDGER_LIMIT,
    getMemorizePhaseRecallFocus,
    increaseRecallFocus,
    normalizeRecallFocus,
    rememberForgottenTiles,
    settleForgottenTiles
} from './recall-rules';

const runWithLastResult = (
    overrides: Partial<NonNullable<RunState['lastLevelResult']>> = {}
): RunState => ({
    ...createNewRun(0, { echoFeedbackEnabled: false }),
    lastLevelResult: {
        level: 1,
        scoreGained: 100,
        rating: 'S',
        livesRemaining: 5,
        perfect: true,
        mistakes: 0,
        clearLifeReason: 'perfect',
        clearLifeGained: 0,
        ...overrides
    }
});

describe('recall rules', () => {
    it('keeps forgotten tile markers unique and bounded to the latest entries', () => {
        const existing = Array.from({ length: FORGOTTEN_TILE_LEDGER_LIMIT }, (_, index) => `old-${index}`);
        expect(rememberForgottenTiles(existing, ['old-2', 'new-1', 'new-2'])).toEqual([
            ...existing.slice(2),
            'new-1',
            'new-2'
        ]);
    });

    it('settles only recalled forgotten tiles', () => {
        expect(settleForgottenTiles(['a1', 'b1', 'c1'], ['b1'])).toEqual(['a1', 'c1']);
    });


    it('clamps focus and scores remembered matches', () => {
        const run = { ...createNewRun(0, { echoFeedbackEnabled: false }), recallFocus: RECALL_FOCUS_MAX + 2 };
        expect(normalizeRecallFocus(-10)).toBe(0);
        expect(normalizeRecallFocus(RECALL_FOCUS_MAX + 2)).toBe(RECALL_FOCUS_MAX);
        expect(increaseRecallFocus(run)).toBe(RECALL_FOCUS_MAX);
        expect(decreaseRecallFocus(run, 99)).toBe(0);
        expect(calculateRecallMatchBonus(run)).toBe(RECALL_FOCUS_MAX * RECALL_FOCUS_MATCH_SCORE);
    });

    it('caps pending memorize bonus from life loss', () => {
        expect(addPendingMemorizeBonusForLostLives(0, 0)).toBe(0);
        expect(addPendingMemorizeBonusForLostLives(0, 2)).toBe(MEMORIZE_BONUS_PER_LIFE_LOST_MS * 2);
        expect(addPendingMemorizeBonusForLostLives(MAX_PENDING_MEMORIZE_BONUS_MS - 1, 2)).toBe(
            MAX_PENDING_MEMORIZE_BONUS_MS
        );
    });

    it('normalizes malformed recall counters before deriving focus and recovery bonus', () => {
        expect(normalizeRecallFocus(Number.NaN)).toBe(0);
        expect(normalizeRecallFocus(Number.POSITIVE_INFINITY)).toBe(0);
        expect(addPendingMemorizeBonusForLostLives(Number.NaN, Number.POSITIVE_INFINITY)).toBe(0);
        expect(
            getMemorizePhaseRecallFocus(
                runWithLastResult({
                    recallMatches: Number.POSITIVE_INFINITY,
                    recallMistakes: Number.NaN,
                    recallBonusScore: Number.POSITIVE_INFINITY
                })
            )
        ).toBe(INITIAL_RECALL_FOCUS);
        expect(
            getMemorizePhaseRecallFocus(
                runWithLastResult({
                    recallMatches: Number.NaN,
                    recallMistakes: Number.POSITIVE_INFINITY,
                    recallBonusScore: Number.NaN
                })
            )
        ).toBe(INITIAL_RECALL_FOCUS);
    });

    it('derives next memorize focus from prior recall', () => {
        expect(getMemorizePhaseRecallFocus(createNewRun(0, { echoFeedbackEnabled: false }))).toBe(INITIAL_RECALL_FOCUS);
        expect(getMemorizePhaseRecallFocus(runWithLastResult({ recallMatches: 2 }))).toBe(2);
        expect(getMemorizePhaseRecallFocus(runWithLastResult({ recallMatches: 1 }))).toBe(INITIAL_RECALL_FOCUS);
        expect(getMemorizePhaseRecallFocus(runWithLastResult({ recallMistakes: 1 }))).toBe(0);
    });
});
