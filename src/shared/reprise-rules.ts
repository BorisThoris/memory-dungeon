import type { RepriseTurn, RunState } from './contracts';
import { hasEvolution } from './relic-evolution-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { verbReached } from './verb-staircase-rules';

/**
 * Reprise (DGE-019, rules 83): a competence reward, from floor 11 since rules 89 (`verb-staircase-rules.ts`; the Abyss's before).
 *
 * From floor 41, once a floor and between turns, Reprise pays the floor's last three turns again, in
 * the order they were played: a match scores what it scored and adds its link to the chain; a miss
 * costs its miss again (`miss-bank.ts`) and breaks the chain. No card moves and no turn is counted,
 * so it is worth pressing only after three good turns - the player who plays well gets to play more.
 * The Echo Chamber evolution (`relic-evolution-rules.ts`) replays five. The owner chose the outcome
 * reading over replaying cells or cards (2026-10-22). The plan called it Echo; it is Reprise because the
 * Echo tile trait and the Echo feedback setting already use the word (the owner, 2026-10-22).
 *
 * `applyMiss` is the miss bank's charge, passed in so this module stays below the bank in the
 * import graph (the bank imports the evolutions, which this reads).
 */
export const REPRISE_FROM = 83;
export const REPRISE_TURNS = 3;
export const ECHO_CHAMBER_TURNS = 5;
/** How many turns the floor keeps for a Reprise: the longest one. */
export const REPRISE_MEMORY = ECHO_CHAMBER_TURNS;

export const repriseTurnsFor = (run: Pick<RunState, 'evolutions'>): number => (hasEvolution(run, 'echo_chamber') ? ECHO_CHAMBER_TURNS : REPRISE_TURNS);

export const isRepriseUnlocked = (run: Pick<RunState, 'board' | 'runRulesVersion'>): boolean =>
    (run.runRulesVersion ?? 0) >= REPRISE_FROM && verbReached('reprise', run);

/** Whether Reprise can be pressed: between turns, unlocked, unused this floor, with turns enough to replay. */
export const canReprise = (run: RunState): boolean =>
    run.status === 'playing' &&
    !!run.board &&
    run.board.flippedTileIds.length === 0 &&
    isRepriseUnlocked(run) &&
    !run.repriseUsedThisFloor &&
    (run.repriseTurns ?? []).length >= repriseTurnsFor(run);

/** Applied after every resolved turn: the floor remembers what the turn paid, the last five. */
export const recordRepriseTurn = (before: RunState, after: RunState): RunState => {
    if ((after.runRulesVersion ?? 0) < REPRISE_FROM || !after.board || !before.board || after.board.level !== before.board.level) return after;
    if (runNonNegativeInteger(after.turnsThisFloor) === runNonNegativeInteger(before.turnsThisFloor)) return after;
    const missed = runNonNegativeInteger(after.stats.mismatches) > runNonNegativeInteger(before.stats.mismatches);
    const turn: RepriseTurn = missed
        ? { matched: false, score: 0 }
        : { matched: true, score: Math.max(0, runNonNegativeInteger(after.stats.totalScore) - runNonNegativeInteger(before.stats.totalScore)) };
    return { ...after, repriseTurns: [...(after.repriseTurns ?? []), turn].slice(-REPRISE_MEMORY) };
};

/** Reprise: the last turns paid again, in order. A miss in them charges the bank, which may end the run. */
export const reprise = (run: RunState, applyMiss: (before: RunState, after: RunState) => RunState): RunState => {
    if (!canReprise(run)) return run;
    const replayed = (run.repriseTurns ?? []).slice(-repriseTurnsFor(run));
    let next: RunState = { ...run, repriseUsedThisFloor: true, reprisesThisRun: runNonNegativeInteger(run.reprisesThisRun) + 1 };
    for (const turn of replayed) {
        if (next.status !== 'playing') break;
        if (turn.matched) {
            const streak = runNonNegativeInteger(next.stats.currentStreak) + 1;
            next = {
                ...next,
                stats: {
                    ...next.stats,
                    totalScore: runNonNegativeInteger(next.stats.totalScore) + turn.score,
                    currentLevelScore: runNonNegativeInteger(next.stats.currentLevelScore) + turn.score,
                    currentStreak: streak,
                    bestStreak: Math.max(runNonNegativeInteger(next.stats.bestStreak), streak)
                }
            };
        } else {
            const missed: RunState = {
                ...next,
                stats: { ...next.stats, mismatches: runNonNegativeInteger(next.stats.mismatches) + 1, tries: runNonNegativeInteger(next.stats.tries) + 1, currentStreak: 0 }
            };
            next = applyMiss(next, missed);
        }
    }
    return next;
};
