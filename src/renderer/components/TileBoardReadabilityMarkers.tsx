import { CircleGeometry, DoubleSide, PlaneGeometry, type BufferGeometry } from 'three';
import type { HazardTileKind, Tile } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { DUNGEON_BOARD_STAGE_LAYER_POLICY } from './tileBoardStageLayers';
import { getTileBoardReadabilityState } from './tileBoardReadability';
import { hazardTileColor } from './tileBoardThreatColors';

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;
const CARD_FACE_INSET = 0.016;
const CARD_FACE_HEIGHT = CARD_HEIGHT - CARD_FACE_INSET * 2;
const HOVER_GOLD_RIM_STRIP = 0.0036;

const BOARD_READABILITY_PIP_GEOMETRY = new CircleGeometry(0.043, 20);
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
    powerBackAccent: 'destroy' | 'peek' | 'stray' | 'pin' | null;
    routeBackAccent: boolean;
    spotlightBountyOnBack: boolean;
    spotlightWardOnBack: boolean;
    stickyFingerSlotMark: boolean;
    tile: Tile;
}

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
    powerBackAccent,
    routeBackAccent,
    spotlightBountyOnBack,
    spotlightWardOnBack,
    stickyFingerSlotMark,
    tile
}: TileBoardReadabilityMarkersProps) => {
    const {
        enemyOccupiedColor,
        faceReadabilityAccentColor,
        hiddenReadabilityAccentColor,
        isArmedTrap,
        isBossCard,
        isRelicCard,
        isResolvedTrap,
        isSelectedCard,
        isTrapCard,
        showFaceReadabilityMarker,
        showHiddenReadabilityMarkers,
        showHiddenReadabilityRing,
        trapReadabilityColor
    } = getTileBoardReadabilityState({
        destroyBlockedDecoyBack,
        enemyOccupiedBack,
        faceUp,
        hazardBackAccent,
        nonPickableBack,
        objectiveBackAccent,
        powerBackAccent,
        routeBackAccent,
        spotlightBountyOnBack,
        spotlightWardOnBack,
        stickyFingerSlotMark,
        tile
    });

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
                    <mesh
                        geometry={BOARD_READABILITY_SELECTED_RAIL_GEOMETRY}
                        position={[-CARD_WIDTH * 0.45, 0, 0.0007]}
                        raycast={noopMeshRaycast}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
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
                        geometry={BOARD_READABILITY_SELECTED_RAIL_GEOMETRY}
                        position={[CARD_WIDTH * 0.45, 0, 0.0007]}
                        raycast={noopMeshRaycast}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                    >
                        <meshBasicMaterial
                            color="#59b4d9"
                            depthTest
                            depthWrite={false}
                            opacity={0.86}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                </group>
            ) : null}
            {showFaceReadabilityMarker ? (
                <group position={[0, 0, faceZ + 0.0005]}>
                    <mesh
                        geometry={matchedEdgeGeometry}
                        raycast={noopMeshRaycast}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveRing.renderOrder}
                        scale={[0.93, 0.93, 1]}
                    >
                        <meshBasicMaterial
                            color={faceReadabilityAccentColor}
                            depthTest
                            depthWrite={false}
                            opacity={isResolvedTrap ? 0.46 : isBossCard ? 0.7 : 0.62}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    <mesh
                        geometry={BOARD_READABILITY_PIP_GEOMETRY}
                        position={[CARD_WIDTH * 0.35, CARD_HEIGHT * 0.39, 0.00072]}
                        raycast={noopMeshRaycast}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                    >
                        <meshBasicMaterial
                            color={faceReadabilityAccentColor}
                            depthTest
                            depthWrite={false}
                            opacity={isResolvedTrap ? 0.78 : 0.96}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                    {isTrapCard ? (
                        <mesh
                            geometry={BOARD_READABILITY_BAR_GEOMETRY}
                            position={[0, -CARD_HEIGHT * 0.42, 0.00076]}
                            raycast={noopMeshRaycast}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                        >
                            <meshBasicMaterial
                                color={trapReadabilityColor}
                                depthTest
                                depthWrite={false}
                                opacity={isResolvedTrap ? 0.74 : 0.96}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
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
                        <mesh
                            geometry={BOARD_READABILITY_LARGE_PIP_GEOMETRY}
                            position={[CARD_WIDTH * 0.35, -CARD_HEIGHT * 0.39, 0.00077]}
                            raycast={noopMeshRaycast}
                            renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.objectiveGlyph.renderOrder}
                            rotation={[0, 0, Math.PI / 4]}
                        >
                            <meshBasicMaterial
                                color="#5ee0c8"
                                depthTest
                                depthWrite={false}
                                opacity={0.96}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                            />
                        </mesh>
                    ) : null}
                </group>
            ) : null}
        </>
    );
};
