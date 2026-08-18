import type { BoardState } from '../../shared/contracts';
import { getFindableRewardText } from '../../shared/findables';
import { getHazardTileTelegraph } from '../../shared/hazard-tiles';
import { getTileSwapTraitPreviewLines, getTileTraitInteractionPreviewLines } from '../../shared/tile-trait-rules';
import { getTraitSwapOpportunityPreview } from '../../shared/trait-opportunities';
import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction,
    getTraitInteractionLaneId,
    getTraitInteractionLaneRoleId,
    TRAIT_INTERACTION_LANE_LABELS,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr,
    traitInteractionLaneRoleMapAttr,
    type TraitInteractionLaneId
} from '../copy/traitInteractionLaneMap';
import {
    getTraitMarkerCueByRouteGlyph,
    getTraitMarkerCueByShape,
    TRAIT_MARKER_ROUTE_GLYPH_PRIORITY,
    type TraitMarkerCueAction,
    type TraitMarkerRouteGlyphId,
    type TraitMarkerShapeId
} from '../copy/traitMarkerCueGlossary';
import { getBoardChainAccessibilitySummary } from './tileBoardDomAccessibility';
import type { BoardChainOpportunityState, BoardTraitModeCueState } from './tileBoardFeedbackState';

type BoardFeedbackScreenCue = 'burst' | 'guard' | 'pulse' | 'tick';
type BoardChainMarkerKeySummaryAction = 'cashout' | 'followup' | 'perk' | 'prime' | 'route' | 'surge';
type BoardChainMarkerKeySummaryTier = 'cashout' | 'perk' | 'ready' | 'setup' | 'stack' | 'surge';
type BoardChainMarkerIntensityId = 'cashout' | 'ready' | 'setup' | 'stack' | 'surge';

const TRAIT_ROUTE_INTENSITY_PRIORITY = ['stack', 'cashout', 'surge', 'ready', 'setup'] as const;
const TRAIT_ROUTE_INTENSITY_LABELS: Record<(typeof TRAIT_ROUTE_INTENSITY_PRIORITY)[number], string> = {
    cashout: 'Cashout',
    ready: 'Ready',
    setup: 'Prime',
    stack: 'Stack',
    surge: 'Surge'
};
const TRAIT_ROUTE_INTENSITY_ACTIONS: Record<(typeof TRAIT_ROUTE_INTENSITY_PRIORITY)[number], string> = {
    cashout: 'Hit now',
    ready: 'Match route',
    setup: 'Prime payoff',
    stack: 'Cash stack',
    surge: 'Chain routes'
};

interface BoardChainDisplayFormatDeps {
    formatLabel: (label: string, rows: readonly (string | null | undefined)[]) => string;
}

export interface BoardChainAccessibilitySummaryState {
    followupCount: number;
    label: string;
    payoffStackCount: number;
    primaryLine: string;
    readyCount: number;
    rewardHotCount: number;
    secondaryLine: string | null;
    setupCount: number;
    surgeCount: number;
    tone: string;
}

export interface FocusedPreviewChipState {
    action: 'Cashout' | 'Claim' | 'Preview' | 'Route' | 'Scout';
    eyebrow: string;
    kind: 'hazard' | 'pickup' | 'trait';
    lines: string[];
    rewardHotText?: string | null;
    source: 'focus' | 'selected';
    tone: 'cashout' | 'hazard' | 'pickup' | 'setup' | 'trait';
}

export interface BoardChainMarkerIntensityState {
    action: string;
    count: number;
    id: BoardChainMarkerIntensityId;
    label: string;
}

export interface BoardChainMarkerKeyRowState {
    action: TraitMarkerCueAction;
    count: number;
    glyph: string;
    id: TraitMarkerRouteGlyphId | 'perk-armed-bar';
    label: string;
    shape: TraitMarkerShapeId;
}

export interface BoardChainRecipeRowState {
    action: string;
    label: string;
    laneId: TraitInteractionLaneId;
    recipe: string;
    roleId: string;
    sourceLine: string;
}

