import type { MutableRefObject, RefObject } from 'react';
import type { BufferGeometry, Group, PlaneGeometry, ShaderMaterial } from 'three';
import type { BoardState, GraphicsQualityPreset } from '../../shared/contracts';
import type { TiltVector } from '../platformTilt/platformTiltTypes';
import type { CardBackSvgLayerGeometry } from './cardSvgPlaneGeometry';
import { TileBezel, type TileHoverTiltState } from './TileBezel';
import { TileBoardEnemyHazardMarker } from './TileBoardEnemyHazardMarker';
import { noopMeshRaycast } from './tileBoardPick';
import type { TileBoardEnemyHazardRow, TileBoardRow } from './tileBoardRows';
import type { TileBoardRuneFieldMetrics } from './tileBoardRuneField';

interface TileBoardSceneBoardGroupProps {
    board: BoardState;
    boardColumns: number;
    boardEntranceMotionBudgetMs: number;
    boardEntranceMotionDeadlineMs: number;
    boardEntranceStaggerTileCount: number;
    boardGroupRef: RefObject<Group | null>;
    boardRows: number;
    boardRuneFieldGeometry: PlaneGeometry;
    boardRuneFieldMaterial: ShaderMaterial;
    boardRuneFieldMatRef: RefObject<ShaderMaterial | null>;
    boardRuneFieldMetrics: TileBoardRuneFieldMetrics;
    enemyHazardRows: readonly TileBoardEnemyHazardRow[];
    fieldTiltRef: MutableRefObject<TiltVector>;
    flipLocked: boolean;
    focusedTileId: string | null;
    graphicsQuality: GraphicsQualityPreset;
    hostConsolidatesTileFrames: boolean;
    hoverTiltRef: MutableRefObject<TileHoverTiltState>;
    interactionSuppressed: boolean;
    interactive: boolean;
    onTilePick: (tileId: string) => void;
    reduceMotion: boolean;
    resolvingMatchWaveKey: string | null;
    sharedCardBackLayers: readonly CardBackSvgLayerGeometry[] | null;
    sharedCardFrontGeometry: BufferGeometry | null;
    shuffleMotionBudgetMs: number;
    shuffleMotionDeadlineMs: number;
    shuffleStaggerTileCount: number;
    textureRevision: number;
    tileBezelRows: readonly TileBoardRow[];
    tileFieldParallaxEnabled: boolean;
}

