import type { BoardState, RunStatus, Tile } from '../../shared/contracts';
import {
    getSelectedTraitFollowupTileIds,
    getTraitComboSurgeTileIds,
    getTraitOpportunitySummary
} from '../../shared/trait-opportunities';
import {
    buildTraitInteractionLaneMap,
    getTraitInteractionLaneAction,
    TRAIT_INTERACTION_LANE_LABELS,
    type TraitInteractionLaneId
} from '../copy/traitInteractionLaneMap';
import { getTileFieldAmplification } from './tileFieldTilt';
import { isTilePickable } from './tileBoardPick';
import { isTileBoardFlipLocked } from './tileBoardFlipLock';
import { isTileBoardFaceUp } from './tileBoardFaceUp';
import {
    getTileBoardHiddenBackAccents,
    type TileBoardPowerBackAccent
} from './tileBoardHiddenBackAccents';
import { getTileTraitInteractionPreviewLines } from '../../shared/tile-trait-rules';
import { getTileBoardPairProximityDistance } from './tileBoardPairProximityState';
import { getTileBoardPresentationState } from './tileBoardPresentationState';
import { isMemorizeCurseHighlighted, isStickyFingerSlotMarked } from './tileBoardRowMarkers';
import { getTileBoardSpotlightState } from './tileBoardSpotlightState';
import {
    getTileBoardTutorialPairOrdinal,
    getTutorialPairOrdinalByKey
} from './tileBoardTutorialMarkers';
import { getResolvingSelectionState, type ResolvingSelectionState } from './tileResolvingSelection';
import { getTileTransform, type TileTransform } from './tileBoardTransform';
import {
    getTraitRouteCadenceAction,
    getTraitRouteReadabilityCadence,
    getTraitRouteReadabilityBeatTier,
    getTraitRouteReadabilityIntensity,
    getTraitRouteReadabilityTier,
    type TileTraitRouteReadabilityIntensity,
    type TileTraitRouteCadence,
    type TileTraitRouteBeatTier
} from './tileBoardReadability';

export type { TileBoardPowerBackAccent } from './tileBoardHiddenBackAccents';
export { getTutorialPairOrdinalByKey } from './tileBoardTutorialMarkers';

export interface TileBoardRow {
    destroyBlockedDecoyBack: boolean;
    faceUp: boolean;
    fieldAmp: number;
    focusDimmed: boolean;
    isPinned: boolean;
    memorizeCurseHighlight: boolean;
    nonPickableBack: boolean;
    pairProximityDistance: number | null;
    powerBackAccent: TileBoardPowerBackAccent | null;
    presentationNBackAnchor: boolean;
    presentationSilhouette: boolean;
    presentationWideRecall: boolean;
    resolvingSelection: ResolvingSelectionState;
    selectedTraitFollowupBack: boolean;
    shuffleBoardOrderIndex: number;
    spotlightBountyHighlight: boolean;
    spotlightBountyOnBack: boolean;
    spotlightWardHighlight: boolean;
    spotlightWardOnBack: boolean;
    stickyFingerSlotMark: boolean;
    tile: Tile;
    traitComboBack: boolean;
    traitComboSurgeBack: boolean;
    traitLaneAction: string | null;
    traitLaneBack: TraitInteractionLaneId | null;
    traitLaneLabel: string | null;
    traitRouteBeatTier: TileTraitRouteBeatTier | null;
    traitRouteReadabilityIntensity: TileTraitRouteReadabilityIntensity;
    traitRouteCadence: TileTraitRouteCadence;
    traitRouteCadenceAction: string | null;
    traitRewardHotBack: boolean;
    traitRouteTargetBack: boolean;
    traitInteractionPreviewLines: string[];
    transform: TileTransform;
    tutorialPairOrdinal: number | null;
}

