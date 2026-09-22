import { useFrame } from '@react-three/fiber';
import { memo, useRef, type MutableRefObject } from 'react';
import { DoubleSide, type CanvasTexture, type Mesh, type MeshStandardMaterial, type Texture } from 'three';

import type { CardFrontSvgLayerGeometry } from './cardSvgPlaneGeometry';
import type { gameplayRenderQualityProfile } from './gameplayRenderProfile';
import { noopMeshRaycast } from './tileBoardPick';
import {
    CARD_FRONT_LAYER_BASE_OPACITY,
    CARD_FRONT_UNDER_ART_LAYERS,
    computeCardFrontLayerVisualState
} from './tileBoardCardFrontLayerVisualState';

/**
 * The card's face as the authored SVG, playing.
 *
 * The illustration stays a raster (it is painted art, and a mesh of it would be tens of thousands
 * of triangles per card); the frame around it is traced from `authored-card-front.svg` into one
 * mesh per `<g id="front-*">` and animated (`tileBoardCardFrontLayerVisualState`): the gold catches
 * light, the well behind the art breathes, the rune ring turns, the corner ticks come up in turn,
 * The panel and the well render *behind* the art plane,
 * the rest over it, so nothing the player has to read is ever covered.
 *
 * `frontCardMatRef` still points at the panel's material: the flip, the tint and the dissolve all
 * drive it, and they must keep working whether the face is a raster or these layers.
 */
interface AnimatedCardFrontSvgLayersProps {
    artZ: number;
    cardPanelDisplacementMap: CanvasTexture | null;
    cardTint: string;
    faceZ: number;
    frontCardMatRef: MutableRefObject<MeshStandardMaterial | null>;
    layers: readonly CardFrontSvgLayerGeometry[];
    normalMap: Texture | null;
    reduceMotion: boolean;
    renderQuality: ReturnType<typeof gameplayRenderQualityProfile>;
    roughnessMap: CanvasTexture | null;
    seed: number;
}

export const AnimatedCardFrontSvgLayers = memo(
    ({
        artZ,
        cardPanelDisplacementMap,
        cardTint,
        faceZ,
        frontCardMatRef,
        layers,
        normalMap,
        reduceMotion,
        renderQuality,
        roughnessMap,
        seed
    }: AnimatedCardFrontSvgLayersProps) => {
        const meshRefs = useRef<Array<Mesh | null>>([]);
        const matRefs = useRef<Array<MeshStandardMaterial | null>>([]);

        useFrame((state) => {
            const t = state.clock.elapsedTime;
            for (let index = 0; index < layers.length; index += 1) {
                const layer = layers[index]!;
                const mesh = meshRefs.current[index];
                const mat = matRefs.current[index];
                if (!mesh || !mat) {
                    continue;
                }
                const visualState = computeCardFrontLayerVisualState({
                    index,
                    layerName: layer.name,
                    reduceMotion,
                    seed,
                    time: t
                });
                mesh.position.set(visualState.x, visualState.y, visualState.z);
                mesh.rotation.z = visualState.rotationZ;
                mesh.scale.setScalar(visualState.scale);
                mat.opacity = visualState.opacity;
                mat.emissiveIntensity = visualState.emissiveIntensity;
            }
        });

        return (
            <group position={[0, 0, faceZ]}>
                {layers.map((layer, index) => {
                    const underArt = CARD_FRONT_UNDER_ART_LAYERS.has(layer.name);
                    return (
                        <mesh
                            key={layer.name}
                            geometry={layer.geometry}
                            position={[0, 0, underArt ? -artZ : artZ]}
                            raycast={noopMeshRaycast}
                            ref={(mesh) => {
                                meshRefs.current[index] = mesh;
                            }}
                            renderOrder={underArt ? index : 7 + index}
                        >
                            <meshStandardMaterial
                                ref={(mat) => {
                                    matRefs.current[index] = mat;
                                    if (index === 0) {
                                        frontCardMatRef.current = mat;
                                    }
                                }}
                                alphaTest={0.03}
                                color={cardTint}
                                depthWrite={underArt}
                                displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                                displacementMap={underArt ? (cardPanelDisplacementMap ?? undefined) : undefined}
                                displacementScale={underArt ? renderQuality.cardDisplacementScale : 0}
                                emissive="#f2d39d"
                                emissiveIntensity={0}
                                metalness={underArt ? renderQuality.cardMetalness : 0.32}
                                normalMap={underArt ? (normalMap ?? undefined) : undefined}
                                normalScale={renderQuality.cardNormalScale}
                                opacity={CARD_FRONT_LAYER_BASE_OPACITY[layer.name] ?? 1}
                                roughness={underArt ? renderQuality.cardRoughness : 0.38}
                                roughnessMap={underArt ? (roughnessMap ?? undefined) : undefined}
                                side={DoubleSide}
                                toneMapped={false}
                                transparent
                                vertexColors
                            />
                        </mesh>
                    );
                })}
            </group>
        );
    }
);
AnimatedCardFrontSvgLayers.displayName = 'AnimatedCardFrontSvgLayers';
