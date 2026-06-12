import type { RefObject } from 'react';
import {
    DoubleSide,
    type BufferGeometry,
    type Mesh,
    type MeshBasicMaterial,
    type PlaneGeometry,
    type ShaderMaterial,
    type Texture
} from 'three';

import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { RENDERER_THEME } from '../styles/theme';
import { PairProximityHintPlane } from './PairProximityHintPlane';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

const CARD_WIDTH = CARD_PLANE_WIDTH;
const CARD_HEIGHT = CARD_PLANE_HEIGHT;

interface TileBoardEffectOverlaysProps {
    arcaneGlowGeometry: BufferGeometry;
    curseRingGeometry: BufferGeometry;
    faceZ: number;
    findableCornerRingGeometry: BufferGeometry;
    focusGlowMatRef: RefObject<ShaderMaterial | null>;
    focusGlowMaterial: ShaderMaterial;
    focusGlowMeshRef: RefObject<Mesh | null>;
    focusRimMatRef: RefObject<MeshBasicMaterial | null>;
    focusRingGeometry: BufferGeometry;
    graphicsQuality: GraphicsQualityPreset;
    matchedEdgeGeometry: BufferGeometry;
    matchedRimFireMaterial: ShaderMaterial;
    matchedVictoryFlameMatRef: RefObject<ShaderMaterial | null>;
    matchedVictoryFlameMeshRef: RefObject<Mesh | null>;
    memorizeCurseHighlight: boolean;
    overlayGeometry: PlaneGeometry;
    overlayTexture: Texture | null;
    overlayZ: number;
    pairProximityDistance: number | null;
    resolvingGlowMatRef: RefObject<ShaderMaterial | null>;
    resolvingGlowMaterial: ShaderMaterial;
    resolvingGlowMeshRef: RefObject<Mesh | null>;
    resolvingInnerGeometry: BufferGeometry;
    resolvingRimMatRef: RefObject<MeshBasicMaterial | null>;
    spotlightBountyHighlight: boolean;
    spotlightWardHighlight: boolean;
    stickyFingerSlotMark: boolean;
    surfaceVariant: string;
    tile: Tile;
}

export const TileBoardEffectOverlays = ({
    arcaneGlowGeometry,
    curseRingGeometry,
    faceZ,
    findableCornerRingGeometry,
    focusGlowMatRef,
    focusGlowMaterial,
    focusGlowMeshRef,
    focusRimMatRef,
    focusRingGeometry,
    graphicsQuality,
    matchedEdgeGeometry,
    matchedRimFireMaterial,
    matchedVictoryFlameMatRef,
    matchedVictoryFlameMeshRef,
    memorizeCurseHighlight,
    overlayGeometry,
    overlayTexture,
    overlayZ,
    pairProximityDistance,
    resolvingGlowMatRef,
    resolvingGlowMaterial,
    resolvingGlowMeshRef,
    resolvingInnerGeometry,
    resolvingRimMatRef,
    spotlightBountyHighlight,
    spotlightWardHighlight,
    stickyFingerSlotMark,
    surfaceVariant,
    tile
}: TileBoardEffectOverlaysProps) => (
    <>
        {memorizeCurseHighlight ? (
            <mesh geometry={curseRingGeometry} position={[0, 0, faceZ + 0.014]} raycast={noopMeshRaycast} renderOrder={9}>
                <meshBasicMaterial
                    color="#c49cff"
                    depthTest
                    depthWrite={false}
                    opacity={0.88}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        ) : null}
        {spotlightWardHighlight ? (
            <mesh
                geometry={findableCornerRingGeometry}
                position={[-CARD_WIDTH * 0.36, CARD_HEIGHT * 0.4, faceZ + 0.018]}
                raycast={noopMeshRaycast}
                renderOrder={9}
            >
                <meshBasicMaterial
                    color="#ff7a6a"
                    depthTest
                    depthWrite={false}
                    opacity={0.9}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        ) : null}
        {spotlightBountyHighlight ? (
            <mesh
                geometry={findableCornerRingGeometry}
                position={[CARD_WIDTH * 0.36, -CARD_HEIGHT * 0.4, faceZ + 0.018]}
                raycast={noopMeshRaycast}
                renderOrder={9}
            >
                <meshBasicMaterial
                    color="#5ee0c8"
                    depthTest
                    depthWrite={false}
                    opacity={0.9}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        ) : null}
        {stickyFingerSlotMark && tile.state === 'matched' ? (
            <mesh
                geometry={findableCornerRingGeometry}
                position={[0, CARD_HEIGHT * 0.41, faceZ + 0.019]}
                raycast={noopMeshRaycast}
                renderOrder={9}
            >
                <meshBasicMaterial
                    color="#c65a28"
                    depthTest
                    depthWrite={false}
                    opacity={0.87}
                    side={DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        ) : null}
        {overlayTexture ? (
            <mesh geometry={overlayGeometry} position={[0, 0, overlayZ]} raycast={noopMeshRaycast} renderOrder={10}>
                <meshBasicMaterial
                    alphaTest={0.08}
                    color={
                        surfaceVariant === 'matched' && graphicsQuality === 'high'
                            ? '#fff9f2'
                            : surfaceVariant === 'matched' && graphicsQuality === 'medium'
                              ? '#fff6ec'
                              : '#ffffff'
                    }
                    depthTest={false}
                    depthWrite={false}
                    map={overlayTexture}
                    opacity={surfaceVariant === 'matched' && graphicsQuality !== 'low' ? 0.97 : 0.93}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        ) : null}
        {pairProximityDistance != null ? (
            <PairProximityHintPlane distance={pairProximityDistance} faceZ={faceZ} />
        ) : null}
        <mesh
            ref={matchedVictoryFlameMeshRef}
            geometry={matchedEdgeGeometry}
            position={[0, 0, faceZ + 0.024]}
            raycast={noopMeshRaycast}
            renderOrder={18}
            visible={false}
        >
            <primitive ref={matchedVictoryFlameMatRef} object={matchedRimFireMaterial} attach="material" />
        </mesh>
        <mesh
            geometry={resolvingInnerGeometry}
            position={[0, 0, faceZ + 0.024]}
            raycast={noopMeshRaycast}
            renderOrder={13}
        >
            <meshBasicMaterial
                ref={resolvingRimMatRef}
                color={RENDERER_THEME.colors.emeraldBright}
                depthTest
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
            ref={resolvingGlowMeshRef}
            geometry={arcaneGlowGeometry}
            position={[0, 0, faceZ + 0.026]}
            raycast={noopMeshRaycast}
            renderOrder={14}
            visible={false}
        >
            <primitive ref={resolvingGlowMatRef} object={resolvingGlowMaterial} attach="material" />
        </mesh>
        <mesh geometry={focusRingGeometry} position={[0, 0, faceZ + 0.027]} raycast={noopMeshRaycast} renderOrder={15}>
            <meshBasicMaterial
                ref={focusRimMatRef}
                color={RENDERER_THEME.colors.goldBright}
                depthTest
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
            ref={focusGlowMeshRef}
            geometry={arcaneGlowGeometry}
            position={[0, 0, faceZ + 0.029]}
            raycast={noopMeshRaycast}
            renderOrder={16}
            visible={false}
        >
            <primitive ref={focusGlowMatRef} object={focusGlowMaterial} attach="material" />
        </mesh>
    </>
);
