import { memo, type MutableRefObject } from 'react';
import {
    DoubleSide,
    MultiplyBlending,
    type BufferGeometry,
    type CanvasTexture,
    type MeshStandardMaterial,
    type PlaneGeometry,
    type Texture
} from 'three';

import { AnimatedCardBackSvgLayers } from './AnimatedCardBackSvgLayers';
import type { CardBackSvgLayerGeometry } from './cardSvgPlaneGeometry';
import type { GameplayRenderQualityProfile } from './gameplayRenderProfile';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_WEAR_Z_SLIVER, type CardWearAssetSet } from './tileBoardCardBend';
import { TutorialPairMarkerPlane } from './TutorialPairMarkerPlane';

interface TileBoardCardSurfaceProps {
    backCardMatRef: MutableRefObject<MeshStandardMaterial | null>;
    backGeometry: PlaneGeometry;
    backNormalMap: Texture | null;
    backRoughnessMap: CanvasTexture | null;
    cardBackArtTexture: CanvasTexture | null;
    cardFrontArtTexture: CanvasTexture | null;
    cardPanelDisplacementMap: CanvasTexture | null;
    cardTint: string;
    faceZ: number;
    frontCardMatRef: MutableRefObject<MeshStandardMaterial | null>;
    frontGeometry: PlaneGeometry;
    frontNormalMap: Texture | null;
    frontRoughnessMap: CanvasTexture | null;
    reduceMotion: boolean;
    renderQuality: GameplayRenderQualityProfile;
    seed: number;
    sharedCardBackLayers: readonly CardBackSvgLayerGeometry[] | null;
    sharedCardFrontGeometry: BufferGeometry | null;
    tutorialPairOrdinal: number | null;
    useSvgMeshBack: boolean;
    useSvgMeshFront: boolean;
    wearAssets: CardWearAssetSet | null;
}

export const TileBoardCardSurface = memo(
    ({
        backCardMatRef,
        backGeometry,
        backNormalMap,
        backRoughnessMap,
        cardBackArtTexture,
        cardFrontArtTexture,
        cardPanelDisplacementMap,
        cardTint,
        faceZ,
        frontCardMatRef,
        frontGeometry,
        frontNormalMap,
        frontRoughnessMap,
        reduceMotion,
        renderQuality,
        seed,
        sharedCardBackLayers,
        sharedCardFrontGeometry,
        tutorialPairOrdinal,
        useSvgMeshBack,
        useSvgMeshFront,
        wearAssets
    }: TileBoardCardSurfaceProps) => (
        <>
            {useSvgMeshFront && sharedCardFrontGeometry ? (
                <mesh geometry={sharedCardFrontGeometry} position={[0, 0, faceZ]} raycast={noopMeshRaycast}>
                    <meshStandardMaterial
                        ref={frontCardMatRef}
                        alphaTest={0.06}
                        color={cardTint}
                        depthWrite
                        displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                        displacementMap={cardPanelDisplacementMap ?? undefined}
                        displacementScale={renderQuality.cardDisplacementScale}
                        metalness={renderQuality.cardMetalness}
                        normalMap={frontNormalMap ?? undefined}
                        normalScale={renderQuality.cardNormalScale}
                        roughness={renderQuality.cardRoughness}
                        roughnessMap={frontRoughnessMap ?? undefined}
                        side={DoubleSide}
                        toneMapped={false}
                        transparent
                        vertexColors
                    />
                </mesh>
            ) : (
                <mesh geometry={frontGeometry} position={[0, 0, faceZ]} raycast={noopMeshRaycast}>
                    <meshStandardMaterial
                        ref={frontCardMatRef}
                        alphaTest={0.06}
                        color={cardTint}
                        depthWrite
                        displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                        displacementMap={cardPanelDisplacementMap ?? undefined}
                        displacementScale={renderQuality.cardDisplacementScale}
                        map={cardFrontArtTexture ?? undefined}
                        metalness={renderQuality.cardMetalness}
                        normalMap={frontNormalMap ?? undefined}
                        normalScale={renderQuality.cardNormalScale}
                        roughness={renderQuality.cardRoughness}
                        roughnessMap={frontRoughnessMap ?? undefined}
                        side={DoubleSide}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            )}
            {wearAssets ? (
                <mesh
                    geometry={frontGeometry}
                    position={[0, 0, faceZ + CARD_WEAR_Z_SLIVER]}
                    raycast={noopMeshRaycast}
                    renderOrder={6}
                >
                    <meshBasicMaterial
                        blending={MultiplyBlending}
                        depthWrite={false}
                        map={wearAssets.front.texture}
                        polygonOffset
                        polygonOffsetFactor={-1}
                        polygonOffsetUnits={-1}
                        premultipliedAlpha
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            ) : null}
            {useSvgMeshBack && sharedCardBackLayers ? (
                <AnimatedCardBackSvgLayers
                    backCardMatRef={backCardMatRef}
                    cardPanelDisplacementMap={cardPanelDisplacementMap}
                    cardTint={cardTint}
                    faceZ={faceZ}
                    layers={sharedCardBackLayers}
                    normalMap={backNormalMap}
                    reduceMotion={reduceMotion}
                    renderQuality={renderQuality}
                    roughnessMap={backRoughnessMap}
                    seed={seed}
                />
            ) : (
                <mesh geometry={backGeometry} position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]} raycast={noopMeshRaycast}>
                    <meshStandardMaterial
                        ref={backCardMatRef}
                        alphaTest={0.06}
                        color={cardTint}
                        depthWrite
                        displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                        displacementMap={cardPanelDisplacementMap ?? undefined}
                        displacementScale={renderQuality.cardDisplacementScale}
                        map={cardBackArtTexture ?? undefined}
                        metalness={renderQuality.cardMetalness}
                        normalMap={backNormalMap ?? undefined}
                        normalScale={renderQuality.cardNormalScale}
                        roughness={renderQuality.cardRoughness}
                        roughnessMap={backRoughnessMap ?? undefined}
                        side={DoubleSide}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            )}
            {wearAssets ? (
                <mesh
                    geometry={backGeometry}
                    position={[0, 0, -faceZ - CARD_WEAR_Z_SLIVER]}
                    raycast={noopMeshRaycast}
                    renderOrder={6}
                    rotation={[0, Math.PI, 0]}
                >
                    <meshBasicMaterial
                        blending={MultiplyBlending}
                        depthWrite={false}
                        map={wearAssets.back.texture}
                        polygonOffset
                        polygonOffsetFactor={-1}
                        polygonOffsetUnits={-1}
                        premultipliedAlpha
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            ) : null}
            {tutorialPairOrdinal != null ? (
                <TutorialPairMarkerPlane faceZ={faceZ} ordinal={tutorialPairOrdinal} />
            ) : null}
        </>
    )
);
TileBoardCardSurface.displayName = 'TileBoardCardSurface';
