import type { RunState } from './contracts';
import { hasMutator } from './mutators';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

export interface ScoreParasiteFloorAdvance {
    lives: number;
    parasiteFloors: number;
    parasiteWardRemaining: number;
}

export const advanceScoreParasiteFloor = (run: RunState): ScoreParasiteFloorAdvance => {
    let parasiteFloors = runNonNegativeInteger(run.parasiteFloors) + 1;
    let lives = runNonNegativeInteger(run.lives);
    let parasiteWardRemaining = runNonNegativeInteger(run.parasiteWardRemaining);

    if (hasMutator(run, 'score_parasite') && parasiteFloors >= 4) {
        parasiteFloors = 0;
        if (parasiteWardRemaining > 0) {
            parasiteWardRemaining -= 1;
        } else {
            lives = decrementRunCounter(lives);
        }
    }

    return {
        lives,
        parasiteFloors,
        parasiteWardRemaining
    };
};

/**
 * A completed featured objective used to relieve parasite pressure through a relic no run carries
 * any more, so the pressure now simply carries over. The signature stays for
 * `floor-clear-transition.ts`.
 */
export const getParasiteFloorsAfterFeaturedObjectiveClear = (
    run: RunState,
    _featuredObjectiveCompleted: boolean,
    _options: { reliefAmount?: number } = {}
): number => runNonNegativeInteger(run.parasiteFloors);
