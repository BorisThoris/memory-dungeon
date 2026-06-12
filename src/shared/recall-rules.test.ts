import { describe, expect, it } from 'vitest';
import {
    INITIAL_RECALL_FOCUS,
    MAX_PENDING_MEMORIZE_BONUS_MS,
    MEMORIZE_BONUS_PER_LIFE_LOST_MS,
    RECALL_CLUE_MATCH_SCORE,
    RECALL_FOCUS_MATCH_SCORE,
    RECALL_FOCUS_MAX,
    type RunState,
    type Tile
} from './contracts';
import { createNewRun } from './game-core';
import {
    addPendingMemorizeBonusForLostLives,
    calculateRecallMatchBonus,
    decreaseRecallFocus,
    FORGOTTEN_TILE_LEDGER_LIMIT,
    getMemorizePhaseRecallFocusForRoute,
    increaseRecallFocus,
    normalizeRecallFocus,
    rememberForgottenTiles,
    settleForgottenTiles,
    tileHasRecallClue
} from './recall-rules';

const tile = (overrides: Partial<Tile> = {}): Tile => ({
    id: 't1',
    symbol: 'A',
    label: 'A',
    pairKey: 'A',
    state: 'hidden',
    ...overrides
});

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

    it('identifies tiles with recall clues', () => {
        expect(tileHasRecallClue(tile())).toBe(false);
        expect(tileHasRecallClue(tile({ lanternScouted: true }))).toBe(true);
        expect(tileHasRecallClue(tile({ scoutRevealSource: 'lantern_ward' }))).toBe(true);
        expect(tileHasRecallClue(tile({ routeSpecialRevealed: true }))).toBe(true);
        expect(tileHasRecallClue(tile({ dungeonCardState: 'revealed' }))).toBe(true);
    });

    it('clamps focus and scores non-puzzle remembered matches', () => {
        const run = { ...createNewRun(0, { echoFeedbackEnabled: false }), recallFocus: RECALL_FOCUS_MAX + 2 };
        expect(normalizeRecallFocus(-10)).toBe(0);
        expect(normalizeRecallFocus(RECALL_FOCUS_MAX + 2)).toBe(RECALL_FOCUS_MAX);
        expect(increaseRecallFocus(run)).toBe(RECALL_FOCUS_MAX);
        expect(decreaseRecallFocus(run, 99)).toBe(0);
        expect(calculateRecallMatchBonus(run, [tile({ lanternScouted: true })])).toBe(
            RECALL_FOCUS_MAX * RECALL_FOCUS_MATCH_SCORE + RECALL_CLUE_MATCH_SCORE
        );
        expect(calculateRecallMatchBonus({ ...run, gameMode: 'puzzle' }, [tile({ lanternScouted: true })])).toBe(0);
    });

    it('caps pending memorize bonus from life loss', () => {
        expect(addPendingMemorizeBonusForLostLives(0, 0)).toBe(0);
        expect(addPendingMemorizeBonusForLostLives(0, 2)).toBe(MEMORIZE_BONUS_PER_LIFE_LOST_MS * 2);
        expect(addPendingMemorizeBonusForLostLives(MAX_PENDING_MEMORIZE_BONUS_MS - 1, 2)).toBe(
            MAX_PENDING_MEMORIZE_BONUS_MS
        );
    });

    it('derives next memorize focus from prior recall and route context', () => {
        expect(getMemorizePhaseRecallFocusForRoute(createNewRun(0, { echoFeedbackEnabled: false }), null)).toBe(
            INITIAL_RECALL_FOCUS
        );
        expect(getMemorizePhaseRecallFocusForRoute(runWithLastResult({ recallMatches: 2 }), null)).toBe(2);
        expect(getMemorizePhaseRecallFocusForRoute(runWithLastResult({ recallMistakes: 1 }), null)).toBe(0);
        expect(getMemorizePhaseRecallFocusForRoute(runWithLastResult({ recallMatches: 2 }), 'safe')).toBe(
            RECALL_FOCUS_MAX
        );
        expect(
            getMemorizePhaseRecallFocusForRoute(
                runWithLastResult({ recallMatches: 1, recallBonusScore: RECALL_CLUE_MATCH_SCORE }),
                'mystery'
            )
        ).toBe(2);
        expect(getMemorizePhaseRecallFocusForRoute(runWithLastResult({ recallMistakes: 1 }), 'greed')).toBe(0);
    });
});
