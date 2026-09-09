import type { LevelResult } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

/**
 * The chain's line on the floor-clear dialog: what the chunks did this floor, and what the
 * momentum still standing paid at the end (Extreme Fever). One line, nothing when the floor
 * had no chain to speak of.
 */
const TIER_WORD: Record<NonNullable<LevelResult['momentumBonusTier']>, string> = {
    none: '',
    clean: 'Clean finish',
    sharp: 'Sharp finish',
    fever: 'Extreme Fever'
};

const TIER_MULT_WORD: Record<NonNullable<LevelResult['momentumBonusTier']>, string> = {
    none: 'cleared cold',
    clean: 'Clean ×1.5',
    sharp: 'Sharp ×2.5',
    fever: 'Fever ×5'
};

export const FLOOR_CLEAR_CHAIN_COPY = {
    /** `4 turns, par 5`: the floor's turns against its stated par (thesis §41.4). */
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
    },
    recapLine: (result: LevelResult): string | null => {
        const breaks = runNonNegativeInteger(result.chunkBreaks);
        const pairs = runNonNegativeInteger(result.chunkPairsBroken);
        const fever = runNonNegativeInteger(result.feverBreaks);
        const best = runNonNegativeInteger(result.bestChain);
        const parts: string[] = [];
        if (best > 0) parts.push(`Best chain ×${best}`);
        if (breaks > 0) parts.push(`${breaks} ${breaks === 1 ? 'chunk' : 'chunks'}, ${pairs} ${pairs === 1 ? 'pair' : 'pairs'} cascaded`);
        if (fever > 0) parts.push(`Fever ×${fever}`);
        const tier = result.momentumBonusTier ?? 'none';
        const shards = runNonNegativeInteger(result.momentumBonusShards);
        if (tier !== 'none' && shards > 0) {
            const paid = `+${shards} ${shards === 1 ? 'shard' : 'shards'}`;
            parts.push(`${TIER_WORD[tier]} at momentum ${runNonNegativeInteger(result.chainMomentumAtClear)}: ${paid}`);
        }
        return parts.length === 0 ? null : `${parts.join(' · ')}.`;
    }
} as const;
