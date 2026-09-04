import type { RunSummary, SaveData } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Did this run beat the player's own record?
 *
 * Game Over has always listed Best Score as a stat and never said the run just set it, which is
 * the one moment a score-chasing game owes the player a sentence. The comparison has to be against
 * the best as it stood *when the run started*: by the time this screen renders, the save has
 * already taken the new score, so `summary.bestScore` is the new record and comparing to it would
 * call every run a personal best.
 *
 * A practice run is excluded. It does not count towards achievements, and telling somebody they
 * set a record in a mode that is explicitly not ranked would be a lie dressed as a reward.
 */

export type PersonalBestResult = 'beaten' | 'matched' | null;

export const personalBestResult = ({
    achievementsEnabled,
    saveAtRunStart,
    summary
}: {
    achievementsEnabled: boolean;
    saveAtRunStart: SaveData | null | undefined;
    summary: RunSummary | null;
}): PersonalBestResult => {
    if (!summary || !achievementsEnabled || !saveAtRunStart) {
        return null;
    }
    const score = runNonNegativeInteger(summary.totalScore);
    const previous = runNonNegativeInteger(saveAtRunStart.bestScore);
    if (score <= 0) {
        return null;
    }
    if (score > previous) {
        return 'beaten';
    }
    // A first run has no record to match, so equalling zero is not an achievement.
    return score === previous && previous > 0 ? 'matched' : null;
};
