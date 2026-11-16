import { plural, tr } from '../../shared/i18n';
import { WANDERER_COPY, SLEEPER_COPY } from '../copy/oddCardBeat';
import type { BoardState, RunStatus, Tile } from '../../shared/contracts';
import { getFindableRewardText } from '../../shared/findables';
import { getPairProximityGridDistance } from '../../shared/pairProximityHint';
import { getTileSuit } from '../../shared/tile-suit-rules';
import { getClumpRead, type ClumpReadContext } from '../../shared/clump-read-rules';
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
import { isTileBoardFlipLocked } from './tileBoardFlipLock';
import { ELEMENT_GROUND_RULES, readElementalGround } from '../../shared/element-ground-rules';
import { ELEMENT_NAMES } from '../../shared/element-alchemy-rules';

const EMPTY_ROUTE_SETUP_TARGETS: ReadonlySet<string> = new Set();

export const getTilePosition = (index: number, columns: number): { row: number; column: number } => ({
    row: Math.floor(index / columns) + 1,
    column: (index % columns) + 1
});

export const getTileTraitPreviewText = (board: BoardState, tile: Tile): string => {
    const opportunity = getTraitOpportunitySummary(board).tiles.find((entry) => entry.tileId === tile.id);
    const lines = opportunity?.previewLines ?? [
        ...getTileTraitInteractionPreviewLines(board, [tile.id])
    ];
    const unique = [...new Set(lines)];
    if (unique.length === 0) {
        return '';
    }
    const comboSurge = opportunity != null && getTraitComboSurgeTileIds(board).has(tile.id);
    return opportunity
        ? tr` ${comboSurge ? tr.s('Combo-surge') : tr.s('Chain-ready')} trait card. Match now: ${unique.slice(0, 2).join('; ')}.`
        : tr` Nearby trait interaction: ${unique.slice(0, 2).join('; ')}.`;
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
                ? tr.s('Hit this route now.')
                : tr.s('Reward lane is hot.')
            : traitRouteCadence === 'surge'
              ? tr.s('Multiple trait routes are live.')
              : traitRouteCadence === 'follow-up'
                ? tr.s('Tap next to keep the route moving.')
                : traitRouteCadence === 'route'
                  ? tr.s('Match to build chain.')
                  : tr.s('Set this route up.');
    return tr` Beat: ${traitRouteCadence}. Action: ${getTraitRouteCadenceAction(traitRouteCadence)}. ${beatCount}-beat pulse. ${detail}`;
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
        readyCount > 0 ? `${plural(readyCount, { one: '{0} chain-ready card', other: '{0} chain-ready cards' })}` : null,
        followupCount > 0 ? `${plural(followupCount, { one: '{0} selected follow-up', other: '{0} selected follow-ups' })}` : null,
        surgeCount > 0 ? `${plural(surgeCount, { one: '{0} surge card', other: '{0} surge cards' })}` : null,
        payoffStackCount > 0 ? `${plural(payoffStackCount, { one: '{0} payoff-stack card', other: '{0} payoff-stack cards' })}` : null,
        rewardHotCount > 0 ? `${plural(rewardHotCount, { one: '{0} reward-hot card', other: '{0} reward-hot cards' })}` : null,
        setupCount > 0 ? `${plural(setupCount, { one: '{0} prime target', other: '{0} prime targets' })}` : null
    ].filter((part): part is string => Boolean(part));
    const action =
        payoffStackCount > 0
            ? routeSetupContext.rewardHotText ?? tr.s('cash stacked trait routes')
        : rewardHotCount > 0
            ? routeSetupContext.rewardHotText ?? tr.s('cash out the next chain reward')
            : followupCount > 0
              ? tr`follow up the marked mate${highlight.active && highlight.primaryLine ? `: ${highlight.primaryLine}` : ''}`
            : highlight.active && highlight.tone !== 'idle'
              ? `${highlight.headline}: ${highlight.primaryLine}`
              : readyCount > 0
                ? tr.s('match a lit trait route')
                : setupCount > 0
                  ? routeSetupContext.hintText ?? tr.s('move traits together')
                  : tr.s('no chain routes are lit');
    return {
        label: tr`Chain board: ${parts.length > 0 ? parts.join(', ') : tr.s('no lit cards')}. Next: ${action}.${
            routeSetupContext.sequenceText ? ` ${routeSetupContext.sequenceText}.` : ''
        }`,
        primaryLine: followupCount > 0 ? `${plural(followupCount, { one: '{0} selected follow-up', other: '{0} selected follow-ups' })}` : highlight.primaryLine,
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
    } = {},
    /** The aim guide's context, so a screen reader is told the same tier read the board draws. */
    clumpReadContext: ClumpReadContext = { chain: 1, run: { floorCurioId: null } }
): string => {
    const base = faceUp
        ? tr`Tile ${tile.label}, row ${row}, column ${column}`
        : tr`Hidden tile, row ${row}, column ${column}`;
    // The suit is the one thing a face-down tile shows, so it is the one thing its name says.
    // A hidden tile also says how big a clump it stands in: the read a sighted player gets from the
    // outline on the board, and the number the chain is planned against.
    const clump = !faceUp && tile.state === 'hidden' ? getClumpRead(board, tile.id, clumpReadContext) : null;
    const suitNote = tile.suit && tile.state !== 'matched' && tile.state !== 'removed'
        ? clump && clump.size > 1
            ? tr` ${getTileSuit(tile.suit).name} suit, clump of ${clump.size}.`
            : tr` ${getTileSuit(tile.suit).name} suit.`
        : '';
    const findableNote = tile.findableKind && faceUp && tile.state !== 'matched' ? ` ${getFindableRewardText(tile.findableKind)}` : '';
    const routeSetupNote = routeSetupContext.targetTileIds?.has(tile.id)
        ? tr` Chain prime target. ${routeSetupContext.hintText ? `${routeSetupContext.hintText}.` : tr.s('Move this card to create a trait route.')}`
        : '';
    const selectedFollowupNote = routeSetupContext.selectedFollowupTileIds?.has(tile.id)
        ? tr.s(' Selected chain follow-up. Match this mate to keep the trait route moving.')
        : '';
    const rewardHotNote = routeSetupContext.rewardHotTileIds?.has(tile.id)
        ? tr` Best chain play. Chain reward hot. ${routeSetupContext.rewardHotText ?? tr.s('Match this route to cash out the next chain reward.')}`
        : '';
    const beatNote = getTileBeatAccessibilityText(board, tile, faceUp, {
        rewardHotTileIds: routeSetupContext.rewardHotTileIds,
        selectedFollowupTileIds: routeSetupContext.selectedFollowupTileIds,
        targetTileIds: routeSetupContext.targetTileIds
    });
    const ground = readElementalGround(board)[(row - 1) * board.columns + column - 1];
    const groundNote = ground ? tr` ${ELEMENT_NAMES[ground]} ground. ${ELEMENT_GROUND_RULES[ground]}` : '';
    const coatingNote = tile.rime ? tr.s(' Rime: playable, anchored against currents and protected from arena holds. Match to calm the next turn.')
        : tile.seeded ? tr` ${tile.seeded >= 2 ? tr.s('Bloom') : tr.s('Seed')}: playable. Match for ${Math.min(2, tile.seeded)} gold.` : '';
    return `${base}${suitNote}${groundNote}${coatingNote}${findableNote}${getTileTraitText(tile)}${getTileTraitPreviewText(board, tile)}${routeSetupNote}${selectedFollowupNote}${rewardHotNote}${beatNote}`;
};

