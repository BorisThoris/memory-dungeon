import type { RunState } from './contracts';
import { runArrayCount } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export interface GameplayFeedbackCriticalSnapshot {
    lives: number;
    guardTokens: number;
    comboShards: number;
    currentStreak: number;
    currentLevelScore: number;
    totalScore: number;
    tries: number;
    mismatches: number;
    shuffleCharges: number;
    regionShuffleCharges: number;
    destroyPairCharges: number;
    peekCharges: number;
    flashPairCharges: number;
    strayRemoveCharges: number;
    pinnedTileCount: number;
    recallFocus: number;
    recallMatchesThisFloor: number;
    recallMistakesThisFloor: number;
    recallBonusScoreThisFloor: number;
    forgottenTileCountThisFloor: number;
}

/**
 * Single source mapping normalized feedback facts to the graph state fields
 * visible in the HUD or action toolbar. The AI model reads these literal
 * values from source, so runtime completeness and semantic diagnostics cannot
 * silently drift into different definitions of "player visible".
 */
export const GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES = {
    lives: 'lives',
    guardTokens: 'guardTokens',
    comboShards: 'comboShards',
    currentStreak: 'currentStreak',
    currentLevelScore: 'currentLevelScore',
    totalScore: 'totalScore',
    tries: 'tries',
    mismatches: 'mismatches',
    shuffleCharges: 'shuffleCharges',
    regionShuffleCharges: 'regionShuffleCharges',
    destroyPairCharges: 'destroyPairCharges',
    peekCharges: 'peekCharges',
    flashPairCharges: 'flashPairCharges',
    strayRemoveCharges: 'strayRemoveCharges',
    pinnedTileCount: 'pinnedTileIds',
    recallFocus: 'recallFocus',
    recallMatchesThisFloor: 'recallMatchesThisFloor',
    recallMistakesThisFloor: 'recallMistakesThisFloor',
    recallBonusScoreThisFloor: 'recallBonusScoreThisFloor',
    forgottenTileCountThisFloor: 'forgottenTileIdsThisFloor'
} as const satisfies Record<keyof GameplayFeedbackCriticalSnapshot, string>;

export const GAMEPLAY_FEEDBACK_CRITICAL_FIELDS = Object.keys(
    GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES
) as (keyof GameplayFeedbackCriticalSnapshot)[];

/**
 * Normalized state that previously fed React delta reconstruction. Keeping this
 * snapshot in the deterministic layer lets tests and simulation prove that any
 * meaningful change has an authoritative presentation event.
 */
export const getGameplayFeedbackCriticalSnapshot = (
    run: RunState
): GameplayFeedbackCriticalSnapshot => {
    const stats = normalizeSessionStats(run.stats);
    return {
        lives: runNonNegativeInteger(run.lives),
        guardTokens: stats.guardTokens,
        comboShards: stats.comboShards,
        currentStreak: stats.currentStreak,
        currentLevelScore: stats.currentLevelScore,
        totalScore: stats.totalScore,
        tries: stats.tries,
        mismatches: stats.mismatches,
        shuffleCharges: runNonNegativeInteger(run.shuffleCharges),
        regionShuffleCharges: runNonNegativeInteger(run.regionShuffleCharges),
        destroyPairCharges: runNonNegativeInteger(run.destroyPairCharges),
        peekCharges: runNonNegativeInteger(run.peekCharges),
        flashPairCharges: runNonNegativeInteger(run.flashPairCharges),
        strayRemoveCharges: runNonNegativeInteger(run.strayRemoveCharges),
        pinnedTileCount: runArrayCount(run.pinnedTileIds),
        recallFocus: runNonNegativeInteger(run.recallFocus),
        recallMatchesThisFloor: runNonNegativeInteger(run.recallMatchesThisFloor),
        recallMistakesThisFloor: runNonNegativeInteger(run.recallMistakesThisFloor),
        recallBonusScoreThisFloor: runNonNegativeInteger(run.recallBonusScoreThisFloor),
        forgottenTileCountThisFloor: runArrayCount(run.forgottenTileIdsThisFloor)
    };
};
