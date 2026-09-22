import { memo, type MutableRefObject } from 'react';
import {
    DoubleSide,
    MultiplyBlending,
    type CanvasTexture,
    type MeshStandardMaterial,
    type PlaneGeometry,
    type Texture
} from 'three';

import { AnimatedCardBackGlow } from './AnimatedCardBackGlow';
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
    /** The back's rune light and its turning medallion, and how hard the chain drives them. */
    cardBackGlowTexture: Texture | null;
    cardBackSpinGeometry: PlaneGeometry;
    cardBackSpinTexture: Texture | null;
    cardHeat: number;
    /** False on a device that cannot afford the back's moving light. */
    cardGlowAnimated: boolean;
    /** True once this card's pair has landed: the back throws a flare. */
    cardMatched: boolean;
    /** False while the card is face up, when its back cannot be seen. */
    cardBackVisible: boolean;
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
    tutorialPairOrdinal: number | null;
    wearAssets: CardWearAssetSet | null;
}

export const TileBoardCardSurface = memo(
    ({
        backCardMatRef,
        backGeometry,
        backNormalMap,
        backRoughnessMap,
        cardBackArtTexture,
        cardBackGlowTexture,
        cardBackSpinGeometry,
        cardBackSpinTexture,
        cardBackVisible,
        cardGlowAnimated,
        cardHeat,
        cardMatched,
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
        tutorialPairOrdinal,
        wearAssets
    }: TileBoardCardSurfaceProps) => (
        <>
            {/*
             * The face is the painted plate with the per-tile illustration drawn over it
             * (`getTileFaceOverlayTexture`). It used to be this plus six SVG frame meshes, which
             * put a third frame on a card that already had two painted ones.
             */}
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
            {/* The back answers the run: its own light rises with the chain and the labyrinth turns. */}
            <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
                <AnimatedCardBackGlow
                    animated={cardGlowAnimated}
                    geometry={backGeometry}
                    glowTexture={cardBackGlowTexture}
                    heat={cardHeat}
                    matched={cardMatched}
                    visible={cardBackVisible}
                    reduceMotion={reduceMotion}
                    seed={seed}
                    spinGeometry={cardBackSpinGeometry}
                    spinTexture={cardBackSpinTexture}
                    z={-CARD_WEAR_Z_SLIVER * 0.5}
                />
            </group>
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
