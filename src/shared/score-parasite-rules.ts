import type { RunState } from './contracts';
import { hasMutator } from './mutators';
import { hasRunRelic } from './relics';
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

export const getParasiteFloorsAfterFeaturedObjectiveClear = (
    run: RunState,
    featuredObjectiveCompleted: boolean,
    options: { reliefAmount?: number } = {}
): number => {
    if (
        featuredObjectiveCompleted &&
        hasRunRelic(run, 'parasite_ledger') &&
        hasMutator(run, 'score_parasite')
    ) {
        return Math.max(
            0,
            runNonNegativeInteger(run.parasiteFloors) - runNonNegativeInteger(options.reliefAmount ?? 1)
        );
    }

    return runNonNegativeInteger(run.parasiteFloors);
};
