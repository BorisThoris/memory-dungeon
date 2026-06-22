import type { BoardState, RunState, TileTraitKind } from './contracts';
import {
    getBoardTraitInteractionPreviewLines,
    getTileTraitInteractionPreviewLines
} from './tile-trait-rules';
import {
    getTraitBuildBoardHint,
    getTraitBuildRewardRowsForBoard,
    type TraitBuildBoardHint
} from './trait-build-rewards';

export interface TraitOpportunityTile {
    tileId: string;
    pairKey: string;
    label: string;
    traitKind: TileTraitKind;
    previewLines: string[];
}

export interface TraitOpportunitySummary {
    tiles: TraitOpportunityTile[];
    interactionLines: string[];
    buildLabels: string[];
    reason: string | null;
}

export interface TraitSwapOpportunityPreview {
    createdLines: string[];
    matchCreatedLines: string[];
    brokenLines: string[];
    unchangedLines: string[];
    routeText: string | null;
}

export interface TraitOpportunityHudModel {
    active: boolean;
    buildLabel: string;
    primaryLine: string;
    routeCountLabel: string;
    swapHint: TraitSwapRouteHint | null;
    title: string;
    toolLine: string;
}

export interface TraitSwapRouteHint {
    firstTileId: string;
    secondTileId: string;
    firstLabel: string;
    secondLabel: string;
    createdLines: string[];
    matchCreatedLines: string[];
    brokenLines: string[];
    text: string;
}

