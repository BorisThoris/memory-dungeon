import { type RelicId, type RunState } from './contracts';
import { hasMutator } from './mutators';
import { runRelicIds } from './relics';
import { runNonNegativeInteger } from './run-number-guards';

export interface ScoreParasiteFloorAdvance {
    lives: number;
    parasiteFloors: number;
    parasiteWardRemaining: number;
}

const hasRunRelic = (run: RunState, relicId: RelicId): boolean =>
    runRelicIds(run.relicIds).includes(relicId);

export const advanceScoreParasiteFloor = (run: RunState): ScoreParasiteFloorAdvance => {
    let parasiteFloors = runNonNegativeInteger(run.parasiteFloors) + 1;
    let lives = runNonNegativeInteger(run.lives);
    let parasiteWardRemaining = runNonNegativeInteger(run.parasiteWardRemaining);

    if (hasMutator(run, 'score_parasite') && parasiteFloors >= 4) {
        parasiteFloors = 0;
        if (parasiteWardRemaining > 0) {
            parasiteWardRemaining -= 1;
        } else {
            lives = Math.max(0, lives - 1);
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
    featuredObjectiveCompleted: boolean
): number => {
    if (
        featuredObjectiveCompleted &&
        hasRunRelic(run, 'parasite_ledger') &&
        hasMutator(run, 'score_parasite')
    ) {
        return Math.max(0, runNonNegativeInteger(run.parasiteFloors) - 1);
    }

    return runNonNegativeInteger(run.parasiteFloors);
};
