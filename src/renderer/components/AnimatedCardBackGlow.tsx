import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type Mesh, type MeshBasicMaterial, type PlaneGeometry, type Texture } from 'three';

import { noopMeshRaycast } from './tileBoardPick';
import { cardHeatLevels, cardMatchFlare } from './tileBoardCardHeat';

/**
 * The card back, answering the run.
 *
 * Two additive layers over the painted plate, keyed out of that same painting so nothing has to be
 * erased from it: the cyan rune light across the whole back, and the labyrinth medallion, which
 * turns. Both ride `heat` — the chain meter's fill — so a streak visibly winds the board up and a
 * break drops it still (`tileBoardCardHeat`). A landed pair throws a flare on top.
 *
 * Every card gets its own phase from its seed, so a board of backs shimmers rather than pulsing as
 * one slab, and the medallions are never in step.
 */
interface AnimatedCardBackGlowProps {
    /** Chain meter fill, 0 at rest to 1 at Fever. */
    heat: number;
    /** True once this card's pair has landed; the flare is timed from the transition. */
    matched: boolean;
    geometry: PlaneGeometry;
    glowTexture: Texture | null;
    reduceMotion: boolean;
    seed: number;
    spinGeometry: PlaneGeometry;
    spinTexture: Texture | null;
    z: number;
}

const fract = (value: number): number => value - Math.floor(value);

export const AnimatedCardBackGlow = memo(
    ({
        geometry,
        glowTexture,
        heat,
        matched,
        reduceMotion,
        seed,
        spinGeometry,
        spinTexture,
        z
    }: AnimatedCardBackGlowProps) => {
        const glowMatRef = useRef<MeshBasicMaterial | null>(null);
        const spinMatRef = useRef<MeshBasicMaterial | null>(null);
        const spinMeshRef = useRef<Mesh | null>(null);
        /*
         * When the pair landed, on the render clock. Stamped inside the frame loop because that is
         * the only clock the flare is measured against, and cleared when the card leaves the matched
         * state so a re-deal cannot inherit an old flare.
         */
        const matchedAtRef = useRef<number | null>(null);
        const phase = fract(seed * 0.618034) * Math.PI * 2;

        useFrame((state) => {
            const t = state.clock.elapsedTime;
            if (matched && matchedAtRef.current == null) {
                matchedAtRef.current = t;
            } else if (!matched && matchedAtRef.current != null) {
                matchedAtRef.current = null;
            }
            const levels = cardHeatLevels(heat);
            // A slow breath per card so a still board is never dead, and never a single pulse.
            const breath = reduceMotion ? 1 : 1 + 0.12 * Math.sin(t * 0.9 + phase);
            const matchedAt = matchedAtRef.current;
            const flare = matchedAt == null ? 0 : cardMatchFlare(t - matchedAt, heat);

            const glowMat = glowMatRef.current;
            if (glowMat) {
                glowMat.opacity = Math.min(1.6, levels.runeGlow * breath + flare);
            }

            const spinMat = spinMatRef.current;
            if (spinMat) {
                spinMat.opacity = Math.min(1.4, levels.spin * breath + flare * 0.6);
            }

            const spinMesh = spinMeshRef.current;
            if (spinMesh && !reduceMotion) {
                // Turns per second, one way: a mechanism winding, not an ornament wobbling.
                spinMesh.rotation.z = -t * levels.spinRate * Math.PI * 2 + phase * 0.2;
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
                            opacity={0}
                            side={DoubleSide}
                            toneMapped={false}
                            transparent
                        />
                    </mesh>
                ) : null}
                {spinTexture ? (
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
AnimatedCardBackGlow.displayName = 'AnimatedCardBackGlow';