export interface BoardChainDisplayState {
    boardChainAccessibilitySummary: BoardChainAccessibilitySummaryState;
    boardChainMarkerKeyMeterFill: number;
    boardChainMarkerKeyRows: BoardChainMarkerKeyRowState[];
    boardChainMarkerKeySummaryAction: BoardChainMarkerKeySummaryAction | null;
    boardChainMarkerKeySummaryBeatCount: 2 | 3 | 4 | 5;
    boardChainMarkerKeySummaryScreenCue: BoardFeedbackScreenCue | null;
    boardChainMarkerKeySummaryTier: BoardChainMarkerKeySummaryTier | null;
    boardChainOpportunityLabel: string;
    boardChainOpportunityMeterFill: number;
    boardChainRecipeChips: string[];
    boardChainRecipeRows: BoardChainRecipeRowState[];
    boardTraitInteractionLaneActionMapAttrValue: string;
    boardTraitInteractionLaneMap: ReturnType<typeof buildTraitInteractionLaneMap>;
    boardTraitInteractionLaneMapAccessibleLabel: string;
    boardTraitInteractionLaneMapAttrValue: string;
    boardTraitInteractionLaneMapMeterFill: number;
    boardTraitInteractionLaneRoleMapAttrValue: string;
    boardTraitModeCueLabel: string | undefined;
    chainMarkerIntensity: BoardChainMarkerIntensityState | null;
    focusedChainMarkerShape: TraitMarkerShapeId | 'none';
    focusedPreviewChip: FocusedPreviewChipState | null;
    focusedPreviewChipLabel: string | undefined;
    primaryBoardTraitInteractionLane: ReturnType<typeof buildTraitInteractionLaneMap>[number] | null;
}

const getBoardChainMarkerKeySummaryAction = (
    focusedShape: string,
    intensityId: string | null | undefined
): BoardChainMarkerKeySummaryAction => {
    if (focusedShape === 'payoff-stack' || focusedShape === 'payoff-bar' || intensityId === 'cashout' || intensityId === 'stack') {
        return 'cashout';
    }
    if (focusedShape === 'followup-target' || intensityId === 'ready') {
        return 'followup';
    }
    if (focusedShape === 'combo-surge' || intensityId === 'surge') {
        return 'surge';
    }
    if (focusedShape === 'swap-target-crossbar' || intensityId === 'setup') {
        return 'prime';
    }
    if (focusedShape === 'perk-armed-bar') {
        return 'perk';
    }
    return 'route';
};

const getBoardChainMarkerKeySummaryTier = (
    focusedShape: string,
    intensityId: string | null | undefined
): BoardChainMarkerKeySummaryTier => {
    if (focusedShape === 'payoff-stack' || intensityId === 'stack') {
        return 'stack';
    }
    if (focusedShape === 'payoff-bar' || intensityId === 'cashout') {
        return 'cashout';
    }
    if (focusedShape === 'combo-surge' || intensityId === 'surge') {
        return 'surge';
    }
    if (focusedShape === 'swap-target-crossbar' || intensityId === 'setup') {
        return 'setup';
    }
    if (focusedShape === 'perk-armed-bar') {
        return 'perk';
    }
    return 'ready';
};

const getBoardChainMarkerKeySummaryScreenCue = (tier: BoardChainMarkerKeySummaryTier): BoardFeedbackScreenCue => {
    if (tier === 'cashout' || tier === 'stack' || tier === 'surge') {
        return 'burst';
    }
    if (tier === 'perk' || tier === 'ready') {
        return 'pulse';
    }
    return 'tick';
};