export interface BuildTileBoardRowsInput {
    allowGambitThirdFlip: boolean;
    board: BoardState;
    bountyPairKey: string | null;
    clumpReadTileIds?: ReadonlySet<string>;
    compact: boolean;
    cursedPairKey: string | null;
    debugPeekActive: boolean;
    destroyEligibleTileIds: ReadonlySet<string>;
    destroyPowerVisualActive: boolean;
    dimmedTileIds?: ReadonlySet<string>;
    interactive: boolean;
    nBackAnchorPairKey: string | null;
    nBackMutatorActive: boolean;
    pairProximityHintsEnabled: boolean;
    peekEligibleTileIds: ReadonlySet<string>;
    peekPowerVisualActive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    pinModeBoardHintActive: boolean;
    pinnedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    reduceMotion: boolean;
    runStatus: RunStatus;
    shiftingSpotlightActive: boolean;
    showTutorialPairMarkers: boolean;
    silhouetteDuringPlay: boolean;
    strayEligibleTileIds: ReadonlySet<string>;
    strayPowerVisualActive: boolean;
    stickyBlockedTileId: string | null;
    tileSwapEligibleTileIds: ReadonlySet<string>;
    tileSwapFirstTileId: string | null;
    tileSwapPowerVisualActive: boolean;
    selectedTraitFollowupTileIds?: ReadonlySet<string>;
    traitRewardHotTileIds?: ReadonlySet<string>;
    traitRouteTargetTileIds?: ReadonlySet<string>;
    wardPairKey: string | null;
    wideRecallInPlay: boolean;
}

