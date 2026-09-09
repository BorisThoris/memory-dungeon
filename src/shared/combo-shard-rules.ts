import { MAX_COMBO_SHARDS } from './contracts';

export const COMBO_SHARD_STREAK_STEP = 2;

export interface ComboShardGainResult {
    comboShards: number;
}

/** Shards bank to the cap. They bought a life until Gen 183; the bank itself goes in Gen 184. */
export const applyComboShardGain = (comboShards: number, shardGain: number): ComboShardGainResult => {
    if (shardGain <= 0) {
        return { comboShards };
    }
    return { comboShards: Math.min(MAX_COMBO_SHARDS, comboShards + shardGain) };
};