export const TileBoardSceneBoardGroup = ({
    board,
    boardColumns,
    boardEntranceMotionBudgetMs,
    boardEntranceMotionDeadlineMs,
    boardEntranceStaggerTileCount,
    boardGroupRef,
    boardRows,
    boardRuneFieldGeometry,
    boardRuneFieldMaterial,
    boardRuneFieldMatRef,
    boardRuneFieldMetrics,
    enemyHazardRows,
    fieldTiltRef,
    flipLocked,
    focusedTileId,
    graphicsQuality,
    hostConsolidatesTileFrames,
    hoverTiltRef,
    interactionSuppressed,
    interactive,
    onTilePick,
    reduceMotion,
    resolvingMatchWaveKey,
    sharedCardBackLayers,
    sharedCardFrontGeometry,
    shuffleMotionBudgetMs,
    shuffleMotionDeadlineMs,
    shuffleStaggerTileCount,
    textureRevision,
    tileBezelRows,
    tileFieldParallaxEnabled
}: TileBoardSceneBoardGroupProps) => (
    <group ref={boardGroupRef} rotation={[0, 0, 0]}>
        {graphicsQuality !== 'low' ? (
            <mesh
                geometry={boardRuneFieldGeometry}
                position={[boardRuneFieldMetrics.centerX, boardRuneFieldMetrics.centerY, -0.075]}
                raycast={noopMeshRaycast}
                renderOrder={-20}
            >
                <primitive ref={boardRuneFieldMatRef} object={boardRuneFieldMaterial} attach="material" />
            </mesh>
        ) : null}
        {tileBezelRows.map(
            ({
                destroyBlockedDecoyBack,
                enemyOccupiedBack,
                faceUp,
                fieldAmp,
                focusDimmed,
                hazardBackAccent,
                isPinned,
                memorizeCurseHighlight,
                nonPickableBack,
                objectiveBackAccent,
                pairProximityDistance,
                powerBackAccent,
                presentationNBackAnchor,
                presentationSilhouette,
                presentationWideRecall,
                resolvingSelection,
                routeBackAccent,
                shuffleBoardOrderIndex,
                spotlightBountyHighlight,
                spotlightBountyOnBack,
                spotlightWardHighlight,
                spotlightWardOnBack,
                stickyFingerSlotMark,
                tile,
                traitComboBack,
                traitRouteTargetBack,
                transform,
                tutorialPairOrdinal
            }) => (
                <TileBezel
                    key={tile.id}
                    destroyBlockedDecoyBack={destroyBlockedDecoyBack}
                    enemyOccupiedBack={enemyOccupiedBack}
                    faceUp={faceUp}
                    fieldAmp={fieldAmp}
                    fieldTiltRef={fieldTiltRef}
                    tileFieldParallaxEnabled={tileFieldParallaxEnabled}
                    flipLocked={flipLocked}
                    focusDimmed={focusDimmed}
                    hazardBackAccent={hazardBackAccent}
                    routeBackAccent={routeBackAccent}
                    objectiveBackAccent={objectiveBackAccent}
                    nonPickableBack={nonPickableBack}
                    stickyFingerSlotMark={stickyFingerSlotMark}
                    traitComboBack={traitComboBack}
                    traitRouteTargetBack={traitRouteTargetBack}
                    hostConsolidatesTileFrames={hostConsolidatesTileFrames}
                    hoverTiltRef={hoverTiltRef}
                    keyboardFocused={focusedTileId === tile.id}
                    pairProximityDistance={pairProximityDistance}
                    powerBackAccent={powerBackAccent}
                    tutorialPairOrdinal={tutorialPairOrdinal}
                    presentationNBackAnchor={presentationNBackAnchor}
                    presentationSilhouette={presentationSilhouette}
                    presentationWideRecall={presentationWideRecall}
                    spotlightBountyHighlight={spotlightBountyHighlight}
                    spotlightBountyOnBack={spotlightBountyOnBack}
                    spotlightWardHighlight={spotlightWardHighlight}
                    spotlightWardOnBack={spotlightWardOnBack}
                    interactionSuppressed={interactionSuppressed}
                    interactive={interactive}
                    isPinned={isPinned}
                    memorizeCurseHighlight={memorizeCurseHighlight}
                    onTilePick={onTilePick}
                    reduceMotion={reduceMotion}
                    resolvingMatchWaveKey={resolvingMatchWaveKey}
                    resolvingSelection={resolvingSelection}
                    shuffleBoardOrderIndex={shuffleBoardOrderIndex}
                    shuffleMotionBudgetMs={shuffleMotionBudgetMs}
                    shuffleMotionDeadlineMs={shuffleMotionDeadlineMs}
                    shuffleStaggerTileCount={shuffleStaggerTileCount}
                    boardEntranceMotionDeadlineMs={boardEntranceMotionDeadlineMs}
                    boardEntranceMotionBudgetMs={boardEntranceMotionBudgetMs}
                    boardEntranceStaggerTileCount={boardEntranceStaggerTileCount}
                    boardRows={boardRows}
                    boardColumns={boardColumns}
                    board={board}
                    sharedCardBackLayers={sharedCardBackLayers}
                    sharedCardFrontGeometry={sharedCardFrontGeometry}
                    textureRevision={textureRevision}
                    tile={tile}
                    transform={transform}
                    graphicsQuality={graphicsQuality}
                />
            )
        )}
        {enemyHazardRows.map(({ hazard, currentTransform, nextTransform }) => (
            <TileBoardEnemyHazardMarker
                key={hazard.id}
                currentTransform={currentTransform}
                graphicsQuality={graphicsQuality}
                hazard={hazard}
                nextTransform={nextTransform}
                reduceMotion={reduceMotion}
            />
        ))}
    </group>
);
