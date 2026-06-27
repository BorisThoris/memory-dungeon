import type { BoardState, RunStatus } from '../../shared/contracts';
import {
    getCardFeedbackStatesAttr,
    getHiddenSlotsAttr,
    getHiddenTileCount,
    getHiddenTrapSlotsAttr,
    getPickableHiddenSlotsAttr,
    getResolvedTrapSlotsAttr,
    getResolvedTrapTileCount
} from './tileBoardDomTelemetry';

interface TileBoardDomSurfaceModel {
    cardFeedbackStatesAttr: string | undefined;
    hiddenSlotsAttr: string;
    hiddenTileCount: number;
    hiddenTrapSlotsAttr: string | undefined;
    pickableHiddenSlotsAttr: string | undefined;
    resolvedTrapSlotsAttr: string | undefined;
    resolvedTrapTileCount: number;
}

export const buildTileBoardDomSurfaceModel = ({
    allowGambitThirdFlip,
    board,
    boardApplicationFocused,
    debugPeekActive,
    focusedTileId,
    includeDevAttributes,
    interactive,
    peekRevealedTileIds,
    previewActive,
    runStatus,
    traitRouteTargetTileIds = []
}: {
    allowGambitThirdFlip: boolean;
    board: BoardState;
    boardApplicationFocused: boolean;
    debugPeekActive: boolean;
    focusedTileId: string | null;
    includeDevAttributes: boolean;
    interactive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    runStatus: RunStatus;
    traitRouteTargetTileIds?: readonly string[];
}): TileBoardDomSurfaceModel => ({
    cardFeedbackStatesAttr: getCardFeedbackStatesAttr({
        allowGambitThirdFlip,
        board,
        boardApplicationFocused,
        debugPeekActive,
        focusedTileId,
        interactive,
        peekRevealedTileIds,
        previewActive,
        runStatus,
        traitRouteTargetTileIds
    }),
    hiddenSlotsAttr: getHiddenSlotsAttr(board),
    hiddenTileCount: getHiddenTileCount(board),
    hiddenTrapSlotsAttr: getHiddenTrapSlotsAttr(board, includeDevAttributes),
    pickableHiddenSlotsAttr: getPickableHiddenSlotsAttr({
        allowGambitThirdFlip,
        board,
        includeDevAttributes,
        interactive
    }),
    resolvedTrapSlotsAttr: getResolvedTrapSlotsAttr(board),
    resolvedTrapTileCount: getResolvedTrapTileCount(board)
});
