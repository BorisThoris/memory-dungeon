import type { RunState } from './contracts';
import { hasMutator } from './mutators';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

export interface ScoreParasiteFloorAdvance {
    lives: number;
    parasiteFloors: number;
}

export const advanceScoreParasiteFloor = (run: RunState): ScoreParasiteFloorAdvance => {
    let parasiteFloors = runNonNegativeInteger(run.parasiteFloors) + 1;
    let lives = runNonNegativeInteger(run.lives);

    if (hasMutator(run, 'score_parasite') && parasiteFloors >= 4) {
        parasiteFloors = 0;
        lives = decrementRunCounter(lives);
    }

    return {
        lives,
        parasiteFloors
    };
};