interface TraitSwapPreviewContext {
    beforeLines: ReadonlySet<string>;
    beforeMatchLines: ReadonlySet<string>;
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

const getAdjacentTileIds = (board: BoardState, tileId: string): string[] => {
    const index = board.tiles.findIndex((tile) => tile.id === tileId);
    if (index < 0) {
        return [];
    }
    const columns = Math.max(1, board.columns || 1);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const ids: string[] = [];
    const add = (nextRow: number, nextColumn: number): void => {
        if (nextRow < 0 || nextColumn < 0 || nextColumn >= columns) {
            return;
        }
        const nextIndex = nextRow * columns + nextColumn;
        const tile = board.tiles[nextIndex];
        if (tile) {
            ids.push(tile.id);
        }
    };
    add(row - 1, column);
    add(row + 1, column);
    add(row, column - 1);
    add(row, column + 1);
    return ids;
};

const copyBoardHint = (hint: TraitBuildBoardHint | null): Pick<TraitOpportunitySummary, 'buildLabels' | 'interactionLines'> => ({
    buildLabels: [...(hint?.buildLabels ?? [])],
    interactionLines: [...(hint?.interactionLines ?? [])]
});

export const getTraitOpportunitySummary = (board: BoardState | null | undefined): TraitOpportunitySummary => {
    if (!board) {
        return { tiles: [], interactionLines: [], buildLabels: [], reason: null };
    }

    const tiles = board.tiles
        .filter((tile) => tile.tileTraitKind && tile.state !== 'matched' && tile.state !== 'removed')
        .map((tile): TraitOpportunityTile | null => {
            const previewLines = unique([
                ...getTileTraitInteractionPreviewLines(board, [tile.id], 'match'),
                ...getTileTraitInteractionPreviewLines(board, [tile.id], 'mismatch'),
                ...getAdjacentTileIds(board, tile.id).flatMap((neighborId) => [
                    ...getTileTraitInteractionPreviewLines(board, [neighborId], 'match'),
                    ...getTileTraitInteractionPreviewLines(board, [neighborId], 'mismatch')
                ])
            ]);
            if (previewLines.length === 0 || !tile.tileTraitKind) {
                return null;
            }
            return {
                tileId: tile.id,
                pairKey: tile.pairKey,
                label: tile.label,
                traitKind: tile.tileTraitKind,
                previewLines
            };
        })
        .filter((tile): tile is TraitOpportunityTile => tile != null);
    if (tiles.length === 0) {
        return { tiles: [], interactionLines: [], buildLabels: [], reason: null };
    }
    const hint = copyBoardHint(getTraitBuildBoardHint(board));
    const buildLabels =
        hint.buildLabels.length > 0
            ? hint.buildLabels
            : getTraitBuildRewardRowsForBoard(board).map((row) => row.label).slice(0, 2);
    const interactionLines = hint.interactionLines.length > 0
        ? hint.interactionLines
        : unique(tiles.flatMap((tile) => tile.previewLines)).slice(0, 4);
    const reason =
        buildLabels.length > 0 && interactionLines.length > 0
            ? `Offered for ${buildLabels.join(' / ')}: ${interactionLines[0]}`
            : interactionLines.length > 0
              ? `Offered for current trait route: ${interactionLines[0]}`
              : null;

    return {
        tiles,
        interactionLines,
        buildLabels,
        reason
    };
};

export const getTraitOpportunityTileIds = (board: BoardState | null | undefined): Set<string> =>
    new Set(getTraitOpportunitySummary(board).tiles.map((tile) => tile.tileId));

export const getTraitSwapRouteHints = (
    board: BoardState | null | undefined,
    limit = 3
): TraitSwapRouteHint[] => {
    if (!board || limit <= 0) {
        return [];
    }
    const hiddenTiles = board.tiles.filter((tile) => tile.state === 'hidden');
    const hints: Array<TraitSwapRouteHint & { order: number }> = [];
    const seen = new Set<string>();
    const context: TraitSwapPreviewContext = {
        beforeLines: new Set(getTraitOpportunitySummary(board).interactionLines),
        beforeMatchLines: new Set(getBoardTraitInteractionPreviewLines(board, 'match'))
    };
    let order = 0;
    for (let i = 0; i < hiddenTiles.length; i += 1) {
        for (let j = i + 1; j < hiddenTiles.length; j += 1) {
            const first = hiddenTiles[i]!;
            const second = hiddenTiles[j]!;
            const preview = getTraitSwapOpportunityPreviewWithContext(board, first.id, second.id, context);
            if (preview.matchCreatedLines.length === 0) {
                continue;
            }
            const createdLines = preview.createdLines.slice(0, 2);
            const matchCreatedLines = preview.matchCreatedLines.slice(0, 2);
            const key = `${first.id}:${second.id}:${createdLines.join('|')}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            hints.push({
                firstTileId: first.id,
                secondTileId: second.id,
                firstLabel: first.label,
                secondLabel: second.label,
                createdLines,
                matchCreatedLines,
                brokenLines: preview.brokenLines,
                text: `Swap ${first.label} with ${second.label}: ${matchCreatedLines.join('; ')}`,
                order
            });
            order += 1;
        }
    }
    return hints
        .sort((a, b) =>
            b.matchCreatedLines.length - a.matchCreatedLines.length ||
            b.createdLines.length - a.createdLines.length ||
            a.brokenLines.length - b.brokenLines.length ||
            a.order - b.order
        )
        .slice(0, limit)
        .map((hint) => ({
            firstTileId: hint.firstTileId,
            secondTileId: hint.secondTileId,
            firstLabel: hint.firstLabel,
            secondLabel: hint.secondLabel,
            createdLines: hint.createdLines,
            matchCreatedLines: hint.matchCreatedLines,
            brokenLines: hint.brokenLines,
            text: hint.text
        }));
};

export const getTraitOpportunityHudModel = (
    board: BoardState | null | undefined,
    runTools: Pick<RunState, 'peekCharges' | 'regionShuffleCharges' | 'regionShuffleFreeThisFloor' | 'shuffleCharges'>
): TraitOpportunityHudModel => {
    const summary = getTraitOpportunitySummary(board);
    const routeCount = summary.interactionLines.length;
    const swapHint = runTools.regionShuffleCharges > 0 || runTools.regionShuffleFreeThisFloor
        ? getTraitSwapRouteHints(board, 1)[0] ?? null
        : null;
    const active = routeCount > 0 || swapHint != null;
    const buildLabel =
        summary.buildLabels[0] ??
        (summary.tiles.length > 0 ? `${summary.tiles.length} combo-ready cards` : 'Route setup');
    const primaryLine = summary.interactionLines[0] ?? swapHint?.text ?? 'No adjacent trait route yet';
    const toolLine = `Tools: row/swap ${runTools.regionShuffleCharges}${
        runTools.regionShuffleFreeThisFloor ? ' + free' : ''
    }, peek ${runTools.peekCharges}, shuffle ${runTools.shuffleCharges}`;
    const routeCountLabel = routeCount === 0 && swapHint
        ? 'setup'
        : routeCount === 1
          ? '1 route'
          : `${routeCount} routes`;
    const title = [
        summary.buildLabels.length > 0 ? `Builds: ${summary.buildLabels.join(' / ')}.` : null,
        routeCount > 0 ? `Routes: ${summary.interactionLines.slice(0, 3).join('; ')}.` : null,
        swapHint ? `Swap hint: ${swapHint.text}.` : null,
        `${toolLine}.`
    ]
        .filter(Boolean)
        .join(' ');
    return {
        active,
        buildLabel,
        primaryLine,
        routeCountLabel,
        swapHint,
        title,
        toolLine
    };
};

const createBoardWithSwappedTiles = (board: BoardState, firstTileId: string, secondTileId: string): BoardState | null => {
    const firstIndex = board.tiles.findIndex((tile) => tile.id === firstTileId);
    const secondIndex = board.tiles.findIndex((tile) => tile.id === secondTileId);
    if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) {
        return null;
    }
    const tiles = [...board.tiles];
    const first = tiles[firstIndex]!;
    tiles[firstIndex] = tiles[secondIndex]!;
    tiles[secondIndex] = first;
    return { ...board, tiles };
};

export const getTraitSwapOpportunityPreview = (
    board: BoardState,
    firstTileId: string | null | undefined,
    secondTileId: string
): TraitSwapOpportunityPreview => {
    const context: TraitSwapPreviewContext = {
        beforeLines: new Set(getTraitOpportunitySummary(board).interactionLines),
        beforeMatchLines: new Set(getBoardTraitInteractionPreviewLines(board, 'match'))
    };
    return getTraitSwapOpportunityPreviewWithContext(board, firstTileId, secondTileId, context);
};

const getTraitSwapOpportunityPreviewWithContext = (
    board: BoardState,
    firstTileId: string | null | undefined,
    secondTileId: string,
    context: TraitSwapPreviewContext
): TraitSwapOpportunityPreview => {
    if (!firstTileId || firstTileId === secondTileId) {
        return { createdLines: [], matchCreatedLines: [], brokenLines: [], unchangedLines: [], routeText: null };
    }
    const swapped = createBoardWithSwappedTiles(board, firstTileId, secondTileId);
    if (!swapped) {
        return { createdLines: [], matchCreatedLines: [], brokenLines: [], unchangedLines: [], routeText: null };
    }
    const afterLines = new Set(getTraitOpportunitySummary(swapped).interactionLines);
    const afterMatchLines = new Set(getBoardTraitInteractionPreviewLines(swapped, 'match'));
    const createdLines = [...afterLines].filter((line) => !context.beforeLines.has(line));
    const matchCreatedLines = [...afterMatchLines].filter((line) => !context.beforeMatchLines.has(line));
    const brokenLines = [...context.beforeLines].filter((line) => !afterLines.has(line));
    const unchangedLines = [...afterLines].filter((line) => context.beforeLines.has(line));
    const routeText =
        createdLines.length > 0
            ? `Creates trait route: ${createdLines.slice(0, 2).join('; ')}`
            : brokenLines.length > 0
              ? `Breaks trait route: ${brokenLines.slice(0, 2).join('; ')}`
              : unchangedLines.length > 0
                ? `Keeps trait route: ${unchangedLines.slice(0, 2).join('; ')}`
                : null;

    return {
        createdLines,
        matchCreatedLines,
        brokenLines,
        unchangedLines,
        routeText
    };
};
