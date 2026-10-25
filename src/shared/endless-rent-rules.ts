import type { RunState } from './contracts';
import { endlessPlaceForLevel } from './floor-mutator-schedule';
import { pairsForFloor } from './pair-curve';
import { calculateMatchScore } from './scoring-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { descentFloorFor } from './descent-length-rules';

/**
 * Endless's rent (DGE-006 part 2, 2026-10-20): each floor past the Warden must pay a score before
 * it lets the run go on, and the rent rises every cycle, so an Endless run has a reason to end. It is
 * a score bar, never a clock: it is stated on the run bar before the first flip and filled as the
 * floor pays, and only a clear that falls short ends the run (`rent_unpaid`).
 *
 * The rent is a share of a reference no player's form moves: the floor's pairs cleared at the Clean
 * rung from a standing start (`calculateMatchScore`). Measured 2026-10-20 (40 careful and 40 average
 * soak runs to floor 100), the slowest tenth of floors pay 4.2 to 6.1 references at every depth, so
 * the share starts at half a reference and rises 1.25x a cycle: a clean floor pays the rent until
 * cycle 4, and even the soak's careful player starts falling short around cycle 11.
 */
export const ENDLESS_RENT_SHARE = 0.5;
export const ENDLESS_RENT_GROWTH = 1.25;

/** What a floor pays cleared at the Clean rung (x2) from a standing start. */
const cleanFloorReference = (level: number, rulesVersion: number): number => {
    const pairs = pairsForFloor(level, rulesVersion);
    let total = 0;
    for (let streak = 0; streak < pairs; streak += 1) total += calculateMatchScore(level, streak, 2);
    return total;
};

/** The score an Endless floor owes; zero on the Descent. */
export const endlessRentForFloor = (level: number, rulesVersion: number): number => {
    // The shorter Descent (`descent-length-rules.ts`): Endless begins past floor 40, where 61 did.
    const place = endlessPlaceForLevel(descentFloorFor(level, rulesVersion));
    if (!place) return 0;
    return Math.round(ENDLESS_RENT_SHARE * ENDLESS_RENT_GROWTH ** (place.cycle - 1) * cleanFloorReference(level, rulesVersion));
};

/** The rent the run's floor owes, and how much of it the floor has paid: null off Endless. */
export const endlessRentDue = (run: Pick<RunState, 'endless' | 'board' | 'runRulesVersion' | 'stats'>): { rent: number; paid: number } | null => {
    if (!run.endless || !run.board) return null;
    const rent = endlessRentForFloor(run.board.level, run.runRulesVersion);
    return rent > 0 ? { rent, paid: runNonNegativeInteger(run.stats.currentLevelScore) } : null;
};

/** A cleared Endless floor that paid less than its rent ends the run there. */
export const settleEndlessRent = (cleared: RunState, scoreGained: number): RunState => {
    if (!cleared.endless || cleared.status !== 'levelComplete' || !cleared.board) return cleared;
    const rent = endlessRentForFloor(cleared.board.level, cleared.runRulesVersion);
    return rent > 0 && runNonNegativeInteger(scoreGained) < rent ? { ...cleared, status: 'gameOver', runEndReason: 'rent_unpaid' } : cleared;
};
