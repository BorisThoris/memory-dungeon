import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

/**
 * Cash in (prototype, the owner's pick on 2026-11-01 of four combo shapes: "push your luck").
 *
 * Behind `?combo2=1` only (`run.comboCashIn`), so a run without the flag plays exactly as before.
 * The combo has paid since rules 106: every match at the ladder's multiplier, and a step of the
 * multiplier reached drops gold. A miss only cost the rate of the matches to come, so a hot streak
 * had nothing on the table and no decision in it. Here the streak's own pay is held instead:
 *
 *   - A match banks what it would have paid at x1. What the multiplier adds on top of that, and
 *     the gold a rung pays, go into the **pot** (`run.comboPot`), shown under the combo.
 *   - Between turns, **Cash in** banks the pot (score and gold) and the combo **halves**
 *     (`COMBO_BANK_KEEPS`): the ladder drops a way, not to the floor.
 *   - A miss that breaks the combo **loses the pot**. So every hot turn asks the player one thing:
 *     do I trust my memory once more?
 *
 * Ignite (the Zone) also ends the combo, by choice, so it banks the pot first. The pot crosses
 * floors with the combo it belongs to.
 */
export interface ComboPot {
    score: number;
    gold: number;
}

/** The last pot a miss took: the HUD and the stamp say what went. */
export interface ComboPotLoss extends ComboPot {
    key: string;
}

export const EMPTY_COMBO_POT: ComboPot = { score: 0, gold: 0 };

/**
 * The share of the combo a bank keeps. Measured 2026-11-02 against a player who knows when they are
 * unsure (sure turns miss 3%, unsure 45%): with a bank that zeroed the combo, banking cost the whole
 * multiplier, so the best play was a fixed count and banking when unsure was the worst policy. Kept
 * at a half, banking when unsure with a pot past ~500 is the best policy at 15% and 20% misses
 * (37,211 against 33,719 for the best count at 15%): the bank answers the player's memory, which
 * is what the owner asked the combo to do (`tasks/back-to-the-base/01-cash-in.md`).
 */
export const COMBO_BANK_KEEPS = 0.5;

/** What a bank leaves of a count: the combo, its cascaded pairs, its skip momentum. */
export const bankKeeps = (value: number | null | undefined): number => Math.floor(runNonNegativeInteger(value) * COMBO_BANK_KEEPS);

export const comboCashInActive = (run: Pick<RunState, 'comboCashIn'>): boolean => run.comboCashIn === true;

export const runComboPot = (run: Pick<RunState, 'comboPot'>): ComboPot => ({
    score: runNonNegativeInteger(run.comboPot?.score),
    gold: runNonNegativeInteger(run.comboPot?.gold)
});

export const comboPotHasValue = (pot: ComboPot): boolean => pot.score > 0 || pot.gold > 0;

/** The share of a match's pay the multiplier added: what goes in the pot. */
export const comboPotShare = (matchScore: number, multiplier: number): number => {
    const score = runNonNegativeInteger(matchScore);
    const m = Math.max(1, Number.isFinite(multiplier) ? multiplier : 1);
    return m <= 1 ? 0 : score - Math.floor(score / m);
};

/**
 * A match under cash-in: take the multiplier's share of its score and the rung gold it paid back
 * out of the bank and into the pot. `after` is the run the match produced from `before`, already paid in full.
 */
export const potMatch = (before: RunState, after: RunState, matchScore: number, multiplier: number, rungGold: number): RunState => {
    if (!comboCashInActive(after)) return after;
    const share = Math.min(comboPotShare(matchScore, multiplier), runNonNegativeInteger(after.stats.totalScore));
    const gold = Math.min(runNonNegativeInteger(rungGold), runNonNegativeInteger(after.gold));
    if (share === 0 && gold === 0) return after;
    const pot = runComboPot(after);
    const stats = normalizeSessionStats(after.stats);
    return {
        ...after,
        gold: runNonNegativeInteger(after.gold) - gold,
        comboPot: { score: pot.score + share, gold: pot.gold + gold },
        stats: {
            ...stats,
            totalScore: stats.totalScore - share,
            currentLevelScore: Math.max(0, stats.currentLevelScore - share),
            // The record is what was banked: a pot never cashed was never scored.
            bestScore: Math.max(normalizeSessionStats(before.stats).bestScore, stats.totalScore - share)
        }
    };
};

/** A turn that broke the combo loses the pot. `before` and `after` are the runs either side of the turn. */
export const forfeitPotOnBreak = (before: RunState, after: RunState): RunState => {
    if (!comboCashInActive(after)) return after;
    const pot = runComboPot(before);
    const broke = runNonNegativeInteger(after.stats?.currentStreak) === 0 && runNonNegativeInteger(before.stats?.currentStreak) > 0;
    if (!broke || !comboPotHasValue(pot)) return after;
    const lost = runNonNegativeInteger(after.comboPotsLost) + 1;
    return { ...after, comboPot: null, comboPotsLost: lost, lastComboPotLoss: { ...pot, key: `pot-lost:${lost}` } };
};

/** Cash in is offered between turns, with something in the pot. */
export const canCashIn = (run: RunState): boolean =>
    comboCashInActive(run) &&
    run.status === 'playing' &&
    !run.zone &&
    (run.board?.flippedTileIds.length ?? 0) === 0 &&
    comboPotHasValue(runComboPot(run));

/** Bank the pot. The combo is left as it was: `cashInCombo` is what halves it. */
export const bankComboPot = (run: RunState): RunState => {
    const pot = runComboPot(run);
    if (!comboPotHasValue(pot)) return { ...run, comboPot: null };
    const stats = normalizeSessionStats(run.stats);
    const totalScore = stats.totalScore + pot.score;
    return {
        ...run,
        comboPot: null,
        gold: runNonNegativeInteger(run.gold) + pot.gold,
        comboCashIns: runNonNegativeInteger(run.comboCashIns) + 1,
        lastComboCashIn: { ...pot, key: `cash-in:${runNonNegativeInteger(run.comboCashIns) + 1}`, combo: stats.currentStreak },
        stats: {
            ...stats,
            totalScore,
            currentLevelScore: stats.currentLevelScore + pot.score,
            bestScore: Math.max(stats.bestScore, totalScore)
        }
    };
};

export const cashInCombo = (run: RunState): RunState => {
    if (!canCashIn(run)) return run;
    const banked = bankComboPot(run);
    const combo = bankKeeps(banked.stats.currentStreak);
    return {
        ...banked,
        chunkPairsThisChain: bankKeeps(banked.chunkPairsThisChain),
        skipMomentumThisChain: bankKeeps(banked.skipMomentumThisChain),
        comboLinksCarried: Math.min(combo, runNonNegativeInteger(banked.comboLinksCarried)),
        stats: { ...banked.stats, currentStreak: combo }
    };
};
