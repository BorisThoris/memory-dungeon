import type { BoardState, EnemyHazardState, HazardTileKind, RunStatus, Tile } from '../../shared/contracts';
import { getTileFieldAmplification } from './tileFieldTilt';
import { isTilePickable } from './tileBoardPick';
import { isTileBoardFlipLocked } from './tileBoardFlipLock';
import { isTileBoardFaceUp } from './tileBoardFaceUp';
import {
    getTileBoardHiddenBackAccents,
    type TileBoardPowerBackAccent
} from './tileBoardHiddenBackAccents';
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

export type { TileBoardPowerBackAccent } from './tileBoardHiddenBackAccents';
export { getTutorialPairOrdinalByKey } from './tileBoardTutorialMarkers';

export interface TileBoardRow {
    destroyBlockedDecoyBack: boolean;
    enemyOccupiedBack: boolean;
    faceUp: boolean;
    fieldAmp: number;
    focusDimmed: boolean;
    hazardBackAccent: HazardTileKind | null;
    isPinned: boolean;
    memorizeCurseHighlight: boolean;
    nonPickableBack: boolean;
    objectiveBackAccent: boolean;
    pairProximityDistance: number | null;
    powerBackAccent: TileBoardPowerBackAccent | null;
    presentationNBackAnchor: boolean;
    presentationSilhouette: boolean;
    presentationWideRecall: boolean;
    resolvingSelection: ResolvingSelectionState;
    routeBackAccent: boolean;
    shuffleBoardOrderIndex: number;
    spotlightBountyHighlight: boolean;
    spotlightBountyOnBack: boolean;
    spotlightWardHighlight: boolean;
    spotlightWardOnBack: boolean;
    stickyFingerSlotMark: boolean;
    tile: Tile;
    transform: TileTransform;
    tutorialPairOrdinal: number | null;
}

export interface TileBoardEnemyHazardRow {
    currentTransform: TileTransform;
    hazard: EnemyHazardState;
    nextTransform: TileTransform | null;
}

export interface BuildTileBoardRowsInput {
    allowGambitThirdFlip: boolean;
    board: BoardState;
    bountyPairKey: string | null;
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
    wardPairKey: string | null;
    wideRecallInPlay: boolean;
}

export const getEnemyOccupiedTileIds = (board: BoardState): Set<string> =>
    new Set(
        (board.enemyHazards ?? [])
            .filter((hazard) => hazard.state !== 'defeated')
            .map((hazard) => hazard.currentTileId)
    );

export const buildTileBoardRows = ({
    allowGambitThirdFlip,
    board,
    bountyPairKey,
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
    wardPairKey,
    wideRecallInPlay
}: BuildTileBoardRowsInput): TileBoardRow[] => {
    const totalColumns = board.columns;
    const totalRows = board.rows;
    const flippedN = board.flippedTileIds.length;
    const flipLocked = isTileBoardFlipLocked({ allowGambitThirdFlip, flippedTileCount: flippedN });
    const enemyOccupiedTileIds = getEnemyOccupiedTileIds(board);
    const tutorialPairOrdinalByKey = getTutorialPairOrdinalByKey(board, showTutorialPairMarkers);

    return board.tiles.map((tile, index) => {
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
        const {
            destroyBlockedDecoyBack,
            hazardBackAccent,
            nonPickableBack,
            objectiveBackAccent,
            powerBackAccent,
            routeBackAccent
        } = getTileBoardHiddenBackAccents({
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
            tile
        });

        return {
            destroyBlockedDecoyBack,
            enemyOccupiedBack: enemyOccupiedTileIds.has(tile.id),
            faceUp,
            fieldAmp: getTileFieldAmplification(index, totalColumns, totalRows),
            focusDimmed: Boolean(dimmedTileIds?.has(tile.id)),
            hazardBackAccent,
            isPinned: pinnedTileIds.has(tile.id),
            memorizeCurseHighlight,
            nonPickableBack,
            objectiveBackAccent,
            pairProximityDistance,
            powerBackAccent,
            presentationNBackAnchor,
            presentationSilhouette,
            presentationWideRecall,
            resolvingSelection: getResolvingSelectionState(board, runStatus, tile.id),
            routeBackAccent,
            shuffleBoardOrderIndex: index,
            spotlightBountyHighlight,
            spotlightBountyOnBack,
            spotlightWardHighlight,
            spotlightWardOnBack,
            stickyFingerSlotMark,
            tile,
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

export const buildTileBoardEnemyHazardRows = (
    board: BoardState,
    rows: readonly TileBoardRow[]
): TileBoardEnemyHazardRow[] => {
    const byTileId = new Map(rows.map((row) => [row.tile.id, row.transform]));

    return (board.enemyHazards ?? [])
        .filter((hazard) => hazard.state !== 'defeated')
        .map((hazard) => {
            const currentTransform = byTileId.get(hazard.currentTileId) ?? null;
            if (!currentTransform) {
                return null;
            }
            return {
                hazard,
                currentTransform,
                nextTransform: byTileId.get(hazard.nextTileId) ?? null
            };
        })
        .filter((row): row is TileBoardEnemyHazardRow => row != null);
};
