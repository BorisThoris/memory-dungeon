import type { RunState } from './contracts';
import { hasMutator } from './mutators';
import { runNonNegativeInteger } from './run-number-guards';

export interface TurnMatchFollowupResult {
    nBackMatchCounter: number;
    nBackAnchorPairKey: string | null;
}

export interface TurnMatchFollowupInput {
    run: RunState;
    encoreKey: string;
}

export const resolveTurnMatchFollowup = ({
    run,
    encoreKey
}: TurnMatchFollowupInput): TurnMatchFollowupResult => {
    const nBackMatchCounter = runNonNegativeInteger(run.nBackMatchCounter) + 1;
    const nBackAnchorPairKey =
        hasMutator(run, 'n_back_anchor') && nBackMatchCounter % 2 === 0 ? encoreKey : run.nBackAnchorPairKey;

    return {
        nBackMatchCounter,
        nBackAnchorPairKey
    };
};
