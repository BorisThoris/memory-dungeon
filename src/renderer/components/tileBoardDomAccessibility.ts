import type { BoardState, RunStatus, Tile } from '../../shared/contracts';
import { getDungeonCardKnowledge } from '../../shared/dungeon-cards';
import { getDungeonCardCopy } from '../../shared/dungeon-rules';
import { getFindableRewardText } from '../../shared/findables';
import { getHazardTileTelegraph } from '../../shared/hazard-tiles';
import { getPairProximityGridDistance } from '../../shared/pairProximityHint';
import { DECOY_PAIR_KEY } from '../../shared/tile-identity';
import { routeSpecialLabel, routeSpecialRewardLine } from '../../shared/route-world';
import { pairProximityUiStrings } from '../ui/strings/pairProximityUi';
import { isTilePickable } from './tileBoardPick';

export const getTilePosition = (index: number, columns: number): { row: number; column: number } => ({
    row: Math.floor(index / columns) + 1,
    column: (index % columns) + 1
});

export const getDungeonCardText = (tile: Tile): string => {
    const copy = getDungeonCardCopy(tile);
    return copy ? ` ${copy}` : '';
};

export const getEnemyHazardText = (board: BoardState, tileId: string): string => {
    const hazard = board.enemyHazards?.find((candidate) => candidate.currentTileId === tileId && candidate.state !== 'defeated');
    if (hazard) {
        const revealed = hazard.state === 'revealed' ? 'revealed ' : 'hidden ';
        return ` Occupied by ${revealed}moving enemy patrol ${hazard.label}, ${hazard.hp}/${hazard.maxHp} HP, ${hazard.damage} damage.`;
    }
    const nextHazard = board.enemyHazards?.find((candidate) => candidate.nextTileId === tileId && candidate.state !== 'defeated');
    return nextHazard
        ? ` Next target of moving enemy patrol ${nextHazard.label}, ${nextHazard.hp}/${nextHazard.maxHp} HP, ${nextHazard.damage} damage.`
        : '';
};

export const getHazardTileText = (tile: Tile): string => {
    const telegraph = getHazardTileTelegraph(tile);
    return telegraph.hasHazard && telegraph.label && telegraph.telegraph
        ? ` Hazard tile: ${telegraph.label}. ${telegraph.telegraph}`
        : '';
};

export const getTileAriaLabel = (
    board: BoardState,
    tile: Tile,
    faceUp: boolean,
    row: number,
    column: number
): string => {
    const base = faceUp
        ? tile.pairKey === DECOY_PAIR_KEY
            ? `Decoy trap tile, row ${row}, column ${column}. It never forms a pair.`
            : `Tile ${tile.label}, row ${row}, column ${column}`
        : `Hidden tile, row ${row}, column ${column}`;
    const findableNote = tile.findableKind && faceUp && tile.state !== 'matched' ? ` ${getFindableRewardText(tile.findableKind)}` : '';
    const scoutSourceNote =
        tile.scoutRevealSource === 'omen_seal'
            ? ' Scouted by Omen Seal.'
            : tile.scoutRevealSource === 'lantern_ward' || tile.lanternScouted
              ? ' Scouted by Lantern Ward.'
              : '';
    const routeNote =
        (tile.routeSpecialKind || tile.routeCardKind) && tile.state !== 'matched'
            ? ` Route card: ${
                  tile.routeSpecialKind
                      ? `${routeSpecialLabel(tile.routeSpecialKind)}. ${routeSpecialRewardLine(tile.routeSpecialKind)}`
                      : tile.routeCardKind === 'safe_ward'
                        ? 'Safe ward.'
                        : tile.routeCardKind === 'greed_cache'
                          ? 'Greed cache.'
                          : 'Mystery veil.'
              }${
                  (tile.routeSpecialKind === 'mystery_veil' ||
                      tile.routeSpecialKind === 'secret_door' ||
                      tile.routeSpecialKind === 'omen_seal' ||
                      tile.routeSpecialKind === 'mimic_cache' ||
                      tile.routeSpecialKind === 'loaded_gateway' ||
                      tile.routeSpecialKind === 'parasite_vessel') &&
                  tile.routeSpecialRevealed
                      ? tile.routeSpecialRevealSource === 'lantern_ward'
                          ? ' Scouted by Lantern Ward.'
                          : tile.routeSpecialRevealSource === 'omen_seal'
                            ? ' Scouted by Omen Seal.'
                          : ' Revealed by peek.'
                      : ''
              }`
            : '';
    const dungeonKnowledge = getDungeonCardKnowledge(tile, faceUp);
    const dungeonNote = dungeonKnowledge.familyKnown ? getDungeonCardText(tile) : '';
    const passiveScoutNote = scoutSourceNote && !routeNote.includes(scoutSourceNote.trim()) ? scoutSourceNote : '';
    return `${base}${findableNote}${routeNote}${dungeonNote}${getHazardTileText(tile)}${passiveScoutNote}${getEnemyHazardText(board, tile.id)}`;
};

