import type { BoardState, RunStatus } from '../../shared/contracts';
import { activeEnemyHazardsForBoard } from '../../shared/enemy-hazard-board-rules';
import {
    getSelectedTraitFollowupTileIds,
    getTraitComboSurgeTileIds,
    getTraitOpportunityTileIds
} from '../../shared/trait-opportunities';
import { getTileTraitInteractionPreviewLines } from '../../shared/tile-trait-rules';
import {
    buildTraitInteractionLaneMap,
    getTraitInteractionLaneAction,
    type TraitInteractionLaneId
} from '../copy/traitInteractionLaneMap';
import { getResolvingSelectionState } from './tileResolvingSelection';
import { getPickableTileIds, getTilePosition } from './tileBoardDomAccessibility';
import {
    getDungeonUtilityReadabilityKind,
    getTraitRouteCadenceAction,
    getTraitRouteReadabilityBeatCount,
    getTraitRouteReadabilityBeatTier,
    getTraitRouteReadabilityCadence,
    getTraitRouteReadabilityGlyph,
    getTraitRouteReadabilityIntensity,
    getTraitRouteReadabilityTier,
    type TileTraitRouteReadabilityIntensity,
    type TileTraitRouteReadabilityTier,
    type TileTraitRouteCadence,
    type TileTraitRouteReadabilityGlyph,
    type TileTraitRouteBeatTier
} from './tileBoardReadability';

const CARD_FEEDBACK_ACTION_PRIORITY = ['cash-now', 'perk-cash', 'follow-up', 'build-lane', 'route-setup', 'bank-lane'] as const;
const CARD_FEEDBACK_TRAIT_LANE_ORDER: readonly TraitInteractionLaneId[] = [
    'shard',
    'guard',
    'tool',
    'risk',
    'block',
    'recall',
    'score'
];
const CARD_FEEDBACK_BEAT_TIER_ORDER = ['cashout', 'surge', 'follow-up', 'route', 'setup'] as const;
export const CARD_FEEDBACK_BEAT_TIER_CONTRACT = CARD_FEEDBACK_BEAT_TIER_ORDER.join(' ');
const CARD_FEEDBACK_CADENCE_ORDER = ['cashout', 'surge', 'follow-up', 'route', 'prime'] as const;
export const CARD_FEEDBACK_CADENCE_CONTRACT = CARD_FEEDBACK_CADENCE_ORDER.join(' ');
const CARD_FEEDBACK_ROUTE_GLYPH_ORDER = [
    'payoff-stack',
    'cashout-crown',
    'surge-burst',
    'next-tap',
    'linked-route',
    'prime-cross'
] as const;
export const CARD_FEEDBACK_ROUTE_GLYPH_CONTRACT = CARD_FEEDBACK_ROUTE_GLYPH_ORDER.join(' ');
type CardFeedbackBeatTier = Extract<TileTraitRouteBeatTier, (typeof CARD_FEEDBACK_BEAT_TIER_ORDER)[number]>;
type CardFeedbackCadence = Extract<TileTraitRouteCadence, (typeof CARD_FEEDBACK_CADENCE_ORDER)[number]>;
type CardFeedbackBeatCount = Exclude<ReturnType<typeof getTraitRouteReadabilityBeatCount>, 0>;
type CardFeedbackRouteGlyph = Extract<TileTraitRouteReadabilityGlyph, (typeof CARD_FEEDBACK_ROUTE_GLYPH_ORDER)[number]>;

export const getTraitLaneFeedbackBeatCount = (lane: TraitInteractionLaneId): 2 | 3 | 4 => {
    if (lane === 'shard' || lane === 'score' || lane === 'risk' || lane === 'block') {
        return 4;
    }
    if (lane === 'guard' || lane === 'tool' || lane === 'recall') {
        return 3;
    }
    return 2;
};

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

const getVisibleTileIds = ({
    board,
    debugPeekActive,
    peekRevealedTileIds,
    previewActive
}: {
    board: BoardState;
    debugPeekActive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
}): Set<string> => {
    const visibleTileIds = new Set<string>();
    for (const tile of board.tiles) {
        if (tile.state !== 'hidden' || previewActive || debugPeekActive || peekRevealedTileIds.has(tile.id)) {
            visibleTileIds.add(tile.id);
        }
    }
    return visibleTileIds;
};

