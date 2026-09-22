import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type Mesh, type MeshBasicMaterial, type PlaneGeometry, type Texture } from 'three';

import { noopMeshRaycast } from './tileBoardPick';
import { advanceCardGlowFrame, initialCardGlowMemory, type CardGlowFrameMemory } from './cardGlowFrame';
import { cardHeatLevels } from './tileBoardCardHeat';

/**
 * A card side, answering the run.
 *
 * Additive light over the painted plate, keyed out of that same painting so nothing has to be
 * erased from it (`scripts/card-pipeline/cut_card_back_glow.py`). The back gets its cyan runes and
 * the labyrinth medallion, which turns; the face gets the gems set around its frame. Both sides
 * ride the same `heat` — the chain meter's fill — so a streak winds the whole board up and a break
 * drops it still (`tileBoardCardHeat`). A landed pair throws a flare on top.
 *
 * Every card gets its own phase from its seed, so a board of backs shimmers rather than pulsing as
 * one slab, and the medallions are never in step.
 *
 * A card whose back is hidden, or a device that cannot afford the motion, does no per-frame work at
 * all: the frame callback returns immediately and the medallion is not mounted. The rune light is
 * still there at its resting level, because a streak has to be legible on every device.
 */
interface AnimatedCardGlowProps {
    /** Chain meter fill, 0 at rest to 1 at Fever. */
    heat: number;
    /** False while the card is face up: its back is behind the art and nothing here can be seen. */
    visible: boolean;
    /**
     * False on a device that cannot afford the medallion's mesh and its frame loop. The rune light
     * still rises with the chain — it is the streak's feedback and the reason the feature exists —
     * but it is set when the heat changes rather than driven every frame.
     */
    animated: boolean;
    /** True once this card's pair has landed; the flare is timed from the transition. */
    matched: boolean;
    geometry: PlaneGeometry;
    glowTexture: Texture | null;
    reduceMotion: boolean;
    seed: number;
    /** The turning medallion, on the side that has one; omitted on the face. */
    spinGeometry?: PlaneGeometry;
    spinTexture?: Texture | null;
    z: number;
}

export const AnimatedCardGlow = memo(
    ({
        geometry,
        glowTexture,
        animated,
        heat,
        matched,
        reduceMotion,
        visible,
        seed,
        spinGeometry,
        spinTexture = null,
        z
    }: AnimatedCardGlowProps) => {
        const glowMatRef = useRef<MeshBasicMaterial | null>(null);
        const spinMatRef = useRef<MeshBasicMaterial | null>(null);
        const spinMeshRef = useRef<Mesh | null>(null);
        /*
         * What this card carries between frames: the heat it last saw (a large fall is the break),
         * when its pair landed, and when it last guttered. Kept in a ref rather than state because
         * it changes every frame and nothing outside the frame loop reads it.
         */
        const memoryRef = useRef<CardGlowFrameMemory>(initialCardGlowMemory(heat));

        // The still level for a card whose device (or player) has turned the motion off, and the
        // starting level for one that has not: a board is never drawn with the light at zero.
        const restingGlow = cardHeatLevels(heat).runeGlow;

        useFrame((state) => {
            if (!visible || !animated) {
                return;
            }
            const { frame, memory } = advanceCardGlowFrame(
                { heat, matched, reduceMotion, seed, time: state.clock.elapsedTime },
                memoryRef.current
            );
            memoryRef.current = memory;

            const glowMat = glowMatRef.current;
            if (glowMat) {
                glowMat.opacity = frame.glowOpacity;
            }

            const spinMat = spinMatRef.current;
            if (spinMat) {
                spinMat.opacity = frame.spinOpacity;
            }

            const spinMesh = spinMeshRef.current;
            if (spinMesh) {
                spinMesh.rotation.z = frame.spinRotation;
            }
        });

        return (
            <>
                {glowTexture ? (
                    <mesh geometry={geometry} position={[0, 0, z]} raycast={noopMeshRaycast} renderOrder={4}>
                        <meshBasicMaterial
                            ref={glowMatRef}
                            blending={AdditiveBlending}
                            depthWrite={false}
                            map={glowTexture}
                            opacity={restingGlow}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {spinTexture && spinGeometry && animated ? (
                    <mesh
                        geometry={spinGeometry}
                        position={[0, 0, z + 0.00008]}
                        raycast={noopMeshRaycast}
                        ref={spinMeshRef}
                        renderOrder={5}
                    >
                        <meshBasicMaterial
                            ref={spinMatRef}
                            blending={AdditiveBlending}
                            depthWrite={false}
                            map={spinTexture}
                            opacity={0}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
            </>
        );
    }
);
AnimatedCardGlow.displayName = 'AnimatedCardGlow';
