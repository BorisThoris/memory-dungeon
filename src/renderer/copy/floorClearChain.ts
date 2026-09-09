import type { LevelResult } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

/**
 * The floor-clear beat's lines (thesis §41.4): what the floor was, how it went against par, what
 * it paid and why. One line each, nothing when the result predates the field it reads.
 */
const TIER_MULT_WORD: Record<NonNullable<LevelResult['momentumBonusTier']>, string> = {
    none: 'cleared cold',
    clean: 'Clean ×1.5',
    sharp: 'Sharp ×2.5',
    fever: 'Fever ×5'
};

export const FLOOR_CLEAR_COPY = {
    /** `Floor 3 cleared`. */
    titleLine: (level: number): string => `Floor ${runNonNegativeInteger(level)} cleared`,
    /** The marker when the cleared floor is deeper than any the profile has seen. */
    personalBest: 'New deepest floor',
    /** `+1,234`: what the floor paid, bonus included. */
    scoreLine: (scoreGained: number): string => `+${runNonNegativeInteger(scoreGained).toLocaleString()}`,
    runTotalLine: (totalScore: number): string => `Run total ${runNonNegativeInteger(totalScore).toLocaleString()}`,
    /** `4 turns, par 5`: the floor's turns against its stated par (thesis §41.3). */
    parLine: (result: LevelResult): string | null => {
        if (result.parTurns == null || result.turnsTaken == null) return null;
        const turns = runNonNegativeInteger(result.turnsTaken);
        return `${turns} ${turns === 1 ? 'turn' : 'turns'}, par ${runNonNegativeInteger(result.parTurns)}`;
    },
    /**
     * The floor-end bonus, term by term: what the clear paid, the tier that multiplied it, and
     * the turns under par that added to it. Nothing when the result predates the bonus.
     */
    bonusLine: (result: LevelResult): string | null => {
        if (result.floorBonus == null) return null;
        const tier = result.momentumBonusTier ?? 'none';
        const efficiency = runNonNegativeInteger(result.floorEfficiencyBonus);
        const under = Math.max(0, runNonNegativeInteger(result.parTurns) - runNonNegativeInteger(result.turnsTaken));
        const terms = [`Floor bonus +${runNonNegativeInteger(result.floorBonus).toLocaleString()}: ${TIER_MULT_WORD[tier]}`];
        if (efficiency > 0) {
            terms.push(`${under} under par +${efficiency.toLocaleString()}`);
        }
        return `${terms.join(' · ')}.`;
    }
} as const;
