import { type RelicId, type RunState } from './contracts';
import { hasMutator } from './mutators';

export interface ScoreParasiteFloorAdvance {
    lives: number;
    parasiteFloors: number;
    parasiteWardRemaining: number;
}

const nonNegativeParasiteCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const hasRunRelic = (run: RunState, relicId: RelicId): boolean =>
    Array.isArray(run.relicIds) && run.relicIds.includes(relicId);

export const advanceScoreParasiteFloor = (run: RunState): ScoreParasiteFloorAdvance => {
    let parasiteFloors = nonNegativeParasiteCount(run.parasiteFloors) + 1;
    let lives = nonNegativeParasiteCount(run.lives);
    let parasiteWardRemaining = nonNegativeParasiteCount(run.parasiteWardRemaining);

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
        return Math.max(0, nonNegativeParasiteCount(run.parasiteFloors) - 1);
    }

    return nonNegativeParasiteCount(run.parasiteFloors);
};
