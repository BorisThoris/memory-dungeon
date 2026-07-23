import { describe, expect, it } from 'vitest';
import {
    FINDABLE_MATCH_COMBO_SHARDS,
    FINDABLE_KIND_SPAWN_WEIGHTS,
    FINDABLE_MATCH_SAFE_HAZARD_WARDS,
    FINDABLE_MATCH_SCOUT_REVEALS,
    FINDABLE_MATCH_SCORE
} from './contracts';
import { getFindableRewardText, getFindableRows, getFindableSpawnWeightRows } from './findables';

describe('REG-049 findable reward copy', () => {
    it('keeps reward rows aligned with scoring constants', () => {
        expect(getFindableRows()).toEqual([
            {
                id: 'shard_spark',
                label: 'Shard spark',
                rewardText: '+1 combo shard',
                score: FINDABLE_MATCH_SCORE.shard_spark,
                comboShards: FINDABLE_MATCH_COMBO_SHARDS.shard_spark,
                safeHazardWards: FINDABLE_MATCH_SAFE_HAZARD_WARDS.shard_spark,
                scoutReveals: FINDABLE_MATCH_SCOUT_REVEALS.shard_spark,
                spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS.shard_spark,
                destroyText: 'Destroy forfeits the shard.'
            },
            {
                id: 'score_glint',
                label: 'Score glint',
                rewardText: '+25 score',
                score: FINDABLE_MATCH_SCORE.score_glint,
                comboShards: FINDABLE_MATCH_COMBO_SHARDS.score_glint,
                safeHazardWards: FINDABLE_MATCH_SAFE_HAZARD_WARDS.score_glint,
                scoutReveals: FINDABLE_MATCH_SCOUT_REVEALS.score_glint,
                spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS.score_glint,
                destroyText: 'Destroy forfeits the score glint.'
            },
            {
                id: 'ward_spark',
                label: 'Ward spark',
                rewardText: '+1 safe hazard ward',
                score: FINDABLE_MATCH_SCORE.ward_spark,
                comboShards: FINDABLE_MATCH_COMBO_SHARDS.ward_spark,
                safeHazardWards: FINDABLE_MATCH_SAFE_HAZARD_WARDS.ward_spark,
                scoutReveals: FINDABLE_MATCH_SCOUT_REVEALS.ward_spark,
                spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS.ward_spark,
                destroyText: 'Destroy forfeits the ward.'
            },
            {
                id: 'scout_glint',
                label: 'Scout glint',
                rewardText: 'scout one hazard or dungeon family',
                score: FINDABLE_MATCH_SCORE.scout_glint,
                comboShards: FINDABLE_MATCH_COMBO_SHARDS.scout_glint,
                safeHazardWards: FINDABLE_MATCH_SAFE_HAZARD_WARDS.scout_glint,
                scoutReveals: FINDABLE_MATCH_SCOUT_REVEALS.scout_glint,
                spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS.scout_glint,
                destroyText: 'Destroy forfeits the scout.'
            }
        ]);
        expect(getFindableRewardText('shard_spark')).toBe('Shard spark pickup: +1 combo shard.');
        expect(getFindableRewardText('score_glint')).toBe('Score glint pickup: +25 score.');
        expect(getFindableRewardText('ward_spark')).toBe('Ward spark pickup: +1 safe hazard ward.');
        expect(getFindableRewardText('scout_glint')).toBe('Scout glint pickup: scout one hazard or dungeon family.');
        expect(FINDABLE_KIND_SPAWN_WEIGHTS).toEqual({
            shard_spark: 35,
            score_glint: 35,
            ward_spark: 15,
            scout_glint: 15
        });
        expect(getFindableSpawnWeightRows()).toEqual([
            { id: 'shard_spark', label: 'Shard spark', weight: 35 },
            { id: 'score_glint', label: 'Score glint', weight: 35 },
            { id: 'ward_spark', label: 'Ward spark', weight: 15 },
            { id: 'scout_glint', label: 'Scout glint', weight: 15 }
        ]);
    });
});