export const getPowerTargetAriaText = (
    tile: Tile,
    peekPowerVisualActive: boolean,
    peekEligibleTileIds: ReadonlySet<string>,
    tileSwapPowerVisualActive: boolean,
    tileSwapEligibleTileIds: ReadonlySet<string>,
    tileSwapFirstTileId: string | null,
    board?: BoardState
): string => {
    if (peekPowerVisualActive) {
        return peekEligibleTileIds.has(tile.id)
            ? tr.s(' Peek target: valid. Reveals this one tile and locks Perfect Memory.')
            : tile.state === 'hidden'
              ? tr.s(' Peek target: invalid or already revealed.')
              : '';
    }
    if (tileSwapPowerVisualActive) {
        if (tileSwapFirstTileId === tile.id) {
            return tr.s(' Swap origin selected. Select a different hidden tile to exchange positions.');
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
            ? tr` Swap target: valid. Select two hidden tiles to exchange their positions.${
                  swapTraitPreview.length > 0 ? tr` Chain prime target. Swap preview: ${swapTraitPreview.slice(0, 2).join('; ')}.` : ''
              }`
            : tile.state === 'hidden'
              ? tr.s(' Swap target: invalid for this power.')
              : '';
    }
    return '';
};

export const getPickableTileIds = (
    board: BoardState,
    interactive: boolean,
    allowGambitThirdFlip: boolean,
    zoneFlipCapacity = 0
): string[] => {
    const flipLocked = isTileBoardFlipLocked({
        allowGambitThirdFlip,
        flippedTileCount: board.flippedTileIds.length,
        zoneFlipCapacity
    });
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
    allowGambitThirdFlip: boolean,
    zoneFlipCapacity = 0
): string | null => {
    const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip, zoneFlipCapacity));
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
    focusedTileId,
    pairProximityHintsEnabled,
    peekEligibleTileIds,
    peekPowerVisualActive,
    peekRevealedTileIds,
    previewActive,
    runStatus,
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
    focusedTileId: string | null;
    pairProximityHintsEnabled: boolean;
    peekEligibleTileIds: ReadonlySet<string>;
    peekPowerVisualActive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    runStatus: RunStatus;
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
    // The Wanderers (`wanderer-rules.ts`): the trail on any card, and the Wanderer on its face.
    if (tile.footprint && tile.state === 'hidden') label += WANDERER_COPY.footprintLabel;
    if (tile.wanderer && faceUp) label += WANDERER_COPY.wandererLabel;
    if (tile.sleeper && faceUp) label += SLEEPER_COPY.sleeperLabel;
    label += getPowerTargetAriaText(
        tile,
        peekPowerVisualActive,
        peekEligibleTileIds,
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
