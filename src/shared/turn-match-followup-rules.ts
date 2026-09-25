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
    // The anchor itself is chosen on the post-turn board in `n-back-anchor-rules.ts`; this only keeps
    // the key it had, for callers that read the follow-up alone.
    void encoreKey;
    const nBackAnchorPairKey = hasMutator(run, 'n_back_anchor') ? run.nBackAnchorPairKey : null;

    return {
        nBackMatchCounter,
        nBackAnchorPairKey
    };
};
