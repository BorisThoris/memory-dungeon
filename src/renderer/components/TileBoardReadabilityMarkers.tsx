import { CircleGeometry, DoubleSide, PlaneGeometry, type BufferGeometry } from 'three';
import type { BoardState, HazardTileKind, Tile } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { DUNGEON_BOARD_STAGE_LAYER_POLICY } from './tileBoardStageLayers';
import {
    getTileBoardReadabilityState,
    getTraitPreviewReadabilityBeatCount,
    getTraitPreviewReadabilityTone,
    getTraitRouteReadabilityBeatCount,
    getTraitRouteReadabilityGlyph,
    getTraitRouteReadabilityBeatTier
} from './tileBoardReadability';
import { hazardTileColor } from './tileBoardThreatColors';
import { getTileTraitInteractionPreviewLines, tileTraitColor } from '../../shared/tile-trait-rules';
import { tileTraitMark, traitMarkOffsets } from '../../shared/tile-trait-marks';
import type { TraitInteractionLaneId } from '../copy/traitInteractionLaneMap';

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;
const CARD_FACE_INSET = 0.016;
const CARD_FACE_HEIGHT = CARD_HEIGHT - CARD_FACE_INSET * 2;
const HOVER_GOLD_RIM_STRIP = 0.0036;

const BOARD_READABILITY_PIP_GEOMETRY = new CircleGeometry(0.043, 20);
/** Trait marks are smaller than a lane pip so three of them still fit across the 0.26 rail. */
const BOARD_READABILITY_TRAIT_MARK_PIP_GEOMETRY = new CircleGeometry(0.03, 16);
const BOARD_READABILITY_TRAIT_MARK_BAR_GEOMETRY = new PlaneGeometry(0.05, 0.022, 1, 1);
const TRAIT_MARK_SPACING = 0.075;
const BOARD_READABILITY_LARGE_PIP_GEOMETRY = new CircleGeometry(0.057, 22);
const BOARD_READABILITY_BAR_GEOMETRY = new PlaneGeometry(0.2, 0.032, 1, 1);
const BOARD_READABILITY_SHORT_BAR_GEOMETRY = new PlaneGeometry(0.13, 0.03, 1, 1);
const BOARD_READABILITY_BOSS_MARK_GEOMETRY = new PlaneGeometry(0.25, 0.064, 1, 1);
const BOARD_READABILITY_GLYPH_PLATE_GEOMETRY = new PlaneGeometry(0.19, 0.14, 1, 1);
const BOARD_READABILITY_SELECTED_RAIL_GEOMETRY = new PlaneGeometry(0.018, CARD_FACE_HEIGHT * 0.74, 1, 1);
const BOARD_READABILITY_DISABLED_SLASH_GEOMETRY = new PlaneGeometry(0.46, 0.024, 1, 1);
const BOARD_READABILITY_ENEMY_OCCUPIED_GEOMETRY = new PlaneGeometry(0.22, 0.06, 1, 1);
const BOARD_READABILITY_STATE_RAIL_GEOMETRY = new PlaneGeometry(0.26, 0.026, 1, 1);
const BOARD_READABILITY_STATE_NOTCH_GEOMETRY = new PlaneGeometry(0.04, 0.13, 1, 1);
const BOARD_READABILITY_TRAIT_COMBO_GEOMETRY = new PlaneGeometry(0.36, 0.045, 1, 1);
const BOARD_READABILITY_REWARD_HOT_GEOMETRY = new PlaneGeometry(0.19, 0.055, 1, 1);
const BOARD_READABILITY_PERK_ARMED_GEOMETRY = new PlaneGeometry(0.28, 0.04, 1, 1);
const BOARD_READABILITY_FOLLOWUP_GEOMETRY = new PlaneGeometry(0.24, 0.038, 1, 1);
const BOARD_READABILITY_ROUTE_GLYPH_PLATE_GEOMETRY = new PlaneGeometry(0.32, 0.2, 1, 1);
const BOARD_READABILITY_ROUTE_GLYPH_BAR_GEOMETRY = new PlaneGeometry(0.22, 0.026, 1, 1);
const BOARD_READABILITY_ROUTE_GLYPH_SHORT_BAR_GEOMETRY = new PlaneGeometry(0.12, 0.026, 1, 1);
const NON_PICKABLE_RAIL_GEOMETRY = new PlaneGeometry(CARD_WIDTH, HOVER_GOLD_RIM_STRIP, 1, 1);

interface TileBoardReadabilityMarkersProps {
    destroyBlockedDecoyBack: boolean;
    enemyOccupiedBack: boolean;
    faceUp: boolean;
    faceZ: number;
    findableCornerRingGeometry: BufferGeometry;
    hazardBackAccent: HazardTileKind | null;
    matchedEdgeGeometry: BufferGeometry;
    nonPickableBack: boolean;
    objectiveBackAccent: boolean;
    perkArmedBack: boolean;
    powerBackAccent: 'destroy' | 'peek' | 'stray' | 'pin' | 'swap' | 'swapOrigin' | 'clump' | null;
    routeBackAccent: boolean;
    selectedTraitFollowupBack: boolean;
    spotlightBountyOnBack: boolean;
    spotlightWardOnBack: boolean;
    stickyFingerSlotMark: boolean;
    tile: Tile;
    board?: BoardState;
    traitComboBack: boolean;
    traitComboSurgeBack: boolean;
    traitLaneBack: TraitInteractionLaneId | null;
    traitRewardHotBack: boolean;
    traitRouteTargetBack: boolean;
}

interface ReadabilityMaterialMeshProps {
    color: string;
    geometry: BufferGeometry;
    opacity: number;
    position?: [number, number, number];
    renderOrder: number;
    rotation?: [number, number, number];
    scale?: [number, number, number];
}

const ReadabilityMaterialMesh = ({
    color,
    geometry,
    opacity,
    position,
    renderOrder,
    rotation,
    scale
}: ReadabilityMaterialMeshProps) => (
    <mesh
        geometry={geometry}
        position={position}
        raycast={noopMeshRaycast}
        renderOrder={renderOrder}
        rotation={rotation}
        scale={scale}
    >
        <meshBasicMaterial
            color={color}
            depthTest
            depthWrite={false}
            opacity={opacity}
            side={DoubleSide}
            toneMapped={false}
            transparent
        />
    </mesh>
);

interface BeatPipRowProps {
    color: string;
    count: number;
    keyPrefix: string;
    opacity: number;
    positionY: number;
    renderOrder: number;
    supportColor?: string;
}

