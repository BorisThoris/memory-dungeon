import { describe, expect, it } from 'vitest';
import { FINDABLE_KIND_SPAWN_WEIGHTS, FINDABLE_MATCH_SCORE } from './contracts';
import { getFindableRewardText, getFindableRows, getFindableSpawnWeightRows } from './findables';

describe('REG-049 findable reward copy', () => {
    it('keeps reward rows aligned with scoring constants', () => {
        expect(getFindableRows()).toEqual([
            {
                id: 'score_glint',
                label: 'Score glint',
                rewardText: '+25 score',
                score: FINDABLE_MATCH_SCORE.score_glint,
                spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS.score_glint,
                breakText: 'A break that takes the carrier spills the glint and pays it anyway.'
            },
            {
                id: 'meteor_shard', label: 'Meteor shard', rewardText: '+1 meteor in your inventory',
                score: 0, spawnWeight: 20, breakText: 'Destroyed shards are lost; meteors never refill themselves.'
            }
        ]);
        expect(getFindableRewardText('score_glint')).toBe('Score glint pickup: +25 score.');
        expect(FINDABLE_KIND_SPAWN_WEIGHTS).toEqual({ score_glint: 80, meteor_shard: 20 });
        expect(getFindableSpawnWeightRows()).toEqual([{ id: 'score_glint', label: 'Score glint', weight: 80 },
            { id: 'meteor_shard', label: 'Meteor shard', weight: 20 }]);
    });
});
