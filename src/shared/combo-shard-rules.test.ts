import { describe, expect, it } from 'vitest';
import { MAX_COMBO_SHARDS, MAX_LIVES } from './contracts';
import {
    COMBO_SHARDS_PER_LIFE,
    COMBO_SHARD_STREAK_STEP,
    applyComboShardGain
} from './combo-shard-rules';

describe('combo-shard-rules', () => {
    it('keeps shard state unchanged when no shard gain is awarded', () => {
        expect(applyComboShardGain(1, 2, 0)).toEqual({ comboShards: 1, lifeGain: 0 });
        expect(applyComboShardGain(1, 2, -1)).toEqual({ comboShards: 1, lifeGain: 0 });
    });

    it('banks shards up to the combo-shard cap when life gain is unavailable', () => {
        expect(applyComboShardGain(1, MAX_LIVES, 4)).toEqual({
            comboShards: MAX_COMBO_SHARDS,
            lifeGain: 0
        });
        expect(applyComboShardGain(1, 2, 4, false)).toEqual({
            comboShards: MAX_COMBO_SHARDS,
            lifeGain: 0
        });
    });

    it('converts a full shard set into one life when life gain is allowed', () => {
        expect(applyComboShardGain(COMBO_SHARDS_PER_LIFE - 1, MAX_LIVES - 1, 1)).toEqual({
            comboShards: 0,
            lifeGain: 1
        });
    });

    it('exports the match streak cadence for match-resolution reward code', () => {
        expect(COMBO_SHARD_STREAK_STEP).toBe(2);
    });
});
