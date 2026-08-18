import type { BoardState } from '../../shared/contracts';
import { getResolvingSelectionState } from './tileResolvingSelection';

export interface TileBoardTrapResolutionDetails {
    count: number;
    effect: string;
    next: string;
}

export const buildLastResolutionFeedback = ({
    board,
    runStatus
}: {
    board: BoardState;
    runStatus: string | undefined;
}): string => {
    const counts = new Map<string, number>();
    for (const tile of board.tiles) {
        const resolvingSelection = getResolvingSelectionState(board, runStatus, tile.id);
        if (resolvingSelection === 'match' || resolvingSelection === 'mismatch') {
            counts.set(resolvingSelection, (counts.get(resolvingSelection) ?? 0) + 1);
        }
    }

    return [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `${key}:${count}`)
        .join(';');
};

export const buildTrapResolutionAnnouncement = ({
    board,
    previousResolvedTrapTileCount,
    resolvedTrapTileCount
}: {
    board: BoardState;
    previousResolvedTrapTileCount: number | null;
    resolvedTrapTileCount: number;
}): { details: TileBoardTrapResolutionDetails; message: string } | null => {
    if (previousResolvedTrapTileCount == null || resolvedTrapTileCount <= previousResolvedTrapTileCount) {
        return null;
    }

    const trapCount = Math.max(1, Math.round((resolvedTrapTileCount - previousResolvedTrapTileCount) / 2));
    const trapLabel =
        board.tiles.find((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved')
            ?.label ?? 'Trap';
    const effect = trapCount === 1 ? 'Trap effect paid' : 'Trap effects paid';
    const next = 'Chase next pair';
    const message =
        trapCount === 1
            ? `Trap resolved${trapLabel === 'Trap' ? '' : `: ${trapLabel}`}. ${effect}; ${next}.`
            : `${trapCount} traps resolved. ${effect}; ${next}.`;

    return {
        details: { count: trapCount, effect, next },
        message
    };
};

export const shouldClearTrapResolutionAnnouncement = ({
    resolvedTrapTileCount,
    trapResolutionMessage
}: {
    resolvedTrapTileCount: number;
    trapResolutionMessage: string;
}): boolean => resolvedTrapTileCount === 0 && trapResolutionMessage.length > 0;
