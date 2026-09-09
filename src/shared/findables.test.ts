import { describe, expect, it } from 'vitest';
import { FINDABLE_KIND_SPAWN_WEIGHTS, FINDABLE_MATCH_SCORE } from './contracts';
import { getFindableRewardText, getFindableRows, getFindableSpawnWeightRows } from './findables';

describe('REG-049 findable reward copy', () => {
    it('keeps reward rows aligned with scoring constants', () => {
        // Gen 184: the Shard Spark left with the combo shard (docs/REMOVED_LIVES.md); one kind remains.
        expect(getFindableRows()).toEqual([
            {
                id: 'score_glint',
                label: 'Score glint',
                rewardText: '+25 score',
                score: FINDABLE_MATCH_SCORE.score_glint,
                spawnWeight: FINDABLE_KIND_SPAWN_WEIGHTS.score_glint,
                destroyText: 'Destroy forfeits the score glint.'
            }
        ]);
        expect(getFindableRewardText('score_glint')).toBe('Score glint pickup: +25 score.');
        expect(FINDABLE_KIND_SPAWN_WEIGHTS).toEqual({ score_glint: 100 });
        expect(getFindableSpawnWeightRows()).toEqual([{ id: 'score_glint', label: 'Score glint', weight: 100 }]);
    });
});