export const buildBoardChainDisplayState = ({
    board,
    boardApplicationFocused,
    boardChainOpportunity,
    boardTraitModeCue,
    cardFeedbackMarkerShapesAttr,
    cardFeedbackRouteGlyphsAttr,
    cardFeedbackStatesAttr,
    cardFeedbackTraitRouteIntensitiesAttr,
    deps,
    focusedTileId,
    parseCountAttribute,
    selectedTraitFollowupTileIds,
    tileSwapFirstTileId,
    tileSwapPowerVisualActive,
    traitOpportunityInteractionLines,
    traitRewardHotText,
    traitRewardHotTileIds,
    traitRouteHintText,
    traitRouteTargetTileIds
}: {
    board: BoardState;
    boardApplicationFocused: boolean;
    boardChainOpportunity: BoardChainOpportunityState;
    boardTraitModeCue: BoardTraitModeCueState | null;
    cardFeedbackMarkerShapesAttr: string;
    cardFeedbackRouteGlyphsAttr: string;
    cardFeedbackStatesAttr: string | null | undefined;
    cardFeedbackTraitRouteIntensitiesAttr: string;
    deps: BoardChainDisplayFormatDeps;
    focusedTileId: string | null;
    parseCountAttribute: (value: string) => Map<string, number>;
    selectedTraitFollowupTileIds: string[];
    tileSwapFirstTileId: string | null | undefined;
    tileSwapPowerVisualActive: boolean;
    traitOpportunityInteractionLines: string[];
    traitRewardHotText: string | null;
    traitRewardHotTileIds: string[];
    traitRouteHintText: string | null | undefined;
    traitRouteTargetTileIds: readonly string[] | undefined;
}): BoardChainDisplayState => {
    const counts = parseCountAttribute(cardFeedbackTraitRouteIntensitiesAttr);
    const intensityId = TRAIT_ROUTE_INTENSITY_PRIORITY.find((candidate) => counts.has(candidate)) ?? null;
    const chainMarkerIntensity = intensityId
        ? {
              action: TRAIT_ROUTE_INTENSITY_ACTIONS[intensityId],
              count: counts.get(intensityId) ?? 0,
              id: intensityId,
              label: TRAIT_ROUTE_INTENSITY_LABELS[intensityId]
          }
        : null;

    const boardChainAccessibilitySummary = getBoardChainAccessibilitySummary(board, {
        hintText: traitRouteHintText,
        rewardHotText: traitRewardHotText,
        rewardHotTileIds: new Set(traitRewardHotTileIds),
        sequenceText: traitRewardHotText
            ? `Sequence: First match lit route. Then ${traitRewardHotText.split('.')[0]}. Keep chain target live`
            : null,
        selectedFollowupTileIds: new Set(selectedTraitFollowupTileIds),
        targetTileIds: tileSwapPowerVisualActive ? undefined : new Set(traitRouteTargetTileIds)
    });

    const boardChainOpportunityMeterFill =
        boardChainAccessibilitySummary.tone === 'idle'
            ? 0
            : Math.round(
                  Math.min(
                      100,
                      ((boardChainAccessibilitySummary.readyCount +
                          boardChainAccessibilitySummary.followupCount +
                          boardChainAccessibilitySummary.surgeCount +
                          boardChainAccessibilitySummary.rewardHotCount +
                          boardChainAccessibilitySummary.setupCount) /
                          5) *
                          100
                  )
              );

    const selectedPreviewTileId =
        boardApplicationFocused || board.flippedTileIds.length !== 1
            ? null
            : (() => {
                  const [tileId] = board.flippedTileIds;
                  const tile = board.tiles.find((candidate) => candidate.id === tileId);
                  return tile && tile.state === 'flipped' ? tile.id : null;
              })();
    const previewChipTileId = boardApplicationFocused ? focusedTileId : selectedPreviewTileId;

    const focusedPreviewChip = (() => {
        if (!previewChipTileId) {
            return null;
        }
        const focusedTile = board.tiles.find((tile) => tile.id === previewChipTileId);
        if (!focusedTile) {
            return null;
        }
        const source = boardApplicationFocused ? ('focus' as const) : ('selected' as const);
        if (tileSwapPowerVisualActive && tileSwapFirstTileId && previewChipTileId !== tileSwapFirstTileId) {
            const routePreview = getTraitSwapOpportunityPreview(board, tileSwapFirstTileId, previewChipTileId).routeText;
            const lines = [
                ...new Set([
                    ...(routePreview ? [routePreview] : []),
                    ...getTileSwapTraitPreviewLines(board, tileSwapFirstTileId, previewChipTileId)
                ])
            ].slice(0, 2);
            return lines.length > 0
                ? ({ action: 'Route', eyebrow: 'Swap preview', kind: 'trait', lines, source, tone: 'setup' } satisfies FocusedPreviewChipState)
                : null;
        }
        const hazardTelegraph = getHazardTileTelegraph(focusedTile);
        if (hazardTelegraph.hasHazard && hazardTelegraph.label && hazardTelegraph.telegraph) {
            return {
                action: 'Scout',
                eyebrow: 'Hazard',
                kind: 'hazard',
                lines: [hazardTelegraph.label, hazardTelegraph.telegraph],
                source,
                tone: 'hazard'
            } satisfies FocusedPreviewChipState;
        }
        const traitLines = [
            ...new Set([
                ...getTileTraitInteractionPreviewLines(board, [focusedTile.id], 'match'),
                ...getTileTraitInteractionPreviewLines(board, [focusedTile.id], 'mismatch')
            ])
        ].slice(0, 2);
        if (traitLines.length > 0) {
            const rewardHot = traitRewardHotTileIds.includes(focusedTile.id) ? traitRewardHotText : null;
            return {
                action: rewardHot ? 'Cashout' : 'Preview',
                eyebrow: 'Trait combo',
                kind: 'trait',
                lines: traitLines,
                rewardHotText: rewardHot,
                source,
                tone: rewardHot ? 'cashout' : 'trait'
            } satisfies FocusedPreviewChipState;
        }
        if (focusedTile.findableKind != null) {
            return {
                action: 'Claim',
                eyebrow: 'Pickup',
                kind: 'pickup',
                lines: [getFindableRewardText(focusedTile.findableKind)],
                source,
                tone: 'pickup'
            } satisfies FocusedPreviewChipState;
        }
        return null;
    })();

    const focusedPreviewChipLabel = focusedPreviewChip
        ? deps.formatLabel(
              `${focusedPreviewChip.eyebrow} ${
                  focusedPreviewChip.kind === 'pickup'
                      ? 'reward'
                      : focusedPreviewChip.kind === 'hazard'
                        ? 'risk'
                        : /\btrait-payoff-stack:\d+/.test(cardFeedbackStatesAttr ?? '')
                          ? 'stack'
                          : 'combo'
              } preview`,
              [
                  focusedPreviewChip.action,
                  ...(focusedPreviewChip.rewardHotText ? ['Cashout', focusedPreviewChip.rewardHotText] : []),
                  ...focusedPreviewChip.lines
              ]
          )
        : undefined;

    const boardChainOpportunityLabel = deps.formatLabel(
        'Board chain opportunity',
        [
            boardChainOpportunity.priorityLabel,
            boardChainOpportunity.nextActionLabel,
            boardChainOpportunity.nextActionDetail,
            boardChainOpportunity.cue,
            boardChainOpportunity.arcadeCallout
                ? `${boardChainOpportunity.arcadeCallout.label}: ${boardChainOpportunity.arcadeCallout.value}`
                : null,
            boardChainOpportunity.beatSignal
                ? `${boardChainOpportunity.beatSignal.label}: ${boardChainOpportunity.beatSignal.beatCount} beats: ${boardChainOpportunity.beatSignal.detail}`
                : null,
            boardChainOpportunity.nextTarget,
            boardChainOpportunity.armedPerkLabel,
            boardChainOpportunity.armedPerkPayoff,
            boardChainOpportunity.armedPerkDetail,
            boardChainOpportunity.targetPlanLabel,
            boardChainOpportunity.milestoneActionLabel && boardChainOpportunity.milestoneTargetLabel
                ? `${boardChainOpportunity.milestoneActionLabel}: ${boardChainOpportunity.milestoneTargetLabel}`
                : null,
            boardChainOpportunity.momentumLabel,
            boardChainOpportunity.chaseLabel,
            boardChainOpportunity.rewardUrgencyLabel,
            ...boardChainOpportunity.lines,
            boardChainOpportunity.rewardCue,
            ...boardChainOpportunity.examples
        ].filter((line): line is string => line != null)
    );

    const boardTraitModeCueLabel = boardTraitModeCue
        ? deps.formatLabel(boardTraitModeCue.label, [
              boardTraitModeCue.value,
              boardTraitModeCue.nextReward ? `Next reward: ${boardTraitModeCue.nextReward}` : null,
              boardTraitModeCue.detail
          ])
        : undefined;

    const routeGlyphCounts = parseCountAttribute(cardFeedbackRouteGlyphsAttr);
    const markerShapeCounts = parseCountAttribute(cardFeedbackMarkerShapesAttr);
    const boardChainMarkerKeyRows = TRAIT_MARKER_ROUTE_GLYPH_PRIORITY.flatMap((id) => {
        const count = routeGlyphCounts.get(id) ?? 0;
        if (count <= 0) {
            return [];
        }
        const cue = getTraitMarkerCueByRouteGlyph(id);
        return [
            {
                action: cue.action,
                count,
                glyph: cue.glyph,
                id,
                label: cue.label,
                shape: cue.shape
            }
        ];
    });
    const perkCount = markerShapeCounts.get('perk-armed-bar') ?? 0;
    if (perkCount > 0) {
        const cue = getTraitMarkerCueByShape('perk-armed-bar');
        boardChainMarkerKeyRows.push({
            action: cue.action,
            count: perkCount,
            glyph: cue.glyph,
            id: 'perk-armed-bar',
            label: cue.label,
            shape: cue.shape
        });
    }

    const markerIds = new Set(boardChainMarkerKeyRows.map((row) => row.shape));
    const preferred =
        chainMarkerIntensity?.id === 'stack' || chainMarkerIntensity?.id === 'cashout'
            ? ['payoff-stack', 'payoff-bar']
            : chainMarkerIntensity?.id === 'ready'
              ? ['followup-target', 'linked-route']
              : chainMarkerIntensity?.id === 'surge'
                ? ['combo-surge', 'linked-route']
                : chainMarkerIntensity?.id === 'setup'
                  ? ['swap-target-crossbar', 'linked-route']
                  : ['perk-armed-bar', 'linked-route'];
    const focusedChainMarkerShape =
        preferred.find((id) => markerIds.has(id as TraitMarkerShapeId)) ?? 'none';

    const boardChainMarkerKeyMeterFill = Math.round(
        Math.min(100, ((boardChainMarkerKeyRows.length + (chainMarkerIntensity ? 2 : 0)) / 6) * 100)
    );
    const boardChainMarkerKeySummaryAction =
        boardChainMarkerKeyRows.length > 0
            ? getBoardChainMarkerKeySummaryAction(focusedChainMarkerShape, chainMarkerIntensity?.id)
            : null;
    const boardChainMarkerKeySummaryTier =
        boardChainMarkerKeyRows.length > 0 ? getBoardChainMarkerKeySummaryTier(focusedChainMarkerShape, chainMarkerIntensity?.id) : null;
    const boardChainMarkerKeySummaryScreenCue = boardChainMarkerKeySummaryTier
        ? getBoardChainMarkerKeySummaryScreenCue(boardChainMarkerKeySummaryTier)
        : null;
    const boardChainMarkerKeySummaryBeatCount = Math.max(2, Math.min(5, boardChainMarkerKeyRows.length + 1)) as 2 | 3 | 4 | 5;

    const seenRecipes = new Set<string>();
    const boardChainRecipeRows = [...boardChainOpportunity.examples, ...traitOpportunityInteractionLines]
        .flatMap((line) => {
            const recipe = line.split(':')[0]?.trim() ?? '';
            if (!recipe.includes(' + ') || seenRecipes.has(recipe)) {
                return [];
            }

            seenRecipes.add(recipe);
            const laneId = getTraitInteractionLaneId(line);
            const roleId = getTraitInteractionLaneRoleId({ id: laneId }) ?? 'cashout';

            return [
                {
                    action: getTraitInteractionLaneAction(laneId),
                    label: TRAIT_INTERACTION_LANE_LABELS[laneId],
                    laneId,
                    recipe,
                    roleId,
                    sourceLine: line
                }
            ];
        })
        .slice(0, 3);
    const boardChainRecipeChips = boardChainRecipeRows.map((row) => row.recipe);

    const boardTraitInteractionLines = [...new Set([...boardChainOpportunity.examples, ...traitOpportunityInteractionLines])];
    const boardTraitInteractionLaneMap = buildTraitInteractionLaneMap(boardTraitInteractionLines);
    const boardTraitInteractionLaneMapAttrValue = traitInteractionLaneMapAttr(boardTraitInteractionLaneMap);
    const boardTraitInteractionLaneActionMapAttrValue = traitInteractionLaneActionMapAttr(boardTraitInteractionLaneMap);
    const boardTraitInteractionLaneRoleMapAttrValue = traitInteractionLaneRoleMapAttr(boardTraitInteractionLaneMap);
    const boardTraitInteractionLaneMapAccessibleLabel = formatTraitInteractionLaneMapLabel('Trait interaction lanes', boardTraitInteractionLaneMap);
    const primaryBoardTraitInteractionLane = boardTraitInteractionLaneMap[0] ?? null;
    const boardTraitInteractionLaneMapMeterFill = Math.round(Math.min(100, (boardTraitInteractionLaneMap.length / 5) * 100));

    return {
        boardChainAccessibilitySummary,
        boardChainMarkerKeyMeterFill,
        boardChainMarkerKeyRows,
        boardChainMarkerKeySummaryAction,
        boardChainMarkerKeySummaryBeatCount,
        boardChainMarkerKeySummaryScreenCue,
        boardChainMarkerKeySummaryTier,
        boardChainOpportunityLabel,
        boardChainOpportunityMeterFill,
        boardChainRecipeChips,
        boardChainRecipeRows,
        boardTraitInteractionLaneActionMapAttrValue,
        boardTraitInteractionLaneMap,
        boardTraitInteractionLaneMapAccessibleLabel,
        boardTraitInteractionLaneMapAttrValue,
        boardTraitInteractionLaneMapMeterFill,
        boardTraitInteractionLaneRoleMapAttrValue,
        boardTraitModeCueLabel,
        chainMarkerIntensity,
        focusedChainMarkerShape,
        focusedPreviewChip,
        focusedPreviewChipLabel,
        primaryBoardTraitInteractionLane
    };
};