const BeatPipRow = ({
    color,
    count,
    keyPrefix,
    opacity,
    positionY,
    renderOrder,
    supportColor = '#fff7c4'
}: BeatPipRowProps) => (
    <>
        {Array.from({ length: count }, (_, index) => {
            const focus = index === 0 ? 'primary' : 'support';
            const pipColor = focus === 'primary' ? color : supportColor;
            const pipOpacity = focus === 'primary' ? opacity : Math.max(0.72, opacity - 0.12);
            const pipScale = focus === 'primary' ? 0.72 : 0.58;
            const x = (index - (count - 1) / 2) * 0.078;

            return (
                <ReadabilityMaterialMesh
                    color={pipColor}
                    geometry={BOARD_READABILITY_PIP_GEOMETRY}
                    key={`${keyPrefix}-${index}`}
                    opacity={pipOpacity}
                    position={[x, positionY, 0.0001 + index * 0.00001]}
                    renderOrder={renderOrder}
                    scale={[pipScale, pipScale, 1]}
                />
            );
        })}
    </>
);

interface SignalCapRowProps {
    color: string;
    count?: number;
    keyPrefix: string;
    opacity: number;
    positionY: number;
    renderOrder: number;
    supportColor?: string;
}

const SignalCapRow = ({
    color,
    count = 2,
    keyPrefix,
    opacity,
    positionY,
    renderOrder,
    supportColor = '#fff7c4'
}: SignalCapRowProps) => (
    <BeatPipRow
        color={color}
        count={count}
        keyPrefix={`${keyPrefix}-cap`}
        opacity={opacity}
        positionY={positionY}
        renderOrder={renderOrder}
        supportColor={supportColor}
    />
);

