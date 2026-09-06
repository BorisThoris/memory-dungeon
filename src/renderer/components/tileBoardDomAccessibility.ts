import type { BoardState, RunStatus, Tile } from '../../shared/contracts';
import { activeEnemyHazardsForBoard } from '../../shared/enemy-hazard-board-rules';
import { getDungeonCardKnowledge } from '../../shared/dungeon-cards';
import { getDungeonCardCopy } from '../../shared/dungeon-rules';
import { getFindableRewardText } from '../../shared/findables';
import { getHazardTileTelegraph } from '../../shared/hazard-tiles';
import { getPairProximityGridDistance } from '../../shared/pairProximityHint';
import { getTileSuit } from '../../shared/tile-suit-rules';
import { getClumpRead } from '../../shared/clump-read-rules';
import { DECOY_PAIR_KEY } from '../../shared/tile-identity';
import { routeSpecialLabel, routeSpecialRewardLine } from '../../shared/route-world';
import {
    getTileSwapTraitPreviewLines,
    getTileTraitInteractionPreviewLines,
    getTileTraitText
} from '../../shared/tile-trait-rules';
import {
    getSelectedTraitFollowupTileIds,
    getTraitComboSurgeTileIds,
    getTraitOpportunityHighlight,
    getTraitOpportunitySummary,
    getTraitSwapOpportunityPreview
} from '../../shared/trait-opportunities';
import { pairProximityUiStrings } from '../ui/strings/pairProximityUi';
import {
    getTraitRouteCadenceAction,
    getTraitRouteReadabilityBeatCount,
    getTraitRouteReadabilityCadence,
    getTraitRouteReadabilityTier
} from './tileBoardReadability';
import { isTilePickable } from './tileBoardPick';

const EMPTY_ROUTE_SETUP_TARGETS: ReadonlySet<string> = new Set();

export const getTilePosition = (index: number, columns: number): { row: number; column: number } => ({
    row: Math.floor(index / columns) + 1,
    column: (index % columns) + 1
});

export const getDungeonCardText = (tile: Tile, board?: BoardState): string => {
    const copy = getDungeonCardCopy(tile, { board });
    return copy ? ` ${copy}` : '';
};

