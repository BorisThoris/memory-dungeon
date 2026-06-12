import type { RefObject } from 'react';
import {
    DoubleSide,
    PlaneGeometry,
    type BufferGeometry,
    type Mesh,
    type MeshBasicMaterial,
    type ShaderMaterial
} from 'three';
import { RENDERER_THEME } from '../styles/theme';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;
const HOVER_GOLD_RIM_STRIP = 0.0036;

const hoverGoldRimGeomH = new PlaneGeometry(CARD_WIDTH, HOVER_GOLD_RIM_STRIP, 1, 1);
const hoverGoldRimGeomV = new PlaneGeometry(HOVER_GOLD_RIM_STRIP, CARD_HEIGHT, 1, 1);

type HoverChromeFace = 'back' | 'front';

interface TileBoardHoverChromeProps {
    arcaneGlowGeometry: BufferGeometry;
    face: HoverChromeFace;
    faceZ: number;
    glowMaterial: ShaderMaterial;
    glowMaterialRef: RefObject<ShaderMaterial | null>;
    glowMeshRef: RefObject<Mesh | null>;
    rimBottomMatRef: RefObject<MeshBasicMaterial | null>;
    rimLeftMatRef: RefObject<MeshBasicMaterial | null>;
    rimRightMatRef: RefObject<MeshBasicMaterial | null>;
    rimTopMatRef: RefObject<MeshBasicMaterial | null>;
}

const faceChromeConfig = {
    back: {
        glowZ: 0.00064,
        groupPositionZ: -0.00028,
        rimZ: 0.00045,
        rotationY: Math.PI
    },
    front: {
        glowZ: 0.00068,
        groupPositionZ: 0.00032,
        rimZ: 0.00042,
        rotationY: 0
    }
} satisfies Record<HoverChromeFace, { glowZ: number; groupPositionZ: number; rimZ: number; rotationY: number }>;

export const TileBoardHoverChrome = ({
    arcaneGlowGeometry,
    face,
    faceZ,
    glowMaterial,
    glowMaterialRef,
    glowMeshRef,
    rimBottomMatRef,
    rimLeftMatRef,
    rimRightMatRef,
    rimTopMatRef
}: TileBoardHoverChromeProps) => {
    const config = faceChromeConfig[face];
    const zSign = face === 'back' ? -1 : 1;

    return (
        <group position={[0, 0, zSign * faceZ + config.groupPositionZ]} rotation={[0, config.rotationY, 0]}>
            <mesh
                ref={glowMeshRef}
                geometry={arcaneGlowGeometry}
                position={[0, 0, config.glowZ]}
                raycast={noopMeshRaycast}
                renderOrder={8}
                visible={false}
            >
                <primitive ref={glowMaterialRef} object={glowMaterial} attach="material" />
            </mesh>
            <mesh
                geometry={hoverGoldRimGeomH}
                position={[0, CARD_HEIGHT * 0.5 - HOVER_GOLD_RIM_STRIP * 0.5, config.rimZ]}
                raycast={noopMeshRaycast}
                renderOrder={7}
            >
                <meshBasicMaterial
                    ref={rimTopMatRef}
                    color={RENDERER_THEME.colors.goldBright}
                    depthWrite={false}
                    opacity={0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
            <mesh
                geometry={hoverGoldRimGeomH}
                position={[0, -CARD_HEIGHT * 0.5 + HOVER_GOLD_RIM_STRIP * 0.5, config.rimZ]}
                raycast={noopMeshRaycast}
                renderOrder={7}
            >
                <meshBasicMaterial
                    ref={rimBottomMatRef}
                    color={RENDERER_THEME.colors.goldBright}
                    depthWrite={false}
                    opacity={0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
            <mesh
                geometry={hoverGoldRimGeomV}
                position={[CARD_WIDTH * 0.5 - HOVER_GOLD_RIM_STRIP * 0.5, 0, config.rimZ]}
                raycast={noopMeshRaycast}
                renderOrder={7}
            >
                <meshBasicMaterial
                    ref={rimRightMatRef}
                    color={RENDERER_THEME.colors.goldBright}
                    depthWrite={false}
                    opacity={0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
            <mesh
                geometry={hoverGoldRimGeomV}
                position={[-CARD_WIDTH * 0.5 + HOVER_GOLD_RIM_STRIP * 0.5, 0, config.rimZ]}
                raycast={noopMeshRaycast}
                renderOrder={7}
            >
                <meshBasicMaterial
                    ref={rimLeftMatRef}
                    color={RENDERER_THEME.colors.goldBright}
                    depthWrite={false}
                    opacity={0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        </group>
    );
};