export const TileBoardReadabilityMarkers = ({
    destroyBlockedDecoyBack,
    enemyOccupiedBack,
    faceUp,
    faceZ,
    findableCornerRingGeometry,
    hazardBackAccent,
    matchedEdgeGeometry,
    nonPickableBack,
    objectiveBackAccent,
    perkArmedBack,
    powerBackAccent,
    routeBackAccent,
    selectedTraitFollowupBack,
    spotlightBountyOnBack,
    spotlightWardOnBack,
    stickyFingerSlotMark,
    board,
    tile,
    traitComboBack,
    traitComboSurgeBack,
    traitLaneBack,
    traitRewardHotBack,
    traitRouteTargetBack
}: TileBoardReadabilityMarkersProps) => {
    const {
        enemyOccupiedColor,
        faceReadabilityAccentColor,
        hiddenReadabilityAccentColor,
        isArmedTrap,
        isBossCard,
        isExitCard,
        isLeverCard,
        isLockCard,
        isPerkArmedBack,
        isRelicCard,
        isResolvedTrap,
        isShopCard,
        isSelectedCard,
        isSelectedTraitFollowupBack,
        isTraitComboBack,
        isTraitComboSurgeBack,
        isTraitPayoffStackBack,
        isTraitRewardHotBack,
        isTraitRouteTargetBack,
        isTrapCard,
        showFaceReadabilityMarker,
        showHiddenReadabilityMarkers,
        showHiddenReadabilityRing,
        traitRouteReadabilityIntensity,
        traitRouteReadabilityTier,
        traitLaneReadabilityColor,
        traitLaneReadabilityId,
        traitLaneReadabilityPattern,
        trapReadabilityColor
    } = getTileBoardReadabilityState({
        destroyBlockedDecoyBack,
        enemyOccupiedBack,
        faceUp,
        hazardBackAccent,
        nonPickableBack,
        objectiveBackAccent,
        perkArmedBack,
        powerBackAccent,
        routeBackAccent,
        selectedTraitFollowupBack,
        spotlightBountyOnBack,
        spotlightWardOnBack,
        stickyFingerSlotMark,
        traitComboBack,
        traitComboSurgeBack,
        traitLaneBack,
        traitRewardHotBack,
        traitRouteTargetBack,
        board,
        tile
    });
    const isTraitRoutePayoffLaneBack = traitRouteReadabilityTier === 'payoff-stack';
    const traitRouteBeatTier = getTraitRouteReadabilityBeatTier(traitRouteReadabilityTier);
    const traitRouteBeatCount = getTraitRouteReadabilityBeatCount(traitRouteBeatTier);
    const traitReadabilityScale =
        traitRouteReadabilityIntensity === 'stack'
            ? 1.14
            : traitRouteReadabilityIntensity === 'cashout'
              ? 1.08
              : traitRouteReadabilityIntensity === 'surge'
                ? 1.04
                : 1;
    const traitReadabilityOpacity =
        traitRouteReadabilityIntensity === 'stack'
            ? 1
            : traitRouteReadabilityIntensity === 'cashout'
              ? 0.98
              : traitRouteReadabilityIntensity === 'surge'
                ? 0.96
                : traitRouteReadabilityIntensity === 'ready'
                  ? 0.92
                  : 0.86;
    const traitRouteBeatColor =
        traitRouteBeatTier === 'cashout'
            ? '#ffe48a'
            : traitRouteBeatTier === 'surge'
              ? '#ffd166'
              : traitRouteBeatTier === 'follow-up'
                ? '#fff7c4'
                : traitRouteBeatTier === 'route'
                  ? '#f7f1c2'
                  : '#5dd6ff';
    const traitRouteGlyph = getTraitRouteReadabilityGlyph(traitRouteReadabilityTier);
    const traitRouteGlyphColor =
        traitRouteReadabilityIntensity === 'stack'
            ? '#fff7c4'
            : traitRouteReadabilityIntensity === 'cashout'
              ? '#ffe48a'
              : traitRouteReadabilityIntensity === 'surge'
                ? '#ffd166'
                : traitRouteReadabilityIntensity === 'ready'
                  ? '#f7f1c2'
                  : '#5dd6ff';
    const traitRouteGlyphAccentColor =
        traitLaneReadabilityColor ??
        (tile.tileTraitKind ? tileTraitColor(tile.tileTraitKind) : traitRouteGlyphColor);
    const traitRouteGlyphScale =
        traitRouteReadabilityIntensity === 'stack'
            ? 0.92
            : traitRouteReadabilityIntensity === 'cashout'
              ? 0.86
              : traitRouteReadabilityIntensity === 'surge'
                ? 0.8
                : 0.72;
    const faceUpTraitPreviewLines =
        faceUp && board && tile.tileTraitKind
            ? [
                  ...new Set([
                      ...getTileTraitInteractionPreviewLines(board, [tile.id], 'match'),
                      ...getTileTraitInteractionPreviewLines(board, [tile.id], 'mismatch')
                  ])
              ].slice(0, 3)
            : [];
    const hasFaceUpTraitPreview = faceUpTraitPreviewLines.length > 0;
    const faceUpTraitPreviewBeatCount = hasFaceUpTraitPreview
        ? getTraitPreviewReadabilityBeatCount(faceUpTraitPreviewLines.length)
        : 0;
    const faceUpTraitPreviewTone = hasFaceUpTraitPreview
        ? getTraitPreviewReadabilityTone(faceUpTraitPreviewLines.length)
        : 'ready';
    const traitMark = tile.tileTraitKind ? tileTraitMark(tile.tileTraitKind) : null;
    const faceUpTraitPreviewAccentColor =
        faceUpTraitPreviewTone === 'cashout'
            ? '#ffe48a'
            : faceUpTraitPreviewTone === 'surge'
              ? '#ffd166'
              : tile.tileTraitKind
                ? tileTraitColor(tile.tileTraitKind)
                : '#f7f1c2';

    return (
        <>
            {showHiddenReadabilityMarkers ? (
                <group position={[0, 0, -faceZ - 0.00033]} rotation={[0, Math.PI, 0]}>
                    {showHiddenReadabilityRing ? (
                        <>
                            <mesh
                                geometry={matchedEdgeGeometry}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveHalo.renderOrder - 1}
                                scale={[0.975, 0.975, 1]}
                            >
                                <meshBasicMaterial
                                    color="#050409"
                                    depthTest
                                    depthWrite={false}
                                    opacity={enemyOccupiedBack || isBossCard ? 0.78 : 0.56}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={matchedEdgeGeometry}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveHalo.renderOrder}
                                scale={[0.94, 0.94, 1]}
                            >
                                <meshBasicMaterial
                                    color={hiddenReadabilityAccentColor}
                                    depthTest
                                    depthWrite={false}
                                    opacity={enemyOccupiedBack ? 0.84 : isResolvedTrap ? 0.68 : nonPickableBack ? 0.5 : 0.74}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </>
                    ) : null}
                    {isTrapCard || isRelicCard ? (
                        <mesh
                            geometry={BOARD_READABILITY_GLYPH_PLATE_GEOMETRY}
                            position={[
                                isRelicCard ? CARD_WIDTH * 0.37 : -CARD_WIDTH * 0.37,
                                isRelicCard ? -CARD_HEIGHT * 0.4 : CARD_HEIGHT * 0.34,
                                0.0006
                            ]}
                            raycast={noopMeshRaycast}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder - 1}
                        >
                            <meshBasicMaterial
                                color="#07060b"
                                depthTest
                                depthWrite={false}
                                opacity={0.62}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {isTrapCard ? (
                        <group position={[-CARD_WIDTH * 0.37, CARD_HEIGHT * 0.32, 0.00061]}>
                            <mesh
                                geometry={BOARD_READABILITY_BAR_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                                rotation={[0, 0, Math.PI / 2]}
                            >
                                <meshBasicMaterial
                                    color={trapReadabilityColor}
                                    depthTest
                                    depthWrite={false}
                                    opacity={isResolvedTrap ? 0.72 : isArmedTrap ? 0.98 : 0.9}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                position={[0.048, 0, 0.00003]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                rotation={[0, 0, Math.PI / 2]}
                            >
                                <meshBasicMaterial
                                    color={isResolvedTrap ? '#d9ffe8' : '#1b0d10'}
                                    depthTest
                                    depthWrite={false}
                                    opacity={isResolvedTrap ? 0.82 : 0.72}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {isBossCard ? (
                        <group position={[0, CARD_HEIGHT * 0.41, 0.00062]}>
                            <mesh
                                geometry={BOARD_READABILITY_BOSS_MARK_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#09070d"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.76}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                position={[0, 0.002, 0.00004]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                            >
                                <meshBasicMaterial
                                    color="#ffcf66"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.96}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {isExitCard ? (
                        <group position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.38, 0.00063]}>
                            <ReadabilityMaterialMesh
                                color="#7bd88f"
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                opacity={0.96}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            />
                            <ReadabilityMaterialMesh
                                color="#d9ffe8"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.88}
                                position={[0.042, 0.025, 0.00004]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                rotation={[0, 0, Math.PI / 2]}
                            />
                        </group>
                    ) : null}
                    {isLockCard ? (
                        <group position={[-CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.38, 0.00064]}>
                            <ReadabilityMaterialMesh
                                color="#09070d"
                                geometry={BOARD_READABILITY_GLYPH_PLATE_GEOMETRY}
                                opacity={0.68}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            />
                            <ReadabilityMaterialMesh
                                color="#f2d39d"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.95}
                                position={[0, -0.02, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                            />
                            <ReadabilityMaterialMesh
                                color="#f2d39d"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.88}
                                position={[0, 0.032, 0.00006]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 2}
                            />
                        </group>
                    ) : null}
                    {isLeverCard ? (
                        <group position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.38, 0.00064]} rotation={[0, 0, -Math.PI / 7]}>
                            <ReadabilityMaterialMesh
                                color="#d4a03d"
                                geometry={BOARD_READABILITY_BAR_GEOMETRY}
                                opacity={0.94}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                                rotation={[0, 0, Math.PI / 2]}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffe1a3"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.9}
                                position={[0, 0.075, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                            />
                        </group>
                    ) : null}
                    {isShopCard ? (
                        <ReadabilityMaterialMesh
                            color="#5ee0c8"
                            geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                            opacity={0.96}
                            position={[CARD_WIDTH * 0.36, CARD_HEIGHT * 0.38, 0.00064]}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            rotation={[0, 0, Math.PI / 4]}
                        />
                    ) : null}
                    {enemyOccupiedBack ? (
                        <group position={[CARD_WIDTH * 0.36, CARD_HEIGHT * 0.37, 0.00064]}>
                            <mesh
                                geometry={BOARD_READABILITY_GLYPH_PLATE_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#07060b"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.72}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_ENEMY_OCCUPIED_GEOMETRY}
                                position={[0, 0, 0.00005]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                rotation={[0, 0, Math.PI / 4]}
                            >
                                <meshBasicMaterial
                                    color={enemyOccupiedColor}
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.98}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {isRelicCard ? (
                        <mesh
                            geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                            position={[CARD_WIDTH * 0.37, -CARD_HEIGHT * 0.4, 0.00063]}
                            raycast={noopMeshRaycast}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            rotation={[0, 0, Math.PI / 4]}
                        >
                            <meshBasicMaterial
                                color="#5ee0c8"
                                depthTest
                                depthWrite={false}
                                opacity={0.95}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {spotlightWardOnBack ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[-CARD_WIDTH * 0.36, CARD_HEIGHT * 0.4, 0.00052]}
                            raycast={noopMeshRaycast}
                            renderOrder={9}
                        >
                            <meshBasicMaterial
                                color="#ff7a6a"
                                depthTest
                                depthWrite={false}
                                opacity={0.88}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {spotlightBountyOnBack ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, 0.00052]}
                            raycast={noopMeshRaycast}
                            renderOrder={9}
                        >
                            <meshBasicMaterial
                                color="#5ee0c8"
                                depthTest
                                depthWrite={false}
                                opacity={0.88}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {destroyBlockedDecoyBack ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[0, CARD_HEIGHT * 0.38, 0.00053]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#9480a8"
                                depthTest
                                depthWrite={false}
                                opacity={0.82}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {powerBackAccent === 'destroy' ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[-CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, 0.00054]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#d94848"
                                depthTest
                                depthWrite={false}
                                opacity={0.92}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {powerBackAccent === 'peek' ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[CARD_WIDTH * 0.36, CARD_HEIGHT * 0.4, 0.00054]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#59b4d9"
                                depthTest
                                depthWrite={false}
                                opacity={0.9}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {powerBackAccent === 'stray' ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, 0.00054]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#d4a03d"
                                depthTest
                                depthWrite={false}
                                opacity={0.9}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {powerBackAccent === 'clump' ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[-CARD_WIDTH * 0.36, CARD_HEIGHT * 0.4, 0.00054]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#7de8b8"
                                depthTest
                                depthWrite={false}
                                opacity={0.9}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {powerBackAccent === 'pin' ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[0, -CARD_HEIGHT * 0.42, 0.00054]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#e8c878"
                                depthTest
                                depthWrite={false}
                                opacity={0.88}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {powerBackAccent === 'swap' ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[0, CARD_HEIGHT * 0.42, 0.00054]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#5dd6ff"
                                depthTest
                                depthWrite={false}
                                opacity={0.9}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {powerBackAccent === 'swapOrigin' ? (
                        <mesh
                            geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                            position={[0, CARD_HEIGHT * 0.42, 0.00055]}
                            raycast={noopMeshRaycast}
                            renderOrder={11}
                        >
                            <meshBasicMaterial
                                color="#f2f9ff"
                                depthTest
                                depthWrite={false}
                                opacity={0.96}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                    {hazardBackAccent ? (
                        <group position={[0, CARD_HEIGHT * 0.39, 0.00055]}>
                            <mesh
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveRing.renderOrder}
                            >
                                <meshBasicMaterial
                                    color={hazardTileColor(hazardBackAccent)}
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.96}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_STATE_NOTCH_GEOMETRY}
                                position={[0, -0.03, 0.00004]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#12080a"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.76}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {routeBackAccent ? (
                        <group position={[-CARD_WIDTH * 0.36, 0, 0.00057]}>
                            <mesh
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveRing.renderOrder}
                                rotation={[0, 0, Math.PI / 2]}
                            >
                                <meshBasicMaterial
                                    color="#59b4d9"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.9}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                                position={[0.045, 0, 0.00004]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                                rotation={[0, 0, Math.PI / 4]}
                            >
                                <meshBasicMaterial
                                    color="#d9f7ff"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.84}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {tile.tileTraitKind ? (
                        <group position={[0, -CARD_HEIGHT * 0.39, 0.00057]}>
                            <mesh
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveRing.renderOrder}
                            >
                                <meshBasicMaterial
                                    color={tileTraitColor(tile.tileTraitKind)}
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.92}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            {/*
                              * The trait's mark. Every trait used to draw this same rotated pip, so
                              * hue was the only thing separating nine rules — and on a hidden tile
                              * in a memory game a shape is the more memorable of the two anyway.
                              * Shape and count come from `tile-trait-marks`; the Codex lists them.
                              */}
                            {traitMarkOffsets(traitMark?.count ?? 1, TRAIT_MARK_SPACING).map((offsetX, index) => (
                                <mesh
                                    geometry={
                                        traitMark?.shape === 'bar'
                                            ? BOARD_READABILITY_TRAIT_MARK_BAR_GEOMETRY
                                            : BOARD_READABILITY_TRAIT_MARK_PIP_GEOMETRY
                                    }
                                    key={`trait-mark-${index}`}
                                    position={[offsetX, 0.034, 0.00004]}
                                    raycast={noopMeshRaycast}
                                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                                    rotation={[0, 0, traitMark?.shape === 'diamond' ? Math.PI / 4 : 0]}
                                >
                                    <meshBasicMaterial
                                        color="#100d14"
                                        depthTest
                                        depthWrite={false}
                                        opacity={0.78}
                                        side={DoubleSide}
                                        toneMapped={false}
                                        transparent
                                    />
                                </mesh>
                            ))}
                        </group>
                    ) : null}
                    {traitLaneReadabilityColor && traitLaneReadabilityId ? (
                        <group
                            position={[0, CARD_HEIGHT * 0.39, 0.00067]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#07060b"
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                opacity={0.62}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                scale={[1.05, 1.12, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color={traitLaneReadabilityColor}
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                opacity={Math.max(0.88, traitReadabilityOpacity)}
                                position={[0, 0.001, 0.00004]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 2}
                                scale={[0.82, 0.72, 1]}
                            />
                            {traitLaneReadabilityPattern === 'cash-pip' ||
                            traitLaneReadabilityPattern === 'score-pip' ||
                            traitLaneReadabilityPattern === 'guard-ward' ||
                            traitLaneReadabilityPattern === 'recall-pair' ? (
                                <ReadabilityMaterialMesh
                                    color={traitLaneReadabilityColor}
                                    geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                    opacity={traitRouteReadabilityIntensity === 'stack' ? 1 : 0.9}
                                    position={[
                                        traitLaneReadabilityPattern === 'recall-pair' ? -0.08 : -0.14,
                                        0.001,
                                        0.00006
                                    ]}
                                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 3}
                                    scale={
                                        traitLaneReadabilityPattern === 'cash-pip' ||
                                        traitLaneReadabilityPattern === 'guard-ward'
                                            ? [0.86, 0.86, 1]
                                            : [0.68, 0.68, 1]
                                    }
                                />
                            ) : null}
                            {traitLaneReadabilityPattern === 'recall-pair' ? (
                                <ReadabilityMaterialMesh
                                    color={traitLaneReadabilityColor}
                                    geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                    opacity={0.9}
                                    position={[0.08, 0.001, 0.00006]}
                                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 3}
                                    scale={[0.68, 0.68, 1]}
                                />
                            ) : null}
                            {traitLaneReadabilityPattern === 'guard-ward' ? (
                                <ReadabilityMaterialMesh
                                    color="#d9ffe8"
                                    geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                    opacity={0.86}
                                    position={[0.08, 0.001, 0.00007]}
                                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                                    scale={[0.72, 0.68, 1]}
                                />
                            ) : null}
                            {traitLaneReadabilityPattern === 'tool-cross' ? (
                                <>
                                    <ReadabilityMaterialMesh
                                        color={traitLaneReadabilityColor}
                                        geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                        opacity={0.9}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 3}
                                        scale={[0.72, 0.76, 1]}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitLaneReadabilityColor}
                                        geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                        opacity={0.86}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                                        rotation={[0, 0, Math.PI / 2]}
                                        scale={[0.48, 0.76, 1]}
                                    />
                                </>
                            ) : null}
                            {traitLaneReadabilityPattern === 'risk-slash' ? (
                                <ReadabilityMaterialMesh
                                    color={traitLaneReadabilityColor}
                                    geometry={BOARD_READABILITY_BAR_GEOMETRY}
                                    opacity={0.92}
                                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 3}
                                    rotation={[0, 0, Math.PI / 6]}
                                    scale={[0.84, 0.72, 1]}
                                />
                            ) : null}
                            {traitLaneReadabilityPattern === 'block-bars' ? (
                                <>
                                    <ReadabilityMaterialMesh
                                        color={traitLaneReadabilityColor}
                                        geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                        opacity={0.9}
                                        position={[-0.05, 0.014, 0.00006]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 3}
                                        scale={[0.64, 0.74, 1]}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitLaneReadabilityColor}
                                        geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                        opacity={0.86}
                                        position={[0.05, -0.014, 0.00007]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                                        scale={[0.64, 0.74, 1]}
                                    />
                                </>
                            ) : null}
                        </group>
                    ) : null}
                    {traitRouteGlyph !== 'none' ? (
                        <group
                            position={[0, CARD_HEIGHT * 0.06, 0.00082]}
                            scale={[
                                traitReadabilityScale * traitRouteGlyphScale,
                                traitReadabilityScale * traitRouteGlyphScale,
                                1
                            ]}
                        >
                            <ReadabilityMaterialMesh
                                color="#07060b"
                                geometry={BOARD_READABILITY_ROUTE_GLYPH_PLATE_GEOMETRY}
                                opacity={Math.max(0.42, traitReadabilityOpacity - 0.38)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 6}
                                scale={[
                                    traitRouteGlyph === 'payoff-stack' ? 1.04 : 0.94,
                                    traitRouteGlyph === 'payoff-stack' ? 1.06 : 0.96,
                                    1
                                ]}
                            />
                            {traitRouteGlyph === 'prime-cross' ? (
                                <>
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphColor}
                                        geometry={BOARD_READABILITY_ROUTE_GLYPH_BAR_GEOMETRY}
                                        opacity={Math.max(0.9, traitReadabilityOpacity)}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphColor}
                                        geometry={BOARD_READABILITY_ROUTE_GLYPH_BAR_GEOMETRY}
                                        opacity={Math.max(0.88, traitReadabilityOpacity - 0.04)}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 10}
                                        rotation={[0, 0, Math.PI / 2]}
                                        scale={[0.62, 0.86, 1]}
                                    />
                                </>
                            ) : null}
                            {traitRouteGlyph === 'linked-route' ? (
                                <>
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphColor}
                                        geometry={BOARD_READABILITY_ROUTE_GLYPH_BAR_GEOMETRY}
                                        opacity={Math.max(0.88, traitReadabilityOpacity)}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9}
                                        scale={[0.86, 0.82, 1]}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphAccentColor}
                                        geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                                        opacity={0.96}
                                        position={[-0.105, 0.001, 0.00007]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 10}
                                        scale={[0.82, 0.82, 1]}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphAccentColor}
                                        geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                                        opacity={0.96}
                                        position={[0.105, 0.001, 0.00007]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 10}
                                        scale={[0.82, 0.82, 1]}
                                    />
                                </>
                            ) : null}
                            {traitRouteGlyph === 'next-tap' ? (
                                <>
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphColor}
                                        geometry={BOARD_READABILITY_ROUTE_GLYPH_BAR_GEOMETRY}
                                        opacity={Math.max(0.88, traitReadabilityOpacity)}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9}
                                        rotation={[0, 0, Math.PI / 2]}
                                        scale={[0.84, 0.82, 1]}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphAccentColor}
                                        geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                                        opacity={0.98}
                                        position={[0, 0.105, 0.00008]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 10}
                                        scale={[0.76, 0.76, 1]}
                                    />
                                </>
                            ) : null}
                            {traitRouteGlyph === 'surge-burst' ? (
                                <>
                                    {[-Math.PI / 4, 0, Math.PI / 4].map((rotation, index) => (
                                        <ReadabilityMaterialMesh
                                            color={index === 1 ? traitRouteGlyphAccentColor : traitRouteGlyphColor}
                                            geometry={BOARD_READABILITY_ROUTE_GLYPH_BAR_GEOMETRY}
                                            key={rotation}
                                            opacity={Math.max(0.88, traitReadabilityOpacity - index * 0.03)}
                                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9 + index}
                                            rotation={[0, 0, rotation]}
                                            scale={[0.82, 0.78, 1]}
                                        />
                                    ))}
                                    <ReadabilityMaterialMesh
                                        color="#fff7c4"
                                        geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                                        opacity={0.94}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 13}
                                        scale={[0.58, 0.58, 1]}
                                    />
                                </>
                            ) : null}
                            {traitRouteGlyph === 'cashout-crown' || traitRouteGlyph === 'payoff-stack' ? (
                                <>
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphColor}
                                        geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                                        opacity={0.98}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 11}
                                        scale={[traitRouteGlyph === 'payoff-stack' ? 0.95 : 0.82, traitRouteGlyph === 'payoff-stack' ? 0.95 : 0.82, 1]}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphAccentColor}
                                        geometry={BOARD_READABILITY_ROUTE_GLYPH_SHORT_BAR_GEOMETRY}
                                        opacity={0.94}
                                        position={[-0.065, 0.09, 0.00008]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 12}
                                        rotation={[0, 0, Math.PI / 5]}
                                    />
                                    <ReadabilityMaterialMesh
                                        color={traitRouteGlyphAccentColor}
                                        geometry={BOARD_READABILITY_ROUTE_GLYPH_SHORT_BAR_GEOMETRY}
                                        opacity={0.94}
                                        position={[0.065, 0.09, 0.00009]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 12}
                                        rotation={[0, 0, -Math.PI / 5]}
                                    />
                                    {traitRouteGlyph === 'payoff-stack' ? (
                                        <ReadabilityMaterialMesh
                                            color="#5ee0c8"
                                            geometry={BOARD_READABILITY_ROUTE_GLYPH_BAR_GEOMETRY}
                                            opacity={0.92}
                                            position={[0, -0.09, 0.0001]}
                                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 13}
                                            scale={[0.74, 0.78, 1]}
                                        />
                                    ) : null}
                                </>
                            ) : null}
                        </group>
                    ) : null}
                    {traitRouteBeatCount > 0 ? (
                        <group
                            position={[0, -CARD_HEIGHT * 0.19, 0.00083]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            {Array.from({ length: traitRouteBeatCount }, (_, beatIndex) => {
                                const x = (beatIndex - (traitRouteBeatCount - 1) / 2) * 0.062;
                                return (
                                    <ReadabilityMaterialMesh
                                        color={traitRouteBeatColor}
                                        geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                        key={beatIndex}
                                        opacity={Math.max(0.82, traitReadabilityOpacity)}
                                        position={[x, 0, 0.00007 + beatIndex * 0.00001]}
                                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                        scale={[
                                            traitRouteBeatTier === 'cashout' ? 0.56 : 0.48,
                                            traitRouteBeatTier === 'cashout' ? 0.56 : 0.48,
                                            1
                                        ]}
                                    />
                                );
                            })}
                        </group>
                    ) : null}
                    {isTraitComboBack ? (
                        <group
                            position={[0, -CARD_HEIGHT * 0.305, 0.00061]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#f7f1c2"
                                geometry={BOARD_READABILITY_TRAIT_COMBO_GEOMETRY}
                                opacity={Math.max(0.9, traitReadabilityOpacity)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 2}
                            />
                            <ReadabilityMaterialMesh
                                color={tile.tileTraitKind ? tileTraitColor(tile.tileTraitKind) : '#5ee0c8'}
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={Math.max(0.92, traitReadabilityOpacity)}
                                position={[0, 0.001, 0.00004]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 3}
                            />
                            <ReadabilityMaterialMesh
                                color="#f7f1c2"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.94}
                                position={[-0.135, 0.001, 0.00006]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                            />
                            <ReadabilityMaterialMesh
                                color="#f7f1c2"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.94}
                                position={[0.135, 0.001, 0.00006]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                            />
                        </group>
                    ) : null}
                    {isTraitRewardHotBack ? (
                        <group
                            position={[CARD_WIDTH * 0.31, -CARD_HEIGHT * 0.305, 0.00067]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#3b2605"
                                geometry={BOARD_READABILITY_REWARD_HOT_GEOMETRY}
                                opacity={Math.max(0.88, traitReadabilityOpacity - 0.08)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 5}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffe48a"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={Math.max(0.94, traitReadabilityOpacity)}
                                position={[0, 0.001, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 6}
                                scale={[0.74, 1, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#fff7c4"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.98}
                                position={[-0.086, 0.001, 0.00007]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 7}
                                scale={[0.72, 0.72, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#fff7c4"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.98}
                                position={[0.086, 0.001, 0.00007]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 7}
                                scale={[0.72, 0.72, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#fff7c4"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.9}
                                position={[0, 0.035, 0.00008]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                rotation={[0, 0, Math.PI / 2]}
                                scale={[0.62, 0.86, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffe48a"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.88}
                                position={[0, 0.058, 0.00009]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                scale={[0.54, 0.72, 1]}
                            />
                            <SignalCapRow
                                color="#fff7c4"
                                count={2}
                                keyPrefix={`trait-reward-hot-${tile.id}`}
                                opacity={0.9}
                                positionY={0.05}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 10}
                                supportColor="#ffe48a"
                            />
                            <BeatPipRow
                                color="#ffe48a"
                                count={4}
                                keyPrefix={`trait-reward-hot-${tile.id}`}
                                opacity={0.96}
                                positionY={-0.046}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9}
                                supportColor="#fff7c4"
                            />
                        </group>
                    ) : null}
                    {isTraitComboSurgeBack ? (
                        <group
                            position={[-CARD_WIDTH * 0.31, -CARD_HEIGHT * 0.305, 0.00069]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#3b2605"
                                geometry={BOARD_READABILITY_REWARD_HOT_GEOMETRY}
                                opacity={Math.max(0.82, traitReadabilityOpacity - 0.1)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 5}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffd166"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.96}
                                position={[0, 0.001, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 6}
                                scale={[0.78, 1, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#5ee0c8"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.94}
                                position={[-0.086, 0.001, 0.00007]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 7}
                                scale={[0.66, 0.66, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#fff7c4"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.96}
                                position={[0.086, 0.001, 0.00007]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 7}
                                scale={[0.66, 0.66, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffd166"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.88}
                                position={[0, 0.058, 0.00008]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                scale={[0.54, 0.72, 1]}
                            />
                            <SignalCapRow
                                color="#5ee0c8"
                                count={2}
                                keyPrefix={`trait-combo-surge-${tile.id}`}
                                opacity={0.88}
                                positionY={0.05}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9}
                                supportColor="#fff7c4"
                            />
                            <BeatPipRow
                                color="#ffd166"
                                count={4}
                                keyPrefix={`trait-combo-surge-${tile.id}`}
                                opacity={0.92}
                                positionY={-0.046}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                supportColor="#fff7c4"
                            />
                        </group>
                    ) : null}
                    {isPerkArmedBack ? (
                        <group
                            position={[0, CARD_HEIGHT * 0.305, 0.0007]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#3b2605"
                                geometry={BOARD_READABILITY_PERK_ARMED_GEOMETRY}
                                opacity={Math.max(0.82, traitReadabilityOpacity - 0.08)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 6}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffe48a"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.96}
                                position={[0, 0.001, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 7}
                                scale={[0.72, 1, 1]}
                            />
                            <BeatPipRow
                                color="#ffe48a"
                                count={2}
                                keyPrefix={`trait-perk-${tile.id}`}
                                opacity={0.94}
                                positionY={-0.046}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                supportColor="#8de6ff"
                            />
                        </group>
                    ) : null}
                    {isSelectedTraitFollowupBack ? (
                        <group
                            position={[CARD_WIDTH * 0.31, CARD_HEIGHT * 0.305, 0.00071]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#120c04"
                                geometry={BOARD_READABILITY_FOLLOWUP_GEOMETRY}
                                opacity={Math.max(0.84, traitReadabilityOpacity - 0.08)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 6}
                                rotation={[0, 0, Math.PI / 2]}
                            />
                            <ReadabilityMaterialMesh
                                color="#fff7c4"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.98}
                                position={[0, 0.001, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 7}
                                rotation={[0, 0, Math.PI / 2]}
                                scale={[0.72, 1, 1]}
                            />
                            <SignalCapRow
                                color="#fff7c4"
                                count={2}
                                keyPrefix={`trait-followup-${tile.id}`}
                                opacity={0.88}
                                positionY={0.05}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                supportColor="#8de6ff"
                            />
                            <BeatPipRow
                                color="#fff7c4"
                                count={3}
                                keyPrefix={`trait-followup-${tile.id}`}
                                opacity={0.96}
                                positionY={-0.046}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                supportColor="#8de6ff"
                            />
                        </group>
                    ) : null}
                    {isTraitRoutePayoffLaneBack ? (
                        <group
                            position={[0, -CARD_HEIGHT * 0.305, 0.00072]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#120c04"
                                geometry={BOARD_READABILITY_TRAIT_COMBO_GEOMETRY}
                                opacity={Math.max(0.82, traitReadabilityOpacity - 0.08)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                scale={[1.08, 1.16, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffe48a"
                                geometry={BOARD_READABILITY_BAR_GEOMETRY}
                                opacity={0.94}
                                position={[-0.075, 0.001, 0.00004]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9}
                                rotation={[0, 0, Math.PI / 2]}
                                scale={[0.72, 0.78, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#5ee0c8"
                                geometry={BOARD_READABILITY_BAR_GEOMETRY}
                                opacity={0.9}
                                position={[0.075, 0.001, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 9}
                                rotation={[0, 0, Math.PI / 2]}
                                scale={[0.72, 0.78, 1]}
                            />
                            <SignalCapRow
                                color="#ffe48a"
                                count={3}
                                keyPrefix={`trait-payoff-stack-${tile.id}`}
                                opacity={0.9}
                                positionY={0.052}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 11}
                                supportColor="#fff7c4"
                            />
                            <BeatPipRow
                                color="#ffe48a"
                                count={3}
                                keyPrefix={`trait-route-${tile.id}`}
                                opacity={0.9}
                                positionY={-0.048}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 10}
                                supportColor="#5ee0c8"
                            />
                        </group>
                    ) : null}
                    {isTraitPayoffStackBack ? (
                        <group
                            position={[0, -CARD_HEIGHT * 0.305, 0.00076]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#332409"
                                geometry={BOARD_READABILITY_TRAIT_COMBO_GEOMETRY}
                                opacity={Math.max(0.74, traitReadabilityOpacity - 0.16)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 8}
                                scale={[1.18, 1.28, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#fff7c4"
                                geometry={BOARD_READABILITY_BAR_GEOMETRY}
                                opacity={Math.max(0.96, traitReadabilityOpacity)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 10}
                                scale={[0.72, 0.9, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffe48a"
                                geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                                opacity={0.98}
                                position={[0, 0.001, 0.00006]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 11}
                                scale={[0.72, 0.72, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#5ee0c8"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.96}
                                position={[-0.055, 0.04, 0.00008]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 12}
                                rotation={[0, 0, Math.PI / 4]}
                                scale={[0.7, 0.86, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#5ee0c8"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.96}
                                position={[0.055, 0.04, 0.00009]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 12}
                                rotation={[0, 0, -Math.PI / 4]}
                                scale={[0.7, 0.86, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#ffe48a"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.9}
                                position={[0, 0.088, 0.0001]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 12}
                                scale={[0.5, 0.72, 1]}
                            />
                            <SignalCapRow
                                color="#ffe48a"
                                count={3}
                                keyPrefix={`trait-payoff-stack-${tile.id}`}
                                opacity={0.9}
                                positionY={0.05}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 13}
                                supportColor="#fff7c4"
                            />
                            <BeatPipRow
                                color="#ffe48a"
                                count={5}
                                keyPrefix={`trait-payoff-${tile.id}`}
                                opacity={0.98}
                                positionY={-0.047}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 13}
                                supportColor="#5ee0c8"
                            />
                            <ReadabilityMaterialMesh
                                color="#fff7c4"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.92}
                                position={[0, -0.089, 0.0001]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 14}
                                scale={[0.54, 0.72, 1]}
                            />
                        </group>
                    ) : null}
                    {isTraitRouteTargetBack ? (
                        <group
                            position={[0, CARD_HEIGHT * 0.305, 0.00062]}
                            scale={[traitReadabilityScale, traitReadabilityScale, 1]}
                        >
                            <ReadabilityMaterialMesh
                                color="#142733"
                                geometry={BOARD_READABILITY_TRAIT_COMBO_GEOMETRY}
                                opacity={Math.max(0.86, traitReadabilityOpacity)}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 2}
                            />
                            <ReadabilityMaterialMesh
                                color="#5dd6ff"
                                geometry={BOARD_READABILITY_BAR_GEOMETRY}
                                opacity={0.94}
                                position={[0, 0.001, 0.00004]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 3}
                            />
                            <ReadabilityMaterialMesh
                                color="#d9f7ff"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.88}
                                position={[0, 0.058, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                                scale={[0.54, 0.72, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color="#d9f7ff"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.9}
                                position={[-0.074, 0.035, 0.00006]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                                rotation={[0, 0, Math.PI / 2.8]}
                            />
                            <ReadabilityMaterialMesh
                                color="#d9f7ff"
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={0.9}
                                position={[0.074, 0.035, 0.00006]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 4}
                                rotation={[0, 0, -Math.PI / 2.8]}
                            />
                            <SignalCapRow
                                color="#5dd6ff"
                                count={2}
                                keyPrefix={`trait-route-target-${tile.id}`}
                                opacity={0.9}
                                positionY={0.05}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 5}
                                supportColor="#ffe48a"
                            />
                            <BeatPipRow
                                color="#5dd6ff"
                                count={2}
                                keyPrefix={`trait-route-target-${tile.id}`}
                                opacity={0.94}
                                positionY={-0.046}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 5}
                                supportColor="#ffe48a"
                            />
                        </group>
                    ) : null}
                    {objectiveBackAccent ? (
                        <group position={[CARD_WIDTH * 0.36, 0, 0.00058]}>
                            <mesh
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveRing.renderOrder}
                                rotation={[0, 0, Math.PI / 2]}
                            >
                                <meshBasicMaterial
                                    color="#f2d39d"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.92}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                position={[-0.045, 0, 0.00004]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#171008"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.78}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {nonPickableBack ? (
                        <group>
                            <mesh
                                geometry={NON_PICKABLE_RAIL_GEOMETRY}
                                position={[0, -CARD_HEIGHT * 0.5 + HOVER_GOLD_RIM_STRIP * 1.15, 0.00059]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.passiveHover.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#b6a4bd"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.48}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_DISABLED_SLASH_GEOMETRY}
                                position={[0, 0, 0.0006]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.passiveHover.renderOrder + 1}
                                rotation={[0, 0, -Math.PI / 4]}
                            >
                                <meshBasicMaterial
                                    color="#d6cce0"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.62}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {stickyFingerSlotMark && tile.state === 'hidden' ? (
                        <mesh
                            geometry={findableCornerRingGeometry}
                            position={[CARD_WIDTH * 0.34, CARD_HEIGHT * 0.39, 0.00056]}
                            raycast={noopMeshRaycast}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                color="#c65a28"
                                depthTest
                                depthWrite={false}
                                opacity={0.88}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                </group>
            ) : null}
            {isSelectedCard ? (
                <group position={[0, 0, faceZ + 0.00047]}>
                    <ReadabilityMaterialMesh
                        color="#f2d39d"
                        geometry={BOARD_READABILITY_SELECTED_RAIL_GEOMETRY}
                        opacity={0.92}
                        position={[-CARD_WIDTH * 0.45, 0, 0.0007]}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                    />
                    <ReadabilityMaterialMesh
                        color="#59b4d9"
                        geometry={BOARD_READABILITY_SELECTED_RAIL_GEOMETRY}
                        opacity={0.86}
                        position={[CARD_WIDTH * 0.45, 0, 0.0007]}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                    />
                </group>
            ) : null}
            {showFaceReadabilityMarker ? (
                <group position={[0, 0, faceZ + 0.0005]}>
                    <ReadabilityMaterialMesh
                        color={faceReadabilityAccentColor}
                        geometry={matchedEdgeGeometry}
                        opacity={isResolvedTrap ? 0.46 : isBossCard ? 0.7 : 0.62}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveRing.renderOrder}
                        scale={[0.93, 0.93, 1]}
                    />
                    <ReadabilityMaterialMesh
                        color={faceReadabilityAccentColor}
                        geometry={BOARD_READABILITY_PIP_GEOMETRY}
                        opacity={isResolvedTrap ? 0.78 : 0.96}
                        position={[CARD_WIDTH * 0.35, CARD_HEIGHT * 0.39, 0.00072]}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                    />
                    {hasFaceUpTraitPreview && tile.tileTraitKind ? (
                        <group position={[-CARD_WIDTH * 0.24, CARD_HEIGHT * 0.39, 0.00074]}>
                            <ReadabilityMaterialMesh
                                color={faceUpTraitPreviewAccentColor}
                                geometry={BOARD_READABILITY_TRAIT_COMBO_GEOMETRY}
                                opacity={faceUpTraitPreviewTone === 'cashout' ? 0.98 : faceUpTraitPreviewTone === 'surge' ? 0.92 : 0.86}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                                scale={
                                    faceUpTraitPreviewTone === 'cashout'
                                        ? [0.86, 0.94, 1]
                                        : faceUpTraitPreviewTone === 'surge'
                                          ? [0.8, 0.88, 1]
                                          : [0.72, 0.82, 1]
                                }
                            />
                            <ReadabilityMaterialMesh
                                color={faceUpTraitPreviewAccentColor}
                                geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                                opacity={faceUpTraitPreviewTone === 'cashout' ? 0.94 : 0.88}
                                position={[0, 0.033, 0.00004]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                scale={[0.78, 0.68, 1]}
                            />
                            <ReadabilityMaterialMesh
                                color={faceUpTraitPreviewAccentColor}
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                opacity={faceUpTraitPreviewTone === 'cashout' ? 0.98 : 0.9}
                                position={[0, 0.06, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                scale={[0.56, 0.74, 1]}
                            />
                            <SignalCapRow
                                color={faceUpTraitPreviewAccentColor}
                                count={2}
                                keyPrefix={`face-up-trait-preview-${tile.id}`}
                                opacity={faceUpTraitPreviewTone === 'cashout' ? 0.96 : 0.88}
                                positionY={0.052}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 2}
                                supportColor="#fff7c4"
                            />
                            <ReadabilityMaterialMesh
                                color="#100d14"
                                geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                opacity={0.72}
                                position={[0.0, 0.001, 0.00005]}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                scale={[0.46, 0.46, 1]}
                            />
                            {Array.from({ length: faceUpTraitPreviewBeatCount }, (_, index) => (
                                <ReadabilityMaterialMesh
                                    color={index === 0 ? '#f7f1c2' : '#fff7c4'}
                                    geometry={BOARD_READABILITY_PIP_GEOMETRY}
                                    opacity={index === 0 ? 0.98 : 0.82}
                                    position={[
                                        (index - (faceUpTraitPreviewBeatCount - 1) / 2) * 0.082,
                                        -0.032,
                                        0.00006 + index * 0.00001
                                    ]}
                                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                                    scale={index === 0 ? [0.64, 0.64, 1] : [0.5, 0.5, 1]}
                                    key={`face-up-trait-preview-${tile.id}-${index}`}
                                />
                            ))}
                        </group>
                    ) : null}
                    {isTrapCard ? (
                        <ReadabilityMaterialMesh
                            color={trapReadabilityColor}
                            geometry={BOARD_READABILITY_BAR_GEOMETRY}
                            opacity={isResolvedTrap ? 0.74 : 0.96}
                            position={[0, -CARD_HEIGHT * 0.42, 0.00076]}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                        />
                    ) : null}
                    {isExitCard ? (
                        <ReadabilityMaterialMesh
                            color="#7bd88f"
                            geometry={BOARD_READABILITY_STATE_RAIL_GEOMETRY}
                            opacity={0.94}
                            position={[CARD_WIDTH * 0.35, -CARD_HEIGHT * 0.39, 0.00076]}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                        />
                    ) : null}
                    {isLockCard ? (
                        <ReadabilityMaterialMesh
                            color="#f2d39d"
                            geometry={BOARD_READABILITY_PIP_GEOMETRY}
                            opacity={0.94}
                            position={[-CARD_WIDTH * 0.35, -CARD_HEIGHT * 0.39, 0.00077]}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                        />
                    ) : null}
                    {isLeverCard ? (
                        <ReadabilityMaterialMesh
                            color="#d4a03d"
                            geometry={BOARD_READABILITY_BAR_GEOMETRY}
                            opacity={0.94}
                            position={[CARD_WIDTH * 0.35, -CARD_HEIGHT * 0.39, 0.00077]}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            rotation={[0, 0, Math.PI / 2.8]}
                        />
                    ) : null}
                    {isShopCard ? (
                        <ReadabilityMaterialMesh
                            color="#5ee0c8"
                            geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                            opacity={0.96}
                            position={[CARD_WIDTH * 0.35, -CARD_HEIGHT * 0.39, 0.00077]}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            rotation={[0, 0, Math.PI / 4]}
                        />
                    ) : null}
                    {isBossCard ? (
                        <group position={[0, CARD_HEIGHT * 0.42, 0.00078]}>
                            <mesh
                                geometry={BOARD_READABILITY_BOSS_MARK_GEOMETRY}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            >
                                <meshBasicMaterial
                                    color="#09070d"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.72}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                            <mesh
                                geometry={BOARD_READABILITY_SHORT_BAR_GEOMETRY}
                                position={[0, 0.002, 0.00004]}
                                raycast={noopMeshRaycast}
                                renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder + 1}
                            >
                                <meshBasicMaterial
                                    color="#ffcf66"
                                    depthTest
                                    depthWrite={false}
                                    opacity={0.98}
                                    side={DoubleSide}
                                    toneMapped={false}
                                    transparent
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {isRelicCard ? (
                        <ReadabilityMaterialMesh
                            color="#5ee0c8"
                            geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                            opacity={0.96}
                            position={[CARD_WIDTH * 0.35, -CARD_HEIGHT * 0.39, 0.00077]}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            rotation={[0, 0, Math.PI / 4]}
                        />
                    ) : null}
                </group>
            ) : null}
        </>
    );
};
