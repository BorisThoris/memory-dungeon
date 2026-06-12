import { type RunState } from './contracts';
import { hasMutator } from './mutators';

export interface ScoreParasiteFloorAdvance {
    lives: number;
    parasiteFloors: number;
    parasiteWardRemaining: number;
}

export const advanceScoreParasiteFloor = (run: RunState): ScoreParasiteFloorAdvance => {
    let parasiteFloors = run.parasiteFloors + 1;
    let lives = run.lives;
    let parasiteWardRemaining = run.parasiteWardRemaining;

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
        run.relicIds.includes('parasite_ledger') &&
        hasMutator(run, 'score_parasite')
    ) {
        return Math.max(0, run.parasiteFloors - 1);
    }

    return run.parasiteFloors;
};
