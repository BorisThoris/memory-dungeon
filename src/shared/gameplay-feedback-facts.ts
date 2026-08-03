import type { RunState } from './contracts';
import { getDungeonBoardPresentation, getDungeonObjectiveStatus } from './dungeon-board-status';
import { runArrayCount } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';
import { getTraitRouteObjectiveStatus } from './trait-route-objectives';

export interface GameplayFeedbackObjectiveSnapshot {
    label: string;
    progress: number;
    required: number;
}

export interface GameplayFeedbackDungeonKeySnapshot {
    iron: number;
    treasure: number;
    shrine: number;
    boss: number;
    trap: number;
    master: number;
}

export interface GameplayFeedbackCriticalSnapshot {
    lives: number;
    guardTokens: number;
    comboShards: number;
    currentStreak: number;
    currentLevelScore: number;
    totalScore: number;
    tries: number;
    mismatches: number;
    shopGold: number;
    dungeonKeys: GameplayFeedbackDungeonKeySnapshot;
    shuffleCharges: number;
    regionShuffleCharges: number;
    destroyPairCharges: number;
    peekCharges: number;
    flashPairCharges: number;
    strayRemoveCharges: number;
    relicFavorProgress: number;
    pinnedTileCount: number;
    objective: GameplayFeedbackObjectiveSnapshot | null;
    recallFocus: number;
    recallMatchesThisFloor: number;
    recallMistakesThisFloor: number;
    recallBonusScoreThisFloor: number;
    forgottenTileCountThisFloor: number;
    dungeonEnemiesDefeatedThisFloor: number;
    enemyHazardHitsThisFloor: number;
    enemyHazardsDefeatedThisFloor: number;
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
    shopGold: 'shopGold',
    dungeonKeys: 'dungeonKeys',
    shuffleCharges: 'shuffleCharges',
    regionShuffleCharges: 'regionShuffleCharges',
    destroyPairCharges: 'destroyPairCharges',
    peekCharges: 'peekCharges',
    flashPairCharges: 'flashPairCharges',
    strayRemoveCharges: 'strayRemoveCharges',
    relicFavorProgress: 'relicFavorProgress',
    pinnedTileCount: 'pinnedTileIds',
    objective: 'objectiveCompleted',
    recallFocus: 'recallFocus',
    recallMatchesThisFloor: 'recallMatchesThisFloor',
    recallMistakesThisFloor: 'recallMistakesThisFloor',
    recallBonusScoreThisFloor: 'recallBonusScoreThisFloor',
    forgottenTileCountThisFloor: 'forgottenTileIdsThisFloor',
    dungeonEnemiesDefeatedThisFloor: 'dungeonEnemiesDefeatedThisFloor',
    enemyHazardHitsThisFloor: 'enemyHazardHitsThisFloor',
    enemyHazardsDefeatedThisFloor: 'enemyHazardsDefeatedThisFloor'
} as const satisfies Record<keyof GameplayFeedbackCriticalSnapshot, string>;

export const GAMEPLAY_FEEDBACK_CRITICAL_FIELDS = Object.keys(
    GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES
) as (keyof GameplayFeedbackCriticalSnapshot)[];

export const getGameplayFeedbackObjectiveSnapshot = (
    run: RunState
): GameplayFeedbackObjectiveSnapshot | null => {
    const dungeonPresentation = getDungeonBoardPresentation(run);
    if (run.status !== 'levelComplete' && dungeonPresentation.visible) {
        const objective = getDungeonObjectiveStatus(run);
        return {
            label: objective.label,
            progress: runNonNegativeInteger(objective.progress),
            required: runNonNegativeInteger(objective.required)
        };
    }

    const traitRoute = getTraitRouteObjectiveStatus(run);
    return traitRoute
        ? {
              label: traitRoute.label,
              progress: runNonNegativeInteger(traitRoute.progress),
              required: runNonNegativeInteger(traitRoute.required)
          }
        : null;
};

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
        shopGold: runNonNegativeInteger(run.shopGold),
        dungeonKeys: {
            iron: runNonNegativeInteger(run.dungeonKeys?.iron),
            treasure: runNonNegativeInteger(run.dungeonKeys?.treasure),
            shrine: runNonNegativeInteger(run.dungeonKeys?.shrine),
            boss: runNonNegativeInteger(run.dungeonKeys?.boss),
            trap: runNonNegativeInteger(run.dungeonKeys?.trap),
            master: runNonNegativeInteger(run.dungeonMasterKeys)
        },
        shuffleCharges: runNonNegativeInteger(run.shuffleCharges),
        regionShuffleCharges: runNonNegativeInteger(run.regionShuffleCharges),
        destroyPairCharges: runNonNegativeInteger(run.destroyPairCharges),
        peekCharges: runNonNegativeInteger(run.peekCharges),
        flashPairCharges: runNonNegativeInteger(run.flashPairCharges),
        strayRemoveCharges: runNonNegativeInteger(run.strayRemoveCharges),
        relicFavorProgress: runNonNegativeInteger(run.relicFavorProgress),
        pinnedTileCount: runArrayCount(run.pinnedTileIds),
        objective: getGameplayFeedbackObjectiveSnapshot(run),
        recallFocus: runNonNegativeInteger(run.recallFocus),
        recallMatchesThisFloor: runNonNegativeInteger(run.recallMatchesThisFloor),
        recallMistakesThisFloor: runNonNegativeInteger(run.recallMistakesThisFloor),
        recallBonusScoreThisFloor: runNonNegativeInteger(run.recallBonusScoreThisFloor),
        forgottenTileCountThisFloor: runArrayCount(run.forgottenTileIdsThisFloor),
        dungeonEnemiesDefeatedThisFloor: runNonNegativeInteger(run.dungeonEnemiesDefeatedThisFloor),
        enemyHazardHitsThisFloor: runNonNegativeInteger(run.enemyHazardHitsThisFloor),
        enemyHazardsDefeatedThisFloor: runNonNegativeInteger(run.enemyHazardsDefeatedThisFloor)
    };
};
