import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
    CircleGeometry,
    MathUtils,
    PlaneGeometry,
    type BufferGeometry,
    type Group
} from 'three';
import type { EnemyHazardState, GraphicsQualityPreset } from '../../shared/contracts';
import { enemyHazardColor } from './tileBoardThreatColors';
import type { TileTransform } from './tileBoardTransform';
import {
    DUNGEON_BOARD_STAGE_LAYER_POLICY,
    getDungeonBoardStageLod,
    getDungeonEnemyMarkerAnchor,
    getDungeonEnemyMarkerVisualProfile,
    type DungeonEnemyMarkerShape
} from './tileBoardStageLayers';

interface TileBoardEnemyHazardMarkerProps {
    hazard: EnemyHazardState;
    currentTransform: TileTransform;
    graphicsQuality: GraphicsQualityPreset;
    nextTransform: TileTransform | null;
    reduceMotion: boolean;
}

const ENEMY_MARKER_GEOMETRY = new PlaneGeometry(0.22, 0.22, 1, 1);
const ENEMY_STALKER_MARKER_GEOMETRY = new PlaneGeometry(0.14, 0.28, 1, 1);
const ENEMY_WARDEN_MARKER_GEOMETRY = new PlaneGeometry(0.28, 0.18, 1, 1);
const ENEMY_OBSERVER_MARKER_GEOMETRY = new PlaneGeometry(0.3, 0.08, 1, 1);
const ENEMY_BOSS_MARKER_GEOMETRY = new CircleGeometry(0.16, 32);
const ENEMY_BOSS_HALO_GEOMETRY = new CircleGeometry(0.2, 32);
const ENEMY_BOSS_CROWN_GEOMETRY = new CircleGeometry(0.055, 16);
const ENEMY_NEXT_MARKER_GEOMETRY = new PlaneGeometry(0.32, 0.32, 1, 1);
const ENEMY_NEXT_BOSS_MARKER_GEOMETRY = new CircleGeometry(0.18, 32);
const ENEMY_MARKER_PLATE_GEOMETRY = new PlaneGeometry(0.42, 0.3, 1, 1);
const ENEMY_MARKER_HP_TRACK_GEOMETRY = new PlaneGeometry(0.3, 0.028, 1, 1);

const enemyHazardGeometryForShape = (shape: DungeonEnemyMarkerShape): BufferGeometry => {
    if (shape === 'stalker-spear') return ENEMY_STALKER_MARKER_GEOMETRY;
    if (shape === 'warden-shield') return ENEMY_WARDEN_MARKER_GEOMETRY;
    if (shape === 'observer-eye') return ENEMY_OBSERVER_MARKER_GEOMETRY;
    if (shape === 'boss-crown') return ENEMY_BOSS_MARKER_GEOMETRY;
    return ENEMY_MARKER_GEOMETRY;
};

