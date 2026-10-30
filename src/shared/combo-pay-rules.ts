import { chainMomentum, chainTierRungs, getChainTier, runChainMomentumPairs, runLadderChain, type ChainMomentumRun } from './chain-tier-rules';
import { chainRungScoreMultiplier } from './chain-rung-value-rules';
import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The combo pays (rules 106, 2026-10-30).
 *
 * The owner, after the crawl was stripped: "the combo system needs to be made really addictive".
 * Until now the combo added ten score a link (`calculateMatchScore`), the ladder's "x8" multiplied
 * only the pairs a pop took, and score buys nothing in the Descent. The HUD's biggest number was not
 * what the player was paid, and the streak paid nothing they could spend. So from rules 106:
 *
 *   - **A match is paid at the ladder's multiplier**: x1 Lone, x2 Clean, x4 Sharp, x8 Fever, the same
 *     numbers the rungs already wore (`chainRungScoreMultiplier`), on the same floor-sized rungs
 *     (`chainTierRungs`). Past Fever it climbs without end, one more for every
 *     `COMBO_PAST_FEVER_STEP` links of momentum past the Fever rung. The ten a link goes: the
 *     multiplier is the streak's pay now, and paying both would count the streak twice.
 *   - **A rung reached pays gold**: every time a match lifts the multiplier, the purse takes
 *     `COMBO_RUNG_GOLD` for each step it climbed. A streak buys the store's items.
 *
 * The pairs a pop takes keep their own rung multiplier (`chunk-break-rules.ts`); this multiplies the
 * match's own pay, so nothing is counted twice.
 */
export const COMBO_PAYS_FROM = 106;
/** Links of momentum past the Fever rung for each further step of the multiplier. */
export const COMBO_PAST_FEVER_STEP = 3;
/** Gold for each step the multiplier climbs on a match. */
export const COMBO_RUNG_GOLD = 1;

export const comboPays = (run: Pick<RunState, 'runRulesVersion'>): boolean => runNonNegativeInteger(run.runRulesVersion) >= COMBO_PAYS_FROM;

/** The multiplier a match is paid at, for this momentum on a floor of `pairsOnFloor` pairs. */
export const comboMultiplierFor = (momentum: number, pairsOnFloor: number | null | undefined): number => {
    const depth = runNonNegativeInteger(momentum);
    const tier = getChainTier(depth, pairsOnFloor);
    if (tier !== 'fever') return chainRungScoreMultiplier(tier);
    const past = depth - chainTierRungs(pairsOnFloor).fever;
    return chainRungScoreMultiplier('fever') + Math.floor(past / COMBO_PAST_FEVER_STEP);
};

/** The steps of the ladder up to this multiplier: x1 is the first, x2, x4, x8 the next three, then one a step. */
const comboStep = (multiplier: number): number => {
    const fever = chainRungScoreMultiplier('fever');
    if (multiplier >= fever) return 3 + (multiplier - fever);
    if (multiplier >= chainRungScoreMultiplier('sharp')) return 2;
    if (multiplier >= chainRungScoreMultiplier('clean')) return 1;
    return 0;
};

/** The run's live multiplier: what its next match would be paid at if the streak held where it stands. */
export const runComboMultiplier = (run: Pick<RunState, 'stats' | 'board' | 'runRulesVersion'> & ChainMomentumRun): number =>
    comboPays(run) ? comboMultiplierFor(chainMomentum(runLadderChain(run), runChainMomentumPairs(run)), run.board?.pairCount ?? null) : 1;

/** The gold a match pays for the steps it climbed, from the run before it to the run after it. */
export const comboRungGold = (
    before: Pick<RunState, 'stats' | 'board' | 'runRulesVersion'> & ChainMomentumRun,
    after: Pick<RunState, 'stats' | 'board' | 'runRulesVersion'> & ChainMomentumRun
): number => {
    if (!comboPays(after)) return 0;
    const pairs = after.board?.pairCount ?? null;
    const from = comboStep(comboMultiplierFor(chainMomentum(runLadderChain(before), runChainMomentumPairs(before)), pairs));
    const to = comboStep(comboMultiplierFor(chainMomentum(runLadderChain(after), runChainMomentumPairs(after)), pairs));
    return Math.max(0, to - from) * COMBO_RUNG_GOLD;
};