export const getCardFeedbackVisibleTraitPreviewCount = ({
    board,
    debugPeekActive,
    peekRevealedTileIds,
    previewActive
}: {
    board: BoardState;
    debugPeekActive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
}): number => {
    const visibleTileIds = getVisibleTileIds({
        board,
        debugPeekActive,
        peekRevealedTileIds,
        previewActive
    });
    let count = 0;
    for (const tile of board.tiles) {
        if (tile.tileTraitKind == null || !visibleTileIds.has(tile.id)) {
            continue;
        }
        const previewLines = [
            ...getTileTraitInteractionPreviewLines(board, [tile.id], 'match'),
            ...getTileTraitInteractionPreviewLines(board, [tile.id], 'mismatch')
        ];
        if (previewLines.length > 0) {
            count += 1;
        }
    }
    return count;
};

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
    perkArmedTileIds = [],
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
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
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const pickable = new Set(getPickableTileIds(board, interactive, allowGambitThirdFlip));
    const enemyOccupied = new Set(
        activeEnemyHazardsForBoard(board).map((hazard) => hazard.currentTileId)
    );
    const traitOpportunityTileIds = getTraitOpportunityTileIds(board);
    const traitComboSurgeTileIds = getTraitComboSurgeTileIds(board);
    const perkArmedTileIdSet = new Set(perkArmedTileIds);
    const selectedTraitFollowupTileIdSet = new Set(selectedTraitFollowupTileIds ?? getSelectedTraitFollowupTileIds(board));
    const traitRewardHotTileIdSet = new Set(traitRewardHotTileIds);
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
                add('chain-ready');
                add('trait-combo');
            }
            if (traitComboSurgeTileIds.has(tile.id)) {
                add('chain-surge');
                add('trait-combo-surge');
            }
            if (traitRewardHotTileIdSet.has(tile.id)) {
                add('chain-reward-hot');
            }
            if (traitOpportunityTileIds.has(tile.id) && traitRewardHotTileIdSet.has(tile.id)) {
                add('trait-payoff-stack');
            }
        }
        if (perkArmedTileIdSet.has(tile.id) && tile.state === 'hidden' && !faceUp) {
            add('perk-armed');
        }
        if (selectedTraitFollowupTileIdSet.has(tile.id) && tile.state === 'hidden' && !faceUp) {
            add('selected-followup');
        }
        if (traitRouteTargetTileIdSet.has(tile.id)) {
            add('chain-setup');
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

export const getCardFeedbackMarkerShapesAttr = ({
    board,
    perkArmedTileIds = [],
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
    traitRouteTargetTileIds = []
}: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const traitOpportunityTileIds = getTraitOpportunityTileIds(board);
    const traitComboSurgeTileIds = getTraitComboSurgeTileIds(board);
    const perkArmedTileIdSet = new Set(perkArmedTileIds);
    const selectedTraitFollowupTileIdSet = new Set(selectedTraitFollowupTileIds ?? getSelectedTraitFollowupTileIds(board));
    const traitRewardHotTileIdSet = new Set(traitRewardHotTileIds);
    const traitRouteTargetTileIdSet = new Set(traitRouteTargetTileIds);
    const counts = new Map<string, number>();
    const add = (key: string): void => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    for (const tile of board.tiles) {
        if (tile.state !== 'hidden') {
            continue;
        }
        const chainReady = tile.tileTraitKind != null && traitOpportunityTileIds.has(tile.id);
        const perkArmed = perkArmedTileIdSet.has(tile.id);
        const rewardHot = tile.tileTraitKind != null && traitRewardHotTileIdSet.has(tile.id);
        const routeTarget = traitRouteTargetTileIdSet.has(tile.id);
        if (chainReady) {
            add('linked-route');
        }
        if (traitComboSurgeTileIds.has(tile.id)) {
            add('combo-surge');
        }
        if (rewardHot) {
            add('payoff-bar');
        }
        if (perkArmed) {
            add('perk-armed-bar');
        }
        if (selectedTraitFollowupTileIdSet.has(tile.id)) {
            add('followup-target');
        }
        if (chainReady && rewardHot) {
            add('payoff-stack');
        }
        if (routeTarget) {
            add('swap-target-crossbar');
        }
    }

    return [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `${key}:${count}`)
        .join(';');
};

export const getCardFeedbackActionCuesAttr = ({
    board,
    perkArmedTileIds = [],
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
    traitRouteTargetTileIds = []
}: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const counts = getCardFeedbackActionCueCounts({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    });

    return formatCounts(counts);
};

const getCardFeedbackActionCueCounts = ({
    board,
    perkArmedTileIds = [],
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
    traitRouteTargetTileIds = []
}: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): Map<string, number> => {
    const traitOpportunityTileIds = getTraitOpportunityTileIds(board);
    const perkArmedTileIdSet = new Set(perkArmedTileIds);
    const selectedTraitFollowupTileIdSet = new Set(selectedTraitFollowupTileIds ?? getSelectedTraitFollowupTileIds(board));
    const traitRewardHotTileIdSet = new Set(traitRewardHotTileIds);
    const traitRouteTargetTileIdSet = new Set(traitRouteTargetTileIds);
    const counts = new Map<string, number>();
    const add = (key: string): void => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    for (const tile of board.tiles) {
        if (tile.state !== 'hidden') {
            continue;
        }
        const chainReady = tile.tileTraitKind != null && traitOpportunityTileIds.has(tile.id);
        const rewardHot = tile.tileTraitKind != null && traitRewardHotTileIdSet.has(tile.id);
        const selectedFollowup = selectedTraitFollowupTileIdSet.has(tile.id);
        const perkArmed = perkArmedTileIdSet.has(tile.id);
        const routeTarget = traitRouteTargetTileIdSet.has(tile.id);

        if (chainReady && rewardHot) {
            add('cash-now');
        } else if (rewardHot) {
            add('bank-lane');
        } else if (selectedFollowup) {
            add('follow-up');
        } else if (chainReady) {
            add('build-lane');
        } else if (routeTarget) {
            add('route-setup');
        }
        if (perkArmed) {
            add('perk-cash');
        }
    }

    return counts;
};

const formatCounts = (counts: ReadonlyMap<string, number>): string =>
    [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `${key}:${count}`)
        .join(';');

export const getCardFeedbackActionPriorityAttr = (options: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const counts = getCardFeedbackActionCueCounts(options);
    return CARD_FEEDBACK_ACTION_PRIORITY
        .filter((key) => counts.has(key))
        .map((key) => `${key}:${counts.get(key)}`)
        .join('>');
};

export const getCardFeedbackPrimaryActionAttr = (options: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const counts = getCardFeedbackActionCueCounts(options);
    return CARD_FEEDBACK_ACTION_PRIORITY.find((key) => counts.has(key)) ?? 'none';
};

export const getCardFeedbackPrimaryCardCueAttr = (options: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const action = getCardFeedbackPrimaryActionAttr(options);
    if (action === 'none') {
        return 'none';
    }

    const beatTier = getCardFeedbackBeatTiersAttr(options).split('>')[0]?.split(':')[0] ?? 'none';
    const beatCount =
        beatTier !== 'none' && CARD_FEEDBACK_BEAT_TIER_ORDER.includes(beatTier as CardFeedbackBeatTier)
            ? getTraitRouteReadabilityBeatCount(beatTier as CardFeedbackBeatTier)
            : 0;
    const cadence = getCardFeedbackCadencesAttr(options).split('>')[0]?.split(':')[0] ?? 'none';
    const glyph = getCardFeedbackRouteGlyphsAttr(options).split(';')[0]?.split(':')[0] ?? 'none';

    return `${action}:${beatTier}:${beatCount}:${cadence}:${glyph}`;
};

function getTraitRouteReadabilityTierForTile({
    chainReady,
    perkArmed,
    rewardHot,
    routeTarget,
    selectedFollowup,
    surge
}: {
    chainReady: boolean;
    perkArmed: boolean;
    rewardHot: boolean;
    routeTarget: boolean;
    selectedFollowup: boolean;
    surge: boolean;
}): TileTraitRouteReadabilityTier {
    return getTraitRouteReadabilityTier({
        isPerkArmedBack: perkArmed,
        isSelectedTraitFollowupBack: selectedFollowup,
        isTraitComboBack: chainReady,
        isTraitComboSurgeBack: surge,
        isTraitPayoffStackBack: chainReady && rewardHot,
        isTraitRewardHotBack: rewardHot,
        isTraitRouteTargetBack: routeTarget
    });
}

export const getCardFeedbackBeatTiersAttr = ({
    board,
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
    traitRouteTargetTileIds = []
}: {
    board: BoardState;
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const traitOpportunityTileIds = getTraitOpportunityTileIds(board);
    const traitComboSurgeTileIds = getTraitComboSurgeTileIds(board);
    const selectedTraitFollowupTileIdSet = new Set(selectedTraitFollowupTileIds ?? getSelectedTraitFollowupTileIds(board));
    const traitRewardHotTileIdSet = new Set(traitRewardHotTileIds);
    const traitRouteTargetTileIdSet = new Set(traitRouteTargetTileIds);
    const counts = new Map<CardFeedbackBeatTier, number>();
    const add = (key: CardFeedbackBeatTier): void => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    for (const tile of board.tiles) {
        if (tile.state !== 'hidden') {
            continue;
        }
        const chainReady = tile.tileTraitKind != null && traitOpportunityTileIds.has(tile.id);
        const tier = getTraitRouteReadabilityTierForTile({
            chainReady,
            perkArmed: false,
            rewardHot: tile.tileTraitKind != null && traitRewardHotTileIdSet.has(tile.id),
            selectedFollowup: selectedTraitFollowupTileIdSet.has(tile.id),
            surge: tile.tileTraitKind != null && traitComboSurgeTileIds.has(tile.id),
            routeTarget: traitRouteTargetTileIdSet.has(tile.id)
        });
        const beatTier = getTraitRouteReadabilityBeatTier(tier);
        if (beatTier && CARD_FEEDBACK_BEAT_TIER_ORDER.includes(beatTier)) {
            add(beatTier);
        }
    }

    return CARD_FEEDBACK_BEAT_TIER_ORDER
        .filter((id) => counts.has(id))
        .map((id) => `${id}:${counts.get(id)}`)
        .join('>');
};

export const getCardFeedbackBeatCountsAttr = (options: Parameters<typeof getCardFeedbackBeatTiersAttr>[0]): string => {
    const beatTierAttr = getCardFeedbackBeatTiersAttr(options);
    const countsByBeat = new Map<CardFeedbackBeatCount, number>();

    for (const entry of beatTierAttr.split('>')) {
        if (!entry) {
            continue;
        }
        const [tier, countText] = entry.split(':');
        if (!tier || !CARD_FEEDBACK_BEAT_TIER_ORDER.includes(tier as CardFeedbackBeatTier)) {
            continue;
        }
        const count = Number(countText);
        if (!Number.isFinite(count)) {
            continue;
        }
        const beatCount = getTraitRouteReadabilityBeatCount(tier as CardFeedbackBeatTier);
        if (beatCount === 0) {
            continue;
        }
        countsByBeat.set(beatCount, (countsByBeat.get(beatCount) ?? 0) + count);
    }

    return [...countsByBeat.entries()]
        .sort(([a], [b]) => b - a)
        .map(([beatCount, count]) => `${beatCount}:${count}`)
        .join('>');
};

export const getCardFeedbackCadencesAttr = (options: Parameters<typeof getCardFeedbackBeatTiersAttr>[0]): string => {
    const traitOpportunityTileIds = getTraitOpportunityTileIds(options.board);
    const traitComboSurgeTileIds = getTraitComboSurgeTileIds(options.board);
    const selectedTraitFollowupTileIdSet = new Set(options.selectedTraitFollowupTileIds ?? getSelectedTraitFollowupTileIds(options.board));
    const traitRewardHotTileIdSet = new Set(options.traitRewardHotTileIds ?? []);
    const traitRouteTargetTileIdSet = new Set(options.traitRouteTargetTileIds ?? []);
    const counts = new Map<CardFeedbackCadence, number>();
    const add = (key: CardFeedbackCadence): void => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    for (const tile of options.board.tiles) {
        if (tile.state !== 'hidden') {
            continue;
        }
        const chainReady = tile.tileTraitKind != null && traitOpportunityTileIds.has(tile.id);
        const tier = getTraitRouteReadabilityTierForTile({
            chainReady,
            perkArmed: false,
            rewardHot: tile.tileTraitKind != null && traitRewardHotTileIdSet.has(tile.id),
            selectedFollowup: selectedTraitFollowupTileIdSet.has(tile.id),
            surge: tile.tileTraitKind != null && traitComboSurgeTileIds.has(tile.id),
            routeTarget: traitRouteTargetTileIdSet.has(tile.id)
        });
        const cadence = getTraitRouteReadabilityCadence(tier);
        if (CARD_FEEDBACK_CADENCE_ORDER.includes(cadence as CardFeedbackCadence)) {
            add(cadence as CardFeedbackCadence);
        }
    }

    return CARD_FEEDBACK_CADENCE_ORDER
        .filter((id) => counts.has(id))
        .map((id) => `${id}:${getTraitRouteCadenceAction(id)}:${counts.get(id)}`)
        .join('>');
};

export const getCardFeedbackTraitLaneCuesAttr = (board: BoardState): string => {
    const traitOpportunityTileIds = getTraitOpportunityTileIds(board);
    const laneCounts = new Map<TraitInteractionLaneId, number>();

    for (const tileId of traitOpportunityTileIds) {
        const tile = board.tiles.find((candidate) => candidate.id === tileId);
        if (!tile || tile.state !== 'hidden') {
            continue;
        }
        for (const lane of buildTraitInteractionLaneMap(getTileTraitInteractionPreviewLines(board, [tileId], 'match'))) {
            laneCounts.set(lane.id, (laneCounts.get(lane.id) ?? 0) + 1);
        }
    }

    return CARD_FEEDBACK_TRAIT_LANE_ORDER
        .filter((id) => laneCounts.has(id))
        .map((id) => `${id}:${laneCounts.get(id)}`)
        .join('>');
};

export const getCardFeedbackTraitLaneBeatsAttr = (board: BoardState): string => {
    const laneCuesAttr = getCardFeedbackTraitLaneCuesAttr(board);
    if (!laneCuesAttr) {
        return '';
    }

    return laneCuesAttr
        .split('>')
        .map((entry) => {
            const [laneId] = entry.split(':') as [TraitInteractionLaneId | undefined, string | undefined];
            if (!laneId || !CARD_FEEDBACK_TRAIT_LANE_ORDER.includes(laneId)) {
                return null;
            }
            return `${laneId}:${getTraitLaneFeedbackBeatCount(laneId)}`;
        })
        .filter((entry): entry is string => entry != null)
        .join('>');
};

export const getCardFeedbackTraitLaneActionsAttr = (board: BoardState): string => {
    const laneCuesAttr = getCardFeedbackTraitLaneCuesAttr(board);
    if (!laneCuesAttr) {
        return '';
    }

    return laneCuesAttr
        .split('>')
        .map((entry) => {
            const [laneId, countText] = entry.split(':') as [TraitInteractionLaneId | undefined, string | undefined];
            if (!laneId || !CARD_FEEDBACK_TRAIT_LANE_ORDER.includes(laneId)) {
                return null;
            }
            const count = Number(countText);
            return `${laneId}:${getTraitInteractionLaneAction(laneId)}:${Number.isFinite(count) ? count : 0}`;
        })
        .filter((entry): entry is string => entry != null)
        .join('>');
};

export const getCardFeedbackTraitLanePrimaryActionAttr = (board: BoardState): string => {
    const laneCuesAttr = getCardFeedbackTraitLaneCuesAttr(board);
    if (!laneCuesAttr) {
        return 'none';
    }

    const laneCounts = new Map(
        laneCuesAttr
            .split('>')
            .map((entry) => {
                const [laneId, countText] = entry.split(':') as [TraitInteractionLaneId | undefined, string | undefined];
                const count = Number(countText);
                return laneId && CARD_FEEDBACK_TRAIT_LANE_ORDER.includes(laneId) && Number.isFinite(count)
                    ? [laneId, count] as const
                    : null;
            })
            .filter((entry): entry is readonly [TraitInteractionLaneId, number] => entry != null)
    );
    const primaryLane = CARD_FEEDBACK_TRAIT_LANE_ORDER.find((id) => laneCounts.has(id));

    return primaryLane ? `${primaryLane}:${getTraitInteractionLaneAction(primaryLane)}:${laneCounts.get(primaryLane)}` : 'none';
};

export const getCardFeedbackTraitRouteTiersAttr = ({
    board,
    perkArmedTileIds = [],
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
    traitRouteTargetTileIds = []
}: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const traitOpportunityTileIds = getTraitOpportunityTileIds(board);
    const traitComboSurgeTileIds = getTraitComboSurgeTileIds(board);
    const perkArmedTileIdSet = new Set(perkArmedTileIds);
    const selectedTraitFollowupTileIdSet = new Set(selectedTraitFollowupTileIds ?? getSelectedTraitFollowupTileIds(board));
    const traitRewardHotTileIdSet = new Set(traitRewardHotTileIds);
    const traitRouteTargetTileIdSet = new Set(traitRouteTargetTileIds);
    const counts = new Map<TileTraitRouteReadabilityTier, number>();
    const add = (key: TileTraitRouteReadabilityTier): void => {
        if (key === 'none') {
            return;
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    for (const tile of board.tiles) {
        if (tile.state !== 'hidden') {
            continue;
        }
        const chainReady = tile.tileTraitKind != null && traitOpportunityTileIds.has(tile.id);
        add(getTraitRouteReadabilityTierForTile({
            chainReady,
            perkArmed: perkArmedTileIdSet.has(tile.id),
            rewardHot: tile.tileTraitKind != null && traitRewardHotTileIdSet.has(tile.id),
            routeTarget: traitRouteTargetTileIdSet.has(tile.id),
            selectedFollowup: selectedTraitFollowupTileIdSet.has(tile.id),
            surge: tile.tileTraitKind != null && traitComboSurgeTileIds.has(tile.id)
        }));
    }

    return [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `${key}:${count}`)
        .join(';');
};

export const getCardFeedbackTraitRouteIntensitiesAttr = ({
    board,
    perkArmedTileIds = [],
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
    traitRouteTargetTileIds = []
}: {
    board: BoardState;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): string => {
    const tierCounts = getCardFeedbackTraitRouteTiersAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    });
    const counts = new Map<TileTraitRouteReadabilityIntensity, number>();

    for (const entry of tierCounts.split(';')) {
        if (!entry) {
            continue;
        }
        const [tier, countText] = entry.split(':') as [TileTraitRouteReadabilityTier, string];
        const intensity = getTraitRouteReadabilityIntensity(tier);
        const count = Number(countText);
        if (intensity === 'none' || !Number.isFinite(count)) {
            continue;
        }
        counts.set(intensity, (counts.get(intensity) ?? 0) + count);
    }

    return [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `${key}:${count}`)
        .join(';');
};

export const getCardFeedbackRouteGlyphsAttr = (
    options: Parameters<typeof getCardFeedbackTraitRouteTiersAttr>[0]
): string => {
    const tierCounts = getCardFeedbackTraitRouteTiersAttr(options);
    const counts = new Map<CardFeedbackRouteGlyph, number>();

    for (const entry of tierCounts.split(';')) {
        if (!entry) {
            continue;
        }
        const [tier, countText] = entry.split(':') as [TileTraitRouteReadabilityTier, string];
        const glyph = getTraitRouteReadabilityGlyph(tier);
        const count = Number(countText);
        if (glyph === 'none' || !Number.isFinite(count)) {
            continue;
        }
        counts.set(glyph as CardFeedbackRouteGlyph, (counts.get(glyph as CardFeedbackRouteGlyph) ?? 0) + count);
    }

    return CARD_FEEDBACK_ROUTE_GLYPH_ORDER
        .filter((id) => counts.has(id))
        .map((id) => `${id}:${counts.get(id)}`)
        .join(';');
};

export const getDevE2ePairPositionsJson = (
    board: BoardState,
    includeDevAttributes: boolean
): string | undefined => {
    if (!includeDevAttributes) {
        return undefined;
    }

    const pairKeys: string[] = [];
    const byKey = new Map<string, { row: number; col: number }[]>();
    board.tiles.forEach((tile, index) => {
        const { row, column } = getTilePosition(index, board.columns);
        const k = tile.pairKey;
        const positions = byKey.get(k);
        if (positions) {
            positions.push({ row, col: column });
        } else {
            pairKeys.push(k);
            byKey.set(k, [{ row, col: column }]);
        }
    });
    const keys = pairKeys.filter((k) => byKey.get(k)?.length === 2);
    if (keys.length < 2) {
        return undefined;
    }
    const slim: Record<string, { row: number; col: number }[]> = {};
    for (const k of keys) {
        slim[k] = byKey.get(k)!;
    }
    return JSON.stringify(slim);
};