export const getPowerTargetAriaText = (
    tile: Tile,
    destroyPowerVisualActive: boolean,
    destroyEligibleTileIds: ReadonlySet<string>,
    peekPowerVisualActive: boolean,
    peekEligibleTileIds: ReadonlySet<string>,
    strayPowerVisualActive: boolean,
    strayEligibleTileIds: ReadonlySet<string>
): string => {
    if (destroyPowerVisualActive) {
        if (destroyEligibleTileIds.has(tile.id)) {
            return ' Destroy target: valid. Forfeits match score and pickups or rewards on this pair.';
        }
        return tile.state === 'hidden' ? ' Destroy target: invalid for this power.' : '';
    }
    if (peekPowerVisualActive) {
        return peekEligibleTileIds.has(tile.id)
            ? ' Peek target: valid. Reveals this one tile and locks Perfect Memory.'
            : tile.state === 'hidden'
              ? ' Peek target: invalid or already revealed.'
              : '';
    }
    if (strayPowerVisualActive) {
        return strayEligibleTileIds.has(tile.id)
            ? ' Stray target: valid. Removes this safe singleton tile from play and locks Perfect Memory.'
            : tile.state === 'hidden'
              ? ' Stray target: invalid, paired, or protected.'
              : '';
    }
    return '';
};

export const getPickableTileIds = (board: BoardState, interactive: boolean, allowGambitThirdFlip: boolean): string[] => {
    const flippedN = board.flippedTileIds.length;
    const flipLocked = flippedN >= 2 && !(allowGambitThirdFlip && flippedN === 2);
    const ids: string[] = [];
    for (const tile of board.tiles) {
        if (tile.state === 'removed') {
            continue;
        }
        if (isTilePickable(tile, interactive, flipLocked)) {
            ids.push(tile.id);
        }
    }
    return ids;
};

export const gridIndexFromTileId = (board: BoardState, tileId: string): number => {
    const i = board.tiles.findIndex((t) => t.id === tileId);
    return i >= 0 ? i : 0;
};

export const moveFocusInGrid = (
    board: BoardState,
    fromId: string | null,
    dir: 'up' | 'down' | 'left' | 'right',
    interactive: boolean,
    allowGambitThirdFlip: boolean
): string | null => {
    const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip));
    if (pickable.size === 0) {
        return null;
    }
    const cols = board.columns;
    const rows = board.rows;
    let startIdx = 0;
    if (fromId && pickable.has(fromId)) {
        startIdx = gridIndexFromTileId(board, fromId);
    } else {
        const firstPickable = board.tiles.find((t) => pickable.has(t.id));
        startIdx = firstPickable ? gridIndexFromTileId(board, firstPickable.id) : 0;
    }
    const r = Math.floor(startIdx / cols);
    const c = startIdx % cols;
    const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const t = board.tiles[nr * cols + nc];
        if (t.state !== 'removed' && pickable.has(t.id)) {
            return t.id;
        }
        nr += dr;
        nc += dc;
    }
    return fromId;
};

export const getPairProximityLabel = (
    board: BoardState,
    tile: Tile,
    pairProximityHintsEnabled: boolean,
    faceUp: boolean
): string | null => {
    if (!pairProximityHintsEnabled || !faceUp) {
        return null;
    }
    const distance = getPairProximityGridDistance(board, tile.id);
    return distance == null ? null : `${distance}`;
};

export const getFocusedTileLiveLabel = ({
    board,
    debugPeekActive,
    destroyEligibleTileIds,
    destroyPowerVisualActive,
    focusedTileId,
    pairProximityHintsEnabled,
    peekEligibleTileIds,
    peekPowerVisualActive,
    peekRevealedTileIds,
    previewActive,
    runStatus,
    strayEligibleTileIds,
    strayPowerVisualActive
}: {
    board: BoardState;
    debugPeekActive: boolean;
    destroyEligibleTileIds: ReadonlySet<string>;
    destroyPowerVisualActive: boolean;
    focusedTileId: string | null;
    pairProximityHintsEnabled: boolean;
    peekEligibleTileIds: ReadonlySet<string>;
    peekPowerVisualActive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    runStatus: RunStatus;
    strayEligibleTileIds: ReadonlySet<string>;
    strayPowerVisualActive: boolean;
}): string => {
    if (!focusedTileId) {
        return '';
    }

    const idx = board.tiles.findIndex((t) => t.id === focusedTileId);
    if (idx < 0) {
        return '';
    }

    const tile = board.tiles[idx]!;
    const faceUp = tile.state !== 'hidden' || debugPeekActive || previewActive || peekRevealedTileIds.has(tile.id);
    const { row, column } = getTilePosition(idx, board.columns);
    let label = getTileAriaLabel(board, tile, faceUp, row, column);
    label += getPowerTargetAriaText(
        tile,
        destroyPowerVisualActive,
        destroyEligibleTileIds,
        peekPowerVisualActive,
        peekEligibleTileIds,
        strayPowerVisualActive,
        strayEligibleTileIds
    );

    if (
        pairProximityHintsEnabled &&
        (runStatus === 'playing' || runStatus === 'resolving') &&
        tile.state === 'flipped'
    ) {
        const distance = getPairProximityGridDistance(board, tile.id);
        if (distance != null) {
            label += pairProximityUiStrings.focusPairSteps(distance);
        }
    }

    return label;
};
