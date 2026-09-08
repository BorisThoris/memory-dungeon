import type { BuildTileBoardRowsInput, TileBoardRow } from './tileBoardRows';
import { buildTileBoardRows, getTileBoardOverlayPrewarmDemandPairKeys } from './tileBoardRows';
import { isTileBoardFlipLocked } from './tileBoardFlipLock';
import { computeTileBoardRuneFieldMetrics, type TileBoardRuneFieldMetrics } from './tileBoardRuneField';

interface TileBoardSceneModel {
    boardRuneFieldMetrics: TileBoardRuneFieldMetrics;
    flipLocked: boolean;
    overlayPrewarmDemandPairKeys: string[];
    tileBezelRows: TileBoardRow[];
}

interface BuildTileBoardSceneModelInput
    extends Omit<BuildTileBoardRowsInput, 'peekRevealedTileIds' | 'pinnedTileIds'> {
    cardHeight: number;
    cardWidth: number;
    interactionSuppressed: boolean;
    peekRevealedTileIds: readonly string[];
    pinnedTileIds: readonly string[];
    tileSpacing: number;
}

export const buildTileBoardSceneModel = ({
    cardHeight,
    cardWidth,
    interactionSuppressed,
    peekRevealedTileIds,
    pinnedTileIds,
    tileSpacing,
    ...rowInput
}: BuildTileBoardSceneModelInput): TileBoardSceneModel => {
    const flipLocked = isTileBoardFlipLocked({
        allowGambitThirdFlip: rowInput.allowGambitThirdFlip,
        flippedTileCount: rowInput.board.flippedTileIds.length
    });
    const tileBezelRows = buildTileBoardRows({
        ...rowInput,
        peekRevealedTileIds: new Set(peekRevealedTileIds),
        pinnedTileIds: new Set(pinnedTileIds)
    });
    const overlayPrewarmDemandPairKeys = getTileBoardOverlayPrewarmDemandPairKeys(
        tileBezelRows,
        interactionSuppressed,
        rowInput.interactive,
        flipLocked
    );
    const boardRuneFieldMetrics = computeTileBoardRuneFieldMetrics({
        cardHeight,
        cardWidth,
        tileSpacing,
        transforms: tileBezelRows.map((row) => row.transform)
    });

    return {
        boardRuneFieldMetrics,
        flipLocked,
        overlayPrewarmDemandPairKeys,
        tileBezelRows
    };
};
