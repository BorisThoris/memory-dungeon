import { describe, expect, it } from 'vitest';
import { buildTileBoardSceneReadabilityProps } from './tileBoardSceneReadabilityProps';

describe('tileBoardSceneReadabilityProps', () => {
    it('only forwards focused tile id while the board application is actually focused', () => {
        expect(
            buildTileBoardSceneReadabilityProps({
                boardApplicationFocused: true,
                focusedTileId: 'tile-a',
                perkArmedTileIds: ['perk-a'],
                selectedTraitFollowupTileIds: ['followup-a'],
                traitRewardHotTileIds: ['reward-a'],
                traitRouteTargetTileIds: ['route-a']
            })
        ).toEqual({
            focusedTileId: 'tile-a',
            perkArmedTileIds: ['perk-a'],
            selectedTraitFollowupTileIds: ['followup-a'],
            traitRewardHotTileIds: ['reward-a'],
            traitRouteTargetTileIds: ['route-a']
        });

        expect(
            buildTileBoardSceneReadabilityProps({
                boardApplicationFocused: false,
                focusedTileId: 'tile-a',
                perkArmedTileIds: ['perk-a'],
                selectedTraitFollowupTileIds: ['followup-a'],
                traitRewardHotTileIds: ['reward-a'],
                traitRouteTargetTileIds: ['route-a']
            }).focusedTileId
        ).toBeNull();
    });
});
