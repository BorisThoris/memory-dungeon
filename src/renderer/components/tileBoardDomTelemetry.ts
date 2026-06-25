import type { BoardState, RunStatus } from '../../shared/contracts';
import { activeEnemyHazardsForBoard } from '../../shared/enemy-hazard-board-rules';
import { getTraitOpportunityTileIds } from '../../shared/trait-opportunities';
import { getResolvingSelectionState } from './tileResolvingSelection';
import { getPickableTileIds, getTilePosition } from './tileBoardDomAccessibility';
import { getDungeonUtilityReadabilityKind } from './tileBoardReadability';

const slotListFor = (
    board: BoardState,
    predicate: (tile: BoardState['tiles'][number], index: number) => boolean
): string =>
    board.tiles
        .map((tile, index) => {
            if (!predicate(tile, index)) {
                return null;
            }
            const { row, column } = getTilePosition(index, board.columns);
            return `${row},${column}`;
        })
        .filter((value): value is string => value != null)
        .join(';');

export const getHiddenTileCount = (board: BoardState): number =>
    board.tiles.filter((tile) => tile.state === 'hidden').length;

export const getHiddenSlotsAttr = (board: BoardState): string =>
    slotListFor(board, (tile) => tile.state === 'hidden');

export const getHiddenTrapSlotsAttr = (board: BoardState, includeDevAttributes: boolean): string | undefined =>
    includeDevAttributes
        ? slotListFor(
              board,
              (tile) =>
                  tile.state === 'hidden' &&
                  tile.dungeonCardKind === 'trap' &&
                  tile.dungeonCardState === 'hidden'
          )
        : undefined;

export const getResolvedTrapSlotsAttr = (board: BoardState): string =>
    slotListFor(
        board,
        (tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved'
    );

export const getResolvedTrapTileCount = (board: BoardState): number =>
    board.tiles.filter((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved').length;

export const getPickableHiddenSlotsAttr = ({
    allowGambitThirdFlip,
    board,
    includeDevAttributes,
    interactive
}: {
    allowGambitThirdFlip: boolean;
    board: BoardState;
    includeDevAttributes: boolean;
    interactive: boolean;
}): string | undefined => {
    if (!includeDevAttributes) {
        return undefined;
    }

    const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip));
    return slotListFor(board, (tile) => tile.state === 'hidden' && pickable.has(tile.id));
};

export const getCardFeedbackStatesAttr = ({
    allowGambitThirdFlip,
    board,
    boardApplicationFocused,
    debugPeekActive,
    focusedTileId,
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
    interactive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    runStatus: RunStatus;
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip));
    const enemyOccupied = new Set(
        activeEnemyHazardsForBoard(board).map((hazard) => hazard.currentTileId)
    );
    const traitOpportunityTileIds = getTraitOpportunityTileIds(board);
    const traitRouteTargetTileIdSet = new Set(traitRouteTargetTileIds);
    const counts = new Map<string, number>();
    const add = (key: string): void => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    for (const tile of board.tiles) {
        if (tile.state === 'removed') {
            add('removed');
            continue;
        }

        const faceUp = tile.state !== 'hidden' || previewActive || debugPeekActive || peekRevealedTileIds.has(tile.id);
        const resolvingSelection = getResolvingSelectionState(board, runStatus, tile.id);

        if (tile.state === 'hidden' && !faceUp) {
            add('hidden');
        }
        if (faceUp && tile.state === 'flipped') {
            add('flipped');
            add('selected');
        }
        if (tile.state === 'matched') {
            add('matched');
        }
        if (resolvingSelection) {
            add(resolvingSelection);
        }
        if (!pickable.has(tile.id) && tile.state !== 'matched') {
            add('non-pickable');
            add('disabled');
        }
        if (pickable.has(tile.id)) {
            add('pickable');
        }
        if (focusedTileId === tile.id && boardApplicationFocused) {
            add('focused');
        }
        if (tile.tileHazardKind) {
            add('hazard');
        }
        if (tile.tileTraitKind) {
            add('trait');
            if (traitOpportunityTileIds.has(tile.id)) {
                add('trait-combo');
            }
        }
        if (traitRouteTargetTileIdSet.has(tile.id)) {
            add('trait-route-target');
        }
        if (tile.dungeonCardKind === 'trap') {
            add(
                tile.dungeonCardState === 'resolved'
                    ? 'trap-resolved'
                    : tile.dungeonCardState === 'revealed'
                      ? 'trap-revealed'
                      : 'trap-armed'
            );
        }
        if (tile.dungeonBossId) {
            add('boss-marked');
        }
        if (tile.dungeonCardKind === 'enemy') {
            add('enemy-card');
        }
        const dungeonUtilityKind = getDungeonUtilityReadabilityKind(tile, board);
        if (dungeonUtilityKind) {
            add(dungeonUtilityKind);
        }
        if (enemyOccupied.has(tile.id)) {
            add('enemy-occupied');
        }
        if (tile.findableKind) {
            add('relic');
        }
        if (tile.routeSpecialKind || tile.routeCardKind) {
            add('route');
        }
        if (tile.dungeonCardKind || tile.dungeonBossId) {
            add('objective');
        }
    }

    return [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `${key}:${count}`)
        .join(';');
};

export const getDevE2ePairPositionsJson = (
    board: BoardState,
    includeDevAttributes: boolean
): string | undefined => {
    if (!includeDevAttributes) {
        return undefined;
    }

    const byKey: Record<string, { row: number; col: number }[]> = {};
    board.tiles.forEach((tile, index) => {
        const { row, column } = getTilePosition(index, board.columns);
        const k = tile.pairKey;
        if (!byKey[k]) {
            byKey[k] = [];
        }
        byKey[k]!.push({ row, col: column });
    });
    const keys = Object.keys(byKey).filter((k) => byKey[k]!.length === 2);
    if (keys.length < 2) {
        return undefined;
    }
    const slim: Record<string, { row: number; col: number }[]> = {};
    for (const k of keys) {
        slim[k] = byKey[k]!;
    }
    return JSON.stringify(slim);
};
