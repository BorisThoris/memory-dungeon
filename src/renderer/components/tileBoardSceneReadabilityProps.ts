export const buildTileBoardSceneReadabilityProps = ({
    boardApplicationFocused,
    focusedTileId,
    perkArmedTileIds,
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds,
    traitRouteTargetTileIds
}: {
    boardApplicationFocused: boolean;
    focusedTileId: string | null;
    perkArmedTileIds: readonly string[];
    selectedTraitFollowupTileIds: readonly string[];
    traitRewardHotTileIds: readonly string[];
    traitRouteTargetTileIds: readonly string[];
}) => ({
    focusedTileId: boardApplicationFocused ? focusedTileId : null,
    perkArmedTileIds,
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds,
    traitRouteTargetTileIds
});
