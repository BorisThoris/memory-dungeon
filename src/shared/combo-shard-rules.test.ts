import { describe, expect, it } from 'vitest';
import { MAX_COMBO_SHARDS } from './contracts';
import { COMBO_SHARD_STREAK_STEP, applyComboShardGain } from './combo-shard-rules';

describe('combo-shard-rules', () => {
    it('keeps shard state unchanged when no shard gain is awarded', () => {
        expect(applyComboShardGain(1, 0)).toEqual({ comboShards: 1 });
        expect(applyComboShardGain(1, -1)).toEqual({ comboShards: 1 });
    });

    it('banks shards up to the combo-shard cap', () => {
        expect(applyComboShardGain(1, 4)).toEqual({ comboShards: MAX_COMBO_SHARDS });
        expect(applyComboShardGain(0, 1)).toEqual({ comboShards: 1 });
    });

    it('exports the match streak cadence for match-resolution reward code', () => {
        expect(COMBO_SHARD_STREAK_STEP).toBe(2);
    });
});
