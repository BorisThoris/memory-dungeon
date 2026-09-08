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

export const FLOOR_CLEAR_CHAIN_COPY = {
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
