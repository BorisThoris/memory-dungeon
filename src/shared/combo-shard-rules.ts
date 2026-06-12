import { MAX_COMBO_SHARDS, MAX_LIVES } from './contracts';

export const COMBO_SHARD_STREAK_STEP = 2;
export const COMBO_SHARDS_PER_LIFE = 3;

export interface ComboShardGainResult {
    comboShards: number;
    lifeGain: number;
}

export const applyComboShardGain = (
    comboShards: number,
    lives: number,
    shardGain: number,
    allowLifeGain: boolean = true
): ComboShardGainResult => {
    if (shardGain <= 0) {
        return { comboShards, lifeGain: 0 };
    }

    const nextComboShards = comboShards + shardGain;

    if (allowLifeGain && lives < MAX_LIVES && nextComboShards >= COMBO_SHARDS_PER_LIFE) {
        return {
            comboShards: nextComboShards - COMBO_SHARDS_PER_LIFE,
            lifeGain: 1
        };
    }

    return {
        comboShards: Math.min(MAX_COMBO_SHARDS, nextComboShards),
        lifeGain: 0
    };
};
