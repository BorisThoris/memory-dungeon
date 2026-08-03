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

export interface GameplayFeedbackCriticalSnapshot {
    lives: number;
    guardTokens: number;
    comboShards: number;
    shopGold: number;
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
        shopGold: runNonNegativeInteger(run.shopGold),
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