export const buildTileBoardRows = ({
    allowGambitThirdFlip,
    board,
    bountyPairKey,
    clumpReadTileIds,
    compact,
    cursedPairKey,
    debugPeekActive,
    destroyEligibleTileIds,
    destroyPowerVisualActive,
    dimmedTileIds,
    interactive,
    nBackAnchorPairKey,
    nBackMutatorActive,
    pairProximityHintsEnabled,
    peekEligibleTileIds,
    peekPowerVisualActive,
    peekRevealedTileIds,
    pinModeBoardHintActive,
    pinnedTileIds,
    previewActive,
    reduceMotion,
    runStatus,
    shiftingSpotlightActive,
    showTutorialPairMarkers,
    silhouetteDuringPlay,
    strayEligibleTileIds,
    strayPowerVisualActive,
    stickyBlockedTileId,
    tileSwapEligibleTileIds,
    tileSwapFirstTileId,
    tileSwapPowerVisualActive,
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = new Set(),
    traitRouteTargetTileIds = new Set(),
    wardPairKey,
    wideRecallInPlay
}: BuildTileBoardRowsInput): TileBoardRow[] => {
    const totalColumns = board.columns;
    const totalRows = board.rows;
    const flippedN = board.flippedTileIds.length;
    const flipLocked = isTileBoardFlipLocked({ allowGambitThirdFlip, flippedTileCount: flippedN });
    const tutorialPairOrdinalByKey = getTutorialPairOrdinalByKey(board, showTutorialPairMarkers);
    const traitOpportunityByTileId = new Map(
        getTraitOpportunitySummary(board).tiles.map((opportunity) => [opportunity.tileId, opportunity])
    );
    const traitComboSurgeTileIds = getTraitComboSurgeTileIds(board);
    const selectedTraitFollowupTileIdSet = selectedTraitFollowupTileIds ?? getSelectedTraitFollowupTileIds(board);

    return board.tiles.map((tile, index) => {
        const traitOpportunity = traitOpportunityByTileId.get(tile.id) ?? null;
        const faceUp = isTileBoardFaceUp({ debugPeekActive, peekRevealedTileIds, previewActive, tile });
        const memorizeCurseHighlight = isMemorizeCurseHighlighted({
            cursedPairKey,
            previewActive,
            tile
        });
        const {
            spotlightBountyHighlight,
            spotlightBountyOnBack,
            spotlightWardHighlight,
            spotlightWardOnBack
        } = getTileBoardSpotlightState({
            bountyPairKey,
            faceUp,
            shiftingSpotlightActive,
            tile,
            wardPairKey
        });
        const pairProximityDistance = getTileBoardPairProximityDistance({
            board,
            pairProximityHintsEnabled,
            runStatus,
            tile
        });
        const { presentationNBackAnchor, presentationSilhouette, presentationWideRecall } =
            getTileBoardPresentationState({
                faceUp,
                nBackAnchorPairKey,
                nBackMutatorActive,
                runStatus,
                silhouetteDuringPlay,
                tile,
                wideRecallInPlay
            });
        const tutorialPairOrdinal = getTileBoardTutorialPairOrdinal({
            faceUp,
            showTutorialPairMarkers,
            tile,
            tutorialPairOrdinalByKey
        });
        const stickyFingerSlotMark = isStickyFingerSlotMarked({
            faceUp,
            flippedTileCount: flippedN,
            stickyBlockedTileId,
            tile
        });
        const { destroyBlockedDecoyBack, nonPickableBack, powerBackAccent } = getTileBoardHiddenBackAccents({
            clumpReadTileIds,
            destroyEligibleTileIds,
            destroyPowerVisualActive,
            faceUp,
            flipLocked,
            interactive,
            peekEligibleTileIds,
            peekPowerVisualActive,
            pinModeBoardHintActive,
            strayEligibleTileIds,
            strayPowerVisualActive,
            tileSwapEligibleTileIds,
            tileSwapFirstTileId,
            tileSwapPowerVisualActive,
            tile
        });

        const traitInteractionPreviewLines = traitOpportunity?.previewLines ?? [];
        const traitLanePreviewLines = !faceUp ? getTileTraitInteractionPreviewLines(board, [tile.id], 'match') : [];
        const traitLaneBack = buildTraitInteractionLaneMap(traitLanePreviewLines)[0]?.id ?? null;
        const selectedTraitFollowupBack = selectedTraitFollowupTileIdSet.has(tile.id) && !faceUp;
        const traitComboBack = Boolean(traitOpportunity && !faceUp);
        const traitComboSurgeBack = traitComboSurgeTileIds.has(tile.id) && !faceUp;
        const traitRewardHotBack = traitRewardHotTileIds.has(tile.id) && !faceUp;
        const traitRouteTargetBack = traitRouteTargetTileIds.has(tile.id) && !faceUp;
        const traitRouteReadabilityTier = getTraitRouteReadabilityTier({
            isSelectedTraitFollowupBack: selectedTraitFollowupBack,
            isTraitComboBack: traitComboBack,
            isTraitComboSurgeBack: traitComboSurgeBack,
            isTraitPayoffStackBack: traitComboBack && traitRewardHotBack,
            isTraitRewardHotBack: traitRewardHotBack,
            isTraitRouteTargetBack: traitRouteTargetBack
        });
        const traitRouteReadabilityIntensity = getTraitRouteReadabilityIntensity(traitRouteReadabilityTier);
        const traitRouteBeatTier = getTraitRouteReadabilityBeatTier(traitRouteReadabilityTier);
        const traitRouteCadence = getTraitRouteReadabilityCadence(traitRouteReadabilityTier);

        return {
            destroyBlockedDecoyBack,
            faceUp,
            fieldAmp: getTileFieldAmplification(index, totalColumns, totalRows),
            focusDimmed: Boolean(dimmedTileIds?.has(tile.id)),
            isPinned: pinnedTileIds.has(tile.id),
            memorizeCurseHighlight,
            nonPickableBack,
            pairProximityDistance,
            powerBackAccent,
            presentationNBackAnchor,
            presentationSilhouette,
            presentationWideRecall,
            resolvingSelection: getResolvingSelectionState(board, runStatus, tile.id),
            selectedTraitFollowupBack,
            shuffleBoardOrderIndex: index,
            spotlightBountyHighlight,
            spotlightBountyOnBack,
            spotlightWardHighlight,
            spotlightWardOnBack,
            stickyFingerSlotMark,
            tile,
            traitComboBack,
            traitComboSurgeBack,
            traitLaneAction: traitLaneBack ? getTraitInteractionLaneAction(traitLaneBack) : null,
            traitLaneBack,
            traitLaneLabel: traitLaneBack ? TRAIT_INTERACTION_LANE_LABELS[traitLaneBack] : null,
            traitRouteBeatTier,
            traitRouteReadabilityIntensity,
            traitRouteCadence,
            traitRouteCadenceAction: traitRouteCadence === 'none' ? null : getTraitRouteCadenceAction(traitRouteCadence),
            traitRewardHotBack,
            traitRouteTargetBack,
            traitInteractionPreviewLines,
            transform: getTileTransform(tile, index, totalColumns, totalRows, compact, faceUp, reduceMotion),
            tutorialPairOrdinal
        };
    });
};

export const getTileBoardOverlayPrewarmDemandPairKeys = (
    rows: readonly TileBoardRow[],
    interactionSuppressed: boolean,
    interactive: boolean,
    flipLocked: boolean
): string[] => {
    const keys = new Set<string>();

    for (const row of rows) {
        const { tile, faceUp, resolvingSelection } = row;

        if (faceUp) {
            keys.add(tile.pairKey);
        }

        if (resolvingSelection != null) {
            keys.add(tile.pairKey);
        }

        const pickable = !interactionSuppressed && isTilePickable(tile, interactive, flipLocked);

        if (pickable) {
            keys.add(tile.pairKey);
        }
    }

    return [...keys];
};