export const TileBoardEnemyHazardMarker = ({
    hazard,
    currentTransform,
    graphicsQuality,
    nextTransform,
    reduceMotion
}: TileBoardEnemyHazardMarkerProps) => {
    const groupRef = useRef<Group | null>(null);
    const color = enemyHazardColor(hazard);
    const lod = getDungeonBoardStageLod(graphicsQuality, reduceMotion);
    const visual = getDungeonEnemyMarkerVisualProfile(hazard, graphicsQuality, reduceMotion);
    const geometry = enemyHazardGeometryForShape(visual.shape);
    const healthRatio = hazard.maxHp > 0 ? MathUtils.clamp(hazard.hp / hazard.maxHp, 0, 1) : 0;
    const scale = (hazard.bossId ? 1.42 : 1.08) * (0.84 + healthRatio * 0.16);

    useLayoutEffect(() => {
        const group = groupRef.current;
        if (!group) return;
        group.position.set(...getDungeonEnemyMarkerAnchor(currentTransform, 'currentThreat'));
        group.scale.setScalar(scale);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- first render seeds the animated marker at its current tile

    useFrame((state, delta) => {
        const group = groupRef.current;
        if (!group) return;
        const bob =
            lod.markerMotionEnabled && visual.motionHz > 0
                ? Math.sin(state.clock.elapsedTime * (1.6 + visual.motionHz) + currentTransform.seed * 0.017) * 0.025
                : 0;
        const [x, y, baseZ] = getDungeonEnemyMarkerAnchor(currentTransform, 'currentThreat', bob);
        const z = baseZ + (hazard.state === 'revealed' ? 0.035 : 0);
        if (!lod.markerMotionEnabled) {
            group.position.set(x, y, z);
        } else {
            group.position.x = MathUtils.damp(group.position.x, x, 8.5, delta);
            group.position.y = MathUtils.damp(group.position.y, y, 8.5, delta);
            group.position.z = MathUtils.damp(group.position.z, z, 9.5, delta);
            group.rotation.z += delta * (hazard.bossId ? 0.7 : 1.05);
        }
        group.scale.setScalar(scale);
    });

    return (
        <>
            {nextTransform ? (
                <mesh
                    geometry={hazard.bossId ? ENEMY_NEXT_BOSS_MARKER_GEOMETRY : ENEMY_NEXT_MARKER_GEOMETRY}
                    position={getDungeonEnemyMarkerAnchor(nextTransform, 'nextThreatTelegraph')}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.nextThreatTelegraph.renderOrder}
                    rotation={[0, 0, Math.PI / 4]}
                    scale={hazard.bossId ? 1.12 : 0.9}
                >
                    <meshBasicMaterial
                        color={color}
                        depthWrite={false}
                        opacity={lod.nextTelegraphOpacity}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            ) : null}
            <group ref={groupRef}>
                <mesh
                    geometry={ENEMY_MARKER_PLATE_GEOMETRY}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder - 1}
                    scale={hazard.bossId ? [1.16, 1.08, 1] : [1, 1, 1]}
                >
                    <meshBasicMaterial
                        color="#09070d"
                        depthWrite={false}
                        opacity={hazard.bossId ? 0.84 : 0.74}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
                <mesh
                    geometry={geometry}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                    rotation={[0, 0, visual.mainRotation]}
                    scale={visual.mainScale}
                >
                    <meshBasicMaterial
                        color={color}
                        depthWrite={false}
                        opacity={lod.currentMarkerOpacity}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
                <mesh
                    geometry={hazard.bossId ? ENEMY_BOSS_HALO_GEOMETRY : ENEMY_MARKER_GEOMETRY}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                    rotation={[0, 0, Math.PI / 4]}
                    scale={hazard.bossId ? 1.56 : 1.5}
                >
                    <meshBasicMaterial color={color} depthWrite={false} opacity={visual.haloOpacity} toneMapped={false} transparent />
                </mesh>
                {visual.shape === 'observer-eye' ? (
                    <mesh
                        geometry={ENEMY_OBSERVER_MARKER_GEOMETRY}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                        rotation={[0, 0, 0]}
                        scale={[1.34, 0.5, 1]}
                    >
                        <meshBasicMaterial color="#fff8d8" depthWrite={false} opacity={visual.secondaryOpacity} toneMapped={false} transparent />
                    </mesh>
                ) : null}
                {visual.shape === 'boss-crown' ? (
                    <mesh
                        geometry={ENEMY_BOSS_CROWN_GEOMETRY}
                        position={[0, 0.115, 0.001]}
                        renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                    >
                        <meshBasicMaterial color="#fff8d8" depthWrite={false} opacity={visual.secondaryOpacity} toneMapped={false} transparent />
                    </mesh>
                ) : null}
                <mesh
                    geometry={ENEMY_MARKER_HP_TRACK_GEOMETRY}
                    position={[0, -0.165, 0.002]}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder}
                >
                    <meshBasicMaterial color="#07060a" depthWrite={false} opacity={0.82} toneMapped={false} transparent />
                </mesh>
                <mesh
                    geometry={ENEMY_MARKER_HP_TRACK_GEOMETRY}
                    position={[-0.15 * (1 - healthRatio), -0.165, 0.003]}
                    renderOrder={DUNGEON_BOARD_STAGE_LAYER_POLICY.currentThreat.renderOrder + 1}
                    scale={[Math.max(0.08, healthRatio), 1, 1]}
                >
                    <meshBasicMaterial color={color} depthWrite={false} opacity={0.94} toneMapped={false} transparent />
                </mesh>
            </group>
        </>
    );
};