export const getEnemyHazardText = (board: BoardState, tileId: string): string => {
    const hazards = activeEnemyHazardsForBoard(board);
    const hazard = hazards.find((candidate) => candidate.currentTileId === tileId);
    if (hazard) {
        const revealed = hazard.state === 'revealed' ? 'revealed ' : 'hidden ';
        return ` Occupied by ${revealed}moving enemy patrol ${hazard.label}, ${hazard.hp}/${hazard.maxHp} HP, ${hazard.damage} damage.`;
    }
    const nextHazard = hazards.find((candidate) => candidate.nextTileId === tileId);
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

export const getTileTraitPreviewText = (board: BoardState, tile: Tile): string => {
    const opportunity = getTraitOpportunitySummary(board).tiles.find((entry) => entry.tileId === tile.id);
    const lines = opportunity?.previewLines ?? [
        ...getTileTraitInteractionPreviewLines(board, [tile.id], 'match'),
        ...getTileTraitInteractionPreviewLines(board, [tile.id], 'mismatch')
    ];
    const unique = [...new Set(lines)];
    if (unique.length === 0) {
        return '';
    }
    const comboSurge = opportunity != null && getTraitComboSurgeTileIds(board).has(tile.id);
    return opportunity
        ? ` ${comboSurge ? 'Combo-surge' : 'Chain-ready'} trait card. Match now: ${unique.slice(0, 2).join('; ')}.`
        : ` Nearby trait interaction: ${unique.slice(0, 2).join('; ')}.`;
};

export const getTileBeatAccessibilityText = (
    board: BoardState,
    tile: Tile,
    faceUp: boolean,
    routeSetupContext: {
        rewardHotTileIds?: ReadonlySet<string>;
        selectedFollowupTileIds?: ReadonlySet<string>;
        targetTileIds?: ReadonlySet<string>;
    } = {}
): string => {
    if (faceUp || tile.state !== 'hidden') {
        return '';
    }

    const opportunityTileIds = new Set(getTraitOpportunitySummary(board).tiles.map((entry) => entry.tileId));
    const isTraitComboBack = tile.tileTraitKind != null && opportunityTileIds.has(tile.id);
    const traitRouteCadence = getTraitRouteReadabilityCadence(getTraitRouteReadabilityTier({
        isPerkArmedBack: false,
        isSelectedTraitFollowupBack: routeSetupContext.selectedFollowupTileIds?.has(tile.id) ?? false,
        isTraitComboBack,
        isTraitComboSurgeBack: tile.tileTraitKind != null && getTraitComboSurgeTileIds(board).has(tile.id),
        isTraitPayoffStackBack: isTraitComboBack && (routeSetupContext.rewardHotTileIds?.has(tile.id) ?? false),
        isTraitRewardHotBack: routeSetupContext.rewardHotTileIds?.has(tile.id) ?? false,
        isTraitRouteTargetBack: routeSetupContext.targetTileIds?.has(tile.id) ?? false
    }));
    if (traitRouteCadence === 'none') {
        return '';
    }
    const beatCount = getTraitRouteReadabilityBeatCount(
        traitRouteCadence === 'prime' ? 'setup' : traitRouteCadence
    );
    const detail =
        traitRouteCadence === 'cashout'
            ? isTraitComboBack
                ? 'Hit this route now.'
                : 'Reward lane is hot.'
            : traitRouteCadence === 'surge'
              ? 'Multiple trait routes are live.'
              : traitRouteCadence === 'follow-up'
                ? 'Tap next to keep the route moving.'
                : traitRouteCadence === 'route'
                  ? 'Match to build chain.'
                  : 'Set this route up.';
    return ` Beat: ${traitRouteCadence}. Action: ${getTraitRouteCadenceAction(traitRouteCadence)}. ${beatCount}-beat pulse. ${detail}`;
};

export const getBoardChainAccessibilitySummary = (
    board: BoardState,
    routeSetupContext: {
        hintText?: string | null;
        rewardHotText?: string | null;
        rewardHotTileIds?: ReadonlySet<string>;
        sequenceText?: string | null;
        selectedFollowupTileIds?: ReadonlySet<string>;
        targetTileIds?: ReadonlySet<string>;
    } = {}
): {
    label: string;
    primaryLine: string;
    secondaryLine: string | null;
    tone: 'cashout' | 'surge' | 'ready' | 'setup' | 'idle';
    readyCount: number;
    followupCount: number;
    payoffStackCount: number;
    rewardHotCount: number;
    setupCount: number;
    surgeCount: number;
} => {
    const opportunity = getTraitOpportunitySummary(board);
    const highlight = getTraitOpportunityHighlight(board);
    const opportunityTileIds = new Set(opportunity.tiles.map((entry) => entry.tileId));
    const surgeTileIds = getTraitComboSurgeTileIds(board);
    const rewardHotTileIds = routeSetupContext.rewardHotTileIds ?? new Set<string>();
    const selectedFollowupTileIds = routeSetupContext.selectedFollowupTileIds ?? getSelectedTraitFollowupTileIds(board);
    const setupTargetTileIds =
        routeSetupContext.targetTileIds ??
        (highlight.tone === 'setup' ? new Set(highlight.tileIds) : new Set<string>());
    const readyCount = board.tiles.filter(
        (tile) => tile.state === 'hidden' && tile.tileTraitKind != null && opportunityTileIds.has(tile.id)
    ).length;
    const followupCount = board.tiles.filter(
        (tile) => tile.state === 'hidden' && selectedFollowupTileIds.has(tile.id)
    ).length;
    const rewardHotCount = board.tiles.filter((tile) => tile.state === 'hidden' && rewardHotTileIds.has(tile.id)).length;
    const payoffStackCount = board.tiles.filter(
        (tile) =>
            tile.state === 'hidden' &&
            tile.tileTraitKind != null &&
            opportunityTileIds.has(tile.id) &&
            rewardHotTileIds.has(tile.id)
    ).length;
    const surgeCount = board.tiles.filter((tile) => tile.state === 'hidden' && surgeTileIds.has(tile.id)).length;
    const setupCount = board.tiles.filter(
        (tile) => tile.state === 'hidden' && setupTargetTileIds.has(tile.id) && !opportunityTileIds.has(tile.id)
    ).length;
    const tone =
        rewardHotCount > 0
            ? 'cashout'
            : surgeCount > 0
              ? 'surge'
              : followupCount > 0 || readyCount > 0
                ? 'ready'
                : setupCount > 0
                  ? 'setup'
                  : 'idle';
    const parts = [
        readyCount > 0 ? `${readyCount} chain-ready card${readyCount === 1 ? '' : 's'}` : null,
        followupCount > 0 ? `${followupCount} selected follow-up${followupCount === 1 ? '' : 's'}` : null,
        surgeCount > 0 ? `${surgeCount} surge card${surgeCount === 1 ? '' : 's'}` : null,
        payoffStackCount > 0 ? `${payoffStackCount} payoff-stack card${payoffStackCount === 1 ? '' : 's'}` : null,
        rewardHotCount > 0 ? `${rewardHotCount} reward-hot card${rewardHotCount === 1 ? '' : 's'}` : null,
        setupCount > 0 ? `${setupCount} prime target${setupCount === 1 ? '' : 's'}` : null
    ].filter((part): part is string => Boolean(part));
    const action =
        payoffStackCount > 0
            ? routeSetupContext.rewardHotText ?? 'cash stacked trait routes'
        : rewardHotCount > 0
            ? routeSetupContext.rewardHotText ?? 'cash out the next chain reward'
            : followupCount > 0
              ? `follow up the marked mate${highlight.active && highlight.primaryLine ? `: ${highlight.primaryLine}` : ''}`
            : highlight.active && highlight.tone !== 'idle'
              ? `${highlight.headline}: ${highlight.primaryLine}`
              : readyCount > 0
                ? 'match a lit trait route'
                : setupCount > 0
                  ? routeSetupContext.hintText ?? 'move traits together'
                  : 'no chain routes are lit';
    return {
        label: `Chain board: ${parts.length > 0 ? parts.join(', ') : 'no lit cards'}. Next: ${action}.${
            routeSetupContext.sequenceText ? ` ${routeSetupContext.sequenceText}.` : ''
        }`,
        primaryLine: followupCount > 0 ? `${followupCount} selected follow-up${followupCount === 1 ? '' : 's'}` : highlight.primaryLine,
        secondaryLine: highlight.secondaryLine,
        tone,
        readyCount,
        followupCount,
        payoffStackCount,
        rewardHotCount,
        setupCount,
        surgeCount
    };
};

export const getTileAriaLabel = (
    board: BoardState,
    tile: Tile,
    faceUp: boolean,
    row: number,
    column: number,
    routeSetupContext: {
        hintText?: string | null;
        rewardHotText?: string | null;
        rewardHotTileIds?: ReadonlySet<string>;
        selectedFollowupTileIds?: ReadonlySet<string>;
        targetTileIds?: ReadonlySet<string>;
    } = {}
): string => {
    const base = faceUp
        ? tile.pairKey === DECOY_PAIR_KEY
            ? `Decoy trap tile, row ${row}, column ${column}. It never forms a pair.`
            : `Tile ${tile.label}, row ${row}, column ${column}`
        : `Hidden tile, row ${row}, column ${column}`;
    // The suit is the one thing a face-down tile shows, so it is the one thing its name says.
    // A hidden tile also says how big a clump it stands in: the read a sighted player gets from the
    // outline on the board, and the number the chain is planned against.
    const clump = !faceUp && tile.state === 'hidden' ? getClumpRead(board, tile.id) : null;
    const suitNote = tile.suit && tile.state !== 'matched' && tile.state !== 'removed'
        ? clump && clump.size > 1
            ? ` ${getTileSuit(tile.suit).name} suit, clump of ${clump.size}.`
            : ` ${getTileSuit(tile.suit).name} suit.`
        : '';
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
    const dungeonNote = dungeonKnowledge.familyKnown ? getDungeonCardText(tile, board) : '';
    const passiveScoutNote = scoutSourceNote && !routeNote.includes(scoutSourceNote.trim()) ? scoutSourceNote : '';
    const routeSetupNote = routeSetupContext.targetTileIds?.has(tile.id)
        ? ` Chain prime target. ${routeSetupContext.hintText ? `${routeSetupContext.hintText}.` : 'Move this card to create a trait route.'}`
        : '';
    const selectedFollowupNote = routeSetupContext.selectedFollowupTileIds?.has(tile.id)
        ? ' Selected chain follow-up. Match this mate to keep the trait route moving.'
        : '';
    const rewardHotNote = routeSetupContext.rewardHotTileIds?.has(tile.id)
        ? ` Best chain play. Chain reward hot. ${routeSetupContext.rewardHotText ?? 'Match this route to cash out the next chain reward.'}`
        : '';
    const beatNote = getTileBeatAccessibilityText(board, tile, faceUp, {
        rewardHotTileIds: routeSetupContext.rewardHotTileIds,
        selectedFollowupTileIds: routeSetupContext.selectedFollowupTileIds,
        targetTileIds: routeSetupContext.targetTileIds
    });
    return `${base}${suitNote}${findableNote}${routeNote}${dungeonNote}${getHazardTileText(tile)}${getTileTraitText(tile)}${getTileTraitPreviewText(board, tile)}${routeSetupNote}${selectedFollowupNote}${rewardHotNote}${beatNote}${passiveScoutNote}${getEnemyHazardText(board, tile.id)}`;
};

export const getPowerTargetAriaText = (
    tile: Tile,
    destroyPowerVisualActive: boolean,
    destroyEligibleTileIds: ReadonlySet<string>,
    peekPowerVisualActive: boolean,
    peekEligibleTileIds: ReadonlySet<string>,
    strayPowerVisualActive: boolean,
    strayEligibleTileIds: ReadonlySet<string>,
    tileSwapPowerVisualActive: boolean,
    tileSwapEligibleTileIds: ReadonlySet<string>,
    tileSwapFirstTileId: string | null,
    board?: BoardState
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
    if (tileSwapPowerVisualActive) {
        if (tileSwapFirstTileId === tile.id) {
            return ' Swap origin selected. Select a different hidden tile to exchange positions.';
        }
        const swapTraitPreview =
            board && tileSwapEligibleTileIds.has(tile.id)
                ? [
                      ...new Set([
                          getTraitSwapOpportunityPreview(board, tileSwapFirstTileId, tile.id).routeText,
                          ...getTileSwapTraitPreviewLines(board, tileSwapFirstTileId, tile.id)
                      ].filter((line): line is string => Boolean(line)))
                  ]
                : [];
        return tileSwapEligibleTileIds.has(tile.id)
            ? ` Swap target: valid. Select two hidden tiles to exchange their positions.${
                  swapTraitPreview.length > 0 ? ` Chain prime target. Swap preview: ${swapTraitPreview.slice(0, 2).join('; ')}.` : ''
              }`
            : tile.state === 'hidden'
              ? ' Swap target: invalid for this power.'
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
    strayPowerVisualActive,
    tileSwapEligibleTileIds,
    tileSwapFirstTileId,
    tileSwapPowerVisualActive,
    traitRewardHotText,
    traitRewardHotTileIds,
    traitRouteHintText,
    traitRouteTargetTileIds
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
    tileSwapEligibleTileIds: ReadonlySet<string>;
    tileSwapFirstTileId: string | null;
    tileSwapPowerVisualActive: boolean;
    traitRewardHotText?: string | null;
    traitRewardHotTileIds?: readonly string[];
    traitRouteHintText?: string | null;
    traitRouteTargetTileIds?: readonly string[];
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
    const traitRouteTargetTileIdSet = tileSwapPowerVisualActive ? EMPTY_ROUTE_SETUP_TARGETS : new Set(traitRouteTargetTileIds ?? []);
    const traitRewardHotTileIdSet = new Set(traitRewardHotTileIds ?? []);
    const selectedFollowupTileIds = getSelectedTraitFollowupTileIds(board);
    let label = getTileAriaLabel(board, tile, faceUp, row, column, {
        hintText: traitRouteHintText,
        rewardHotText: traitRewardHotText,
        rewardHotTileIds: traitRewardHotTileIdSet,
        selectedFollowupTileIds,
        targetTileIds: traitRouteTargetTileIdSet
    });
    label += getPowerTargetAriaText(
        tile,
        destroyPowerVisualActive,
        destroyEligibleTileIds,
        peekPowerVisualActive,
        peekEligibleTileIds,
        strayPowerVisualActive,
        strayEligibleTileIds,
        tileSwapPowerVisualActive,
        tileSwapEligibleTileIds,
        tileSwapFirstTileId,
        board
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
