import { useFrame } from '@react-three/fiber';
import { memo, useRef, type MutableRefObject } from 'react';
import {
    DoubleSide,
    type CanvasTexture,
    type Mesh,
    type MeshStandardMaterial,
    type Texture
} from 'three';

import type { CardBackSvgLayerGeometry } from './cardSvgPlaneGeometry';
import { noopMeshRaycast } from './tileBoardPick';
import type { gameplayRenderQualityProfile } from './gameplayRenderProfile';
import {
    CARD_BACK_LAYER_BASE_OPACITY,
    computeCardBackLayerVisualState
} from './tileBoardCardBackLayerVisualState';

interface AnimatedCardBackSvgLayersProps {
    backCardMatRef: MutableRefObject<MeshStandardMaterial | null>;
    cardPanelDisplacementMap: CanvasTexture | null;
    cardTint: string;
    faceZ: number;
    layers: readonly CardBackSvgLayerGeometry[];
    normalMap: Texture | null;
    reduceMotion: boolean;
    renderQuality: ReturnType<typeof gameplayRenderQualityProfile>;
    roughnessMap: CanvasTexture | null;
    seed: number;
}

export const AnimatedCardBackSvgLayers = memo(
    ({
        backCardMatRef,
        cardPanelDisplacementMap,
        cardTint,
        faceZ,
        layers,
        normalMap,
        reduceMotion,
        renderQuality,
        roughnessMap,
        seed
    }: AnimatedCardBackSvgLayersProps) => {
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

                const visualState = computeCardBackLayerVisualState({
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
            <group position={[0, 0, -faceZ]} rotation={[0, Math.PI, 0]}>
                {layers.map((layer, index) => (
                    <mesh
                        key={layer.name}
                        geometry={layer.geometry}
                        raycast={noopMeshRaycast}
                        ref={(mesh) => {
                            meshRefs.current[index] = mesh;
                        }}
                        renderOrder={index}
                    >
                        <meshStandardMaterial
                            ref={(mat) => {
                                matRefs.current[index] = mat;
                                if (index === 0) {
                                    backCardMatRef.current = mat;
                                }
                            }}
                            alphaTest={0.03}
                            color={cardTint}
                            depthWrite
                            displacementBias={-renderQuality.cardDisplacementScale * 0.5}
                            displacementMap={cardPanelDisplacementMap ?? undefined}
                            displacementScale={renderQuality.cardDisplacementScale}
                            emissive="#6eb9d8"
                            emissiveIntensity={0}
                            metalness={layer.name === 'back-gem' ? 0.18 : renderQuality.cardMetalness}
                            normalMap={normalMap ?? undefined}
                            normalScale={renderQuality.cardNormalScale}
                            opacity={CARD_BACK_LAYER_BASE_OPACITY[layer.name] ?? 1}
                            roughness={layer.name === 'back-gem' ? 0.34 : renderQuality.cardRoughness}
                            roughnessMap={roughnessMap ?? undefined}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                            vertexColors
                        />
                    </mesh>
                ))}
            </group>
        );
    }
);
AnimatedCardBackSvgLayers.displayName = 'AnimatedCardBackSvgLayers';
