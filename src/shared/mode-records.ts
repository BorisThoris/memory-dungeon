import type { RunHistoryRecord } from './contracts';

/**
 * The player's best run in each mode they have actually played.
 *
 * `bestScore` is one number across everything, so a strong Gauntlet and a strong Classic run
 * compete for a single slot and the loser is invisible. The modes score differently on purpose — a
 * five-minute Gauntlet cannot reach a long Classic descent's total — which makes one shared record
 * a comparison the game never intended.
 *
 * Derived from the run history rather than stored: a record is a fact about the runs already kept,
 * and a second copy of it in the save is a second thing that can disagree.
 */

export interface ModeRecord {
    readonly mode: string;
    readonly totalScore: number;
    readonly highestLevel: number;
    readonly endedAtIso: string;
    /** How many recorded runs are in this mode, so a one-off record reads as one. */
    readonly runs: number;
}

const beats = (candidate: RunHistoryRecord, current: ModeRecord): boolean =>
    candidate.totalScore > current.totalScore ||
    // Same score, further in: the deeper run is the better one.
    (candidate.totalScore === current.totalScore && candidate.highestLevel > current.highestLevel);

/**
 * Best first, then by mode name so the order does not shuffle when two modes tie. Modes with no
 * recorded run are absent rather than listed at zero: a record you have never set is not a record.
 */
export const getModeRecords = (history: readonly RunHistoryRecord[]): ModeRecord[] => {
    const byMode = new Map<string, ModeRecord>();
    for (const entry of history) {
        const current = byMode.get(entry.mode);
        if (!current) {
            byMode.set(entry.mode, {
                endedAtIso: entry.endedAtIso,
                highestLevel: entry.highestLevel,
                mode: entry.mode,
                runs: 1,
                totalScore: entry.totalScore
            });
            continue;
        }
        byMode.set(entry.mode, {
            ...(beats(entry, current)
                ? {
                      endedAtIso: entry.endedAtIso,
                      highestLevel: entry.highestLevel,
                      mode: entry.mode,
                      totalScore: entry.totalScore
                  }
                : current),
            runs: current.runs + 1
        });
    }
    return [...byMode.values()].sort(
        (left, right) => right.totalScore - left.totalScore || left.mode.localeCompare(right.mode)
    );
};
