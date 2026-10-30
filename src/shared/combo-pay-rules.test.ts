import { describe, expect, it } from 'vitest';
import { chainTierRungs } from './chain-tier-rules';
import { COMBO_PAST_FEVER_STEP, COMBO_PAYS_FROM, COMBO_RUNG_GOLD, comboMultiplierFor, comboRungGold, runComboMultiplier } from './combo-pay-rules';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';

const playing = (version: number): RunState => ({ ...finishMemorizePhase(createNewRun(0, { runSeed: 7 })), runRulesVersion: version });

/** One match: the first hidden card and its partner. */
const matchOnce = (run: RunState): RunState => {
    const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden');
    const first = hidden[0]!;
    const partner = hidden.find((tile) => tile.id !== first.id && tile.pairKey === first.pairKey)!;
    return resolveBoardTurn(flipTile(flipTile(run, first.id), partner.id));
};

describe('the combo pays (rules 106)', () => {
    it('pays a match at the multiplier the ladder wears, and climbs past Fever without end', () => {
        const rungs = chainTierRungs(12);
        expect(comboMultiplierFor(0, 12)).toBe(1);
        expect(comboMultiplierFor(rungs.clean, 12)).toBe(2);
        expect(comboMultiplierFor(rungs.sharp, 12)).toBe(4);
        expect(comboMultiplierFor(rungs.fever, 12)).toBe(8);
        expect(comboMultiplierFor(rungs.fever + COMBO_PAST_FEVER_STEP, 12)).toBe(9);
        expect(comboMultiplierFor(rungs.fever + COMBO_PAST_FEVER_STEP * 50, 12)).toBe(58);
    });

    it('pays gold for each step a match climbs, and none for a match that stays on its rung', () => {
        const rungs = chainTierRungs(12);
        const at = (streak: number): RunState => {
            const run = playing(COMBO_PAYS_FROM);
            return { ...run, board: { ...run.board!, pairCount: 12 }, stats: { ...run.stats, currentStreak: streak }, chunkPairsThisChain: 0, skipMomentumThisChain: 0 };
        };
        expect(comboRungGold(at(rungs.clean - 1), at(rungs.clean))).toBe(COMBO_RUNG_GOLD);
        expect(comboRungGold(at(rungs.clean), at(rungs.clean + 1))).toBe(0);
        expect(comboRungGold(at(rungs.sharp - 1), at(rungs.fever))).toBe(2 * COMBO_RUNG_GOLD);
        expect(comboRungGold(at(rungs.fever + COMBO_PAST_FEVER_STEP - 1), at(rungs.fever + COMBO_PAST_FEVER_STEP))).toBe(COMBO_RUNG_GOLD);
        expect(comboRungGold({ ...at(rungs.clean - 1), runRulesVersion: COMBO_PAYS_FROM - 1 }, { ...at(rungs.clean), runRulesVersion: COMBO_PAYS_FROM - 1 })).toBe(0);
        expect(runComboMultiplier({ ...at(rungs.fever), runRulesVersion: COMBO_PAYS_FROM - 1 })).toBe(1);
        expect(runComboMultiplier(at(rungs.fever))).toBe(8);
    });

    it('in play: the third match of a floor reaches Clean, is paid double and drops a coin', () => {
        let run = playing(COMBO_PAYS_FROM);
        run = matchOnce(matchOnce(run));
        const before = run;
        run = matchOnce(run);
        expect(run.stats.currentStreak).toBe(3);
        expect(runComboMultiplier(run)).toBe(2);
        expect(run.gold! - (before.gold ?? 0)).toBe(COMBO_RUNG_GOLD);
        expect(run.comboRungGold).toBe(COMBO_RUNG_GOLD);
        // Rules 105 paid the same match ten a link and no coin.
        let old = playing(COMBO_PAYS_FROM - 1);
        old = matchOnce(matchOnce(old));
        const oldGold = old.gold ?? 0;
        old = matchOnce(old);
        expect((old.gold ?? 0) - oldGold).toBe(0);
    });
});
